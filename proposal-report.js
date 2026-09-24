const list = document.querySelector('[data-proposal-list]');
const search = document.querySelector('[data-proposal-search]');
const filter = document.querySelector('[data-proposal-status-filter]');
const refreshButton = document.querySelector('[data-proposal-refresh]');
const typeTabs = document.querySelectorAll('[data-proposal-type]');
const summaryTotal = document.querySelector('[data-report-total]');
const summaryPending = document.querySelector('[data-report-pending]');
const summaryApproved = document.querySelector('[data-report-approved]');
const summaryPayment = document.querySelector('[data-report-payment]');
const labels = { late: 'Đi trễ', 'early-leave': 'Về sớm', 'half-day': 'Làm 1/2 ngày', leave: 'Nghỉ phép', 'unauthorized-leave': 'Nghỉ không phép', payment: 'Thanh toán' };
let proposals = [];
let selectedType = 'all';

function dateText(proposal) {
  const format = (value) => value ? value.split('-').reverse().join('/') : '';
  return proposal.dateFrom && proposal.dateTo ? `${format(proposal.dateFrom)} - ${format(proposal.dateTo)}` : format(proposal.date);
}

function render() {
  const query = search.value.trim().toLowerCase();
  const visible = proposals.filter((proposal) => (selectedType === 'all' || (selectedType === 'payment' ? proposal.type === 'payment' : proposal.type !== 'payment')) && (filter.value === 'all' || proposal.status === filter.value) && (!query || `${proposal.userName} ${proposal.reason} ${proposal.category || ''}`.toLowerCase().includes(query)));
  list.innerHTML = visible.length ? visible.map((proposal) => `<article class="report-item ${proposal.type === 'payment' ? 'is-payment' : 'is-general'}"><div class="report-item-main"><span class="report-type">${proposal.type === 'payment' ? 'ĐỀ XUẤT THANH TOÁN' : 'ĐỀ XUẤT CHUNG'}</span><h2>${proposal.userName}</h2><p class="report-date"><b>Ngày áp dụng:</b> ${dateText(proposal)}${proposal.time ? ` · ${proposal.time}` : ''}</p>${proposal.category ? `<div class="payment-meta"><span><b>Hạng mục</b>${proposal.category}</span><span><b>Số tiền</b>${Number(proposal.amount).toLocaleString('vi-VN')} VNĐ</span></div>` : ''}<p><b>${proposal.category ? 'Ghi chú:' : 'Lý do:'}</b> ${proposal.reason}</p>${proposal.paymentFileData ? `<a class="report-file" href="${proposal.paymentFileData}" download="${proposal.paymentFileName || 'bieu-mau-de-xuat'}"><span>FILE ĐÍNH KÈM</span>${proposal.paymentFileName || 'Tải file biểu mẫu'}</a>` : ''}${proposal.latePhotoData ? `<img class="report-proof" src="${proposal.latePhotoData}" alt="Ảnh xác nhận đi trễ">` : ''}${proposal.latitude ? `<a class="report-location" href="https://www.google.com/maps?q=${proposal.latitude},${proposal.longitude}" target="_blank" rel="noopener">Xem vị trí đã chia sẻ</a>` : ''}</div><div class="report-actions"><strong class="report-status is-${proposal.status}">${proposal.status === 'pending' ? 'Chờ duyệt' : proposal.status === 'approved' ? 'Đã duyệt' : proposal.status === 'canceled' ? 'Đã hủy' : 'Từ chối'}</strong>${proposal.status === 'pending' ? `<div class="report-decision"><button type="button" data-approve="${proposal.id}">Duyệt</button><button type="button" data-reject="${proposal.id}">Từ chối</button></div>` : ''}</div></article>`).join('') : '<div class="report-empty"><strong>Không có đề xuất phù hợp</strong><span>Thử đổi nhóm hoặc bộ lọc trạng thái.</span></div>';
}

function renderSummary() {
  summaryTotal.textContent = proposals.length;
  summaryPending.textContent = proposals.filter((proposal) => proposal.status === 'pending').length;
  summaryApproved.textContent = proposals.filter((proposal) => proposal.status === 'approved').length;
  summaryPayment.textContent = proposals.filter((proposal) => proposal.type === 'payment').length;
}

async function load(showFeedback = false) {
  if (showFeedback) {
    refreshButton.disabled = true;
    refreshButton.textContent = 'Đang tải...';
  }
  try {
    const response = await fetch(`/api/proposals?scope=all&refresh=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('Không có quyền xem báo cáo đề xuất.');
    proposals = (await response.json()).proposals || [];
    renderSummary();
    render();
    if (showFeedback) refreshButton.textContent = 'Đã cập nhật';
  } catch (error) {
    if (showFeedback) refreshButton.textContent = 'Thử lại';
    throw error;
  } finally {
    if (showFeedback) {
      refreshButton.disabled = false;
      setTimeout(() => { refreshButton.textContent = 'Làm mới'; }, 1200);
    }
  }
}

async function update(id, status) {
  const response = await fetch('/api/proposals/status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) });
  if (!response.ok) return;
  await load();
}

list.addEventListener('click', (event) => {
  const approve = event.target.closest('[data-approve]');
  const reject = event.target.closest('[data-reject]');
  if (approve) update(approve.dataset.approve, 'approved');
  if (reject) update(reject.dataset.reject, 'rejected');
});
search.addEventListener('input', render);
filter.addEventListener('change', render);
typeTabs.forEach((tab) => tab.addEventListener('click', () => {
  selectedType = tab.dataset.proposalType;
  typeTabs.forEach((item) => { item.classList.toggle('is-active', item === tab); item.setAttribute('aria-selected', String(item === tab)); });
  render();
}));
refreshButton.addEventListener('click', () => load(true).catch((error) => { list.innerHTML = `<p>${error.message}</p>`; }));
load().catch((error) => { list.innerHTML = `<p>${error.message}</p>`; });
