const fs = require('node:fs');
const path = require('node:path');

function hasManagementApproval(proposal) {
  if (proposal.type !== 'payment') return proposal.status === 'approved';
  if (proposal.paymentFlow === 'accountant' || ['rejected', 'cancelled'].includes(proposal.status)) return false;
  return Boolean(proposal.managementApprovedAt ||
    (proposal.managementReviewedAt && ['accounting', 'completed'].includes(proposal.paymentStage)));
}

function getApprovalConfirmation(proposal) {
  if (!hasManagementApproval(proposal)) return '';
  const image = fs.readFileSync(path.join(__dirname, 'Đã_xác_nhận-removebg-preview.png'));
  return `data:image/png;base64,${image.toString('base64')}`;
}

module.exports = { hasManagementApproval, getApprovalConfirmation };
