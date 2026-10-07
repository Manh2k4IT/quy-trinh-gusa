const { getData } = require('./payment-document-data');

function writePaymentDocument(doc, proposal) {
  const data = getData(proposal, { name: proposal.userName });
  const left = 51;
  const width = doc.page.width - left * 2;
  const bottom = () => doc.page.height - 51;
  const money = (amount) => amount !== '' && amount != null ? `${Number(amount).toLocaleString('vi-VN')} VND` : '';
  const line = (text, bold = false) => doc.font(bold ? 'Bold' : 'Regular').fontSize(11).text(text, left, doc.y, { width, lineGap: 3 });
  doc.font('Bold').fontSize(11).text('Đơn vị: CTY GUSA VIỆT NAM', left, 35, { width: width * .48 });
  doc.font('Regular').text(`Bộ phận: ${data.department}`, { width: width * .48 });
  const headingBottom = doc.y;
  doc.font('Bold').text('Mẫu số: 05-TT', left + width * .52, 35, { width: width * .48, align: 'center' });
  doc.font('Regular').fontSize(9).text('(Ban hành theo Thông tư 200/2014/TT-BTC ngày 24/12/2014 của Bộ trưởng BTC)', { width: width * .48, align: 'center' });
  doc.y = Math.max(headingBottom, doc.y) + 22;
  doc.font('Bold').fontSize(16).text(data.title, left, doc.y, { width, align: 'center' });
  const [year, month, day] = data.date.split('-');
  doc.font('Regular').fontSize(11).text(/^\d{4}-\d{2}-\d{2}$/.test(data.date) ? `Ngày ${Number(day)} tháng ${Number(month)} năm ${year}` : 'Ngày … tháng … năm …', { width, align: 'center' });
  doc.moveDown();
  line('Kính gửi: Ban Giám đốc Công ty TNHH Gusa Việt Nam');
  line(`Họ và tên người đề nghị thanh toán: ${data.name}`);
  line(`Bộ phận: ${data.department}`);
  line('Nội dung thanh toán các khoản sau đây:');
  doc.moveDown(.4);
  const columns = [.08, .43, .24, .25].map((ratio) => width * ratio);
  function row(values, bold = false, total = false) {
    const sizes = total ? [columns[0] + columns[1], columns[2], columns[3]] : columns;
    doc.font(bold ? 'Bold' : 'Regular').fontSize(10);
    const height = Math.max(28, ...values.map((value, i) => doc.heightOfString(String(value), { width: sizes[i] - 10, lineGap: 2 }) + 12));
    if (doc.y + height > bottom()) {
      doc.addPage();
      doc.y = 51;
      if (!bold) row(['STT', 'Nội dung thanh toán', 'Số tiền', 'Chứng từ kèm'], true);
    }
    const y = doc.y;
    let x = left;
    values.forEach((value, i) => {
      doc.rect(x, y, sizes[i], height).stroke();
      doc.font(bold ? 'Bold' : 'Regular').fontSize(10).text(String(value), x + 5, y + 6, { width: sizes[i] - 10, lineGap: 2, align: bold && !total ? 'center' : i === (total ? 1 : 2) ? 'right' : i === 0 && !total ? 'center' : 'left' });
      x += sizes[i];
    });
    doc.y = y + height;
  }
  row(['STT', 'Nội dung thanh toán', 'Số tiền', 'Chứng từ kèm'], true);
  data.items.forEach((item, index) => row([index + 1, item.description, money(item.amount), item.document]));
  row(['Tổng cộng', money(data.total), ''], true, true);
  doc.moveDown(.6);
  line(`Số tiền viết bằng chữ: ${data.amountWords}`);
  const bankLines = ['Thông tin chuyển khoản (nếu có):', `Tên chủ tài khoản: ${data.accountName}`, `Tài khoản thụ hưởng: ${data.accountNumber}`, `Ngân hàng thụ hưởng: ${data.bankName}`];
  doc.font('Regular').fontSize(11);
  const bankHeight = bankLines.reduce((sum, text) => sum + doc.heightOfString(text, { width, lineGap: 3 }), 0);
  if (doc.y + bankHeight + 15 > bottom()) doc.addPage();
  bankLines.forEach((text) => line(text));
  const columnWidth = width / 3 - 8;
  const nameHeight = doc.font('Bold').fontSize(11).heightOfString(data.signatureName, { width: columnWidth });
  if (doc.y + 145 + nameHeight > bottom()) doc.addPage();
  const y = doc.y + 20;
  ['Người đề nghị', 'Kế toán trưởng', 'Giám Đốc'].forEach((label, index) => {
    const x = left + width / 3 * index;
    doc.font('Bold').fontSize(11).text(label, x, y, { width: columnWidth, align: 'center' });
    doc.font('Regular').fontSize(10).text('(Ký, họ tên)', x, y + 21, { width: columnWidth, align: 'center' });
  });
  if (data.signatureData) {
    if (!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(data.signatureData)) throw new Error('Chữ ký đã lưu không hợp lệ.');
    doc.image(Buffer.from(data.signatureData.slice('data:image/png;base64,'.length), 'base64'), left, y + 42, { fit: [columnWidth, 75], align: 'center', valign: 'center' });
  }
  doc.font('Bold').fontSize(11).text(data.signatureName, left, y + 120, { width: columnWidth, align: 'center' });
}
module.exports = { writePaymentDocument };
