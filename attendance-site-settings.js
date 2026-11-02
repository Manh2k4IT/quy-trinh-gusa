(async function () {
  const panel = document.querySelector('[data-attendance-site]');
  if (!panel) return;
  const form = panel.querySelector('[data-attendance-site-form]');
  const radius = panel.querySelector('[data-attendance-site-radius]');
  const save = panel.querySelector('[data-attendance-site-save]');
  const coordinates = panel.querySelector('[data-attendance-site-coordinates]');
  const saveTyped = panel.querySelector('[data-attendance-site-save-typed]');
  const current = panel.querySelector('[data-attendance-site-current]');
  const status = panel.querySelector('[data-attendance-site-status]');
  const setBusy = (busy) => {
    radius.disabled = busy;
    save.disabled = busy;
    coordinates.disabled = busy;
    saveTyped.disabled = busy;
  };
  // Accepts "lat, lng" or a Google Maps link (…/@lat,lng,…  ?q=lat,lng  !3dlat!4dlng).
  const parseCoordinates = (value) => {
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
  const savePoint = async ({ latitude, longitude }) => {
    const response = await fetch('/api/attendance-sites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ benThanh: { latitude, longitude, radiusMeters: Number(radius.value) } }),
    });
    const settings = await response.json();
    if (!response.ok) throw new Error(settings.message || 'Không lưu được vị trí chấm công.');
    apply(settings);
  };
  const apply = ({ benThanh }) => {
    current.replaceChildren();
    if (!benThanh) {
      current.textContent = 'Chưa có — nhân viên chưa chấm công Bến Thành được.';
      return;
    }
    radius.value = benThanh.radiusMeters;
    const link = document.createElement('a');
    link.href = `https://www.google.com/maps?q=${benThanh.latitude},${benThanh.longitude}`;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = `${benThanh.latitude.toFixed(6)}, ${benThanh.longitude.toFixed(6)}`;
    current.append(link, ` · bán kính ${benThanh.radiusMeters} m`);
  };
  const getPosition = () => new Promise((resolve, reject) => {
    const geolocation = window.desktopSettings?.getCurrentPosition ? window.desktopSettings : navigator.geolocation;
    if (!geolocation) return reject(new Error('Thiết bị không hỗ trợ lấy vị trí.'));
    geolocation.getCurrentPosition(resolve, () => reject(new Error('Không lấy được vị trí. Hãy bật vị trí (GPS), cho phép truy cập rồi thử lại.')), { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
  });
  try {
    const me = await fetch('/api/me', { cache: 'no-store' });
    if (!me.ok) throw new Error('Không tải được thông tin tài khoản.');
    const { user } = await me.json();
    if (user?.status !== 'active' || !['admin', 'ceo'].includes(user.role)) return;
    panel.hidden = false;
    const response = await fetch('/api/attendance-sites', { cache: 'no-store' });
    const settings = await response.json();
    if (!response.ok) throw new Error(settings.message || 'Không tải được vị trí chấm công.');
    apply(settings);
    setBusy(false);
  } catch (error) {
    console.error('Không tải được vị trí chấm công:', error);
    status.textContent = error.message;
    return;
  }
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setBusy(true);
    status.textContent = 'Đang lấy vị trí hiện tại...';
    try {
      const position = await getPosition();
      if (position.coords.accuracy > 100 && !confirm(`Vị trí hiện tại chỉ chính xác khoảng ${Math.round(position.coords.accuracy)} m. Vẫn lưu làm điểm Bến Thành?`)) {
        status.textContent = 'Đã hủy. Hãy ra gần cửa hoặc bật Wi-Fi/GPS để vị trí chính xác hơn rồi thử lại.';
        return;
      }
      await savePoint(position.coords);
      status.textContent = `Đã lưu điểm Bến Thành (sai số khoảng ${Math.round(position.coords.accuracy)} m).`;
    } catch (error) {
      console.error('Không lưu được vị trí chấm công:', error);
      status.textContent = error.message;
    } finally {
      setBusy(false);
    }
  });
  saveTyped.addEventListener('click', async () => {
    const point = parseCoordinates(coordinates.value);
    if (!point) {
      status.textContent = 'Không đọc được tọa độ. Hãy dán dạng "10.772500, 106.698000" hoặc link Google Maps có tọa độ.';
      coordinates.focus();
      return;
    }
    setBusy(true);
    status.textContent = 'Đang lưu vị trí đã nhập...';
    try {
      await savePoint(point);
      coordinates.value = '';
      status.textContent = 'Đã lưu điểm Bến Thành theo tọa độ đã nhập. Bấm vào tọa độ ở trên để kiểm tra lại trên Google Maps.';
    } catch (error) {
      console.error('Không lưu được vị trí chấm công:', error);
      status.textContent = error.message;
    } finally {
      setBusy(false);
    }
  });
})();
