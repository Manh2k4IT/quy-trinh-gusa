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
const lateProof = form.querySelector('[data-late-proof]');
const latePhotoInput = form.querySelector('[name="latePhoto"]');
const locationButton = form.querySelector('[data-proposal-location]');
const locationStatus = form.querySelector('[data-proposal-location-status]');
let latePhotoData = '';
let lateLocation = null;
let proposals = [];

function formatProposalDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return value || '';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
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
  const isMultiple = form.querySelector('input[name="duration"]:checked')?.value === 'multiple';
  durationChoice.hidden = !isLeave;
  dateRange.hidden = !isLeave || !isMultiple;
  singleDateField.hidden = isLeave && isMultiple;
  dateInput.required = !isLeave || !isMultiple;
  dateFromInput.required = isLeave && isMultiple;
  dateToInput.required = isLeave && isMultiple;
  timeField.hidden = isLeave;
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

function renderProposals(proposals) {
  if (!proposals.length) return;
  proposals.forEach((proposal) => {
    const button = document.querySelector(`[data-open-proposal="${proposal.type}"]`);
    if (button) {
      if (isProposalExpired(proposal)) {
        button.textContent = 'ĐỀ XUẤT';
        button.disabled = false;
        button.classList.remove('is-approved');
        delete button.dataset.proposalId;
      } else if (proposal.status === 'approved') {
        button.textContent = 'ĐÃ DUYỆT';
        button.disabled = true;
        button.classList.add('is-approved');
        button.classList.remove('is-rejected');
        button.dataset.proposalId = proposal.id;
      } else if (proposal.status === 'rejected') {
        button.textContent = 'TỪ CHỐI';
        button.disabled = true;
        button.classList.add('is-rejected');
        button.classList.remove('is-approved');
        button.dataset.proposalId = proposal.id;
      } else {
        button.textContent = 'XEM ĐỀ XUẤT';
        button.disabled = false;
        button.classList.remove('is-approved');
        button.classList.remove('is-rejected');
        button.dataset.proposalId = proposal.id;
      }
    }
  });
}

async function loadProposals() {
  const response = await fetch('/api/proposals', { cache: 'no-store' });
  if (!response.ok) throw new Error('Không thể tải đề xuất.');
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
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Không thể gửi đề xuất.');
    form.reset();
    status.textContent = 'Đã gửi đề xuất, đang chờ duyệt.';
    await loadProposals();
  } catch (error) {
    status.textContent = error.message;
  }
});

document.querySelectorAll('[data-open-proposal]').forEach((button) => {
  button.addEventListener('click', () => {
    const type = button.dataset.openProposal;
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
      const statusText = proposal.status === 'approved' ? 'Đề xuất của bạn đã được duyệt' : proposal.status === 'rejected' ? 'Từ chối' : 'Đề xuất đã được gửi đi';
      const statusClass = proposal.status === 'approved' ? 'is-approved' : proposal.status === 'rejected' ? 'is-rejected' : '';
      detail.innerHTML = `<strong class="proposal-detail-status ${statusClass}">${statusText}</strong><span>Ngày áp dụng: ${dateText}</span>${proposal.time ? `<span>Thời gian: ${proposal.time}</span>` : ''}<span>Lý do: ${proposal.reason}</span>`;
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
  }, () => {
    locationButton.disabled = false;
    locationStatus.textContent = 'Không lấy được vị trí. Hãy cấp quyền và thử lại.';
  });
});

document.querySelector('[data-close-proposal]')?.addEventListener('click', closeModal);
modal?.addEventListener('click', (event) => {
  if (event.target === modal) closeModal();
});
document.querySelector('[data-proposal-refresh]')?.addEventListener('click', () => loadProposals().catch((error) => { status.textContent = error.message; }));

loadProposals().catch((error) => { if (list) list.innerHTML = `<span class="proposal-status">${error.message}</span>`; });
