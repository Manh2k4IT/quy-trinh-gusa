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
const templatePreviewModal = document.createElement('div');
templatePreviewModal.className = 'payment-preview-modal';
templatePreviewModal.hidden = true;
templatePreviewModal.innerHTML = '<section class="payment-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="payment-preview-title"><header><div><span>BẢN XEM TRƯỚC</span><h2 id="payment-preview-title"></h2></div><button type="button" data-close-template-preview aria-label="Đóng">×</button></header><div class="payment-preview-frame-wrap" data-template-preview-frame-wrap><iframe data-template-preview-frame title="Bản xem trước file mẫu" referrerpolicy="no-referrer" sandbox="allow-same-origin"></iframe></div><div class="payment-preview-fallback" data-template-preview-fallback hidden><p>Định dạng này không xem trực tiếp được trên trình duyệt.</p><button type="button" data-template-preview-download>Tải file mẫu</button></div></section>';
document.body.append(templatePreviewModal);
const templatePreviewFrame = templatePreviewModal.querySelector('[data-template-preview-frame]');
const templatePreviewFrameWrap = templatePreviewModal.querySelector('[data-template-preview-frame-wrap]');
const templatePreviewFallback = templatePreviewModal.querySelector('[data-template-preview-fallback]');

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function setTemplateActionStatus(message, state = '') {
  templateActionStatus.textContent = message;
  templateActionStatus.classList.toggle('is-loading', state === 'loading');
  templateActionStatus.classList.toggle('is-error', state === 'error');
  templateActionStatus.classList.toggle('is-success', state === 'success');
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
      const stateClass = proposal.status === 'approved' ? 'is-approved' : proposal.status === 'rejected' ? 'is-rejected' : 'is-pending';
      const attachment = proposal.paymentFileData
        ? `<a href="${escapeHtml(proposal.paymentFileData)}" download="${escapeHtml(proposal.paymentFileName || 'bieu-mau-de-xuat')}">Tải chứng từ</a>`
        : '';
      return `<article class="payment-history-item"><div class="payment-history-heading"><strong class="${stateClass}">${state}</strong><time>${escapeHtml(proposal.date || '')}</time></div><span><b>Hạng mục:</b> ${escapeHtml(proposal.category || '')}</span><span><b>Số tiền:</b> ${Number(proposal.amount || 0).toLocaleString('vi-VN')} VNĐ</span>${proposal.rejectionReason ? `<p class="payment-history-rejection"><b>Lý do từ chối:</b> ${escapeHtml(proposal.rejectionReason)}</p>` : ''}${attachment}</article>`;
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

const previewLibraryPromises = new Map();

function loadPreviewLibrary(globalName, source) {
  if (window[globalName]) return Promise.resolve(window[globalName]);
  if (!previewLibraryPromises.has(globalName)) {
    previewLibraryPromises.set(globalName, new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = source;
      script.async = true;
      script.onload = () => window[globalName] ? resolve(window[globalName]) : reject(new Error('Không tải được công cụ xem trước.'));
      script.onerror = () => reject(new Error('Không tải được công cụ xem trước.'));
      document.head.append(script);
    }));
  }
  return previewLibraryPromises.get(globalName);
}

function templatePreviewKind(template) {
  const type = String(template.fileType || '').toLowerCase();
  const extension = String(template.fileName || '').split('.').pop().toLowerCase();
  if (type === 'application/pdf' || extension === 'pdf') return 'browser';
  if (type === 'text/html' || ['html', 'htm', 'txt'].includes(extension) || type.startsWith('image/')) return 'browser';
  if (extension === 'docx' || type.includes('wordprocessingml')) return 'docx';
  if (['xls', 'xlsx'].includes(extension) || type.includes('spreadsheetml') || type.includes('ms-excel')) return 'spreadsheet';
  return '';
}

function previewDocumentHtml(content) {
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0 auto;padding:36px 28px;max-width:820px;background:#fff;color:#243142;font:15px/1.65 'Segoe UI',sans-serif}h1,h2,h3{color:#173f78;line-height:1.3}table{width:100%;border-collapse:collapse;margin:1rem 0;font-size:13px}th,td{border:1px solid #d6e0ea;padding:7px 9px;text-align:left;vertical-align:top}th{background:#eef4fa;color:#173f78}img{max-width:100%;height:auto}@media(max-width:600px){body{padding:18px 14px}table{font-size:12px}}</style></head><body>${content}</body></html>`;
}

function sanitizeWordPreview(html) {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  parsed.querySelectorAll('script,iframe,object,embed,form,link,meta,style').forEach((element) => element.remove());
  parsed.body.querySelectorAll('*').forEach((element) => {
    [...element.attributes].forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      if (name.startsWith('on') || !['class', 'href', 'src', 'alt', 'title', 'colspan', 'rowspan'].includes(name)) {
        element.removeAttribute(attribute.name);
      } else if (name === 'href' && !/^https?:|^mailto:/i.test(attribute.value)) {
        element.removeAttribute(attribute.name);
      } else if (name === 'src' && !/^data:image\//i.test(attribute.value)) {
        element.removeAttribute(attribute.name);
      }
    });
  });
  return parsed.body.innerHTML;
}

async function renderSpreadsheetPreview(arrayBuffer, XLSX) {
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const documentFragment = document.createElement('div');
  workbook.SheetNames.forEach((sheetName) => {
    const section = document.createElement('section');
    const heading = document.createElement('h2');
    heading.textContent = sheetName;
    const table = document.createElement('table');
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '' });
    const displayedRows = rows.slice(0, 500);
    displayedRows.forEach((row, rowIndex) => {
      const tableRow = document.createElement('tr');
      row.slice(0, 32).forEach((cell) => {
        const cellElement = document.createElement(rowIndex === 0 ? 'th' : 'td');
        cellElement.textContent = String(cell ?? '');
        tableRow.append(cellElement);
      });
      table.append(tableRow);
    });
    section.append(heading, table);
    if (rows.length > displayedRows.length) {
      const note = document.createElement('p');
      note.textContent = 'Bản xem trước giới hạn 500 dòng.';
      section.append(note);
    }
    documentFragment.append(section);
  });
  return previewDocumentHtml(documentFragment.innerHTML);
}

async function openTemplatePreview() {
  if (!currentTemplateUrl) {
    setTemplateActionStatus('Chưa tải được file mẫu. Hãy thử tải lại trang.', 'error');
    return;
  }
  templatePreviewModal.querySelector('#payment-preview-title').textContent = currentTemplate.fileName || 'Mẫu đề xuất thanh toán';
  const previewKind = templatePreviewKind(currentTemplate);
  const supported = Boolean(previewKind);
  templatePreviewFrameWrap.hidden = !supported;
  templatePreviewFallback.hidden = supported;
  templatePreviewModal.hidden = false;
  if (!supported) {
    templatePreviewFallback.querySelector('p').textContent = `Chưa hỗ trợ xem trước định dạng .${String(currentTemplate.fileName || '').split('.').pop()}. Bạn vẫn có thể tải file mẫu.`;
    setTemplateActionStatus('Định dạng này không xem trực tiếp được.', 'error');
    return;
  }
  setTemplateActionStatus('Đang mở bản xem trước...', 'loading');
  templatePreviewFrame.onload = () => {
    if (!templatePreviewModal.hidden) setTemplateActionStatus('Bản xem trước đã sẵn sàng.', 'success');
  };
  try {
    if (previewKind === 'docx') {
      const mammoth = await loadPreviewLibrary('mammoth', 'https://cdn.jsdelivr.net/npm/mammoth@1.9.0/mammoth.browser.min.js');
      const arrayBuffer = await (await fetch(currentTemplateUrl)).arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer });
      templatePreviewFrame.srcdoc = previewDocumentHtml(sanitizeWordPreview(result.value));
    } else if (previewKind === 'spreadsheet') {
      const XLSX = await loadPreviewLibrary('XLSX', 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js');
      const arrayBuffer = await (await fetch(currentTemplateUrl)).arrayBuffer();
      templatePreviewFrame.srcdoc = await renderSpreadsheetPreview(arrayBuffer, XLSX);
    } else {
      templatePreviewFrame.src = currentTemplateUrl;
    }
  } catch (error) {
    templatePreviewFrameWrap.hidden = true;
    templatePreviewFallback.hidden = false;
    templatePreviewFallback.querySelector('p').textContent = error.message || 'Không thể tạo bản xem trước. Bạn vẫn có thể tải file.';
    setTemplateActionStatus('Không thể tạo bản xem trước; hãy tải file để mở bằng ứng dụng phù hợp.', 'error');
  }
}

function closeTemplatePreview() {
  templatePreviewModal.hidden = true;
  templatePreviewFrame.src = 'about:blank';
  previewButton.focus();
}

async function downloadTemplate() {
  if (!currentTemplateUrl) {
    setTemplateActionStatus('Chưa tải được file mẫu. Hãy thử tải lại trang.', 'error');
    return;
  }
  downloadButton.disabled = true;
  setTemplateActionStatus('Đang chuẩn bị tải file mẫu...', 'loading');
  try {
    if (window.Capacitor?.isNativePlatform?.()) {
      const link = document.createElement('a');
      link.href = '/api/payment-template/download';
      link.rel = 'noopener';
      document.body.append(link);
      link.click();
      link.remove();
      setTemplateActionStatus('Đã bắt đầu tải. Theo dõi tiến trình trong thông báo điện thoại.', 'success');
      return;
    }
    const response = await fetch(currentTemplateUrl);
    if (!response.ok) throw new Error('Không thể tải file mẫu.');
    const blobUrl = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = currentTemplate.fileName || 'mau-de-xuat-thanh-toan';
    document.body.append(link);
    link.click();
    link.remove();
    setTemplateActionStatus('Đã tải file mẫu hoàn tất.', 'success');
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  } catch (error) {
    setTemplateActionStatus(error.message || 'Không thể tải file mẫu.', 'error');
  } finally {
    downloadButton.disabled = false;
  }
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
previewButton.addEventListener('click', openTemplatePreview);
downloadButton.addEventListener('click', downloadTemplate);
templatePreviewModal.querySelector('[data-close-template-preview]').addEventListener('click', closeTemplatePreview);
templatePreviewModal.querySelector('[data-template-preview-download]').addEventListener('click', downloadTemplate);
templatePreviewModal.addEventListener('click', (event) => {
  if (event.target === templatePreviewModal) closeTemplatePreview();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !templatePreviewModal.hidden) closeTemplatePreview();
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
    form.reset();
    closePaymentModal();
    window.showProposalSuccessToast?.();
    loadPaymentProposals().catch(() => {});
  } catch (error) {
    status.textContent = error.message;
  }
});

loadTemplate().catch((error) => { templateActionStatus.textContent = error.message || 'Không thể tải file mẫu thanh toán.'; });
loadPaymentProposals().catch(() => {});
