const list = document.querySelector('[data-proposal-list]');
const search = document.querySelector('[data-proposal-search]');
const filter = document.querySelector('[data-proposal-status-filter]');
const refreshButton = document.querySelector('[data-proposal-refresh]');
const labels = { late: 'Đi trễ', 'early-leave': 'Về sớm', 'half-day': 'Làm 1/2 ngày', leave: 'Nghỉ phép', 'unauthorized-leave': 'Nghỉ không phép', payment: 'Thanh toán' };
let proposals = [];

function dateText(proposal) {
  const format = (value) => value ? value.split('-').reverse().join('/') : '';
  return proposal.dateFrom && proposal.dateTo ? `${format(proposal.dateFrom)} - ${format(proposal.dateTo)}` : format(proposal.date);
}

function render() {
  const query = search.value.trim().toLowerCase();
  const visible = proposals.filter((proposal) => (filter.value === 'all' || proposal.status === filter.value) && (!query || `${proposal.userName} ${proposal.reason} ${proposal.category || ''}`.toLowerCase().includes(query)));
  list.innerHTML = visible.length ? visible.map((proposal) => `<article class="report-item"><div class="report-item-main"><span class="report-type">${labels[proposal.type] || 'Đề xuất'}</span><h2>${proposal.userName}</h2><p><b>Thời gian:</b> ${dateText(proposal)}${proposal.time ? ` · ${proposal.time}` : ''}</p>${proposal.category ? `<p><b>Hạng mục:</b> ${proposal.category} · <b>Số tiền:</b> ${Number(proposal.amount).toLocaleString('vi-VN')} VNĐ</p>` : ''}<p><b>Lý do:</b> ${proposal.reason}</p>${proposal.paymentFileData ? `<a class="report-location" href="${proposal.paymentFileData}" download="${proposal.paymentFileName || 'bieu-mau-de-xuat'}">Tải file biểu mẫu: ${proposal.paymentFileName || 'Mở file'}</a>` : ''}${proposal.latePhotoData ? `<img class="report-proof" src="${proposal.latePhotoData}" alt="Ảnh xác nhận đi trễ">` : ''}${proposal.latitude ? `<a class="report-location" href="https://www.google.com/maps?q=${proposal.latitude},${proposal.longitude}" target="_blank" rel="noopener">Xem vị trí đã chia sẻ</a>` : ''}</div><div class="report-actions"><strong class="report-status is-${proposal.status}">${proposal.status === 'pending' ? 'Chờ duyệt' : proposal.status === 'approved' ? 'Đã duyệt' : 'Từ chối'}</strong>${proposal.status === 'pending' ? `<button type="button" data-approve="${proposal.id}">Duyệt</button><button type="button" data-reject="${proposal.id}">Từ chối</button>` : ''}</div></article>`).join('') : '<p>Chưa có đề xuất phù hợp.</p>';
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
refreshButton.addEventListener('click', () => load(true).catch((error) => { list.innerHTML = `<p>${error.message}</p>`; }));
load().catch((error) => { list.innerHTML = `<p>${error.message}</p>`; });
