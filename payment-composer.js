(function () {
  const flowSelector = document.createElement('nav');
  flowSelector.className = 'payment-routing';
  flowSelector.setAttribute('aria-label', 'Chọn luồng thanh toán');
  for (const [flow, label, description] of [
    ['ceo', 'Gửi CEO', 'CEO duyệt, sau đó Kế toán xác nhận thanh toán.'],
    ['accountant', 'Gửi Kế toán', 'Chuyển trực tiếp đến Kế toán để xác nhận.'],
  ]) {
    const link = document.createElement('a');
    link.href = `payment-proposal.html?flow=${flow}`;
    link.innerHTML = `<strong>${label}</strong><span>${description}</span>`;
    if (paymentFlow === flow) link.setAttribute('aria-current', 'page');
    flowSelector.append(link);
  }
  document.querySelector('.payment-ribbon').after(flowSelector);
  const templates = document.createElement('details');
  templates.className = 'payment-reference-templates';
  const summary = document.createElement('summary');
  summary.textContent = 'Biểu mẫu tham khảo & chứng từ';
  templates.append(summary, document.querySelector('.payment-template'));
  document.querySelector('.payment-page').append(templates);
  const noteTitle = document.querySelector('.payment-note h1');
  noteTitle.textContent = 'Điền đơn và ký trực tiếp';
  const steps = document.querySelector('.payment-note ul');
  steps.replaceChildren();
  for (const text of ['Chọn đúng luồng CEO hoặc Kế toán ở phía trên.', 'Điền mẫu 05-TT: bộ phận, các khoản chi, thông tin chuyển khoản và họ tên.', 'Tổng tiền và tiền bằng chữ được tính tự động.', 'Ký tay, kiểm tra bản xem trước rồi gửi duyệt; chứng từ đính kèm không bắt buộc.']) {
    const li = document.createElement('li');
    li.textContent = text;
    steps.append(li);
  }
  paymentButton.textContent = 'Tạo đơn & ký tên';
  proposalListButton.textContent = 'Xem danh sách';
  const card = document.querySelector('.payment-modal-card');
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');
  card.querySelector('h2').id = 'payment-composer-title';
  card.setAttribute('aria-labelledby', 'payment-composer-title');
  const composer = document.createElement('div');
  composer.className = 'payment-composer';
  form.before(composer);
  composer.append(form);
  const preview = document.createElement('section');
  preview.className = 'proposal-document-preview';
  preview.innerHTML = '<header><div><span>BẢN XEM TRƯỚC</span><h3>Đơn đề nghị thanh toán</h3></div><button type="button" data-print-payment>In / Lưu PDF</button></header><p data-payment-route-note></p><iframe title="Đơn thanh toán tự điền" sandbox="allow-same-origin allow-modals"></iframe><p data-payment-document-status role="status"></p><button type="button" class="payment-edit-document">Quay lại chỉnh sửa</button>';
  preview.querySelector('[data-payment-route-note]').textContent = paymentFlow === 'accountant' ? 'Đơn gửi trực tiếp Kế toán xác nhận.' : 'Đơn gửi CEO duyệt → Kế toán xác nhận.';
  composer.append(preview);
  const tabs = document.createElement('nav');
  tabs.className = 'payment-composer-tabs';
  tabs.setAttribute('aria-label', 'Soạn đơn thanh toán');
  tabs.innerHTML = '<button type="button" data-payment-view="form">Nhập & ký tên</button><button type="button" data-payment-view="preview">Xem trước đơn</button>';
  composer.before(tabs);
  function setView(view) {
    composer.dataset.view = view;
    tabs.querySelectorAll('button').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.paymentView === view)));
    composer.scrollTop = 0;
  }
  setView('form');
  tabs.addEventListener('click', (event) => {
    const button = event.target.closest('[data-payment-view]');
    if (button) setView(button.dataset.paymentView);
  });
  preview.querySelector('.payment-edit-document').addEventListener('click', () => setView('form'));
  paymentButton.addEventListener('click', () => setView('form'));
  const frame = preview.querySelector('iframe');
  const print = preview.querySelector('[data-print-payment]');
  const message = preview.querySelector('[data-payment-document-status]');
  let employee = null;
  let html = '';
  frame.addEventListener('load', () => { print.disabled = !employee; });
  window.syncProposalDocument = function () {
    composer.hidden = form.hidden;
    tabs.hidden = form.hidden;
    card.classList.toggle('is-payment-composing', !form.hidden);
    if (form.hidden || modal.hidden) return;
    const fields = { ...window.getPaymentProposalFields(), type: 'payment', paymentFlow };
    const next = window.GusaProposalDocument.render(fields, { name: employee || '' });
    if (html === next) return;
    html = next;
    print.disabled = true;
    frame.srcdoc = next;
  };
  form.addEventListener('input', window.syncProposalDocument);
  form.addEventListener('change', window.syncProposalDocument);
  print.addEventListener('click', () => {
    if (!form.checkValidity()) { setView('form'); form.reportValidity(); return; }
    if (!window.validatePaymentTemplate()) { setView('form'); return; }
    if (!window.validateProposalSignature()) { setView('form'); return; }
    try {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    } catch (error) {
      console.error('Không in được đơn thanh toán.', error);
      message.textContent = 'Không mở được cửa sổ in. Hãy dùng trình duyệt hỗ trợ in hoặc tải PDF từ danh sách sau khi gửi.';
    }
  });
  fetch('/api/me', { cache: 'no-store' }).then(async (response) => {
    if (!response.ok) throw new Error('Không tải được thông tin người đề xuất.');
    const data = await response.json();
    if (!data.user?.name) throw new Error('Tài khoản chưa có họ tên.');
    employee = data.user.name;
    window.syncProposalDocument();
  }).catch((error) => { message.textContent = error.message; });
  window.syncProposalDocument();
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal.hidden && !document.querySelector('.saved-document-modal:not([hidden])')) closePaymentModal();
  });
})();
