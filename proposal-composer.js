const composer = document.createElement('div');
modalTitle.id = 'proposal-composer-title';
modal.querySelector('.proposal-modal-card').setAttribute('role', 'dialog');
modal.querySelector('.proposal-modal-card').setAttribute('aria-modal', 'true');
modal.querySelector('.proposal-modal-card').setAttribute('aria-labelledby', modalTitle.id);
document.querySelectorAll('.proposal-new-button').forEach((button) => { button.textContent = 'Tạo đề xuất'; });
document.querySelectorAll('.proposal-cta').forEach((button) => { button.textContent = 'Xem danh sách'; });
const categories = {
  late: { title: 'Đi trễ', description: 'Đăng ký giờ đến công ty muộn hơn giờ làm quy định.', icon: '<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>' },
  'early-leave': { title: 'Về sớm', description: 'Xin kết thúc ca làm sớm và ghi rõ thời gian dự kiến.', icon: '<path d="M14 5h5v14h-5M4 12h11m-4-4 4 4-4 4"/>' },
  'half-day': { title: 'Làm nửa ngày', description: 'Chọn làm buổi sáng hoặc buổi chiều trong ngày.', icon: '<circle cx="12" cy="12" r="8"/><path d="M12 4v16M12 8h5M12 12h7M12 16h5"/>' },
  leave: { title: 'Nghỉ phép', description: 'Đăng ký nghỉ một ngày hoặc nhiều ngày liên tiếp.', icon: '<rect x="4" y="6" width="16" height="14" rx="2"/><path d="M8 3v6m8-6v6M4 11h16m-12 4 2 2 4-4"/>' },
  'unauthorized-leave': { title: 'Nghỉ không phép', description: 'Giải trình lý do khi không thể đăng ký nghỉ phép.', icon: '<path d="m12 3 10 17H2L12 3Zm0 6v4m0 3v1"/>' },
};
document.querySelectorAll('.proposal-hero').forEach((card) => {
  const category = categories[card.querySelector('[data-open-proposal]').dataset.openProposal];
  const heading = card.querySelector('.proposal-ribbon');
  heading.textContent = category.title;
  const icon = document.createElement('span');
  icon.className = 'proposal-category-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${category.icon}</svg>`;
  heading.prepend(icon);
  heading.setAttribute('role', 'heading');
  heading.setAttribute('aria-level', '2');
  const description = document.createElement('p');
  description.className = 'proposal-category-description';
  description.textContent = category.description;
  heading.after(description);
  const note = card.querySelector('.proposal-note');
  const guidance = document.createElement('details');
  guidance.className = 'proposal-category-guidance';
  const summary = document.createElement('summary');
  summary.textContent = 'Hướng dẫn & lưu ý';
  note.before(guidance);
  guidance.append(summary, note);
  const createButton = card.querySelector('.proposal-new-button');
  card.querySelector('.proposal-card-actions').prepend(createButton);
  createButton.setAttribute('aria-label', `Tạo đề xuất ${category.title.toLowerCase()}`);
  card.querySelector('.proposal-cta').setAttribute('aria-label', `Xem danh sách ${category.title.toLowerCase()}`);
});
composer.className = 'proposal-composer';
form.before(composer);
composer.append(form);
const preview = document.createElement('section');
preview.className = 'proposal-document-preview';
preview.innerHTML = '<header><div><span>BẢN XEM TRƯỚC</span><h3>Đơn của bạn</h3></div><button type="button" data-print-proposal>In / Lưu PDF</button></header><p>Thông tin tự cập nhật khi bạn nhập. Khi in, bỏ chọn “Đầu trang và chân trang” trong phần cài đặt khác để bỏ tên trang và địa chỉ web. Chọn “Lưu dưới dạng PDF” để lưu file.</p><iframe title="Bản xem trước đơn đề xuất" sandbox="allow-same-origin allow-modals"></iframe><p data-document-status role="status"></p>';
composer.append(preview);
const composerTabs = document.createElement('nav');
composerTabs.className = 'proposal-composer-tabs';
composerTabs.setAttribute('aria-label', 'Chế độ soạn đề xuất');
composerTabs.innerHTML = '<button type="button" aria-pressed="true" data-composer-view="form">Nhập thông tin</button><button type="button" aria-pressed="false" data-composer-view="preview">Xem trước đơn</button>';
composer.before(composerTabs);
function setComposerView(view) {
  composer.dataset.view = view;
  composerTabs.querySelectorAll('button').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.composerView === view));
  });
  composer.scrollTop = 0;
}
setComposerView('form');
composerTabs.addEventListener('click', (event) => {
  const button = event.target.closest('[data-composer-view]');
  if (button) setComposerView(button.dataset.composerView);
});
const editDocumentButton = document.createElement('button');
editDocumentButton.type = 'button';
editDocumentButton.className = 'proposal-document-edit';
editDocumentButton.textContent = 'Quay lại chỉnh sửa';
preview.append(editDocumentButton);
editDocumentButton.addEventListener('click', () => setComposerView('form'));
document.querySelectorAll('[data-open-proposal]').forEach((button) => {
  button.addEventListener('click', () => setComposerView('form'));
});
const documentFrame = preview.querySelector('iframe');
const documentStatus = preview.querySelector('[data-document-status]');
const printButton = preview.querySelector('[data-print-proposal]');
let documentEmployee = { name: '' };
let documentReady = false;
let renderedDocument = '';
documentFrame.addEventListener('load', () => {
  documentReady = true;
  printButton.disabled = !documentEmployee.name;
});
window.syncProposalDocument = function () {
  composer.hidden = form.hidden;
  composerTabs.hidden = form.hidden;
  modal.querySelector('.proposal-modal-card').classList.toggle('is-composing', !form.hidden);
  if (form.hidden || modal.hidden) return;
  const fields = Object.fromEntries(new FormData(form));
  dateToInput.setCustomValidity(['leave', 'unauthorized-leave'].includes(fields.type) && fields.duration === 'multiple' && fields.dateFrom && fields.dateTo && fields.dateTo < fields.dateFrom
    ? 'Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.' : '');
  const nextDocument = window.GusaProposalDocument.render(fields, documentEmployee);
  if (nextDocument === renderedDocument) return;
  renderedDocument = nextDocument;
  documentReady = false;
  printButton.disabled = true;
  documentFrame.srcdoc = nextDocument;
};
form.addEventListener('input', window.syncProposalDocument);
form.addEventListener('change', window.syncProposalDocument);
printButton.addEventListener('click', () => {
  if (!form.checkValidity()) {
    setComposerView('form');
    form.reportValidity();
    return;
  }
  if (!documentReady || !documentEmployee.name) {
    documentStatus.textContent = 'Bản xem trước chưa sẵn sàng. Vui lòng thử lại.';
    return;
  }
  try {
    documentFrame.contentWindow.focus();
    documentFrame.contentWindow.print();
  } catch (error) {
    console.error('Không mở được cửa sổ in đề xuất.', error);
    documentStatus.textContent = 'Không mở được cửa sổ in trên thiết bị này. Hãy thử bằng trình duyệt có hỗ trợ in / lưu PDF.';
  }
});
async function loadDocumentEmployee() {
  try {
    const response = await fetch('/api/me', { cache: 'no-store' });
    if (!response.ok) throw new Error('Không tải được thông tin tài khoản để điền đơn.');
    const { user } = await response.json();
    if (!user?.name) throw new Error('Tài khoản chưa có họ tên để điền đơn.');
    documentEmployee = { name: user.name };
    window.syncProposalDocument();
  } catch (error) {
    documentStatus.textContent = error.message;
    printButton.disabled = true;
  }
}
loadDocumentEmployee();
window.syncProposalDocument();
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !modal.hidden && locationPermissionModal.hidden) closeModal();
});
