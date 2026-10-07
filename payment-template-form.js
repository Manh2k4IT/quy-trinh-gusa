(function () {
  const department = document.createElement('label');
  department.innerHTML = 'Bộ phận<input name="paymentDepartment" maxlength="150" required placeholder="Ví dụ: Marketing">';
  form.querySelector('[name="date"]').closest('label').after(department);
  const section = document.createElement('fieldset');
  section.className = 'payment-items-section';
  section.innerHTML = '<legend>Các khoản đề nghị thanh toán</legend><div data-payment-items></div><button type="button" data-add-payment-item>+ Thêm nội dung thanh toán</button><p class="payment-total">Tổng cộng: <strong data-payment-total>0 VND</strong></p><p data-payment-words>Không đồng</p>';
  const category = form.querySelector('[name="category"]');
  const amount = form.querySelector('[name="amount"]');
  category.closest('label').before(section);
  for (const input of [category, amount]) {
    const label = input.closest('label');
    input.type = 'hidden';
    input.required = false;
    form.append(input);
    label.remove();
  }
  const bank = document.createElement('fieldset');
  bank.className = 'payment-bank-section';
  bank.innerHTML = '<legend>Thông tin chuyển khoản (nếu có)</legend><label>Tên chủ tài khoản<input name="paymentAccountName" maxlength="150" autocomplete="off"></label><label>Tài khoản thụ hưởng<input name="paymentAccountNumber" maxlength="150" inputmode="numeric" autocomplete="off"></label><label>Ngân hàng thụ hưởng<input name="paymentBankName" maxlength="150" autocomplete="off"></label>';
  form.querySelector('[name="reason"]').closest('label').before(bank);
  const reason = form.querySelector('[name="reason"]');
  reason.required = false;
  reason.placeholder = 'Ghi chú bổ sung cho người duyệt (không in trên mẫu)';
  reason.closest('label').firstChild.textContent = 'Ghi chú bổ sung (không bắt buộc)';
  const items = section.querySelector('[data-payment-items]');
  const add = section.querySelector('[data-add-payment-item]');
  function addItem() {
    const row = document.createElement('div');
    row.className = 'payment-item-input';
    row.innerHTML = '<div class="payment-item-heading"><strong></strong><button type="button" data-remove-payment-item>Xóa khoản</button></div><label>Nội dung thanh toán<textarea data-item-description maxlength="500" required placeholder="Nội dung khoản chi"></textarea></label><label>Số tiền (VND)<input data-item-amount type="number" min="1" max="999999999999999" step="1" required inputmode="numeric"></label><label>Chứng từ kèm / Diễn giải<input data-item-document maxlength="300" placeholder="Ví dụ: hóa đơn, thời gian gia hạn..."></label>';
    items.append(row);
    renumber();
    return row;
  }
  function renumber() {
    [...items.children].forEach((row, index) => {
      row.querySelector('strong').textContent = `Khoản ${index + 1}`;
      row.querySelector('[data-remove-payment-item]').disabled = items.children.length === 1;
    });
    add.disabled = items.children.length >= 50;
  }
  function fields() {
    return {
      ...Object.fromEntries(new FormData(form)),
      paymentItems: [...items.children].map((row) => ({
        description: row.querySelector('[data-item-description]').value,
        amount: row.querySelector('[data-item-amount]').value,
        document: row.querySelector('[data-item-document]').value,
      })),
    };
  }
  function update() {
    const data = window.GusaPaymentDocumentData.getData(fields(), {});
    amount.value = String(data.total);
    category.value = data.items.map((item) => item.description).join('; ').slice(0, 200);
    section.querySelector('[data-payment-total]').textContent = `${data.total.toLocaleString('vi-VN')} VND`;
    section.querySelector('[data-payment-words]').textContent = data.amountWords;
    window.syncProposalDocument?.();
  }
  add.addEventListener('click', () => {
    if (items.children.length >= 50) return;
    const row = addItem();
    update();
    row.querySelector('textarea').focus();
  });
  items.addEventListener('click', (event) => {
    const button = event.target.closest('[data-remove-payment-item]');
    if (!button || items.children.length === 1) return;
    button.closest('.payment-item-input').remove();
    renumber();
    update();
  });
  items.addEventListener('input', update);
  form.addEventListener('reset', () => {
    items.replaceChildren();
    addItem();
    setTimeout(update, 0);
  });
  window.getPaymentProposalFields = fields;
  window.validatePaymentTemplate = function () {
    try {
      window.GusaPaymentDocumentData.validate(fields());
      return true;
    } catch (error) {
      status.textContent = error.message;
      return false;
    }
  };
  addItem();
  update();
})();
