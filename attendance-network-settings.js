(async function () {
  const panel = document.querySelector('[data-attendance-network]');
  if (!panel) return;
  const form = panel.querySelector('[data-attendance-network-form]');
  const input = panel.querySelector('[data-attendance-network-ips]');
  const save = panel.querySelector('[data-attendance-save-network]');
  const addCurrent = panel.querySelector('[data-attendance-add-current-ip]');
  const status = panel.querySelector('[data-attendance-network-status]');
  const current = panel.querySelector('[data-attendance-current-ip]');
  let currentIp = '';
  let currentNetwork = '';
  const readIps = () => input.value.split(/\r?\n/).map((ip) => ip.trim()).filter(Boolean);
  const setBusy = (busy) => {
    input.disabled = busy;
    save.disabled = busy;
    addCurrent.disabled = busy || !currentIp;
  };
  const apply = (settings) => {
    input.value = settings.allowedIps.join('\n');
    currentIp = settings.currentIp;
    currentNetwork = settings.currentNetwork || currentIp;
    current.textContent = currentIp || 'Không xác định được IP — kiểm tra cấu hình proxy của máy chủ.';
    status.textContent = settings.allowedIps.length
      ? `Đang giới hạn chấm công tại công ty theo ${settings.allowedIps.length} IP/dải mạng.`
      : 'Chưa giới hạn mạng: danh sách IP đang trống.';
  };
  try {
    const me = await fetch('/api/me', { cache: 'no-store' });
    if (!me.ok) throw new Error('Không tải được thông tin tài khoản.');
    const { user } = await me.json();
    if (user?.status !== 'active' || !['admin', 'ceo'].includes(user.role)) return;
    panel.hidden = false;
    const response = await fetch('/api/attendance-network', { cache: 'no-store' });
    const settings = await response.json();
    if (!response.ok) throw new Error(settings.message || 'Không tải được cấu hình mạng chấm công.');
    apply(settings);
    setBusy(false);
  } catch (error) {
    console.error('Không tải được cấu hình mạng chấm công:', error);
    status.textContent = error.message;
    return;
  }
  addCurrent.addEventListener('click', () => {
    input.value = [...new Set([...readIps(), currentNetwork])].join('\n');
    status.textContent = 'Đã thêm mạng hiện tại vào ô nhập (IPv6 dùng dải /64 cho các thiết bị cùng mạng). Nhấn Lưu danh sách IP để áp dụng; chỉ thêm khi bạn đang kết nối mạng công ty.';
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setBusy(true);
    status.textContent = 'Đang lưu danh sách IP...';
    try {
      const response = await fetch('/api/attendance-network', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowedIps: readIps() }),
      });
      const settings = await response.json();
      if (!response.ok) throw new Error(settings.message || 'Không lưu được cấu hình mạng chấm công.');
      apply(settings);
    } catch (error) {
      console.error('Không lưu được cấu hình mạng chấm công:', error);
      status.textContent = error.message;
    } finally {
      setBusy(false);
    }
  });
})();
