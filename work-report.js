(function () {
  const panels = Object.fromEntries([...document.querySelectorAll('[data-wr-panel]')].map((panel) => [panel.dataset.wrPanel, panel]));
  const tabs = document.querySelector('[data-wr-tabs]');
  const statusChip = document.querySelector('[data-wr-status]');
  const dateLabel = document.querySelector('[data-wr-date]');
  const modal = document.querySelector('[data-wr-modal]');
  const modalBody = document.querySelector('[data-wr-modal-body]');
  const typeLabels = { check: 'Đánh dấu hoàn thành', number: 'Nhập số', text: 'Nhập chữ', select: 'Chọn một', photo: 'Chụp ảnh', file: 'Tải file lên', link: 'Dán link' };
  const typeIcons = { check: '✓', number: '123', text: 'Aa', select: '☰', photo: '📷', file: '📎', link: '🔗' };
  const typeShort = { check: 'Hoàn thành', number: 'Số', text: 'Chữ', select: 'Chọn', photo: 'Ảnh', file: 'File', link: 'Link' };
  // Inputs an item can carry next to its main one (e.g. a number with a file attached).
  const extraTypes = ['photo', 'file', 'link', 'text'];
  const extraNames = { photo: 'ảnh', file: 'file', link: 'link', text: 'ghi chú' };
  const partsOf = (item) => [{ type: item.type, extra: false, required: item.required }, ...(item.extras || []).map((extra) => ({ type: extra.type, extra: true, required: extra.required }))];
  const fileAccept = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png,.webp,.zip';
  const fileSize = (bytes) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
  const weekdayNames = ['', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  const weekdayLong = ['', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const clock = (value) => new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  const shortDate = (key) => (key ? `${key.slice(8, 10)}/${key.slice(5, 7)}/${key.slice(0, 4)}` : '');
  const request = async (url, options = {}) => {
    const response = await fetch(url, { cache: 'no-store', headers: { 'Content-Type': 'application/json' }, ...options });
    const body = await response.text();
    if (!response.ok) throw new Error(body || 'Có lỗi xảy ra, vui lòng thử lại.');
    return body ? JSON.parse(body) : {};
  };
  let me = { name: '' };
  let today = null;
  const drafts = {};

  const openModal = (html) => { modalBody.innerHTML = html; modal.hidden = false; };
  const closeModal = () => { modal.hidden = true; modalBody.innerHTML = ''; };
  modal.addEventListener('click', (event) => { if (event.target === modal || event.target.closest('[data-wr-close]')) closeModal(); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !modal.hidden) closeModal(); });

  // Small labels on report cards: how often the report is due, and whether it counts toward KPI.
  const kindTags = (template) => {
    const frequency = template.schedule?.frequency || 'daily';
    const label = { daily: 'Báo cáo ngày', weekly: 'Báo cáo tuần', monthly: 'Báo cáo tháng' }[frequency] || 'Báo cáo ngày';
    return `<span class="wr-tag is-${frequency}">${label}</span>${template.kpi ? '<span class="wr-tag is-kpi">📈 KPI</span>' : ''}`;
  };

  const scheduleText = (schedule = {}) => {
    const range = schedule.startDate || schedule.endDate ? ` · ${schedule.startDate ? `từ ${shortDate(schedule.startDate)}` : ''}${schedule.endDate ? ` đến ${shortDate(schedule.endDate)}` : ''}` : '';
    if (schedule.frequency === 'weekly') return `Hằng tuần, ${schedule.openWeekday ? `mở ${weekdayLong[schedule.openWeekday]}, ` : ''}hạn ${weekdayLong[schedule.weekday || 6]}${range}`;
    if (schedule.frequency === 'monthly') return `Hằng tháng, ${schedule.openDay ? `mở ngày ${schedule.openDay}, ` : ''}hạn ngày ${schedule.monthDay || 28}${range}`;
    const days = schedule.weekdays?.length ? schedule.weekdays : [1, 2, 3, 4, 5, 6, 7];
    return `${days.length === 7 ? 'Mỗi ngày' : `Mỗi ${days.map((day) => weekdayNames[day]).join(', ')}`}${range}`;
  };

  // ---------- Photos: camera only, resized and stamped with time, name and item on the device ----------
  function stampPhoto(file, label) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Không đọc được ảnh, vui lòng chụp lại.'));
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error('Không đọc được ảnh, vui lòng chụp lại.'));
        image.onload = () => {
          const scale = Math.min(1, 1280 / Math.max(image.width, image.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(image.width * scale);
          canvas.height = Math.round(image.height * scale);
          const context = canvas.getContext('2d');
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          const capturedAt = new Date();
          const size = Math.max(16, Math.round(canvas.width / 38));
          const barHeight = size * 2.9;
          context.fillStyle = 'rgba(0, 0, 0, .55)';
          context.fillRect(0, canvas.height - barHeight, canvas.width, barHeight);
          context.fillStyle = '#fff';
          context.font = `700 ${size}px "Be Vietnam Pro", Arial, sans-serif`;
          context.fillText(`${capturedAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} · ${capturedAt.toLocaleDateString('vi-VN')}`, size * .8, canvas.height - barHeight + size * 1.25);
          context.font = `500 ${Math.round(size * .85)}px "Be Vietnam Pro", Arial, sans-serif`;
          context.fillText(`${me.name} · ${label}`.slice(0, 80), size * .8, canvas.height - barHeight + size * 2.4);
          resolve({ data: canvas.toDataURL('image/jpeg', .8), capturedAt: capturedAt.toISOString() });
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // ---------- My reports: one collapsible card per template due in its current period ----------
  const openCards = new Set();
  function renderMine() {
    const panel = panels.mine;
    const items = today.items;
    // A weekly/monthly report whose input opens later shows locked and does not count as to-do yet.
    items.forEach((item) => { item.locked = !item.report && Boolean(item.period.opensOn) && today.date < item.period.opensOn; });
    const done = items.filter((item) => item.report || item.locked).length;
    statusChip.hidden = !items.length;
    statusChip.className = `wr-status ${done === items.length ? 'is-done' : 'is-missing'}`;
    statusChip.textContent = done === items.length ? (items.some((item) => item.locked) ? 'Chưa có báo cáo cần nộp lúc này' : `Đã nộp đủ ${items.length} báo cáo`) : `Còn ${items.length - done} báo cáo cần nộp`;
    if (!items.length) {
      panel.innerHTML = '<div class="wr-empty"><span aria-hidden="true">🗂️</span><b>Hôm nay bạn không có báo cáo cần nộp</b><small>Khi Admin/CEO giao mẫu báo cáo cho bạn, nó sẽ hiện ở đây theo đúng lịch nộp. Xem báo cáo cũ ở tab "Lịch sử của tôi".</small></div>';
      return;
    }
    // Reports still to do come first and start open; submitted ones stay folded until tapped.
    const rank = (item) => (item.report ? 2 : item.locked ? 1 : 0);
    const ordered = [...items].sort((a, b) => rank(a) - rank(b));
    ordered.forEach((item) => { if (!item.report && !item.locked && !item.seenOpen) { openCards.add(item.template.id); item.seenOpen = true; } });
    const submitted = items.filter((item) => item.report).length;
    const locked = items.filter((item) => item.locked).length;
    panel.innerHTML = `<div class="wr-summary"><span class="is-todo"><b>${items.length - done}</b> cần nộp</span><span class="is-done"><b>${submitted}</b> đã nộp</span>${locked ? `<span class="is-locked"><b>${locked}</b> chưa mở</span>` : ''}</div>`
      + ordered.map((entry) => {
        const { template, period, report } = entry;
        const state = report ? (report.late ? ['is-late', `Nộp trễ · ${clock(report.submittedAt)}`] : ['is-done', `Đã nộp · ${clock(report.submittedAt)}`]) : entry.locked ? ['is-locked', `Mở từ ${period.opensOn.slice(8, 10)}/${period.opensOn.slice(5, 7)}`] : entry.late ? ['is-missing', 'Quá hạn'] : ['is-pending', 'Chưa nộp'];
        const open = openCards.has(template.id);
        return `<section class="wr-report-card ${state[0]}${open ? ' is-open' : ''}" data-template="${escape(template.id)}">
          <button type="button" class="wr-card-head" data-toggle-card aria-expanded="${open}">
            <span class="wr-card-icon" aria-hidden="true">${report ? '✓' : entry.locked ? '🔒' : '✎'}</span>
            <span class="wr-card-title"><span class="wr-card-tags">${kindTags(template)}</span><b>${escape(template.name)}</b><small>${escape(period.label)} · <span class="wr-due">Hạn ${escape(period.dueLabel)} ${escape(template.deadline)}</span> · ${template.items.length} mục</small></span>
            <span class="wr-card-status"><span class="wr-pill ${state[0]}">${state[1]}</span><span class="wr-toggle-label">${open ? 'Thu gọn ▴' : report ? 'Xem / sửa ▾' : entry.locked ? 'Xem ▾' : 'Mở để nộp ▾'}</span></span>
          </button>
          <div class="wr-card-body"></div>
        </section>`;
      }).join('');
    panel.querySelectorAll('[data-toggle-card]').forEach((button) => {
      button.onclick = () => {
        const id = button.closest('[data-template]').dataset.template;
        if (openCards.has(id)) openCards.delete(id); else openCards.add(id);
        renderMine();
      };
    });
    ordered.filter((entry) => openCards.has(entry.template.id)).forEach(renderForm);
  }

  function renderForm(entry) {
    const { template, period, report } = entry;
    const card = panels.mine.querySelector(`[data-template="${CSS.escape(template.id)}"] .wr-card-body`);
    if (entry.locked) {
      card.innerHTML = `<div class="wr-locked-note"><b>🔒 Báo cáo này mở nhập từ ngày ${escape(shortDate(period.opensOn))}</b><span>Hạn nộp ${escape(period.dueLabel)} ${escape(template.deadline)}. Gồm ${template.items.length} mục: ${template.items.map((item) => escape(item.label)).join(', ')}.</span></div>`;
      return;
    }
    const answers = Object.fromEntries((report?.answers || []).map((answer) => [answer.itemId, answer]));
    // One draft per item holding every input it has, seeded from the last submission.
    const draft = drafts[template.id] ||= Object.fromEntries(template.items.map((item) => {
      const answer = answers[item.id] || {};
      return [item.id, {
        checked: answer.checked, value: answer.value, total: answer.total, note: answer.note || '', link: answer.link || '',
        photos: (answer.photos || []).map((photo) => ({ keep: photo.file, url: photo.url })),
        files: (answer.files || []).map((file) => ({ keep: file.file, name: file.name, size: file.size, url: file.url })),
      }];
    }));
    card.innerHTML = `<form class="wr-form" novalidate>
      ${template.requireBeforeCheckout && period.dueLabel === 'hôm nay' && !report ? '<p class="wr-note">🔒 Cần nộp báo cáo này trước khi check-out.</p>' : ''}
      ${template.items.map((item, index) => `<div class="wr-item">
        <div class="wr-item-label"><span class="wr-item-number">${index + 1}</span><b>${escape(item.label)}</b>${item.required ? '<em>Bắt buộc</em>' : ''}</div>
        ${item.hint ? `<p class="wr-item-hint">${escape(item.hint)}</p>` : ''}
        <div class="wr-item-field" data-field="${escape(item.id)}"></div>
      </div>`).join('')}
      <p class="wr-error" data-wr-error role="alert" hidden></p>
      <button class="wr-submit" type="submit">${report ? 'Cập nhật báo cáo' : 'Nộp báo cáo'}</button>
    </form>`;
    template.items.forEach((item) => renderField(card, item, draft[item.id]));
    card.querySelector('form').addEventListener('submit', (event) => submitReport(event, entry, draft));
  }

  // ---------- My history: submitted, late and missed reports over the last 30 days ----------
  let historyFilter = 'all';
  async function renderHistory() {
    const panel = panels.history;
    panel.innerHTML = '<p class="wr-empty">Đang tải...</p>';
    const { rows } = await request('/api/work-reports/history');
    const statusText = { submitted: 'Đã nộp', late: 'Nộp trễ', missing: 'Không nộp', pending: 'Chưa nộp', overdue: 'Quá hạn – còn nộp trễ được' };
    const count = (...statuses) => rows.filter((row) => statuses.includes(row.status)).length;
    const draw = () => {
      const visible = rows.filter((row) => historyFilter === 'all' || (historyFilter === 'missing' ? ['missing', 'pending', 'overdue'].includes(row.status) : row.status === historyFilter));
      const byDay = visible.reduce((map, row) => map.set(row.dueDate, [...(map.get(row.dueDate) || []), row]), new Map());
      panel.innerHTML = `<div class="wr-stats is-four"><div><span>Đã nộp</span><b class="is-done">${count('submitted')}</b></div><div><span>Nộp trễ</span><b class="is-late">${count('late')}</b></div><div><span>Không nộp</span><b class="is-missing">${count('missing')}</b></div><div><span>Đang chờ nộp</span><b class="is-upcoming">${count('pending', 'overdue')}</b></div></div>
        <div class="wr-filter-chips" role="tablist">${[['all', 'Tất cả'], ['submitted', 'Đã nộp'], ['late', 'Nộp trễ'], ['missing', 'Chưa nộp']].map(([value, label]) => `<button type="button" class="${historyFilter === value ? 'is-active' : ''}" data-history-filter="${value}">${label}</button>`).join('')}</div>
        ${visible.length ? [...byDay].map(([day, list]) => `<section class="wr-group"><h3>${escape(new Date(`${day}T00:00:00`).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' }))}</h3>
          ${list.map((row) => `<button type="button" class="wr-person wr-history-row is-${row.status}" ${row.reportId ? `data-report="${escape(row.reportId)}"` : row.status === 'overdue' ? 'data-go-mine' : 'disabled'}>
            <span class="wr-card-icon" aria-hidden="true">${row.reportId ? '✓' : row.status === 'pending' ? '✎' : row.status === 'overdue' ? '⏰' : '!'}</span>
            <span class="wr-person-info"><b>${escape(row.templateName)}</b><small>${escape(row.periodLabel)}${row.dueLabel ? ` · <span class="wr-due">hạn ${escape(row.dueLabel)}</span>` : ''}</small></span>
            <span class="wr-pill is-${row.status === 'pending' ? 'upcoming' : row.status}">${statusText[row.status]}${row.submittedAt ? ` · ${clock(row.submittedAt)}` : ''}</span>
            ${row.reportId ? '<span class="wr-view">Xem ›</span>' : row.status === 'overdue' ? '<span class="wr-view">Nộp trễ ›</span>' : ''}
          </button>`).join('')}</section>`).join('') : '<div class="wr-empty"><span aria-hidden="true">📭</span><b>Không có báo cáo nào</b><small>Thử chọn bộ lọc khác.</small></div>'}`;
      panel.querySelectorAll('[data-history-filter]').forEach((button) => { button.onclick = () => { historyFilter = button.dataset.historyFilter; draw(); }; });
      panel.querySelectorAll('[data-go-mine]').forEach((button) => { button.onclick = () => show('mine'); });
      panel.querySelectorAll('[data-report]').forEach((button) => { button.onclick = async () => openModal(reportDetail((await request(`/api/work-reports/${button.dataset.report}`)).report)); });
    };
    draw();
  }

  function renderField(card, item, value) {
    const host = card.querySelector(`[data-field="${CSS.escape(item.id)}"]`);
    const parts = partsOf(item);
    host.innerHTML = parts.map((part, index) => (part.extra
      ? `<div class="wr-extra"><span class="wr-extra-label">${typeIcons[part.type]} Kèm ${extraNames[part.type]}${part.required ? ' <em>bắt buộc</em>' : ' <small>(không bắt buộc)</small>'}</span><div data-part="${index}"></div></div>`
      : `<div data-part="${index}"></div>`)).join('');
    parts.forEach((part, index) => renderPart(host.querySelector(`[data-part="${index}"]`), item, value, part.type, part.extra));
  }

  function renderPart(field, item, value, type, isExtra) {
    const rerender = () => renderPart(field, item, value, type, isExtra);
    if (type === 'check') {
      field.innerHTML = `<button type="button" class="wr-check${value.checked ? ' is-checked' : ''}"><span aria-hidden="true">${value.checked ? '✓' : ''}</span>${value.checked ? 'Đã hoàn thành' : 'Bấm để đánh dấu đã hoàn thành'}</button>`;
      field.querySelector('button').onclick = () => { value.checked = !value.checked; rerender(); };
    } else if (type === 'number' && item.kpiType === 'ratio' && !isExtra) {
      field.innerHTML = `<div class="wr-ratio"><label>Đã làm được<input type="number" inputmode="decimal" step="any" min="0" value="${escape(value.value ?? '')}" placeholder="VD: 3" data-ratio="value" /></label><span aria-hidden="true">/</span><label>Tổng số phải làm<input type="number" inputmode="decimal" step="any" min="0" value="${escape(value.total ?? '')}" placeholder="VD: 3" data-ratio="total" /></label><small data-ratio-result></small></div>`;
      const result = field.querySelector('[data-ratio-result]');
      const show = () => { const v = Number(value.value); const t = Number(value.total); result.textContent = value.value !== '' && value.value != null && t > 0 ? `= ${Math.round((v / t) * 1000) / 10}% (cần đạt ${item.target || 100}%)` : `Cần đạt ${item.target || 100}%`; };
      field.querySelectorAll('[data-ratio]').forEach((input) => { input.oninput = () => { value[input.dataset.ratio] = input.value; show(); }; });
      show();
    } else if (type === 'number') {
      field.innerHTML = `<input type="number" inputmode="decimal" step="any" value="${escape(value.value ?? '')}" placeholder="Nhập số" />`;
      field.querySelector('input').oninput = (event) => { value.value = event.target.value; };
    } else if (type === 'text') {
      const key = isExtra ? 'note' : 'value';
      field.innerHTML = `<textarea rows="${isExtra ? 2 : 3}" maxlength="2000" placeholder="${isExtra ? 'Ghi chú thêm' : 'Nhập nội dung'}">${escape(value[key] || '')}</textarea>`;
      field.querySelector('textarea').oninput = (event) => { value[key] = event.target.value; };
    } else if (type === 'select') {
      field.innerHTML = `<div class="wr-options">${item.options.map((option) => `<button type="button" class="${value.value === option ? 'is-selected' : ''}" data-option="${escape(option)}">${escape(option)}</button>`).join('')}</div>`;
      field.querySelectorAll('[data-option]').forEach((button) => { button.onclick = () => { value.value = button.dataset.option; rerender(); }; });
    } else if (type === 'link') {
      field.innerHTML = `<div class="wr-link-field"><span aria-hidden="true">🔗</span><input type="url" inputmode="url" value="${escape(value.link)}" placeholder="Dán link, ví dụ https://drive.google.com/..." /><a class="wr-link-open" target="_blank" rel="noopener" hidden>Mở link ↗</a></div>`;
      const input = field.querySelector('input');
      const open = field.querySelector('.wr-link-open');
      const update = () => {
        value.link = input.value.trim();
        const valid = /^https?:\/\/\S+$/i.test(value.link);
        open.hidden = !valid;
        if (valid) open.href = value.link;
        input.classList.toggle('is-invalid', Boolean(value.link) && !valid);
      };
      input.oninput = update;
      update();
    } else if (type === 'file') {
      const files = value.files;
      const minimum = isExtra ? 1 : item.minFiles || 1;
      field.innerHTML = `<div class="wr-files">${files.map((file, index) => `<div class="wr-file"><span class="wr-file-icon" aria-hidden="true">📄</span><span class="wr-file-name"><b>${escape(file.name)}</b><small>${file.size ? fileSize(file.size) : ''}</small></span><button type="button" data-remove-file="${index}" aria-label="Bỏ file">×</button></div>`).join('')}
        ${files.length < 3 ? `<label class="wr-attach"><input type="file" accept="${fileAccept}" hidden /><span aria-hidden="true">📎</span>Chọn file đính kèm<small>PDF, Word, Excel, PowerPoint, ảnh… tối đa 8 MB${minimum > 1 ? ` · cần ${minimum} file` : ''}</small></label>` : ''}</div>`;
      field.querySelectorAll('[data-remove-file]').forEach((button) => { button.onclick = () => { files.splice(Number(button.dataset.removeFile), 1); rerender(); }; });
      const input = field.querySelector('input[type="file"]');
      if (input) input.onchange = () => {
        const file = input.files?.[0];
        if (!file) return;
        if (file.size > 8 * 1024 * 1024) { alert('File quá lớn, tối đa 8 MB.'); return; }
        const reader = new FileReader();
        reader.onload = () => { files.push({ name: file.name, size: file.size, data: reader.result }); rerender(); };
        reader.onerror = () => alert('Không đọc được file, vui lòng chọn lại.');
        reader.readAsDataURL(file);
      };
    } else {
      const photos = value.photos;
      const minimum = isExtra ? 1 : item.minPhotos || 1;
      field.innerHTML = `<div class="wr-photos">${photos.map((photo, index) => `<figure><img src="${escape(photo.url || photo.data)}" alt="Ảnh ${index + 1}" /><button type="button" data-remove="${index}" aria-label="Xóa ảnh">×</button></figure>`).join('')}
        ${photos.length < 6 ? `<label class="wr-camera"><input type="file" accept="image/*" capture="environment" hidden /><span aria-hidden="true">📷</span>Chụp ảnh${minimum > 1 ? ` (cần ${minimum})` : ''}</label>` : ''}</div>`;
      field.querySelectorAll('[data-remove]').forEach((button) => { button.onclick = () => { photos.splice(Number(button.dataset.remove), 1); rerender(); }; });
      const input = field.querySelector('input[type="file"]');
      if (input) input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        try { photos.push(await stampPhoto(file, item.label)); rerender(); } catch (error) { alert(error.message); }
      };
    }
  }

  async function submitReport(event, entry, draft) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('.wr-submit');
    const error = form.querySelector('[data-wr-error]');
    error.hidden = true;
    const answers = entry.template.items.map((item) => {
      const value = draft[item.id];
      const answer = { itemId: item.id };
      partsOf(item).forEach(({ type, extra }) => {
        if (type === 'photo') answer.photos = value.photos.map((photo) => (photo.keep ? { keep: photo.keep } : { data: photo.data, capturedAt: photo.capturedAt }));
        else if (type === 'file') answer.files = value.files.map((file) => (file.keep ? { keep: file.keep } : { name: file.name, data: file.data }));
        else if (type === 'check') answer.checked = Boolean(value.checked);
        else if (type === 'link') answer.link = value.link || '';
        else if (type === 'text' && extra) answer.note = value.note || '';
        else {
          answer.value = value.value ?? '';
          if (type === 'number' && item.kpiType === 'ratio' && !extra) answer.total = value.total ?? '';
        }
      });
      return answer;
    });
    button.disabled = true;
    button.textContent = 'Đang gửi...';
    try {
      const { report } = await request('/api/work-reports', { method: 'POST', body: JSON.stringify({ templateId: entry.template.id, answers }) });
      entry.report = report;
      delete drafts[entry.template.id];
      openCards.delete(entry.template.id);
      renderMine();
      window.refreshNotifications?.();
      openModal(`<div class="wr-done"><span aria-hidden="true">✓</span><h2>${report.late ? 'Đã nộp (trễ hạn)' : 'Đã nộp báo cáo'}</h2><p>Lúc ${clock(report.updatedAt)} · ${escape(report.templateName)}</p><button type="button" data-wr-close>Đã hiểu</button></div>`);
    } catch (submitError) {
      error.textContent = submitError.message;
      error.hidden = false;
      button.disabled = false;
      button.textContent = entry.report ? 'Cập nhật báo cáo' : 'Nộp báo cáo';
    }
  }

  // ---------- Overview ----------
  // Everything a submitted answer holds: main value plus any photos, files, link or note.
  function answerView(answer) {
    const pieces = [];
    if (answer.type === 'check') pieces.push(`<span>${answer.checked ? '✓ Đã hoàn thành' : '✗ Chưa hoàn thành'}</span>`);
    if (answer.type === 'number' && answer.total !== undefined && answer.total !== null) pieces.push(`<span>${escape(answer.value ?? '—')} / ${escape(answer.total)} (${answer.total > 0 && answer.value !== null ? Math.round((answer.value / answer.total) * 1000) / 10 : 0}%)</span>`);
    else if (['number', 'select', 'text'].includes(answer.type)) pieces.push(`<span>${escape(answer.value ?? '') || '—'}</span>`);
    if (answer.link) pieces.push(`<a class="wr-link-view" href="${escape(answer.link)}" target="_blank" rel="noopener">🔗 ${escape(answer.link)}</a>`);
    else if (answer.type === 'link') pieces.push('<span>—</span>');
    if (answer.photos) pieces.push(`<div class="wr-photos is-readonly">${answer.photos.map((photo) => `<a href="${escape(photo.url)}" target="_blank" rel="noopener"><img src="${escape(photo.url)}" alt="${escape(answer.label)}" /></a>`).join('') || '<span>Không có ảnh</span>'}</div>`);
    if (answer.files) pieces.push(`<div class="wr-files">${answer.files.map((file) => `<a class="wr-file" href="${escape(file.url)}"><span class="wr-file-icon" aria-hidden="true">📄</span><span class="wr-file-name"><b>${escape(file.name)}</b><small>${fileSize(file.size)} · Bấm để tải về</small></span></a>`).join('') || '<span>Không có file</span>'}</div>`);
    if (answer.note) pieces.push(`<span class="wr-note-view">📝 ${escape(answer.note)}</span>`);
    return pieces.join('');
  }

  function reportDetail(report) {
    return `<h2 class="wr-modal-title">${escape(report.userName)}</h2><p class="wr-modal-sub">${escape(report.templateName)} · ${escape(report.periodLabel || report.date)} · ${report.late ? 'Nộp trễ' : 'Đúng hạn'} lúc ${clock(report.submittedAt)}</p>
      <div class="wr-detail">${report.answers.map((answer) => `<div class="wr-detail-row"><b>${escape(answer.label)}</b>${answerView(answer)}</div>`).join('')}</div>`;
  }

  // Follow-up for managers: any day range, filterable by status.
  const overviewState = { from: '', to: '', status: 'all', view: (() => { try { return localStorage.getItem('wr-overview-view') || 'matrix'; } catch { return 'matrix'; } })(), search: '', department: '' };
  const addDays = (key, days) => { const date = new Date(`${key}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); };
  async function renderOverview() {
    const panel = panels.overview;
    overviewState.from ||= today.date;
    overviewState.to ||= today.date;
    panel.innerHTML = '<p class="wr-empty">Đang tải...</p>';
    const { from, to, rows } = await request(`/api/work-reports/overview?from=${overviewState.from}&to=${overviewState.to}`);
    Object.assign(overviewState, { from, to });
    const order = ['missing', 'overdue', 'upcoming', 'late', 'submitted'];
    const statusText = { submitted: 'Đã nộp', late: 'Nộp trễ', missing: 'Chưa nộp', overdue: 'Quá hạn – còn nộp trễ được', upcoming: 'Chưa đến hạn' };
    const countLabel = { missing: 'chưa nộp', overdue: 'quá hạn', late: 'nộp trễ', upcoming: 'chưa đến hạn' };
    const statusIcon = { submitted: '✓', late: '⏱', missing: '!', overdue: '⏰', upcoming: '…' };
    const count = (...statuses) => rows.filter((row) => statuses.includes(row.status)).length;
    const singleDay = from === to;
    const ranges = [['today', 'Hôm nay', today.date, today.date], ['week', '7 ngày', addDays(today.date, -6), today.date], ['month', 'Tháng này', `${today.date.slice(0, 8)}01`, today.date]];
    const activeRange = ranges.find(([, , rangeFrom, rangeTo]) => rangeFrom === from && rangeTo === to)?.[0];
    const departments = [...new Set(rows.map((row) => row.department))].sort((a, b) => a.localeCompare(b, 'vi'));
    if (overviewState.department && !departments.includes(overviewState.department)) overviewState.department = '';
    const done = (row) => ['submitted', 'late'].includes(row.status);
    const personRow = (row) => `<button type="button" class="wr-person" ${row.reportId ? `data-report="${escape(row.reportId)}"` : 'disabled'}>
          <span class="wr-avatar">${row.picture ? `<img src="${escape(row.picture)}" alt="" referrerpolicy="no-referrer" />` : escape((row.name || '?').charAt(0).toUpperCase())}</span>
          <span class="wr-person-info"><b>${escape(row.name)}${row.title ? ` · <span>${escape(row.title)}</span>` : ''}</b><small>${singleDay ? '' : `${escape(row.department)} · `}${escape(row.templateName)} · ${escape(row.periodLabel)} · <span class="wr-due">hạn ${escape(row.dueLabel)}</span></small></span>
          <span class="wr-pill is-${row.status}">${statusText[row.status]}${row.submittedAt ? ` · ${clock(row.submittedAt)}` : ''}</span>
          ${row.reportId ? '<span class="wr-view">Xem ›</span>' : ''}
        </button>`;

    panel.innerHTML = `<div class="wr-overview-bar">
        <div class="wr-range-chips">${ranges.map(([key, label]) => `<button type="button" class="${activeRange === key ? 'is-active' : ''}" data-range="${key}">${label}</button>`).join('')}</div>
        <div class="wr-range-inputs"><label>Từ ngày<input type="date" value="${from}" max="${today.date}" data-range-from /></label><span aria-hidden="true">→</span><label>Đến ngày<input type="date" value="${to}" max="${today.date}" data-range-to /></label></div>
      </div>
      <div class="wr-stats is-four"><div><span>Đã nộp</span><b class="is-done">${count('submitted')}</b></div><div><span>Nộp trễ</span><b class="is-late">${count('late')}</b></div><div><span>Chưa nộp</span><b class="is-missing">${count('missing', 'overdue')}</b>${count('overdue') ? `<small class="wr-stat-note">${count('overdue')} còn nộp trễ được</small>` : ''}</div><div><span>Chưa đến hạn</span><b class="is-upcoming">${count('upcoming')}</b></div></div>
      <div class="wr-ov-tools">
        <div class="wr-view-switch" role="tablist">${[['matrix', '👥 Theo nhân viên'], ['list', '☰ Danh sách']].map(([value, label]) => `<button type="button" class="${overviewState.view === value ? 'is-active' : ''}" data-ov-view="${value}">${label}</button>`).join('')}</div>
        <input type="search" placeholder="Tìm nhân viên..." value="${escape(overviewState.search)}" data-ov-search />
        <select data-ov-department><option value="">Tất cả phòng ban</option>${departments.map((name) => `<option value="${escape(name)}" ${overviewState.department === name ? 'selected' : ''}>${escape(name)}</option>`).join('')}</select>
      </div>
      <div class="wr-filter-chips is-status">${[['all', `Tất cả (${rows.length})`], ['submitted', `Đã nộp (${count('submitted')})`], ['late', `Nộp trễ (${count('late')})`], ['missing', `Chưa nộp (${count('missing')})`], ['overdue', `Quá hạn (${count('overdue')})`], ['upcoming', `Chưa đến hạn (${count('upcoming')})`]].map(([value, label]) => `<button type="button" class="${overviewState.status === value ? 'is-active' : ''}" data-status-filter="${value}">${label}</button>`).join('')}</div>
      <div data-ov-body></div>`;
    const body = panel.querySelector('[data-ov-body]');

    // Rows left after the search box and the department picker.
    const filtered = () => {
      const query = overviewState.search.trim().toLowerCase();
      return rows.filter((row) => (!overviewState.department || row.department === overviewState.department) && (!query || `${row.name} ${row.title || ''}`.toLowerCase().includes(query)));
    };

    // By person: each person gets one line with their own reports only (people are given different templates).
    const drawMatrix = (list) => {
      const people = [...list.reduce((map, row) => {
        const person = map.get(row.userId) || { ...row, cells: new Map() };
        person.cells.set(row.templateName, [...(person.cells.get(row.templateName) || []), row]);
        return map.set(row.userId, person);
      }, new Map()).values()];
      // A status chip keeps the people who have at least one report in that status.
      const shown = people.filter((person) => overviewState.status === 'all' || [...person.cells.values()].flat().some((row) => row.status === overviewState.status));
      if (!shown.length) return '<div class="wr-empty"><span aria-hidden="true">🗂️</span><b>Không có nhân viên nào theo bộ lọc</b><small>Thử bỏ bớt bộ lọc.</small></div>';
      const worst = (cell) => order.find((status) => cell.some((row) => row.status === status));
      const byDepartment = [...shown.reduce((map, person) => map.set(person.department, [...(map.get(person.department) || []), person]), new Map())].sort((a, b) => a[0].localeCompare(b[0], 'vi'));
      const chip = (person, name) => {
        const cell = person.cells.get(name);
        const status = worst(cell);
        const finished = cell.filter(done).length;
        const detail = cell.length === 1 ? (cell[0].submittedAt ? clock(cell[0].submittedAt) : statusText[status]) : `${finished}/${cell.length} kỳ`;
        return `<button type="button" class="wr-report-chip is-${status}" data-cell="${escape(person.userId)}|${escape(name)}" title="${escape(`${name} · ${statusText[status]}`)}"><i aria-hidden="true">${statusIcon[status]}</i><span>${escape(name)}</span><small>${escape(detail)}</small></button>`;
      };
      return `<div class="wr-legend" aria-label="Chú thích"><span class="wr-legend-title">ℹ️ Chú thích:</span>${['submitted', 'late', 'overdue', 'missing', 'upcoming'].map((status) => `<span class="wr-legend-item is-${status}"><i aria-hidden="true">${statusIcon[status]}</i>${statusText[status]}</span>`).join('')}</div>
        ${byDepartment.map(([department, members]) => {
          const all = members.flatMap((person) => [...person.cells.values()].flat());
          const percent = all.length ? Math.round((all.filter(done).length / all.length) * 100) : 0;
          return `<section class="wr-people-group">
            <header><b>${escape(department)}</b><span>${members.length} người</span><span class="wr-matrix-progress"><i style="width:${percent}%"></i></span><small>${all.filter(done).length}/${all.length} báo cáo · ${percent}%</small></header>
            ${members.sort((a, b) => order.indexOf(worst([...a.cells.values()].flat())) - order.indexOf(worst([...b.cells.values()].flat())) || a.name.localeCompare(b.name, 'vi')).map((person) => {
              const mine = [...person.cells.values()].flat();
              const mineDone = mine.filter(done).length;
              const counts = ['missing', 'overdue', 'late', 'upcoming'].map((status) => [status, mine.filter((row) => row.status === status).length]).filter(([, n]) => n);
              return `<article class="wr-people-row">
                <div class="wr-people-who"><span class="wr-avatar">${person.picture ? `<img src="${escape(person.picture)}" alt="" referrerpolicy="no-referrer" />` : escape((person.name || '?').charAt(0).toUpperCase())}</span><span><b>${escape(person.name)}</b>${person.title ? `<small>${escape(person.title)}</small>` : ''}</span></div>
                <div class="wr-people-score"><b>${mineDone}/${mine.length}</b><span>đã nộp</span><span class="wr-matrix-progress"><i style="width:${mine.length ? Math.round((mineDone / mine.length) * 100) : 0}%"></i></span>${counts.map(([status, n]) => `<em class="is-${status}">${statusIcon[status]} ${n} ${countLabel[status]}</em>`).join('')}</div>
                <div class="wr-people-reports">${[...person.cells.keys()].sort((a, b) => order.indexOf(worst(person.cells.get(a))) - order.indexOf(worst(person.cells.get(b))) || a.localeCompare(b, 'vi')).map((name) => chip(person, name)).join('')}</div>
              </article>`;
            }).join('')}
          </section>`;
        }).join('')}`;
    };

    const drawList = (list) => {
      const visible = list.filter((row) => overviewState.status === 'all' || row.status === overviewState.status);
      const groupKey = (row) => (singleDay ? row.department : row.dueDate);
      const groups = [...visible.reduce((map, row) => map.set(groupKey(row), [...(map.get(groupKey(row)) || []), row]), new Map())];
      if (!singleDay) groups.sort((a, b) => b[0].localeCompare(a[0]));
      const groupTitle = (key) => (singleDay ? escape(key) : escape(new Date(`${key}T00:00:00`).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })));
      return groups.length ? groups.map(([key, people]) => `<section class="wr-group"><h3>${groupTitle(key)}<small>${people.filter(done).length}/${people.length} đã nộp</small></h3>
        ${people.sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status) || a.name.localeCompare(b.name, 'vi')).map(personRow).join('')}</section>`).join('')
        : `<div class="wr-empty"><span aria-hidden="true">🗂️</span><b>${rows.length ? 'Không có báo cáo nào theo bộ lọc' : 'Không có báo cáo nào cần nộp trong khoảng này'}</b><small>${rows.length ? 'Thử chọn trạng thái khác.' : 'Tạo mẫu ở tab "Mẫu báo cáo" và xếp nhân viên ở tab "Phòng ban & vị trí".'}</small></div>`;
    };

    const openReport = async (id) => openModal(reportDetail((await request(`/api/work-reports/${id}`)).report));
    const drawBody = () => {
      const list = filtered();
      body.innerHTML = !rows.length ? drawList(list) : overviewState.view === 'list' ? drawList(list) : drawMatrix(list);
      body.querySelectorAll('[data-report]').forEach((button) => { button.onclick = () => openReport(button.dataset.report); });
      body.querySelectorAll('[data-cell]').forEach((button) => {
        button.onclick = () => {
          const split = button.dataset.cell.indexOf('|');
          const userId = button.dataset.cell.slice(0, split);
          const name = button.dataset.cell.slice(split + 1);
          const cell = list.filter((row) => row.userId === userId && row.templateName === name);
          if (cell.length === 1 && cell[0].reportId) return openReport(cell[0].reportId);
          openModal(`<h2>${escape(cell[0].name)} · ${escape(name)}</h2><div class="wr-cell-list">${cell.sort((a, b) => b.dueDate.localeCompare(a.dueDate)).map(personRow).join('')}</div>`);
          modalBody.querySelectorAll('[data-report]').forEach((item) => { item.onclick = () => openReport(item.dataset.report); });
        };
      });
    };
    drawBody();

    panel.querySelectorAll('[data-range]').forEach((button) => {
      button.onclick = () => {
        const [, , rangeFrom, rangeTo] = ranges.find(([key]) => key === button.dataset.range);
        Object.assign(overviewState, { from: rangeFrom, to: rangeTo });
        renderOverview();
      };
    });
    const fromInput = panel.querySelector('[data-range-from]');
    const toInput = panel.querySelector('[data-range-to]');
    const applyRange = () => { if (fromInput.value && toInput.value) { Object.assign(overviewState, { from: fromInput.value, to: toInput.value }); renderOverview(); } };
    fromInput.onchange = applyRange;
    toInput.onchange = applyRange;
    panel.querySelectorAll('[data-status-filter]').forEach((button) => {
      button.onclick = () => {
        overviewState.status = button.dataset.statusFilter;
        panel.querySelectorAll('[data-status-filter]').forEach((chip) => chip.classList.toggle('is-active', chip === button));
        drawBody();
      };
    });
    panel.querySelectorAll('[data-ov-view]').forEach((button) => {
      button.onclick = () => {
        overviewState.view = button.dataset.ovView;
        try { localStorage.setItem('wr-overview-view', overviewState.view); } catch {}
        panel.querySelectorAll('[data-ov-view]').forEach((item) => item.classList.toggle('is-active', item === button));
        drawBody();
      };
    });
    panel.querySelector('[data-ov-search]').oninput = (event) => { overviewState.search = event.target.value; drawBody(); };
    panel.querySelector('[data-ov-department]').onchange = (event) => { overviewState.department = event.target.value; drawBody(); };
  }

  // ---------- Departments, positions and who sits where ----------
  let peopleFilter = 'all';
  async function renderStructure(data) {
    const panel = panels.structure;
    const structure = data || await request('/api/work-reports/structure');
    const { departments, positions, assignments, users } = structure;
    const save = async (url, body, method = 'POST') => renderStructure({ ...await request(url, { method, body: body && JSON.stringify(body) }), users });
    const placed = users.filter((person) => assignments[person.id]?.departmentId).length;
    const placeLabel = (place) => {
      const department = departments.find((item) => item.id === place?.departmentId);
      if (!department) return '';
      const position = positions.find((item) => item.id === place.positionId);
      return position ? `${department.name} › ${position.name}` : department.name;
    };
    panel.innerHTML = `<div class="wr-structure">
      <section class="wr-structure-col">
        <div class="wr-col-head"><span class="wr-col-icon" aria-hidden="true">🏢</span><div><h2>Phòng ban & vị trí</h2><p>${departments.length} phòng ban · ${positions.length} vị trí</p></div></div>
        <form class="wr-add-row" data-add-department><input name="name" placeholder="Tên phòng ban mới, ví dụ: Kho vải Quận 4" maxlength="120" required /><button type="submit" class="wr-primary">+ Thêm</button></form>
        ${departments.length ? departments.map((department) => {
          const departmentPositions = positions.filter((position) => position.departmentId === department.id);
          const members = users.filter((person) => assignments[person.id]?.departmentId === department.id).length;
          return `<article class="wr-dept" data-department="${escape(department.id)}">
            <div class="wr-dept-head">
              <div class="wr-dept-title"><b>${escape(department.name)}</b><small>${departmentPositions.length} vị trí · ${members} người</small></div>
              <div class="wr-icon-actions"><button type="button" data-rename-department title="Đổi tên" aria-label="Đổi tên phòng ban">✏️</button><button type="button" class="is-danger" data-delete-department title="Xóa" aria-label="Xóa phòng ban">🗑</button></div>
            </div>
            <div class="wr-position-list">${departmentPositions.map((position) => `<span class="wr-position" data-position="${escape(position.id)}">${escape(position.name)}<button type="button" data-delete-position aria-label="Xóa vị trí ${escape(position.name)}">×</button></span>`).join('') || '<small>Chưa có vị trí. Thêm vị trí ở ô bên dưới.</small>'}</div>
            <form class="wr-add-row is-small" data-add-position><input name="name" placeholder="Thêm vị trí, ví dụ: Thủ kho" maxlength="120" required /><button type="submit" aria-label="Thêm vị trí">+</button></form>
          </article>`;
        }).join('') : '<div class="wr-empty"><span aria-hidden="true">🏢</span><b>Chưa có phòng ban</b><small>Nhập tên phòng ban ở ô bên trên rồi bấm "+ Thêm".</small></div>'}
      </section>
      <section class="wr-structure-col">
        <div class="wr-col-head"><span class="wr-col-icon" aria-hidden="true">👥</span><div><h2>Xếp nhân viên</h2><p>${placed}/${users.length} người đã xếp · mẫu báo cáo tự giao theo đây</p></div></div>
        <div class="wr-people-tools"><input type="search" class="wr-search" placeholder="Tìm theo tên hoặc email..." data-search-people />
          <div class="wr-filter-chips is-compact">${[['all', `Tất cả (${users.length})`], ['unplaced', `Chưa xếp (${users.length - placed})`], ['placed', `Đã xếp (${placed})`]].map(([value, label]) => `<button type="button" class="${peopleFilter === value ? 'is-active' : ''}" data-people-filter="${value}">${label}</button>`).join('')}</div></div>
        <div class="wr-people">${users.map((person) => {
          const place = assignments[person.id] || {};
          const label = placeLabel(place);
          return `<div class="wr-person-row${label ? ' is-placed' : ''}" data-person="${escape(person.id)}" data-placed="${label ? 'yes' : 'no'}" data-search="${escape(`${person.name} ${person.email}`.toLowerCase())}">
            <div class="wr-person-top">
              <span class="wr-avatar">${person.picture ? `<img src="${escape(person.picture)}" alt="" referrerpolicy="no-referrer" />` : escape((person.name || '?').charAt(0).toUpperCase())}</span>
              <span class="wr-person-info"><b>${escape(person.name)}</b><small>${escape(person.email || '')}</small></span>
              <span class="wr-place${label ? '' : ' is-empty'}">${label ? escape(label) : 'Chưa xếp'}</span>
            </div>
            <div class="wr-person-selects">
              <select data-pick-department aria-label="Phòng ban của ${escape(person.name)}"><option value="">Chọn phòng ban…</option>${departments.map((department) => `<option value="${escape(department.id)}" ${place.departmentId === department.id ? 'selected' : ''}>${escape(department.name)}</option>`).join('')}</select>
              <select data-pick-position aria-label="Vị trí của ${escape(person.name)}" ${place.departmentId ? '' : 'disabled'}><option value="">${place.departmentId ? 'Chọn vị trí…' : 'Chọn phòng ban trước'}</option>${positions.filter((position) => position.departmentId === place.departmentId).map((position) => `<option value="${escape(position.id)}" ${place.positionId === position.id ? 'selected' : ''}>${escape(position.name)}</option>`).join('')}</select>
            </div>
          </div>`;
        }).join('')}</div>
      </section></div>`;
    const run = (action) => action().catch((error) => alert(error.message));
    panel.querySelector('[data-add-department]').onsubmit = (event) => { event.preventDefault(); run(() => save('/api/work-reports/departments', { name: event.target.name.value })); };
    panel.querySelectorAll('[data-department]').forEach((card) => {
      const id = card.dataset.department;
      card.querySelector('[data-rename-department]').onclick = () => { const name = prompt('Tên mới của phòng ban:', departments.find((item) => item.id === id).name); if (name) run(() => save('/api/work-reports/departments', { id, name })); };
      card.querySelector('[data-delete-department]').onclick = () => { if (confirm('Xóa phòng ban này? Các vị trí trong phòng ban cũng bị xóa và nhân viên ở đây sẽ chưa được xếp.')) run(() => save(`/api/work-reports/departments/${id}`, null, 'DELETE')); };
      card.querySelector('[data-add-position]').onsubmit = (event) => { event.preventDefault(); run(() => save('/api/work-reports/positions', { name: event.target.name.value, departmentId: id })); };
      card.querySelectorAll('[data-delete-position]').forEach((button) => { button.onclick = () => { if (confirm('Xóa vị trí này?')) run(() => save(`/api/work-reports/positions/${button.closest('[data-position]').dataset.position}`, null, 'DELETE')); }; });
    });
    const filterPeople = () => {
      const query = panel.querySelector('[data-search-people]').value.trim().toLowerCase();
      panel.querySelectorAll('[data-person]').forEach((row) => {
        const matchesFilter = peopleFilter === 'all' || (peopleFilter === 'placed') === (row.dataset.placed === 'yes');
        row.hidden = !matchesFilter || !row.dataset.search.includes(query);
      });
    };
    panel.querySelector('[data-search-people]').oninput = filterPeople;
    panel.querySelectorAll('[data-people-filter]').forEach((button) => {
      button.onclick = () => {
        peopleFilter = button.dataset.peopleFilter;
        panel.querySelectorAll('[data-people-filter]').forEach((item) => item.classList.toggle('is-active', item === button));
        filterPeople();
      };
    });
    filterPeople();
    panel.querySelectorAll('[data-person]').forEach((row) => {
      const assign = (departmentId, positionId) => run(() => save('/api/work-reports/assignments', { userId: row.dataset.person, departmentId, positionId }));
      row.querySelector('[data-pick-department]').onchange = (event) => assign(event.target.value || null, null);
      row.querySelector('[data-pick-position]').onchange = (event) => assign(row.querySelector('[data-pick-department]').value, event.target.value || null);
    });
  }

  // ---------- Templates ----------
  let templateData = null;
  async function renderTemplates() {
    const panel = panels.templates;
    templateData = await request('/api/work-reports/templates');
    const { templates, departments, positions, users } = templateData;
    const departmentName = (id) => departments.find((item) => item.id === id)?.name || 'Phòng ban đã xóa';
    const positionName = (id) => { const position = positions.find((item) => item.id === id); return position ? `${departmentName(position.departmentId)} › ${position.name}` : 'Vị trí đã xóa'; };
    const userName = (id) => users.find((item) => item.id === id)?.name || id;
    panel.innerHTML = `<div class="wr-templates-head"><p>Mỗi mẫu có lịch nộp riêng (mỗi ngày, mỗi tuần hoặc mỗi tháng) và áp dụng cho phòng ban, vị trí hoặc nhân viên được chọn.</p><button type="button" class="wr-primary" data-new-template>+ Tạo mẫu mới</button></div>
      ${templates.length ? templates.map((template) => `<article class="wr-template-card">
        <div class="wr-template-main"><h3>${escape(template.name)}${template.kpi ? ' <span class="wr-kpi-badge">📈 KPI</span>' : ''}</h3>
        <p>🗓️ ${escape(scheduleText(template.schedule))} · hạn ${escape(template.deadline)} · ${template.items.length} mục${template.requireBeforeCheckout ? ' · Chặn check-out khi chưa nộp' : ''}</p>
        <div class="wr-chips">${template.targets.departmentIds.map((id) => `<span>🏢 ${escape(departmentName(id))}</span>`).join('')}${template.targets.positionIds.map((id) => `<span>👤 ${escape(positionName(id))}</span>`).join('')}${template.targets.userIds.map((id) => `<span>🙋 ${escape(userName(id))}</span>`).join('')}</div>
        <p class="wr-recipients">${template.recipients.length ? `<b>${template.recipients.length} người nhận:</b> ${escape(template.recipients.join(', '))}` : '<b>Chưa có ai nhận mẫu này.</b> Hãy xếp nhân viên vào phòng ban / vị trí đã chọn, hoặc chọn nhân viên cụ thể.'}</p></div>
        <div class="wr-template-actions"><button type="button" data-edit-template="${escape(template.id)}">Sửa</button><button type="button" class="is-danger" data-delete-template="${escape(template.id)}">Xóa</button></div>
      </article>`).join('') : '<div class="wr-empty"><span aria-hidden="true">📝</span><b>Chưa có mẫu báo cáo nào</b><small>Bấm "Tạo mẫu mới" để bắt đầu.</small></div>'}`;
    panel.querySelector('[data-new-template]').onclick = () => editTemplate(null);
    panel.querySelectorAll('[data-edit-template]').forEach((button) => { button.onclick = () => editTemplate(templates.find((item) => item.id === button.dataset.editTemplate)); });
    panel.querySelectorAll('[data-delete-template]').forEach((button) => {
      button.onclick = async () => {
        if (!confirm('Xóa mẫu báo cáo này? Các báo cáo đã nộp vẫn được giữ lại.')) return;
        await request(`/api/work-reports/templates/${button.dataset.deleteTemplate}`, { method: 'DELETE' });
        renderTemplates();
      };
    });
  }

  function editTemplate(template) {
    const { departments, positions, users } = templateData;
    const state = template ? JSON.parse(JSON.stringify(template)) : { name: '', deadline: '21:00', requireBeforeCheckout: true, targets: { departmentIds: [], positionIds: [], userIds: [] }, schedule: { frequency: 'daily', weekdays: [1, 2, 3, 4, 5, 6] }, items: [{ label: '', type: 'check', required: true }] };
    state.schedule ||= { frequency: 'daily', weekdays: [1, 2, 3, 4, 5, 6, 7] };
    const checkList = (name, entries, selected) => `<div class="wr-checklist" data-list="${name}"><input type="search" placeholder="Tìm..." data-filter-list />${entries.map(([value, label]) => `<label><input type="checkbox" value="${escape(value)}" ${selected.includes(value) ? 'checked' : ''} /> <span>${escape(label)}</span></label>`).join('') || '<small>Chưa có. Tạo ở tab "Phòng ban & vị trí".</small>'}</div>`;
    const itemRow = (item, index) => `<div class="wr-edit-item is-${item.type}" data-index="${index}">
      <div class="wr-edit-item-top">
        <span class="wr-type-badge" title="${typeLabels[item.type]}">${typeIcons[item.type]}</span>
        <input class="wr-edit-label" value="${escape(item.label)}" placeholder="Mục ${index + 1}: ví dụ Ảnh kệ hàng cuối ngày" data-prop="label" />
        <span class="wr-edit-item-actions"><button type="button" data-move="-1" aria-label="Lên" ${index === 0 ? 'disabled' : ''}>↑</button><button type="button" data-move="1" aria-label="Xuống" ${index === state.items.length - 1 ? 'disabled' : ''}>↓</button><button type="button" class="is-danger" data-remove-item aria-label="Xóa mục">🗑</button></span>
      </div>
      <div class="wr-edit-item-bottom">
        <label class="wr-edit-type"><span>Kiểu</span><select data-prop="type">${Object.entries(typeLabels).map(([value, label]) => `<option value="${value}" ${item.type === value ? 'selected' : ''}>${typeIcons[value]}  ${label}</option>`).join('')}</select></label>
        <label class="wr-switch"><input type="checkbox" data-prop="required" ${item.required ? 'checked' : ''} /><span aria-hidden="true"></span>Bắt buộc</label>
        ${item.type === 'photo' ? `<label class="wr-edit-count">Số ảnh tối thiểu <input type="number" min="1" max="6" value="${item.minPhotos || 1}" data-prop="minPhotos" /></label>` : ''}
        ${item.type === 'number' && state.kpi ? `<div class="wr-kpi-item">
          <label>Kiểu chỉ số <select data-prop="kpiType"><option value="count" ${item.kpiType !== 'ratio' ? 'selected' : ''}>Số lượng</option><option value="ratio" ${item.kpiType === 'ratio' ? 'selected' : ''}>Tỷ lệ % (có ô Tổng)</option></select></label>
          <label>🎯 ${item.kpiType === 'ratio' ? 'Tỷ lệ cần đạt (%)' : 'Chỉ tiêu tháng'} <input type="number" min="0" step="any" value="${escape(item.target ?? '')}" placeholder="${item.kpiType === 'ratio' ? '100' : 'VD: 87000'}" data-prop="target" /></label>
          <label>⭐ Điểm chuẩn <input type="number" min="0" step="any" value="${escape(item.weight ?? '')}" placeholder="VD: 15" data-prop="weight" /></label>
          ${item.kpiType === 'ratio' ? `<p class="wr-kpi-help">Mỗi lần nộp, nhân viên nhập <b>Đã làm được</b> / <b>Tổng số phải làm</b> của riêng họ (VD: được giao 3 việc, làm xong 3 → 3/3 = 100%). Ô "Tỷ lệ cần đạt" là mức % chung cho mọi người, để trống = 100%.${item.target && item.target < 50 ? ` <b class="is-warn">⚠ ${escape(item.target)}% là rất thấp — có phải bạn đang nhập số việc? Số việc để nhân viên nhập ở ô Tổng.</b>` : ''}</p>` : ''}
        </div>` : ''}
        ${item.type === 'file' ? `<label class="wr-edit-count">Số file tối thiểu <input type="number" min="1" max="3" value="${item.minFiles || 1}" data-prop="minFiles" /></label>` : ''}
      </div>
      <div class="wr-extras-row"><span>Kèm thêm:</span>${extraTypes.filter((type) => type !== item.type).map((type) => {
        const extra = (item.extras || []).find((entry) => entry.type === type);
        return `<span class="wr-extra-chip${extra ? ' is-on' : ''}"><button type="button" data-toggle-extra="${type}">${typeIcons[type]} ${typeShort[type] === 'Chữ' ? 'Ghi chú' : typeShort[type]}${extra ? ' ✓' : ''}</button>${extra ? `<label title="Bắt buộc"><input type="checkbox" data-extra-required="${type}" ${extra.required ? 'checked' : ''} /> bắt buộc</label>` : ''}</span>`;
      }).join('')}</div>
      ${item.type === 'select' ? `<input class="wr-edit-wide" value="${escape((item.options || []).join(', '))}" placeholder="Các lựa chọn, cách nhau bằng dấu phẩy. Ví dụ: Tốt, Bình thường, Có sự cố" data-prop="options" />` : ''}
      <input class="wr-edit-wide is-hint" value="${escape(item.hint || '')}" placeholder="💡 Hướng dẫn cho nhân viên (không bắt buộc)" data-prop="hint" />
    </div>`;
    const render = () => {
      const schedule = state.schedule;
      openModal(`<h2 class="wr-modal-title">${template ? 'Sửa mẫu báo cáo' : 'Tạo mẫu báo cáo'}</h2>
        <form class="wr-editor" data-editor>
          <label>Tên mẫu<input name="name" value="${escape(state.name)}" placeholder="Ví dụ: Báo cáo cuối ngày - Kho vải" required /></label>
          <fieldset><legend>Lịch nộp</legend>
            <div class="wr-frequency">${[['daily', 'Hằng ngày'], ['weekly', 'Hằng tuần'], ['monthly', 'Hằng tháng']].map(([value, label]) => `<label class="${schedule.frequency === value ? 'is-active' : ''}"><input type="radio" name="frequency" value="${value}" ${schedule.frequency === value ? 'checked' : ''} /> ${label}</label>`).join('')}</div>
            ${schedule.frequency === 'daily' ? `<div class="wr-weekdays">${[1, 2, 3, 4, 5, 6, 7].map((day) => `<label class="${(schedule.weekdays || []).includes(day) ? 'is-active' : ''}"><input type="checkbox" name="weekdays" value="${day}" ${(schedule.weekdays || []).includes(day) ? 'checked' : ''} /> ${weekdayNames[day]}</label>`).join('')}</div><small>Chọn những ngày trong tuần cần nộp.</small>` : ''}
            ${schedule.frequency === 'weekly' ? `<label class="wr-inline">Nộp mỗi tuần, hạn vào <select name="weekday">${[1, 2, 3, 4, 5, 6, 7].map((day) => `<option value="${day}" ${(schedule.weekday || 6) === day ? 'selected' : ''}>${weekdayLong[day]}</option>`).join('')}</select></label><label class="wr-inline">Mở nhập từ <select name="openWeekday"><option value="">Cả tuần (từ Thứ 2)</option>${[1, 2, 3, 4, 5, 6, 7].map((day) => `<option value="${day}" ${schedule.openWeekday === day ? 'selected' : ''}>${weekdayLong[day]}</option>`).join('')}</select></label><small>${schedule.openWeekday ? `Nhân viên nhập được từ ${weekdayLong[schedule.openWeekday]} đến hạn; trước đó báo cáo hiện nhưng bị khoá.` : 'Nộp bất kỳ ngày nào trong tuần (Thứ 2 – Chủ nhật), trễ nếu qua hạn.'}</small>` : ''}
            ${schedule.frequency === 'monthly' ? `<label class="wr-inline">Nộp mỗi tháng, hạn vào ngày <input type="number" name="monthDay" min="1" max="31" value="${schedule.monthDay || 28}" /></label><label class="wr-inline">Mở nhập từ ngày <input type="number" name="openDay" min="1" max="31" placeholder="Cả tháng" value="${schedule.openDay || ''}" /></label><small>${schedule.openDay ? `Nhân viên nhập được từ ngày ${schedule.openDay} đến hạn; trước đó báo cáo hiện nhưng bị khoá.` : 'Để trống: mở nhập cả tháng.'} Tháng không có ngày đó thì lấy ngày cuối tháng.</small>` : ''}
            <div class="wr-editor-row"><label>Hạn nộp lúc<input name="deadline" type="time" value="${escape(state.deadline)}" /></label>
              <label>Áp dụng từ ngày<input name="startDate" type="date" value="${escape(schedule.startDate || '')}" /></label>
              <label>Đến ngày<input name="endDate" type="date" value="${escape(schedule.endDate || '')}" /></label></div>
            <small>Để trống "từ ngày / đến ngày" nếu mẫu áp dụng lâu dài.</small>
            <label class="wr-inline wr-toggle"><input type="checkbox" name="requireBeforeCheckout" ${state.requireBeforeCheckout ? 'checked' : ''} /> Chưa nộp thì không được check-out (vào ngày hạn nộp)</label>
            <label class="wr-kpi-toggle"><input type="checkbox" name="kpi" ${state.kpi ? 'checked' : ''} /><span><b>📈 Mẫu báo cáo KPI</b><small>Báo cáo của mẫu này hiện trong trang Lương &amp; KPI. Mỗi mục nhập số đặt kiểu chỉ số, chỉ tiêu tháng và điểm chuẩn: Tỉ lệ hoàn thành = Giá trị ÷ Chỉ tiêu, Điểm đạt = Điểm chuẩn × tỉ lệ (tối đa 100%), % KPI = tổng Điểm đạt.</small>${state.kpi ? (() => { const total = state.items.reduce((sum, item) => sum + (item.type === 'number' && item.weight > 0 ? item.weight : 0), 0); return `<em class="wr-weight-total${total !== 100 ? ' is-off' : ''}" data-weight-total>Tổng điểm chuẩn: ${total.toLocaleString('vi-VN')}/100</em>`; })() : ''}</span></label>
          </fieldset>
          <fieldset><legend>Người nhận mẫu này</legend>
            <div class="wr-target-grid">
              <div><b>Phòng ban</b>${checkList('departmentIds', departments.map((item) => [item.id, item.name]), state.targets.departmentIds)}</div>
              <div><b>Vị trí</b>${checkList('positionIds', positions.map((item) => [item.id, `${departments.find((department) => department.id === item.departmentId)?.name || ''} › ${item.name}`]), state.targets.positionIds)}</div>
              <div><b>Nhân viên cụ thể</b>${checkList('userIds', users.map((item) => [item.id, `${item.name} (${item.email})`]), state.targets.userIds)}</div>
            </div>
            <small>Chọn phòng ban để giao cho cả phòng; chọn vị trí để chỉ giao cho người ở vị trí đó; chọn nhân viên cụ thể để thêm từng người.</small>
          </fieldset>
          <fieldset><legend>Các mục báo cáo (${state.items.length})</legend><div class="wr-edit-items" data-items>${state.items.map(itemRow).join('')}</div>
            <div class="wr-add-types"><span>+ Thêm mục:</span>${Object.keys(typeLabels).map((type) => `<button type="button" data-add-type="${type}"><b>${typeIcons[type]}</b>${typeShort[type]}</button>`).join('')}</div></fieldset>
          <p class="wr-error" data-editor-error hidden></p>
          <div class="wr-editor-actions"><button type="button" data-wr-close>Hủy</button><button type="submit" class="wr-primary">Lưu mẫu</button></div>
        </form>`);
      const form = modalBody.querySelector('[data-editor]');
      const sync = () => {
        state.name = form.name.value;
        state.deadline = form.deadline.value || '21:00';
        state.requireBeforeCheckout = form.requireBeforeCheckout.checked;
        state.kpi = form.kpi.checked;
        const frequency = form.querySelector('[name="frequency"]:checked')?.value || 'daily';
        state.schedule = { ...state.schedule, frequency, startDate: form.startDate.value, endDate: form.endDate.value };
        if (form.querySelector('[name="weekdays"]')) state.schedule.weekdays = [...form.querySelectorAll('[name="weekdays"]:checked')].map((input) => Number(input.value));
        if (form.weekday) state.schedule.weekday = Number(form.weekday.value);
        if (form.monthDay) state.schedule.monthDay = Number(form.monthDay.value);
        if (form.openWeekday) state.schedule.openWeekday = Number(form.openWeekday.value) || undefined;
        if (form.openDay) state.schedule.openDay = Number(form.openDay.value) || undefined;
        form.querySelectorAll('[data-list]').forEach((list) => { state.targets[list.dataset.list] = [...list.querySelectorAll('input[type="checkbox"]:checked')].map((input) => input.value); });
        form.querySelectorAll('[data-index]').forEach((row) => {
          const item = state.items[Number(row.dataset.index)];
          item.extras = (item.extras || []).filter((extra) => extra.type !== item.type).map((extra) => ({ ...extra, required: Boolean(row.querySelector(`[data-extra-required="${extra.type}"]`)?.checked) }));
          row.querySelectorAll('[data-prop]').forEach((input) => {
            const prop = input.dataset.prop;
            item[prop] = input.type === 'checkbox' ? input.checked : prop === 'options' ? input.value.split(',').map((value) => value.trim()).filter(Boolean) : ['minPhotos', 'minFiles'].includes(prop) ? Number(input.value) : ['target', 'weight'].includes(prop) ? (input.value === '' ? undefined : Number(input.value)) : input.value;
          });
        });
      };
      form.querySelectorAll('[name="frequency"], [name="weekdays"], [name="kpi"], [name="openWeekday"], [name="openDay"]').forEach((input) => { input.onchange = () => { sync(); render(); }; });
      form.querySelectorAll('[data-filter-list]').forEach((search) => {
        search.oninput = () => search.parentElement.querySelectorAll('label').forEach((label) => { label.hidden = !label.textContent.toLowerCase().includes(search.value.trim().toLowerCase()); });
      });
      form.querySelectorAll('[data-prop="type"], [data-prop="kpiType"]').forEach((select) => { select.onchange = () => { sync(); render(); }; });
      form.querySelectorAll('[data-prop="target"]').forEach((input) => { input.onchange = () => { sync(); render(); }; });
      form.querySelectorAll('[data-prop="weight"]').forEach((input) => { input.oninput = () => { sync(); const total = state.items.reduce((sum, item) => sum + (item.type === 'number' && item.weight > 0 ? item.weight : 0), 0); const note = form.querySelector('[data-weight-total]'); if (note) { note.textContent = `Tổng điểm chuẩn: ${total.toLocaleString('vi-VN')}/100`; note.classList.toggle('is-off', total !== 100); } }; });
      form.querySelectorAll('[data-toggle-extra]').forEach((button) => {
        button.onclick = () => {
          sync();
          const item = state.items[Number(button.closest('[data-index]').dataset.index)];
          const type = button.dataset.toggleExtra;
          item.extras = (item.extras || []).some((extra) => extra.type === type) ? item.extras.filter((extra) => extra.type !== type) : [...(item.extras || []), { type, required: false }];
          render();
        };
      });
      form.querySelectorAll('[data-add-type]').forEach((button) => {
        button.onclick = () => {
          sync();
          state.items.push({ label: '', type: button.dataset.addType, required: true });
          render();
          const inputs = modalBody.querySelectorAll('.wr-edit-label');
          inputs[inputs.length - 1]?.focus();
        };
      });
      form.querySelectorAll('[data-remove-item]').forEach((button) => { button.onclick = () => { sync(); state.items.splice(Number(button.closest('[data-index]').dataset.index), 1); render(); }; });
      form.querySelectorAll('[data-move]').forEach((button) => {
        button.onclick = () => {
          sync();
          const from = Number(button.closest('[data-index]').dataset.index);
          const to = from + Number(button.dataset.move);
          if (to < 0 || to >= state.items.length) return;
          [state.items[from], state.items[to]] = [state.items[to], state.items[from]];
          render();
        };
      });
      form.onsubmit = async (event) => {
        event.preventDefault();
        sync();
        const error = form.querySelector('[data-editor-error]');
        try {
          await request('/api/work-reports/templates', { method: 'POST', body: JSON.stringify({ ...state, id: template?.id }) });
          closeModal();
          renderTemplates();
        } catch (saveError) {
          error.textContent = saveError.message;
          error.hidden = false;
        }
      };
    };
    render();
  }

  // ---------- Start ----------
  let kpiView = null;
  const loaders = {
    history: () => renderHistory(),
    kpi: async () => { if (kpiView) await kpiView.load(); else kpiView = window.GusaKpi.mount(panels.kpi); },
    overview: () => renderOverview(),
    templates: () => renderTemplates(),
    structure: () => renderStructure(),
  };
  const show = (name) => {
    Object.entries(panels).forEach(([key, panel]) => { panel.hidden = key !== name; });
    tabs.querySelectorAll('[data-wr-tab]').forEach((button) => button.classList.toggle('is-active', button.dataset.wrTab === name));
    // Keep the open tab in the address so a reload (or a shared link) lands on the same tab.
    const url = new URL(location.href);
    if (name === 'mine') url.searchParams.delete('tab'); else url.searchParams.set('tab', name);
    history.replaceState(null, '', url);
    loaders[name]?.().catch((error) => { panels[name].innerHTML = `<p class="wr-empty">${escape(error.message)}</p>`; });
  };
  tabs.addEventListener('click', (event) => { const button = event.target.closest('[data-wr-tab]'); if (button) show(button.dataset.wrTab); });

  Promise.all([request('/api/me'), request('/api/work-reports/today')]).then(([{ user }, data]) => {
    me = user || me;
    today = data;
    dateLabel.textContent = `Báo cáo ${new Date(`${data.date}T00:00:00`).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}`;
    tabs.querySelectorAll('[data-manager-only]').forEach((button) => { button.hidden = !data.canManage; });
    renderMine();
    const requested = new URLSearchParams(location.search).get('tab');
    if (loaders[requested] && (requested === 'history' || data.canManage)) show(requested);
  }).catch((error) => { panels.mine.innerHTML = `<p class="wr-empty">${escape(error.message)}</p>`; });
})();
