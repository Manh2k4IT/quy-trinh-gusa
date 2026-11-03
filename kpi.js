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
    // Approval: where the KPI stands, and (for Admin/CEO on the team view) the decision buttons.
    const dateText = (iso) => { if (!iso) return ''; const d = new Date(iso); const two = (n) => String(n).padStart(2, '0'); return `${two(d.getDate())}/${two(d.getMonth() + 1)} ${two(d.getHours())}:${two(d.getMinutes())}`; };
    const approvalBar = (person, entry) => {
      const approval = entry.approval || { status: 'empty' };
      if (approval.status === 'empty') return '';
      const badge = approval.status === 'approved'
        ? `<span class="kpi-approval is-approved">✓ Đã duyệt${approval.by ? ` · ${escape(approval.by)}` : ''}${approval.at ? ` · ${dateText(approval.at)}` : ''}</span>`
        : approval.status === 'revision'
          ? `<span class="kpi-approval is-revision">✎ Đã yêu cầu chỉnh sửa: ${escape(approval.note || '')}</span>`
          : `<span class="kpi-approval is-pending">⏳ Chờ duyệt${approval.resubmittedAfter ? ' · nhân viên đã sửa lại' : ''}</span>`;
      if (personal || !data.canManage) return `<div class="kpi-approval-bar">${badge}</div>`;
      const target = `data-user="${escape(person.userId)}" data-template-id="${escape(entry.templateId)}"`;
      return `<div class="kpi-approval-bar">${badge}<span class="kpi-approval-actions">${approval.status !== 'approved' ? `<button type="button" class="is-approve" data-approve ${target}>✓ Duyệt</button>` : ''}${approval.status !== 'revision' ? `<button type="button" class="is-revise" data-revise ${target}>✎ Yêu cầu chỉnh sửa</button>` : ''}</span></div>`;
    };
    // Before approval: where the KPI stands, above the person's own report.
    const waitingBanner = (entry) => {
      const approval = entry.approval || {};
      const revision = approval.status === 'revision';
      return `<div class="kpi-waiting is-${approval.status}"><span aria-hidden="true">${revision ? '✎' : '⏳'}</span><div><b>${revision ? 'Admin/CEO yêu cầu chỉnh sửa' : 'Đang chờ Admin/CEO duyệt'}</b><small>${escape(revision ? approval.note || 'Vui lòng sửa lại báo cáo KPI.' : approval.resubmittedAfter ? 'Bạn đã sửa lại báo cáo. Kết quả bên dưới là tạm tính, sẽ chốt khi được duyệt.' : 'Kết quả bên dưới là tạm tính theo số liệu bạn đã nộp, sẽ chốt khi được duyệt. P3 thực nhận được tính sau khi duyệt.')}</small></div>${revision ? '<a href="work-report.html">Sửa báo cáo ›</a>' : ''}</div>`;
    };
    // Staff see a KPI only once it is approved; until then, where it stands.
    const hiddenEntry = (entry) => {
      const approval = entry.approval || { status: 'empty' };
      const message = approval.status === 'empty'
        ? ['📝', 'Chưa nộp báo cáo KPI tháng này', 'Nộp báo cáo trong Báo cáo công việc để được tính KPI.']
        : approval.status === 'revision'
          ? ['✎', 'Admin/CEO yêu cầu chỉnh sửa', approval.note || 'Vui lòng sửa lại báo cáo KPI.']
          : ['⏳', 'Đang chờ Admin/CEO duyệt', approval.resubmittedAfter ? 'Bạn đã sửa lại báo cáo. KPI sẽ hiện sau khi được duyệt.' : 'KPI và điểm sẽ hiện sau khi được duyệt.'];
      return `<section class="kpi-template is-hidden"><div class="kpi-template-head"><h3>📈 ${escape(entry.templateName)}</h3><span class="kpi-rate is-none">Đã nộp ${entry.submitted}/${entry.due}</span></div>
        <div class="kpi-waiting is-${approval.status}"><span aria-hidden="true">${message[0]}</span><div><b>${message[1]}</b><small>${escape(message[2])}</small></div>${approval.status === 'revision' || approval.status === 'empty' ? '<a href="work-report.html">Mở báo cáo ›</a>' : ''}</div></section>`;
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
      const achieved = entries.map((entry) => entry.kpiPercent).filter((value) => value !== null && value !== undefined);
      const averageAchieved = achieved.length ? achieved.reduce((sum, value) => sum + value, 0) / achieved.length : null;
      stats.innerHTML = [
        personal ? ['is-people', '📋', 'Mẫu KPI của bạn', entries.length] : ['is-people', '👥', 'Nhân viên có KPI', data.people.length],
        ['is-rate', '📝', 'Tỷ lệ nộp báo cáo', due ? `${Math.round((submitted / due) * 100)}%` : '—'],
        [`is-achieved ${level(averageAchieved)}`, '🎯', '% KPI (TB)', averageAchieved === null ? '—' : `${number(averageAchieved, 1)}%`],
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
          if (entry.hidden && (entry.approval?.status === 'empty' || !entry.metrics.length)) return hiddenEntry(entry);
          return `<section class="kpi-template" data-approval-key="${escape(`${person.userId}|${entry.templateId}`)}">
            <div class="kpi-template-head"><h3>📈 ${escape(entry.templateName)}</h3><span class="kpi-rate ${level(rate)}">Đã nộp ${entry.submitted}/${entry.due}${entry.late ? ` · ${entry.late} trễ` : ''}</span></div>
            ${entry.hidden ? waitingBanner(entry) : approvalBar(person, entry)}
            ${bar(rate)}
            ${numberMetrics.length ? `<div class="kpi-sheet-wrap"><table class="kpi-sheet">
              <thead><tr><th>Chỉ số</th><th>Chỉ tiêu</th><th>Giá trị thống kê</th><th>Tổng</th><th>Điểm chuẩn</th><th>Tỉ lệ hoàn thành</th><th>Điểm đạt</th></tr></thead>
              <tbody>${numberMetrics.map((metric) => {
                const latest = latestAttachment(entry, metric.itemId);
                const ratio = metric.kpiType === 'ratio';
                return `<tr>
                  <td class="kpi-sheet-name"><b>${escape(metric.label)}</b>${ratio ? '<small>Tỷ lệ %</small>' : ''}${latest ? `<div class="kpi-sheet-attach">${attachmentChips(latest.attachments[metric.itemId], true)}</div>` : ''}</td>
                  <td>${metric.target ? `${number(metric.target, 2)}${ratio ? '%' : ''}` : '<span class="kpi-muted">Chưa đặt</span>'}</td>
                  <td><b>${metric.count ? number(metric.total, 2) : '—'}</b></td>
                  <td>${ratio ? (metric.base ? number(metric.base, 2) : '—') : ''}</td>
                  <td>${metric.weight ? number(metric.weight, 1) : '—'}</td>
                  <td>${metric.achieved !== null ? `<span class="kpi-percent ${level(metric.achieved)}">${number(metric.achieved, 1)}%</span>` : `<span class="kpi-muted">${metric.target ? 'Chưa có số liệu' : '—'}</span>`}${metric.cap > 100 ? `<small class="kpi-cap">tính vượt tới ${number(metric.cap)}%</small>` : ''}</td>
                  <td class="kpi-sheet-points">${metric.points !== null ? number(metric.points) : '—'}</td>
                </tr>`;
              }).join('')}</tbody>
              ${entry.weightTotal ? `<tfoot><tr><td colspan="4">Tổng</td><td>${number(entry.weightTotal, 1)}</td><td></td><td class="kpi-sheet-points">${number(entry.score)}</td></tr></tfoot>` : ''}
            </table></div>
            ${entry.kpiPercent !== null ? `<div class="kpi-score ${level(entry.kpiPercent)}${entry.hidden ? ' is-provisional' : ''}"><span>% KPI tháng${entry.hidden ? ' · tạm tính, chờ duyệt' : ''}</span><b>${number(entry.kpiPercent, 1)}%</b><small>${entry.weightTotal ? `= ${number(entry.score)} điểm đạt / ${number(entry.weightTotal, 1)} điểm chuẩn` : 'trung bình tỉ lệ hoàn thành (chưa đặt điểm chuẩn)'} · dùng để tính P3</small></div>` : ''}` : '<p class="kpi-note">Mẫu này chưa có mục nhập số nên chỉ tính tỷ lệ nộp báo cáo.</p>'}
            ${entry.reports.length ? `<button type="button" class="kpi-toggle" data-toggle-table="${escape(tableKey)}">${openTables.has(tableKey) ? 'Ẩn số liệu từng ngày ▴' : `Xem số liệu từng ngày (${entry.reports.length}) ▾`}</button>
              ${openTables.has(tableKey) ? `<div class="kpi-table-wrap"><table class="kpi-table"><thead><tr><th>Ngày</th>${numberMetrics.map((metric) => `<th>${escape(metric.label)}</th>`).join('')}<th>Trạng thái</th></tr></thead><tbody>${entry.reports.map((report) => `<tr><td>${escape(report.periodLabel)}</td>${numberMetrics.map((metric) => `<td>${number(report.values[metric.itemId], 1)}${report.attachments?.[metric.itemId] ? ` <span class="kpi-cell-attach">${attachmentChips(report.attachments[metric.itemId], true)}</span>` : ''}</td>`).join('')}<td><span class="kpi-chip ${report.late ? 'is-late' : 'is-done'}">${report.late ? 'Nộp trễ' : 'Đúng hạn'}</span></td></tr>`).join('')}</tbody></table></div>` : ''}` : ''}
          </section>`;
        }).join('')}
      </article>`).join('') : '<div class="kpi-empty"><span aria-hidden="true">🔍</span><b>Không tìm thấy nhân viên phù hợp</b></div>';
      list.querySelectorAll('[data-approve], [data-revise]').forEach((button) => {
        button.onclick = async () => {
          const revise = button.hasAttribute('data-revise');
          let note = '';
          if (revise) {
            note = window.prompt('Nội dung cần nhân viên chỉnh sửa:', '') ?? '';
            if (!note.trim()) return;
          }
          button.disabled = true;
          try {
            const response = await fetch('/api/work-reports/kpi/approval', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: button.dataset.user, templateId: button.dataset.templateId, month: monthInput.value, action: revise ? 'revision' : 'approve', note }) });
            if (!response.ok) throw new Error((await response.text()) || 'Không lưu được.');
            const { person: updated } = await response.json();
            const index = data.people.findIndex((item) => item.userId === updated?.userId);
            if (index >= 0) data.people[index] = updated;
            renderStats();
            renderList();
          } catch (error) {
            alert(error.message);
            button.disabled = false;
          }
        };
      });
      list.querySelectorAll('[data-toggle-table]').forEach((button) => {
        button.onclick = () => {
          const key = button.dataset.toggleTable;
          if (openTables.has(key)) openTables.delete(key); else openTables.add(key);
          renderList();
        };
      });
    }

    // The signed-in person's own salary, entered by Admin/CEO on the Lương nhân viên page.
    const salaryBox = root.querySelector('[data-kpi-salary]');
    async function loadSalary() {
      const response = await fetch(`/api/salaries/me?month=${monthInput.value}`, { cache: 'no-store' });
      if (!response.ok) return;
      const { salary, fields = [] } = await response.json();
      const has = salary && (salary.total !== null || salary.kpiPending);
      const waiting = '<b class="is-waiting">⏳ Chờ duyệt KPI</b>';
      const vnd = (value) => (value === null || value === undefined ? 'Chưa có' : `${Number(value).toLocaleString('vi-VN')} ₫`);
      salaryBox.innerHTML = has
        ? `<div class="kpi-salary-head"><b>💰 Lương tháng ${Number(monthInput.value.slice(5))}/${monthInput.value.slice(0, 4)}</b><small>${salary.inheritedFrom && salary.inheritedFrom !== 'base' ? `Theo tháng ${Number(salary.inheritedFrom.slice(5))}/${salary.inheritedFrom.slice(0, 4)}` : 'Mỗi tháng'}${salary.updatedAt ? ` · cập nhật ${new Date(salary.updatedAt).toLocaleDateString('vi-VN')}` : ''}</small></div>
          <div class="kpi-salary-grid">${fields.map((field) => `<div class="${field.deduction ? 'is-deduction' : ''}"><span>${field.label}</span><b>${field.deduction && salary[field.key] ? '−' : ''}${vnd(salary[field.key])}</b></div>${field.key === 'p3' ? `<div class="is-kpi"><span>P3 thực nhận${salary.kpiPending ? '' : ` · KPI ${Number(salary.kpiApplied).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`}</span>${salary.kpiPending ? waiting : `<b>${vnd(salary.p3Paid)}</b>`}</div>` : ''}`).join('')}<div class="is-total"><span>Tổng thu nhập</span>${salary.kpiPending ? waiting : `<b>${vnd(salary.total)}</b>`}</div></div>${salary.kpiPending ? '<p class="kpi-salary-note">P3 thực nhận và tổng thu nhập sẽ hiện sau khi KPI tháng này được duyệt.</p>' : ''}`
        : `<div class="kpi-salary-head"><b>💰 Lương tháng ${Number(monthInput.value.slice(5))}/${monthInput.value.slice(0, 4)}</b><small>Chưa có thông tin lương tháng này. Liên hệ Admin/CEO để được cập nhật.</small></div>`;
      salaryBox.hidden = false;
    }
    if (personal && salaryBox) {
      loadSalary().catch(() => {});
      monthInput.addEventListener('change', () => loadSalary().catch(() => {}));
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
