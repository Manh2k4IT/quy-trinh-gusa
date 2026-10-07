(function () {
  const modal = document.createElement('div');
  modal.className = 'saved-document-modal';
  modal.hidden = true;
  modal.innerHTML = '<section class="saved-document-dialog" role="dialog" aria-modal="true" aria-labelledby="saved-document-title"><header><div><h2 id="saved-document-title">Đơn đề xuất đã gửi</h2><p>Thông tin và chữ ký được lấy từ đề xuất đã lưu.</p></div><button type="button" data-close-saved-document aria-label="Đóng bản xem đơn">×</button></header><p role="status" data-saved-document-status></p><iframe title="Đơn đề xuất đã lưu" sandbox=""></iframe><footer><button type="button" data-retry-saved-document>Tải lại bản xem</button><button type="button" data-download-saved-document>Tải đơn PDF</button></footer></section>';
  document.body.append(modal);
  const frame = modal.querySelector('iframe');
  const status = modal.querySelector('[data-saved-document-status]');
  const downloadButton = modal.querySelector('[data-download-saved-document]');
  let selectedId = null;
  let controller = null;
  let opener = null;
  function url(id, format) {
    return `/api/proposals/${encodeURIComponent(id)}/document?format=${format}`;
  }
  async function load() {
    controller?.abort();
    controller = new AbortController();
    const activeController = controller;
    frame.hidden = true;
    frame.srcdoc = '';
    status.textContent = 'Đang tải đơn đã lưu...';
    downloadButton.disabled = true;
    try {
      const response = await fetch(url(selectedId, 'html'), { cache: 'no-store', signal: activeController.signal });
      if (!response.ok) throw new Error(await response.text() || 'Không tải được đơn.');
      const html = await response.text();
      if (activeController.signal.aborted) return;
      frame.srcdoc = html;
      frame.hidden = false;
      status.textContent = '';
      downloadButton.disabled = false;
    } catch (error) {
      if (error.name === 'AbortError') return;
      status.textContent = `Không xem được đơn: ${error.message}`;
    }
  }
  async function download(id, button, feedback) {
    button.disabled = true;
    feedback.textContent = 'Đang tạo file PDF...';
    try {
      const response = await fetch(url(id, 'pdf'), { cache: 'no-store' });
      if (!response.ok) throw new Error(await response.text() || 'Không tải được file PDF.');
      if (!response.headers.get('content-type')?.includes('application/pdf')) throw new Error('Máy chủ không trả về file PDF.');
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = response.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1] || 'don-de-xuat.pdf';
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
      feedback.textContent = 'Đã tạo file PDF và chuyển đến trình duyệt để tải.';
    } catch (error) {
      feedback.textContent = `Không tải được đơn: ${error.message}`;
    } finally {
      button.disabled = false;
    }
  }
  function close() {
    controller?.abort();
    modal.hidden = true;
    frame.srcdoc = '';
    opener?.focus();
  }
  modal.querySelector('[data-close-saved-document]').addEventListener('click', close);
  modal.querySelector('[data-retry-saved-document]').addEventListener('click', load);
  downloadButton.addEventListener('click', () => download(selectedId, downloadButton, status));
  modal.addEventListener('click', (event) => { if (event.target === modal) close(); });
  modal.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { event.stopPropagation(); close(); }
  });
  window.GusaSavedProposalDocument = {
    addActions(container, proposal) {
      if (!['late', 'early-leave', 'half-day', 'leave', 'unauthorized-leave', 'payment'].includes(proposal.type)) return;
      const actions = document.createElement('div');
      actions.className = 'saved-document-actions';
      const viewButton = document.createElement('button');
      viewButton.type = 'button';
      viewButton.textContent = 'Xem lại đơn';
      const downloadButton = document.createElement('button');
      downloadButton.type = 'button';
      downloadButton.textContent = 'Tải đơn PDF';
      const feedback = document.createElement('p');
      feedback.setAttribute('role', 'status');
      viewButton.addEventListener('click', () => {
        selectedId = proposal.id;
        opener = viewButton;
        modal.hidden = false;
        modal.querySelector('[data-close-saved-document]').focus();
        load();
      });
      downloadButton.addEventListener('click', () => download(proposal.id, downloadButton, feedback));
      actions.append(viewButton, downloadButton);
      container.append(actions, feedback);
    },
  };
})();
