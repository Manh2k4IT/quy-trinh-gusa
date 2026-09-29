const list = document.querySelector('[data-proposal-list]');
const search = document.querySelector('[data-proposal-search]');
const filter = document.querySelector('[data-proposal-status-filter]');
const isPaymentReport = new URLSearchParams(window.location.search).get('type') === 'payment';
if (isPaymentReport) {
  document.title = 'Báo cáo đề xuất thanh toán - Quy Trình';
  document.querySelector('.breadcrumbs strong').textContent = 'Báo cáo đề xuất thanh toán';
  document.querySelector('.profile-page-heading h1').textContent = 'Báo cáo đề xuất thanh toán';
  document.querySelector('.profile-page-heading p').textContent = 'Theo dõi và xử lý đề xuất thanh toán của nhân viên.';
}
const dayFilter = document.createElement('select');
dayFilter.dataset.proposalDayFilter = '';
dayFilter.setAttribute('aria-label', 'Lọc theo ngày gửi đề xuất');
for (let daysAgo = 0; daysAgo <= 30; daysAgo += 1) {
  const option = document.createElement('option');
  option.value = String(daysAgo);
  option.textContent = daysAgo === 0 ? 'Hôm nay' : `${daysAgo} ngày trước`;
  dayFilter.append(option);
}
const allDaysOption = document.createElement('option');
allDaysOption.value = 'all';
allDaysOption.textContent = 'Tất cả ngày';
dayFilter.append(allDaysOption);
document.querySelector('.report-toolbar')?.insertBefore(dayFilter, filter);
dayFilter.value = '0';
const paymentFlowTabs = document.createElement('div');
paymentFlowTabs.className = 'payment-flow-tabs';
paymentFlowTabs.setAttribute('role', 'tablist');
paymentFlowTabs.setAttribute('aria-label', 'Nguồn đề xuất thanh toán');
paymentFlowTabs.innerHTML = '<button type="button" class="is-active" data-payment-flow-filter="ceo" role="tab" aria-selected="true">Đã duyệt từ CEO/Admin</button><button type="button" data-payment-flow-filter="accountant" role="tab" aria-selected="false">Đề xuất trực tiếp</button>';
paymentFlowTabs.hidden = true;
document.querySelector('.report-toolbar')?.prepend(paymentFlowTabs);
let selectedPaymentFlow = 'ceo';
const actionFeedback = document.createElement('p');
actionFeedback.className = 'report-action-feedback';
actionFeedback.setAttribute('role', 'status');
actionFeedback.setAttribute('aria-live', 'polite');
actionFeedback.hidden = true;
document.querySelector('.report-toolbar')?.after(actionFeedback);
const refreshButton = document.querySelector('[data-proposal-refresh]');
const summaryTotal = document.querySelector('[data-report-total]');
const summaryPending = document.querySelector('[data-report-pending]');
const summaryApproved = document.querySelector('[data-report-approved]');
const accountantRejectModal = document.querySelector('[data-accountant-reject-modal]');
const accountantRejectForm = document.querySelector('[data-accountant-reject-form]');
const accountantRejectReason = document.querySelector('[data-accountant-reject-reason]');
const accountantRejectError = document.querySelector('[data-accountant-reject-error]');
const labels = { late: 'Đề xuất đi trễ', 'early-leave': 'Đề xuất về sớm', 'half-day': 'Đề xuất làm 1/2 ngày', leave: 'Đề xuất nghỉ phép', 'unauthorized-leave': 'Đề xuất nghỉ không phép', payment: 'Đề xuất thanh toán' };
const statusLabels = { pending: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Từ chối', canceled: 'Đã hủy bởi nhân viên' };
const detailModal = document.querySelector('[data-report-detail-modal]');
const detailAvatar = document.querySelector('[data-detail-avatar]');
const detailType = document.querySelector('[data-detail-type]');
const detailName = document.querySelector('[data-detail-name]');
const detailEmail = document.querySelector('[data-detail-email]');
const detailFields = document.querySelector('[data-detail-fields]');
const detailAttachments = document.querySelector('[data-detail-attachments]');
const detailFile = document.querySelector('[data-detail-file]');
const detailFileName = document.querySelector('[data-detail-file-name]');
const detailPhoto = document.querySelector('[data-detail-photo]');
const detailLocation = document.querySelector('[data-detail-location]');
let proposals = [];
let canReview = false;
let viewerRole = 'employee';
let pendingAccountingRejectId = '';
let pendingAccountingRejectButton = null;
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
  const type = proposal.type === 'payment' ? 'đề xuất thanh toán' : 'đề xuất nhân sự';
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

  if (window.desktopSettings?.notify) {
    window.desktopSettings.notify({ title: 'Có đề xuất mới', body: proposalNotificationText(newProposals[0]) });
  } else if ('Notification' in window && Notification.permission === 'granted') {
    const notification = new Notification('Có đề xuất mới', { body: proposalNotificationText(newProposals[0]), tag: 'gusa-proposal' });
    notification.onclick = () => window.desktopSettings?.showApp?.();
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

function vietnamDateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const dateParts = Object.fromEntries(parts.map(({ type, value: partValue }) => [type, partValue]));
  return `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
}

function proposalDayOffset(proposal) {
  const proposalDate = proposal.createdAt ? vietnamDateKey(proposal.createdAt) : proposal.date;
  const today = vietnamDateKey(new Date());
  if (!proposalDate || !today) return null;
  return Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${proposalDate}T00:00:00Z`)) / 86400000);
}

function appendDetailField(label, value) {
  if (!value) return;
  const row = document.createElement('div');
  row.className = 'report-detail-field';
  const term = document.createElement('dt');
  term.textContent = label;
  const description = document.createElement('dd');
  description.textContent = value;
  row.append(term, description);
  detailFields.append(row);
}

function openProposalDetail(proposalId) {
  const proposal = proposals.find((item) => item.id === proposalId);
  if (!proposal) return;

  detailType.textContent = labels[proposal.type] || 'Đề xuất khác';
  detailName.textContent = proposal.userName || 'Nhân viên';
  detailEmail.textContent = proposal.userEmail || '';
  detailAvatar.replaceChildren();
  const initial = (proposal.userName || proposal.userEmail || 'N').trim().charAt(0).toUpperCase();
  if (proposal.userPicture) {
    const image = document.createElement('img');
    image.src = proposal.userPicture;
    image.referrerPolicy = 'no-referrer';
    image.alt = '';
    image.onerror = () => { detailAvatar.textContent = initial; };
    detailAvatar.append(image);
  } else {
    detailAvatar.textContent = initial;
  }

  detailFields.replaceChildren();
  appendDetailField('Trạng thái', statusLabels[proposal.status] || proposal.status);
  appendDetailField(proposal.type === 'payment' ? 'Ngày đề xuất' : 'Ngày áp dụng', dateText(proposal));
  appendDetailField('Giờ đề xuất', proposal.time);
  appendDetailField('Thời điểm gửi', proposal.createdAt ? new Date(proposal.createdAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '');
  if (proposal.category) appendDetailField('Hạng mục', proposal.category);
  if (proposal.amount) appendDetailField('Số tiền', `${Number(proposal.amount).toLocaleString('vi-VN')} VNĐ`);
  appendDetailField(proposal.category ? 'Ghi chú' : 'Lý do', proposal.reason || 'Không có nội dung.');

  const hasAttachment = Boolean(proposal.paymentFileData || proposal.latePhotoData || proposal.latitude);
  detailAttachments.hidden = !hasAttachment;
  detailFile.hidden = !proposal.paymentFileData;
  detailPhoto.hidden = !proposal.latePhotoData;
  detailLocation.hidden = !proposal.latitude;
  if (proposal.paymentFileData) {
    detailFile.href = proposal.paymentFileData;
    detailFile.download = proposal.paymentFileName || 'bieu-mau-de-xuat';
    detailFileName.textContent = proposal.paymentFileName || 'Tải file biểu mẫu';
  }
  if (proposal.latePhotoData) detailPhoto.src = proposal.latePhotoData;
  if (proposal.latitude) detailLocation.href = `https://www.google.com/maps?q=${proposal.latitude},${proposal.longitude}`;

  detailModal.hidden = false;
  detailModal.querySelector('[data-close-report-detail]')?.focus();
}

function closeProposalDetail() {
  detailModal.hidden = true;
}

function render() {
  const query = search.value.trim().toLowerCase();
  const visible = proposals.filter((proposal) => {
    const dayOffset = proposalDayOffset(proposal);
    const matchesDay = dayFilter.value === 'all' || dayOffset === Number(dayFilter.value);
    const matchesType = isPaymentReport ? proposal.type === 'payment' : proposal.type !== 'payment';
    const matchesPaymentFlow = !isPaymentReport || (proposal.paymentFlow || 'ceo') === selectedPaymentFlow;
    const matchesStatus = filter.value === 'all' || proposal.status === filter.value;
    const matchesSearch = !query || `${proposal.userName} ${proposal.reason} ${proposal.category || ''}`.toLowerCase().includes(query);
    return matchesDay && matchesType && matchesPaymentFlow && matchesStatus && matchesSearch;
  }).sort((first, second) => new Date(second.createdAt || second.date) - new Date(first.createdAt || first.date));
  list.innerHTML = visible.length ? visible.map((proposal) => {
    const isPayment = proposal.type === 'payment';
    const typeLabel = labels[proposal.type] || 'Đề xuất khác';
    const paymentFlow = proposal.paymentFlow || 'ceo';
    const paymentStage = proposal.paymentStage || (paymentFlow === 'accountant' ? 'accounting' : 'management');
    const statusLabel = isPayment && proposal.status === 'approved'
      ? 'Đã xác nhận'
      : isPayment && proposal.status === 'pending' && paymentStage === 'accounting'
        ? 'Chờ kế toán xác nhận'
        : statusLabels[proposal.status] || proposal.status;
    const canManage = viewerRole === 'admin' || viewerRole === 'ceo';
    const canApprove = canReview && canManage && proposal.status === 'pending' && (!isPayment || paymentFlow === 'ceo' && paymentStage === 'management');
    const canConfirm = canReview && viewerRole === 'accountant' && isPayment && proposal.status === 'pending' && paymentStage === 'accounting';
    const decisionActions = canConfirm
      ? `<div class="report-decision"><button type="button" data-confirm="${proposal.id}">Xác nhận</button>${paymentFlow === 'accountant' ? `<button type="button" data-accountant-reject="${proposal.id}">Từ chối</button>` : ''}</div>`
      : canApprove
        ? `<div class="report-decision"><button type="button" data-approve="${proposal.id}">Duyệt</button><button type="button" data-reject="${proposal.id}">Từ chối</button></div>`
        : '';
    return `<article class="report-item ${isPayment ? 'is-payment' : 'is-general'}"><div class="report-item-main"><span class="report-type">${typeLabel}</span><h2>${proposal.userName}</h2><p class="report-date"><span class="report-relative-time">${relativeTime(proposal)}</span> · <b>${isPayment ? 'Ngày đề xuất' : 'Ngày áp dụng'}:</b> ${dateText(proposal)}${proposal.time ? ` · <b>Giờ đề xuất:</b> ${proposal.time}` : ''}</p>${proposal.category ? `<div class="payment-meta"><span><b>Hạng mục</b>${proposal.category}</span><span><b>Số tiền</b><strong class="payment-amount">${Number(proposal.amount).toLocaleString('vi-VN')} VNĐ</strong></span></div>` : ''}<p><b>${proposal.category ? 'Ghi chú:' : 'Lý do:'}</b> ${proposal.reason || 'Không có nội dung.'}</p>${proposal.paymentFileData ? `<a class="report-file" href="${proposal.paymentFileData}" download="${proposal.paymentFileName || 'bieu-mau-de-xuat'}"><span>FILE ĐÍNH KÈM</span>${proposal.paymentFileName || 'Tải file biểu mẫu'}</a>` : ''}${proposal.latePhotoData ? `<img class="report-proof" src="${proposal.latePhotoData}" alt="Ảnh xác nhận đi trễ">` : ''}${proposal.latitude ? `<a class="report-location" href="https://www.google.com/maps?q=${proposal.latitude},${proposal.longitude}" target="_blank" rel="noopener">Xem vị trí đã chia sẻ</a>` : ''}</div><strong class="report-status is-${proposal.status}">${statusLabel}</strong><div class="report-actions"><button class="report-detail-button" type="button" data-detail="${proposal.id}">Chi tiết</button>${decisionActions}</div></article>`;
  }).join('') : '<div class="report-empty"><strong>Không có đề xuất phù hợp</strong><span>Thử đổi nhóm hoặc bộ lọc trạng thái.</span></div>';
  if (visible.length) {
    const reportItems = list.querySelectorAll('.report-item');
    visible.forEach((proposal, index) => {
      if (proposal.type !== 'payment') return;
      const source = document.createElement('span');
      source.className = `report-payment-source is-${proposal.paymentFlow || 'ceo'}`;
      source.textContent = proposal.paymentFlow === 'accountant' ? 'Đề xuất trực tiếp' : 'Đã duyệt từ CEO/Admin';
      reportItems[index]?.querySelector('.report-type')?.after(source);
    });
  }
}

function renderSummary() {
  const reportProposals = proposals.filter((proposal) => {
    const matchesType = isPaymentReport ? proposal.type === 'payment' : proposal.type !== 'payment';
    const matchesPaymentFlow = !isPaymentReport || (proposal.paymentFlow || 'ceo') === selectedPaymentFlow;
    return matchesType && matchesPaymentFlow;
  });
  summaryTotal.textContent = reportProposals.length;
  summaryPending.textContent = reportProposals.filter((proposal) => proposal.status === 'pending').length;
  summaryApproved.textContent = reportProposals.filter((proposal) => proposal.status === 'approved').length;
}

async function load(showFeedback = false) {
  if (showFeedback) {
    refreshButton.disabled = true;
    refreshButton.textContent = 'Đang tải...';
  }
  try {
    const scope = isPaymentReport ? 'payment-report' : 'all';
    const response = await fetch(`/api/proposals?scope=${scope}&refresh=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(isPaymentReport ? 'Không có quyền xem báo cáo đề xuất thanh toán.' : 'Không có quyền xem báo cáo nhân sự.');
      const result = await response.json();
      const nextProposals = result.proposals || [];
      canReview = result.canReview === true;
      viewerRole = result.viewerRole || 'employee';
      paymentFlowTabs.hidden = !isPaymentReport || viewerRole !== 'accountant';
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

async function update(id, status, button, action = '', rejectionReason = '') {
  actionFeedback.hidden = true;
  if (button) {
    button.disabled = true;
    button.textContent = action === 'confirm' ? 'ĐANG XÁC NHẬN...' : status === 'approved' ? 'ĐANG DUYỆT...' : 'ĐANG TỪ CHỐI...';
  }
  try {
    const response = await fetch('/api/proposals/status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status, action, rejectionReason }) });
    if (!response.ok) {
      const errorMessage = (await response.text()).trim();
      throw new Error(errorMessage || 'Không thể cập nhật trạng thái đề xuất.');
    }
    const result = await response.json();
    if (!result.proposal) throw new Error('Server không trả về đề xuất đã cập nhật.');
    const proposal = proposals.find((item) => item.id === id);
    if (proposal) Object.assign(proposal, result.proposal);
    renderSummary();
    render();
    const feedbackText = result.movedToAccounting
      ? 'Đã duyệt, đề xuất đã chuyển tới kế toán.'
      : action === 'confirm'
        ? ''
        : action === 'accounting-reject'
          ? 'Đã từ chối, người đề xuất đã được thông báo.'
          : status === 'approved' ? 'Đã duyệt đề xuất.' : 'Đã từ chối đề xuất.';
    actionFeedback.textContent = feedbackText;
    actionFeedback.classList.remove('is-error');
    actionFeedback.hidden = !feedbackText;
    load().catch(() => {});
    return true;
  } catch (error) {
    if (button) {
      button.disabled = false;
      button.textContent = action === 'confirm' ? 'Xác nhận' : status === 'approved' ? 'Duyệt' : 'Từ chối';
    }
    actionFeedback.textContent = error.message || 'Không thể cập nhật trạng thái đề xuất.';
    actionFeedback.classList.add('is-error');
    actionFeedback.hidden = false;
    return false;
  }
}

function closeAccountantRejectModal() {
  accountantRejectModal.hidden = true;
  pendingAccountingRejectId = '';
  accountantRejectReason.value = '';
  accountantRejectError.hidden = true;
  pendingAccountingRejectButton?.focus();
  pendingAccountingRejectButton = null;
}

document.querySelectorAll('[data-cancel-accountant-reject]').forEach((button) => {
  button.addEventListener('click', closeAccountantRejectModal);
});
accountantRejectModal.addEventListener('click', (event) => {
  if (event.target === accountantRejectModal) closeAccountantRejectModal();
});
accountantRejectForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const rejectionReason = accountantRejectReason.value.trim();
  if (!rejectionReason) {
    accountantRejectError.textContent = 'Vui lòng nhập lý do từ chối.';
    accountantRejectError.hidden = false;
    accountantRejectReason.focus();
    return;
  }
  const submitButton = accountantRejectForm.querySelector('[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = 'ĐANG GỬI...';
  const succeeded = await update(pendingAccountingRejectId, 'rejected', pendingAccountingRejectButton, 'accounting-reject', rejectionReason);
  submitButton.disabled = false;
  submitButton.textContent = 'Gửi từ chối';
  if (succeeded) {
    closeAccountantRejectModal();
  } else {
    accountantRejectError.textContent = actionFeedback.textContent;
    accountantRejectError.hidden = false;
  }
});

list.addEventListener('click', (event) => {
  const details = event.target.closest('[data-detail]');
  const approve = event.target.closest('[data-approve]');
  const reject = event.target.closest('[data-reject]');
  const confirm = event.target.closest('[data-confirm]');
  const accountantReject = event.target.closest('[data-accountant-reject]');
  if (details) { openProposalDetail(details.dataset.detail); return; }
  if (approve) update(approve.dataset.approve, 'approved', approve);
  if (reject) update(reject.dataset.reject, 'rejected', reject);
  if (confirm) update(confirm.dataset.confirm, 'approved', confirm, 'confirm');
  if (accountantReject) {
    pendingAccountingRejectId = accountantReject.dataset.accountantReject;
    pendingAccountingRejectButton = accountantReject;
    accountantRejectReason.value = '';
    accountantRejectError.hidden = true;
    accountantRejectModal.hidden = false;
    accountantRejectReason.focus();
  }
});
document.querySelector('[data-close-report-detail]')?.addEventListener('click', closeProposalDetail);
detailModal?.addEventListener('click', (event) => { if (event.target === detailModal) closeProposalDetail(); });
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && detailModal && !detailModal.hidden) closeProposalDetail();
  if (event.key === 'Escape' && accountantRejectModal && !accountantRejectModal.hidden) closeAccountantRejectModal();
});
search.addEventListener('input', render);
filter.addEventListener('change', render);
dayFilter.addEventListener('change', render);
paymentFlowTabs.addEventListener('click', (event) => {
  const selectedTab = event.target.closest('[data-payment-flow-filter]');
  if (!selectedTab) return;
  selectedPaymentFlow = selectedTab.dataset.paymentFlowFilter;
  paymentFlowTabs.querySelectorAll('[data-payment-flow-filter]').forEach((tab) => {
    const selected = tab === selectedTab;
    tab.classList.toggle('is-active', selected);
    tab.setAttribute('aria-selected', String(selected));
  });
  renderSummary();
  render();
});
refreshButton.addEventListener('click', () => load(true).catch((error) => { list.innerHTML = `<p>${error.message}</p>`; }));
load().catch((error) => { list.innerHTML = `<p>${error.message}</p>`; });
setInterval(() => load().catch(() => {}), 3000);
