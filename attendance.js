const appShell = document.querySelector('.app-shell');
const mobileMenuToggle = document.querySelector('[data-mobile-menu-toggle]');
const mobileMenuBackdrop = document.querySelector('[data-mobile-menu-backdrop]');
const adminMenu = document.querySelector('[data-admin-menu]');
const adminMenuLabel = document.querySelector('[data-admin-menu-label]');
const list = document.querySelector('[data-attendance-list]');
const monthSelect = document.querySelector('[data-attendance-month]');
const checkIn = document.querySelector('[data-check-in]');
const checkOut = document.querySelector('[data-check-out]');
const status = document.querySelector('[data-attendance-status]');
const message = document.querySelector('[data-attendance-message]');
const attendanceTypeChoice = document.querySelector('[data-attendance-type-choice]');
const currentTime = document.querySelector('[data-current-time]');
const currentDate = document.querySelector('[data-current-date]');
let records = {};
const isWorkdayOverview = new URLSearchParams(window.location.search).get('view') === 'days';
const isOnlineAttendance = new URLSearchParams(window.location.search).get('view') === 'online';
let onlineProof = null;
let updateOnlineCheckIn = () => {};

const attendanceMenuItem = document.querySelector('.menu-item[href="attendance.html"]');
const attendanceGroupLabel = document.createElement('p');
attendanceGroupLabel.className = 'menu-label';
attendanceGroupLabel.textContent = 'CHẤM CÔNG';
const attendanceGroup = document.createElement('nav');
attendanceGroup.className = 'menu';
attendanceGroup.setAttribute('aria-label', 'Menu chấm công');
const attendanceOverviewMenuItem = document.createElement('a');
attendanceOverviewMenuItem.className = 'menu-item';
attendanceOverviewMenuItem.href = 'attendance-overview.html';
attendanceOverviewMenuItem.innerHTML = '<span class="menu-icon">♙</span><span>Tổng quan nhân sự</span>';
attendanceOverviewMenuItem.hidden = true;
const onlineAttendanceMenuItem = document.createElement('a');
onlineAttendanceMenuItem.className = 'menu-item';
onlineAttendanceMenuItem.href = 'attendance.html?view=online';
onlineAttendanceMenuItem.innerHTML = '<span class="menu-icon">⌁</span><span>Chấm công làm online</span>';
const workdayOverviewMenuItem = document.createElement('a');
workdayOverviewMenuItem.className = 'menu-item';
workdayOverviewMenuItem.href = 'attendance.html?view=days';
workdayOverviewMenuItem.innerHTML = '<span class="menu-icon">▦</span><span>Tổng quan ngày công</span>';
const onlineStaffMenuItem = document.createElement('a');
onlineStaffMenuItem.className = 'menu-item';
onlineStaffMenuItem.href = 'attendance-overview.html?report=online';
onlineStaffMenuItem.hidden = true;
onlineStaffMenuItem.innerHTML = '<span class="menu-icon">♙</span><span>Báo cáo nhân sự làm online</span>';
const lateReportMenuItem = document.createElement('a');
lateReportMenuItem.className = 'menu-item';
lateReportMenuItem.href = 'attendance-overview.html?report=late';
lateReportMenuItem.hidden = true;
lateReportMenuItem.innerHTML = '<span class="menu-icon">◷</span><span>Báo cáo đi trễ</span>';
if (attendanceMenuItem) {
  attendanceMenuItem.remove();
  attendanceMenuItem.querySelector('span:last-child').textContent = 'Chấm công tại công ty';
  attendanceGroup.append(attendanceMenuItem, onlineAttendanceMenuItem, workdayOverviewMenuItem, onlineStaffMenuItem, lateReportMenuItem, attendanceOverviewMenuItem);
  if (isWorkdayOverview) {
    attendanceMenuItem.classList.remove('is-active');
    attendanceMenuItem.removeAttribute('aria-current');
    workdayOverviewMenuItem.classList.add('is-active');
    workdayOverviewMenuItem.setAttribute('aria-current', 'page');
  }
  if (isOnlineAttendance) {
    attendanceMenuItem.classList.remove('is-active');
    attendanceMenuItem.removeAttribute('aria-current');
    onlineAttendanceMenuItem.classList.add('is-active');
    onlineAttendanceMenuItem.setAttribute('aria-current', 'page');
  }
  const settingsLabel = [...document.querySelectorAll('.menu-label')].find((label) => label.textContent.trim() === 'CÀI ĐẶT');
  settingsLabel?.before(attendanceGroupLabel, attendanceGroup);
}

if (isWorkdayOverview) {
  document.querySelector('.attendance-summary')?.setAttribute('hidden', '');
  document.querySelector('.attendance-heading h1')?.replaceChildren(document.createTextNode('Tổng quan ngày công'));
  document.querySelector('.attendance-heading p')?.replaceChildren(document.createTextNode('Theo dõi bảng công theo từng tuần trong tháng.'));
  document.querySelector('.breadcrumbs strong')?.replaceChildren(document.createTextNode('Tổng quan ngày công'));
} else {
  document.querySelector('.attendance-history')?.setAttribute('hidden', '');
}

if (isOnlineAttendance) {
  document.querySelector('.attendance-heading h1')?.replaceChildren(document.createTextNode('Chấm công làm online'));
  document.querySelector('.attendance-heading p')?.replaceChildren(document.createTextNode('Chụp ảnh và chia sẻ vị trí nơi bạn đang làm việc trước khi check-in.'));
  document.querySelector('.breadcrumbs strong')?.replaceChildren(document.createTextNode('Chấm công làm online'));
  const clockCard = document.querySelector('.attendance-clock-card');
  const proofPanel = document.createElement('div');
  proofPanel.className = 'attendance-online-proof';
  proofPanel.innerHTML = '<strong>Xác minh nơi làm việc</strong><label class="attendance-proof-control"><span>Ảnh nơi làm việc</span><input type="file" accept="image/*" capture="user" data-online-photo /><small data-online-photo-status>Chưa chụp ảnh</small></label><button class="attendance-secondary" type="button" data-online-location>Chia sẻ vị trí</button><small data-online-location-status>Chưa chia sẻ vị trí</small>';
  clockCard?.insertBefore(proofPanel, document.querySelector('[data-attendance-status]'));
  const photoInput = proofPanel.querySelector('[data-online-photo]');
  const photoStatus = proofPanel.querySelector('[data-online-photo-status]');
  const locationButton = proofPanel.querySelector('[data-online-location]');
  const locationStatus = proofPanel.querySelector('[data-online-location-status]');
  const refreshOnlineCheckIn = () => {
    const ready = Boolean(onlineProof?.photoCapturedAt && onlineProof.photoData && onlineProof.latitude !== undefined);
    checkIn.hidden = !ready;
    checkIn.disabled = !ready;
  };
  updateOnlineCheckIn = refreshOnlineCheckIn;
  photoInput.addEventListener('change', () => {
    if (!photoInput.files?.length) return;
    const file = photoInput.files[0];
    photoStatus.textContent = 'Đang đọc ảnh...';
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      onlineProof = { ...(onlineProof || {}), photoCapturedAt: new Date().toISOString(), photoData: String(reader.result) };
      photoStatus.textContent = `Đã chụp: ${file.name}`;
      refreshOnlineCheckIn();
    });
    reader.readAsDataURL(file);
  });
  locationButton.addEventListener('click', () => {
    if (!navigator.geolocation) { locationStatus.textContent = 'Thiết bị không hỗ trợ chia sẻ vị trí.'; return; }
    locationButton.disabled = true;
    locationStatus.textContent = 'Đang lấy vị trí hiện tại...';
    navigator.geolocation.getCurrentPosition((position) => {
      onlineProof = { ...(onlineProof || {}), latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy };
      locationStatus.textContent = `Đã chia sẻ vị trí (sai số khoảng ${Math.round(position.coords.accuracy)}m)`;
      locationButton.textContent = 'Đã chia sẻ vị trí';
      refreshOnlineCheckIn();
    }, () => { locationButton.disabled = false; locationStatus.textContent = 'Không lấy được vị trí. Hãy cho phép truy cập vị trí và thử lại.'; });
  });
  checkIn.hidden = true;
  if (attendanceTypeChoice) attendanceTypeChoice.hidden = true;
}

function setMobileMenu(open) {
  appShell.classList.toggle('is-mobile-menu-open', open);
  mobileMenuBackdrop.hidden = !open;
  mobileMenuToggle.setAttribute('aria-expanded', String(open));
}
mobileMenuToggle.addEventListener('click', () => setMobileMenu(!appShell.classList.contains('is-mobile-menu-open')));
mobileMenuBackdrop.addEventListener('click', () => setMobileMenu(false));
document.querySelector('[data-sidebar-toggle]').addEventListener('click', () => { const collapsed = appShell.classList.toggle('is-collapsed'); localStorage.setItem('gusa-sidebar-collapsed', String(collapsed)); });
if (localStorage.getItem('gusa-sidebar-collapsed') === 'true') appShell.classList.add('is-collapsed');

document.body.dataset.theme = localStorage.getItem('gusa-theme') || 'light';
const palette = JSON.parse(localStorage.getItem('gusa-palette') || 'null');
document.documentElement.style.setProperty('--navy', palette?.primary || '#174b8e');
document.documentElement.style.setProperty('--blue-100', palette?.surface || '#eaf2fa');

function setAdminVisibility(isAdmin) {
  if (adminMenu) adminMenu.hidden = !isAdmin;
  if (adminMenuLabel) adminMenuLabel.hidden = !isAdmin;
  attendanceOverviewMenuItem.hidden = !isAdmin;
  onlineStaffMenuItem.hidden = !isAdmin;
  lateReportMenuItem.hidden = !isAdmin;
  workdayOverviewMenuItem.hidden = isAdmin;
  document.querySelectorAll('.role-chip').forEach((button) => {
    const roleText = button.textContent.trim();
    const targetLabel = roleText === 'CEO' ? 'CEO' : isAdmin ? 'Quản trị' : 'Nhân viên';
    button.textContent = targetLabel;
    const current = button.textContent.trim() === targetLabel;
    button.hidden = !current;
    button.classList.toggle('is-selected', current);
  });
}
function updateClock() { const now = new Date(); currentTime.textContent = now.toLocaleTimeString('vi-VN'); currentDate.textContent = now.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }); if (Object.keys(records).length) setStatus(records); }
function formatTime(value) { return value ? new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '--:--'; }
function todayKey() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; }
function setStatus(record) { const today = record?.[todayKey()]; const now = new Date(); const currentMinutes = now.getHours() * 60 + now.getMinutes(); const checkoutMinutes = today?.attendanceType === 'half-day-morning' ? 12 * 60 : 17 * 60 + 25; const checkoutAvailable = currentMinutes >= checkoutMinutes; status.className = 'attendance-status'; if (attendanceTypeChoice) { attendanceTypeChoice.querySelectorAll('input').forEach((input) => { input.disabled = Boolean(today?.checkIn); if (today?.attendanceType) input.checked = input.value === today.attendanceType; }); } if (!today?.checkIn) { status.textContent = 'Chưa vào ca'; checkIn.disabled = isOnlineAttendance ? !onlineProof?.photoCapturedAt || onlineProof.latitude === undefined : false; checkOut.disabled = true; updateOnlineCheckIn(); return; } if (!today.checkOut) { status.classList.add('is-working'); status.textContent = today.late ? `Đi muộn, đang làm việc từ ${formatTime(today.checkIn)}` : `Đang làm việc từ ${formatTime(today.checkIn)}`; checkIn.disabled = true; checkOut.disabled = !checkoutAvailable; if (!checkoutAvailable) status.textContent += ` - Check-out mở lúc ${today.attendanceType === 'half-day-morning' ? '12:00' : '17:30'}`; return; } status.classList.add('is-completed'); status.textContent = `Đã hoàn thành lúc ${formatTime(today.checkOut)}`; checkIn.disabled = true; checkOut.disabled = true; }
function getStatusMeta(record, date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (date > today) return { className: 'future', short: '', label: 'Chưa đến ngày' };

  if (record?.status === 'leave') return { className: 'leave', short: 'N', label: 'Xin nghỉ phép' };
  if (record?.status === 'unauthorized-leave') return { className: 'unauthorized-leave', short: 'KP', label: 'Nghỉ không phép' };
  if (record?.workMode === 'online' || record?.onlineProof || record?.status === 'online') return { className: 'online', short: 'OL', label: 'Đã chấm công online' };

  if (record?.attendanceType === 'half-day-morning' || record?.attendanceType === 'half-day-afternoon') return { className: 'half-day', short: '1/2', label: 'Làm 1/2 ngày' };

  if (!record || !record.checkIn) {
    return { className: 'absent', short: 'K', label: 'Không chấm công' };
  }

  return { className: 'present', short: 'X', label: 'Đã chấm công' };
}
function renderRecords() {
  const entryList = Object.values(records).sort((a, b) => b.date.localeCompare(a.date));
  const workingDays = entryList.reduce((total, record) => total + (record.checkIn && record.checkOut && record.status === 'completed' ? (record.attendanceType === 'full-day' ? 1 : 0.5) : 0), 0);
  document.querySelector('[data-stat-days]').textContent = workingDays.toLocaleString('vi-VN', { maximumFractionDigits: 1 });
  document.querySelector('[data-stat-late]').textContent = entryList.filter((record) => record.late).length;
  const totalHours = entryList.reduce((sum, record) => sum + (record.checkIn && record.checkOut ? (new Date(record.checkOut) - new Date(record.checkIn)) / 3600000 : 0), 0);
  document.querySelector('[data-stat-hours]').textContent = `${totalHours.toFixed(1)}h`;

  const monthValue = monthSelect.value;
  if (!monthValue) {
    list.innerHTML = '<div class="attendance-empty-state">Đang tải dữ liệu...</div>';
    return;
  }

  const selectedDate = new Date(`${monthValue}-01T00:00:00`);
  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const monthWeeks = [];
  let week = [];
  for (let day = 1; day <= totalDays; day += 1) {
    const date = new Date(year, month, day);
    week.push(date);
    if (week.length === 7 || day === totalDays) {
      monthWeeks.push(week);
      week = [];
    }
  }

  const name = document.querySelectorAll('[data-user-name]')[0]?.textContent || 'Nhân viên';
  const statusCounter = { present: 0, absent: 0, leave: 0, online: 0, 'unauthorized-leave': 0, 'half-day': 0 };

  const rows = monthWeeks.map((weekDates, weekIndex) => {
    const headerCells = weekDates.map((date) => {
      const weekday = date.toLocaleDateString('vi-VN', { weekday: 'short' }).replace('.', '').toUpperCase();
      return `<div class="attendance-day-header"><span>${date.getDate()}</span><small>${weekday}</small></div>`;
    }).join('');

    const valueCells = weekDates.map((date) => {
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const record = records[key];
      const meta = getStatusMeta(record, date);
      if (meta.className === 'present') statusCounter.present += 1;
      else if (meta.className === 'absent') statusCounter.absent += 1;
      else if (meta.className === 'leave') statusCounter.leave += 1;
      else if (meta.className === 'online') statusCounter.online += 1;
      else if (meta.className === 'unauthorized-leave') statusCounter['unauthorized-leave'] += 1;
      else if (meta.className === 'half-day') statusCounter['half-day'] += 1;
      return `<div class="attendance-day-value attendance-${meta.className}" title="${meta.label}">${meta.className === 'future' ? '' : '<span class="attendance-dot"></span>'}</div>`;
    }).join('');

    return `
      <div class="attendance-week-block">
        <div class="attendance-week-title">Tuần ${weekIndex + 1}</div>
        <div class="attendance-day-grid-header">${headerCells}</div>
        <div class="attendance-day-grid-body">${valueCells}</div>
      </div>
    `;
  }).join('');

  const totalCount = statusCounter.present + statusCounter.leave + statusCounter.online + statusCounter['unauthorized-leave'] + statusCounter['half-day'];
  list.innerHTML = `
    <div class="attendance-weekly-shell">
      <div class="attendance-weekly-header">
        <div class="attendance-week-header-name">${name}</div>
        <div class="attendance-week-summary">
          <span class="legend-pill present"><span class="legend-dot"></span> ${statusCounter.present}</span>
          <span class="legend-pill leave"><span class="legend-dot"></span> ${statusCounter.leave}</span>
          <span class="legend-pill online"><span class="legend-dot"></span> ${statusCounter.online}</span>
          <span class="legend-pill unauthorized"><span class="legend-dot"></span> ${statusCounter['unauthorized-leave']}</span>
          <span class="legend-pill half-day"><span class="legend-dot"></span> ${statusCounter['half-day']}</span>
          <span class="legend-pill absent"><span class="legend-dot"></span> ${statusCounter.absent}</span>
        </div>
      </div>
      <div class="attendance-status-legend">
        <span><i class="attendance-legend-dot is-absent"></i> Không chấm công</span>
        <span><i class="attendance-legend-dot is-present"></i> Đã chấm công</span>
        <span><i class="attendance-legend-dot is-leave"></i> Xin nghỉ phép</span>
        <span><i class="attendance-legend-dot is-online"></i> Xin làm online</span>
        <span><i class="attendance-legend-dot is-half-day"></i> Làm 1/2 ngày</span>
        <span><i class="attendance-legend-dot is-unauthorized"></i> Nghỉ không phép</span>
      </div>
      ${rows}
      <div class="attendance-week-total">Tổng ngày: <strong>${totalCount}</strong></div>
    </div>
  `;
}
async function loadAttendance() { const response = await fetch(`/api/attendance?month=${monthSelect.value}`, { cache: 'no-store' }); if (!response.ok) throw new Error('Không thể tải dữ liệu chấm công.'); records = (await response.json()).records || {}; setStatus(records); renderRecords(); }
async function submitAttendance(action) { checkIn.disabled = true; checkOut.disabled = true; message.textContent = 'Đang cập nhật...'; try { const selectedType = document.querySelector('input[name="attendanceType"]:checked')?.value || 'full-day'; const response = await fetch('/api/attendance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, mode: isOnlineAttendance ? 'online' : 'office', attendanceType: selectedType, onlineProof }) }); const responseText = await response.text(); let data = {}; try { data = responseText ? JSON.parse(responseText) : {}; } catch { data.message = responseText; } if (!response.ok) throw new Error(data.message || 'Không thể cập nhật chấm công.'); message.textContent = action === 'check-in' ? 'Đã check-in thành công.' : 'Đã check-out thành công.'; await loadAttendance(); } catch (error) { message.textContent = error.message; setStatus(records); } }
const today = new Date(); for (let offset = 0; offset < 12; offset += 1) { const date = new Date(today.getFullYear(), today.getMonth() - offset, 1); const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; monthSelect.append(new Option(date.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' }), value)); }
monthSelect.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
monthSelect.addEventListener('change', loadAttendance); checkIn.addEventListener('click', () => submitAttendance('check-in')); checkOut.addEventListener('click', () => submitAttendance('check-out')); document.querySelector('[data-refresh-attendance]').addEventListener('click', loadAttendance); updateClock(); setInterval(updateClock, 1000);
fetch('/api/me', { cache: 'no-store' }).then((response) => response.json()).then(async ({ user }) => { if (!user) return; const admin = user.role === 'admin' || user.role === 'ceo'; setAdminVisibility(admin); document.querySelectorAll('[data-user-name]').forEach((element) => { element.textContent = user.name || user.email; }); document.querySelectorAll('[data-user-role]').forEach((element) => { element.textContent = user.role === 'ceo' ? 'CEO' : admin ? 'Quản trị viên' : 'Nhân viên'; }); document.querySelectorAll('.role-chip').forEach((button) => { const roleText = user.role === 'ceo' ? 'CEO' : user.role === 'admin' ? 'Quản trị' : 'Nhân viên'; if (button.textContent.trim() === 'Quản trị' || button.textContent.trim() === 'Nhân viên') button.textContent = roleText; if (button.textContent.trim() === roleText) { button.hidden = false; button.classList.add('is-selected'); } else { button.hidden = true; button.classList.remove('is-selected'); } }); if (user.picture) { document.querySelectorAll('[data-user-avatar]').forEach((element) => { const image = document.createElement('img'); image.src = user.picture; image.alt = `Ảnh đại diện của ${user.name || user.email}`; element.replaceChildren(image); }); } await loadAttendance(); }).catch((error) => { message.textContent = error.message; });
