(function () {
const signaturePanel = document.createElement('fieldset');
signaturePanel.className = 'proposal-signature-panel';
signaturePanel.innerHTML = '<legend>Chữ ký người đề xuất <span>(bắt buộc)</span></legend><p>Dùng chuột hoặc ngón tay để ký trong khung bên dưới.</p><canvas width="600" height="200" aria-label="Bảng vẽ chữ ký tay"></canvas><div><span data-signature-status role="status">Chưa có chữ ký</span><button type="button" data-clear-signature>Xóa / Ký lại</button></div><input type="hidden" name="signatureData" />';
form.querySelector('[name="reason"]').closest('label').after(signaturePanel);
const signatureNameLabel = document.createElement('label');
signatureNameLabel.className = 'proposal-signature-name-field';
signatureNameLabel.innerHTML = 'Họ và tên đầy đủ<input name="signatureName" type="text" maxlength="150" autocomplete="name" required placeholder="Nhập đầy đủ họ và tên người ký" />';
signaturePanel.append(signatureNameLabel);
const signatureNameInput = signatureNameLabel.querySelector('input');
signatureNameInput.addEventListener('input', () => {
  signatureNameInput.setCustomValidity(signatureNameInput.value.trim() ? '' : 'Vui lòng nhập họ và tên đầy đủ.');
});
form.addEventListener('reset', () => signatureNameInput.setCustomValidity(''));
const signatureCanvas = signaturePanel.querySelector('canvas');
const signatureContext = signatureCanvas.getContext('2d');
const signatureInput = signaturePanel.querySelector('[name="signatureData"]');
const signatureStatus = signaturePanel.querySelector('[data-signature-status]');
let signaturePointer = null;
signatureContext.strokeStyle = '#173f78';
signatureContext.fillStyle = '#173f78';
signatureContext.lineWidth = 2.5;
signatureContext.lineCap = 'round';
signatureContext.lineJoin = 'round';
function signaturePoint(event) {
  const bounds = signatureCanvas.getBoundingClientRect();
  return { x: (event.clientX - bounds.left) * signatureCanvas.width / bounds.width, y: (event.clientY - bounds.top) * signatureCanvas.height / bounds.height };
}
function saveSignature() {
  signatureInput.value = signatureCanvas.toDataURL('image/png');
  signatureStatus.textContent = 'Đã có chữ ký';
  if (status.textContent === 'Vui lòng ký tên trong bảng chữ ký trước khi gửi.') status.textContent = '';
  window.syncProposalDocument?.();
}
signatureCanvas.addEventListener('pointerdown', (event) => {
  if (!event.isPrimary || event.button !== 0 || signaturePointer !== null) return;
  event.preventDefault();
  signaturePointer = event.pointerId;
  signatureCanvas.setPointerCapture(event.pointerId);
  const point = signaturePoint(event);
  signatureContext.beginPath();
  signatureContext.arc(point.x, point.y, 1.25, 0, Math.PI * 2);
  signatureContext.fill();
  signatureContext.beginPath();
  signatureContext.moveTo(point.x, point.y);
});
signatureCanvas.addEventListener('pointermove', (event) => {
  if (event.pointerId !== signaturePointer) return;
  const point = signaturePoint(event);
  signatureContext.lineTo(point.x, point.y);
  signatureContext.stroke();
});
function finishSignature(event) {
  if (event.pointerId !== signaturePointer) return;
  signaturePointer = null;
  saveSignature();
}
signatureCanvas.addEventListener('pointerup', finishSignature);
signatureCanvas.addEventListener('pointercancel', finishSignature);
signatureCanvas.addEventListener('lostpointercapture', finishSignature);
function clearSignature() {
  signaturePointer = null;
  signatureContext.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height);
  signatureInput.value = '';
  signatureStatus.textContent = 'Chưa có chữ ký';
  window.syncProposalDocument?.();
}
signaturePanel.querySelector('[data-clear-signature]').addEventListener('click', clearSignature);
form.addEventListener('reset', clearSignature);
window.validateProposalSignature = function () {
  if (signatureInput.value) return true;
  signatureStatus.textContent = 'Vui lòng ký trước khi gửi đề xuất.';
  signaturePanel.scrollIntoView({ block: 'nearest' });
  return false;
};
})();
