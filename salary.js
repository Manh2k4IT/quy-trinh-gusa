(function () {
  const list = document.querySelector('[data-salary-list]');
  const stats = document.querySelector('[data-salary-stats]');
  const search = document.querySelector('[data-salary-search]');
  const monthInput = document.querySelector('[data-salary-month]');
  const now = new Date();
  monthInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthLabel = (key) => (key === 'base' ? 'mức đã nhập trước' : `tháng ${Number(key.slice(5))}/${key.slice(0, 4)}`);
  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const money = (value) => (value === null || value === undefined ? '' : Number(value).toLocaleString('vi-VN'));
  const parseMoney = (text) => {
    const digits = String(text || '').replace(/[^\d]/g, '');
    return digits ? Number(digits) : null;
  };
  const roleLabels = { admin: 'Quản trị viên', ceo: 'CEO', accountant: 'Kế toán trưởng', bookkeeper: 'Kế toán', warehouse: 'Vận hành kho', manager: 'Quản lý cấp 1', production: 'Sản xuất', hr: 'Nhân sự' };
  // Columns come from the server: P1, Phụ cấp, P3, Thành viên Ban dự án PDCA, Khấu trừ BHXH (subtracted).
  let fields = [];
  let rows = [];
  const sum = (key) => rows.reduce((total, row) => total + (row[key] || 0), 0);
  const hasAmounts = (row) => fields.some((field) => row[field.key] !== null);
  // P3 thực nhận = P3 định mức × % KPI (typed for the month, else from the KPI reports up to 100%, else 100%).
  const appliedKpi = (typed, auto) => (typed !== null ? typed : auto !== null ? Math.min(auto, 200) : 100);
  const parsePercent = (text) => {
    const value = String(text || '').replace(',', '.').replace(/[^\d.]/g, '');
    return value ? Math.round(Number(value) * 10) / 10 : null;
  };
  const percentText = (value) => (value === null || value === undefined ? '' : `${Number(value).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`);

  function renderStats() {
    const entered = rows.filter((row) => hasAmounts(row) && !row.inheritedFrom).length;
    const deduction = fields.find((field) => field.deduction);
    stats.innerHTML = [
      ['is-people', '👥', 'Tài khoản', rows.length, `${entered} đã nhập cho ${monthLabel(monthInput.value)}`],
      ['is-base', '💵', `Tổng ${fields[0]?.label || 'P1'}`, `${money(sum(fields[0]?.key))} ₫`, monthLabel(monthInput.value)],
      ['is-allowance', '🧾', `Tổng ${deduction?.label || 'khấu trừ'}`, `${money(deduction ? sum(deduction.key) : 0)} ₫`, 'được trừ khỏi thu nhập'],
      ['is-total', '💰', 'Tổng thu nhập', `${money(sum('total'))} ₫`, 'quỹ lương phải trả'],
    ].map(([kind, icon, label, value, note]) => `<div class="salary-stat ${kind}"><span aria-hidden="true">${icon}</span><small>${label}</small><b>${value}</b><em>${note}</em></div>`).join('');
  }

  // Where the KPI % comes from; the approval state stands out in colour.
  const kpiSource = (row) => {
    if (row.kpiPercent !== null) return 'Nhập tay cho tháng này';
    if (row.kpiAuto === null) return 'Chưa có KPI – tính 100%';
    return `Từ KPI: ${percentText(row.kpiAuto)}${row.kpiAuto > 200 ? ' (tính tối đa 200%)' : ''} · <b class="salary-kpi-state ${row.kpiApproved ? 'is-approved' : 'is-pending'}">${row.kpiApproved ? 'đã duyệt' : 'chờ duyệt'}</b>`;
  };
  // % KPI: an input showing what applies; the hint says where it comes from.
  const kpiCells = (row) => {
    const source = kpiSource(row);
    return `<td class="is-money"><input class="salary-kpi-input" inputmode="decimal" data-kpi value="${row.kpiPercent !== null ? percentText(row.kpiPercent) : ''}" placeholder="${percentText(appliedKpi(null, row.kpiAuto))}" aria-label="% KPI của ${escape(row.name)}" /><small class="salary-kpi-source" data-kpi-source>${source}</small>${row.kpiPercent !== null && row.kpiAuto !== null && row.kpiPercent !== Math.min(row.kpiAuto, 200) ? `<button type="button" class="salary-kpi-reset" data-kpi-reset title="Bỏ số nhập tay, dùng % KPI đã tính">↺ Dùng KPI ${percentText(Math.min(row.kpiAuto, 200))}</button>` : ''}</td>
        <td class="is-money salary-p3-paid"><span data-p3-paid>${row.p3Paid !== null ? money(row.p3Paid) : '—'}</span>${row.p3Paid !== null && row.kpiPercent === null && row.kpiAuto !== null && !row.kpiApproved ? '<small class="salary-kpi-wait">⏳ chờ duyệt KPI</small>' : ''}</td>`;
  };

  function renderList() {
    const query = search.value.trim().toLowerCase();
    const shown = rows.filter((row) => !query || `${row.name} ${row.email}`.toLowerCase().includes(query));
    if (!rows.length) {
      list.innerHTML = '<p class="salary-empty">Chưa có tài khoản nào đang hoạt động.</p>';
      return;
    }
    list.innerHTML = `<div class="salary-table-wrap"><table class="salary-table">
      <thead><tr><th>Tài khoản</th>${fields.map((field) => `<th class="is-money${field.deduction ? ' is-deduction' : ''}">${escape(field.label)} (₫)</th>${field.key === 'p3' ? '<th class="is-money is-kpi">% KPI</th><th class="is-money is-kpi">P3 thực nhận (₫)</th>' : ''}`).join('')}<th class="is-money is-total">Tổng thu nhập (₫)</th><th class="salary-state-col"></th></tr></thead>
      <tbody>${shown.map((row) => `<tr data-user="${escape(row.userId)}">
        <td><div class="salary-person"><span class="salary-avatar">${row.picture ? `<img src="${escape(row.picture)}" alt="" referrerpolicy="no-referrer" />` : escape((row.name || '?').charAt(0).toUpperCase())}</span><div><b>${escape(row.name)}</b><small>${escape(row.email)}${roleLabels[row.role] ? ` · ${roleLabels[row.role]}` : ''}</small></div></div></td>
        ${fields.map((field) => `<td class="is-money"><input class="${row.inheritedFrom ? 'is-inherited' : ''}${field.deduction ? ' is-deduction' : ''}" inputmode="numeric" data-field="${field.key}" value="${money(row[field.key])}" placeholder="—" aria-label="${escape(field.label)} của ${escape(row.name)}" /></td>${field.key === 'p3' ? kpiCells(row) : ''}`).join('')}
        <td class="is-money salary-total" data-total>${row.total !== null ? money(row.total) : '—'}</td>
        <td class="salary-state-col"><span class="salary-state" data-state>${row.inheritedFrom ? `<span class="salary-inherited" title="Tháng này chưa nhập riêng; sửa ô để lưu cho tháng này">↺ theo ${escape(monthLabel(row.inheritedFrom))}</span>` : ''}</span></td>
      </tr>`).join('') || `<tr><td colspan="${fields.length + 5}" class="salary-empty">Không tìm thấy tài khoản phù hợp.</td></tr>`}</tbody>
    </table></div>`;
  }

  // The total updates while typing; the row is saved when the field is left (or Enter is pressed).
  const draft = (tr) => {
    const row = rows.find((item) => item.userId === tr.dataset.user);
    const amounts = fields.map((field) => [field, parseMoney(tr.querySelector(`[data-field="${field.key}"]`).value)]);
    const p3 = amounts.find(([field]) => field.key === 'p3')?.[1] ?? null;
    const p3Paid = p3 !== null ? Math.round((p3 * appliedKpi(parsePercent(tr.querySelector('[data-kpi]').value), row.kpiAuto)) / 100) : null;
    const total = amounts.every(([, value]) => value === null) ? null : amounts.reduce((sum, [field, value]) => sum + (field.key === 'p3' ? p3Paid || 0 : value || 0) * (field.deduction ? -1 : 1), 0);
    return { p3Paid, total };
  };
  const showDraft = (tr) => {
    const { p3Paid, total } = draft(tr);
    tr.querySelector('[data-p3-paid]').textContent = p3Paid !== null ? money(p3Paid) : '—';
    tr.querySelector('[data-total]').textContent = total !== null ? money(total) : '—';
  };

  async function save(row, tr) {
    const state = tr.querySelector('[data-state]');
    const amounts = Object.fromEntries(fields.map((field) => [field.key, parseMoney(tr.querySelector(`[data-field="${field.key}"]`).value)]));
    amounts.kpiPercent = parsePercent(tr.querySelector('[data-kpi]').value);
    // Unchanged amounts are not saved, unless they were carried from an earlier month and are being confirmed with Enter.
    const unchanged = fields.every((field) => amounts[field.key] === row[field.key]) && amounts.kpiPercent === row.kpiPercent;
    if (unchanged && !(row.inheritedFrom && tr.dataset.confirm)) return;
    delete tr.dataset.confirm;
    state.className = 'salary-state is-saving';
    state.textContent = 'Đang lưu...';
    try {
      const response = await fetch('/api/salaries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: row.userId, month: monthInput.value, ...amounts }) });
      if (!response.ok) throw new Error((await response.text()) || 'Không lưu được.');
      Object.assign(row, (await response.json()).row);
      tr.querySelector('[data-total]').textContent = row.total !== null ? money(row.total) : '—';
      tr.querySelector('[data-p3-paid]').textContent = row.p3Paid !== null ? money(row.p3Paid) : '—';
      tr.querySelector('[data-kpi]').value = row.kpiPercent !== null ? percentText(row.kpiPercent) : '';
      tr.querySelector('[data-kpi-source]').innerHTML = kpiSource(row);
      tr.querySelectorAll('[data-field]').forEach((input) => input.classList.remove('is-inherited'));
      state.className = 'salary-state is-saved';
      state.textContent = `✓ Đã lưu cho ${monthLabel(monthInput.value)}`;
      renderStats();
    } catch (error) {
      state.className = 'salary-state is-error';
      state.textContent = error.message;
    }
  }

  list.addEventListener('input', (event) => {
    const input = event.target.closest('[data-field], [data-kpi]');
    if (!input) return;
    if (input.matches('[data-field]')) input.value = money(parseMoney(input.value));
    showDraft(input.closest('[data-user]'));
  });
  list.addEventListener('focusout', (event) => {
    const input = event.target.closest('[data-field], [data-kpi]');
    if (!input) return;
    const tr = input.closest('[data-user]');
    // Moving between fields of the same row saves once, when the row is left.
    if (event.relatedTarget && tr.contains(event.relatedTarget)) return;
    save(rows.find((row) => row.userId === tr.dataset.user), tr);
  });
  list.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && event.target.closest('[data-field], [data-kpi]')) { event.target.closest('[data-user]').dataset.confirm = '1'; event.target.blur(); }
  });
  // Back to the KPI result: clear the typed % and save the row.
  list.addEventListener('click', (event) => {
    const button = event.target.closest('[data-kpi-reset]');
    if (!button) return;
    const tr = button.closest('[data-user]');
    tr.querySelector('[data-kpi]').value = '';
    button.remove();
    showDraft(tr);
    save(rows.find((row) => row.userId === tr.dataset.user), tr);
  });
  search.addEventListener('input', renderList);

  const load = () => {
    list.innerHTML = '<p class="salary-empty">Đang tải...</p>';
    return fetch(`/api/salaries?month=${monthInput.value}`, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error((await response.text()) || 'Không tải được lương nhân viên.');
        ({ fields, rows } = await response.json());
        renderStats();
        renderList();
      })
      .catch((error) => { list.innerHTML = `<p class="salary-empty">${escape(error.message)}</p>`; });
  };
  monthInput.addEventListener('change', () => { if (monthInput.value) load(); });
  load();
})();
