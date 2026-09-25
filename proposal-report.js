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
let notificationInitialized = false;
let notificationTimer;

const topbar = document.querySelector('.topbar');
const notificationButton = document.createElement('button');
notificationButton.className = 'top-icon notification-icon proposal-notification-trigger';
notificationButton.type = 'button';
notificationButton.setAttribute('aria-label', 'Thông báo đề xuất mới');
notificationButton.innerHTML = '<svg class="bell-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-3-3-9M10 21h4" /></svg><b data-proposal-notification-count hidden>0</b>';
topbar?.append(notificationButton);

const notificationPanel = document.createElement('div');
notificationPanel.className = 'notification-menu proposal-notification-menu';
notificationPanel.hidden = true;
notificationPanel.innerHTML = '<strong>Thông báo</strong><div class="notification-list" data-proposal-notification-list><p>Chưa có đề xuất mới.</p></div>';
document.querySelector('.workspace')?.append(notificationPanel);
const notificationCount = notificationButton.querySelector('[data-proposal-notification-count]');
const notificationList = notificationPanel.querySelector('[data-proposal-notification-list]');

function proposalNotificationText(proposal) {
  const type = proposal.type === 'payment' ? 'đề xuất thanh toán' : 'đề xuất chung';
  return `${proposal.userName || 'Nhân viên'} vừa gửi ${type}.`;
}

async function showProposalNotification(newProposals) {
  if (!newProposals.length) return;
  if (window.claimProposalNotification && !(await window.claimProposalNotification(newProposals[0].id))) return;
  notificationList.innerHTML = newProposals.slice(0, 5).map((proposal) => `<p><b>Đề xuất mới</b><span>${proposalNotificationText(proposal)}</span></p>`).join('');
  notificationCount.textContent = String(newProposals.length);
  notificationCount.hidden = false;
  notificationPanel.hidden = false;
  notificationButton.classList.remove('is-notifying');
  void notificationButton.offsetWidth;
  notificationButton.classList.add('is-notifying');
  window.speakProposalNotification?.(newProposals[0]);
  clearTimeout(notificationTimer);
  notificationTimer = setTimeout(() => {
    notificationPanel.hidden = true;
    notificationCount.hidden = true;
    notificationButton.classList.remove('is-notifying');
  }, 5000);

  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('Có đề xuất mới', { body: proposalNotificationText(newProposals[0]), tag: 'gusa-proposal' });
  }
}

notificationButton.addEventListener('click', () => {
  notificationPanel.hidden = !notificationPanel.hidden;
  if (!notificationPanel.hidden) {
    notificationCount.hidden = true;
    clearTimeout(notificationTimer);
  }
  if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
});

function dateText(proposal) {
  const format = (value) => value ? value.split('-').reverse().join('/') : '';
  return proposal.dateFrom && proposal.dateTo ? `${format(proposal.dateFrom)} - ${format(proposal.dateTo)}` : format(proposal.date);
}

function relativeTime(proposal) {
  const createdAt = new Date(proposal.createdAt || `${proposal.date}T00:00:00`);
  if (Number.isNaN(createdAt.getTime())) return 'Không rõ thời gian';
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfCreatedDay = new Date(createdAt);
  startOfCreatedDay.setHours(0, 0, 0, 0);
  const days = Math.max(0, Math.floor((startOfToday - startOfCreatedDay) / 86400000));
  if (days === 0) return 'Hôm nay';
  if (days === 1) return '1 ngày trước';
  return `${days} ngày trước`;
}

function render() {
  const query = search.value.trim().toLowerCase();
  const visible = proposals.filter((proposal) => (selectedType === 'all' || (selectedType === 'payment' ? proposal.type === 'payment' : proposal.type !== 'payment')) && (filter.value === 'all' || proposal.status === filter.value) && (!query || `${proposal.userName} ${proposal.reason} ${proposal.category || ''}`.toLowerCase().includes(query))).sort((first, second) => new Date(second.createdAt || second.date) - new Date(first.createdAt || first.date));
  list.innerHTML = visible.length ? visible.map((proposal) => `<article class="report-item ${proposal.type === 'payment' ? 'is-payment' : 'is-general'}"><div class="report-item-main"><span class="report-type">${proposal.type === 'payment' ? 'ĐỀ XUẤT THANH TOÁN' : 'ĐỀ XUẤT CHUNG'}</span><h2>${proposal.userName}</h2><p class="report-date"><span class="report-relative-time">${relativeTime(proposal)}</span> · <b>${proposal.type === 'payment' ? 'Ngày đề xuất' : 'Ngày áp dụng'}:</b> ${dateText(proposal)}${proposal.time ? ` · ${proposal.time}` : ''}</p>${proposal.category ? `<div class="payment-meta"><span><b>Hạng mục</b>${proposal.category}</span><span><b>Số tiền</b>${Number(proposal.amount).toLocaleString('vi-VN')} VNĐ</span></div>` : ''}<p><b>${proposal.category ? 'Ghi chú:' : 'Lý do:'}</b> ${proposal.reason}</p>${proposal.paymentFileData ? `<a class="report-file" href="${proposal.paymentFileData}" download="${proposal.paymentFileName || 'bieu-mau-de-xuat'}"><span>FILE ĐÍNH KÈM</span>${proposal.paymentFileName || 'Tải file biểu mẫu'}</a>` : ''}${proposal.latePhotoData ? `<img class="report-proof" src="${proposal.latePhotoData}" alt="Ảnh xác nhận đi trễ">` : ''}${proposal.latitude ? `<a class="report-location" href="https://www.google.com/maps?q=${proposal.latitude},${proposal.longitude}" target="_blank" rel="noopener">Xem vị trí đã chia sẻ</a>` : ''}</div><div class="report-actions"><strong class="report-status is-${proposal.status}">${proposal.status === 'pending' ? 'Chờ duyệt' : proposal.status === 'approved' ? 'Đã duyệt' : proposal.status === 'canceled' ? 'Đã hủy bởi nhân viên' : 'Từ chối'}</strong>${proposal.status === 'pending' ? `<div class="report-decision"><button type="button" data-approve="${proposal.id}">Duyệt</button><button type="button" data-reject="${proposal.id}">Từ chối</button></div>` : ''}</div></article>`).join('') : '<div class="report-empty"><strong>Không có đề xuất phù hợp</strong><span>Thử đổi nhóm hoặc bộ lọc trạng thái.</span></div>';
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
    const nextProposals = (await response.json()).proposals || [];
    const knownIds = new Set(proposals.map((proposal) => proposal.id));
    const newProposals = notificationInitialized ? nextProposals.filter((proposal) => !knownIds.has(proposal.id)) : [];
    proposals = nextProposals;
    notificationInitialized = true;
    renderSummary();
    render();
    await showProposalNotification(newProposals);
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
setInterval(() => load().catch(() => {}), 3000);
