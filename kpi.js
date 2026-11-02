(function () {
  // Mounts the KPI view into a container holding [data-kpi-month], [data-kpi-stats], [data-kpi-search] and [data-kpi-list].
  function mount(root, { personal = false } = {}) {
    const list = root.querySelector('[data-kpi-list]');
    const stats = root.querySelector('[data-kpi-stats]');
    const monthInput = root.querySelector('[data-kpi-month]');
    const search = root.querySelector('[data-kpi-search]');
    const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
    const number = (value, digits = 0) => (value === null || value === undefined ? '—' : Number(value).toLocaleString('vi-VN', { maximumFractionDigits: digits }));
    const level = (percent) => (percent === null ? 'is-none' : percent >= 100 ? 'is-good' : percent >= 70 ? 'is-warn' : 'is-bad');
    const bar = (percent) => `<span class="kpi-bar ${level(percent)}"><i style="width:${Math.min(100, Math.max(0, percent || 0))}%"></i></span>`;
    let data = { people: [], canManage: false };
    // Links, notes, photos and files sent with a number item, as small chips.
    const attachmentChips = (attached, compact = false) => {
      if (!attached) return '';
      const chips = [];
      if (attached.link) chips.push(`<a class="kpi-attach is-link" href="${escape(attached.link)}" target="_blank" rel="noopener noreferrer" title="${escape(attached.link)}">🔗${compact ? '' : ' Mở link ↗'}</a>`);
      (attached.files || []).forEach((file) => chips.push(`<a class="kpi-attach is-file" href="${escape(file.url)}" target="_blank" rel="noopener" title="${escape(file.name)}">📎${compact ? '' : ` ${escape(file.name)}`}</a>`));
      if (attached.photos?.length) chips.push(`<a class="kpi-attach is-photo" href="${escape(attached.photos[0].url)}" target="_blank" rel="noopener" title="Xem ảnh">🖼${compact ? '' : ` ${attached.photos.length} ảnh`}</a>`);
      if (attached.note) chips.push(compact ? `<span class="kpi-attach is-note" title="${escape(attached.note)}">📝</span>` : `<span class="kpi-attach is-note" title="${escape(attached.note)}">📝 ${escape(attached.note.length > 60 ? `${attached.note.slice(0, 60)}…` : attached.note)}</span>`);
      return chips.join('');
    };
    // The most recent report that attached something to this item.
    const latestAttachment = (entry, itemId) => [...entry.reports].reverse().find((report) => report.attachments?.[itemId]);
    const openTables = new Set();

    const params = new URLSearchParams(location.search);
    const now = new Date();
    monthInput.value = /^\d{4}-\d{2}$/.test(params.get('month') || '') ? params.get('month') : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    monthInput.max = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    function renderStats() {
      const entries = data.people.flatMap((person) => person.templates);
      const due = entries.reduce((sum, entry) => sum + entry.due, 0);
      const submitted = entries.reduce((sum, entry) => sum + entry.submitted, 0);
      const late = entries.reduce((sum, entry) => sum + entry.late, 0);
      const achieved = entries.flatMap((entry) => entry.metrics).map((metric) => metric.achieved).filter((value) => value !== null);
      const averageAchieved = achieved.length ? achieved.reduce((sum, value) => sum + value, 0) / achieved.length : null;
      stats.innerHTML = [
        personal ? ['is-people', '📋', 'Mẫu KPI của bạn', entries.length] : ['is-people', '👥', 'Nhân viên có KPI', data.people.length],
        ['is-rate', '📝', 'Tỷ lệ nộp báo cáo', due ? `${Math.round((submitted / due) * 100)}%` : '—'],
        [`is-achieved ${level(averageAchieved)}`, '🎯', 'Đạt chỉ tiêu (TB)', averageAchieved === null ? '—' : `${number(averageAchieved, 1)}%`],
        ['is-late', '⏱', 'Báo cáo nộp trễ', late],
      ].map(([kind, icon, label, value]) => `<div class="kpi-stat ${kind}"><span aria-hidden="true">${icon}</span><small>${label}</small><b>${value}</b></div>`).join('');
    }

    function renderList() {
      const query = search.value.trim().toLowerCase();
      const people = data.people.filter((person) => !query || `${person.name} ${person.department} ${person.title}`.toLowerCase().includes(query));
      if (!data.people.length) {
        list.innerHTML = `<div class="kpi-empty"><span aria-hidden="true">📈</span><b>Chưa có KPI trong tháng này</b><small>${data.canManage ? 'Vào Báo cáo công việc → Mẫu báo cáo, bật "📈 Mẫu báo cáo KPI" và đặt chỉ tiêu cho các mục nhập số.' : 'Bạn chưa được giao mẫu báo cáo KPI.'}</small>${data.canManage ? '<a href="work-report.html?tab=templates">Mở Mẫu báo cáo ›</a>' : ''}</div>`;
        return;
      }
      list.innerHTML = people.length ? people.map((person) => `<article class="kpi-card">
        <header class="kpi-card-head">
          <span class="kpi-avatar">${person.picture ? `<img src="${escape(person.picture)}" alt="" referrerpolicy="no-referrer" />` : escape((person.name || '?').charAt(0).toUpperCase())}</span>
          <div><h2>${escape(person.name)}</h2><p>${escape(person.department)}${person.title ? ` · ${escape(person.title)}` : ''}</p></div>
        </header>
        ${person.templates.map((entry) => {
          const rate = entry.due ? Math.round((entry.submitted / entry.due) * 100) : null;
          const tableKey = `${person.userId}|${entry.templateId}`;
          const numberMetrics = entry.metrics;
          return `<section class="kpi-template">
            <div class="kpi-template-head"><h3>📈 ${escape(entry.templateName)}</h3><span class="kpi-rate ${level(rate)}">Đã nộp ${entry.submitted}/${entry.due}${entry.late ? ` · ${entry.late} trễ` : ''}</span></div>
            ${bar(rate)}
            ${numberMetrics.length ? `<div class="kpi-metrics">${numberMetrics.map((metric) => `<div class="kpi-metric">
              <div class="kpi-metric-top"><b>${escape(metric.label)}</b>${metric.achieved !== null ? `<span class="kpi-percent ${level(metric.achieved)}">${number(metric.achieved, 1)}%</span>` : `<span class="kpi-percent is-none">${metric.target ? 'Chưa có số liệu' : 'Chưa đặt chỉ tiêu'}</span>`}</div>
              ${metric.target ? bar(metric.achieved) : ''}
              ${(() => { const latest = latestAttachment(entry, metric.itemId); return latest ? `<div class="kpi-attachments"><small>Kèm theo · ${escape(latest.periodLabel)}</small><div>${attachmentChips(latest.attachments[metric.itemId])}</div></div>` : ''; })()}
              <dl><div><dt>Tổng tháng</dt><dd>${number(metric.total)}</dd></div><div><dt>Trung bình/kỳ</dt><dd>${number(metric.average, 1)}</dd></div><div><dt>Chỉ tiêu/kỳ</dt><dd>${number(metric.target)}</dd></div><div><dt>Số kỳ có số liệu</dt><dd>${metric.count}</dd></div></dl>
            </div>`).join('')}</div>` : '<p class="kpi-note">Mẫu này chưa có mục nhập số nên chỉ tính tỷ lệ nộp báo cáo.</p>'}
            ${entry.reports.length ? `<button type="button" class="kpi-toggle" data-toggle-table="${escape(tableKey)}">${openTables.has(tableKey) ? 'Ẩn số liệu từng ngày ▴' : `Xem số liệu từng ngày (${entry.reports.length}) ▾`}</button>
              ${openTables.has(tableKey) ? `<div class="kpi-table-wrap"><table class="kpi-table"><thead><tr><th>Ngày</th>${numberMetrics.map((metric) => `<th>${escape(metric.label)}</th>`).join('')}<th>Trạng thái</th></tr></thead><tbody>${entry.reports.map((report) => `<tr><td>${escape(report.periodLabel)}</td>${numberMetrics.map((metric) => `<td>${number(report.values[metric.itemId], 1)}${report.attachments?.[metric.itemId] ? ` <span class="kpi-cell-attach">${attachmentChips(report.attachments[metric.itemId], true)}</span>` : ''}</td>`).join('')}<td><span class="kpi-chip ${report.late ? 'is-late' : 'is-done'}">${report.late ? 'Nộp trễ' : 'Đúng hạn'}</span></td></tr>`).join('')}</tbody></table></div>` : ''}` : ''}
          </section>`;
        }).join('')}
      </article>`).join('') : '<div class="kpi-empty"><span aria-hidden="true">🔍</span><b>Không tìm thấy nhân viên phù hợp</b></div>';
      list.querySelectorAll('[data-toggle-table]').forEach((button) => {
        button.onclick = () => {
          const key = button.dataset.toggleTable;
          if (openTables.has(key)) openTables.delete(key); else openTables.add(key);
          renderList();
        };
      });
    }

    async function load() {
      list.innerHTML = '<p class="kpi-empty">Đang tải...</p>';
      const response = await fetch(`/api/work-reports/kpi?month=${monthInput.value}${personal ? '&scope=me' : ''}`, { cache: 'no-store' });
      if (!response.ok) throw new Error((await response.text()) || 'Không tải được KPI.');
      data = await response.json();
      search.hidden = !data.canManage || data.people.length < 2;
      renderStats();
      renderList();
    }

    monthInput.addEventListener('change', () => load().catch((error) => { list.innerHTML = `<p class="kpi-empty">${escape(error.message)}</p>`; }));
    search.addEventListener('input', renderList);
    load().catch((error) => { list.innerHTML = `<p class="kpi-empty">${escape(error.message)}</p>`; });
    return { load };
  }

  window.GusaKpi = { mount };
  const page = document.querySelector('[data-kpi-page]');
  if (page) mount(page, { personal: page.dataset.kpiPage === 'me' });
})();
