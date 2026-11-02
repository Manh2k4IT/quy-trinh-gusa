(async function () {
  const panel = document.querySelector('[data-attendance-sites]');
  if (!panel) return;
  const blocks = [...panel.querySelectorAll('[data-attendance-site]')];

  // Google Maps "Plus Codes" (Open Location Code). Short codes such as "QMCX+V6M Bến Thành" are
  // completed from a Ho Chi Minh City reference point, which is valid within ~40 km of it.
  const plusCodeAlphabet = '23456789CFGHJMPQRVWX';
  const plusCodeReference = { latitude: 10.7769, longitude: 106.7009 };
  const encodePlusCodePrefix = ({ latitude, longitude }) => {
    let lat = latitude + 90;
    let lng = longitude + 180;
    let code = '';
    for (const resolution of [20, 1, 0.05, 0.0025]) {
      const latDigit = Math.floor(lat / resolution);
      const lngDigit = Math.floor(lng / resolution);
      lat -= latDigit * resolution;
      lng -= lngDigit * resolution;
      code += plusCodeAlphabet[latDigit] + plusCodeAlphabet[lngDigit];
    }
    return code;
  };
  const decodePlusCode = (value) => {
    const match = value.toUpperCase().match(/(?:^|\s)([23456789CFGHJMPQRVWX]{2,8})\+([23456789CFGHJMPQRVWX]{0,3})(?=\s|,|$)/);
    if (!match || match[1].length % 2) return null;
    const head = match[1].length < 8 ? encodePlusCodePrefix(plusCodeReference).slice(0, 8 - match[1].length) + match[1] : match[1];
    const digits = head + match[2];
    let latitude = -90;
    let longitude = -180;
    let latResolution = 400;
    let lngResolution = 400;
    for (let index = 0; index < Math.min(digits.length, 10); index += 2) {
      latResolution /= 20;
      lngResolution /= 20;
      latitude += plusCodeAlphabet.indexOf(digits[index]) * latResolution;
      longitude += plusCodeAlphabet.indexOf(digits[index + 1] || '2') * lngResolution;
    }
    if (digits.length > 10) {
      const grid = plusCodeAlphabet.indexOf(digits[10]);
      latResolution /= 5;
      lngResolution /= 4;
      latitude += Math.floor(grid / 4) * latResolution;
      longitude += (grid % 4) * lngResolution;
    }
    latitude += latResolution / 2;
    longitude += lngResolution / 2;
    if (match[1].length < 8) {
      // Pick the cell nearest the reference when the completed code lands in a neighbouring block.
      const block = 20 ** (2 - (8 - match[1].length) / 2);
      if (plusCodeReference.latitude + block / 2 < latitude) latitude -= block;
      else if (plusCodeReference.latitude - block / 2 > latitude) latitude += block;
      if (plusCodeReference.longitude + block / 2 < longitude) longitude -= block;
      else if (plusCodeReference.longitude - block / 2 > longitude) longitude += block;
    }
    return { latitude: Number(latitude.toFixed(6)), longitude: Number(longitude.toFixed(6)) };
  };
  // Accepts a Plus Code, "lat, lng" or a Google Maps link (…/@lat,lng,…  ?q=lat,lng  !3dlat!4dlng).
  const parseCoordinates = (value) => {
    const plusCode = decodePlusCode(value);
    if (plusCode) return plusCode;
    let text = value.trim();
    try { text = decodeURIComponent(text); } catch {}
    const match = text.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/)
      || text.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/)
      || text.match(/(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/);
    if (!match) return null;
    const latitude = Number(match[1]);
    const longitude = Number(match[2]);
    return Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 ? { latitude, longitude } : null;
  };
  const getPosition = () => new Promise((resolve, reject) => {
    const geolocation = window.desktopSettings?.getCurrentPosition ? window.desktopSettings : navigator.geolocation;
    if (!geolocation) return reject(new Error('Thiết bị không hỗ trợ lấy vị trí.'));
    geolocation.getCurrentPosition(resolve, () => reject(new Error('Không lấy được vị trí. Hãy bật vị trí (GPS), cho phép truy cập rồi thử lại.')), { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
  });

  const setupBlock = (block) => {
    const site = block.dataset.attendanceSite;
    const label = block.dataset.siteLabel;
    const emptyText = block.dataset.siteEmpty;
    const radius = block.querySelector('[data-site-radius]');
    const coordinates = block.querySelector('[data-site-coordinates]');
    const saveTyped = block.querySelector('[data-site-save-typed]');
    const saveCurrent = block.querySelector('[data-site-save-current]');
    const current = block.querySelector('[data-site-current]');
    const status = block.querySelector('[data-site-status]');
    const setBusy = (busy) => {
      [radius, coordinates, saveTyped, saveCurrent].forEach((control) => { control.disabled = busy; });
    };
    const apply = (point) => {
      current.replaceChildren();
      if (!point) {
        current.textContent = emptyText;
        return;
      }
      radius.value = point.radiusMeters;
      const link = document.createElement('a');
      link.href = `https://www.google.com/maps?q=${point.latitude},${point.longitude}`;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = `${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}`;
      current.append(link, ` · bán kính ${point.radiusMeters} m`);
    };
    const savePoint = async ({ latitude, longitude }) => {
      const response = await fetch('/api/attendance-sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ site, point: { latitude, longitude, radiusMeters: Number(radius.value) } }),
      });
      const settings = await response.json();
      if (!response.ok) throw new Error(settings.message || 'Không lưu được vị trí chấm công.');
      apply(settings.sites[site]);
    };
    const run = async (busyText, action) => {
      setBusy(true);
      status.textContent = busyText;
      try {
        status.textContent = await action();
      } catch (error) {
        console.error(`Không lưu được vị trí chấm công ${label}:`, error);
        status.textContent = error.message;
      } finally {
        setBusy(false);
      }
    };
    saveTyped.addEventListener('click', () => {
      const point = parseCoordinates(coordinates.value);
      if (!point) {
        status.textContent = 'Không đọc được tọa độ. Hãy dán tọa độ dạng "10.772500, 106.698000", Plus Code (ví dụ QMCX+V6M) hoặc link Google Maps.';
        coordinates.focus();
        return;
      }
      run('Đang lưu vị trí đã nhập...', async () => {
        await savePoint(point);
        coordinates.value = '';
        return `Đã lưu điểm ${label} theo tọa độ đã nhập. Bấm vào tọa độ ở trên để kiểm tra lại trên Google Maps.`;
      });
    });
    saveCurrent.addEventListener('click', () => run('Đang lấy vị trí hiện tại...', async () => {
      const position = await getPosition();
      if (position.coords.accuracy > 100 && !confirm(`Vị trí hiện tại chỉ chính xác khoảng ${Math.round(position.coords.accuracy)} m. Vẫn lưu làm điểm ${label}?`)) {
        return 'Đã hủy. Hãy ra gần cửa hoặc bật Wi-Fi/GPS để vị trí chính xác hơn rồi thử lại.';
      }
      await savePoint(position.coords);
      return `Đã lưu điểm ${label} (sai số khoảng ${Math.round(position.coords.accuracy)} m).`;
    }));
    return { apply, setBusy, status };
  };

  const controllers = Object.fromEntries(blocks.map((block) => [block.dataset.attendanceSite, setupBlock(block)]));
  try {
    const me = await fetch('/api/me', { cache: 'no-store' });
    if (!me.ok) throw new Error('Không tải được thông tin tài khoản.');
    const { user } = await me.json();
    if (user?.status !== 'active' || !['admin', 'ceo'].includes(user.role)) return;
    panel.hidden = false;
    const response = await fetch('/api/attendance-sites', { cache: 'no-store' });
    const settings = await response.json();
    if (!response.ok) throw new Error(settings.message || 'Không tải được vị trí chấm công.');
    for (const [site, controller] of Object.entries(controllers)) {
      controller.apply(settings.sites[site]);
      controller.setBusy(false);
    }
  } catch (error) {
    console.error('Không tải được vị trí chấm công:', error);
    Object.values(controllers).forEach((controller) => { controller.status.textContent = error.message; });
  }
})();
