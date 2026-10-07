(() => {
  const storagePrefix = 'gusa-report-seen:';
  const reportKeys = ['online', 'late', 'overview', 'personnel', 'payment'];
  const status = document.querySelector('[data-report-notification-status]');
  let latestSummary = null;
  let loading = false;
  let refreshAgain = false;
  let pendingSnapshot = null;

  function storageKey(accountId, reportKey) {
    return `${storagePrefix}${encodeURIComponent(accountId)}:${reportKey}`;
  }

  function validateItems(items) {
    if (!Array.isArray(items) || items.some((item) => !item || typeof item.id !== 'string' || typeof item.version !== 'string')) {
      throw new Error('Dữ liệu thông báo báo cáo không hợp lệ.');
    }
    return items;
  }

  function markSeen(snapshot) {
    if (!snapshot) return;
    if (document.hidden) {
      pendingSnapshot = snapshot;
      return;
    }
    try {
      if (typeof snapshot.accountId !== 'string' || !reportKeys.includes(snapshot.reportKey)) throw new Error('Thông tin báo cáo không hợp lệ.');
      const items = validateItems(snapshot.items);
      localStorage.setItem(storageKey(snapshot.accountId, snapshot.reportKey), JSON.stringify(Object.fromEntries(items.map((item) => [item.id, item.version]))));
      pendingSnapshot = null;
    } catch (error) {
      console.error('Không lưu được trạng thái đã xem báo cáo.', error);
      let message = document.querySelector('[data-report-seen-error]');
      if (!message) {
        message = document.createElement('p');
        message.dataset.reportSeenError = '';
        message.setAttribute('role', 'alert');
        document.querySelector('.workspace')?.append(message);
      }
      message.textContent = 'Không lưu được trạng thái đã xem. Vui lòng kiểm tra quyền lưu dữ liệu của trình duyệt.';
    }
  }

  function render(summary) {
    document.querySelectorAll('[data-report-key]').forEach((card) => {
      const reportKey = card.dataset.reportKey;
      const badge = card.querySelector('[data-report-unread]');
      const items = summary.reports[reportKey];
      if (!Object.prototype.hasOwnProperty.call(summary.reports, reportKey)) {
        badge.hidden = true;
        card.classList.remove('has-unread-report');
        return;
      }
      const stored = JSON.parse(localStorage.getItem(storageKey(summary.accountId, reportKey)) || '{}');
      if (!stored || typeof stored !== 'object' || Array.isArray(stored)) throw new Error('Trạng thái đã xem báo cáo không hợp lệ.');
      const count = validateItems(items).filter((item) => stored[item.id] !== item.version).length;
      badge.querySelector('[data-report-unread-count]').textContent = count > 99 ? '99+' : String(count);
      badge.setAttribute('aria-label', `${count} mục mới hoặc cập nhật chưa xem`);
      badge.title = `${count} mục mới hoặc cập nhật chưa xem`;
      badge.hidden = count === 0;
      card.classList.toggle('has-unread-report', count > 0);
    });
  }

  function showError(error) {
    console.error('Không tải được thông báo báo cáo.', error);
    if (status) {
      status.textContent = 'Không cập nhật được thông báo mới. Bấm để thử lại.';
      status.hidden = false;
    }
    document.querySelectorAll('[data-report-unread]').forEach((badge) => { badge.hidden = true; });
    document.querySelectorAll('.has-unread-report').forEach((card) => card.classList.remove('has-unread-report'));
  }

  async function refresh() {
    if (loading) {
      refreshAgain = true;
      return;
    }
    loading = true;
    try {
      const response = await fetch('/api/report-notifications', { cache: 'no-store' });
      if (!response.ok) throw new Error(`Không tải được thông báo báo cáo (${response.status}).`);
      const summary = await response.json();
      if (typeof summary.accountId !== 'string' || !summary.reports || typeof summary.reports !== 'object') throw new Error('Dữ liệu thông báo báo cáo không hợp lệ.');
      render(summary);
      latestSummary = summary;
      status.hidden = true;
    } catch (error) {
      showError(error);
    } finally {
      loading = false;
      if (refreshAgain) {
        refreshAgain = false;
        refresh();
      }
    }
  }

  window.GusaReportNotifications = { markSeen };
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && pendingSnapshot) markSeen(pendingSnapshot);
  });
  if (!status) return;
  status.addEventListener('click', refresh);
  window.addEventListener('focus', refresh);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  window.addEventListener('storage', (event) => {
    if (event.key !== null && !event.key.startsWith(storagePrefix)) return;
    if (latestSummary) {
      try { render(latestSummary); } catch (error) { showError(error); }
    }
  });
  refresh();
  window.setInterval(() => { if (!document.hidden) refresh(); }, 15000);
})();
