(function () {
const maxWashLoss = 0.05;
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
const todayKey = () => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const value = (type) => parts.find((part) => part.type === type)?.value || '';
  return `${value('year')}-${value('month')}-${value('day')}`;
};
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
    if (activeTab === 'active' && ['in-production', 'completed'].includes(order.status)) return false;
    if (activeTab === 'producing' && order.status !== 'in-production') return false;
    if (activeTab === 'loss' && !order.washLossAlert?.exceeded) return false;
    if (stageFilter && order.status !== stageFilter) return false;
    if (!query) return true;
    return [order.code, order.proposal.productCode, order.proposal.productName].some((value) => value.toLowerCase().includes(query));
  });
}

function render() {
  document.querySelectorAll('[data-tab]').forEach((tab) => tab.setAttribute('aria-selected', String(tab.dataset.tab === activeTab)));
  const lossTab = document.querySelector('[data-tab="loss"]');
  if (lossTab) lossTab.hidden = !state.me.canManage;
  const mineCount = state.orders.filter((order) => order.canAct).length;
  const mineTab = document.querySelector('[data-tab="mine"]');
  mineTab.innerHTML = `Việc của tôi${mineCount ? ` <span class="notification-badge is-inline">${mineCount > 99 ? '99+' : mineCount}</span>` : ''}`;
  const counts = state.orders.reduce((result, order) => ({ ...result, [order.status]: (result[order.status] || 0) + 1 }), {});
  summary.innerHTML = [...state.stageOrder, 'completed', 'rejected'].filter((stage) => counts[stage]).map((stage) => `
    <button type="button" class="production-stage-chip${stageFilter === stage ? ' is-active' : ''}" data-stage-filter="${stage}" data-stage="${stage}">
      <strong>${counts[stage]}</strong><span>${escapeHtml(state.stages[stage].label)}</span>
    </button>`).join('');
  const orders = filteredOrders();
  list.innerHTML = orders.length ? orders.map((order) => `
    <div class="production-item-wrap"><button type="button" class="production-item" data-open-order="${order.id}">
      <span class="production-item-main">
        <span class="production-item-code">${escapeHtml(order.code)}${order.canAct ? '<em>Cần bạn xử lý</em>' : ''}${order.washLossAlert?.exceeded ? `<em class="is-danger">Hao hụt &gt; 5%: ${escapeHtml(order.washLossAlert.items.map((item) => `${item.fabricCode} (${item.lossPercent}%)`).join(', '))}</em>` : ''}${isOverdue(order) ? '<em class="is-danger">Trễ hạn giao</em>' : ''}</span>
        <strong>${escapeHtml(order.proposal.productCode)} · ${escapeHtml(order.proposal.productName)}</strong>
        <span class="production-muted">SL ${formatNumber(order.proposal.quantity)} · Lập bởi ${escapeHtml(order.createdBy.name)} · Cập nhật ${formatDateTime(order.updatedAt)}</span>
      </span>
      <span class="production-badge" data-stage="${order.status}">${escapeHtml(order.stageLabel)}</span>
    </button>${state.me.canManage ? `<button type="button" class="production-delete-order" data-delete-order="${order.id}" aria-label="Xóa ${escapeHtml(order.code)}">Xóa</button>` : ''}</div>`).join('') : `<p class="production-empty">${activeTab === 'mine' ? 'Không có hồ sơ nào đang chờ bạn xử lý.' : 'Chưa có hồ sơ nào.'}</p>`;
}

function stepper(order) {
  const currentIndex = state.stageOrder.indexOf(order.status);
  const canReviewHistory = state.me.canManage || state.me.roles.includes('view-history');
  const visibleStages = state.stageOrder.map((stage, index) => ({ stage, index }));
  return `<ol class="production-stepper">${visibleStages.map(({ stage, index }, visibleIndex) => {
    const status = order.status === 'rejected' ? (index === 0 ? 'is-rejected' : '') : order.status === 'completed' || index < currentIndex ? 'is-done' : index === currentIndex ? 'is-current' : '';
    return `<li class="${status}"><button type="button" ${canReviewHistory ? `data-view-stage="${stage}"` : 'disabled'} title="${canReviewHistory ? `Xem tiến độ ${escapeHtml(state.stages[stage].label)}` : 'Bạn chưa được cấp quyền xem lại tiến độ'}"><span>${visibleIndex + 1}</span><small>${escapeHtml(state.stages[stage].label)}</small></button></li>`;
  }).join('')}</ol>`;
}

function stageFiles(order, stage) {
  if (stage === 'washing') return [...(order.wash?.files || []).map((file) => ({ ...file, section: 'Gửi vải đi wash' })), ...(order.wash?.returnFiles || []).map((file) => ({ ...file, section: 'Hàng wash về' }))];
  if (stage === 'handover') return (order.handover?.files || []).map((file) => ({ ...file, section: 'Bàn giao xưởng' }));
  if (stage === 'reconcile') return Object.entries(order.reconcile?.photos || {}).flatMap(([key, list]) => list.map((file) => ({ ...file, section: ({ erp: 'Xác nhận ERPNext', transferPrint: 'Phiếu chuyển kho đã in', proposalPrint: 'Phiếu đề xuất đã in' })[key] || 'Đối chiếu' })));
  if (stage === 'product-receive') return [...(order.receipt?.documentFiles || []).map((file) => ({ ...file, section: 'Chứng từ Vận hành & Kế toán xác nhận' })), ...(order.receipt?.productFiles || []).map((file) => ({ ...file, section: 'Ảnh sản phẩm tiếp nhận' }))];
  return [];
}

function renderStageProgress(order, stage) {
  if (!state.me.canManage && !state.me.roles.includes('view-history')) return;
  const stageInfo = state.stages[stage] || {};
  // Hồ sơ cũ còn dữ liệu đưa vải đi wash / nhận hàng wash về; vẫn hiển thị trong bước "Soạn vải".
  const covered = stage === 'fabric-prep' ? ['fabric-prep', 'washing'] : [stage];
  const entries = (order.history || []).filter((item) => covered.includes(item.stage) || (covered.includes('fabric-prep') && item.action.includes('xác nhận bảng')) || (covered.includes('washing') && item.action.includes('wash')));
  const files = covered.flatMap((item) => stageFiles(order, item));
  const details = covered.map((item) => stageProgressDetails(order, item)).join('');
  detail.querySelector('[data-stage-progress]')?.remove();
  const host = document.createElement('section');
  host.className = 'production-stage-progress';
  host.dataset.stageProgress = '';
  host.innerHTML = `<div class="production-stage-progress-head"><div><span class="production-eyebrow">Tiến độ bước</span><h3>${escapeHtml(stageInfo.label || stage)}</h3></div><button type="button" class="production-row-remove" data-close-stage-progress aria-label="Đóng">×</button></div>
    ${details}
    ${entries.length ? `<ol class="production-history">${entries.map((item) => `<li><strong>${escapeHtml(item.action)}</strong><span>${escapeHtml(item.name)} · ${formatDateTime(item.at)}</span>${item.note ? `<p>${escapeHtml(item.note)}</p>` : ''}</li>`).join('')}</ol>` : '<p class="production-muted">Bước này chưa được thực hiện.</p>'}
    ${files.length ? `<div class="production-stage-files">${files.map((file) => `<div><p class="production-hint">${escapeHtml(file.section)}</p>${fileList(order, [file])}</div>`).join('')}</div>` : ''}`;
  detail.querySelector('.production-stepper').insertAdjacentElement('afterend', host);
  host.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function stageProgressDetails(order, stage) {
  const proposal = order.proposal || {};
  const rows = (values) => `<dl class="production-info production-stage-detail">${values.filter(([, value]) => value !== '' && value != null).map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${value}</dd></div>`).join('')}</dl>`;
  if (stage === 'approval-1') return rows([
    ['Người lập', escapeHtml(order.createdBy?.name)], ['Ngày lập', formatDateTime(order.createdAt)],
    ['Mã sản phẩm', escapeHtml(proposal.productCode)], ['Tên sản phẩm', escapeHtml(proposal.productName)],
    ...(proposal.deliveryDate ? [['Ngày giao dự kiến', formatDate(proposal.deliveryDate)]] : []), ['Số lượng', formatNumber(proposal.quantity)],
    ['Giá bán đề xuất', proposal.suggestedSellingPrice ? `${formatNumber(proposal.suggestedSellingPrice)} đ/sp` : 'Chưa nhập'],
    ['Trạng thái duyệt', order.approvals?.['approval-1'] ? `Đã duyệt bởi ${escapeHtml(order.approvals['approval-1'].name)}` : 'Chưa duyệt'],
  ]);
  if (stage === 'approval-2') return rows([
    ['Duyệt cấp 1', order.approvals?.['approval-1'] ? `${escapeHtml(order.approvals['approval-1'].name)} · ${formatDateTime(order.approvals['approval-1'].at)}` : 'Chưa duyệt'],
    ['Duyệt cấp 2', order.approvals?.['approval-2'] ? `${escapeHtml(order.approvals['approval-2'].name)} · ${formatDateTime(order.approvals['approval-2'].at)}` : 'Chưa duyệt'],
  ]);
  if (stage === 'fabric-prep') return `${rows([['Số lượng xác nhận', formatNumber(proposal.quantity)], ['Số dòng size', proposal.technicalRows?.length || 0]])}${productionQuantityTable(proposal, order.fabrics)}`;
  if (stage === 'washing') return `${rows([
    ['Đơn vị wash', escapeHtml(order.wash?.vendor || '')], ['Đưa đi wash', formatDateTime(order.wash?.sentAt)],
    ['Nhận hàng wash', formatDateTime(order.wash?.returnedAt)],
    ['Số mã vải', order.fabrics?.length || 0],
  ])}${fabricTable(order)}`;
  if (stage === 'reconcile') return rows([
    ['Hao hụt cho phép', 'Tối đa 5%'], ['Mã vải vượt', escapeHtml(order.reconcile?.overLimit?.join(', ') || '')],
    ['Lý do hao hụt', escapeHtml(order.reconcile?.lossNote || '')], ['Xác nhận lúc', formatDateTime(order.reconcile?.at)],
    ['Người xác nhận', escapeHtml(order.reconcile?.name)],
  ]) + fabricTable(order);
  if (stage === 'handover') return rows([
    ['Người bàn giao', escapeHtml(order.handover?.name)], ['Thời gian bàn giao', formatDateTime(order.handover?.at)],
    ['Trạng thái', order.handover ? 'Đã bàn giao cho xưởng' : 'Chưa bàn giao'],
  ]);
  if (stage === 'workshop-receive') return rows([
    ['Người nhận', escapeHtml(order.workshop?.name)], ['Ngày nhận', formatDateTime(order.workshop?.receivedAt)],
    ['Đơn giá', order.workshop?.unitPrice ? `${formatNumber(order.workshop.unitPrice)} đ/sp` : ''],
    ['Giao dự kiến', formatDate(order.workshop?.expectedDate)],
    ['Thành tiền dự kiến', order.workshop?.unitPrice ? `${formatNumber(order.workshop.unitPrice * proposal.quantity)} đ` : ''],
  ]);
  if (stage === 'selling-price') return rows([
    ['Người tính giá', escapeHtml(order.sellingPrice?.name)], ['Thời gian', formatDateTime(order.sellingPrice?.at)],
    ['Giá bán', order.sellingPrice?.value ? `${formatNumber(order.sellingPrice.value)} đ/sp` : ''],
  ]);
  if (stage === 'in-production') return rows([
    ['Trạng thái', 'Đang sản xuất'], ['Ngày giao dự kiến', formatDate(order.workshop?.expectedDate)],
    ['Người xưởng nhận', escapeHtml(order.workshop?.name)],
  ]);
  if (stage === 'final-approval-2') return rows([
    ['Trạng thái', order.approvals?.['final-approval-2'] ? 'Đã duyệt cấp 2' : 'Chờ duyệt cấp 2'],
    ['Người duyệt', escapeHtml(order.approvals?.['final-approval-2']?.name)],
    ['Thời gian duyệt', formatDateTime(order.approvals?.['final-approval-2']?.at)],
  ]);
  if (stage === 'product-receive') return rows([
    ['Số lượng sản phẩm đã nhận', formatNumber(order.receipt?.receivedQuantity)],
    ['Người tiếp nhận', escapeHtml(order.receipt?.name)],
    ['Thời gian tiếp nhận', formatDateTime(order.receipt?.at)],
  ]);
  if (stage === 'completed') return rows([
    ['Số lượng sản phẩm đã nhận', formatNumber(order.receipt?.receivedQuantity)],
    ['Người tiếp nhận', escapeHtml(order.receipt?.name)],
    ['Thời gian tiếp nhận', formatDateTime(order.receipt?.at)],
  ]);
  return '';
}

function fabricTable(order) {
  if (!order.fabrics?.length) return '';
  const hasCut = order.fabrics.some((fabric) => fabric.cutMeters);
  const hasWash = order.fabrics.some((fabric) => fabric.washedMeters != null);
  return `<div class="production-table-wrap"><table class="production-table">
    <thead><tr><th>Mẫu vải</th><th>Soạn (m)</th>${hasCut ? '<th>Cắt trước wash (m)</th>' : ''}${hasWash ? '<th>Sau wash (m)</th><th>Hao hụt</th>' : ''}</tr></thead>
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
    <input name="fabricCode" placeholder="Mẫu vải" value="${escapeHtml(row.fabricCode || '')}" ${editableCode ? '' : 'readonly'} maxlength="60" />
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
    'approval-1': () => `<div class="production-selling-product">
        <div><span>Mã sản phẩm</span><strong>${escapeHtml(order.proposal.productCode)}</strong></div>
        <div><span>Tên sản phẩm</span><strong>${escapeHtml(order.proposal.productName)}</strong></div>
        <div><span>Số lượng dự kiến</span><strong>${formatNumber(order.proposal.quantity)} sản phẩm</strong></div>
      </div>
      <label>Giá bán đề xuất (đ/sản phẩm)<input name="suggestedSellingPrice" type="number" min="1" step="1" inputmode="numeric" value="${escapeHtml(order.proposal.suggestedSellingPrice || '')}" required /></label>
      <div class="production-approval-signature-box">
        <h4>Chữ ký duyệt cấp 1</h4>
        <canvas class="production-signature" width="600" height="200" aria-label="Bảng ký duyệt" data-approval-signature></canvas>
        <div class="production-signature-actions"><span data-approval-signature-status>Chưa có chữ ký</span><button class="production-link-button" type="button" data-clear-approval-signature>Xóa / Ký lại</button></div>
        <label>Họ và tên người duyệt<input name="approvalName" maxlength="150" value="${escapeHtml(state.me.name || '')}" required /></label>
      </div>
      <div class="production-rejection-box" data-rejection-box hidden><label>Lý do từ chối<textarea name="note" rows="3" maxlength="500" placeholder="Nhập rõ lý do từ chối..."></textarea></label><div class="production-form-actions"><button class="production-button is-ghost" type="button" data-cancel-reject>Quay lại</button><button class="production-button is-danger" type="button" data-action="reject">Xác nhận từ chối</button></div></div>
      <div class="production-form-actions" data-approval-actions><button class="production-button is-danger" type="button" data-show-reject>Từ chối</button><button class="production-button" type="button" data-action="approve" disabled data-approve-button>Duyệt</button></div>`,
    'approval-2': () => forms['approval-1']().replace('Chữ ký duyệt cấp 1', 'Chữ ký duyệt cấp 2'),
    'final-approval-2': () => forms['approval-1']().replace('Chữ ký duyệt cấp 1', 'Chữ ký duyệt cấp 2'),
    rejected: () => `<div class="production-form-actions"><button class="production-button" type="button" data-resubmit>Sửa &amp; gửi lại</button></div>`,
    'fabric-prep': () => `<p class="production-hint">Số m sau wash đã được đối chiếu. Kiểm tra và chỉnh lần cuối bảng số lượng theo size, rồi bấm xác nhận bàn giao.</p>
      <section class="production-paper-back is-step-editor">
        <h3>BẢNG SỐ LƯỢNG ĐỀ XUẤT THEO SIZE</h3>
        <div class="paper-back-product-code"><strong>MÃ SP:</strong><span>${escapeHtml(order.proposal.productCode)}</span></div>
        ${sizeTableMarkup()}
      </section>
      <div class="production-form-actions"><button class="production-button" type="button" data-action="prepare-fabric">Xác nhận bảng</button></div>`,
    reconcile: () => {
      const overLimit = order.fabrics.filter((fabric) => lossOf(fabric) > maxWashLoss);
      return `<p class="production-hint">Nhập số m sau wash của từng mã vải (so với số m trước wash), rồi xác nhận trên ERPNext. Hao hụt cho phép tối đa 5%.</p>
        ${fabricInputs(order.fabrics, 'washedMeters', { editableCode: false, allowAdd: false })}
        ${overLimit.length ? `<p class="production-alert">Hao hụt vượt 5%: ${overLimit.map((fabric) => `${escapeHtml(fabric.fabricCode)} (${(lossOf(fabric) * 100).toFixed(1)}%)`).join(', ')}. Bắt buộc ghi lý do.</p>` : ''}
        <label>Lý do hao hụt (bắt buộc nếu hao hụt vượt 5%)<textarea name="lossNote" rows="2" maxlength="500"></textarea></label>
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
      <div class="production-grid"><label>Đơn giá sản xuất (đ/sản phẩm)<input name="unitPrice" type="number" min="1" step="1" inputmode="numeric" /></label><label>Ngày giao hàng dự kiến<input name="expectedDate" type="date" min="${todayKey()}" /></label></div>${note()}
      <div class="production-form-actions">${sendBack}<button class="production-button" type="button" data-action="workshop-receive">Xác nhận đã nhận</button></div>`,
    'selling-price': () => `<p class="production-hint">Nhập giá bán dự kiến cho mỗi sản phẩm.</p>
      <div class="production-selling-product">
        <div><span>Mã sản phẩm</span><strong>${escapeHtml(order.proposal.productCode)}</strong></div>
        <div><span>Tên sản phẩm</span><strong>${escapeHtml(order.proposal.productName)}</strong></div>
        <div><span>Số lượng dự kiến</span><strong>${formatNumber(order.proposal.quantity)} sản phẩm</strong></div>
      </div>
      ${order.proposal.suggestedSellingPrice ? `<p class="production-hint">Giá bán đề xuất từ bước duyệt cấp 1: <strong>${formatNumber(order.proposal.suggestedSellingPrice)} đ/sản phẩm</strong></p>` : ''}
      ${order.workshop?.unitPrice ? `<p class="production-hint">Giá xưởng đã nhập: <strong>${formatNumber(order.workshop.unitPrice)} đ/sản phẩm</strong></p>` : ''}
      <div class="production-grid"><label>Giá bán cho sản phẩm này (đ/sản phẩm)<input name="sellingPrice" type="number" min="1" step="1" inputmode="numeric" required /></label></div>${note()}
      <div class="production-form-actions">${sendBack}<button class="production-button" type="button" data-action="selling-price">Xác nhận giá bán</button></div>`,
    'in-production': () => `<p class="production-hint">Khi xưởng đã sản xuất xong, xác nhận hoàn tất để chuyển sang bước tiếp nhận sản phẩm.</p>${note()}
      <div class="production-form-actions"><button class="production-button" type="button" data-action="complete-production">Xưởng báo hoàn tất sản xuất</button></div>`,
    'product-receive': () => `<p class="production-hint">Nhập số lượng sản phẩm thực nhận và tải ảnh chứng từ đã được Vận hành, Kế toán xác nhận cùng ảnh sản phẩm.</p>
      <label>Số lượng sản phẩm đã nhận<input name="receivedQuantity" type="number" min="1" step="1" inputmode="numeric" required /></label>
      <label>Ảnh chứng từ đã xác nhận từ Vận hành và Kế toán (bắt buộc)<input name="photo-documents" type="file" accept="image/*" capture="environment" required /></label>
      <label>Ảnh sản phẩm tiếp nhận (bắt buộc)<input name="photo-products" type="file" accept="image/*" capture="environment" required /></label>${note()}
      <div class="production-form-actions">${sendBack}<button class="production-button" type="button" data-action="product-receive">Xác nhận tiếp nhận sản phẩm</button></div>`,
  };
  return forms[order.status] ? `<section class="production-action" data-action-form><h3>${escapeHtml(order.stageStep)} · ${escapeHtml(order.stageLabel)}</h3>${forms[order.status]()}<p class="production-error" data-action-error role="alert"></p></section>` : '';
}

function proposalApprovalPreview(order) {
  const proposal = order.proposal;
  const changes = (proposal.changeNotes || []).map((row) => typeof row === 'string' ? { detail: row } : row).filter((row) => row.content || row.detail);
  return `<div class="production-approval-document">
    <section class="production-approval-page">
      <h3>PHIẾU ĐỀ XUẤT SẢN XUẤT</h3>
      <p class="production-approval-proposal-date"><b>NGÀY ĐỀ XUẤT:</b> ${formatDate(proposal.date)}</p>
      <p class="production-approval-product-line"><span><b>MÃ SP:</b> ${escapeHtml(proposal.productCode)}</span><span><b>TÊN SP:</b> ${escapeHtml(proposal.productName)}</span></p>
      <p><b>LÝ DO SẢN XUẤT:</b> ${escapeHtml(proposal.reason || '')}</p>
      ${proposal.deliveryDate ? `<p><b>NGÀY GIAO HÀNG DỰ KIẾN:</b> ${formatDate(proposal.deliveryDate)}</p>` : ''}
      <div class="production-approval-status">
        <b>TÌNH TRẠNG</b>
        <span>- Mẫu thực tế: ${escapeHtml(proposal.sampleStatus || 'Có')}</span>
        <span>- Rập: ${escapeHtml(proposal.patternStatus || 'Có')}</span>
        <span>- Hình ảnh SP: ${escapeHtml(proposal.imageStatus || 'Có')}</span>
        <span>- Định mức: ${formatNumber(proposal.fabricNorm)} m</span>
        <span>- Size mẫu: ${escapeHtml(proposal.sampleSize || '')}</span>
      </div>
      <div class="production-approval-photo">${proposal.productImage ? `<img src="${escapeHtml(proposal.productImage)}" alt="Ảnh sản phẩm" />` : '<span>Ảnh sản phẩm / mẫu</span>'}</div>
      <table class="production-approval-table"><thead><tr><th>STT</th><th>Nội dung</th><th>Chi tiết thay đổi so với mẫu</th></tr></thead><tbody>${(changes.length ? changes : [{}]).map((row, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(row.content || '')}</td><td>${escapeHtml(row.detail || '')}</td></tr>`).join('')}</tbody></table>
      <div class="production-approval-signs">
        <div><b>TP. KINH DOANH</b><span>Họ và tên: ____________________</span></div>
        <div><b>NGƯỜI ĐỀ XUẤT</b><img src="${escapeHtml(proposal.signatureData)}" alt="Chữ ký" /><span>Họ và tên: ${escapeHtml(proposal.signatureName)}</span></div>
        <div><b>BP. SẢN XUẤT</b><span>Họ và tên: ____________________</span></div>
      </div>
    </section>
    <section class="production-approval-page">
      <h3>BẢNG SỐ LƯỢNG ĐỀ XUẤT THEO SIZE</h3>
      <p><b>MÃ SP:</b> ${escapeHtml(proposal.productCode)}</p>
      ${productionQuantityTable(proposal, order.fabrics)}
    </section>
  </div>`;
}

const maxSizeColumns = 10;
const maxSizeRows = 10;
const legacySizeKeys = ['s', 'm', 'l', 'xl', 'xxl'];

// Cột size do người dùng tự đặt tên; phiếu cũ (S/M/L/XL/XXL cố định) vẫn đọc được.
function sizeColumnsOf(proposal) {
  const saved = Array.isArray(proposal?.sizeColumns) ? proposal.sizeColumns.filter((label) => String(label ?? '').trim()) : [];
  if (saved.length) return saved;
  const legacy = (proposal?.technicalRows || []).some((row) => legacySizeKeys.some((key) => row[key]));
  return legacy ? ['S', 'M', 'L', 'XL', 'XXL'] : ['S'];
}

function sizeValuesOf(row, columns) {
  return columns.map((label, index) => Array.isArray(row.sizes) ? row.sizes[index] ?? '' : row[String(label).toLowerCase()] ?? '');
}

const sizeTotalOf = (values) => values.reduce((sum, value) => sum + (Number(value) || 0), 0);

function productionQuantityTable(proposal, fabrics = []) {
  const columns = sizeColumnsOf(proposal);
  const rows = (proposal?.technicalRows || []).filter((row) => row.item || row.requirement || row.actual || sizeValuesOf(row, columns).some(Boolean));
  const sizeWidth = Math.max(4, Math.floor(40 / columns.length));
  const body = (rows.length ? rows : [{}]).map((row) => {
    const sizes = sizeValuesOf(row, columns);
    const fabric = fabrics.find((item) => String(item.fabricCode || '').trim().toLowerCase() === String(row.item || '').trim().toLowerCase());
    const actual = row.actual || (fabric?.washedMeters != null ? String(fabric.washedMeters) : '');
    return `<tr><td>${escapeHtml(row.item || '')}</td><td>${escapeHtml(row.requirement || '')}</td><td>${escapeHtml(actual)}</td>${sizes.map((value) => `<td>${escapeHtml(value || '0')}</td>`).join('')}<td>${sizeTotalOf(sizes)}</td></tr>`;
  }).join('');
  return `<table class="production-quantity-table"><colgroup><col style="width:18%"><col style="width:14%"><col style="width:14%">${columns.map(() => `<col style="width:${sizeWidth}%">`).join('')}<col style="width:12%"></colgroup><thead><tr><th>Mẫu vải</th><th>Số m trước wash</th><th>Số m sau wash</th>${columns.map((label) => `<th>${escapeHtml(label)}</th>`).join('')}<th>Tổng cộng</th></tr></thead><tbody>${body}</tbody></table>`;
}

// Bảng nhập số lượng theo size dùng chung cho phiếu lập đề xuất và bước soạn vải.
function sizeTableMarkup() {
  return `<div class="production-size-table" data-size-table>
    <div class="production-technical-scroll">
      <div class="production-technical-head" data-size-head></div>
      <div class="production-rows" data-size-rows></div>
    </div>
    <div class="production-size-actions">
      <button class="production-link-button" type="button" data-add-size-row>+ Thêm dòng</button>
      <button class="production-link-button" type="button" data-add-size-column>+ Thêm cột size</button>
    </div>
  </div>`;
}

function sizeRowMarkup(row, columns, { lockActual = false } = {}) {
  const sizes = sizeValuesOf(row, columns);
  return `<div class="production-technical-row" data-size-row>
    <input name="technical-item" maxlength="100" placeholder="Mẫu vải" value="${escapeHtml(row.item || '')}" />
    <input name="technical-requirement" type="number" min="0" step="0.01" inputmode="decimal" placeholder="Số m" value="${escapeHtml(row.requirement || '')}" />
    <input name="technical-actual" type="number" ${lockActual ? 'readonly tabindex="-1" class="is-locked" title="Cột này bị khóa ở bước này"' : 'min="0" step="0.01" inputmode="decimal" placeholder="Số m"'} value="${escapeHtml(row.actual || '')}" />
    ${sizes.map((value) => `<input name="technical-size" type="number" min="0" step="1" inputmode="numeric" placeholder="0" value="${escapeHtml(value)}" data-size-quantity />`).join('')}
    <input name="technical-total" type="number" readonly tabindex="-1" value="${sizeTotalOf(sizes)}" data-size-total />
    <button type="button" class="production-row-remove" data-remove-size-row aria-label="Xóa dòng">×</button>
  </div>`;
}

function renderSizeTable(root, { columns, rows }, options = {}) {
  root.style.setProperty('--size-count', columns.length);
  root.querySelector('[data-size-head]').innerHTML = `<span>Mẫu vải</span><span>Số m trước wash</span><span>Số m sau wash</span>${columns.map((label, index) => `<span class="production-size-head"><input data-size-label value="${escapeHtml(label)}" maxlength="10" placeholder="Size" aria-label="Tên cột size" />${columns.length > 1 ? `<button type="button" data-remove-size="${index}" aria-label="Xóa cột size">×</button>` : ''}</span>`).join('')}<span>Tổng cộng</span><span></span>`;
  root.querySelector('[data-size-rows]').innerHTML = rows.map((row) => sizeRowMarkup(row, columns, options)).join('');
  root.querySelector('[data-add-size-column]').hidden = columns.length >= maxSizeColumns;
  root.querySelector('[data-add-size-row]').hidden = rows.length >= maxSizeRows;
}

function readSizeTable(root) {
  return {
    columns: [...root.querySelectorAll('[data-size-label]')].map((input) => input.value.trim()),
    rows: [...root.querySelectorAll('[data-size-row]')].map((row) => ({
      item: row.querySelector('[name="technical-item"]').value,
      requirement: row.querySelector('[name="technical-requirement"]').value,
      actual: row.querySelector('[name="technical-actual"]').value,
      sizes: [...row.querySelectorAll('[data-size-quantity]')].map((input) => input.value),
    })),
  };
}

// Dữ liệu gửi lên máy chủ; cột size để trống tên sẽ được đặt tên mặc định.
function sizeTablePayload(root) {
  const { columns, rows } = readSizeTable(root);
  return { sizeColumns: columns.map((label, index) => label || `Size ${index + 1}`), technicalRows: rows };
}

function mountSizeTable(root, data, options = {}) {
  renderSizeTable(root, data, options);
  root.addEventListener('input', (event) => {
    const row = event.target.closest('[data-size-row]');
    if (!row || !event.target.matches('[data-size-quantity]')) return;
    row.querySelector('[data-size-total]').value = sizeTotalOf([...row.querySelectorAll('[data-size-quantity]')].map((input) => input.value));
  });
  root.addEventListener('click', (event) => {
    const table = readSizeTable(root);
    if (event.target.closest('[data-add-size-column]')) {
      if (table.columns.length >= maxSizeColumns) return;
      table.columns.push('');
      table.rows.forEach((row) => row.sizes.push(''));
      renderSizeTable(root, table, options);
      root.querySelectorAll('[data-size-label]')[table.columns.length - 1].focus();
      return;
    }
    const removeColumn = event.target.closest('[data-remove-size]');
    if (removeColumn) {
      const index = Number(removeColumn.dataset.removeSize);
      table.columns.splice(index, 1);
      table.rows.forEach((row) => row.sizes.splice(index, 1));
      renderSizeTable(root, table, options);
      return;
    }
    if (event.target.closest('[data-add-size-row]')) {
      if (table.rows.length >= maxSizeRows) return;
      table.rows.push({ item: options.defaultItem || '', sizes: table.columns.map(() => '') });
      renderSizeTable(root, table, options);
      return;
    }
    const removeRow = event.target.closest('[data-remove-size-row]');
    if (removeRow) {
      table.rows.splice([...root.querySelectorAll('[data-size-row]')].indexOf(removeRow.closest('[data-size-row]')), 1);
      if (!table.rows.length) table.rows.push({ item: options.defaultItem || '', sizes: table.columns.map(() => '') });
      renderSizeTable(root, table, options);
    }
  });
}

function openDetail(orderId) {
  const order = state.orders.find((item) => item.id === orderId);
  if (!order) return;
  const proposal = order.proposal;
  const rejection = order.status === 'rejected' ? [...order.history].reverse().find((item) => item.action === 'Từ chối') : null;
  detailModal.dataset.orderId = order.id;
  const approvalReview = ['approval-1', 'approval-2', 'final-approval-2'].includes(order.status);
  detail.innerHTML = `
    <div class="production-detail-head">
      <div><span class="production-eyebrow">${escapeHtml(order.code)}</span><h2 id="production-detail-title">${escapeHtml(proposal.productCode)} · ${escapeHtml(proposal.productName)}</h2></div>
      <div class="production-detail-tools"><span class="production-badge" data-stage="${order.status}">${escapeHtml(order.stageLabel)}</span></div>
    </div>
    ${stepper(order)}
    ${rejection ? `<p class="production-alert">Bị từ chối bởi ${escapeHtml(rejection.name)}: ${escapeHtml(rejection.note)}</p>` : ''}
    ${order.washLossAlert?.exceeded ? `<p class="production-alert"><strong>Cảnh báo hao hụt vượt 5%:</strong> ${escapeHtml(order.washLossAlert.items.map((item) => `${item.fabricCode} (${item.lossPercent}%)`).join(', '))}${order.washLossAlert.lossNote ? `<br><strong>Lý do:</strong> ${escapeHtml(order.washLossAlert.lossNote)}` : ''}</p>` : ''}
    ${isOverdue(order) ? `<p class="production-alert">Đã quá ngày giao dự kiến ${formatDate(order.workshop.expectedDate)}.</p>` : ''}
    ${approvalReview ? '' : actionPanel(order)}
    <section class="production-section"><div class="production-section-head"><h3>Phiếu đề xuất sản xuất</h3><button class="production-button is-secondary" type="button" data-print-proposal>In phiếu đề xuất sản xuất</button></div>
      ${proposalApprovalPreview(order)}
    </section>
    ${approvalReview ? actionPanel(order) : ''}
    ${order.handover?.files?.length ? `<section class="production-section"><h3>Bàn giao cho phòng sản xuất</h3>${infoRows([['Người bàn giao', escapeHtml(order.handover.name)], ['Thời gian', formatDateTime(order.handover.at)]])}${fileList(order, order.handover.files)}</section>` : ''}
    ${order.workshop ? `<section class="production-section"><h3>Xưởng sản xuất</h3>${infoRows([['Người nhận', escapeHtml(order.workshop.name)], ['Ngày nhận', formatDateTime(order.workshop.receivedAt)], ['Đơn giá', `${formatNumber(order.workshop.unitPrice)} đ/sp`], ['Thành tiền dự kiến', `${formatNumber(order.workshop.unitPrice * proposal.quantity)} đ`], ['Giao dự kiến', formatDate(order.workshop.expectedDate)]])}</section>` : ''}
    ${order.sellingPrice ? `<section class="production-section"><h3>Giá bán</h3>${infoRows([['Người tính', escapeHtml(order.sellingPrice.name)], ['Thời gian', formatDateTime(order.sellingPrice.at)], ['Giá bán', `${formatNumber(order.sellingPrice.value)} đ/sp`], ['Doanh thu dự kiến', `${formatNumber(order.sellingPrice.value * proposal.quantity)} đ`]])}</section>` : ''}
    ${order.receipt ? `<section class="production-section"><h3>Tiếp nhận sản phẩm</h3>${infoRows([['Số lượng đã nhận', formatNumber(order.receipt.receivedQuantity)], ['Người tiếp nhận', escapeHtml(order.receipt.name)], ['Thời gian', formatDateTime(order.receipt.at)]])}<p class="production-hint">Chứng từ Vận hành &amp; Kế toán xác nhận</p>${fileList(order, order.receipt.documentFiles)}<p class="production-hint">Ảnh sản phẩm tiếp nhận</p>${fileList(order, order.receipt.productFiles)}</section>` : ''}
    <section class="production-section"><h3>Lịch sử</h3><ol class="production-history">${[...order.history].reverse().map((item) => `<li><strong>${escapeHtml(item.action === 'Duyệt' && item.stage === 'approval-1' ? 'Đã duyệt cấp 1' : item.action === 'Duyệt' && item.stage === 'approval-2' ? 'Đã duyệt cấp 2' : item.action)}</strong><span>${escapeHtml(item.name)} · ${formatDateTime(item.at)}</span>${item.note ? `<p>${escapeHtml(item.note)}</p>` : ''}</li>`).join('')}</ol></section>`;
  detailModal.hidden = false;
  updateLossPreview();
  initializeApprovalSignature();
  initializeFinalQuantityEditor(order);
}

// In phiếu đề xuất sản xuất (BM01/QT.SX.01) trên khổ A4 qua iframe ẩn.
function printProposal(order) {
  const proposal = order.proposal;
  const approval = (stage, title) => {
    const item = order.approvals?.[stage];
    return `<td><strong>${title}</strong>${item ? `<div class="sign">${item.signatureData ? `<img src="${escapeHtml(item.signatureData)}" alt="">` : '<span class="ok">Đã duyệt</span>'}<small>${formatDateTime(item.at)}</small></div><b>${escapeHtml(item.name)}</b>` : '<div class="sign"></div><b>&nbsp;</b>'}</td>`;
  };
  const changeNotes = (proposal.changeNotes || [])
    .map((row) => typeof row === 'string' ? { content: '', detail: row } : row)
    .filter((row) => row.content || row.detail);
  const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${escapeHtml(order.code)} - Phiếu đề xuất sản xuất</title><style>
    @page { size: A4; margin: 10mm 12mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #000; font: 12px/1.32 "Times New Roman", serif; }
    table { width: 100%; border-collapse: collapse; }
    .page { position: relative; height: 277mm; overflow: hidden; page-break-after: always; }
    .page:last-child { page-break-after: auto; }
    .head td { border: 1px solid #000; padding: 6px 8px; }
    .head .brand { width: 22%; font: 700 22px Arial, sans-serif; text-align: center; }
    .head .title { width: 46%; font: 700 14px Arial, sans-serif; text-align: center; }
    .head .meta { font-family: Arial, sans-serif; font-size: 12px; }
    h1 { margin: 9px 0 3px; font: 700 17px Arial, sans-serif; text-align: center; }
    .front { padding: 2mm 7mm 0; }
    .front-proposal-date { position: absolute; top: 0; left: 7mm; margin: 0; font: 11px Arial, sans-serif; }
    .front h1 { margin: 0 0 2.8mm; font: 700 17px Arial, sans-serif; text-align: center; letter-spacing: .15px; }
    .front-info { margin: 0; padding: 0; font: 14px/1.34 Arial, sans-serif; }
    .front-info p { margin: 0; }
    .front-info .front-product-line { display: flex; justify-content: space-between; gap: 12px; }
    .front-info strong { font-size: 13px; text-transform: uppercase; }
    .front-status { margin: 1px 0 0 42px; padding: 0; list-style: none; font-size: 12px; line-height: 1.12; }
    .front-status li::before { content: "-  "; }
    .sample-photo { position: static; display: grid; width: 58mm; height: 63mm; margin: 3mm 0 3mm; overflow: hidden; place-items: center; clear: both; }
    .sample-photo img { display: block; width: 100%; height: 100%; object-fit: contain; }
    .grid { margin-top: 7px; table-layout: fixed; }
    .grid th, .grid td { border: 1px solid #000; padding: 4px 6px; text-align: left; }
    .grid th { background: #f2f2f2; text-align: center; }
    .grid .number { width: 9%; text-align: center; }
    .grid .short { width: 8%; text-align: center; }
    .grid .item { width: 20%; }
    .grid .note-col { width: 18%; }
    .changes { clear: both; margin-top: 2.5mm; font-family: Arial, sans-serif; }
    .changes th { height: 6mm; padding: 2px 5px; font-size: 11px; }
    .changes td { height: 7mm; padding: 2px 5px; font-size: 11px; text-align: center; }
    .changes .content-col { width: 35%; }
    .changes td.is-highlight { background: #fff; font-weight: 400; }
    .changes td:first-child { width: 9%; font-weight: 700; }
    .note { margin: 6px 0 0; }
    .signs { margin-top: 9px; table-layout: fixed; }
    .signs td { border: 1px solid #000; padding: 8px; text-align: center; vertical-align: top; }
    .sign { display: flex; height: 51px; flex-direction: column; align-items: center; justify-content: center; }
    .sign img { max-width: 100%; max-height: 49px; }
    .ok { font-weight: 700; }
    small { display: block; font-size: 11px; }
    .page-label { position: absolute; right: 0; bottom: 0; font-size: 10px; }
    .back { padding: 4mm 7mm 0; }
    .back-title { margin: 0 0 10mm; font: 700 18px Arial, sans-serif; text-align: center; letter-spacing: .15px; text-transform: uppercase; }
    .back-code { margin: 0 0 5mm; font-size: 12px; }
    .production-quantity-table { width: 100%; table-layout: fixed; border-collapse: collapse; color: #111; background: #fff; font: 10px "Arial", sans-serif; }
    .production-quantity-table th, .production-quantity-table td { height: 8mm; padding: 2px 4px; border: 1px solid #111; text-align: center; vertical-align: middle; }
    .production-quantity-table th { color: #111; background: #fff; font-weight: 700; }
    .back-notes { margin-top: 8px; min-height: 30mm; padding: 6px; border: 1px solid #000; }
    .back-signs { margin-top: 7px; }
    .front-signs { margin: 3.5mm 0 0; font-family: Arial, sans-serif; }
    .front-signs td { border: 0; padding: 0 4px; font-size: 12px; font-weight: 800; text-transform: uppercase; }
    .front-signs .sign { height: 15mm; }
    .front-signs .person-name { display: block; margin-top: 3mm; font-size: 10px; font-weight: 400; text-transform: none; }
  </style></head><body>
  <section class="page front">
    <p class="front-proposal-date"><strong>NGÀY ĐỀ XUẤT:</strong> ${formatDate(proposal.date)}</p>
    <h1>PHIẾU ĐỀ XUẤT SẢN XUẤT</h1>
    <div class="front-info">
      <p class="front-product-line"><span><strong>Mã SP:</strong> ${escapeHtml(proposal.productCode)}</span>${proposal.productName ? `<span><strong>Tên SP:</strong> ${escapeHtml(proposal.productName)}</span>` : ''}</p>
      <p><strong>Lý do sản xuất:</strong> ${escapeHtml(proposal.reason || 'Đơn sản xuất bán tại shop')}</p>
      ${proposal.deliveryDate ? `<p><strong>Ngày giao hàng dự kiến:</strong> ${formatDate(proposal.deliveryDate)}</p>` : ''}
      <p><strong>Tình trạng</strong></p>
      <ul class="front-status">
        <li>Mẫu thực tế: ${escapeHtml(proposal.sampleStatus || 'Có')}</li>
        <li>Rập: ${escapeHtml(proposal.patternStatus || 'Có')}</li>
        <li>Hình ảnh SP: ${escapeHtml(proposal.imageStatus || 'Có')}</li>
        <li>Định mức: ${formatNumber(proposal.fabricNorm)} m</li>
        <li>Size mẫu: ${escapeHtml(proposal.sampleSize || '')}</li>
      </ul>
    </div>
    <div class="sample-photo">${proposal.productImage ? `<img src="${escapeHtml(proposal.productImage)}" alt="">` : '<span>Ảnh sản phẩm / mẫu</span>'}</div>
    <table class="grid changes"><thead><tr><th>STT</th><th class="content-col">Nội dung</th><th>Chi tiết thay đổi so với mẫu</th></tr></thead><tbody>${(changeNotes.length ? changeNotes : [{}, {}]).map((row, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(row.content || '')}</td><td>${escapeHtml(row.detail || '')}</td></tr>`).join('')}</tbody></table>
    <table class="signs front-signs"><tr>
      <td><strong>TP. Kinh doanh</strong><div class="sign"></div><span class="person-name">Họ và tên: ____________________</span></td>
      <td><strong>Người đề xuất</strong><div class="sign"><img src="${escapeHtml(proposal.signatureData)}" alt=""></div><span class="person-name">Họ và tên: ${escapeHtml(proposal.signatureName)}</span></td>
      <td><strong>BP. Sản xuất</strong><div class="sign"></div><span class="person-name">Họ và tên: ____________________</span></td>
    </tr></table>
  </section>
  <section class="page back">
    <h1 class="back-title">BẢNG SỐ LƯỢNG ĐỀ XUẤT THEO SIZE</h1>
    <p class="back-code"><b>Mã SP:</b> ${escapeHtml(proposal.productCode)}</p>
    ${productionQuantityTable(order.proposal, order.fabrics)}
    <span class="page-label">Mặt 2/2</span>
  </section>
  </body></html>`;
  document.querySelector('[data-print-frame]')?.remove();
  const frame = document.createElement('iframe');
  frame.dataset.printFrame = '';
  frame.style.cssText = 'position:fixed;width:0;height:0;border:0;visibility:hidden';
  document.body.append(frame);
  frame.contentDocument.open();
  frame.contentDocument.write(html);
  frame.contentDocument.close();
  const images = [...frame.contentDocument.querySelectorAll('img')];
  const print = () => { frame.contentWindow.focus(); frame.contentWindow.print(); };
  Promise.all(images.map((image) => image.complete ? Promise.resolve() : new Promise((resolve) => {
    image.addEventListener('load', resolve, { once: true });
    image.addEventListener('error', resolve, { once: true });
  }))).then(() => setTimeout(print, 50));
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
    output.textContent = loss == null ? '' : loss < 0 ? 'Lớn hơn số m trước wash' : `Hao hụt ${(loss * 100).toFixed(1)}%`;
    output.classList.toggle('is-danger', loss != null && (loss < 0 || loss > maxWashLoss));
  });
}

async function runAction(button) {
  const form = button.closest('[data-action-form]');
  const error = form.querySelector('[data-action-error]');
  const action = button.dataset.action;
  const order = state.orders.find((item) => item.id === detailModal.dataset.orderId);
  const value = (name) => form.querySelector(`[name="${name}"]`)?.value;
  const checked = (name) => Boolean(form.querySelector(`[name="${name}"]`)?.checked);
  const payload = { action, note: value('note') || '' };
  if (action === 'approve') {
    const signature = form.querySelector('[data-approval-signature]');
    payload.approvalName = value('approvalName') || '';
    payload.approvalSignature = signature?.dataset.signed === 'true' ? signature.toDataURL('image/png') : '';
    payload.suggestedSellingPrice = value('suggestedSellingPrice') || '';
    if (!payload.approvalName.trim()) {
      error.textContent = 'Vui lòng nhập họ và tên người duyệt.';
      form.querySelector('[name="approvalName"]')?.focus();
      return;
    }
    if (!payload.approvalSignature) {
      error.textContent = 'Vui lòng ký xác nhận trước khi duyệt.';
      return;
    }
    if (order.status === 'approval-1' && !payload.suggestedSellingPrice) {
      error.textContent = 'Vui lòng nhập giá bán đề xuất.';
      form.querySelector('[name="suggestedSellingPrice"]')?.focus();
      return;
    }
    if (order.status === 'approval-1') {
      const suggestedPrice = Number(payload.suggestedSellingPrice);
      if (!Number.isInteger(suggestedPrice) || suggestedPrice <= 0) {
        error.textContent = 'Giá bán đề xuất phải là số nguyên lớn hơn 0.';
        form.querySelector('[name="suggestedSellingPrice"]')?.focus();
        return;
      }
    }
  }
  if (action === 'prepare-fabric') Object.assign(payload, sizeTablePayload(form.querySelector('[data-size-table]')));
  if (action === 'reconcile') Object.assign(payload, { fabrics: collectFabrics(form), lossNote: value('lossNote'), erpConfirmed: checked('erpConfirmed'), printed: checked('printed'), proposalPrinted: checked('proposalPrinted') });
  if (action === 'handover') payload.signed = checked('signed');
  if (action === 'workshop-receive') {
    Object.assign(payload, { unitPrice: value('unitPrice'), expectedDate: value('expectedDate') });
    if (payload.expectedDate && payload.expectedDate < todayKey()) {
      error.textContent = 'Ngày giao hàng dự kiến không được trước ngày hôm nay.';
      form.querySelector('[name="expectedDate"]')?.focus();
      return;
    }
  }
  if (action === 'selling-price') payload.sellingPrice = value('sellingPrice');
  if (action === 'product-receive') payload.receivedQuantity = value('receivedQuantity');
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
    if (action === 'handover') payload.files = await readFiles(form.querySelector('[name="files"]'));
    if (action === 'product-receive') {
      payload.photos = {
        documents: await readFiles(form.querySelector('[name="photo-documents"]')),
        products: await readFiles(form.querySelector('[name="photo-products"]')),
      };
    }
    await request(`/api/production/${detailModal.dataset.orderId}/action`, { method: 'POST', body: JSON.stringify(payload) });
    await load();
    window.refreshProductionBadge?.();
  } catch (requestError) {
    error.textContent = requestError.message;
    form.querySelectorAll('button').forEach((item) => { item.disabled = false; });
  }
}

detail.addEventListener('click', (event) => {
  const stageButton = event.target.closest('[data-view-stage]');
  if (stageButton) return renderStageProgress(state.orders.find((item) => item.id === detailModal.dataset.orderId), stageButton.dataset.viewStage);
  if (event.target.closest('[data-close-stage-progress]')) return event.target.closest('[data-stage-progress]').remove();
  const actionButton = event.target.closest('[data-action]');
  if (actionButton) return runAction(actionButton);
  if (event.target.closest('[data-print-proposal]')) return printProposal(state.orders.find((order) => order.id === detailModal.dataset.orderId));
  if (event.target.closest('[data-resubmit]')) return openCreate(state.orders.find((order) => order.id === detailModal.dataset.orderId));
  if (event.target.closest('[data-show-reject]')) {
    const form = event.target.closest('[data-action-form]');
    form.querySelector('[data-rejection-box]').hidden = false;
    form.querySelector('[data-approval-actions]').hidden = true;
    form.querySelector('.production-approval-signature-box').hidden = true;
    form.querySelector('[name="note"]').focus();
    return;
  }
  if (event.target.closest('[data-cancel-reject]')) {
    const form = event.target.closest('[data-action-form]');
    form.querySelector('[data-rejection-box]').hidden = true;
    form.querySelector('[data-approval-actions]').hidden = false;
    form.querySelector('.production-approval-signature-box').hidden = false;
    return;
  }
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

function initializeApprovalSignature() {
  const canvas = detail.querySelector('[data-approval-signature]');
  if (!canvas) return;
  const context = canvas.getContext('2d');
  const status = detail.querySelector('[data-approval-signature-status]');
  const approveButton = detail.querySelector('[data-approve-button]');
  const form = canvas.closest('[data-action-form]');
  const refreshApproveButton = () => {
    if (!approveButton) return;
    const signed = canvas.dataset.signed === 'true';
    const nameInput = form?.querySelector('[name="approvalName"]');
    const priceInput = form?.querySelector('[name="suggestedSellingPrice"]');
    const priceValid = !priceInput || (Number.isInteger(Number(priceInput.value)) && Number(priceInput.value) > 0);
    approveButton.disabled = !(signed && nameInput?.value.trim() && priceValid);
  };
  let pointer = null;
  context.strokeStyle = '#173f78';
  context.lineWidth = 2.5;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  const point = (event) => {
    const bounds = canvas.getBoundingClientRect();
    return { x: (event.clientX - bounds.left) * canvas.width / bounds.width, y: (event.clientY - bounds.top) * canvas.height / bounds.height };
  };
  canvas.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    pointer = event.pointerId;
    canvas.setPointerCapture(pointer);
    const start = point(event);
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(start.x + 0.1, start.y + 0.1);
    context.stroke();
  });
  canvas.addEventListener('pointermove', (event) => {
    if (event.pointerId !== pointer) return;
    const next = point(event);
    context.lineTo(next.x, next.y);
    context.stroke();
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((type) => canvas.addEventListener(type, (event) => {
    if (event.pointerId !== pointer) return;
    pointer = null;
    canvas.dataset.signed = 'true';
    status.textContent = 'Đã có chữ ký';
    refreshApproveButton();
  }));
  form?.querySelector('[name="approvalName"]')?.addEventListener('input', refreshApproveButton);
  form?.querySelector('[name="suggestedSellingPrice"]')?.addEventListener('input', refreshApproveButton);
  detail.querySelector('[data-clear-approval-signature]').addEventListener('click', () => {
    context.clearRect(0, 0, canvas.width, canvas.height);
    delete canvas.dataset.signed;
    status.textContent = 'Chưa có chữ ký';
    approveButton.disabled = true;
  });
}

function initializeFinalQuantityEditor(order) {
  const root = detail.querySelector('[data-size-table]');
  if (!root) return;
  const rows = order.proposal.technicalRows?.length ? order.proposal.technicalRows : [{ item: order.proposal.productCode }];
  mountSizeTable(root, { columns: sizeColumnsOf(order.proposal), rows }, { lockActual: true, defaultItem: order.proposal.productCode });
}

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
const sizeTableRoot = createForm.querySelector('[data-size-table]');
const defaultSizeTable = () => ({ columns: ['S'], rows: [{}] });
mountSizeTable(sizeTableRoot, defaultSizeTable());

const changeRows = createForm.querySelector('[data-change-rows]');
function updateChangeNumbers() {
  [...changeRows.querySelectorAll('[data-change-row]')].forEach((row, index) => {
    row.querySelector('[data-change-number]').textContent = index + 1;
  });
}
function addChangeRow(row = {}) {
  changeRows.insertAdjacentHTML('beforeend', `<div class="production-change-row" data-change-row>
    <span data-change-number>${changeRows.children.length + 1}</span>
    <input name="changeContent" maxlength="200" placeholder="Nội dung" value="${escapeHtml(row.content || '')}" />
    <input name="changeDetail" maxlength="500" placeholder="Chi tiết thay đổi" value="${escapeHtml(row.detail || '')}" />
    <button type="button" class="production-row-remove" data-remove-change aria-label="Xóa hàng">×</button>
  </div>`);
}
createForm.querySelector('[data-add-change]').addEventListener('click', () => addChangeRow());
changeRows.addEventListener('click', (event) => {
  if (!event.target.closest('[data-remove-change]')) return;
  event.target.closest('[data-change-row]').remove();
  if (!changeRows.children.length) addChangeRow();
  updateChangeNumbers();
});

const productImageInput = createForm.elements.productImageFile;
const productPreview = createForm.querySelector('[data-product-preview]');
let existingProductImage = '';
async function updateProductPreview() {
  const file = productImageInput.files?.[0];
  if (file) existingProductImage = (await shrinkImage(file)).data;
  const image = productPreview.querySelector('img');
  image.src = existingProductImage;
  productPreview.hidden = !existingProductImage;
  productImageInput.required = !existingProductImage;
}
productImageInput.addEventListener('change', () => updateProductPreview().catch((error) => { createError.textContent = error.message; }));
createForm.querySelector('[data-remove-product-image]').addEventListener('click', () => {
  existingProductImage = '';
  productImageInput.value = '';
  updateProductPreview();
});
createForm.addEventListener('input', () => {
  const quantity = Number(createForm.elements.quantity.value);
  const norm = Number(createForm.elements.fabricNorm.value);
  const variantTotal = [...variantRows.querySelectorAll('[name="variantQuantity"]')].reduce((sum, input) => sum + Number(input.value || 0), 0);
  createForm.querySelector('[data-fabric-estimate]').textContent = [
    quantity && norm ? `Vải dự kiến: ${formatNumber(quantity * norm)} m.` : '',
    variantTotal ? `Tổng theo màu/size: ${formatNumber(variantTotal)}${quantity && variantTotal !== quantity ? ` (chưa khớp ${formatNumber(quantity)})` : ''}.` : '',
  ].join(' ');
  createForm.querySelector('[data-back-product-code]').textContent = createForm.elements.productCode.value.trim();
});

function openCreate(order = null) {
  createForm.reset();
  clearSignature();
  variantRows.innerHTML = '';
  renderSizeTable(sizeTableRoot, defaultSizeTable());
  changeRows.innerHTML = '';
  existingProductImage = '';
  productImageInput.value = '';
  productPreview.hidden = true;
  createError.textContent = '';
  resubmitOrderId = order?.id || '';
  document.querySelector('[data-create-title]').textContent = order ? `Sửa & gửi lại ${order.code}` : 'Lập phiếu đề xuất sản xuất';
  if (order) {
    ['date', 'productCode', 'productName', 'reason', 'quantity', 'fabricNorm', 'fabric', 'color', 'sampleStatus', 'patternStatus', 'imageStatus', 'sampleSize', 'note', 'signatureName'].forEach((name) => { createForm.elements[name].value = order.proposal[name] ?? ''; });
    order.proposal.variants?.forEach(addVariant);
    renderSizeTable(sizeTableRoot, { columns: sizeColumnsOf(order.proposal), rows: order.proposal.technicalRows?.length ? order.proposal.technicalRows : [{}] });
    const savedChanges = (order.proposal.changeNotes || []).map((note) => typeof note === 'string' ? { detail: note } : note);
    (savedChanges.length ? savedChanges : [{}]).forEach(addChangeRow);
    existingProductImage = order.proposal.productImage || '';
    if (existingProductImage) {
      productPreview.querySelector('img').src = existingProductImage;
      productPreview.hidden = false;
    }
  } else {
    createForm.elements.date.value = todayKey();
    createForm.elements.reason.value = '';
    ['sampleStatus', 'patternStatus', 'imageStatus'].forEach((name) => { createForm.elements[name].value = 'Có'; });
    addChangeRow();
  }
  productImageInput.required = !existingProductImage;
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
  const data = Object.fromEntries(['date', 'productCode', 'productName', 'reason', 'quantity', 'fabricNorm', 'fabric', 'color', 'sampleStatus', 'patternStatus', 'imageStatus', 'sampleSize', 'note', 'signatureName'].map((name) => [name, createForm.elements[name].value]));
  data.variants = [...variantRows.querySelectorAll('[data-variant-row]')].map((row) => ({ color: row.querySelector('[name="color"]').value, size: row.querySelector('[name="size"]').value, quantity: row.querySelector('[name="variantQuantity"]').value }));
  const variantTotal = data.variants.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
  if (variantTotal) data.quantity = String(variantTotal);
  data.changeNotes = [...changeRows.querySelectorAll('[data-change-row]')].map((row) => ({
    content: row.querySelector('[name="changeContent"]').value,
    detail: row.querySelector('[name="changeDetail"]').value,
  }));
  Object.assign(data, sizeTablePayload(sizeTableRoot));
  const sizeTotal = data.technicalRows.reduce((sum, row) => sum + sizeTotalOf(row.sizes), 0);
  if (!variantTotal && sizeTotal) data.quantity = String(sizeTotal);
  data.signatureData = signatureCanvas.toDataURL('image/png');
  try {
    await updateProductPreview();
  } catch (error) {
    createError.textContent = error.message;
    return;
  }
  data.productImage = existingProductImage;
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
// Dòng tóm tắt người đã chọn, hiện cả khi mục đang đóng.
function updateAssignSummary(group) {
  const names = [...group.querySelectorAll('input:checked')].map((input) => input.dataset.name);
  const summary = group.querySelector('[data-assign-summary]');
  summary.textContent = names.length ? names.join(', ') : 'Chưa chọn ai';
  summary.classList.toggle('is-empty', !names.length);
}
settingsForm.addEventListener('change', (event) => {
  const group = event.target.closest('[data-role]');
  if (group) updateAssignSummary(group);
});

function openSettings() {
  const selected = Object.fromEntries(Object.entries(state.assignees).map(([role, people]) => [role, new Set(people.map((person) => person.id))]));
  settingsForm.querySelector('[data-settings-roles]').innerHTML = Object.entries(state.roles).map(([role, info]) => ({ role, label: info?.label ?? info, hint: info?.hint ?? '' })).map(({ role, label, hint }) => `
    <details class="production-assign" data-role="${role}">
      <summary><span class="production-assign-title">${escapeHtml(label)}</span><span class="production-assign-people" data-assign-summary></span></summary>
      ${hint ? `<p class="production-muted">${escapeHtml(hint)}</p>` : ''}<div class="production-people">
      ${state.users.map((user) => `<label class="production-person"><input type="checkbox" value="${escapeHtml(user.id)}" data-name="${escapeHtml(user.name)}" ${selected[role]?.has(user.id) ? 'checked' : ''} /><span>${escapeHtml(user.name)}<small>${escapeHtml(user.email)}</small></span></label>`).join('')}
    </div></details>`).join('');
  settingsForm.querySelectorAll('[data-role]').forEach(updateAssignSummary);
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
  const remove = event.target.closest('[data-delete-order]');
  if (remove) {
    const order = state.orders.find((item) => item.id === remove.dataset.deleteOrder);
    if (!order || !confirm(`Xóa vĩnh viễn ${order.code} - ${order.proposal.productCode}?`)) return;
    request(`/api/production/${order.id}`, { method: 'DELETE' })
      .then(() => load())
      .catch((error) => { statusText.textContent = error.message; });
    return;
  }
  const item = event.target.closest('[data-open-order]');
  if (item) openDetail(item.dataset.openOrder);
});

document.addEventListener('gusa:production-changed', () => load());
load();
})();
