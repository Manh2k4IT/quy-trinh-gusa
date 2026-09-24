const modal = document.querySelector('[data-payment-modal]');
const form = document.querySelector('[data-payment-form]');
const status = document.querySelector('[data-payment-status]');
const paymentFileInput = form.querySelector('[name="paymentFile"]');

function closePaymentModal() {
  modal.hidden = true;
  form.reset();
  status.textContent = '';
}

document.querySelector('[data-open-payment]').addEventListener('click', () => {
  modal.hidden = false;
  form.querySelector('[name="date"]').value = new Date().toISOString().slice(0, 10);
  form.querySelector('[name="category"]').focus();
});
document.querySelector('[data-close-payment]').addEventListener('click', closePaymentModal);
modal.addEventListener('click', (event) => {
  if (event.target === modal) closePaymentModal();
});
document.querySelector('[data-preview-template]').addEventListener('click', () => {
  window.open('payment-template.html', '_blank', 'noopener');
});
document.querySelector('[data-download-template]').addEventListener('click', () => {
  const link = document.createElement('a');
  link.href = 'payment-template.html';
  link.download = 'mau-de-xuat-thanh-toan.html';
  link.click();
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
  payload.paymentFileData = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result)));
    reader.addEventListener('error', reject);
    reader.readAsDataURL(file);
  });
  delete payload.paymentFile;
  payload.reason = 'Đính kèm file biểu mẫu đề xuất thanh toán.';
  try {
    const response = await fetch('/api/proposals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'Không thể gửi đề xuất.');
    status.textContent = 'Đã gửi đề xuất, đang chờ duyệt.';
    form.reset();
  } catch (error) {
    status.textContent = error.message;
  }
});
