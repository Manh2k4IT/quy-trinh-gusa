const modal = document.querySelector('[data-payment-modal]');
const form = document.querySelector('[data-payment-form]');
const status = document.querySelector('[data-payment-status]');
const paymentFileInput = form.querySelector('[name="paymentFile"]');
const previewButton = document.querySelector('[data-preview-template]');
const downloadButton = document.querySelector('[data-download-template]');
const adminTemplateTools = document.querySelector('[data-admin-template]');
const adminTemplateFile = document.querySelector('[data-admin-template-file]');
const adminTemplateStatus = document.querySelector('[data-admin-template-status]');
const paymentButton = document.querySelector('[data-open-payment]');
const paymentFlow = new URLSearchParams(window.location.search).get('flow') === 'accountant' ? 'accountant' : 'ceo';
const paymentFlowLabel = paymentFlow === 'accountant' ? 'Kế toán' : 'CEO';
let currentTemplate = { fileName: 'payment-template.html', fileData: 'payment-template.html' };
let currentTemplateUrl = '';
let paymentProposals = [];
document.title = `Đề xuất thanh toán (${paymentFlowLabel}) - Quy Trình`;
document.querySelector('.breadcrumbs strong').textContent = `Đề xuất thanh toán (${paymentFlowLabel})`;
document.querySelector('.payment-ribbon').textContent = `Đề xuất thanh toán (${paymentFlowLabel})`;
document.querySelector('.payment-modal-card h2').textContent = `Đề xuất thanh toán (${paymentFlowLabel})`;
const proposalListButton = document.createElement('button');
proposalListButton.type = 'button';
proposalListButton.className = 'payment-list-button';
proposalListButton.textContent = 'DANH SÁCH ĐỀ XUẤT';
paymentButton.before(proposalListButton);
paymentButton.textContent = 'ĐỀ XUẤT';
document.querySelector('[data-cancel-payment-main]')?.remove();
document.querySelector('[data-cancel-payment]')?.remove();
document.querySelector('[data-payment-review]')?.remove();
const paymentHistory = document.createElement('section');
paymentHistory.className = 'payment-history';
paymentHistory.dataset.paymentHistory = '';
paymentHistory.hidden = true;
document.querySelector('.payment-modal-card').insertBefore(paymentHistory, form);
document.querySelector('[data-cancel-payment]')?.remove();

const templateActionStatus = document.createElement('p');
templateActionStatus.className = 'payment-template-status';
templateActionStatus.setAttribute('role', 'status');
document.querySelector('.payment-template').append(templateActionStatus);
previewButton.disabled = true;
downloadButton.disabled = true;

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function renderPaymentHistory() {
  paymentHistory.innerHTML = paymentProposals.length
    ? paymentProposals.map((proposal) => {
      const state = proposal.status === 'approved'
        ? 'ĐÃ XÁC NHẬN'
        : proposal.status === 'rejected'
          ? 'TỪ CHỐI'
          : proposal.status === 'canceled'
            ? 'ĐÃ HỦY'
            : proposal.paymentStage === 'accounting'
              ? 'CHỜ KẾ TOÁN XÁC NHẬN'
              : 'CHỜ CEO/ADMIN DUYỆT';
      const attachment = proposal.paymentFileData
        ? `<a href="${escapeHtml(proposal.paymentFileData)}" download="${escapeHtml(proposal.paymentFileName || 'bieu-mau-de-xuat')}">Tải chứng từ</a>`
        : '';
      return `<article class="payment-history-item"><div class="payment-history-heading"><strong>${state}</strong><time>${escapeHtml(proposal.date || '')}</time></div><span><b>Hạng mục:</b> ${escapeHtml(proposal.category || '')}</span><span><b>Số tiền:</b> ${Number(proposal.amount || 0).toLocaleString('vi-VN')} VNĐ</span>${proposal.rejectionReason ? `<p class="payment-history-rejection"><b>Lý do từ chối:</b> ${escapeHtml(proposal.rejectionReason)}</p>` : ''}${attachment}</article>`;
    }).join('')
    : '<p class="payment-history-empty">Chưa có đề xuất thanh toán nào trong mục này.</p>';
}

async function loadPaymentProposals() {
  const response = await fetch('/api/proposals', { cache: 'no-store' });
  if (!response.ok) return;
  const data = await response.json();
  paymentProposals = (data.proposals || [])
    .filter((proposal) => proposal.type === 'payment' && (proposal.paymentFlow || 'ceo') === paymentFlow)
    .sort((first, second) => new Date(second.createdAt || second.date) - new Date(first.createdAt || first.date));
  renderPaymentHistory();
}

async function applyTemplate(template) {
  if (!template?.fileData) return;
  const response = await fetch(template.fileData);
  if (!response.ok) throw new Error('Không thể tải file mẫu.');
  const objectUrl = URL.createObjectURL(await response.blob());
  if (currentTemplateUrl) URL.revokeObjectURL(currentTemplateUrl);
  currentTemplateUrl = objectUrl;
  currentTemplate = template;
  previewButton.disabled = false;
  downloadButton.disabled = false;
  templateActionStatus.textContent = '';
  const title = document.querySelector('[data-template-title]');
  if (title) title.textContent = template.fileName || 'Mẫu đề xuất thanh toán';
}

async function loadTemplate() {
  const response = await fetch('/api/payment-template', { cache: 'no-store' });
  if (!response.ok) throw new Error('Không thể tải file mẫu thanh toán.');
  const data = await response.json();
  await applyTemplate(data.template);
}

function closePaymentModal() {
  modal.hidden = true;
  form.reset();
  form.hidden = false;
  paymentHistory.hidden = true;
  document.querySelector('.payment-modal-card h2').textContent = `Đề xuất thanh toán (${paymentFlowLabel})`;
  status.textContent = '';
}

paymentButton.addEventListener('click', () => {
  modal.hidden = false;
  document.querySelector('.payment-modal-card h2').textContent = `Đề xuất thanh toán (${paymentFlowLabel})`;
  paymentHistory.hidden = true;
  form.hidden = false;
  form.querySelector('[name="date"]').value = new Date().toISOString().slice(0, 10);
  form.querySelector('[name="category"]').focus();
});

proposalListButton.addEventListener('click', async () => {
  modal.hidden = false;
  form.hidden = true;
  paymentHistory.hidden = false;
  status.textContent = '';
  document.querySelector('.payment-modal-card h2').textContent = 'Danh sách đề xuất thanh toán';
  try {
    await loadPaymentProposals();
  } catch (error) {
    paymentHistory.innerHTML = `<p class="payment-history-empty">${escapeHtml(error.message || 'Không thể tải danh sách đề xuất.')}</p>`;
  }
});

document.querySelector('[data-close-payment]').addEventListener('click', closePaymentModal);
modal.addEventListener('click', (event) => {
  if (event.target === modal) closePaymentModal();
});
previewButton.addEventListener('click', () => {
  if (!currentTemplateUrl) {
    templateActionStatus.textContent = 'Chưa tải được file mẫu. Hãy thử tải lại trang.';
    return;
  }
  const link = document.createElement('a');
  link.href = currentTemplateUrl;
  link.target = '_blank';
  link.rel = 'noopener';
  link.click();
});
downloadButton.addEventListener('click', () => {
  if (!currentTemplateUrl) {
    templateActionStatus.textContent = 'Chưa tải được file mẫu. Hãy thử tải lại trang.';
    return;
  }
  const link = document.createElement('a');
  link.href = currentTemplateUrl;
  link.download = currentTemplate.fileName || 'mau-de-xuat-thanh-toan';
  link.click();
  templateActionStatus.textContent = `Đang tải ${currentTemplate.fileName || 'file mẫu'}...`;
});
window.addEventListener('pagehide', () => {
  if (currentTemplateUrl) URL.revokeObjectURL(currentTemplateUrl);
});

async function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result)));
    reader.addEventListener('error', reject);
    reader.readAsDataURL(file);
  });
}

fetch('/api/me', { cache: 'no-store' }).then((response) => response.json()).then(({ user }) => {
  if (user?.role === 'admin' || user?.role === 'ceo') adminTemplateTools.hidden = false;
}).catch(() => {});

adminTemplateFile.addEventListener('change', async () => {
  const file = adminTemplateFile.files?.[0];
  if (!file) return;
  if (file.size > 7 * 1024 * 1024) {
    adminTemplateStatus.textContent = 'File không được vượt quá 7 MB.';
    adminTemplateFile.value = '';
    return;
  }
  adminTemplateStatus.textContent = 'Đang cập nhật file mẫu...';
  try {
    const response = await fetch('/api/payment-template', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName: file.name, fileType: file.type, fileData: await readFile(file) }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'Không thể cập nhật file mẫu.');
    await applyTemplate(data.template);
    adminTemplateStatus.textContent = `Đã cập nhật: ${file.name}`;
  } catch (error) {
    adminTemplateStatus.textContent = error.message;
  }
});
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  status.textContent = 'Đang gửi...';
  const payload = Object.fromEntries(new FormData(form));
  payload.type = 'payment';
  payload.paymentFlow = paymentFlow;
  const file = paymentFileInput.files?.[0];
  if (!file) {
    status.textContent = 'Vui lòng tải file biểu mẫu đề xuất.';
    return;
  }
  if (file.size > 7 * 1024 * 1024) {
    status.textContent = 'File không được vượt quá 7 MB.';
    return;
  }
  payload.paymentFileName = file.name;
  payload.paymentFileType = file.type || 'application/octet-stream';
  payload.paymentFileData = await readFile(file);
  delete payload.paymentFile;
  payload.reason = 'Đính kèm file biểu mẫu đề xuất thanh toán.';
  try {
    const response = await fetch('/api/proposals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'Không thể gửi đề xuất.');
    status.textContent = paymentFlow === 'accountant' ? 'Đã gửi đề xuất, đang chờ kế toán xác nhận.' : 'Đã gửi đề xuất, đang chờ CEO/Admin duyệt.';
    form.reset();
    await loadPaymentProposals();
  } catch (error) {
    status.textContent = error.message;
  }
});

loadTemplate().catch((error) => { templateActionStatus.textContent = error.message || 'Không thể tải file mẫu thanh toán.'; });
loadPaymentProposals().catch(() => {});
