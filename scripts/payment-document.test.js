const test = require('node:test');
const assert = require('node:assert/strict');
const { validate, getData, moneyInWords } = require('../payment-document-data');
const { render } = require('../proposal-document');
const { createProposalPdf } = require('../proposal-document-pdf');
const fields = {
  type: 'payment', date: '2026-09-21', paymentDepartment: 'Marketing', signatureName: 'Nguyễn Văn A',
  paymentItems: [{ description: 'Phần mềm quản lý nội bộ', amount: '1014000', document: 'Gia hạn tháng 9' }],
  paymentAccountName: 'Nguyễn Văn A', paymentAccountNumber: '0012345678', paymentBankName: 'Ngân hàng A',
};
test('Vietnamese money words handle zeros and special digit forms exactly', () => {
  for (const [value, words] of [
    [0, 'Không đồng'], [15, 'Mười lăm đồng'], [21, 'Hai mươi mốt đồng'], [105, 'Một trăm lẻ năm đồng'],
    [1005, 'Một nghìn không trăm lẻ năm đồng'], [1014000, 'Một triệu không trăm mười bốn nghìn đồng'],
    [1000000001, 'Một tỷ không trăm lẻ một đồng'], [1000000000000, 'Một nghìn tỷ đồng'],
  ]) assert.equal(moneyInWords(value), words);
  for (const value of [-1, 1.5, Infinity, 1000000000000000]) assert.throws(() => moneyInWords(value));
});
test('template fields calculate totals and validate every row and optional bank data', () => {
  const result = validate({ ...fields, amount: '1', paymentItems: [...fields.paymentItems, { description: 'Vận chuyển', amount: '25000', document: '' }] });
  assert.equal(result.amount, '1039000');
  assert.equal(result.paymentAccountNumber, '0012345678');
  assert.equal(result.paymentItems[0].amount, 1014000);
  assert.equal(validate({ ...fields, paymentAccountName: '', paymentAccountNumber: '', paymentBankName: '' }).paymentBankName, '');
  for (const invalid of [
    { paymentDepartment: '' }, { paymentItems: [] }, { paymentItems: null },
    { paymentItems: [{ description: '', amount: 1 }] }, { paymentItems: [{ description: 'A', amount: '1.5' }] },
    { paymentItems: [{ description: 'A', amount: '-1' }] }, { paymentItems: [{ description: 'A', amount: '0' }] },
    { paymentAccountName: '' }, { paymentItems: Array(51).fill(fields.paymentItems[0]) },
    { paymentItems: [{ description: 'A', amount: 999999999999999 }, { description: 'B', amount: 1 }] },
  ]) assert.throws(() => validate({ ...fields, ...invalid }));
});
test('HTML follows 05-TT sections, actual item count and three signature columns', () => {
  const html = render({ ...fields, saved: true }, { name: 'Tên tài khoản khác' });
  for (const text of ['Mẫu số: 05-TT', 'Thông tư 200/2014/TT-BTC', 'GIẤY ĐỀ NGHỊ THANH TOÁN', 'Ngày 21 tháng 9 năm 2026', 'Marketing', '1.014.000 VND', 'Một triệu không trăm mười bốn nghìn đồng', '0012345678', 'Ngân hàng A', 'Kế toán trưởng', 'Giám Đốc']) assert.ok(html.includes(text), text);
  assert.ok(html.includes('Họ và tên người đề nghị thanh toán: Nguyễn Văn A'));
  assert.equal((html.match(/<tr><td>\d+<\/td>/g) || []).length, 1);
  assert.ok(!html.includes('BẢN NHÁP'));
  assert.ok(!html.includes('Bộ phận quản lý nhân sự'));
  assert.ok(render({ ...fields, paymentItems: [{ description: '<script>alert(1)</script>', amount: 10, document: '<img>' }] }, {}).includes('&lt;script&gt;'));
  assert.equal(getData({ category: 'Đơn cũ', amount: '100', paymentFileName: 'old.pdf' }, { name: 'A' }).items[0].description, 'Đơn cũ');
});
test('HTML and PDF tables have exactly one row per payment item', () => {
  const PDFDocument = require('pdfkit');
  const { writePaymentDocument } = require('../payment-document-pdf');
  for (const count of [1, 2, 7]) {
    const proposal = { ...fields, paymentItems: Array.from({ length: count }, (_, i) => ({ description: `Khoản ${i + 1}`, amount: 100, document: '' })) };
    for (const saved of [false, true]) {
      const html = render({ ...proposal, saved }, {});
      assert.equal((html.match(/<tr><td>\d+<\/td>/g) || []).length, count);
      assert.ok(!html.includes('BẢN NHÁP'));
    }
    const doc = new PDFDocument({ size: 'A4', margin: 51 });
    doc.registerFont('Regular', require.resolve('dejavu-fonts-ttf/ttf/DejaVuSerif.ttf'));
    doc.registerFont('Bold', require.resolve('dejavu-fonts-ttf/ttf/DejaVuSerif-Bold.ttf'));
    let cells = 0;
    const rect = doc.rect;
    doc.rect = function (...args) { cells++; return rect.apply(this, args); };
    writePaymentDocument(doc, proposal);
    assert.equal(cells, 4 + count * 4 + 3);
    doc.resume();
    doc.end();
  }
});
test('payment PDF fits a single-item template and paginates long item lists', async () => {
  const single = await createProposalPdf(fields);
  assert.equal(single.subarray(0, 5).toString(), '%PDF-');
  assert.equal((single.toString('latin1').match(/\/Type \/Page\b/g) || []).length, 1);
  const long = await createProposalPdf({ ...fields, paymentItems: Array.from({ length: 30 }, (_, i) => ({ description: `Khoản ${i + 1}: ${'Chi phí vận hành. '.repeat(12)}`, amount: 100, document: 'Chứng từ kèm' })) });
  assert.ok((long.toString('latin1').match(/\/Type \/Page\b/g) || []).length > 1);
  await assert.rejects(createProposalPdf({ ...fields, signatureData: 'invalid' }), /Chữ ký đã lưu không hợp lệ/);
});
