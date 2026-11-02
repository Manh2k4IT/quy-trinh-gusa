(function () {
  const list = document.querySelector('[data-announcement-list]');
  const form = document.querySelector('[data-announcement-form]');
  const status = document.querySelector('[data-announcement-status]');
  const search = document.querySelector('[data-announcement-search]');
  const filters = document.querySelector('.announcement-filters');
  let announcements = [];
  let canManage = false;
  let filter = 'all';
  // Read state is per device, like the notification bell.
  const readKey = 'gusa-read-announcements';
  const readIds = () => { try { return new Set(JSON.parse(localStorage.getItem(readKey) || '[]')); } catch { return new Set(); } };
  const markRead = (ids) => { const read = readIds(); ids.forEach((id) => read.add(id)); try { localStorage.setItem(readKey, JSON.stringify([...read].slice(-500))); } catch {} };
  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const timeLabel = (value) => {
    const time = new Date(value);
    const minutes = Math.floor((Date.now() - time) / 60000);
    if (minutes < 1) return 'Vừa xong';
    if (minutes < 60) return `${minutes} phút trước`;
    if (minutes < 24 * 60) return `${Math.floor(minutes / 60)} giờ trước`;
    return time.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const render = () => {
    const read = readIds();
    const query = search.value.trim().toLowerCase();
    const visible = announcements.filter((item) => (filter === 'all' || (filter === 'unread' ? !read.has(item.id) : item.important))
      && (!query || `${item.title} ${item.content}`.toLowerCase().includes(query)));
    const unreadCount = announcements.filter((item) => !read.has(item.id)).length;
    filters.querySelector('[data-announcement-filter="unread"]').textContent = unreadCount ? `Chưa đọc (${unreadCount})` : 'Chưa đọc';
    list.innerHTML = visible.length ? visible.map((item) => {
      const unread = !read.has(item.id);
      const long = item.content.length > 280 || item.content.split('\n').length > 5;
      return `<article class="announcement-card${item.important ? ' is-important' : ''}${item.pinned ? ' is-pinned' : ''}${unread ? ' is-unread' : ''}" id="${escape(item.id)}">
        <div class="announcement-card-head">
          <div class="announcement-badges">${item.pinned ? '<span class="badge-pinned">📌 Đã ghim</span>' : ''}${item.important ? '<span class="badge-important">Quan trọng</span>' : ''}${unread ? '<span class="badge-new">Mới</span>' : ''}</div>
          ${canManage ? `<button class="announcement-delete" type="button" data-delete-announcement="${escape(item.id)}" aria-label="Xóa thông báo">Xóa</button>` : ''}
        </div>
        <h2>${escape(item.title)}</h2>
        <p class="announcement-meta"><span class="announcement-author-dot">${escape((item.authorName || '?').charAt(0).toUpperCase())}</span>${escape(item.authorName)} · <time datetime="${escape(item.createdAt)}">${escape(timeLabel(item.createdAt))}</time></p>
        <div class="announcement-body${long ? ' is-collapsed' : ''}">${escape(item.content)}</div>
        ${long ? '<button class="announcement-more" type="button" data-toggle-announcement>Xem thêm</button>' : ''}
      </article>`;
    }).join('') : `<div class="announcement-empty"><span aria-hidden="true">📭</span><b>${announcements.length ? 'Không có thông báo phù hợp' : 'Chưa có thông báo nào'}</b><small>${announcements.length ? 'Thử đổi bộ lọc hoặc từ khóa tìm kiếm.' : 'Thông báo mới từ công ty sẽ hiện ở đây.'}</small></div>`;
  };

  const load = async () => {
    const response = await fetch('/api/announcements', { cache: 'no-store' });
    if (!response.ok) throw new Error('Không tải được thông báo.');
    ({ announcements, canManage } = await response.json());
    form.hidden = !canManage;
    render();
    // Opening the page marks what is on screen as read after a short look.
    setTimeout(() => { markRead(announcements.map((item) => item.id)); }, 4000);
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('[type="submit"]');
    const data = new FormData(form);
    button.disabled = true;
    button.textContent = 'Đang đăng...';
    try {
      const response = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: data.get('title'), content: data.get('content'), pinned: data.get('pinned') === 'on', important: data.get('important') === 'on' }),
      });
      if (!response.ok) throw new Error(await response.text() || 'Không đăng được thông báo.');
      const { announcement } = await response.json();
      markRead([announcement.id]);
      form.reset();
      status.textContent = 'Đã đăng thông báo và gửi tới toàn bộ nhân viên.';
      await load();
    } catch (error) {
      status.textContent = error.message;
    } finally {
      button.disabled = false;
      button.textContent = 'Đăng thông báo';
    }
  });

  list.addEventListener('click', async (event) => {
    const toggle = event.target.closest('[data-toggle-announcement]');
    if (toggle) {
      const body = toggle.previousElementSibling;
      body.classList.toggle('is-collapsed');
      toggle.textContent = body.classList.contains('is-collapsed') ? 'Xem thêm' : 'Thu gọn';
      return;
    }
    const remove = event.target.closest('[data-delete-announcement]');
    if (!remove || !confirm('Xóa thông báo này? Nhân viên sẽ không còn thấy nó nữa.')) return;
    remove.disabled = true;
    const response = await fetch(`/api/announcements/${encodeURIComponent(remove.dataset.deleteAnnouncement)}`, { method: 'DELETE' });
    if (!response.ok) {
      remove.disabled = false;
      alert(await response.text() || 'Không xóa được thông báo.');
      return;
    }
    await load();
  });

  filters.addEventListener('click', (event) => {
    const button = event.target.closest('[data-announcement-filter]');
    if (!button) return;
    filter = button.dataset.announcementFilter;
    filters.querySelectorAll('button').forEach((item) => item.classList.toggle('is-active', item === button));
    render();
  });
  search.addEventListener('input', render);
  load().catch((error) => { list.innerHTML = `<p class="announcement-empty">${escape(error.message)}</p>`; });
})();
