(function (root) {
  const digits = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
  function readGroup(value, full) {
    const hundreds = Math.floor(value / 100);
    const tens = Math.floor(value / 10) % 10;
    const units = value % 10;
    const words = [];
    if (hundreds || full) words.push(digits[hundreds], 'trăm');
    if (tens > 1) words.push(digits[tens], 'mươi');
    else if (tens === 1) words.push('mười');
    else if (units && (hundreds || full)) words.push('lẻ');
    if (units) words.push(units === 1 && tens > 1 ? 'mốt' : units === 5 && tens ? 'lăm' : digits[units]);
    return words.join(' ');
  }
  function moneyInWords(amount) {
    if (!Number.isSafeInteger(amount) || amount < 0 || amount > 999999999999999) throw new Error('Số tiền phải là số nguyên VNĐ hợp lệ.');
    if (amount === 0) return 'Không đồng';
    const groups = [];
    let remaining = amount;
    while (remaining) { groups.push(remaining % 1000); remaining = Math.floor(remaining / 1000); }
    const units = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ'];
    const words = [];
    for (let index = groups.length - 1; index >= 0; index--) {
      if (groups[index]) words.push(readGroup(groups[index], index < groups.length - 1), units[index]);
    }
    const result = `${words.filter(Boolean).join(' ')} đồng`;
    return result.charAt(0).toUpperCase() + result.slice(1);
  }
  function validate(fields) {
    const department = String(fields.paymentDepartment || '').trim();
    if (!department || department.length > 150) throw new Error('Vui lòng nhập bộ phận (tối đa 150 ký tự).');
    if (!Array.isArray(fields.paymentItems) || !fields.paymentItems.length || fields.paymentItems.length > 50) throw new Error('Đơn cần có từ 1 đến 50 khoản thanh toán.');
    const items = fields.paymentItems.map((item, index) => {
      if (!item || typeof item !== 'object') throw new Error(`Khoản ${index + 1} không hợp lệ.`);
      const description = String(item.description || '').trim();
      const document = String(item.document || '').trim();
      const textAmount = String(item.amount ?? '').trim();
      const amount = Number(textAmount);
      if (!description || description.length > 500 || document.length > 300 || !/^\d+$/.test(textAmount) || !Number.isSafeInteger(amount) || amount <= 0) throw new Error(`Khoản ${index + 1}: nhập nội dung và số tiền nguyên VNĐ lớn hơn 0; nội dung tối đa 500, chứng từ tối đa 300 ký tự.`);
      return { description, amount, document };
    });
    const total = items.reduce((sum, item) => sum + item.amount, 0);
    moneyInWords(total);
    const bank = {};
    for (const key of ['paymentAccountName', 'paymentAccountNumber', 'paymentBankName']) {
      bank[key] = String(fields[key] || '').trim();
      if (bank[key].length > 150) throw new Error('Thông tin chuyển khoản tối đa 150 ký tự mỗi ô.');
    }
    if (Object.values(bank).some(Boolean) && !Object.values(bank).every(Boolean)) throw new Error('Vui lòng nhập đủ chủ tài khoản, tài khoản thụ hưởng và ngân hàng, hoặc để trống cả ba ô.');
    return { paymentTemplateVersion: 1, paymentDepartment: department, paymentItems: items, ...bank, category: items.map((item) => item.description).join('; ').slice(0, 200), amount: String(total) };
  }
  function getData(fields, employee) {
    const items = Array.isArray(fields.paymentItems) ? fields.paymentItems : [{ description: fields.category || '', amount: fields.amount || '', document: fields.paymentFileName || '' }];
    const total = items.reduce((sum, item) => sum + (Number.isFinite(Number(item.amount)) ? Number(item.amount) : 0), 0);
    return {
      title: 'GIẤY ĐỀ NGHỊ THANH TOÁN',
      name: String(fields.signatureName || employee.name || '').trim(),
      department: fields.paymentDepartment || '',
      date: fields.date || '',
      items,
      total,
      amountWords: Number.isSafeInteger(total) && total >= 0 && total <= 999999999999999 ? moneyInWords(total) : 'Số tiền chưa hợp lệ',
      accountName: fields.paymentAccountName || '',
      accountNumber: fields.paymentAccountNumber || '',
      bankName: fields.paymentBankName || '',
      signatureData: fields.signatureData || '',
      signatureName: fields.signatureName || '',
      saved: fields.saved,
    };
  }
  const api = { moneyInWords, validate, getData };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GusaPaymentDocumentData = api;
})(typeof window !== 'undefined' ? window : globalThis);
