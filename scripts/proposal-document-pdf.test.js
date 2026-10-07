const test = require('node:test');
const assert = require('node:assert/strict');
const { createProposalPdf } = require('../proposal-document-pdf');
const { fromProposal, getDocumentData } = require('../proposal-document');

test('saved document mapping preserves range, period, author and signature name', () => {
  const leave = { type: 'leave', date: '2026-10-01', dateFrom: '2026-10-09', dateTo: '2026-10-12', signatureName: 'Nguyễn Văn A', reason: 'Lý do đã lưu' };
  const data = getDocumentData(fromProposal(leave), { name: 'Tên tài khoản' });
  assert.equal(data.dateText, '09/10/2026 đến 12/10/2026');
  assert.equal(data.signatureName, 'Nguyễn Văn A');
  assert.equal(data.name, 'Tên tài khoản');
  const half = getDocumentData(fromProposal({ type: 'half-day', attendanceType: 'half-day-afternoon', date: '2026-10-09' }), { name: 'A' });
  assert.equal(half.timeValue, 'Buổi chiều');
});

test('all six types generate real PDFs with embedded Vietnamese fonts', async () => {
  for (const type of ['late', 'early-leave', 'half-day', 'leave', 'unauthorized-leave', 'payment']) {
    const bytes = await createProposalPdf({ type, date: '2026-10-09', userName: 'Nguyễn Văn Mạnh', signatureName: 'Nguyễn Văn Mạnh', reason: 'Nghỉ để giải quyết việc gia đình.', time: '09:30', attendanceType: 'half-day-morning' });
    const pdf = bytes.toString('latin1');
    assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
    assert.ok(pdf.includes('/FontFile2'));
    assert.ok(pdf.includes('/ToUnicode'));
    assert.ok(pdf.endsWith('%%EOF\n'));
    assert.equal((pdf.match(/\/Type \/Page\b/g) || []).length, 1);
  }
});

test('payment documents show the amount and selected approval route', () => {
  for (const paymentFlow of ['ceo', 'accountant']) {
    const data = getDocumentData({ type: 'payment', category: 'Văn phòng phẩm', amount: '1250000', paymentFlow }, { name: 'A' });
    assert.equal(data.title, 'GIẤY ĐỀ NGHỊ THANH TOÁN');
    assert.equal(data.timeLabel, '');
    assert.ok(data.paymentRows.some((row) => row[1] === '1.250.000 VNĐ'));
    assert.ok(data.paymentRows[0][1].includes(paymentFlow === 'ceo' ? 'CEO/Admin' : 'trực tiếp'));
    assert.ok(data.addressee.includes('Kế toán'));
    assert.ok(!data.commitment.includes('bàn giao'));
  }
});

test('long reasons paginate without dropping signatures, and invalid images fail explicitly', async () => {
  const bytes = await createProposalPdf({ type: 'leave', userName: 'A', reason: 'Lý do nhiều dòng.\n'.repeat(80) });
  assert.ok((bytes.toString('latin1').match(/\/Type \/Page\b/g) || []).length > 1);
  await assert.rejects(createProposalPdf({ type: 'leave', userName: 'A', signatureData: 'invalid' }), /Chữ ký đã lưu không hợp lệ/);
});
