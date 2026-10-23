(function () {
const maxWashLoss = 0.03;
const statusText = document.querySelector('[data-status]');
const list = document.querySelector('[data-list]');
const summary = document.querySelector('[data-stage-summary]');
const searchInput = document.querySelector('[data-search]');
const detailModal = document.querySelector('[data-detail-modal]');
const detail = document.querySelector('[data-detail]');
const createModal = document.querySelector('[data-create-modal]');
const createForm = document.querySelector('[data-create-form]');
const createError = document.querySelector('[data-create-error]');
const settingsModal = document.querySelector('[data-settings-modal]');
const settingsForm = document.querySelector('[data-settings-form]');
let state = null;
let activeTab = 'mine';
let stageFilter = '';
let resubmitOrderId = '';

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const formatDate = (value) => value ? value.slice(0, 10).split('-').reverse().join('/') : '';
const formatDateTime = (value) => value ? new Date(value).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
const formatNumber = (value) => value == null ? '' : Number(value).toLocaleString('vi-VN', { maximumFractionDigits: 2 });
const todayKey = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
const lossOf = (fabric) => fabric.cutMeters && fabric.washedMeters != null ? (fabric.cutMeters - fabric.washedMeters) / fabric.cutMeters : null;
const isOverdue = (order) => order.status === 'in-production' && order.workshop?.expectedDate < todayKey();

async function request(url, options = {}) {
  const response = await fetch(url, { cache: 'no-store', headers: { 'Content-Type': 'application/json' }, ...options });
  if (!response.ok) throw new Error(await response.text() || 'Có lỗi xảy ra, vui lòng thử lại.');
  return response.json();
}

async function load() {
  try {
    state = await request('/api/production');
    statusText.textContent = '';
    document.querySelector('[data-open-create]').hidden = !state.me.canCreate;
    document.querySelector('[data-open-settings]').hidden = !state.me.canManage;
    if (!state.me.canManage && !state.me.roles.length) statusText.textContent = 'Bạn đang ở chế độ xem. Liên hệ CEO/Quản trị để được phân công.';
    if (activeTab === 'mine' && !state.orders.some((order) => order.canAct) && !list.dataset.loaded) activeTab = 'all';
    list.dataset.loaded = '1';
    render();
    const openId = new URLSearchParams(location.search).get('id');
    if (openId && !detailModal.dataset.autoOpened) {
      detailModal.dataset.autoOpened = '1';
      openDetail(openId);
    } else if (!detailModal.hidden && detailModal.dataset.orderId) openDetail(detailModal.dataset.orderId);
  } catch (error) {
    statusText.textContent = error.message;
    list.innerHTML = '';
  }
}

function filteredOrders() {
  const query = searchInput.value.trim().toLowerCase();
  return state.orders.filter((order) => {
    if (activeTab === 'mine' && !order.canAct) return false;
    if (activeTab === 'active' && ['in-production'].includes(order.status)) return false;
    if (activeTab === 'producing' && order.status !== 'in-production') return false;
    if (stageFilter && order.status !== stageFilter) return false;
    if (!query) return true;
    return [order.code, order.proposal.productCode, order.proposal.productName].some((value) => value.toLowerCase().includes(query));
  });
}

function render() {
  document.querySelectorAll('[data-tab]').forEach((tab) => tab.setAttribute('aria-selected', String(tab.dataset.tab === activeTab)));
  const counts = state.orders.reduce((result, order) => ({ ...result, [order.status]: (result[order.status] || 0) + 1 }), {});
  summary.innerHTML = [...state.stageOrder, 'rejected'].filter((stage) => counts[stage]).map((stage) => `
    <button type="button" class="production-stage-chip${stageFilter === stage ? ' is-active' : ''}" data-stage-filter="${stage}" data-stage="${stage}">
      <strong>${counts[stage]}</strong><span>${escapeHtml(state.stages[stage].label)}</span>
    </button>`).join('');
  const orders = filteredOrders();
  list.innerHTML = orders.length ? orders.map((order) => `
    <button type="button" class="production-item" data-open-order="${order.id}">
      <span class="production-item-main">
        <span class="production-item-code">${escapeHtml(order.code)}${order.canAct ? '<em>Cần bạn xử lý</em>' : ''}${isOverdue(order) ? '<em class="is-danger">Trễ hạn giao</em>' : ''}</span>
        <strong>${escapeHtml(order.proposal.productCode)} · ${escapeHtml(order.proposal.productName)}</strong>
        <span class="production-muted">SL ${formatNumber(order.proposal.quantity)} · Lập bởi ${escapeHtml(order.createdBy.name)} · Cập nhật ${formatDateTime(order.updatedAt)}</span>
      </span>
      <span class="production-badge" data-stage="${order.status}">${escapeHtml(order.stageLabel)}</span>
    </button>`).join('') : `<p class="production-empty">${activeTab === 'mine' ? 'Không có hồ sơ nào đang chờ bạn xử lý.' : 'Chưa có hồ sơ nào.'}</p>`;
}

function stepper(order) {
  const currentIndex = state.stageOrder.indexOf(order.status);
  return `<ol class="production-stepper">${state.stageOrder.map((stage, index) => {
    const status = order.status === 'rejected' ? (index === 0 ? 'is-rejected' : '') : index < currentIndex || order.status === 'in-production' ? 'is-done' : index === currentIndex ? 'is-current' : '';
    return `<li class="${status}"><span>${index + 1}</span><small>${escapeHtml(state.stages[stage].label)}</small></li>`;
  }).join('')}</ol>`;
}

function fabricTable(order) {
  if (!order.fabrics?.length) return '';
  const hasCut = order.fabrics.some((fabric) => fabric.cutMeters);
  const hasWash = order.fabrics.some((fabric) => fabric.washedMeters != null);
  return `<div class="production-table-wrap"><table class="production-table">
    <thead><tr><th>Mã vải</th><th>Soạn (m)</th>${hasCut ? '<th>Cắt trước wash (m)</th>' : ''}${hasWash ? '<th>Sau wash (m)</th><th>Hao hụt</th>' : ''}</tr></thead>
    <tbody>${order.fabrics.map((fabric) => {
      const loss = lossOf(fabric);
      return `<tr><td>${escapeHtml(fabric.fabricCode)}${fabric.addedAfterWash ? ' <small class="production-muted">(phát sinh)</small>' : ''}</td><td>${formatNumber(fabric.plannedMeters)}</td>${hasCut ? `<td>${formatNumber(fabric.cutMeters)}</td>` : ''}${hasWash ? `<td>${formatNumber(fabric.washedMeters)}</td><td class="${loss > maxWashLoss ? 'is-danger' : 'is-ok'}">${loss == null ? '' : `${(loss * 100).toFixed(1)}%`}</td>` : ''}</tr>`;
    }).join('')}</tbody></table></div>`;
}

function infoRows(rows) {
  return `<dl class="production-info">${rows.filter(([, value]) => value !== '' && value != null).map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl>`;
}

function fabricInputs(rows, field, { editableCode = true, allowAdd = editableCode } = {}) {
  return `<div class="production-rows" data-fabric-rows data-field="${field}">${rows.map((row) => fabricRow(row, field, editableCode)).join('')}</div>
    ${allowAdd ? '<button class="production-link-button" type="button" data-add-fabric>+ Thêm mã vải</button>' : ''}`;
}

function fabricRow(row = {}, field, editableCode = true) {
  const loss = field === 'washedMeters' ? `<span class="production-loss" data-loss-for></span>` : '';
  return `<div class="production-row${field === 'washedMeters' ? ' is-wash' : ''}" data-fabric-row data-cut="${row.cutMeters ?? ''}">
    <input name="fabricCode" placeholder="Mã vải" value="${escapeHtml(row.fabricCode || '')}" ${editableCode ? '' : 'readonly'} maxlength="60" />
    <input name="${field}" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="${field === 'plannedMeters' ? 'Số mét soạn' : field === 'cutMeters' ? 'Số mét cắt (trước wash)' : row.cutMeters ? `Sau wash (trước: ${formatNumber(row.cutMeters)} m)` : 'Số mét sau wash'}" value="${row[field] ?? ''}" />
    ${loss}
    ${editableCode ? '<button type="button" class="production-row-remove" data-remove-row aria-label="Xóa dòng">×</button>' : field === 'washedMeters' ? '<span></span>' : ''}
  </div>`;
}

function fileList(order, files = order.transfer?.files || []) {
  if (!files.length) return '';
  return `<ul class="production-files">${files.map((file) => {
    const url = `/api/production/${order.id}/files/${file.id}`;
    const preview = /^image\//.test(file.type) ? `<img src="${url}" alt="" />` : '<span class="production-file-icon">📄</span>';
    return `<li><a href="${url}" target="_blank" rel="noopener">${preview}<span>${escapeHtml(file.name)}<small>${(file.size / 1024 / 1024).toFixed(2)} MB</small></span></a></li>`;
  }).join('')}</ul>`;
}

function readDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`Không đọc được file ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

// Ảnh chụp điện thoại được thu nhỏ (cạnh dài tối đa 1600px, JPEG) trước khi gửi.
async function shrinkImage(file) {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return { name: file.name.replace(/\.[^.]+$/, '') + '.jpg', data: canvas.toDataURL('image/jpeg', 0.85) };
  } catch {
    return { name: file.name, data: await readDataUrl(file) };
  }
}

async function readFiles(input) {
  const files = [...(input?.files || [])];
  if (files.length > 5) throw new Error('Chỉ đính kèm tối đa 5 file.');
  const results = await Promise.all(files.map(async (file) => /^image\/(jpeg|png|webp|heic|heif)$/.test(file.type) ? shrinkImage(file) : { name: file.name, data: await readDataUrl(file) }));
  const tooLarge = results.find((file) => file.data.length * 0.75 > 8 * 1024 * 1024);
  if (tooLarge) throw new Error(`File ${tooLarge.name} vượt quá 8MB.`);
  return results;
}

function actionPanel(order) {
  if (!order.canAct) {
    const waiting = order.stageRole ? (state.assignees[order.stageRole] || []).map((user) => user.name).join(', ') : '';
    return order.stageRole ? `<p class="production-waiting">Đang chờ: <strong>${escapeHtml(waiting || state.roles[order.stageRole]?.label || state.roles[order.stageRole] || '')}</strong></p>` : '';
  }
  const note = (label = 'Ghi chú') => `<label>${label}<textarea name="note" rows="2" maxlength="500"></textarea></label>`;
  const sendBack = state.stageOrder.indexOf(order.status) >= 3 && order.status !== 'in-production'
    ? '<button class="production-button is-ghost" type="button" data-action="send-back">Trả lại bước trước</button>' : '';
  const forms = {
    'approval-1': () => `${note('Ý kiến (bắt buộc khi từ chối)')}<div class="production-form-actions"><button class="production-button is-danger" type="button" data-action="reject">Từ chối</button><button class="production-button" type="button" data-action="approve">Duyệt</button></div>`,
    'approval-2': () => forms['approval-1'](),
    rejected: () => `<div class="production-form-actions"><button class="production-button" type="button" data-resubmit>Sửa &amp; gửi lại</button></div>`,
    'fabric-prep': () => `<p class="production-hint">Chọn và soạn vải theo phiếu đã duyệt, nhập các mã vải đã soạn để chuyển Vận hành kho lập phiếu chuyển kho.</p>${fabricInputs(order.fabrics?.length ? order.fabrics : [{}], 'plannedMeters')}${note()}<div class="production-form-actions"><button class="production-button" type="button" data-action="prepare-fabric">Chuyển lập phiếu chuyển kho</button></div>`,
    'transfer-draft': () => `<p class="production-hint">Tạo PHIẾU CHUYỂN KHO (nháp) trên ERPNext: kho đích <strong>Kho Sản xuất</strong>, phần diễn giải ghi <strong>${escapeHtml(order.proposal.productCode)}</strong>.</p>
      <label>Số phiếu chuyển kho (nháp) trên ERPNext<input name="erpCode" maxlength="80" value="${escapeHtml(order.transfer?.erpCode || '')}" placeholder="VD: MAT-STE-2026-00123" /></label>
      <label>File / ảnh phiếu chuyển kho<input name="files" type="file" multiple accept="image/*,.pdf,.xls,.xlsx,.doc,.docx" /></label>
      <p class="production-muted">Tối đa 5 file, mỗi file không quá 8MB.</p>${fileList(order)}${note()}
      <div class="production-form-actions">${sendBack}<button class="production-button" type="button" data-action="create-transfer">Chuyển soạn vải &amp; wash</button></div>`,
    washing: () => order.wash?.sentAt
      ? `<p class="production-hint">Đã đưa đi wash lúc ${formatDateTime(order.wash.sentAt)}${order.wash.vendor ? ` (${escapeHtml(order.wash.vendor)})` : ''}. Khi hàng về, nhập số mét thực tế từng mã vải.</p>${fabricInputs(order.fabrics, 'washedMeters', { editableCode: false, allowAdd: true })}
        <label>Ảnh thực tế hàng wash về<input name="files" type="file" multiple accept="image/*" /></label>
        <p class="production-muted">Chụp ảnh hoặc chọn từ thư viện. Tối đa 5 ảnh, mỗi ảnh không quá 8MB.</p>${note()}
        <div class="production-form-actions">${sendBack}<button class="production-button" type="button" data-action="return-wash">Báo số lượng sau wash</button></div>`
      : `<p class="production-hint">Soạn vải theo phiếu chuyển kho <strong>${escapeHtml(order.transfer?.erpCode)}</strong> rồi đưa đi wash theo Quy trình kiểm soát vải wash.</p><label>Đơn vị wash<input name="vendor" maxlength="120" /></label>
        <label>Ảnh vải đã soạn<input name="files" type="file" multiple accept="image/*" /></label>
        <p class="production-muted">Chụp ảnh hoặc chọn từ thư viện. Tối đa 5 ảnh, mỗi ảnh không quá 8MB.</p>${note()}
        <div class="production-form-actions">${sendBack}<button class="production-button" type="button" data-action="send-wash">Đã đưa vải đi wash</button></div>`,
    reconcile: () => {
      const overLimit = order.fabrics.filter((fabric) => lossOf(fabric) > maxWashLoss);
      return `<p class="production-hint">Mở lại phiếu chuyển kho <strong>${escapeHtml(order.transfer?.erpCode)}</strong>, sửa số lượng theo hàng wash thực tế rồi bấm xác nhận trên ERPNext. Hao hụt cho phép tối đa 3%.</p>
        ${overLimit.length ? `<p class="production-alert">Hao hụt vượt 3%: ${overLimit.map((fabric) => `${escapeHtml(fabric.fabricCode)} (${(lossOf(fabric) * 100).toFixed(1)}%)`).join(', ')}. Bắt buộc ghi lý do.</p>` : ''}
        <label>Lý do hao hụt${overLimit.length ? ' (bắt buộc)' : ''}<textarea name="lossNote" rows="2" maxlength="500"></textarea></label>
        ${[
          ['erpConfirmed', 'erp', 'Đã sửa số lượng và bấm xác nhận phiếu chuyển kho trên ERPNext', 'Ảnh màn hình phiếu chuyển kho đã xác nhận trên ERPNext'],
          ['printed', 'transferPrint', 'Đã in 2 phiếu chuyển kho có chữ ký từ Vận hành kho thời trang', 'Ảnh 2 phiếu chuyển kho đã in có chữ ký từ Vận hành kho thời trang'],
          ['proposalPrinted', 'proposalPrint', 'Đã in đủ 2 phiếu đề xuất sản xuất có chữ ký từ Vận hành kho thời trang', 'Ảnh 2 phiếu đề xuất sản xuất đã in có chữ ký từ Vận hành kho thời trang'],
        ].map(([check, photo, label, photoLabel]) => `<div class="production-proof">
          <label class="production-check"><input type="checkbox" name="${check}" /> ${label}</label>
          <label>${photoLabel} (bắt buộc)<input name="photo-${photo}" type="file" multiple accept="image/*" /></label>
        </div>`).join('')}
        <div class="production-form-actions">${sendBack}<button class="production-button" type="button" data-action="reconcile">Xác nhận đối chiếu</button></div>`;
    },
    handover: () => `<label class="production-check"><input type="checkbox" name="signed" /> Đã ký 2 phiếu chuyển kho, kẹp 1 phiếu vào phiếu đề xuất, bảo lưu 1 phiếu</label>
      <label>Ảnh xác nhận đã bàn giao cho phòng sản xuất (bắt buộc)<input name="files" type="file" multiple accept="image/*" /></label>
      <p class="production-muted">Chụp ảnh hoặc chọn từ thư viện. Tối đa 5 ảnh.</p>${note()}
      <div class="production-form-actions">${sendBack}<button class="production-button" type="button" data-action="handover">Bàn giao bộ đề xuất &amp; vải cho xưởng</button></div>`,
    'workshop-receive': () => `<p class="production-hint">Xác nhận đã nhận đủ bộ đề xuất (phiếu đề xuất + phiếu chuyển kho) và vải.</p>
      <div class="production-grid"><label>Đơn giá sản xuất (đ/sản phẩm)<input name="unitPrice" type="number" min="1" step="1" inputmode="numeric" /></label><label>Ngày giao hàng dự kiến<input name="expectedDate" type="date" /></label></div>${note()}
      <div class="production-form-actions">${sendBack}<button class="production-button" type="button" data-action="workshop-receive">Xác nhận đã nhận</button></div>`,
  };
  return forms[order.status] ? `<section class="production-action" data-action-form><h3>${escapeHtml(order.stageStep)} · ${escapeHtml(order.stageLabel)}</h3>${forms[order.status]()}<p class="production-error" data-action-error role="alert"></p></section>` : '';
}

function openDetail(orderId) {
  const order = state.orders.find((item) => item.id === orderId);
  if (!order) return;
  const proposal = order.proposal;
  const rejection = order.status === 'rejected' ? [...order.history].reverse().find((item) => item.action === 'Từ chối') : null;
  detailModal.dataset.orderId = order.id;
  detail.innerHTML = `
    <div class="production-detail-head">
      <div><span class="production-eyebrow">${escapeHtml(order.code)}</span><h2 id="production-detail-title">${escapeHtml(proposal.productCode)} · ${escapeHtml(proposal.productName)}</h2></div>
      <div class="production-detail-tools"><span class="production-badge" data-stage="${order.status}">${escapeHtml(order.stageLabel)}</span><button class="production-button is-secondary" type="button" data-print>In phiếu</button></div>
    </div>
    ${stepper(order)}
    ${rejection ? `<p class="production-alert">Bị từ chối bởi ${escapeHtml(rejection.name)}: ${escapeHtml(rejection.note)}</p>` : ''}
    ${isOverdue(order) ? `<p class="production-alert">Đã quá ngày giao dự kiến ${formatDate(order.workshop.expectedDate)}.</p>` : ''}
    ${actionPanel(order)}
    <section class="production-section"><div class="production-section-head"><h3>Phiếu đề xuất sản xuất</h3><button class="production-button is-secondary" type="button" data-print-proposal>In phiếu đề xuất sản xuất</button></div>
      ${infoRows([['Ngày đề xuất', formatDate(proposal.date)], ['Mã thành phẩm', escapeHtml(proposal.productCode)], ['Tên thành phẩm', escapeHtml(proposal.productName)], ['Số lượng', formatNumber(proposal.quantity)], ['Định mức', `${formatNumber(proposal.fabricNorm)} m/sp`], ['Vải dự kiến', `${formatNumber(proposal.quantity * proposal.fabricNorm)} m`], ['Ghi chú', escapeHtml(proposal.note)]])}
      ${proposal.variants?.length ? `<div class="production-table-wrap"><table class="production-table"><thead><tr><th>Màu</th><th>Size</th><th>Số lượng</th></tr></thead><tbody>${proposal.variants.map((row) => `<tr><td>${escapeHtml(row.color)}</td><td>${escapeHtml(row.size)}</td><td>${formatNumber(row.quantity)}</td></tr>`).join('')}</tbody></table></div>` : ''}
      <div class="production-signatures">
        <figure><figcaption>Người đề xuất</figcaption><img src="${escapeHtml(proposal.signatureData)}" alt="Chữ ký" /><strong>${escapeHtml(proposal.signatureName)}</strong></figure>
        ${['approval-1', 'approval-2'].map((stage, index) => `<figure><figcaption>Duyệt cấp ${index + 1}</figcaption>${order.approvals?.[stage] ? `<p class="production-approved">✓ Đã duyệt<br /><small>${formatDateTime(order.approvals[stage].at)}</small></p><strong>${escapeHtml(order.approvals[stage].name)}</strong>` : '<p class="production-muted">Chưa duyệt</p>'}</figure>`).join('')}
      </div>
    </section>
    ${order.fabrics?.length ? `<section class="production-section"><h3>Vải sản xuất</h3>${order.transfer ? infoRows([['Phiếu chuyển kho', escapeHtml(order.transfer.erpCode)], ['Kho đích', escapeHtml(order.transfer.warehouse)]]) + fileList(order) : ''}${order.wash?.files?.length ? `<p class="production-hint">Ảnh vải đã soạn trước khi wash:</p>${fileList(order, order.wash.files)}` : ''}${order.wash?.returnFiles?.length ? `<p class="production-hint">Ảnh thực tế hàng wash về:</p>${fileList(order, order.wash.returnFiles)}` : ''}${order.reconcile?.photos ? [['erp', 'Ảnh xác nhận phiếu chuyển kho trên ERPNext'], ['transferPrint', 'Ảnh 2 phiếu chuyển kho đã in có chữ ký từ Vận hành kho thời trang'], ['proposalPrint', 'Ảnh 2 phiếu đề xuất sản xuất đã in có chữ ký từ Vận hành kho thời trang']].map(([key, label]) => order.reconcile.photos[key]?.length ? `<p class="production-hint">${label}:</p>${fileList(order, order.reconcile.photos[key])}` : '').join('') : ''}${fabricTable(order)}${order.reconcile?.lossNote ? `<p class="production-hint">Lý do hao hụt: ${escapeHtml(order.reconcile.lossNote)}</p>` : ''}</section>` : ''}
    ${order.handover?.files?.length ? `<section class="production-section"><h3>Bàn giao cho phòng sản xuất</h3>${infoRows([['Người bàn giao', escapeHtml(order.handover.name)], ['Thời gian', formatDateTime(order.handover.at)]])}${fileList(order, order.handover.files)}</section>` : ''}
    ${order.workshop ? `<section class="production-section"><h3>Xưởng sản xuất</h3>${infoRows([['Người nhận', escapeHtml(order.workshop.name)], ['Ngày nhận', formatDateTime(order.workshop.receivedAt)], ['Đơn giá', `${formatNumber(order.workshop.unitPrice)} đ/sp`], ['Thành tiền dự kiến', `${formatNumber(order.workshop.unitPrice * proposal.quantity)} đ`], ['Giao dự kiến', formatDate(order.workshop.expectedDate)]])}</section>` : ''}
    <section class="production-section"><h3>Lịch sử</h3><ol class="production-history">${[...order.history].reverse().map((item) => `<li><strong>${escapeHtml(item.action)}</strong><span>${escapeHtml(item.name)} · ${formatDateTime(item.at)}</span>${item.note ? `<p>${escapeHtml(item.note)}</p>` : ''}</li>`).join('')}</ol></section>`;
  detailModal.hidden = false;
  updateLossPreview();
}

// In phiếu đề xuất sản xuất (BM01/QT.SX.01) trên khổ A4 qua iframe ẩn.
function printProposal(order) {
  const proposal = order.proposal;
  const approval = (stage, title) => {
    const item = order.approvals?.[stage];
    return `<td><strong>${title}</strong>${item ? `<div class="sign"><span class="ok">Đã duyệt</span><small>${formatDateTime(item.at)}</small></div><b>${escapeHtml(item.name)}</b>` : '<div class="sign"></div><b>&nbsp;</b>'}</td>`;
  };
  const variants = proposal.variants?.length
    ? `<table class="grid"><thead><tr><th>STT</th><th>Màu</th><th>Size</th><th>Số lượng</th></tr></thead><tbody>${proposal.variants.map((row, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(row.color)}</td><td>${escapeHtml(row.size)}</td><td>${formatNumber(row.quantity)}</td></tr>`).join('')}<tr><td colspan="3"><b>Tổng</b></td><td><b>${formatNumber(proposal.quantity)}</b></td></tr></tbody></table>`
    : '';
  const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${escapeHtml(order.code)} - Phiếu đề xuất sản xuất</title><style>
    @page { size: A4; margin: 15mm; }
    body { margin: 0; color: #000; font: 13px/1.45 "Times New Roman", serif; }
    table { width: 100%; border-collapse: collapse; }
    .head td { border: 1px solid #000; padding: 6px 8px; }
    .head .brand { width: 22%; font: 700 22px Arial, sans-serif; text-align: center; }
    .head .title { width: 46%; font: 700 14px Arial, sans-serif; text-align: center; }
    .head .meta { font-family: Arial, sans-serif; font-size: 12px; }
    h1 { margin: 18px 0 4px; font-size: 18px; text-align: center; }
    .code { margin: 0 0 14px; text-align: center; font-style: italic; }
    .info td { padding: 5px 0; vertical-align: top; }
    .info td:first-child { width: 32%; }
    .grid { margin-top: 10px; }
    .grid th, .grid td { border: 1px solid #000; padding: 5px 8px; text-align: left; }
    .note { margin-top: 10px; }
    .signs { margin-top: 22px; table-layout: fixed; }
    .signs td { border: 1px solid #000; padding: 8px; text-align: center; vertical-align: top; }
    .sign { display: flex; height: 80px; flex-direction: column; align-items: center; justify-content: center; }
    .sign img { max-width: 100%; max-height: 74px; }
    .ok { font-weight: 700; }
    small { display: block; font-size: 11px; }
  </style></head><body>
    <table class="head"><tr><td class="brand" rowspan="3">GUSA</td><td class="title" rowspan="3">PHIẾU ĐỀ XUẤT SẢN XUẤT</td><td class="meta">Mã số: BM01/QT.SX.01</td></tr><tr><td class="meta">Lần ban hành: 01</td></tr><tr><td class="meta">Số phiếu: ${escapeHtml(order.code)}</td></tr></table>
    <h1>PHIẾU ĐỀ XUẤT SẢN XUẤT</h1>
    <p class="code">Ngày đề xuất: ${formatDate(proposal.date)}</p>
    <table class="info">
      <tr><td>Mã thành phẩm:</td><td><b>${escapeHtml(proposal.productCode)}</b></td></tr>
      <tr><td>Tên thành phẩm:</td><td>${escapeHtml(proposal.productName)}</td></tr>
      <tr><td>Số lượng sản xuất:</td><td>${formatNumber(proposal.quantity)} sản phẩm</td></tr>
      <tr><td>Định mức vải:</td><td>${formatNumber(proposal.fabricNorm)} m/sản phẩm</td></tr>
      <tr><td>Tổng vải dự kiến:</td><td>${formatNumber(proposal.quantity * proposal.fabricNorm)} m</td></tr>
    </table>
    ${variants}
    ${proposal.note ? `<p class="note"><b>Ghi chú:</b> ${escapeHtml(proposal.note)}</p>` : ''}
    <table class="signs"><tr>
      <td><strong>Người đề xuất</strong><div class="sign"><img src="${escapeHtml(proposal.signatureData)}" alt=""></div><b>${escapeHtml(proposal.signatureName)}</b></td>
      ${approval('approval-1', 'Duyệt cấp 1')}
      ${approval('approval-2', 'Duyệt cấp 2')}
    </tr></table>
  </body></html>`;
  document.querySelector('[data-print-frame]')?.remove();
  const frame = document.createElement('iframe');
  frame.dataset.printFrame = '';
  frame.style.cssText = 'position:fixed;width:0;height:0;border:0;visibility:hidden';
  document.body.append(frame);
  frame.contentDocument.open();
  frame.contentDocument.write(html);
  frame.contentDocument.close();
  const image = frame.contentDocument.querySelector('img');
  const print = () => { frame.contentWindow.focus(); frame.contentWindow.print(); };
  if (image && !image.complete) image.addEventListener('load', print, { once: true }); else setTimeout(print, 50);
}

function collectFabrics(form) {
  const field = form.querySelector('[data-fabric-rows]')?.dataset.field;
  return [...form.querySelectorAll('[data-fabric-row]')].map((row) => ({ fabricCode: row.querySelector('[name="fabricCode"]').value.trim(), [field]: row.querySelector(`[name="${field}"]`).value }))
    .filter((row) => row.fabricCode || row[field]);
}

function updateLossPreview() {
  detail.querySelectorAll('[data-fabric-rows][data-field="washedMeters"] [data-fabric-row]').forEach((row) => {
    const cut = Number(row.dataset.cut);
    const washed = Number(row.querySelector('[name="washedMeters"]').value);
    const output = row.querySelector('[data-loss-for]');
    const loss = washed && cut ? (cut - washed) / cut : null;
    output.textContent = loss == null ? '' : `Hao hụt ${(loss * 100).toFixed(1)}%`;
    output.classList.toggle('is-danger', loss > maxWashLoss);
  });
}

async function runAction(button) {
  const form = button.closest('[data-action-form]');
  const error = form.querySelector('[data-action-error]');
  const action = button.dataset.action;
  const value = (name) => form.querySelector(`[name="${name}"]`)?.value;
  const checked = (name) => Boolean(form.querySelector(`[name="${name}"]`)?.checked);
  const payload = { action, note: value('note') || '' };
  if (['prepare-fabric', 'return-wash'].includes(action)) payload.fabrics = collectFabrics(form);
  if (action === 'create-transfer') payload.erpCode = value('erpCode');
  if (action === 'send-wash') payload.vendor = value('vendor');
  if (action === 'reconcile') Object.assign(payload, { lossNote: value('lossNote'), erpConfirmed: checked('erpConfirmed'), printed: checked('printed'), proposalPrinted: checked('proposalPrinted') });
  if (action === 'handover') payload.signed = checked('signed');
  if (action === 'workshop-receive') Object.assign(payload, { unitPrice: value('unitPrice'), expectedDate: value('expectedDate') });
  if (['reject', 'send-back'].includes(action) && !payload.note.trim()) {
    error.textContent = action === 'reject' ? 'Vui lòng nhập lý do từ chối vào ô ý kiến.' : 'Vui lòng nhập lý do trả lại vào ô ghi chú.';
    form.querySelector('[name="note"]')?.focus();
    return;
  }
  if (action === 'send-back' && !confirm('Trả hồ sơ về bước trước?')) return;
  form.querySelectorAll('button').forEach((item) => { item.disabled = true; });
  error.textContent = '';
  try {
    if (action === 'reconcile') {
      payload.photos = {};
      for (const key of ['erp', 'transferPrint', 'proposalPrint']) payload.photos[key] = await readFiles(form.querySelector(`[name="photo-${key}"]`));
    }
    if (['create-transfer', 'send-wash', 'return-wash', 'handover'].includes(action)) payload.files = await readFiles(form.querySelector('[name="files"]'));
    await request(`/api/production/${detailModal.dataset.orderId}/action`, { method: 'POST', body: JSON.stringify(payload) });
    await load();
  } catch (requestError) {
    error.textContent = requestError.message;
    form.querySelectorAll('button').forEach((item) => { item.disabled = false; });
  }
}

detail.addEventListener('click', (event) => {
  const actionButton = event.target.closest('[data-action]');
  if (actionButton) return runAction(actionButton);
  if (event.target.closest('[data-print]')) return window.print();
  if (event.target.closest('[data-print-proposal]')) return printProposal(state.orders.find((order) => order.id === detailModal.dataset.orderId));
  if (event.target.closest('[data-resubmit]')) return openCreate(state.orders.find((order) => order.id === detailModal.dataset.orderId));
  if (event.target.closest('[data-add-fabric]')) {
    const rows = event.target.closest('[data-action-form]').querySelector('[data-fabric-rows]');
    rows.insertAdjacentHTML('beforeend', fabricRow({}, rows.dataset.field));
  }
  if (event.target.closest('[data-remove-row]')) {
    const rows = event.target.closest('[data-fabric-rows]');
    if (rows.children.length > 1) event.target.closest('[data-fabric-row]').remove();
  }
});
detail.addEventListener('input', updateLossPreview);

// Phiếu đề xuất: định mức, màu/size, chữ ký.
const signatureCanvas = createForm.querySelector('[data-signature]');
const signatureContext = signatureCanvas.getContext('2d');
const signatureStatus = createForm.querySelector('[data-signature-status]');
let signaturePointer = null;
let hasSignature = false;
signatureContext.strokeStyle = '#173f78';
signatureContext.lineWidth = 2.5;
signatureContext.lineCap = 'round';
signatureContext.lineJoin = 'round';
function signaturePoint(event) {
  const bounds = signatureCanvas.getBoundingClientRect();
  return { x: (event.clientX - bounds.left) * signatureCanvas.width / bounds.width, y: (event.clientY - bounds.top) * signatureCanvas.height / bounds.height };
}
signatureCanvas.addEventListener('pointerdown', (event) => {
  if (!event.isPrimary || event.button !== 0) return;
  event.preventDefault();
  signaturePointer = event.pointerId;
  signatureCanvas.setPointerCapture(event.pointerId);
  const point = signaturePoint(event);
  signatureContext.beginPath();
  signatureContext.moveTo(point.x, point.y);
  signatureContext.lineTo(point.x + 0.1, point.y + 0.1);
  signatureContext.stroke();
});
signatureCanvas.addEventListener('pointermove', (event) => {
  if (event.pointerId !== signaturePointer) return;
  const point = signaturePoint(event);
  signatureContext.lineTo(point.x, point.y);
  signatureContext.stroke();
});
['pointerup', 'pointercancel', 'lostpointercapture'].forEach((type) => signatureCanvas.addEventListener(type, (event) => {
  if (event.pointerId !== signaturePointer) return;
  signaturePointer = null;
  hasSignature = true;
  signatureStatus.textContent = 'Đã có chữ ký';
}));
function clearSignature() {
  signatureContext.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height);
  hasSignature = false;
  signatureStatus.textContent = 'Chưa có chữ ký';
}
createForm.querySelector('[data-clear-signature]').addEventListener('click', clearSignature);

const variantRows = createForm.querySelector('[data-variant-rows]');
function addVariant(row = {}) {
  variantRows.insertAdjacentHTML('beforeend', `<div class="production-row" data-variant-row>
    <input name="color" placeholder="Màu" maxlength="60" value="${escapeHtml(row.color || '')}" />
    <input name="size" placeholder="Size" maxlength="30" value="${escapeHtml(row.size || '')}" />
    <input name="variantQuantity" type="number" min="1" step="1" inputmode="numeric" placeholder="SL" value="${row.quantity ?? ''}" />
    <button type="button" class="production-row-remove" data-remove-row aria-label="Xóa dòng">×</button></div>`);
}
createForm.querySelector('[data-add-variant]').addEventListener('click', () => addVariant());
variantRows.addEventListener('click', (event) => event.target.closest('[data-remove-row]')?.closest('[data-variant-row]').remove());
createForm.addEventListener('input', () => {
  const quantity = Number(createForm.elements.quantity.value);
  const norm = Number(createForm.elements.fabricNorm.value);
  const variantTotal = [...variantRows.querySelectorAll('[name="variantQuantity"]')].reduce((sum, input) => sum + Number(input.value || 0), 0);
  createForm.querySelector('[data-fabric-estimate]').textContent = [
    quantity && norm ? `Vải dự kiến: ${formatNumber(quantity * norm)} m.` : '',
    variantTotal ? `Tổng theo màu/size: ${formatNumber(variantTotal)}${quantity && variantTotal !== quantity ? ` (chưa khớp ${formatNumber(quantity)})` : ''}.` : '',
  ].join(' ');
});

function openCreate(order = null) {
  createForm.reset();
  clearSignature();
  variantRows.innerHTML = '';
  createError.textContent = '';
  resubmitOrderId = order?.id || '';
  document.querySelector('[data-create-title]').textContent = order ? `Sửa & gửi lại ${order.code}` : 'Lập phiếu đề xuất sản xuất';
  if (order) {
    ['date', 'productCode', 'productName', 'quantity', 'fabricNorm', 'note', 'signatureName'].forEach((name) => { createForm.elements[name].value = order.proposal[name] ?? ''; });
    order.proposal.variants?.forEach(addVariant);
  } else {
    createForm.elements.date.value = todayKey();
  }
  createForm.dispatchEvent(new Event('input'));
  detailModal.hidden = true;
  createModal.hidden = false;
  createForm.elements.productCode.focus();
}

createForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  createError.textContent = '';
  if (!createForm.reportValidity()) return;
  if (!hasSignature) {
    createError.textContent = 'Vui lòng ký tên trong khung chữ ký.';
    return;
  }
  const data = Object.fromEntries(['date', 'productCode', 'productName', 'quantity', 'fabricNorm', 'note', 'signatureName'].map((name) => [name, createForm.elements[name].value]));
  data.variants = [...variantRows.querySelectorAll('[data-variant-row]')].map((row) => ({ color: row.querySelector('[name="color"]').value, size: row.querySelector('[name="size"]').value, quantity: row.querySelector('[name="variantQuantity"]').value }));
  data.signatureData = signatureCanvas.toDataURL('image/png');
  const submitButton = createForm.querySelector('[type="submit"]');
  submitButton.disabled = true;
  try {
    const result = resubmitOrderId
      ? await request(`/api/production/${resubmitOrderId}/action`, { method: 'POST', body: JSON.stringify({ action: 'resubmit', ...data }) })
      : await request('/api/production', { method: 'POST', body: JSON.stringify(data) });
    createModal.hidden = true;
    activeTab = 'all';
    await load();
    openDetail(result.order.id);
  } catch (error) {
    createError.textContent = error.message;
  } finally {
    submitButton.disabled = false;
  }
});

// Phân công người phụ trách.
function openSettings() {
  const selected = Object.fromEntries(Object.entries(state.assignees).map(([role, people]) => [role, new Set(people.map((person) => person.id))]));
  settingsForm.querySelector('[data-settings-roles]').innerHTML = Object.entries(state.roles).map(([role, info]) => ({ role, label: info?.label ?? info, hint: info?.hint ?? '' })).map(({ role, label, hint }) => `
    <fieldset class="production-fieldset" data-role="${role}"><legend>${escapeHtml(label)}</legend>${hint ? `<p class="production-muted">${escapeHtml(hint)}</p>` : ''}<div class="production-people">
      ${state.users.map((user) => `<label class="production-person"><input type="checkbox" value="${escapeHtml(user.id)}" ${selected[role]?.has(user.id) ? 'checked' : ''} /><span>${escapeHtml(user.name)}<small>${escapeHtml(user.email)}</small></span></label>`).join('')}
    </div></fieldset>`).join('');
  settingsForm.querySelector('[data-settings-error]').textContent = '';
  settingsModal.hidden = false;
}
settingsForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const assignees = Object.fromEntries([...settingsForm.querySelectorAll('[data-role]')].map((fieldset) => [fieldset.dataset.role, [...fieldset.querySelectorAll('input:checked')].map((input) => input.value)]));
  try {
    await request('/api/production/settings', { method: 'POST', body: JSON.stringify({ assignees }) });
    settingsModal.hidden = true;
    await load();
  } catch (error) {
    settingsForm.querySelector('[data-settings-error]').textContent = error.message;
  }
});

document.querySelector('[data-open-create]').addEventListener('click', () => openCreate());
document.querySelector('[data-open-settings]').addEventListener('click', openSettings);
document.querySelectorAll('[data-close-modal]').forEach((button) => button.addEventListener('click', () => { button.closest('.production-modal').hidden = true; }));
document.querySelectorAll('.production-modal').forEach((modal) => modal.addEventListener('click', (event) => { if (event.target === modal) modal.hidden = true; }));
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') document.querySelectorAll('.production-modal').forEach((modal) => { modal.hidden = true; }); });
document.querySelector('[data-tabs]').addEventListener('click', (event) => {
  const tab = event.target.closest('[data-tab]');
  if (!tab) return;
  activeTab = tab.dataset.tab;
  stageFilter = '';
  render();
});
summary.addEventListener('click', (event) => {
  const chip = event.target.closest('[data-stage-filter]');
  if (!chip) return;
  stageFilter = stageFilter === chip.dataset.stageFilter ? '' : chip.dataset.stageFilter;
  activeTab = 'all';
  render();
});
searchInput.addEventListener('input', render);
list.addEventListener('click', (event) => {
  const item = event.target.closest('[data-open-order]');
  if (item) openDetail(item.dataset.openOrder);
});

load();
})();
