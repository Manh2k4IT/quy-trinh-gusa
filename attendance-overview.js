fetch('/api/me', { cache: 'no-store' }).then((r) => r.json()).then(({ user }) => { const isAdmin = user?.role === 'admin' || user?.role === 'ceo';
const appShell = document.querySelector('.app-shell');
const mobileMenuToggle = document.querySelector('[data-mobile-menu-toggle]');
const mobileMenuBackdrop = document.querySelector('[data-mobile-menu-backdrop]');
const adminMenu = document.querySelector('[data-admin-menu]');
const adminMenuLabel = document.querySelector('[data-admin-menu-label]');
const list = document.querySelector('[data-attendance-overview]');
const legend = document.querySelector('.attendance-legend');
if (legend && !legend.querySelector('.is-unauthorized-leave')) legend.insertAdjacentHTML('beforeend', '<span><i class="legend-dot is-unauthorized-leave"></i>Nghỉ không phép</span>');
const monthSelect = document.querySelector('[data-attendance-month]');
const search = document.querySelector('[data-admin-search]');
const statusFilter = document.querySelector('[data-admin-status]');
let users = [];

function normalizeAttendanceMenu() {
	const attendanceLink = document.querySelector('a[href="attendance.html"]');
	const overviewLink = document.querySelector('a[href="attendance-overview.html"]');
	const settingsLabel = [...document.querySelectorAll('.menu-label')].find((label) => label.textContent.trim() === 'CÀI ĐẶT');
	if (!attendanceLink || !overviewLink || !settingsLabel) return;
	const label = document.createElement('p');
	label.className = 'menu-label';
	label.textContent = 'CHẤM CÔNG';
	const menu = document.createElement('nav');
	menu.className = 'menu';
	menu.setAttribute('aria-label', 'Menu chấm công');
	const group = attendanceLink.closest('.menu-parent');
	const onlineLink = document.createElement('a');
	onlineLink.className = 'menu-item';
	onlineLink.href = 'attendance.html?view=online';
	onlineLink.innerHTML = '<span class="menu-icon">⌁</span><span>Chấm công làm online</span>';
	const workdayOverviewLink = document.createElement('a');
	workdayOverviewLink.className = 'menu-item';
	workdayOverviewLink.href = 'attendance.html?view=days';
	workdayOverviewLink.innerHTML = '<span class="menu-icon">▦</span><span>Tổng quan ngày công</span>';
	const onlineStaffLink = document.createElement('a');
	onlineStaffLink.className = 'menu-item';
	onlineStaffLink.href = 'attendance-overview.html?report=online';
	onlineStaffLink.innerHTML = '<span class="menu-icon">♙</span><span>Báo cáo nhân sự làm online</span>';
	const lateReportLink = document.createElement('a');
	lateReportLink.className = 'menu-item';
	lateReportLink.href = 'attendance-overview.html?report=late';
	lateReportLink.innerHTML = '<span class="menu-icon">◷</span><span>Báo cáo đi trễ</span>';
	group?.remove();
	attendanceLink.classList.remove('is-active');
	attendanceLink.querySelector('span:last-child').textContent = 'Chấm công tại công ty';
	overviewLink.classList.add('is-active');
	overviewLink.setAttribute('aria-current', 'page');
	if (new URLSearchParams(window.location.search).get('report') === 'online') {
		overviewLink.classList.remove('is-active');
		overviewLink.removeAttribute('aria-current');
		onlineStaffLink.classList.add('is-active');
		onlineStaffLink.setAttribute('aria-current', 'page');
	}
	menu.append(attendanceLink, onlineLink, workdayOverviewLink, onlineStaffLink, lateReportLink, overviewLink);
	settingsLabel.before(label, menu);
}

normalizeAttendanceMenu();
document.querySelector('.attendance-admin-note')?.remove();
document.querySelector('.attendance-section-heading h2')?.replaceChildren(document.createTextNode('Chấm công theo tháng'));
const lateReport = document.createElement('div');
lateReport.className = 'attendance-late-report';
lateReport.hidden = true;
document.querySelector('.attendance-overview-table')?.before(lateReport);
statusFilter.innerHTML = '<option value="all">Tất cả trạng thái</option><option value="absent">Không chấm công</option><option value="present">Đã chấm công</option><option value="half-day">Làm 1/2 ngày</option><option value="leave">Xin nghỉ phép</option><option value="unauthorized-leave">Nghỉ không phép</option><option value="online">Xin làm online</option>';

const adminKpis = document.querySelector('.attendance-admin-kpis');
if (adminKpis) adminKpis.innerHTML = '<article class="is-warning"><span>Không chấm công</span><strong data-status-count="absent">0</strong></article><article class="is-success"><span>Đã chấm công</span><strong data-status-count="present">0</strong></article><article class="is-half-day"><span>Làm 1/2 ngày</span><strong data-status-count="half-day">0</strong></article><article class="is-leave"><span>Xin nghỉ phép</span><strong data-status-count="leave">0</strong></article><article class="is-unauthorized"><span>Nghỉ không phép</span><strong data-status-count="unauthorized-leave">0</strong></article><article class="is-online"><span>Xin làm online</span><strong data-status-count="online">0</strong></article>';
['total', 'checked-in', 'completed', 'not-checked'].forEach((name) => { const legacy = document.createElement('span'); legacy.hidden = true; legacy.dataset.admin = name; document.body.append(legacy); });
document.querySelector('[data-admin="total"]').setAttribute('data-admin-total', '');
document.querySelector('[data-admin="checked-in"]').setAttribute('data-admin-checked-in', '');
document.querySelector('[data-admin="completed"]').setAttribute('data-admin-completed', '');
document.querySelector('[data-admin="not-checked"]').setAttribute('data-admin-not-checked', '');

function updateStatusKpis() {
	const counts = { absent: 0, present: 0, 'half-day': 0, leave: 0, 'unauthorized-leave': 0, online: 0 };
	const selectedDate = new Date(`${monthSelect.value}-01T00:00:00`);
	const year = selectedDate.getFullYear();
	const month = selectedDate.getMonth();
	const today = new Date();
	users.forEach((user) => Array.from({ length: new Date(year, month + 1, 0).getDate() }, (_, index) => {
		const date = new Date(year, month, index + 1);
		if (date > today || date.getDay() === 0 || date.getDay() === 6) return;
		const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`;
		const record = user.records?.[key];
		if (record?.workMode === 'online') counts.online += 1;
		else if (record?.status === 'leave' || record?.status === 'online' || record?.status === 'unauthorized-leave') counts[record.status] += 1;
		else if (record?.attendanceType === 'half-day-morning' || record?.attendanceType === 'half-day-afternoon') counts['half-day'] += 1;
		else if (record?.checkIn) counts.present += 1;
		else counts.absent += 1;
	}));
	Object.entries(counts).forEach(([status, count]) => { const element = document.querySelector(`[data-status-count="${status}"]`); if (element) element.textContent = count; });
}

function getReportAvatar(user) {
	return user.picture ? `<img class="attendance-report-avatar" src="${user.picture}" referrerpolicy="no-referrer" alt="Ảnh đại diện Gmail của ${user.name}">` : `<span class="attendance-report-avatar attendance-report-avatar-fallback" aria-hidden="true">${(user.name || '?').charAt(0).toUpperCase()}</span>`;
}

function renderLateReport() {
	const lateEntries = users.flatMap((user) => Object.values(user.records || {}).filter((record) => record.date?.startsWith(monthSelect.value) && record.late).map((record) => ({ user, record })));
	lateReport.innerHTML = lateEntries.length ? `<strong>Báo cáo đi trễ tháng ${monthSelect.value}</strong><div class="attendance-late-report-list">${lateEntries.sort((a, b) => `${a.record.date}${a.record.checkIn}`.localeCompare(`${b.record.date}${b.record.checkIn}`)).map(({ user, record }) => { const workMode = record.workMode === 'online' || record.onlineProof ? 'Làm online' : 'Làm tại công ty'; return `<span class="attendance-report-entry">${getReportAvatar(user)}<span class="attendance-report-details"><b>${user.name}</b><small>${record.date} · ${formatTime(record.checkIn)}</small><em class="attendance-work-mode ${workMode === 'Làm online' ? 'is-online' : 'is-office'}">${workMode}</em></span></span>`; }).join('')}</div>` : '<strong>Không có nhân sự đi trễ trong tháng này.</strong>';
}

function renderOnlineReport() {
	const onlineEntries = users.flatMap((user) => Object.values(user.records || {}).filter((record) => record.date?.startsWith(monthSelect.value) && (record.workMode === 'online' || record.onlineProof)).map((record) => ({ user, record })));
	lateReport.innerHTML = onlineEntries.length ? `<strong>Báo cáo nhân sự làm online tháng ${monthSelect.value}</strong><div class="attendance-late-report-list">${onlineEntries.sort((a, b) => `${a.record.date}${a.record.checkIn}`.localeCompare(`${b.record.date}${b.record.checkIn}`)).map(({ user, record }) => { const proof = record.onlineProof; const mapLink = proof ? `https://www.google.com/maps?q=${proof.latitude},${proof.longitude}` : ''; return `<span class="attendance-report-entry">${getReportAvatar(user)}<span class="attendance-report-details"><b>${user.name}</b><small>${record.date} · Vào: ${formatTime(record.checkIn)} · Ra: ${formatTime(record.checkOut)}</small>${proof?.photoData ? `<img class="attendance-online-report-photo" src="${proof.photoData}" alt="Ảnh nơi làm việc của ${user.name}">` : '<small>Chưa có ảnh nơi làm việc</small>'}${mapLink ? `<a href="${mapLink}" target="_blank" rel="noopener"><span class="attendance-location-icon" aria-hidden="true">⌖</span>Xem vị trí đã chia sẻ</a>` : '<small>Chưa có dữ liệu vị trí</small>'}</span></span>`; }).join('')}</div>` : '<strong>Chưa có nhân sự làm online trong tháng này.</strong>';
}

const reportMode = new URLSearchParams(window.location.search).get('report');
if (reportMode === 'late' || reportMode === 'online') {
	lateReport.hidden = false;
	if (reportMode === 'online') {
		document.querySelector('.attendance-heading h1')?.replaceChildren(document.createTextNode('Báo cáo nhân sự làm online'));
		document.querySelector('.attendance-section-heading h2')?.replaceChildren(document.createTextNode('Báo cáo nhân sự làm online'));
		document.querySelector('.breadcrumbs strong')?.replaceChildren(document.createTextNode('Báo cáo nhân sự làm online'));
		document.querySelector('.attendance-admin-kpis')?.setAttribute('hidden', '');
		document.querySelector('.attendance-admin-toolbar')?.setAttribute('hidden', '');
	document.querySelector('.attendance-overview-table')?.setAttribute('hidden', '');
	} else {
		document.querySelector('.attendance-heading h1')?.replaceChildren(document.createTextNode('Báo cáo đi trễ'));
		document.querySelector('.attendance-section-heading h2')?.replaceChildren(document.createTextNode('Báo cáo đi trễ'));
		document.querySelector('.breadcrumbs strong')?.replaceChildren(document.createTextNode('Báo cáo đi trễ'));
		document.querySelector('.attendance-admin-kpis')?.setAttribute('hidden', '');
		document.querySelector('.attendance-admin-toolbar')?.setAttribute('hidden', '');
		document.querySelector('.attendance-overview-table')?.setAttribute('hidden', '');
	renderLateReport();
	}
}

function setMobileMenu(open) { appShell.classList.toggle('is-mobile-menu-open', open); mobileMenuBackdrop.hidden = !open; mobileMenuToggle.setAttribute('aria-expanded', String(open)); }
mobileMenuToggle.addEventListener('click', () => setMobileMenu(!appShell.classList.contains('is-mobile-menu-open')));
mobileMenuBackdrop.addEventListener('click', () => setMobileMenu(false));
document.querySelector('[data-sidebar-toggle]').addEventListener('click', () => { const collapsed = appShell.classList.toggle('is-collapsed'); localStorage.setItem('gusa-sidebar-collapsed', String(collapsed)); });
if (localStorage.getItem('gusa-sidebar-collapsed') === 'true') appShell.classList.add('is-collapsed');
document.body.dataset.theme = localStorage.getItem('gusa-theme') || 'light';
const palette = JSON.parse(localStorage.getItem('gusa-palette') || 'null'); document.documentElement.style.setProperty('--navy', palette?.primary || '#174b8e'); document.documentElement.style.setProperty('--blue-100', palette?.surface || '#eaf2fa');

function decorateAttendanceDots() {
	document.querySelectorAll('.attendance-day-present, .attendance-day-absent, .attendance-day-leave, .attendance-day-online').forEach((cell) => {
		if (cell.querySelector('.attendance-status-dot')) return;
		const labels = { 'attendance-day-present': 'Đã chấm công', 'attendance-day-absent': 'Không chấm công', 'attendance-day-leave': 'Xin nghỉ phép', 'attendance-day-online': 'Xin làm online' };
		const label = Object.entries(labels).find(([className]) => cell.classList.contains(className))?.[1] || '';
		cell.replaceChildren(Object.assign(document.createElement('span'), { className: 'attendance-status-dot', title: label, ariaLabel: label }));
	});
}

function applySpecialAttendanceStatuses() {
	const selectedDate = new Date(`${monthSelect.value}-01T00:00:00`);
	const year = selectedDate.getFullYear();
	const month = selectedDate.getMonth();
	const visibleUsers = users.filter((user) => !search.value.trim() || user.name.toLowerCase().includes(search.value.trim().toLowerCase()));
	[...document.querySelectorAll('[data-attendance-overview] tr')].filter((row) => row.querySelector('.attendance-day')).forEach((row, rowIndex) => {
		const user = visibleUsers[rowIndex];
		if (!user) return;
		for (const [date, record] of Object.entries(user.records || {})) {
			const dateObject = new Date(`${date}T00:00:00`);
			if (!date.startsWith(monthSelect.value) || (!['leave', 'online', 'unauthorized-leave'].includes(record.status) && record.workMode !== 'online' && !['half-day-morning', 'half-day-afternoon'].includes(record.attendanceType))) continue;
			const cell = row.children[2 + dateObject.getDate() - 1];
			if (!cell) continue;
			cell.className = `attendance-day attendance-day-${record.status}`;
			const statusClass = record.workMode === 'online' ? 'online' : (['half-day-morning', 'half-day-afternoon'].includes(record.attendanceType) ? 'half-day' : record.status);
			const label = { leave: 'Xin nghỉ phép', online: 'Xin làm online', 'unauthorized-leave': 'Nghỉ không phép', 'half-day': 'Làm 1/2 ngày' }[statusClass];
			cell.className = `attendance-day attendance-day-${statusClass}`;
			cell.innerHTML = `<span class="attendance-status-dot" title="${label}" aria-label="${label}"></span>`;
		}
	});
}

function addStatusCountColumns() {
	const table = document.querySelector('.attendance-overview-table table');
	const header = table?.querySelector('thead tr') || table?.querySelector('tr');
	if (!table || !header || header.querySelector('.attendance-count-header')) return;
	const labels = [
		['attendance-count-absent', 'Không công', 'absent'],
		['attendance-count-present', 'Đã công', 'present'],
		['attendance-count-half-day', '1/2 ngày', 'half-day'],
		['attendance-count-leave', 'Nghỉ phép', 'leave'],
		['attendance-count-unauthorized', 'Nghỉ KP', 'unauthorized'],
		['attendance-count-online', 'Online', 'online'],
	];
	const totalHeader = header.querySelector('.attendance-total');
	labels.forEach(([className, label]) => {
		const cell = document.createElement('th');
		cell.className = `attendance-count-header ${className}`;
		cell.textContent = label;
		header.insertBefore(cell, totalHeader);
	});
	table.querySelectorAll('tr').forEach((row) => {
		if (!row.querySelector('.attendance-day') || row.querySelector('.attendance-count-cell')) return;
		const dayCells = [...row.querySelectorAll('.attendance-day')];
		const counts = {
			absent: dayCells.filter((cell) => cell.classList.contains('attendance-day-absent')).length,
			present: dayCells.filter((cell) => cell.classList.contains('attendance-day-present')).length,
			'half-day': dayCells.filter((cell) => cell.classList.contains('attendance-day-half-day')).length,
			leave: dayCells.filter((cell) => cell.classList.contains('attendance-day-leave')).length,
			unauthorized: dayCells.filter((cell) => cell.classList.contains('attendance-day-unauthorized-leave')).length,
			online: dayCells.filter((cell) => cell.classList.contains('attendance-day-online')).length,
		};
		const totalCell = row.querySelector('.attendance-total');
		if (totalCell) totalCell.textContent = counts.present + counts['half-day'] + counts.leave + counts.online;
		labels.forEach(([className, key, countKey]) => {
			const cell = document.createElement('td');
			cell.className = `attendance-count-cell ${className}`;
			cell.textContent = counts[countKey];
			row.insertBefore(cell, totalCell);
		});
	});
}

let activeStatusPicker;
document.addEventListener('click', (event) => {
	if (activeStatusPicker && !activeStatusPicker.contains(event.target) && !event.target.closest('.attendance-status-editable')) {
		activeStatusPicker.remove();
		activeStatusPicker = null;
	}
});
document.addEventListener('keydown', (event) => {
	if (event.key === 'Escape' && activeStatusPicker) {
		activeStatusPicker.remove();
		activeStatusPicker = null;
	}
});

function openStatusPicker(cell, user, date, current) {
	activeStatusPicker?.remove();
	const picker = document.createElement('div');
	picker.className = 'attendance-status-picker';
	const options = [['absent', 'Không công'], ['present', 'Đã công'], ['half-day', 'Làm 1/2 ngày'], ['leave', 'Nghỉ phép'], ['unauthorized-leave', 'Nghỉ KP'], ['online', 'Online']];
	picker.innerHTML = options.map(([value, label]) => `<button type="button" data-status-value="${value}">${label}</button>`).join('');
	document.body.append(picker);
	const box = cell.getBoundingClientRect();
	picker.style.left = `${Math.min(box.left, window.innerWidth - picker.offsetWidth - 8)}px`;
	picker.style.top = `${Math.min(box.bottom + 4, window.innerHeight - picker.offsetHeight - 8)}px`;
	activeStatusPicker = picker;
	picker.querySelectorAll('button').forEach((button) => button.addEventListener('click', async () => {
		const response = await fetch('/api/attendance-overview/status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id, date, status: button.dataset.statusValue }) });
		if (!response.ok) return;
		user.records[date] = (await response.json()).record;
		picker.remove();
		activeStatusPicker = null;
		updateStatusKpis(); render(); decorateAttendanceDots(); applySpecialAttendanceStatuses(); addStatusCountColumns(); bindStatusEditing();
	}));
}

function bindStatusEditing() {
	const selectedDate = new Date(`${monthSelect.value}-01T00:00:00`);
	const year = selectedDate.getFullYear();
	const month = selectedDate.getMonth();
	const visibleUsers = users.filter((user) => !search.value.trim() || user.name.toLowerCase().includes(search.value.trim().toLowerCase()));
	[...document.querySelectorAll('[data-attendance-overview] tr')].filter((row) => row.querySelector('.attendance-day')).forEach((row, rowIndex) => {
		const user = visibleUsers[rowIndex];
		if (!user) return;
		row.querySelectorAll('.attendance-day').forEach((cell, dayIndex) => {
			const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayIndex + 1).padStart(2, '0')}`;
			const record = user.records?.[date];
			const current = record?.workMode === 'online' ? 'online' : ['half-day-morning', 'half-day-afternoon'].includes(record?.attendanceType) ? 'half-day' : record?.status === 'leave' || record?.status === 'online' || record?.status === 'unauthorized-leave' ? record.status : record?.checkIn ? 'present' : 'absent';
			cell.classList.add('attendance-status-editable');
			cell.setAttribute('title', 'Bấm để đổi trạng thái');
			cell.addEventListener('click', () => openStatusPicker(cell, user, date, current), { once: true });
		});
	});
}

function formatTime(value) { return value ? new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '--:--'; }
function todayKey() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; }
function render(usersToRender = users) { const selectedDate = new Date(`${monthSelect.value}-01T00:00:00`); const year = selectedDate.getFullYear(); const month = selectedDate.getMonth(); const days = new Date(year, month + 1, 0).getDate(); const dateKey = todayKey(); const filtered = usersToRender.filter((user) => { const query = search.value.trim().toLowerCase(); const record = user.records?.[dateKey]; const state = record?.checkOut ? 'completed' : record?.checkIn ? 'working' : 'not-checked'; return (!query || user.name.toLowerCase().includes(query)) && (statusFilter.value === 'all' || statusFilter.value === state); }); const states = users.map((user) => user.records?.[dateKey]?.checkOut ? 'completed' : user.records?.[dateKey]?.checkIn ? 'working' : 'not-checked'); document.querySelector('[data-admin-total]').textContent = users.length; document.querySelector('[data-admin-checked-in]').textContent = states.filter((s) => s !== 'not-checked').length; document.querySelector('[data-admin-completed]').textContent = states.filter((s) => s === 'completed').length; document.querySelector('[data-admin-not-checked]').textContent = states.filter((s) => s === 'not-checked').length; const headers = Array.from({ length: days }, (_, i) => { const date = new Date(year, month, i + 1); return `<th><span>${i + 1}</span><small>${date.toLocaleDateString('vi-VN', { weekday: 'short' }).replace('.', '')}</small></th>`; }).join(''); const rows = filtered.map((user, i) => { const cells = Array.from({ length: days }, (_, day) => { const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day + 1).padStart(2, '0')}`; const date = new Date(year, month, day + 1); const record = user.records?.[key]; const mark = record?.checkIn ? 'X' : date > new Date() ? '' : date.getDay() === 0 || date.getDay() === 6 ? 'CN' : 'K'; const type = record?.checkIn ? 'present' : mark === 'CN' ? 'weekend' : mark ? 'absent' : 'future'; return `<td class="attendance-day attendance-day-${type}">${mark}</td>`; }).join(''); const total = Object.values(user.records || {}).filter((record) => record.checkIn && record.date?.startsWith(monthSelect.value)).length; return `<tr><td class="attendance-index">${i + 1}</td><td class="attendance-person"><strong>${user.name}</strong></td>${cells}<td class="attendance-total">${total}</td></tr>`; }).join(''); list.innerHTML = `<thead><tr><th class="attendance-index">STT</th><th class="attendance-person">Nhân viên</th>${headers}<th class="attendance-total">Tổng ngày</th></tr></thead><tbody>${rows || '<tr><td colspan="100">Không tìm thấy nhân viên phù hợp.</td></tr>'}</tbody>`; }
async function load() { const response = await fetch(`/api/attendance-overview?month=${monthSelect.value}`, { cache: 'no-store' }); if (!response.ok) throw new Error('Bạn không có quyền xem tổng quan nhân sự.'); users = (await response.json()).users || []; updateStatusKpis(); render(); decorateAttendanceDots(); applySpecialAttendanceStatuses(); addStatusCountColumns(); bindStatusEditing(); if (!lateReport.hidden) { if (reportMode === 'online') renderOnlineReport(); else renderLateReport(); } }
const now = new Date(); for (let i = 0; i < 12; i += 1) { const date = new Date(now.getFullYear(), now.getMonth() - i, 1); monthSelect.append(new Option(date.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' }), `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`)); } monthSelect.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
function rerenderOverview() { const selected = statusFilter.value; const selectedDate = new Date(`${monthSelect.value}-01T00:00:00`); const year = selectedDate.getFullYear(); const month = selectedDate.getMonth(); const days = new Date(year, month + 1, 0).getDate(); const filteredUsers = selected === 'all' ? users : users.filter((user) => Array.from({ length: days }, (_, index) => { const date = new Date(year, month, index + 1); if (date > new Date() || date.getDay() === 0 || date.getDay() === 6) return false; const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`; const record = user.records?.[key]; const state = record?.status === 'leave' || record?.status === 'online' || record?.status === 'unauthorized-leave' ? record.status : ['half-day-morning', 'half-day-afternoon'].includes(record?.attendanceType) ? 'half-day' : record?.checkIn ? 'present' : 'absent'; return state === selected; }).some(Boolean)); statusFilter.value = 'all'; updateStatusKpis(); render(filteredUsers); statusFilter.value = selected; decorateAttendanceDots(); applySpecialAttendanceStatuses(); addStatusCountColumns(); bindStatusEditing(); }
monthSelect.addEventListener('change', async () => { await load(); if (!lateReport.hidden) { if (reportMode === 'online') renderOnlineReport(); else renderLateReport(); } }); search.addEventListener('input', rerenderOverview); statusFilter.addEventListener('change', rerenderOverview);
if (reportMode === 'online') setInterval(load, 5000);
fetch('/api/me', { cache: 'no-store' }).then((r) => r.json()).then(({ user }) => { const isAdmin = user?.role === 'admin'; document.querySelectorAll('a[href="attendance.html?view=days"]').forEach((link) => { link.hidden = isAdmin; }); document.querySelectorAll('a[href="attendance-overview.html?report=online"], a[href="attendance-overview.html?report=late"], a[href="attendance-overview.html"]').forEach((link) => { link.hidden = !isAdmin; }); if (!user || !isAdmin) throw new Error('Bạn không có quyền xem tổng quan nhân sự.'); document.querySelectorAll('[data-user-name]').forEach((e) => { e.textContent = user.name || user.email; }); document.querySelectorAll('[data-user-role]').forEach((e) => { e.textContent = 'Quản trị viên'; }); return load(); }).catch((error) => { list.innerHTML = `<tbody><tr><td>${error.message}</td></tr></tbody>`; });
