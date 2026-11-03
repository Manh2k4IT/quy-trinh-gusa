(function () {
  const list = document.querySelector('[data-salary-list]');
  const stats = document.querySelector('[data-salary-stats]');
  const search = document.querySelector('[data-salary-search]');
  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const money = (value) => (value === null || value === undefined ? '' : Number(value).toLocaleString('vi-VN'));
  const parseMoney = (text) => {
    const digits = String(text || '').replace(/[^\d]/g, '');
    return digits ? Number(digits) : null;
  };
  const roleLabels = { admin: 'Quản trị viên', ceo: 'CEO', accountant: 'Kế toán trưởng', bookkeeper: 'Kế toán', warehouse: 'Vận hành kho', manager: 'Quản lý cấp 1', production: 'Sản xuất', hr: 'Nhân sự' };
  let rows = [];

  function renderStats() {
    const filled = rows.filter((row) => row.baseSalary !== null || row.allowance !== null);
    const base = rows.reduce((sum, row) => sum + (row.baseSalary || 0), 0);
    const allowance = rows.reduce((sum, row) => sum + (row.allowance || 0), 0);
    stats.innerHTML = [
      ['is-people', '👥', 'Tài khoản', rows.length, `${filled.length} đã nhập lương`],
      ['is-base', '💵', 'Tổng lương cơ bản', `${money(base)} ₫`, 'mỗi tháng'],
      ['is-allowance', '🎁', 'Tổng phụ cấp', `${money(allowance)} ₫`, 'mỗi tháng'],
      ['is-total', '🧾', 'Tổng quỹ lương', `${money(base + allowance)} ₫`, 'lương cơ bản + phụ cấp'],
    ].map(([kind, icon, label, value, note]) => `<div class="salary-stat ${kind}"><span aria-hidden="true">${icon}</span><small>${label}</small><b>${value}</b><em>${note}</em></div>`).join('');
  }

  function renderList() {
    const query = search.value.trim().toLowerCase();
    const shown = rows.filter((row) => !query || `${row.name} ${row.email}`.toLowerCase().includes(query));
    if (!rows.length) {
      list.innerHTML = '<p class="salary-empty">Chưa có tài khoản nào đang hoạt động.</p>';
      return;
    }
    list.innerHTML = `<div class="salary-table-wrap"><table class="salary-table">
      <thead><tr><th>Tài khoản</th><th class="is-money">Lương cơ bản (₫)</th><th class="is-money">Phụ cấp (₫)</th><th class="is-money">Tổng (₫)</th><th class="salary-state-col"></th></tr></thead>
      <tbody>${shown.map((row) => `<tr data-user="${escape(row.userId)}">
        <td><div class="salary-person"><span class="salary-avatar">${row.picture ? `<img src="${escape(row.picture)}" alt="" referrerpolicy="no-referrer" />` : escape((row.name || '?').charAt(0).toUpperCase())}</span><div><b>${escape(row.name)}</b><small>${escape(row.email)}${roleLabels[row.role] ? ` · ${roleLabels[row.role]}` : ''}</small></div></div></td>
        <td class="is-money"><input inputmode="numeric" data-field="baseSalary" value="${money(row.baseSalary)}" placeholder="Chưa nhập" aria-label="Lương cơ bản của ${escape(row.name)}" /></td>
        <td class="is-money"><input inputmode="numeric" data-field="allowance" value="${money(row.allowance)}" placeholder="Chưa nhập" aria-label="Phụ cấp của ${escape(row.name)}" /></td>
        <td class="is-money salary-total" data-total>${row.baseSalary !== null || row.allowance !== null ? money((row.baseSalary || 0) + (row.allowance || 0)) : '—'}</td>
        <td class="salary-state-col"><span class="salary-state" data-state></span></td>
      </tr>`).join('') || '<tr><td colspan="5" class="salary-empty">Không tìm thấy tài khoản phù hợp.</td></tr>'}</tbody>
    </table></div>`;
  }

  async function save(row, tr) {
    const state = tr.querySelector('[data-state]');
    const baseSalary = parseMoney(tr.querySelector('[data-field="baseSalary"]').value);
    const allowance = parseMoney(tr.querySelector('[data-field="allowance"]').value);
    if (baseSalary === row.baseSalary && allowance === row.allowance) return;
    state.className = 'salary-state is-saving';
    state.textContent = 'Đang lưu...';
    try {
      const response = await fetch('/api/salaries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: row.userId, baseSalary, allowance }) });
      if (!response.ok) throw new Error((await response.text()) || 'Không lưu được.');
      Object.assign(row, (await response.json()).row);
      tr.querySelector('[data-total]').textContent = row.baseSalary !== null || row.allowance !== null ? money((row.baseSalary || 0) + (row.allowance || 0)) : '—';
      state.className = 'salary-state is-saved';
      state.textContent = '✓ Đã lưu';
      renderStats();
    } catch (error) {
      state.className = 'salary-state is-error';
      state.textContent = error.message;
    }
  }

  // Amounts are typed with thousand separators and saved when the field is left (or Enter is pressed).
  list.addEventListener('input', (event) => {
    const input = event.target.closest('[data-field]');
    if (!input) return;
    const value = parseMoney(input.value);
    input.value = money(value);
  });
  list.addEventListener('focusout', (event) => {
    const input = event.target.closest('[data-field]');
    if (!input) return;
    const tr = input.closest('[data-user]');
    save(rows.find((row) => row.userId === tr.dataset.user), tr);
  });
  list.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && event.target.closest('[data-field]')) event.target.blur();
  });
  search.addEventListener('input', renderList);

  fetch('/api/salaries', { cache: 'no-store' })
    .then(async (response) => {
      if (!response.ok) throw new Error((await response.text()) || 'Không tải được lương nhân viên.');
      rows = (await response.json()).rows;
      renderStats();
      renderList();
    })
    .catch((error) => { list.innerHTML = `<p class="salary-empty">${escape(error.message)}</p>`; });
})();
