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
const attendanceSite = !isOnlineAttendance && new URLSearchParams(window.location.search).get('site') === 'ben-thanh' ? 'ben-thanh' : 'q4';
const { getAttendanceShift, formatShiftTime } = window.GusaAttendanceSchedule;
let onlineProof = null;
// True while a check-in/out request runs, so the once-a-second status refresh cannot re-enable the buttons.
let attendanceBusy = false;
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
const workdayOverviewMenuItem = document.createElement('a');
workdayOverviewMenuItem.className = 'menu-item';
workdayOverviewMenuItem.href = 'attendance.html?view=days';
workdayOverviewMenuItem.innerHTML = '<span class="menu-icon">▦</span><span>Tổng ngày công</span>';
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
  attendanceMenuItem.href = 'attendance-choice.html';
  attendanceMenuItem.querySelector('span:last-child').textContent = 'Chấm công';
  attendanceGroup.append(attendanceMenuItem, workdayOverviewMenuItem, onlineStaffMenuItem, lateReportMenuItem, attendanceOverviewMenuItem);
  if (isWorkdayOverview) {
    attendanceMenuItem.classList.remove('is-active');
    attendanceMenuItem.removeAttribute('aria-current');
    workdayOverviewMenuItem.classList.add('is-active');
    workdayOverviewMenuItem.setAttribute('aria-current', 'page');
  }
  if (isOnlineAttendance) {
    attendanceMenuItem.classList.add('is-active');
    attendanceMenuItem.setAttribute('aria-current', 'page');
  }
  const settingsLabel = [...document.querySelectorAll('.menu-label')].find((label) => label.textContent.trim() === 'CÀI ĐẶT');
  settingsLabel?.before(attendanceGroupLabel, attendanceGroup);
}

if (isWorkdayOverview) {
  document.querySelector('.attendance-summary')?.setAttribute('hidden', '');
  document.querySelector('.attendance-heading h1')?.replaceChildren(document.createTextNode('Tổng ngày công'));
  document.querySelector('.attendance-heading p')?.replaceChildren(document.createTextNode('Theo dõi bảng công theo từng tuần trong tháng.'));
  document.querySelector('.breadcrumbs strong')?.replaceChildren(document.createTextNode('Tổng ngày công'));
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
    const geolocation = window.desktopSettings?.getCurrentPosition ? window.desktopSettings : navigator.geolocation;
    if (!geolocation) { locationStatus.textContent = 'Thiết bị không hỗ trợ chia sẻ vị trí.'; return; }
    locationButton.disabled = true;
    locationStatus.textContent = 'Đang lấy vị trí hiện tại...';
    geolocation.getCurrentPosition((position) => {
      onlineProof = { ...(onlineProof || {}), latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy };
      locationStatus.textContent = `Đã chia sẻ vị trí (sai số khoảng ${Math.round(position.coords.accuracy)}m)`;
      locationButton.textContent = 'Đã chia sẻ vị trí';
      refreshOnlineCheckIn();
    }, (error) => {
      console.error('Không lấy được vị trí chấm công:', error.code, error.message);
      locationButton.disabled = false;
      locationStatus.textContent = window.desktopSettings?.isDesktop && error.code !== 1
        ? 'Windows chưa xác định được vị trí. Hãy bật Wi-Fi và Dịch vụ vị trí, rồi thử lại.'
        : 'Không lấy được vị trí. Hãy cho phép truy cập vị trí và thử lại.';
    });
  });
  checkIn.hidden = true;
  if (attendanceTypeChoice) attendanceTypeChoice.hidden = true;
}

if (attendanceSite === 'q4' && !isOnlineAttendance && !isWorkdayOverview) {
  document.querySelector('.attendance-heading h1')?.replaceChildren(document.createTextNode('Chấm công tại Quận 4'));
  document.querySelector('.attendance-heading p')?.replaceChildren(document.createTextNode('Giờ làm 08:30–17:30. Bật vị trí (GPS) khi check-in và check-out tại công ty.'));
  document.querySelector('.breadcrumbs strong')?.replaceChildren(document.createTextNode('Chấm công Quận 4'));
}
if (attendanceSite === 'ben-thanh') {
  document.querySelector('.attendance-heading h1')?.replaceChildren(document.createTextNode('Chấm công tại Bến Thành'));
  document.querySelector('.attendance-heading p')?.replaceChildren(document.createTextNode('Giờ làm 09:00–17:00. Bật vị trí (GPS) khi check-in và check-out tại cửa hàng Bến Thành.'));
  document.querySelector('.breadcrumbs strong')?.replaceChildren(document.createTextNode('Chấm công Bến Thành'));
}

// Office check-in and check-out are verified by the device position instead of office Wi-Fi.
function getAttendanceLocation() {
  const geolocation = window.desktopSettings?.getCurrentPosition ? window.desktopSettings : navigator.geolocation;
  if (!geolocation) return Promise.reject(new Error('Thiết bị không hỗ trợ chia sẻ vị trí.'));
  return new Promise((resolve, reject) => geolocation.getCurrentPosition(
    (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy }),
    (error) => reject(new Error(window.desktopSettings?.isDesktop && error.code !== 1
      ? 'Windows chưa xác định được vị trí. Hãy bật Wi-Fi và Dịch vụ vị trí, rồi thử lại.'
      : 'Không lấy được vị trí. Hãy bật vị trí (GPS), cho phép truy cập rồi thử lại.')),
    { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
  ));
}

function setMobileMenu(open) {
  appShell.classList.toggle('is-mobile-menu-open', open);
  mobileMenuBackdrop.hidden = !open;
  mobileMenuToggle.setAttribute('aria-expanded', String(open));
}
mobileMenuToggle.addEventListener('click', () => setMobileMenu(!appShell.classList.contains('is-mobile-menu-open')));
mobileMenuBackdrop.addEventListener('click', () => setMobileMenu(false));
if (localStorage.getItem('gusa-sidebar-collapsed') === 'true') appShell.classList.add('is-collapsed');

document.body.dataset.theme = localStorage.getItem('gusa-theme') || 'light';
const palette = JSON.parse(localStorage.getItem('gusa-palette') || 'null');
document.documentElement.style.setProperty('--navy', palette?.primary || '#174b8e');
document.documentElement.style.setProperty('--blue-100', palette?.surface || '#eaf2fa');

function setAdminVisibility(isAdmin, role = 'employee') {
  if (adminMenu) adminMenu.hidden = !isAdmin;
  if (adminMenuLabel) adminMenuLabel.hidden = !isAdmin;
  attendanceOverviewMenuItem.hidden = !isAdmin;
  onlineStaffMenuItem.hidden = !isAdmin;
  lateReportMenuItem.hidden = !isAdmin;
  document.querySelectorAll('.role-chip').forEach((button) => {
    const originalRole = button.dataset.role || button.textContent.trim();
    button.dataset.role = originalRole;
    const roleLabel = role === 'ceo' ? 'CEO' : role === 'admin' ? 'Quản trị' : role === 'accountant' ? 'Kế toán' : role === 'warehouse' ? 'Vận hành kho' : role === 'manager' ? 'Quản lý cấp 1' : role === 'production' ? 'Sản xuất' : role === 'hr' ? 'Nhân sự' : 'Nhân viên';
    const expectedRole = role === 'ceo' ? 'CEO' : role === 'admin' ? 'Quản trị' : 'Nhân viên';
    const current = originalRole === expectedRole;
    button.textContent = current ? roleLabel : originalRole;
    button.hidden = !current;
    button.classList.toggle('is-selected', current);
  });
}
function updateClock() { const now = new Date(); currentTime.textContent = now.toLocaleTimeString('vi-VN'); currentDate.textContent = now.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }); setStatus(records); }
function formatTime(value) { return value ? new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '--:--'; }
function todayKey() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; }
function setStatus(record) {
  const today = record?.[todayKey()];
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const selectedType = today?.attendanceType || attendanceTypeChoice?.querySelector('input:checked')?.value || 'full-day';
  const shift = getAttendanceShift(today?.checkIn ? today.site : attendanceSite, selectedType);
  const checkInStartsAt = shift.checkInFrom;
  const checkInEndsAt = shift.checkInTo;
  const checkoutAvailable = currentMinutes >= shift.checkOutFrom;
  status.className = 'attendance-status';

  if (attendanceTypeChoice) {
    attendanceTypeChoice.querySelectorAll('input').forEach((input) => {
      input.disabled = Boolean(today?.checkIn);
      if (today?.attendanceType) input.checked = input.value === today.attendanceType;
    });
  }

  // Only the next useful action is shown: Check-in before the shift, Check-out during it, nothing after.
  checkIn.hidden = Boolean(today?.checkIn);
  checkOut.hidden = Boolean(today?.checkOut);

  if (!today?.checkIn) {
    status.textContent = 'Chưa vào ca';
    if (isOnlineAttendance) {
      checkIn.disabled = !onlineProof?.photoCapturedAt || onlineProof.latitude === undefined;
    } else {
      checkIn.disabled = currentMinutes < checkInStartsAt || currentMinutes > checkInEndsAt;
      if (currentMinutes < checkInStartsAt) status.textContent += ` · Mở check-in lúc ${formatShiftTime(checkInStartsAt)}`;
      else if (currentMinutes > checkInEndsAt) status.textContent += ` · Đã hết giờ check-in (${formatShiftTime(checkInStartsAt)}–${formatShiftTime(checkInEndsAt)})`;
    }
    checkOut.disabled = true;
    updateOnlineCheckIn();
    if (attendanceBusy) checkIn.disabled = true;
    return;
  }

  // Checked in at the other office today: its hours apply here too, so say so plainly.
  const checkedInSite = today.workMode === 'online' ? null : today.site || 'q4';
  const otherSite = !isOnlineAttendance && checkedInSite && checkedInSite !== attendanceSite ? window.GusaAttendanceSchedule.ATTENDANCE_SITES[checkedInSite].label : '';
  if (!today.checkOut) {
    status.classList.add('is-working');
    status.textContent = today.late ? `Đi muộn, đang làm việc từ ${formatTime(today.checkIn)}` : `Đang làm việc từ ${formatTime(today.checkIn)}`;
    if (otherSite) status.textContent = `Hôm nay bạn đã check-in tại ${otherSite} (${formatTime(today.checkIn)}) nên giờ làm tính theo ${otherSite}. ${today.late ? 'Đi muộn. ' : ''}`;
    checkIn.disabled = true;
    checkOut.disabled = attendanceBusy || !checkoutAvailable;
    if (!checkoutAvailable) status.textContent += `${otherSite ? '' : ' - '}Check-out mở lúc ${formatShiftTime(shift.checkOutFrom)}`;
    return;
  }

  status.classList.add('is-completed');
  status.textContent = `Đã hoàn thành lúc ${formatTime(today.checkOut)}`;
  checkIn.disabled = true;
  checkOut.disabled = true;
}
function applyUserAvatar(element, src, name) {
  const fallbackText = (name || 'U').trim().charAt(0).toUpperCase() || 'U';
  const image = document.createElement('img');
  image.src = src;
  image.alt = `Ảnh đại diện Gmail của ${name || 'người dùng'}`;
  image.referrerPolicy = 'no-referrer';
  image.crossOrigin = 'anonymous';
  image.loading = 'eager';
  image.decoding = 'async';
  image.onerror = () => {
    const fallback = document.createElement('span');
    fallback.className = 'avatar-fallback';
    fallback.textContent = fallbackText;
    element.replaceChildren(fallback);
  };
  element.replaceChildren(image);
}
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
// Late days of the selected month, shown under the workday table. The month follows the page's month picker.
let lateSummaryPlace = 'all';
const latePlaceOf = (record) => (record.workMode === 'online' || record.onlineProof ? 'online' : record.site === 'ben-thanh' ? 'ben-thanh' : 'q4');
const monthLabel = (value) => `Tháng ${Number(value.slice(5, 7))}/${value.slice(0, 4)}`;

function renderLateSummary(monthEntries) {
  const lateEntries = monthEntries
    .filter((record) => record.late)
    .filter((record) => lateSummaryPlace === 'all' || latePlaceOf(record) === lateSummaryPlace)
    .sort((a, b) => a.date.localeCompare(b.date));
  const monthOptions = [...monthSelect.options].map(({ value }) => `<option value="${value}" ${value === monthSelect.value ? 'selected' : ''}>${monthLabel(value)}</option>`).join('');
  const placeOptions = [['all', 'Tất cả khu vực'], ['q4', 'Quận 4'], ['ben-thanh', 'Bến Thành'], ['online', 'Làm online']]
    .map(([value, label]) => `<option value="${value}" ${lateSummaryPlace === value ? 'selected' : ''}>${label}</option>`).join('');
  const filtered = lateSummaryPlace !== 'all';
  const minutes = lateEntries.map((record) => Math.max(0, Number(record.lateMinutes) || 0));
  const totalMinutes = minutes.reduce((sum, value) => sum + value, 0);
  const worst = minutes.length ? Math.max(...minutes) : 0;
  const rows = lateEntries.map((record, index) => {
    const date = new Date(`${record.date}T00:00:00`);
    const weekday = date.toLocaleDateString('vi-VN', { weekday: 'long' });
    const place = record.workMode === 'online' || record.onlineProof ? 'Làm online' : `Khu vực ${record.site === 'ben-thanh' ? 'Bến Thành' : 'Quận 4'}`;
    const level = minutes[index] > 60 ? 'is-high' : minutes[index] > 15 ? 'is-medium' : 'is-low';
    return `<li><div><b>${weekday}, ${date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}</b><span>Check-in ${formatTime(record.checkIn)} · ${place}</span></div><strong class="${level}">${minutes[index]} phút</strong></li>`;
  }).join('');
  return `
    <section class="attendance-late-summary">
      <div class="attendance-late-summary-head">
        <h3>Đi trễ ${monthLabel(monthSelect.value).toLowerCase()}</h3>
        <div class="attendance-late-summary-filters">
          <label><span>Tháng</span><select data-late-filter="month">${monthOptions}</select></label>
          <label><span>Khu vực</span><select data-late-filter="place">${placeOptions}</select></label>
        </div>
      </div>
      <div class="attendance-late-summary-stats">
        <div><span>Số lần đi trễ</span><b>${lateEntries.length}</b><small>ngày</small></div>
        <div><span>Tổng phút trễ</span><b>${totalMinutes}</b><small>phút</small></div>
        <div><span>Trễ nhiều nhất</span><b>${worst}</b><small>phút</small></div>
      </div>
      ${rows ? `<ul class="attendance-late-summary-list">${rows}</ul>` : `<p class="attendance-late-summary-empty">${filtered ? 'Không có lần đi trễ nào ở khu vực này trong tháng.' : 'Tháng này chưa đi trễ lần nào. Giữ vững nhé!'}</p>`}
    </section>
  `;
}

function renderRecords() {
  // The API returns every month, so the cards only count the month being viewed.
  const entryList = Object.values(records).filter((record) => !monthSelect.value || record.date?.startsWith(monthSelect.value)).sort((a, b) => b.date.localeCompare(a.date));
  const workingDays = entryList.reduce((total, record) => {
    if (record.halfDayApproved) return total + (record.attendanceType === 'full-day' ? 1 : 0.5);
    return total + (record.checkIn && record.checkOut && record.status === 'completed' ? (record.attendanceType === 'full-day' ? 1 : 0.5) : 0);
  }, 0);
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

  const totalCount = statusCounter.present + statusCounter.leave + statusCounter.online + statusCounter['unauthorized-leave'] + statusCounter['half-day'] * 0.5;
  list.innerHTML = `
    <div class="attendance-weekly-shell">
      <div class="attendance-weekly-header">
        <div class="attendance-week-person"><div class="attendance-week-header-name">${name}</div><div class="attendance-week-total"><span>Tổng ngày công</span><strong>${totalCount.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}</strong></div></div>
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
      ${renderLateSummary(entryList)}
    </div>
  `;
}
async function loadAttendance() { const response = await fetch(`/api/attendance?month=${monthSelect.value}`, { cache: 'no-store' }); if (!response.ok) throw new Error('Không thể tải dữ liệu chấm công.'); records = (await response.json()).records || {}; setStatus(records); renderRecords(); }
// Confirms the result in a popup so people know the tap worked and stop tapping again.
function showAttendanceDialog({ success, title, lines, action }) {
  document.querySelector('.attendance-dialog-backdrop')?.remove();
  const backdrop = document.createElement('div');
  backdrop.className = 'attendance-dialog-backdrop';
  const dialog = document.createElement('div');
  dialog.className = `attendance-dialog ${success ? 'is-success' : 'is-error'}`;
  dialog.setAttribute('role', 'alertdialog');
  dialog.setAttribute('aria-modal', 'true');
  const icon = document.createElement('span');
  icon.className = 'attendance-dialog-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = success ? '✓' : '!';
  const heading = document.createElement('h2');
  heading.textContent = title;
  dialog.append(icon, heading, ...lines.filter(Boolean).map((line) => Object.assign(document.createElement('p'), { textContent: line })));
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = 'Đã hiểu';
  const dismiss = () => backdrop.remove();
  close.addEventListener('click', dismiss);
  backdrop.addEventListener('click', (event) => { if (event.target === backdrop) dismiss(); });
  if (action) {
    const link = document.createElement('a');
    link.className = 'attendance-dialog-action';
    link.href = action.href;
    link.textContent = action.label;
    dialog.append(link);
    close.classList.add('is-secondary');
  }
  dialog.append(close);
  backdrop.append(dialog);
  document.body.append(backdrop);
  close.focus();
}

function describeAttendanceResult(action, record) {
  const siteLabel = record.workMode === 'online' ? 'Làm online' : `Khu vực ${window.GusaAttendanceSchedule.ATTENDANCE_SITES[record.site || 'q4'].label}`;
  if (action === 'check-out') {
    return { success: true, title: 'Check-out thành công', lines: [`Lúc ${formatTime(record.checkOut)} · ${siteLabel}`, 'Bạn đã hoàn thành ca làm hôm nay.'] };
  }
  const shift = getAttendanceShift(record.site, record.attendanceType);
  return {
    success: true,
    title: 'Check-in thành công',
    lines: [
      `Lúc ${formatTime(record.checkIn)} · ${siteLabel}`,
      record.late ? `Đi muộn ${record.lateMinutes} phút.` : 'Đúng giờ.',
      `Nhớ quay lại check-out từ ${formatShiftTime(shift.checkOutFrom)}.`,
    ],
  };
}

async function submitAttendance(action) { if (attendanceBusy) return; attendanceBusy = true; checkIn.disabled = true; checkOut.disabled = true; message.textContent = 'Đang cập nhật...'; try { const selectedType = document.querySelector('input[name="attendanceType"]:checked')?.value || 'full-day'; const today = records?.[todayKey()]; const officeSite = action === 'check-in' ? (isOnlineAttendance ? null : attendanceSite) : (today?.workMode === 'online' ? null : today?.site || 'q4'); let location; if (officeSite) { message.textContent = 'Đang lấy vị trí...'; try { location = await getAttendanceLocation(); } catch (error) { if (officeSite !== 'q4') throw error; } message.textContent = 'Đang cập nhật...'; } const response = await fetch('/api/attendance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, mode: isOnlineAttendance ? 'online' : 'office', site: attendanceSite, attendanceType: selectedType, onlineProof, location }) }); const responseText = await response.text(); let data = {}; try { data = responseText ? JSON.parse(responseText) : {}; } catch { data.message = responseText; } if (!response.ok) throw Object.assign(new Error(data.message || 'Không thể cập nhật chấm công.'), { needsWorkReport: data.needsWorkReport === true }); message.textContent = action === 'check-in' ? 'Đã check-in thành công.' : 'Đã check-out thành công.'; if (data.record) showAttendanceDialog(describeAttendanceResult(action, data.record)); attendanceBusy = false; await loadAttendance(); } catch (error) { attendanceBusy = false; message.textContent = error.message; showAttendanceDialog(error.needsWorkReport
  ? { success: false, title: 'Chưa nộp báo cáo công việc', lines: [error.message], action: { label: 'Nộp báo cáo ngay', href: 'work-report.html' } }
  : { success: false, title: action === 'check-in' ? 'Chưa check-in được' : 'Chưa check-out được', lines: [error.message] }); setStatus(records); } }
const today = new Date(); for (let offset = 0; offset < 12; offset += 1) { const date = new Date(today.getFullYear(), today.getMonth() - offset, 1); const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; monthSelect.append(new Option(date.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' }), value)); }
monthSelect.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
list.addEventListener('change', (event) => {
  const select = event.target.closest('[data-late-filter]');
  if (!select) return;
  if (select.dataset.lateFilter === 'month') {
    monthSelect.value = select.value;
    loadAttendance();
    return;
  }
  lateSummaryPlace = select.value;
  renderRecords();
});
monthSelect.addEventListener('change', loadAttendance); attendanceTypeChoice?.addEventListener('change', () => setStatus(records)); checkIn.addEventListener('click', () => submitAttendance('check-in')); checkOut.addEventListener('click', () => submitAttendance('check-out')); document.querySelector('[data-refresh-attendance]').addEventListener('click', loadAttendance); updateClock(); setInterval(updateClock, 1000);
fetch('/api/me', { cache: 'no-store' }).then((response) => response.json()).then(async ({ user }) => { if (!user) return; const admin = user.role === 'admin' || user.role === 'ceo'; setAdminVisibility(admin, user.role); document.querySelectorAll('[data-user-name]').forEach((element) => { element.textContent = user.name || user.email; }); document.querySelectorAll('[data-user-role]').forEach((element) => { element.textContent = user.role === 'ceo' ? 'CEO' : admin ? 'Quản trị viên' : user.role === 'accountant' ? 'Kế toán' : user.role === 'warehouse' ? 'Vận hành kho' : user.role === 'manager' ? 'Quản lý cấp 1' : user.role === 'production' ? 'Sản xuất' : user.role === 'hr' ? 'Nhân sự' : 'Nhân viên'; }); document.querySelectorAll('.role-chip').forEach((button) => { const originalRole = button.dataset.role || button.textContent.trim(); button.dataset.role = originalRole; const current = user.role === 'ceo'
      ? originalRole === 'CEO'
      : user.role === 'admin'
        ? originalRole === 'Quản trị'
        : originalRole === 'Nhân viên';
    const roleLabel = user.role === 'ceo' ? 'CEO' : user.role === 'admin' ? 'Quản trị' : user.role === 'accountant' ? 'Kế toán' : user.role === 'warehouse' ? 'Vận hành kho' : user.role === 'manager' ? 'Quản lý cấp 1' : user.role === 'production' ? 'Sản xuất' : user.role === 'hr' ? 'Nhân sự' : 'Nhân viên';
    button.textContent = current ? roleLabel : originalRole;
    button.hidden = !current;
    button.classList.toggle('is-selected', current);
  }); if (user.picture) { document.querySelectorAll('[data-user-avatar]').forEach((element) => { const image = document.createElement('img'); image.src = user.picture; image.alt = `Ảnh đại diện của ${user.name || user.email}`; element.replaceChildren(image); }); } await loadAttendance(); }).catch((error) => { message.textContent = error.message; });
