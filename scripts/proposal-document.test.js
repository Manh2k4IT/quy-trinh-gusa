const test = require('node:test');
const assert = require('node:assert/strict');
const { render } = require('../proposal-document.js');

test('all five proposal types produce distinct printable documents', () => {
  const titles = {
    late: 'ĐƠN ĐỀ NGHỊ ĐI TRỄ',
    'early-leave': 'ĐƠN ĐỀ NGHỊ VỀ SỚM',
    'half-day': 'ĐƠN ĐỀ NGHỊ LÀM NỬA NGÀY',
    leave: 'ĐƠN XIN NGHỈ PHÉP',
    'unauthorized-leave': 'ĐƠN GIẢI TRÌNH NGHỈ KHÔNG PHÉP',
  };
  for (const [type, title] of Object.entries(titles)) {
    const html = render({ type, date: '2026-10-09', time: '09:30', reason: 'Việc gia đình', halfDayPeriod: 'half-day-morning' }, { name: 'Nhân viên' });
    assert.ok(html.includes(`<h1>${title}</h1>`));
    assert.ok(html.includes('09/10/2026'));
    assert.ok(html.includes('Việc gia đình'));
    assert.ok(html.includes('BẢN NHÁP'));
    assert.ok(html.includes('@media print{body{background:#fff}article{padding:0;min-height:0;max-width:none}.draft{display:none}}'));
    assert.ok(html.includes('@page{size:A4'));
    const signatures = html.slice(html.indexOf('<div class="signatures">'));
    assert.ok(signatures.indexOf('Người đề xuất') < signatures.indexOf('Người phê duyệt'));
    assert.ok(signatures.indexOf('signature-name') < signatures.indexOf('Người phê duyệt'));
    assert.equal(html.includes('09:30'), ['late', 'early-leave'].includes(type));
    assert.equal(html.includes('Buổi sáng'), type === 'half-day');
  }
});

test('multi-day leave uses the range and does not leak unrelated fields', () => {
  const html = render({ type: 'leave', duration: 'multiple', date: '2026-10-01', dateFrom: '2026-10-09', dateTo: '2026-10-12', time: '08:00', halfDayPeriod: 'half-day-afternoon' }, { name: 'A' });
  assert.ok(html.includes('09/10/2026 đến 12/10/2026'));
  assert.ok(!html.includes('01/10/2026'));
  assert.ok(!html.includes('08:00'));
  assert.ok(!html.includes('Buổi chiều'));
});

test('document escapes user input and shows placeholders for unfinished fields', () => {
  const html = render({ type: 'late', reason: '<script>alert("test")</script>\nDòng thứ hai' }, { name: '<img src=x onerror=alert(1)>' });
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('<img'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('Dòng thứ hai'));
  assert.ok(html.includes('Chưa chọn'));
});

test('handwritten signature appears only in the proposer column with safe PNG sources', () => {
  const signatureData = 'data:image/png;base64,aGVsbG8=';
  const html = render({ type: 'leave', signatureData, signatureName: ' Nguyễn Văn A ' }, { name: 'A' });
  const signatures = html.slice(html.indexOf('<div class="signatures">'));
  assert.ok(signatures.includes(`src="${signatureData}"`));
  assert.ok(signatures.includes('<p class="signature-name">Nguyễn Văn A</p>'));
  assert.ok(signatures.indexOf('handwritten-signature') < signatures.indexOf('Người phê duyệt'));
  const invalid = render({ type: 'leave', signatureData: 'data:image/svg+xml,<svg onload=alert(1)>' }, { name: 'A' });
  assert.ok(!invalid.includes('<img class="handwritten-signature"'));
});
