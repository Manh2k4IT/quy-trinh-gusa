(function (root) {
  const paymentDocument = typeof module !== 'undefined' && module.exports ? require('./payment-document') : root.GusaPaymentDocument;
  const titles = {
    late: 'ĐƠN ĐỀ NGHỊ ĐI TRỄ',
    'early-leave': 'ĐƠN ĐỀ NGHỊ VỀ SỚM',
    'half-day': 'ĐƠN ĐỀ NGHỊ LÀM NỬA NGÀY',
    leave: 'ĐƠN XIN NGHỈ PHÉP',
    'unauthorized-leave': 'ĐƠN GIẢI TRÌNH NGHỈ KHÔNG PHÉP',
    payment: 'GIẤY ĐỀ NGHỊ THANH TOÁN',
  };
  function escape(value) {
    return String(value || '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  }
  function date(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return 'Chưa chọn';
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
  }
  function fromProposal(proposal) {
    return {
      ...proposal,
      duration: proposal.dateFrom && proposal.dateTo ? 'multiple' : 'single',
      halfDayPeriod: proposal.attendanceType,
      saved: true,
    };
  }
  function getDocumentData(fields, employee) {
    const isLeave = ['leave', 'unauthorized-leave'].includes(fields.type);
    const dateText = isLeave && fields.duration === 'multiple'
      ? `${date(fields.dateFrom)} đến ${date(fields.dateTo)}` : date(fields.date);
    const period = fields.halfDayPeriod === 'half-day-morning' ? 'Buổi sáng' : fields.halfDayPeriod === 'half-day-afternoon' ? 'Buổi chiều' : 'Chưa chọn';
    return {
      title: titles[fields.type] || 'ĐƠN ĐỀ XUẤT',
      name: employee.name || 'Đang tải thông tin tài khoản',
      dateText,
      timeLabel: fields.type === 'half-day' ? 'Buổi làm việc' : isLeave || fields.type === 'payment' ? '' : fields.type === 'late' ? 'Giờ dự kiến đến' : 'Giờ dự kiến về',
      timeValue: fields.type === 'half-day' ? period : fields.time || 'Chưa chọn',
      reason: fields.reason || 'Nội dung lý do sẽ hiển thị tại đây khi bạn nhập.',
      signatureName: (fields.signatureName || '').trim(),
      addressee: fields.type === 'payment' ? fields.paymentFlow === 'accountant' ? 'Kính gửi: Bộ phận Kế toán' : 'Kính gửi: Ban Giám đốc và Bộ phận Kế toán' : 'Kính gửi: Ban Giám đốc và Bộ phận quản lý nhân sự',
      reasonLabel: fields.type === 'payment' ? 'Nội dung / Lý do thanh toán:' : 'Lý do đề xuất:',
      commitment: fields.type === 'payment' ? 'Kính đề nghị bộ phận phụ trách xem xét và thanh toán khoản chi nêu trên. Tôi cam kết thông tin đề xuất và chứng từ cung cấp là chính xác.' : 'Kính mong Ban Giám đốc và bộ phận phụ trách xem xét. Tôi cam kết thông tin trên là chính xác và thực hiện bàn giao công việc theo quy định.',
      paymentRows: fields.type === 'payment' ? [
        ['Luồng xử lý', fields.paymentFlow === 'accountant' ? 'Kế toán xác nhận trực tiếp' : 'CEO/Admin duyệt → Kế toán xác nhận'],
        ['Hạng mục thanh toán', fields.category || 'Chưa nhập'],
        ['Số tiền (VNĐ)', fields.amount && Number.isFinite(Number(fields.amount)) ? `${Number(fields.amount).toLocaleString('vi-VN')} VNĐ` : 'Chưa nhập'],
      ] : [],
    };
  }
  function render(fields, employee) {
    if (fields.type === 'payment') return paymentDocument.render(fields, employee);
    const data = getDocumentData(fields, employee);
    const signature = /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(fields.signatureData || '')
      ? `<img class="handwritten-signature" src="${escape(fields.signatureData)}" alt="Chữ ký người đề xuất">` : '';
    const timeRow = data.timeLabel ? `<tr><th>${data.timeLabel}</th><td>${escape(data.timeValue)}</td></tr>` : '';
    return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${titles[fields.type] || 'ĐƠN ĐỀ XUẤT'}</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#eef1f5;color:#202b3a;font:15px/1.7 "Times New Roman",serif}
article{max-width:794px;min-height:900px;margin:auto;padding:48px 44px;background:#fff}
header{text-align:center}header p{margin:0;font-weight:bold}.motto{display:inline-block;border-bottom:1px solid #202b3a;padding-bottom:5px}
h1{margin:38px 0 24px;text-align:center;font-size:22px;line-height:1.4}table{width:100%;border-collapse:collapse;margin:22px 0}
th,td{padding:9px 0;border-bottom:1px solid #e5e7eb;text-align:left;vertical-align:top;overflow-wrap:anywhere}th{width:38%;font-weight:normal;color:#536174}
.reason{min-height:100px;white-space:pre-wrap;overflow-wrap:anywhere}.signatures{display:flex;justify-content:space-between;gap:24px;margin-top:35px;text-align:center}
.signatures{break-inside:avoid}.signatures>div{width:48%}.signatures p{margin:0}.signature-space{height:80px;display:flex;align-items:center;justify-content:center}.handwritten-signature{max-width:100%;height:80px;object-fit:contain}.signature-name{font-weight:bold}
.draft{margin-top:40px;color:#667085;font:12px/1.5 Arial,sans-serif;border-top:1px dashed #ccd3dd;padding-top:12px}
@page{size:A4;margin:18mm}@media print{body{background:#fff}article{padding:0;min-height:0;max-width:none}.draft{display:none}}
</style></head><body><article><header><p>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p><p class="motto">Độc lập - Tự do - Hạnh phúc</p></header>
<h1>${titles[fields.type] || 'ĐƠN ĐỀ XUẤT'}</h1><p>${escape(data.addressee)}</p>
<table><tr><th>Người đề xuất</th><td>${escape(data.name)}</td></tr>
<tr><th>${fields.type === 'payment' ? 'Ngày đề xuất' : 'Ngày áp dụng'}</th><td>${data.dateText}</td></tr>${timeRow}${data.paymentRows.map(([label, value]) => `<tr><th>${label}</th><td>${escape(value)}</td></tr>`).join('')}</table>
<p><strong>${escape(data.reasonLabel)}</strong></p><div class="reason">${escape(fields.reason) || 'Nội dung lý do sẽ hiển thị tại đây khi bạn nhập.'}</div>
<p>${escape(data.commitment)}</p>
<div class="signatures"><div><p><strong>Người đề xuất</strong></p><p>(Ký, ghi rõ họ tên)</p><div class="signature-space">${signature}</div><p class="signature-name">${escape((fields.signatureName || '').trim())}</p></div><div><p><strong>Người phê duyệt</strong></p><p>(Ký, ghi rõ họ tên)</p></div></div>
${fields.saved ? '' : '<p class="draft">BẢN NHÁP — Bản in này không xác nhận đề xuất đã được gửi hoặc phê duyệt. Trạng thái chính thức được theo dõi trong ứng dụng.</p>'}
</article></body></html>`;
  }
  const api = { render, fromProposal, getDocumentData };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GusaProposalDocument = api;
})(typeof window !== 'undefined' ? window : globalThis);
