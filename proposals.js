const form = document.querySelector('[data-proposal-form]');
const list = document.querySelector('[data-proposal-list]');
const status = document.querySelector('[data-proposal-status]');
const modal = document.querySelector('[data-proposal-modal]');
const modalTitle = document.querySelector('[data-proposal-modal-title]');
const detail = document.querySelector('[data-proposal-detail]');
const typeInput = form.querySelector('[name="type"]');
const durationChoice = form.querySelector('[data-proposal-duration]');
const singleDateField = form.querySelector('[data-single-date-field]');
const dateRange = form.querySelector('[data-date-range]');
const dateInput = form.querySelector('[name="date"]');
const dateFromInput = form.querySelector('[name="dateFrom"]');
const dateToInput = form.querySelector('[name="dateTo"]');
const timeField = form.querySelector('[data-proposal-time]');
const timeInput = form.querySelector('[name="time"]');
const halfDayPeriodField = document.createElement('fieldset');
halfDayPeriodField.className = 'proposal-half-day-period';
halfDayPeriodField.dataset.halfDayPeriod = '';
halfDayPeriodField.innerHTML = '<legend>Buổi làm việc</legend><label><input type="radio" name="halfDayPeriod" value="half-day-morning" /> Buổi sáng</label><label><input type="radio" name="halfDayPeriod" value="half-day-afternoon" /> Buổi chiều</label>';
timeField.before(halfDayPeriodField);
const lateProof = form.querySelector('[data-late-proof]');
const latePhotoInput = form.querySelector('[name="latePhoto"]');
const locationButton = form.querySelector('[data-proposal-location]');
const locationStatus = form.querySelector('[data-proposal-location-status]');
const locationPermissionModal = document.querySelector('[data-location-permission-modal]');
const openLocationSettingsButton = document.querySelector('[data-open-location-settings]');
const closeLocationPermissionButton = document.querySelector('[data-close-location-permission]');
const proposalListPanel = document.querySelector('[data-proposal-list-panel]');
const proposalCards = document.querySelector('[data-proposal-cards]');
const proposalList = document.querySelector('[data-proposal-list]');
const proposalListCount = document.querySelector('[data-proposal-list-count]');
const showProposalListButton = document.querySelector('[data-show-proposal-list]');
const showProposalFormButton = document.querySelector('[data-show-proposal-form]');
let latePhotoData = '';
let lateLocation = null;
let proposals = [];

function formatProposalDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return value || '';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function isProposalExpired(proposal) {
  const endDate = proposal.dateTo || proposal.date;
  if (!endDate) return false;
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  if (endDate < today) return true;
  if (endDate > today || !proposal.time) return false;
  const [hours, minutes] = proposal.time.split(':').map(Number);
  return now.getHours() * 60 + now.getMinutes() > hours * 60 + minutes;
}

function updateDurationFields() {
  const isLeave = ['leave', 'unauthorized-leave'].includes(typeInput.value);
  const isHalfDay = typeInput.value === 'half-day';
  const isMultiple = form.querySelector('input[name="duration"]:checked')?.value === 'multiple';
  const dateLabels = { late: 'Ngày áp dụng đi trễ', 'early-leave': 'Ngày áp dụng về sớm', 'half-day': 'Ngày làm 1/2 ngày', leave: 'Ngày nghỉ', 'unauthorized-leave': 'Ngày nghỉ' };
  singleDateField.firstChild.textContent = dateLabels[typeInput.value] || 'Ngày áp dụng';
  durationChoice.hidden = !isLeave;
  dateRange.hidden = !isLeave || !isMultiple;
  singleDateField.hidden = isLeave && isMultiple;
  dateInput.required = !isLeave || !isMultiple;
  dateFromInput.required = isLeave && isMultiple;
  dateToInput.required = isLeave && isMultiple;
  timeField.hidden = isLeave || isHalfDay;
  timeInput.required = typeInput.value === 'late';
  halfDayPeriodField.hidden = !isHalfDay;
  halfDayPeriodField.querySelectorAll('input').forEach((input) => {
    input.disabled = !isHalfDay;
    input.required = isHalfDay;
  });
  lateProof.hidden = typeInput.value !== 'late';
  if (typeInput.value !== 'late') {
    latePhotoData = '';
    lateLocation = null;
    latePhotoInput.value = '';
    locationStatus.textContent = 'Chưa chia sẻ vị trí';
  }
}
const typeLabels = {
  late: 'Đề xuất đi trễ',
  'early-leave': 'Đề xuất về sớm',
  'half-day': 'Đề xuất làm 1/2 ngày',
  leave: 'Đề xuất nghỉ phép',
  'unauthorized-leave': 'Đề xuất nghỉ không phép',
};
const proposalStatusLabels = { pending: 'Đang chờ duyệt', approved: 'Đã duyệt', rejected: 'Từ chối', canceled: 'Đã hủy' };
const attendancePeriodLabels = { 'half-day-morning': 'Nửa buổi sáng', 'half-day-afternoon': 'Nửa buổi chiều' };

function renderProposals(proposals) {
  if (!proposals.length) return;
  proposals.forEach((proposal) => {
    const button = document.querySelector(`[data-open-proposal="${proposal.type}"]`);
    if (button) {
      const newProposalButton = button.closest('.proposal-card-actions')?.querySelector('.proposal-new-button');
      button.textContent = 'DANH SÁCH ĐỀ XUẤT';
      button.disabled = false;
      button.classList.remove('is-approved', 'is-rejected');
      button.dataset.proposalId = proposal.id;
      if (newProposalButton) newProposalButton.hidden = false;
      if (isProposalExpired(proposal)) {
        delete button.dataset.proposalId;
        if (newProposalButton) newProposalButton.hidden = false;
      }
    }
  });
}

async function loadProposals() {
  const response = await fetch('/api/proposals', { cache: 'no-store' });
  if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.' : 'Không thể tải đề xuất.');
  proposals = (await response.json()).proposals || [];
  renderProposals(proposals);
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  status.textContent = 'Đang gửi...';
  const payload = Object.fromEntries(new FormData(form));
  delete payload.latePhoto;
  if (payload.type === 'late') {
    if (!latePhotoData || !lateLocation) {
      status.textContent = 'Vui lòng tải ảnh và chia sẻ vị trí trước khi gửi.';
      return;
    }
    payload.latePhotoData = latePhotoData;
    payload.latitude = lateLocation.latitude;
    payload.longitude = lateLocation.longitude;
  }
  if (['leave', 'unauthorized-leave'].includes(payload.type) && payload.duration === 'multiple') {
    payload.date = payload.dateFrom;
  } else {
    delete payload.dateFrom;
    delete payload.dateTo;
  }
  delete payload.duration;
  try {
    const response = await fetch('/api/proposals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const responseText = await response.text();
    let data = {};
    try { data = responseText ? JSON.parse(responseText) : {}; } catch { data.message = responseText; }
    if (!response.ok) throw new Error(data.message || 'Không thể gửi đề xuất.');
    form.reset();
    closeModal();
    window.showProposalSuccessToast?.();
    loadProposals().catch(() => {});
  } catch (error) {
    status.textContent = error.message;
  }
});

document.querySelectorAll('[data-open-proposal]').forEach((button) => {
  button.addEventListener('click', () => {
    const type = button.dataset.openProposal;
    if (button.hasAttribute('data-proposal-list-trigger')) {
      const typedProposals = proposals.filter((proposal) => proposal.type === type);
      modalTitle.textContent = `Danh sách ${typeLabels[type] || 'đề xuất'}`;
      form.hidden = true;
      detail.hidden = false;
      detail.innerHTML = typedProposals.length
        ? typedProposals.map((proposal) => `<article class="proposal-detail-item"><strong class="proposal-detail-status is-${proposal.status}">${proposalStatusLabels[proposal.status] || proposal.status}</strong><span>Ngày áp dụng: ${formatProposalDate(proposal.date)}</span>${attendancePeriodLabels[proposal.attendanceType] ? `<span>Buổi làm việc: ${attendancePeriodLabels[proposal.attendanceType]}</span>` : ''}${proposal.time ? `<span>Thời gian: ${proposal.time}</span>` : ''}<span>Lý do: ${proposal.reason || 'Không có lý do'}</span>${proposal.rejectionReason ? `<span class="proposal-rejection-reason"><b>Lý do từ chối:</b> ${escapeHtml(proposal.rejectionReason)}</span>` : ''}</article>`).join('')
        : '<p>Chưa có đề xuất nào.</p>';
      modal.hidden = false;
      return;
    }
    const proposal = proposals.find((item) => item.id === button.dataset.proposalId && !isProposalExpired(item) && item.status !== 'approved');
    if (!proposal && button.dataset.proposalId) {
      delete button.dataset.proposalId;
      button.textContent = 'ĐỀ XUẤT';
    }
    typeInput.value = type;
    modalTitle.textContent = typeLabels[type] || 'Gửi đề xuất';
    modal.hidden = false;
    if (proposal) {
      form.hidden = true;
      detail.hidden = false;
      const dateText = proposal.dateFrom && proposal.dateTo ? `${formatProposalDate(proposal.dateFrom)} đến ${formatProposalDate(proposal.dateTo)}` : formatProposalDate(proposal.date);
      const statusText = proposal.status === 'approved' ? 'Đề xuất của bạn đã được duyệt' : proposal.status === 'rejected' ? 'Đề xuất của bạn đã bị từ chối' : 'Đề xuất đã được gửi đi';
      const statusClass = proposal.status === 'approved' ? 'is-approved' : proposal.status === 'rejected' ? 'is-rejected' : '';
      detail.innerHTML = `<strong class="proposal-detail-status ${statusClass}">${statusText}</strong><span>Ngày áp dụng: ${dateText}</span>${attendancePeriodLabels[proposal.attendanceType] ? `<span>Buổi làm việc: ${attendancePeriodLabels[proposal.attendanceType]}</span>` : ''}${proposal.time ? `<span>Thời gian: ${proposal.time}</span>` : ''}<span>Lý do: ${proposal.reason}</span>${proposal.rejectionReason ? `<span class="proposal-rejection-reason"><b>Lý do từ chối:</b> ${escapeHtml(proposal.rejectionReason)}</span>` : ''}`;
    } else {
      form.hidden = false;
      detail.hidden = true;
      updateDurationFields();
      form.querySelector('[name="date"]').focus();
    }
  });
});

function closeModal() {
  modal.hidden = true;
  locationPermissionModal.hidden = true;
  form.reset();
  form.hidden = false;
  detail.hidden = true;
  updateDurationFields();
  status.textContent = '';
  latePhotoData = '';
  lateLocation = null;
  latePhotoInput.value = '';
  locationButton.disabled = false;
  locationButton.textContent = 'Chia sẻ vị trí';
  locationStatus.textContent = 'Chưa chia sẻ vị trí';
}

typeInput.addEventListener('change', updateDurationFields);
form.querySelectorAll('input[name="duration"]').forEach((input) => input.addEventListener('change', updateDurationFields));

latePhotoInput.addEventListener('change', () => {
  const file = latePhotoInput.files?.[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    status.textContent = 'Ảnh không được vượt quá 5 MB.';
    latePhotoInput.value = '';
    return;
  }
  const reader = new FileReader();
  reader.addEventListener('load', () => { latePhotoData = String(reader.result); status.textContent = 'Đã tải ảnh xác nhận.'; });
  reader.readAsDataURL(file);
});

locationButton.addEventListener('click', () => {
  if (!navigator.geolocation) { locationStatus.textContent = 'Thiết bị không hỗ trợ vị trí.'; return; }
  locationButton.disabled = true;
  locationStatus.textContent = 'Đang lấy vị trí...';
  navigator.geolocation.getCurrentPosition((position) => {
    lateLocation = { latitude: position.coords.latitude, longitude: position.coords.longitude };
    locationStatus.textContent = 'Đã chia sẻ vị trí.';
    locationButton.textContent = 'Đã chia sẻ vị trí';
  }, (error) => {
    locationButton.disabled = false;
    if (error.code === error.PERMISSION_DENIED) {
      locationPermissionModal.hidden = false;
      openLocationSettingsButton.focus();
    }
    locationStatus.textContent = error.code === error.PERMISSION_DENIED
      ? 'Bạn chưa cấp quyền vị trí cho ứng dụng. Hãy bật quyền vị trí trong Cài đặt rồi thử lại.'
      : error.code === error.POSITION_UNAVAILABLE
        ? 'Không xác định được vị trí. Hãy bật GPS và thử lại.'
        : error.code === error.TIMEOUT
          ? 'Lấy vị trí quá lâu. Hãy thử lại ở nơi có tín hiệu GPS tốt hơn.'
          : 'Không lấy được vị trí. Hãy bật GPS và quyền vị trí rồi thử lại.';
  }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
});

openLocationSettingsButton.addEventListener('click', async () => {
  locationPermissionModal.hidden = true;
  locationStatus.textContent = 'Đang mở cài đặt quyền vị trí...';
  try {
    const opened = await window.openNativeLocationSettings?.();
    locationStatus.textContent = opened
      ? 'Đã mở Cài đặt. Bật quyền vị trí rồi quay lại ứng dụng.'
      : 'Không mở được Cài đặt tự động. Hãy bật quyền vị trí cho ứng dụng trong Cài đặt điện thoại.';
  } catch {
    locationStatus.textContent = 'Không mở được Cài đặt. Hãy bật quyền vị trí cho ứng dụng trong Cài đặt điện thoại.';
  }
});

closeLocationPermissionButton.addEventListener('click', () => { locationPermissionModal.hidden = true; });

document.querySelector('[data-close-proposal]')?.addEventListener('click', closeModal);
modal?.addEventListener('click', (event) => {
  if (event.target === modal) closeModal();
});
locationPermissionModal?.addEventListener('click', (event) => {
  if (event.target === locationPermissionModal) locationPermissionModal.hidden = true;
});
document.querySelector('[data-proposal-refresh]')?.addEventListener('click', () => loadProposals().catch((error) => { status.textContent = error.message; }));

loadProposals().catch((error) => { if (list) list.innerHTML = `<span class="proposal-status">${error.message}</span>`; });
setInterval(() => loadProposals().catch(() => {}), 5000);
