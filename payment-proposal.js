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
const paymentReview = document.querySelector('[data-payment-review]');
const cancelButton = document.querySelector('[data-cancel-payment]');
const cancelMainButton = document.querySelector('[data-cancel-payment-main]');
let currentTemplate = { fileName: 'payment-template.html', fileData: 'payment-template.html' };
let currentProposal = null;

function isPastProposalDate(proposal) {
  return proposal.date < new Date().toISOString().slice(0, 10);
}

function setPaymentButton(proposal) {
  currentProposal = proposal && proposal.status !== 'canceled' && !(proposal.status === 'pending' && isPastProposalDate(proposal)) ? proposal : null;
  paymentButton.classList.remove('is-approved', 'is-rejected', 'is-pending');
  paymentButton.disabled = false;
  cancelMainButton.hidden = true;
  if (!currentProposal) {
    paymentButton.textContent = 'ĐỀ XUẤT';
  } else if (currentProposal.status === 'approved') {
    paymentButton.textContent = 'ĐÃ DUYỆT';
    paymentButton.classList.add('is-approved');
  } else if (currentProposal.status === 'rejected') {
    paymentButton.textContent = 'TỪ CHỐI';
    paymentButton.classList.add('is-rejected');
  } else {
    paymentButton.textContent = 'XEM LẠI ĐỀ XUẤT';
    paymentButton.classList.add('is-pending');
    cancelMainButton.hidden = false;
  }
}

async function loadPaymentProposal() {
  const response = await fetch('/api/proposals', { cache: 'no-store' });
  if (!response.ok) return;
  const data = await response.json();
  setPaymentButton((data.proposals || []).find((proposal) => proposal.type === 'payment'));
}

function applyTemplate(template) {
  if (!template?.fileData) return;
  currentTemplate = template;
  const title = document.querySelector('[data-template-title]');
  if (title) title.textContent = template.fileName || 'Mẫu đề xuất thanh toán';
}

async function loadTemplate() {
  const response = await fetch('/api/payment-template', { cache: 'no-store' });
  if (!response.ok) return;
  const data = await response.json();
  applyTemplate(data.template);
}

function closePaymentModal() {
  modal.hidden = true;
  form.reset();
  form.hidden = false;
  paymentReview.hidden = true;
  cancelButton.hidden = true;
  status.textContent = '';
}

paymentButton.addEventListener('click', () => {
  modal.hidden = false;
  if (currentProposal) {
    form.hidden = true;
    paymentReview.hidden = false;
    paymentReview.className = `payment-review is-${currentProposal.status}`;
    const state = currentProposal.status === 'approved' ? 'ĐÃ DUYỆT' : currentProposal.status === 'rejected' ? 'TỪ CHỐI' : 'ĐANG CHỜ DUYỆT';
    paymentReview.innerHTML = `<strong>${state}</strong><span>Ngày đề xuất: ${currentProposal.date}</span><span>Hạng mục: ${currentProposal.category}</span><span>Số tiền: ${Number(currentProposal.amount).toLocaleString('vi-VN')} VNĐ</span><a href="${currentProposal.paymentFileData}" download="${currentProposal.paymentFileName || 'bieu-mau-de-xuat'}">Tải lại file đã gửi</a>`;
    cancelButton.hidden = currentProposal.status !== 'pending';
    return;
  }
  form.hidden = false;
  paymentReview.hidden = true;
  cancelButton.hidden = true;
  form.querySelector('[name="date"]').value = new Date().toISOString().slice(0, 10);
  form.querySelector('[name="category"]').focus();
});

async function cancelCurrentProposal(button) {
  if (!currentProposal || currentProposal.status !== 'pending') return;
  button.disabled = true;
  button.textContent = 'ĐANG HỦY...';
  try {
    const response = await fetch(`/api/proposals/${encodeURIComponent(currentProposal.id)}/cancel`, { method: 'POST' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'Không thể hủy đề xuất.');
    status.textContent = 'Đã hủy đề xuất.';
    setPaymentButton(null);
    closePaymentModal();
  } catch (error) {
    status.textContent = error.message;
    button.disabled = false;
    button.textContent = 'HỦY ĐỀ XUẤT';
  }
}

cancelButton.addEventListener('click', () => cancelCurrentProposal(cancelButton));
cancelMainButton.addEventListener('click', () => cancelCurrentProposal(cancelMainButton));
document.querySelector('[data-close-payment]').addEventListener('click', closePaymentModal);
modal.addEventListener('click', (event) => {
  if (event.target === modal) closePaymentModal();
});
previewButton.addEventListener('click', () => {
  window.open(currentTemplate.fileData, '_blank', 'noopener');
});
downloadButton.addEventListener('click', () => {
  const link = document.createElement('a');
  link.href = currentTemplate.fileData;
  link.download = currentTemplate.fileName || 'mau-de-xuat-thanh-toan';
  link.click();
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
  if (user?.role === 'admin') adminTemplateTools.hidden = false;
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
    applyTemplate(data.template);
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
    status.textContent = 'Đã gửi đề xuất, đang chờ duyệt.';
    form.reset();
    await loadPaymentProposal();
  } catch (error) {
    status.textContent = error.message;
  }
});

loadTemplate().catch(() => {});
loadPaymentProposal().catch(() => {});
