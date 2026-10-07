const PDFDocument = require('pdfkit');
const { fromProposal, getDocumentData } = require('./proposal-document');
const { writePaymentDocument } = require('./payment-document-pdf');
const regularFont = require.resolve('dejavu-fonts-ttf/ttf/DejaVuSerif.ttf');
const boldFont = require.resolve('dejavu-fonts-ttf/ttf/DejaVuSerif-Bold.ttf');

function createProposalPdf(proposal) {
  const data = getDocumentData(fromProposal(proposal), { name: proposal.userName || proposal.signatureName || 'Nhân viên' });
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 51, info: { Title: data.title, Author: 'Gusa' } });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    try {
      doc.registerFont('Regular', regularFont);
      doc.registerFont('Bold', boldFont);
      if (proposal.type === 'payment') {
        writePaymentDocument(doc, proposal);
        doc.end();
        return;
      }
      const width = doc.page.width - 102;
      doc.font('Bold').fontSize(12).text('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', { align: 'center' });
      doc.text('Độc lập - Tự do - Hạnh phúc', { align: 'center' });
      doc.moveDown(2);
      doc.fontSize(16).text(data.title, { align: 'center' });
      doc.moveDown(1.5);
      doc.font('Regular').fontSize(11).text(data.addressee, { lineGap: 4 });
      doc.moveDown();
      for (const [label, value] of [['Người đề xuất', data.name], [proposal.type === 'payment' ? 'Ngày đề xuất' : 'Ngày áp dụng', data.dateText], ...(data.timeLabel ? [[data.timeLabel, data.timeValue]] : []), ...data.paymentRows]) {
        doc.text(`${label}: ${value}`, { lineGap: 5 });
      }
      doc.moveDown();
      doc.font('Bold').text(data.reasonLabel);
      doc.font('Regular').text(data.reason, { lineGap: 4 });
      doc.moveDown();
      doc.text(data.commitment, { lineGap: 4 });
      const signatureHeight = 135 + doc.font('Bold').heightOfString(data.signatureName, { width: width / 2 - 12 });
      if (doc.y + signatureHeight + 30 > doc.page.height - 51) doc.addPage();
      const y = doc.y + 25;
      const columnWidth = width / 2 - 12;
      for (const [x, label] of [[51, 'Người đề xuất'], [51 + width / 2 + 12, 'Người phê duyệt']]) {
        doc.font('Bold').fontSize(11).text(label, x, y, { width: columnWidth, align: 'center' });
        doc.font('Regular').fontSize(10).text('(Ký, ghi rõ họ tên)', x, y + 22, { width: columnWidth, align: 'center' });
      }
      if (proposal.signatureData) {
        if (!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(proposal.signatureData)) throw new Error('Chữ ký đã lưu không hợp lệ.');
        const image = Buffer.from(proposal.signatureData.slice('data:image/png;base64,'.length), 'base64');
        doc.image(image, 51, y + 43, { fit: [columnWidth, 80], align: 'center', valign: 'center' });
      }
      doc.font('Bold').fontSize(11).text(data.signatureName, 51, y + 125, { width: columnWidth, align: 'center' });
      doc.end();
    } catch (error) {
      doc.destroy();
      reject(error);
    }
  });
}
module.exports = { createProposalPdf };
