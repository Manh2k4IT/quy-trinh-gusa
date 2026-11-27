const list = document.querySelector('[data-proposal-list]');
const search = document.querySelector('[data-proposal-search]');
const filter = document.querySelector('[data-proposal-status-filter]');
const reportToolbar = document.querySelector('.report-toolbar');
const searchBox = search.closest('.search-box');
search.placeholder = 'Tìm theo tên người gửi...';
search.setAttribute('aria-label', 'Tìm theo tên người gửi');
reportToolbar.prepend(searchBox);
const pageSize = 10;
let currentPage = 1;
const pagination = document.createElement('nav');
pagination.className = 'proposal-pagination';
pagination.setAttribute('aria-label', 'Phân trang danh sách đề xuất');
list.after(pagination);
pagination.addEventListener('click', (event) => {
  const button = event.target.closest('[data-page]');
  if (!button || button.disabled) return;
  currentPage = Number(button.dataset.page);
  render();
  list.scrollIntoView({ block: 'start', behavior: 'smooth' });
});
const proposalUrl = new URLSearchParams(window.location.search);
const requestedProposalId = proposalUrl.get('proposalId') || '';
let displayedProposalId = requestedProposalId;
const isPaymentReport = proposalUrl.get('type') === 'payment';
// Leave and working-time proposals of the accounting staff, reviewed by the chief accountant.
const isAccountingTeamReport = proposalUrl.get('type') === 'accounting-team';
if (isAccountingTeamReport) {
  document.title = 'Báo cáo nghỉ phép phòng kế toán - Quy Trình';
  document.querySelector('.breadcrumbs strong').textContent = 'Báo cáo nghỉ phép phòng kế toán';
  document.querySelector('.profile-page-heading .eyebrow').textContent = 'PHÒNG KẾ TOÁN';
  document.querySelector('.profile-page-heading h1').textContent = 'Báo cáo nghỉ phép phòng kế toán';
  document.querySelector('.profile-page-heading p').textContent = 'Duyệt đề xuất nghỉ phép và giờ làm (đi trễ, về sớm, nghỉ nửa ngày) của nhân viên Kế toán. Đề xuất đã duyệt được báo lên nhóm Zalo.';
  document.querySelector('.report-tabs')?.setAttribute('hidden', '');
  document.querySelector('.report-summary .is-payment')?.setAttribute('hidden', '');
}
if (isPaymentReport) {
  document.title = 'Báo cáo đề xuất thanh toán - Quy Trình';
  document.querySelector('.breadcrumbs strong').textContent = 'Báo cáo đề xuất thanh toán';
  document.querySelector('.profile-page-heading h1').textContent = 'Báo cáo đề xuất thanh toán';
  document.querySelector('.profile-page-heading p').textContent = 'Theo dõi và xử lý đề xuất thanh toán của nhân viên.';
}
const dayFilter = document.createElement('input');
dayFilter.type = 'date';
dayFilter.className = 'report-date-filter';
dayFilter.dataset.proposalDayFilter = '';
dayFilter.setAttribute('aria-label', 'Lọc theo ngày gửi đề xuất');
const todayButton = document.createElement('button');
todayButton.type = 'button';
todayButton.className = 'report-date-shortcut';
todayButton.textContent = 'Hôm nay';
const allDaysButton = document.createElement('button');
allDaysButton.type = 'button';
allDaysButton.className = 'report-date-clear';
allDaysButton.textContent = 'Tất cả ngày';
document.querySelector('.report-toolbar')?.insertBefore(dayFilter, filter);
document.querySelector('.report-toolbar')?.insertBefore(todayButton, filter);
document.querySelector('.report-toolbar')?.insertBefore(allDaysButton, filter);
dayFilter.value = requestedProposalId ? '' : vietnamDateKey(new Date());
const updateAllDaysButton = () => {
  const isSelected = !dayFilter.value;
  allDaysButton.classList.toggle('is-active', isSelected);
  allDaysButton.setAttribute('aria-pressed', String(isSelected));
  const isToday = dayFilter.value === vietnamDateKey(new Date());
  todayButton.classList.toggle('is-active', isToday);
  todayButton.setAttribute('aria-pressed', String(isToday));
};
updateAllDaysButton();
if (requestedProposalId) filter.value = 'all';
const paymentFlowTabs = document.createElement('div');
paymentFlowTabs.className = 'payment-flow-tabs';
paymentFlowTabs.setAttribute('role', 'tablist');
paymentFlowTabs.setAttribute('aria-label', 'Nguồn đề xuất thanh toán');
paymentFlowTabs.innerHTML = '<button type="button" class="is-active" data-payment-flow-filter="ceo" role="tab" aria-selected="true">Gửi qua CEO/Admin</button><button type="button" data-payment-flow-filter="accountant" role="tab" aria-selected="false">Đề xuất trực tiếp</button>';
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
const summaryRejected = document.querySelector('[data-report-rejected]');
for (const [counter, kind, drawing] of [
  [summaryTotal, 'total', '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M9 10h6M9 14h6M9 18h3"/>'],
  [summaryPending, 'pending', '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'],
  [summaryApproved, 'approved', '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>'],
  [summaryRejected, 'rejected', '<circle cx="12" cy="12" r="9"/><path d="M8.5 8.5l7 7M15.5 8.5l-7 7"/>'],
]) {
  const icon = document.createElement('div');
  icon.className = `report-summary-icon is-${kind}`;
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${drawing}</svg>`;
  counter.closest('article').prepend(icon);
  const actionHint = document.createElement('small');
  actionHint.className = 'report-summary-action';
  actionHint.textContent = 'Nhấn để xem danh sách';
  counter.closest('article').append(actionHint);
}
const summaryCards = [
  [summaryTotal?.closest('article'), 'all'],
  [summaryPending?.closest('article'), 'pending'],
  [summaryApproved?.closest('article'), 'approved'],
  [summaryRejected?.closest('article'), 'rejected'],
];
summaryCards.forEach(([card, status]) => {
  if (!card) return;
  card.dataset.summaryFilter = status;
  card.setAttribute('role', 'button');
  card.tabIndex = 0;
  const openSummaryList = () => {
    displayedProposalId = '';
    dayFilter.value = '';
    updateAllDaysButton();
    filter.value = status;
    currentPage = 1;
    render();
    document.querySelector('.report-list')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };
  card.addEventListener('click', openSummaryList);
  card.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openSummaryList();
    }
  });
});
const accountantRejectModal = document.querySelector('[data-accountant-reject-modal]');
const accountantRejectForm = document.querySelector('[data-accountant-reject-form]');
const accountantRejectReason = document.querySelector('[data-accountant-reject-reason]');
const accountantRejectError = document.querySelector('[data-accountant-reject-error]');
const labels = { late: 'Đề xuất đi trễ', 'early-leave': 'Đề xuất về sớm', 'half-day': 'Đề xuất làm 1/2 ngày', leave: 'Đề xuất nghỉ phép', 'unauthorized-leave': 'Đề xuất nghỉ không phép', other: 'Đề xuất khác', payment: 'Đề xuất thanh toán' };
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
const locallyDeletedProposalIds = new Set();
let canReview = false;
let viewerRole = 'employee';
let pendingAccountingRejectId = '';
let pendingAccountingRejectButton = null;
// The reason dialog serves both Admin/CEO rejections and the accountant's direct-payment rejection.
let pendingRejectAction = '';
const rejectTitle = document.querySelector('[data-reject-title]');
function openRejectDialog(id, button, action) {
  pendingAccountingRejectId = id;
  pendingAccountingRejectButton = button;
  pendingRejectAction = action;
  if (rejectTitle) rejectTitle.textContent = action === 'accounting-reject' ? 'Từ chối đề xuất trực tiếp' : 'Từ chối đề xuất';
  accountantRejectReason.value = '';
  accountantRejectError.hidden = true;
  accountantRejectModal.hidden = false;
  accountantRejectReason.focus();
}
let notificationInitialized = false;
let notificationTimer;

const topbar = document.querySelector('.topbar');
const notificationButton = document.createElement('button');
notificationButton.className = 'top-icon notification-icon proposal-notification-trigger';
notificationButton.type = 'button';
notificationButton.setAttribute('aria-label', 'Thông báo');
// Dùng chung chuông thông báo của từng người (admin-menu.js).
notificationButton.dataset.notificationTrigger = '';
notificationButton.innerHTML = '<svg class="bell-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-3-3-9M10 21h4" /></svg><b data-proposal-notification-count data-notification-count hidden>0</b>';
topbar?.append(notificationButton);

const notificationPanel = document.createElement('div');
notificationPanel.className = 'notification-menu proposal-notification-menu';
notificationPanel.hidden = true;
notificationPanel.dataset.notificationMenu = '';
notificationPanel.innerHTML = '<strong>Thông báo</strong><div class="notification-list" data-proposal-notification-list><p class="notification-empty">Đang tải thông báo...</p></div>';
document.querySelector('.workspace')?.append(notificationPanel);
const notificationCount = notificationButton.querySelector('[data-proposal-notification-count]');
const notificationList = notificationPanel.querySelector('[data-proposal-notification-list]');

function proposalNotificationText(proposal) {
  const type = proposal.type === 'payment' ? 'đề xuất thanh toán' : 'đề xuất nghỉ phép và giờ làm';
  return `${proposal.userName || 'Nhân viên'} vừa gửi ${type}.`;
}

async function showProposalNotification(newProposals) {
  let visibleProposals = newProposals.filter((proposal) => !locallyDeletedProposalIds.has(proposal.id));
  if (!visibleProposals.length) return;
  if (window.claimProposalNotification && !(await window.claimProposalNotification(visibleProposals[0].id))) return;
  visibleProposals = visibleProposals.filter((proposal) => !locallyDeletedProposalIds.has(proposal.id));
  if (!visibleProposals.length) return;
  notificationList.innerHTML = visibleProposals.slice(0, 5).map((proposal) => `<p><b>Đề xuất mới</b><span>${proposalNotificationText(proposal)}</span></p>`).join('');
  notificationCount.textContent = String(visibleProposals.length);
  notificationCount.hidden = false;
  notificationPanel.hidden = false;
  notificationButton.classList.remove('is-notifying');
  void notificationButton.offsetWidth;
  notificationButton.classList.add('is-notifying');
  window.speakProposalNotification?.(visibleProposals[0]);
  clearTimeout(notificationTimer);
  notificationTimer = setTimeout(() => {
    notificationPanel.hidden = true;
    notificationButton.classList.remove('is-notifying');
    window.refreshNotifications?.();
  }, 5000);

  if (window.desktopSettings?.notify) {
    window.desktopSettings.notify({ title: 'Có đề xuất mới', body: proposalNotificationText(visibleProposals[0]) });
  } else if ('Notification' in window && Notification.permission === 'granted') {
    const notification = new Notification('Có đề xuất mới', { body: proposalNotificationText(visibleProposals[0]), tag: 'gusa-proposal' });
    notification.onclick = () => window.desktopSettings?.showApp?.();
  }
}

notificationButton.addEventListener('click', () => {
  notificationPanel.hidden = !notificationPanel.hidden;
  if (!notificationPanel.hidden) clearTimeout(notificationTimer);
  if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
});
document.addEventListener('click', (event) => {
  if (!(event.target instanceof Node)) return;
  if (!notificationPanel.contains(event.target) && !notificationButton.contains(event.target)) {
    notificationPanel.hidden = true;
    clearTimeout(notificationTimer);
  }
}, true);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    notificationPanel.hidden = true;
    clearTimeout(notificationTimer);
  }
});

function dateText(proposal) {
  const format = (value) => value ? value.split('-').reverse().join('/') : '';
  return proposal.dateFrom && proposal.dateTo ? `${format(proposal.dateFrom)} - ${format(proposal.dateTo)}` : format(proposal.date);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
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

function submittedDateText(proposal) {
  const dateKey = proposal.createdAt ? vietnamDateKey(proposal.createdAt) : proposal.date;
  return /^\d{4}-\d{2}-\d{2}$/.test(dateKey || '')
    ? dateKey.split('-').reverse().join('/')
    : 'Không rõ ngày';
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

function proposalDayKey(proposal) {
  return proposal.createdAt ? vietnamDateKey(proposal.createdAt) : proposal.date || '';
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
  window.markNotificationSeen?.(`review-${proposalId}`);

  detailType.textContent = proposal.type === 'other' && proposal.subject ? `Đề xuất: ${proposal.subject}` : labels[proposal.type] || 'Đề xuất khác';
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
  const documentActions = detailModal.querySelector('[data-saved-document-actions]');
  if (documentActions) documentActions.remove();
  const savedDocumentActions = document.createElement('div');
  savedDocumentActions.dataset.savedDocumentActions = '';
  detailFields.after(savedDocumentActions);
  window.GusaSavedProposalDocument?.addActions(savedDocumentActions, proposal);
  appendDetailField('Trạng thái', statusLabels[proposal.status] || proposal.status);
  if (proposal.subject) appendDetailField('Nội dung đề xuất', proposal.subject);
  appendDetailField(proposal.type === 'payment' ? 'Ngày đề xuất' : 'Ngày áp dụng', dateText(proposal));
  appendDetailField('Giờ đề xuất', proposal.time);
  appendDetailField('Thời điểm gửi', proposal.createdAt ? new Date(proposal.createdAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '');
  if (proposal.category) appendDetailField('Hạng mục', proposal.category);
  if (proposal.amount) appendDetailField('Số tiền', `${Number(proposal.amount).toLocaleString('vi-VN')} VNĐ`);
  appendDetailField(proposal.category ? 'Ghi chú' : 'Lý do', proposal.reason || 'Không có nội dung.');
  if (proposal.signatureData) {
    const row = document.createElement('div');
    row.className = 'report-detail-field';
    const label = document.createElement('dt');
    label.textContent = 'Chữ ký người đề xuất';
    const value = document.createElement('dd');
    const signature = document.createElement('img');
    signature.src = proposal.signatureData;
    signature.alt = 'Chữ ký người đề xuất';
    signature.style.cssText = 'width:100%;max-width:300px;background:white;border-radius:8px';
    value.append(signature);
    if (proposal.signatureName) {
      const name = document.createElement('div');
      name.textContent = proposal.signatureName;
      value.append(name);
    }
    row.append(label, value);
    detailFields.append(row);
  }

  const fileUrl = proposal.paymentFileData || proposal.evidenceFileData;
  const hasAttachment = Boolean(fileUrl || proposal.latePhotoData || proposal.latitude);
  detailAttachments.hidden = !hasAttachment;
  detailFile.hidden = !fileUrl;
  detailPhoto.hidden = !proposal.latePhotoData;
  detailLocation.hidden = !proposal.latitude;
  if (fileUrl) {
    const fileName = proposal.paymentFileName || proposal.evidenceFileName;
    detailFile.href = fileUrl;
    detailFile.target = '_blank';
    detailFile.rel = 'noopener';
    detailFile.download = fileName || 'tep-dinh-kem';
    detailFile.querySelector('span').textContent = proposal.paymentFileData ? 'FILE ĐÍNH KÈM' : 'CHỨNG TỪ ĐÍNH KÈM';
    detailFileName.textContent = fileName || 'Tải file đính kèm';
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
  const normalizeSearchText = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase();
  const query = normalizeSearchText(search.value.trim());
  const visible = proposals.filter((proposal) => {
    const matchesDay = !dayFilter.value || proposalDayKey(proposal) === dayFilter.value;
    const matchesType = isPaymentReport ? proposal.type === 'payment' : proposal.type !== 'payment';
    const matchesProposal = !displayedProposalId || proposal.id === displayedProposalId;
    const matchesPaymentFlow = !isPaymentReport || (proposal.paymentFlow || 'ceo') === selectedPaymentFlow;
    const matchesStatus = filter.value === 'all' || proposal.status === filter.value;
    const matchesSearch = !query || normalizeSearchText(proposal.userName).includes(query);
    return matchesDay && matchesType && matchesProposal && matchesPaymentFlow && matchesStatus && matchesSearch;
  }).sort((first, second) => new Date(second.createdAt || second.date) - new Date(first.createdAt || first.date));
  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));
  currentPage = Math.min(currentPage, totalPages);
  const pageProposals = visible.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  list.innerHTML = pageProposals.length ? pageProposals.map((proposal) => {
    const isPayment = proposal.type === 'payment';
    const typeLabel = proposal.type === 'other' && proposal.subject
      ? `Đề xuất: ${proposal.subject}`
      : labels[proposal.type] || 'Đề xuất khác';
    const paymentFlow = proposal.paymentFlow || 'ceo';
    const paymentStage = proposal.paymentStage || (paymentFlow === 'accountant' ? 'accounting' : 'management');
    const statusLabel = isPayment && proposal.status === 'approved'
      ? 'Đã xác nhận'
      : isPayment && proposal.status === 'pending' && paymentStage === 'accounting'
        ? 'Chờ kế toán xác nhận'
        : statusLabels[proposal.status] || proposal.status;
    const statusIcon = proposal.status === 'approved'
      ? 'm8 12 3 3 5-6'
      : proposal.status === 'rejected'
        ? 'M8.5 8.5l7 7M15.5 8.5l-7 7'
        : proposal.status === 'canceled'
          ? 'M8 12h8'
          : 'M12 7v5l3 2';
    const canManage = viewerRole === 'admin' || viewerRole === 'ceo';
    const canDecide = canManage || (isAccountingTeamReport && viewerRole === 'accountant' && !isPayment);
    const canApprove = canReview && canDecide && proposal.status === 'pending' && (!isPayment || paymentFlow === 'ceo' && paymentStage === 'management');
    const canConfirm = canReview && viewerRole === 'accountant' && isPayment && proposal.status === 'pending' && paymentStage === 'accounting';
    const decisionActions = canConfirm
        ? `<div class="report-decision"><button class="report-approve-button" type="button" data-confirm="${escapeHtml(proposal.id)}"><span aria-hidden="true">✓</span> Xác nhận</button>${paymentFlow === 'accountant' ? `<button class="report-reject-button" type="button" data-accountant-reject="${escapeHtml(proposal.id)}"><span aria-hidden="true">×</span> Từ chối</button>` : ''}</div>`
      : canApprove
          ? `<div class="report-decision"><button class="report-approve-button" type="button" data-approve="${escapeHtml(proposal.id)}"><span aria-hidden="true">✓</span> Duyệt</button><button class="report-reject-button" type="button" data-reject="${escapeHtml(proposal.id)}"><span aria-hidden="true">×</span> Từ chối</button></div>`
        : '';
    const zaloResend = canManage && ['pending', 'approved'].includes(proposal.status)
        ? `<button class="report-secondary-button" type="button" data-zalo-resend="${escapeHtml(proposal.id)}"><span aria-hidden="true">↻</span> Gửi lại Zalo</button>`
      : '';
    const proposalId = escapeHtml(proposal.id);
    const userName = escapeHtml(proposal.userName || 'Nhân viên');
    const avatar = proposal.userPicture
        ? `<img src="${escapeHtml(proposal.userPicture)}" alt="" referrerpolicy="no-referrer" />`
        : `<span>${escapeHtml((proposal.userName || 'N').trim().charAt(0).toUpperCase() || 'N')}</span>`;
    const reasonLabel = proposal.category ? 'Ghi chú' : 'Lý do';
    const attachmentUrl = proposal.paymentFileData || proposal.evidenceFileData || '';
    const attachmentName = proposal.paymentFileName || proposal.evidenceFileName || '';
    const isImageAttachment = /^data:image\/(?:png|jpe?g|gif|webp);base64,/i.test(attachmentUrl);
    const attachment = attachmentUrl
        ? `<section class="report-media-card"><span class="report-media-heading"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 12.5 6.4-6.4a3 3 0 0 1 4.2 4.2l-8.5 8.5a5 5 0 0 1-7.1-7.1l8.5-8.5"/></svg>${isImageAttachment ? 'Hình ảnh đính kèm' : 'Tệp đính kèm'}</span><div class="report-media-body">${isImageAttachment ? `<img class="report-media-preview" src="${escapeHtml(attachmentUrl)}" alt="" />` : '<span class="report-media-file-icon" aria-hidden="true">▤</span>'}<a class="report-media-action report-file" href="${escapeHtml(attachmentUrl)}"${isImageAttachment ? ' target="_blank" rel="noopener"' : ` download="${escapeHtml(attachmentName || 'tep-dinh-kem')}"`}>${isImageAttachment ? 'Xem ảnh' : escapeHtml(attachmentName || 'Tải tệp')}</a></div></section>`
        : '';
    const proof = proposal.latePhotoData
        ? `<section class="report-media-card"><span class="report-media-heading"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m21 15-5-5L5 20"/></svg>Ảnh xác nhận</span><div class="report-media-body"><img class="report-media-preview" src="${escapeHtml(proposal.latePhotoData)}" alt="" /><a class="report-media-action" href="${escapeHtml(proposal.latePhotoData)}" target="_blank" rel="noopener">Xem ảnh</a></div></section>`
        : '';
    const location = proposal.latitude
        ? `<section class="report-media-card"><span class="report-media-heading"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>Vị trí đã chia sẻ</span><div class="report-media-body"><span class="report-media-location-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg></span><a class="report-media-action report-location" href="https://www.google.com/maps?q=${encodeURIComponent(proposal.latitude)},${encodeURIComponent(proposal.longitude)}" target="_blank" rel="noopener">Xem bản đồ</a></div></section>`
        : '';
    const mediaItems = [attachment, proof, location].filter(Boolean).join('');
    const media = mediaItems ? `<div class="report-media-list">${mediaItems}</div>` : '';
    const deleteAction = canManage
        ? `<button class="report-delete-button" type="button" data-delete-proposal="${proposalId}" aria-label="Xóa đề xuất của ${userName}" title="Xóa đề xuất">×</button>`
      : '';
    return `<article class="report-item ${isPayment ? 'is-payment' : 'is-general'}" data-proposal-id="${proposalId}">
        <aside class="report-card-aside">
          <div class="report-status-art is-${escapeHtml(proposal.status)}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="${statusIcon}"/></svg></div>
          <div class="report-card-state"><span>TRẠNG THÁI</span><strong class="report-status is-${escapeHtml(proposal.status)}">${escapeHtml(statusLabel)}</strong></div>
        </aside>
        <div class="report-card-content">
          <header class="report-card-header">
            <div class="report-person"><div class="report-avatar">${avatar}</div><div><h2>${userName}</h2><p>${escapeHtml(relativeTime(proposal))} · Ngày gửi: ${escapeHtml(submittedDateText(proposal))} · Người gửi đề xuất</p></div></div>
            <div class="report-card-status">${deleteAction}</div>
          </header>
          <div class="report-card-divider"></div>
          <h3 class="report-card-title"><span class="report-title-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18m-11 0v2h4v-2"/></svg></span><span class="report-type">${escapeHtml(typeLabel)}</span></h3>
          <div class="report-info-panel">
            <div class="report-info-item"><span class="report-info-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18m-13 4h3m-3 3h7"/></svg></span><div><span>Thời gian đề xuất</span><strong>${escapeHtml(dateText(proposal) || 'Chưa xác định')}${proposal.time ? ` · ${escapeHtml(proposal.time)}` : ''}</strong></div></div>
            <span class="report-info-divider" aria-hidden="true"></span>
            <div class="report-info-item report-reason"><span class="report-info-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H6l-3 2 1-4a7.5 7.5 0 1 1 16-5.5Z"/><path d="M8 11h8m-8 3h5"/></svg></span><div><span>${reasonLabel}</span><p>${escapeHtml(proposal.reason || 'Không có nội dung.')}</p></div></div>
          </div>
          ${proposal.category ? `<div class="payment-meta"><span><b>Hạng mục</b>${escapeHtml(proposal.category)}</span><span><b>Số tiền</b><strong class="payment-amount">${Number(proposal.amount).toLocaleString('vi-VN')} VNĐ</strong></span></div>` : ''}
          ${media}
          <footer class="report-card-footer">
            <div class="report-secondary-actions"><button class="report-secondary-button" type="button" data-detail="${proposalId}"><span aria-hidden="true">▤</span> Chi tiết</button>${zaloResend}</div>
            ${decisionActions}
          </footer>
        </div>
    </article>`;
  }).join('') : '<div class="report-empty"><strong>Không có đề xuất phù hợp</strong><span>Thử đổi nhóm hoặc bộ lọc trạng thái.</span></div>';
  if (pageProposals.length) {
    const reportItems = list.querySelectorAll('.report-item');
    pageProposals.forEach((proposal, index) => {
      if (proposal.type !== 'payment') return;
      const source = document.createElement('span');
      // The badge tells where a CEO-flow payment stands, so a rejected one never reads as approved.
      const flow = proposal.paymentFlow || 'ceo';
      const stage = proposal.paymentStage || (flow === 'accountant' ? 'accounting' : 'management');
      const [state, label] = flow === 'accountant' ? ['accountant', 'Đề xuất trực tiếp']
        : proposal.status === 'rejected' ? ['rejected', 'CEO/Admin đã từ chối']
        : proposal.status === 'canceled' ? ['canceled', 'Đã hủy']
        : proposal.status === 'pending' && stage === 'management' ? ['waiting', 'Chờ CEO/Admin duyệt']
        : ['ceo', 'Đã duyệt từ CEO/Admin'];
      source.className = `report-payment-source is-${state}`;
      source.textContent = label;
      reportItems[index]?.querySelector('.report-type')?.after(source);
    });
  }
  renderPagination(totalPages, visible.length);
}

function renderPagination(totalPages, totalItems) {
  pagination.replaceChildren();
  pagination.hidden = totalPages <= 1;
  if (pagination.hidden) return;

  const createPageButton = (label, page, disabled = false, current = false) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.dataset.page = String(page);
    button.disabled = disabled;
    if (current) {
      button.className = 'is-current';
      button.setAttribute('aria-current', 'page');
    }
    return button;
  };
  pagination.append(createPageButton('Trước', currentPage - 1, currentPage === 1));
  const pageLabel = document.createElement('span');
  pageLabel.textContent = `Trang ${currentPage} / ${totalPages} · ${totalItems} đề xuất`;
  pagination.append(pageLabel);
  pagination.append(createPageButton('Sau', currentPage + 1, currentPage === totalPages));
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
  summaryRejected.textContent = reportProposals.filter((proposal) => proposal.status === 'rejected').length;
}

async function load(showFeedback = false) {
  if (showFeedback) {
    refreshButton.disabled = true;
    refreshButton.textContent = 'Đang tải...';
  }
  try {
    const scope = isPaymentReport ? 'payment-report' : isAccountingTeamReport ? 'accounting-team' : 'all';
    const response = await fetch(`/api/proposals?scope=${scope}&refresh=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(isPaymentReport ? 'Không có quyền xem báo cáo đề xuất thanh toán.' : isAccountingTeamReport ? 'Chỉ Kế toán trưởng và Admin/CEO được xem báo cáo này.' : 'Không có quyền xem báo cáo nhân sự.');
      const result = await response.json();
      const nextProposals = (result.proposals || []).filter((proposal) => !locallyDeletedProposalIds.has(proposal.id));
      canReview = result.canReview === true;
      viewerRole = result.viewerRole || 'employee';
      const linkedProposal = nextProposals.find((proposal) => proposal.id === displayedProposalId);
      if (displayedProposalId && linkedProposal?.type === 'payment') {
        selectedPaymentFlow = linkedProposal.paymentFlow || 'ceo';
        paymentFlowTabs.querySelectorAll('[data-payment-flow-filter]').forEach((button) => {
          const selected = button.dataset.paymentFlowFilter === selectedPaymentFlow;
          button.classList.toggle('is-active', selected);
          button.setAttribute('aria-selected', String(selected));
        });
      }
      paymentFlowTabs.hidden = !isPaymentReport || viewerRole !== 'accountant';
    const knownIds = new Set(proposals.map((proposal) => proposal.id));
    const newProposals = notificationInitialized ? nextProposals.filter((proposal) => !knownIds.has(proposal.id)) : [];
    proposals = nextProposals;
    notificationInitialized = true;
    renderSummary();
    render();
    if (displayedProposalId) {
      [...list.querySelectorAll('[data-proposal-id]')]
        .find((item) => item.dataset.proposalId === displayedProposalId)
        ?.scrollIntoView({ block: 'center' });
    }
    window.GusaReportNotifications?.markSeen(result.reportNotificationSnapshot);
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
  if (!rejectionReason && !confirm('Bạn chưa nhập lý do từ chối. Vẫn gửi từ chối mà không có lý do?')) {
    accountantRejectReason.focus();
    return;
  }
  const submitButton = accountantRejectForm.querySelector('[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = 'ĐANG GỬI...';
  const succeeded = await update(pendingAccountingRejectId, 'rejected', pendingAccountingRejectButton, pendingRejectAction, rejectionReason);
  submitButton.disabled = false;
  submitButton.textContent = 'Gửi từ chối';
  if (succeeded) {
    closeAccountantRejectModal();
  } else {
    accountantRejectError.textContent = actionFeedback.textContent;
    accountantRejectError.hidden = false;
  }
});

async function resendZalo(button) {
  button.disabled = true;
  button.textContent = 'Đang gửi...';
  try {
    const response = await fetch(`/api/proposals/${encodeURIComponent(button.dataset.zaloResend)}/zalo-resend`, { method: 'POST' });
    if (!response.ok) throw new Error(await response.text() || 'Không gửi lại được thông báo Zalo.');
    actionFeedback.textContent = 'Đã gửi lại thông báo lên Zalo.';
    actionFeedback.classList.remove('is-error');
  } catch (error) {
    actionFeedback.textContent = error.message || 'Không gửi lại được thông báo Zalo.';
    actionFeedback.classList.add('is-error');
  } finally {
    actionFeedback.hidden = false;
    button.disabled = false;
    button.textContent = 'Gửi lại Zalo';
  }
}

list.addEventListener('click', (event) => {
  const deleteButton = event.target.closest('[data-delete-proposal]');
  if (deleteButton) {
    deleteProposal(deleteButton);
    return;
  }
  const zaloResend = event.target.closest('[data-zalo-resend]');
  if (zaloResend) { resendZalo(zaloResend); return; }
  const details = event.target.closest('[data-detail]');
  const approve = event.target.closest('[data-approve]');
  const reject = event.target.closest('[data-reject]');
  const confirm = event.target.closest('[data-confirm]');
  const accountantReject = event.target.closest('[data-accountant-reject]');
  if (details) { openProposalDetail(details.dataset.detail); return; }
  if (approve) update(approve.dataset.approve, 'approved', approve);
  if (reject) openRejectDialog(reject.dataset.reject, reject, '');
  if (confirm) update(confirm.dataset.confirm, 'approved', confirm, 'confirm');
  if (accountantReject) openRejectDialog(accountantReject.dataset.accountantReject, accountantReject, 'accounting-reject');
});

async function deleteProposal(button) {
  const proposalId = button.dataset.deleteProposal;
  if (!confirm('Bạn có chắc chắn muốn xóa vĩnh viễn đề xuất này? Thao tác này không thể hoàn tác.')) return;
  button.disabled = true;
  button.textContent = '…';
  try {
    const response = await fetch(`/api/proposals/${encodeURIComponent(proposalId)}`, { method: 'DELETE' });
    if (!response.ok) {
      const errorMessage = (await response.text()).trim();
      throw new Error(errorMessage || 'Không thể xóa đề xuất.');
    }
    locallyDeletedProposalIds.add(proposalId);
    proposals = proposals.filter((proposal) => proposal.id !== proposalId);
    renderSummary();
    render();
    actionFeedback.textContent = 'Đã xóa đề xuất.';
    actionFeedback.classList.remove('is-error');
    actionFeedback.hidden = false;
  } catch (error) {
    button.disabled = false;
    button.textContent = '×';
    actionFeedback.textContent = error.message || 'Không thể xóa đề xuất.';
    actionFeedback.classList.add('is-error');
    actionFeedback.hidden = false;
  }
}
document.querySelector('[data-close-report-detail]')?.addEventListener('click', closeProposalDetail);
detailModal?.addEventListener('click', (event) => { if (event.target === detailModal) closeProposalDetail(); });
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && detailModal && !detailModal.hidden) closeProposalDetail();
  if (event.key === 'Escape' && accountantRejectModal && !accountantRejectModal.hidden) closeAccountantRejectModal();
});
search.addEventListener('input', () => {
  displayedProposalId = '';
  currentPage = 1;
  render();
});
filter.addEventListener('change', () => {
  displayedProposalId = '';
  currentPage = 1;
  render();
});
dayFilter.addEventListener('change', () => {
  displayedProposalId = '';
  updateAllDaysButton();
  currentPage = 1;
  render();
});
todayButton.addEventListener('click', () => {
  dayFilter.value = vietnamDateKey(new Date());
  displayedProposalId = '';
  updateAllDaysButton();
  currentPage = 1;
  render();
});
allDaysButton.addEventListener('click', () => {
  dayFilter.value = '';
  updateAllDaysButton();
  displayedProposalId = '';
  currentPage = 1;
  render();
});
paymentFlowTabs.addEventListener('click', (event) => {
  const selectedTab = event.target.closest('[data-payment-flow-filter]');
  if (!selectedTab) return;
  selectedPaymentFlow = selectedTab.dataset.paymentFlowFilter;
  currentPage = 1;
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
