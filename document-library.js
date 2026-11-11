// Kho tài liệu: everyone browses and downloads; Admin/CEO upload and delete.
(() => {
  const list = document.querySelector('[data-library-list]');
  const search = document.querySelector('[data-library-search]');
  const categoryBar = document.querySelector('[data-library-categories]');
  const manage = document.querySelector('[data-library-manage]');
  const addButton = document.querySelector('[data-library-add]');
  const form = document.querySelector('[data-library-form]');
  const fileInput = document.querySelector('[data-library-file]');
  const fileLabel = document.querySelector('[data-library-file-label]');
  const drop = document.querySelector('[data-library-drop]');
  const status = document.querySelector('[data-library-status]');
  const progress = document.querySelector('[data-library-progress]');
  const submit = document.querySelector('[data-library-submit]');
  const categoryOptions = document.querySelector('#library-categories');
  const categoryMenu = document.querySelector('[data-category-menu]');
  const categoryTrigger = document.querySelector('[data-category-trigger]');
  const categoryPanel = document.querySelector('[data-category-panel]');
  const categoryFilter = document.querySelector('[data-category-filter]');
  const categoryFilterWrap = document.querySelector('[data-category-filter-wrap]');
  const categoryNone = document.querySelector('[data-category-none]');
  const defaultCategories = ['Quy định - Nội quy', 'Biểu mẫu', 'Hướng dẫn', 'Hợp đồng', 'Đào tạo', 'Khác'];
  let documents = [];
  let canManage = false;
  let activeCategory = 'all';
  const viewToggle = document.querySelector('[data-library-view]');
  let view = 'grid';
  try { if (localStorage.getItem('library-view') === 'list') view = 'list'; } catch {}
  const svg = (paths) => `<svg viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;
  const icons = {
    pdf: svg('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/>'),
    word: svg('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5"/><path d="m8.5 12 1.2 5 1.8-4 1.8 4 1.2-5"/>'),
    excel: svg('<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 10h16M4 15h16M10 4v16"/>'),
    slide: svg('<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M12 16v4M8 20h8"/><path d="M8 12V9m4 3V7m4 5v-2"/>'),
    image: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 17-5-5-9 8"/>'),
    archive: svg('<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M12 3v2m0 2v2m0 2v2"/><rect x="10" y="13" width="4" height="4" rx="1"/>'),
    media: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3Z"/>'),
    other: svg('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5"/>'),
    eye: svg('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'),
    download: svg('<path d="M12 4v11m0 0-4-4m4 4 4-4"/><path d="M5 19h14"/>'),
    trash: svg('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
    folder: svg('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>'),
    allFolders: svg('<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>'),
    pencil: svg('<path d="M4 20h4L19 9l-4-4L4 16Z"/><path d="m13.5 6.5 4 4"/>'),
  };
  // The upload form doubles as the edit form; editingId is set while editing.
  let editingId = '';
  function setView(next) {
    view = next;
    try { localStorage.setItem('library-view', view); } catch {}
    viewToggle?.querySelectorAll('[data-view]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.view === view)));
    list.dataset.view = view;
  }
  viewToggle?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-view]');
    if (button) setView(button.dataset.view);
  });
  setView(view);

  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const extensionOf = (name) => (String(name).split('.').pop() || '').toLowerCase();
  const formatSize = (bytes) => (bytes >= 1048576 ? `${(bytes / 1048576).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
  const formatDate = (value) => new Date(value).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const kindOf = (extension) => {
    if (extension === 'pdf') return { kind: 'pdf', label: 'PDF' };
    if (['doc', 'docx'].includes(extension)) return { kind: 'word', label: 'DOC' };
    if (['xls', 'xlsx', 'csv'].includes(extension)) return { kind: 'excel', label: extension === 'csv' ? 'CSV' : 'XLS' };
    if (['ppt', 'pptx'].includes(extension)) return { kind: 'slide', label: 'PPT' };
    if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extension)) return { kind: 'image', label: 'ẢNH' };
    if (['zip', 'rar', '7z'].includes(extension)) return { kind: 'archive', label: extension.toUpperCase() };
    if (['mp4', 'mp3'].includes(extension)) return { kind: 'media', label: extension.toUpperCase() };
    return { kind: 'other', label: (extension || 'FILE').toUpperCase().slice(0, 4) };
  };
  const viewable = (extension) => /^(pdf|jpe?g|png|webp|gif|mp4|mp3)$/.test(extension);

  function renderStats() {
    const latest = documents.reduce((max, item) => Math.max(max, Date.parse(item.updatedAt || item.createdAt) || 0), 0);
    document.querySelector('[data-stat-documents]').textContent = documents.length;
    document.querySelector('[data-stat-categories]').textContent = new Set(documents.map((item) => item.category)).size;
    document.querySelector('[data-stat-updated]').textContent = latest ? formatDate(latest) : '—';
  }
  // Without the logo file the header shows a folder icon instead.
  const logo = document.querySelector('[data-library-logo]');
  const logoImage = logo?.querySelector('img');
  if (logoImage) {
    const markMissing = () => logo.classList.add('is-missing');
    logoImage.addEventListener('error', markMissing, { once: true });
    if (logoImage.complete && !logoImage.naturalWidth) markMissing();
  }

  function updateCategoryTrigger() {
    const isAll = activeCategory === 'all';
    document.querySelector('[data-category-current]').textContent = isAll ? 'Tất cả' : activeCategory;
    document.querySelector('[data-category-current-icon]').innerHTML = isAll ? icons.allFolders : icons.folder;
    document.querySelector('[data-category-current-count]').textContent = isAll ? documents.length : documents.filter((item) => item.category === activeCategory).length;
    categoryTrigger.classList.toggle('is-filtered', !isAll);
  }
  function filterCategories() {
    const query = categoryFilter.value.trim().toLowerCase();
    let shown = 0;
    categoryBar.querySelectorAll('[data-category]').forEach((button) => {
      const match = !query || button.dataset.category === 'all' || button.title.toLowerCase().includes(query);
      button.hidden = !match;
      if (match) shown += 1;
    });
    categoryNone.hidden = shown > 1 || !query;
  }
  function setCategoryMenu(open) {
    categoryPanel.hidden = !open;
    categoryTrigger.setAttribute('aria-expanded', String(open));
    categoryMenu.classList.toggle('is-open', open);
    if (open) {
      (categoryFilterWrap.hidden ? categoryBar.querySelector('[aria-pressed="true"]') : categoryFilter)?.focus();
    } else if (categoryFilter.value) {
      categoryFilter.value = '';
      filterCategories();
    }
  }
  categoryTrigger.addEventListener('click', () => setCategoryMenu(categoryPanel.hidden));
  categoryFilter.addEventListener('input', filterCategories);
  document.addEventListener('click', (event) => { if (!categoryPanel.hidden && !categoryMenu.contains(event.target)) setCategoryMenu(false); });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !categoryPanel.hidden) { setCategoryMenu(false); categoryTrigger.focus(); }
  });

  function renderCategories() {
    const counts = new Map();
    documents.forEach((item) => counts.set(item.category, (counts.get(item.category) || 0) + 1));
    if (activeCategory !== 'all' && !counts.has(activeCategory)) activeCategory = 'all';
    const chips = [['all', 'Tất cả', documents.length], ...[...counts].sort((a, b) => a[0].localeCompare(b[0], 'vi')).map(([name, count]) => [name, name, count])];
    categoryBar.innerHTML = chips.map(([value, label, count]) => `<button type="button" data-category="${escape(value)}" aria-pressed="${value === activeCategory}" title="${escape(label)}"><span class="library-folder-icon">${value === 'all' ? icons.allFolders : icons.folder}</span><span class="library-folder-name">${escape(label)}</span><span class="library-folder-count">${count}</span></button>`).join('');
    categoryFilterWrap.hidden = chips.length <= 7;
    filterCategories();
    updateCategoryTrigger();
    categoryOptions.innerHTML = [...new Set([...defaultCategories, ...counts.keys()])].map((name) => `<option value="${escape(name)}"></option>`).join('');
  }

  function render() {
    const query = search.value.trim().toLowerCase();
    const visible = documents.filter((item) => (activeCategory === 'all' || item.category === activeCategory)
      && (!query || `${item.title} ${item.name} ${item.category} ${item.description || ''}`.toLowerCase().includes(query)));
    if (!documents.length) {
      list.innerHTML = `<div class="library-empty"><b>Chưa có tài liệu nào</b>${canManage ? 'Bấm “+ Thêm tài liệu” để tải tài liệu đầu tiên lên.' : 'Tài liệu sẽ hiển thị tại đây khi được Admin/CEO tải lên.'}</div>`;
      return;
    }
    if (!visible.length) {
      list.innerHTML = '<div class="library-empty"><b>Không tìm thấy tài liệu phù hợp</b>Thử từ khóa hoặc danh mục khác.</div>';
      return;
    }
    list.dataset.view = view;
    list.innerHTML = visible.map((item) => {
      const extension = extensionOf(item.name || item.file);
      const { kind, label } = kindOf(extension);
      const url = `/api/documents/files/${encodeURIComponent(item.file)}`;
      const openUrl = viewable(extension) ? url : `${url}?download=1`;
      const placeholder = `<span class="library-placeholder is-${kind}"><span class="library-placeholder-icon">${icons[kind] || icons.other}</span><b>${escape(label)}</b></span>`;
      // Preview: the rendered first page, the video's first frame, or a typed placeholder.
      const preview = item.hasPreview
        ? `<img src="/api/documents/thumbs/${encodeURIComponent(item.id)}?v=${encodeURIComponent(item.thumb || item.file)}" alt="" loading="lazy" data-preview-image>${placeholder}`
        : kind === 'media' && extension === 'mp4'
          ? `<video src="${url}#t=0.5" preload="metadata" muted playsinline aria-hidden="true"></video>`
          : placeholder;
      return `<article class="library-item">
        <a class="library-preview${item.hasPreview ? ' has-image' : ''}" href="${openUrl}" ${viewable(extension) ? 'target="_blank" rel="noopener"' : `download="${escape(item.name)}"`} aria-label="${viewable(extension) ? 'Xem' : 'Tải về'} ${escape(item.title)}">
          ${preview}
          <span class="library-type-pill is-${kind}">${escape(label)}</span>
        </a>
        <div class="library-item-body">
          <h2 title="${escape(item.title)}">${escape(item.title)}</h2>
          ${item.description ? `<p title="${escape(item.description)}">${escape(item.description)}</p>` : ''}
          <div class="library-item-meta"><span class="library-chip">${escape(item.category)}</span><span>${formatSize(item.size)}</span><span>${formatDate(item.createdAt)}</span>${item.uploaderName ? `<span class="library-uploader">${escape(item.uploaderName)}</span>` : ''}</div>
        </div>
        <div class="library-item-actions">
          ${viewable(extension) ? `<a class="library-view" href="${url}" target="_blank" rel="noopener">${icons.eye}<span>Xem</span></a>` : ''}
          <a class="library-download" href="${url}?download=1" download="${escape(item.name)}">${icons.download}<span>Tải về</span></a>
          ${canManage ? `<button type="button" class="library-edit" data-edit-document="${escape(item.id)}" aria-label="Sửa ${escape(item.title)}" title="Sửa">${icons.pencil}</button><button type="button" class="library-delete" data-delete-document="${escape(item.id)}" aria-label="Xóa ${escape(item.title)}" title="Xóa">${icons.trash}</button>` : ''}
        </div>
      </article>`;
    }).join('');
    // A preview that fails to load falls back to the placeholder underneath it.
    list.querySelectorAll('[data-preview-image]').forEach((image) => {
      image.addEventListener('load', () => image.closest('.library-preview').classList.add('is-loaded'), { once: true });
      image.addEventListener('error', () => { image.closest('.library-preview').classList.remove('has-image'); image.remove(); }, { once: true });
    });
  }

  async function load() {
    try {
      const response = await fetch('/api/documents', { cache: 'no-store' });
      if (!response.ok) throw new Error(response.status === 403 ? 'Bạn cần đăng nhập để xem kho tài liệu.' : 'Không tải được kho tài liệu.');
      ({ documents, canManage } = await response.json());
      manage.hidden = !canManage;
      addButton.hidden = !canManage || !form.hidden;
      renderStats();
      renderCategories();
      render();
    } catch (error) {
      list.innerHTML = `<div class="library-empty"><b>${escape(error.message)}</b></div>`;
    }
  }

  function toggleForm(open) {
    form.hidden = !open;
    addButton.setAttribute('aria-expanded', String(open));
    addButton.hidden = open || !canManage;
    if (open) form.querySelector('[name="title"]').focus();
  }
  function showFile() {
    const file = fileInput.files?.[0];
    const editing = documents.find((item) => item.id === editingId);
    fileLabel.innerHTML = file
      ? `<b>${escape(file.name)}</b> · ${formatSize(file.size)}`
      : editing ? `Đang dùng: <b>${escape(editing.name)}</b> · chọn file khác để thay` : '<b>Chọn file</b> hoặc kéo thả vào đây';
    const title = form.querySelector('[name="title"]');
    if (file && !title.value.trim()) title.value = file.name.replace(/\.[^.]+$/, '').slice(0, 150);
  }
  function setMode(item) {
    editingId = item?.id || '';
    form.querySelector('h2').textContent = item ? 'Sửa tài liệu' : 'Thêm tài liệu mới';
    submit.textContent = item ? 'Lưu thay đổi' : 'Tải lên';
    fileInput.required = !item;
    form.reset();
    if (item) {
      form.querySelector('[name="title"]').value = item.title || '';
      form.querySelector('[name="category"]').value = item.category || '';
      form.querySelector('[name="description"]').value = item.description || '';
    }
    status.textContent = '';
    showFile();
  }
  function closeForm() {
    setMode(null);
    toggleForm(false);
  }

  addButton.addEventListener('click', () => { setMode(null); toggleForm(true); });
  document.querySelector('[data-library-cancel]').addEventListener('click', closeForm);
  fileInput.addEventListener('change', showFile);
  ['dragenter', 'dragover'].forEach((type) => drop.addEventListener(type, (event) => { event.preventDefault(); drop.classList.add('is-dragging'); }));
  ['dragleave', 'drop'].forEach((type) => drop.addEventListener(type, () => drop.classList.remove('is-dragging')));
  drop.addEventListener('drop', (event) => {
    event.preventDefault();
    if (!event.dataTransfer?.files?.length) return;
    fileInput.files = event.dataTransfer.files;
    showFile();
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const file = fileInput.files?.[0];
    if (!file && !editingId) { status.textContent = 'Vui lòng chọn file.'; return; }
    if (file && file.size > 50 * 1024 * 1024) { status.textContent = 'File quá lớn (tối đa 50MB).'; return; }
    const fields = Object.fromEntries(new FormData(form));
    const expected = editingId ? 200 : 201;
    // XMLHttpRequest reports upload progress, which fetch cannot.
    const request = new XMLHttpRequest();
    request.open(editingId ? 'PUT' : 'POST', editingId ? `/api/documents/${encodeURIComponent(editingId)}` : '/api/documents');
    if (file) request.setRequestHeader('X-File-Name', encodeURIComponent(file.name));
    request.setRequestHeader('X-Document-Title', encodeURIComponent(String(fields.title || '').trim()));
    request.setRequestHeader('X-Document-Category', encodeURIComponent(String(fields.category || '').trim()));
    request.setRequestHeader('X-Document-Description', encodeURIComponent(String(fields.description || '').trim()));
    request.setRequestHeader('Content-Type', file?.type || 'application/octet-stream');
    submit.disabled = true;
    progress.hidden = !file;
    const bar = progress.querySelector('span');
    bar.style.width = '0%';
    status.textContent = file ? 'Đang tải lên...' : 'Đang lưu...';
    request.upload.addEventListener('progress', (progressEvent) => {
      if (progressEvent.lengthComputable) bar.style.width = `${Math.round((progressEvent.loaded / progressEvent.total) * 100)}%`;
    });
    request.addEventListener('loadend', () => {
      submit.disabled = false;
      progress.hidden = true;
      if (request.status === expected) {
        closeForm();
        load();
      } else {
        status.textContent = request.responseText || (editingId ? 'Không lưu được thay đổi.' : 'Không tải lên được tài liệu.');
      }
    });
    request.send(file || null);
  });

  categoryBar.addEventListener('click', (event) => {
    const button = event.target.closest('[data-category]');
    if (!button) return;
    activeCategory = button.dataset.category;
    categoryBar.querySelectorAll('[data-category]').forEach((chip) => chip.setAttribute('aria-pressed', String(chip === button)));
    updateCategoryTrigger();
    setCategoryMenu(false);
    categoryTrigger.focus();
    render();
  });
  // Clear button and "/" shortcut for the search box.
  const searchBox = search.closest('.library-search');
  searchBox.insertAdjacentHTML('beforeend', '<kbd class="library-search-key" title="Nhấn / để tìm">/</kbd><button type="button" class="library-search-clear" aria-label="Xóa tìm kiếm" hidden>×</button>');
  const clearSearch = searchBox.querySelector('.library-search-clear');
  const syncSearch = () => {
    clearSearch.hidden = !search.value;
    searchBox.classList.toggle('has-value', Boolean(search.value));
  };
  clearSearch.addEventListener('click', (event) => {
    event.preventDefault();
    search.value = '';
    syncSearch();
    render();
    search.focus();
  });
  search.addEventListener('input', () => { syncSearch(); render(); });
  search.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && search.value) { search.value = ''; syncSearch(); render(); }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    event.preventDefault();
    search.focus();
  });
  list.addEventListener('click', async (event) => {
    const edit = event.target.closest('[data-edit-document]');
    if (edit) {
      const item = documents.find((entry) => entry.id === edit.dataset.editDocument);
      if (!item) return;
      setMode(item);
      toggleForm(true);
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    const button = event.target.closest('[data-delete-document]');
    if (!button) return;
    const item = documents.find((entry) => entry.id === button.dataset.deleteDocument);
    if (!item || !window.confirm(`Xóa tài liệu “${item.title}”? File sẽ bị xóa vĩnh viễn.`)) return;
    button.disabled = true;
    const response = await fetch(`/api/documents/${encodeURIComponent(item.id)}`, { method: 'DELETE' });
    if (!response.ok) {
      button.disabled = false;
      window.alert(await response.text() || 'Không xóa được tài liệu.');
      return;
    }
    load();
  });

  load();
})();
