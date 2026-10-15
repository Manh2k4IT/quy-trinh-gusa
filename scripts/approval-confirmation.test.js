const test = require('node:test');
const assert = require('node:assert/strict');
const { hasManagementApproval, getApprovalConfirmation } = require('../approval-confirmation');
const { render, fromProposal } = require('../proposal-document');
const { createProposalPdf } = require('../proposal-document-pdf');

const date = '2026-10-15T09:00:00Z';
const states = [
  [{ type: 'leave', status: 'pending' }, false],
  [{ type: 'leave', status: 'rejected' }, false],
  [{ type: 'leave', status: 'cancelled' }, false],
  [{ type: 'leave', status: 'approved' }, true],
  [{ type: 'payment', paymentFlow: 'ceo', status: 'pending', paymentStage: 'management' }, false],
  [{ type: 'payment', paymentFlow: 'ceo', status: 'pending', paymentStage: 'accounting', managementReviewedAt: date }, true],
  [{ type: 'payment', paymentFlow: 'ceo', status: 'approved', paymentStage: 'completed', managementReviewedAt: date }, true],
  [{ type: 'payment', paymentFlow: 'ceo', status: 'pending', paymentStage: 'accounting', managementApprovedAt: date }, true],
  [{ type: 'payment', status: 'approved', paymentStage: 'completed' }, false],
  [{ type: 'payment', paymentFlow: 'accountant', status: 'approved', paymentStage: 'completed', managementApprovedAt: date }, false],
  [{ type: 'payment', status: 'rejected', paymentStage: 'rejected', managementReviewedAt: date }, false],
  [{ type: 'payment', status: 'cancelled', managementApprovedAt: date }, false],
];

test('confirmation follows real management approval, including legacy records but not direct accounting', () => {
  for (const [proposal, expected] of states) {
    assert.equal(hasManagementApproval(proposal), expected, JSON.stringify(proposal));
    const image = getApprovalConfirmation(proposal);
    assert.equal(Boolean(image), expected);
    if (image) assert.equal(Buffer.from(image.split(',')[1], 'base64').subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  }
});

test('saved HTML places the image only in approver/director columns, leaving accounting blank', () => {
  for (const [proposal, approved] of states) {
    const fields = fromProposal({ ...proposal, approvalConfirmationData: getApprovalConfirmation(proposal) });
    const html = render(fields, { name: 'Người gửi' });
    assert.equal(html.includes('alt="Xác nhận'), approved);
    if (approved) {
      const label = proposal.type === 'payment' ? 'Giám Đốc' : 'Người phê duyệt';
      assert.ok(html.indexOf('alt="Xác nhận') > html.indexOf(`<strong>${label}</strong>`));
      if (proposal.type === 'payment') {
        assert.ok(!html.slice(html.indexOf('<strong>Kế toán trưởng'), html.indexOf('<strong>Giám Đốc')).includes('<img'));
      }
      assert.ok(!render({ ...fields, saved: false }, { name: 'Người gửi' }).includes('alt="Xác nhận'));
    }
  }
});

test('all personnel types and approved payments embed the real confirmation image in one-page PDFs', async () => {
  for (const type of ['late', 'early-leave', 'half-day', 'leave', 'unauthorized-leave', 'payment']) {
    const proposal = { type, status: 'approved', paymentFlow: 'ceo', paymentStage: 'completed', managementReviewedAt: date, userName: 'A', date: '2026-10-15', reason: 'Lý do' };
    const approved = (await createProposalPdf(proposal)).toString('latin1');
    const pending = (await createProposalPdf({ ...proposal, status: 'pending', paymentStage: 'management', managementReviewedAt: undefined })).toString('latin1');
    assert.ok(approved.includes('/Subtype /Image'));
    assert.ok(!pending.includes('/Subtype /Image'));
    assert.equal((approved.match(/\/Type \/Page\b/g) || []).length, 1);
  }
});
