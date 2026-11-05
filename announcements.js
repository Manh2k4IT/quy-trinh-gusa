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

  // ---- Safe HTML: the same small set of tags and styles the server keeps. ----
  const allowedTags = new Set(['p', 'div', 'br', 'span', 'b', 'strong', 'i', 'em', 'u', 's', 'sub', 'sup', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'blockquote', 'a', 'img', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td']);
  const droppedTags = new Set(['script', 'style', 'iframe', 'object', 'embed', 'noscript', 'template', 'svg', 'math', 'title', 'textarea', 'meta', 'link', 'head', 'button', 'input', 'select']);
  const colorValue = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|[a-z]+)$/i;
  const styleRules = {
    color: colorValue,
    'background-color': colorValue,
    'text-align': /^(left|right|center|justify|start|end)$/i,
    'font-size': /^(x{0,3}-?small|medium|x{0,3}-?large|smaller|larger|\d{1,2}(\.\d+)?(px|pt|em|rem|%))$/i,
    'font-weight': /^(bold|normal|[1-9]00)$/i,
    'font-style': /^(italic|normal)$/i,
    'text-decoration-line': /^[a-z\s-]+$/i,
    width: /^\d{1,3}(\.\d+)?%$/,
    'margin-left': /^\d{1,3}px$/,
    'padding-left': /^\d{1,3}px$/,
  };
  const fontSizes = { 1: 'x-small', 2: 'small', 3: 'medium', 4: 'large', 5: 'x-large', 6: 'xx-large', 7: 'xxx-large' };
  const safeUrl = (value, image = false) => {
    const url = String(value || '').replace(/[\u0000- ]+/g, '');
    if (image) return /^\/api\/announcements\/images\/[\w-]+\.(jpg|png|webp|gif)$/.test(url) || /^https:\/\/[^\s"'<>]+$/i.test(url) ? url : '';
    return /^(https?:\/\/|mailto:|tel:)[^\s"'<>]+$/i.test(url) || /^\/[^/\s"'<>][^\s"'<>]*$/.test(url) || /^#[\w-]+$/.test(url) ? url : '';
  };
  // Pasted pages often paint everything black on white; drop that so text follows the theme.
  const isDefaultInk = (property, value) => {
    const rgb = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/.exec(value);
    if (/^(transparent|initial|inherit|windowtext)$/i.test(value)) return true;
    if (!rgb) return property === 'color' ? /^(#000(000)?|black)$/i.test(value) : /^(#fff(fff)?|white)$/i.test(value);
    if (rgb[4] !== undefined && Number(rgb[4]) === 0) return true;
    const channels = rgb.slice(1, 4).map(Number);
    return property === 'color' ? channels.every((channel) => channel < 70) : channels.every((channel) => channel > 240);
  };

  const cleanHtml = (html, { paste = false } = {}) => {
    const doc = new DOMParser().parseFromString(`<!doctype html><body>${html}</body>`, 'text/html');
    const clean = (source, target) => {
      source.childNodes.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) { target.append(node.textContent); return; }
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        let tag = node.tagName.toLowerCase();
        if (droppedTags.has(tag)) return;
        if (tag === 'strike' || tag === 'del') tag = 's';
        if (tag === 'h1') tag = 'h2';
        if (tag === 'h5' || tag === 'h6') tag = 'h4';
        if (tag === 'font') tag = 'span';
        // Google Docs wraps whole pastes in <b style="font-weight:normal">.
        if ((tag === 'b' || tag === 'strong') && /^(normal|400)$/.test(node.style.fontWeight)) tag = 'span';
        if (!allowedTags.has(tag)) { clean(node, target); return; }
        if (tag === 'img') {
          const src = safeUrl(node.getAttribute('src'), true);
          if (!src) return;
        }
        const element = doc.createElement(tag);
        const styles = [];
        Object.keys(styleRules).forEach((property) => {
          let value = node.style.getPropertyValue(property === 'text-decoration-line' ? 'text-decoration-line' : property).trim();
          if (!value && property === 'text-decoration-line') value = (node.style.getPropertyValue('text-decoration') || '').split(' ').filter((part) => /^(underline|line-through|overline|none)$/.test(part)).join(' ');
          if (!value || !styleRules[property].test(value)) return;
          if (paste && (property === 'color' || property === 'background-color') && isDefaultInk(property, value)) return;
          if (property === 'font-weight' && /^(normal|400)$/.test(value)) return;
          styles.push(`${property}: ${value}`);
        });
        if (node.tagName.toLowerCase() === 'font') {
          if (node.getAttribute('color') && colorValue.test(node.getAttribute('color'))) styles.push(`color: ${node.getAttribute('color')}`);
          if (fontSizes[node.getAttribute('size')]) styles.push(`font-size: ${fontSizes[node.getAttribute('size')]}`);
        }
        if (node.getAttribute('align') && /^(left|right|center|justify)$/i.test(node.getAttribute('align'))) styles.push(`text-align: ${node.getAttribute('align').toLowerCase()}`);
        if (styles.length) element.setAttribute('style', styles.join('; '));
        if (tag === 'a') {
          const href = safeUrl(node.getAttribute('href'));
          if (href) { element.setAttribute('href', href); element.setAttribute('target', '_blank'); element.setAttribute('rel', 'noopener noreferrer'); }
        }
        if (tag === 'img') {
          element.setAttribute('src', safeUrl(node.getAttribute('src'), true));
          element.setAttribute('alt', (node.getAttribute('alt') || '').slice(0, 200));
          element.setAttribute('loading', 'lazy');
        }
        if ((tag === 'td' || tag === 'th') && /^\d{1,2}$/.test(node.getAttribute('colspan') || '')) element.setAttribute('colspan', node.getAttribute('colspan'));
        clean(node, element);
        // A plain <span> with nothing left on it is just noise.
        if (tag === 'span' && !element.attributes.length) target.append(...element.childNodes);
        else target.append(element);
      });
    };
    const output = doc.createElement('div');
    clean(doc.body, output);
    return output.innerHTML;
  };

  const fileSize = (bytes) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
  const fileKinds = { pdf: 'pdf', doc: 'doc', docx: 'doc', xls: 'xls', xlsx: 'xls', csv: 'xls', ppt: 'ppt', pptx: 'ppt', zip: 'zip', rar: 'zip', '7z': 'zip', jpg: 'img', jpeg: 'img', png: 'img', webp: 'img', gif: 'img', mp4: 'media', mp3: 'media' };
  const fileBadge = (name) => {
    const extension = (String(name).split('.').pop() || '').toLowerCase();
    return `<span class="file-badge file-${fileKinds[extension] || 'other'}" aria-hidden="true">${escape(extension.slice(0, 4).toUpperCase() || 'FILE')}</span>`;
  };
  const attachmentLinks = (items) => (items?.length ? `<ul class="announcement-files">${items.map((item) => {
    const url = `/api/announcements/files/${encodeURIComponent(item.file)}`;
    return `<li><a class="announcement-file" href="${url}" target="_blank" rel="noopener">${fileBadge(item.name)}<span><b>${escape(item.name)}</b><small>${fileSize(item.size || 0)}</small></span></a><a class="announcement-file-download" href="${url}?download=1" download aria-label="Tải xuống ${escape(item.name)}" title="Tải xuống"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg></a></li>`;
  }).join('')}</ul>` : '');

  const render = () => {
    const read = readIds();
    const query = search.value.trim().toLowerCase();
    const visible = announcements.filter((item) => (filter === 'all' || (filter === 'unread' ? !read.has(item.id) : item.important))
      && (!query || `${item.title} ${item.content} ${(item.attachments || []).map((file) => file.name).join(' ')}`.toLowerCase().includes(query)));
    const unreadCount = announcements.filter((item) => !read.has(item.id)).length;
    filters.querySelector('[data-announcement-filter="unread"]').textContent = unreadCount ? `Chưa đọc (${unreadCount})` : 'Chưa đọc';
    list.innerHTML = visible.length ? visible.map((item) => {
      const unread = !read.has(item.id);
      const rich = Boolean(item.contentHtml);
      const long = item.content.length > 280 || item.content.split('\n').length > 5 || (rich && /<(img|table)\b/i.test(item.contentHtml));
      return `<article class="announcement-card${item.important ? ' is-important' : ''}${item.pinned ? ' is-pinned' : ''}${unread ? ' is-unread' : ''}" id="${escape(item.id)}">
        <div class="announcement-card-head">
          <div class="announcement-badges">${item.pinned ? '<span class="badge-pinned">📌 Đã ghim</span>' : ''}${item.important ? '<span class="badge-important">Quan trọng</span>' : ''}${unread ? '<span class="badge-new">Mới</span>' : ''}</div>
          ${canManage ? `<button class="announcement-delete" type="button" data-delete-announcement="${escape(item.id)}" aria-label="Xóa thông báo">Xóa</button>` : ''}
        </div>
        <h2>${escape(item.title)}</h2>
        <p class="announcement-meta"><span class="announcement-author-dot">${escape((item.authorName || '?').charAt(0).toUpperCase())}</span>${escape(item.authorName)} · <time datetime="${escape(item.createdAt)}">${escape(timeLabel(item.createdAt))}</time></p>
        <div class="announcement-body${rich ? ' rich-text is-rich' : ''}${long ? ' is-collapsed' : ''}">${rich ? cleanHtml(item.contentHtml) : escape(item.content)}</div>
        ${long ? '<button class="announcement-more" type="button" data-toggle-announcement>Xem thêm</button>' : ''}
        ${attachmentLinks(item.attachments)}
      </article>`;
    }).join('') : `<div class="announcement-empty"><span aria-hidden="true">📭</span><b>${announcements.length ? 'Không có thông báo phù hợp' : 'Chưa có thông báo nào'}</b><small>${announcements.length ? 'Thử đổi bộ lọc hoặc từ khóa tìm kiếm.' : 'Thông báo mới từ công ty sẽ hiện ở đây.'}</small></div>`;
  };

  // ---- Rich text editor for the composer ----
  const editorRoot = form.querySelector('[data-rich-editor]');
  const editor = editorRoot.querySelector('[data-rich-content]');
  const toolbar = editorRoot.querySelector('[data-rich-toolbar]');
  const hint = editorRoot.querySelector('[data-rich-hint]');
  const counter = editorRoot.querySelector('[data-rich-count]');
  const fileInput = editorRoot.querySelector('[data-rich-file]');
  const popover = editorRoot.querySelector('[data-rich-popover]');
  const defaultHint = hint.textContent;
  const draftKey = 'gusa-announcement-draft';
  let savedRange = null;
  let selectedImage = null;
  let uploading = 0;

  const icon = (body) => `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
  const icons = {
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
    bold: '<path d="M7 5h6a3.5 3.5 0 0 1 0 7H7z"/><path d="M7 12h7a3.5 3.5 0 0 1 0 7H7z"/>',
    italic: '<path d="M19 4h-9M14 20H5M15 4 9 20"/>',
    underline: '<path d="M6 4v6a6 6 0 0 0 12 0V4"/><path d="M4 20h16"/>',
    strike: '<path d="M16 5H9.5a3 3 0 0 0-1.6 5.5"/><path d="M14 13.5a3.2 3.2 0 0 1-1.5 5.5H6"/><path d="M4 12h16"/>',
    color: '<path d="m6 16 6-12 6 12"/><path d="M8.5 11h7"/>',
    highlight: '<path d="m9 11-5 5v2h6l2-2"/><path d="m20 9-6.5 6.5-5-5L15 4z"/>',
    left: '<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>',
    center: '<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>',
    right: '<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>',
    justify: '<path d="M4 6h16M4 10h16M4 14h16M4 18h16"/>',
    ul: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
    ol: '<path d="M10 6h10M10 12h10M10 18h10"/><path d="M4 4h1v4M4 8h2"/><path d="M4 14.5a1.2 1.2 0 0 1 2 .9c0 .9-2 1.6-2 2.6h2"/>',
    outdent: '<path d="M4 5h16M11 10h9M11 14h9M4 19h16"/><path d="m7 9-3 3 3 3"/>',
    indent: '<path d="M4 5h16M11 10h9M11 14h9M4 19h16"/><path d="m4 9 3 3-3 3"/>',
    quote: '<path d="M10 7H6a1 1 0 0 0-1 1v4h4v1a3 3 0 0 1-3 3"/><path d="M19 7h-4a1 1 0 0 0-1 1v4h4v1a3 3 0 0 1-3 3"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
    unlink: '<path d="m18.8 13.2 1.7-1.7a5 5 0 0 0-7-7l-1.7 1.7"/><path d="m5.2 10.8-1.7 1.7a5 5 0 0 0 7 7l1.7-1.7"/><path d="M4 4l16 16"/>',
    attach: '<path d="m20 11.5-8.1 8.1a5 5 0 0 1-7.1-7.1l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="m21 16-5-5L5 20"/>',
    table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16M15 4v16"/>',
    hr: '<path d="M3 12h18"/><path d="M8 6h8M8 18h8" opacity=".45"/>',
    clear: '<path d="M6 5h12M12 5 9 19"/><path d="m15 15 5 5M20 15l-5 5"/>',
  };
  const button = (name, title, attrs = '') => `<button type="button" class="rich-btn" data-rich="${name}" title="${title}" aria-label="${title}" ${attrs}>${icon(icons[name])}</button>`;
  const separator = '<span class="rich-sep" aria-hidden="true"></span>';
  toolbar.innerHTML = [
    `<div class="rich-group">${button('undo', 'Hoàn tác (Ctrl+Z)')}${button('redo', 'Làm lại (Ctrl+Y)')}</div>`,
    separator,
    `<div class="rich-group"><select class="rich-select" data-rich-block aria-label="Kiểu đoạn" title="Kiểu đoạn">
      <option value="p">Đoạn văn</option><option value="h2">Tiêu đề lớn</option><option value="h3">Tiêu đề vừa</option><option value="h4">Tiêu đề nhỏ</option><option value="blockquote">Trích dẫn</option>
    </select><select class="rich-select" data-rich-size aria-label="Cỡ chữ" title="Cỡ chữ">
      <option value="" hidden>Cỡ chữ</option><option value="2">Nhỏ</option><option value="3">Bình thường</option><option value="4">Lớn</option><option value="5">Rất lớn</option><option value="6">Cực lớn</option>
    </select></div>`,
    separator,
    `<div class="rich-group">${button('bold', 'In đậm (Ctrl+B)', 'data-state="bold"')}${button('italic', 'In nghiêng (Ctrl+I)', 'data-state="italic"')}${button('underline', 'Gạch chân (Ctrl+U)', 'data-state="underline"')}${button('strike', 'Gạch ngang', 'data-state="strikeThrough"')}</div>`,
    separator,
    `<div class="rich-group"><button type="button" class="rich-btn rich-color-btn" data-rich="color" title="Màu chữ" aria-label="Màu chữ">${icon(icons.color)}<span class="rich-swatch" data-swatch="color" style="background:#b42318"></span></button><button type="button" class="rich-btn rich-color-btn" data-rich="highlight" title="Màu nền chữ (tô sáng)" aria-label="Màu nền chữ">${icon(icons.highlight)}<span class="rich-swatch" data-swatch="highlight" style="background:#ffe066"></span></button></div>`,
    separator,
    `<div class="rich-group">${button('left', 'Căn trái', 'data-state="justifyLeft"')}${button('center', 'Căn giữa', 'data-state="justifyCenter"')}${button('right', 'Căn phải', 'data-state="justifyRight"')}${button('justify', 'Căn đều hai bên', 'data-state="justifyFull"')}</div>`,
    separator,
    `<div class="rich-group">${button('ul', 'Danh sách dấu chấm', 'data-state="insertUnorderedList"')}${button('ol', 'Danh sách đánh số', 'data-state="insertOrderedList"')}${button('outdent', 'Giảm thụt lề')}${button('indent', 'Tăng thụt lề')}${button('quote', 'Trích dẫn')}</div>`,
    separator,
    `<div class="rich-group">${button('link', 'Chèn liên kết (Ctrl+K)')}${button('unlink', 'Bỏ liên kết')}${button('image', 'Chèn ảnh')}${button('attach', 'Đính kèm file')}${button('table', 'Chèn bảng')}${button('hr', 'Đường kẻ ngang')}</div>`,
    separator,
    `<div class="rich-group">${button('clear', 'Xóa định dạng')}</div>`,
  ].join('');

  const textColors = ['#101828', '#475467', '#98a2b3', '#ffffff', '#b42318', '#e8590c', '#f59f00', '#2f9e44', '#0c8599', '#1971c2', '#173f78', '#6741d9', '#c2255c', '#862e9c', '#5c940d', '#795548'];
  const highlightColors = ['#fff3bf', '#ffe066', '#ffd8a8', '#ffc9c9', '#fcc2d7', '#e5dbff', '#d0ebff', '#c5f6fa', '#d3f9d8', '#e9ecef'];
  let lastColor = { color: '#b42318', highlight: '#ffe066' };

  const insideEditor = (node) => node && (node === editor || editor.contains(node));
  const saveSelection = () => {
    const selection = getSelection();
    if (selection.rangeCount && insideEditor(selection.getRangeAt(0).commonAncestorContainer)) savedRange = selection.getRangeAt(0).cloneRange();
  };
  const restoreSelection = () => {
    editor.focus({ preventScroll: true });
    const selection = getSelection();
    selection.removeAllRanges();
    if (savedRange && insideEditor(savedRange.commonAncestorContainer)) selection.addRange(savedRange);
    else {
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      selection.addRange(range);
    }
  };
  const closestInSelection = (selector) => {
    const node = savedRange?.commonAncestorContainer;
    const element = node?.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    const found = element?.closest?.(selector);
    return found && editor.contains(found) ? found : null;
  };

  const normalize = () => {
    // Older engines still write <font>; turn it into styled spans the sanitizer understands.
    editor.querySelectorAll('font').forEach((font) => {
      const span = document.createElement('span');
      if (font.getAttribute('color')) span.style.color = font.getAttribute('color');
      if (fontSizes[font.getAttribute('size')]) span.style.fontSize = fontSizes[font.getAttribute('size')];
      span.append(...font.childNodes);
      font.replaceWith(span);
    });
  };
  const isEditorEmpty = () => !editor.textContent.trim() && !editor.querySelector('img, hr, table');
  let draftTimer = 0;
  const changed = () => {
    normalize();
    editorRoot.classList.toggle('is-empty', isEditorEmpty());
    const length = editor.innerText.trim().length;
    const images = editor.querySelectorAll('img').length;
    counter.textContent = `${length.toLocaleString('vi-VN')} ký tự${images ? ` · ${images} ảnh` : ''}`;
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => {
      try {
        const files = attachments.filter((item) => item.file).map(({ file, name, size }) => ({ file, name, size }));
        if (isEditorEmpty() && !form.elements.title.value.trim() && !files.length) localStorage.removeItem(draftKey);
        else localStorage.setItem(draftKey, JSON.stringify({ title: form.elements.title.value, html: editor.innerHTML, files }));
      } catch {}
    }, 400);
  };
  const exec = (command, value = null) => {
    restoreSelection();
    try { document.execCommand('styleWithCSS', false, true); } catch {}
    document.execCommand(command, false, value);
    saveSelection();
    changed();
    updateState();
  };
  const insertHtml = (html) => exec('insertHTML', html);

  const updateState = () => {
    if (document.activeElement !== editor) return;
    toolbar.querySelectorAll('[data-state]').forEach((item) => {
      let active = false;
      try { active = document.queryCommandState(item.dataset.state); } catch {}
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-pressed', String(active));
    });
    let block = '';
    try { block = String(document.queryCommandValue('formatBlock') || '').toLowerCase().replace(/[<>]/g, ''); } catch {}
    toolbar.querySelector('[data-rich-block]').value = ['h2', 'h3', 'h4', 'blockquote'].includes(block) ? block : 'p';
  };

  const setHint = (text) => { hint.textContent = text || defaultHint; };

  // ---- Popovers (link, colors, image, table) ----
  const closePopover = () => {
    popover.hidden = true;
    popover.innerHTML = '';
    popover.dataset.kind = '';
    toolbar.querySelectorAll('.is-open').forEach((item) => item.classList.remove('is-open'));
  };
  const openPopover = (kind, anchor, html) => {
    closePopover();
    popover.dataset.kind = kind;
    popover.innerHTML = html;
    popover.hidden = false;
    if (anchor.classList?.contains('rich-btn')) anchor.classList.add('is-open');
    positionPopover(anchor);
    popover.querySelector('input:not([type="color"]):not([type="checkbox"])')?.focus();
  };
  const positionPopover = (anchor) => {
    const rootBox = editorRoot.getBoundingClientRect();
    const anchorBox = anchor.getBoundingClientRect();
    const width = popover.offsetWidth;
    const left = Math.max(8, Math.min(anchorBox.left - rootBox.left, rootBox.width - width - 8));
    popover.style.left = `${left}px`;
    popover.style.top = `${anchorBox.bottom - rootBox.top + 6}px`;
  };
  const field = (label, input) => `<label class="rich-field"><span>${label}</span>${input}</label>`;

  const normalizeLink = (value) => {
    const text = value.trim();
    if (!text) return '';
    if (/^[\w.+-]+@[\w-]+(\.[\w-]+)+$/.test(text)) return `mailto:${text}`;
    if (/^\+?[\d\s.-]{8,}$/.test(text)) return `tel:${text.replace(/[\s.-]/g, '')}`;
    if (/^(https?:\/\/|mailto:|tel:|\/|#)/i.test(text)) return safeUrl(text);
    return /^[\w-]+(\.[\w-]+)+([/?#].*)?$/.test(text) ? safeUrl(`https://${text}`) : '';
  };

  const openLink = (anchorButton) => {
    const link = closestInSelection('a');
    const selectedText = link ? link.textContent : (savedRange?.toString() || '');
    openPopover('link', anchorButton, `
      <strong class="rich-popover-title">${link ? 'Sửa liên kết' : 'Chèn liên kết'}</strong>
      ${field('Đường dẫn', `<input type="text" data-link-url placeholder="https://... , email hoặc số điện thoại" value="${escape(link?.getAttribute('href') || '')}" />`)}
      ${field('Chữ hiển thị', `<input type="text" data-link-text placeholder="Để trống sẽ hiện đường dẫn" value="${escape(selectedText)}" />`)}
      <p class="rich-popover-error" data-popover-error></p>
      <div class="rich-popover-actions">${link ? '<button type="button" class="rich-plain danger" data-link-remove>Bỏ liên kết</button>' : ''}<button type="button" class="rich-plain" data-popover-cancel>Hủy</button><button type="button" class="rich-primary" data-popover-submit>${link ? 'Lưu' : 'Chèn'}</button></div>`);
    popover.querySelector('[data-popover-submit]').addEventListener('click', () => {
      const href = normalizeLink(popover.querySelector('[data-link-url]').value);
      const text = popover.querySelector('[data-link-text]').value.trim();
      if (!href) { popover.querySelector('[data-popover-error]').textContent = 'Đường dẫn chưa hợp lệ.'; return; }
      closePopover();
      if (link) {
        link.setAttribute('href', href);
        if (text && text !== link.textContent) link.textContent = text;
        changed();
        return;
      }
      if (savedRange && !savedRange.collapsed && (!text || text === savedRange.toString())) exec('createLink', href);
      else insertHtml(`<a href="${escape(href)}" target="_blank" rel="noopener noreferrer">${escape(text || href.replace(/^(mailto|tel):/, ''))}</a>&nbsp;`);
    });
    popover.querySelector('[data-link-remove]')?.addEventListener('click', () => {
      closePopover();
      link.replaceWith(...link.childNodes);
      changed();
    });
  };

  const openColors = (kind, anchorButton) => {
    const palette = kind === 'color' ? textColors : highlightColors;
    openPopover(kind, anchorButton, `
      <strong class="rich-popover-title">${kind === 'color' ? 'Màu chữ' : 'Màu nền chữ'}</strong>
      <div class="rich-swatches">${palette.map((color) => `<button type="button" class="rich-swatch-btn" data-pick-color="${color}" style="background:${color}" title="${color}" aria-label="Màu ${color}"></button>`).join('')}</div>
      <div class="rich-popover-actions spread">
        <label class="rich-custom-color" title="Chọn màu khác"><input type="color" data-custom-color value="${lastColor[kind]}" /> <span>Màu khác</span></label>
        <button type="button" class="rich-plain" data-pick-color="">${kind === 'color' ? 'Mặc định' : 'Không tô'}</button>
      </div>`);
    const apply = (color) => {
      closePopover();
      if (kind === 'color') {
        if (color) exec('foreColor', color);
        else exec('foreColor', getComputedStyle(editor).color);
      } else {
        restoreSelection();
        try { document.execCommand('styleWithCSS', false, true); } catch {}
        if (!document.execCommand('hiliteColor', false, color || 'transparent')) document.execCommand('backColor', false, color || 'transparent');
        saveSelection();
        changed();
      }
      if (color) {
        lastColor[kind] = color;
        toolbar.querySelector(`[data-swatch="${kind}"]`).style.background = color;
      }
    };
    popover.querySelectorAll('[data-pick-color]').forEach((item) => item.addEventListener('click', () => apply(item.dataset.pickColor)));
    popover.querySelector('[data-custom-color]').addEventListener('change', (event) => apply(event.target.value));
  };

  const openImage = (anchorButton) => {
    openPopover('image', anchorButton, `
      <strong class="rich-popover-title">Chèn ảnh</strong>
      <button type="button" class="rich-upload" data-image-upload>${icon(icons.image)}<span><b>Tải ảnh từ máy</b><small>JPG, PNG, WEBP, GIF · chọn được nhiều ảnh</small></span></button>
      <div class="rich-or"><span>hoặc dán link ảnh</span></div>
      ${field('Link ảnh', '<input type="url" data-image-url placeholder="https://..." />')}
      <p class="rich-popover-error" data-popover-error></p>
      <div class="rich-popover-actions"><button type="button" class="rich-plain" data-popover-cancel>Hủy</button><button type="button" class="rich-primary" data-popover-submit>Chèn ảnh</button></div>`);
    popover.querySelector('[data-image-upload]').addEventListener('click', () => { closePopover(); fileInput.click(); });
    popover.querySelector('[data-popover-submit]').addEventListener('click', () => {
      const url = safeUrl(popover.querySelector('[data-image-url]').value.trim(), true);
      if (!url) { popover.querySelector('[data-popover-error]').textContent = 'Link ảnh cần bắt đầu bằng https://'; return; }
      closePopover();
      insertHtml(`<img src="${escape(url)}" alt="" />`);
    });
  };

  const openTable = (anchorButton) => {
    openPopover('table', anchorButton, `
      <strong class="rich-popover-title">Chèn bảng</strong>
      <div class="rich-field-row">${field('Số hàng', '<input type="number" data-table-rows min="1" max="30" value="3" />')}${field('Số cột', '<input type="number" data-table-cols min="1" max="8" value="3" />')}</div>
      <label class="rich-check"><input type="checkbox" data-table-head checked /> Hàng đầu là tiêu đề</label>
      <div class="rich-popover-actions"><button type="button" class="rich-plain" data-popover-cancel>Hủy</button><button type="button" class="rich-primary" data-popover-submit>Chèn bảng</button></div>`);
    popover.querySelector('[data-popover-submit]').addEventListener('click', () => {
      const rows = Math.max(1, Math.min(30, Number(popover.querySelector('[data-table-rows]').value) || 3));
      const cols = Math.max(1, Math.min(8, Number(popover.querySelector('[data-table-cols]').value) || 3));
      const head = popover.querySelector('[data-table-head]').checked;
      closePopover();
      const row = (tag) => `<tr>${`<${tag}><br></${tag}>`.repeat(cols)}</tr>`;
      insertHtml(`<table>${head ? `<thead>${row('th')}</thead>` : ''}<tbody>${row('td').repeat(head ? Math.max(1, rows - 1) : rows)}</tbody></table><p><br></p>`);
    });
  };

  const selectImage = (image) => {
    editor.querySelectorAll('img.is-selected').forEach((item) => item.classList.remove('is-selected'));
    selectedImage = image;
    if (!image) return;
    image.classList.add('is-selected');
    const width = image.style.width || '';
    const block = image.closest('p, div, li, td, th, h2, h3, h4, blockquote');
    const align = (block && block !== editor ? block.style.textAlign : '') || 'left';
    openPopover('image-edit', image, `
      <strong class="rich-popover-title">Ảnh đã chọn</strong>
      <div class="rich-segment" aria-label="Kích thước">${[['25%', 'Nhỏ'], ['50%', 'Vừa'], ['75%', 'Lớn'], ['', 'Đầy đủ']].map(([value, label]) => `<button type="button" data-image-width="${value}" class="${width === value ? 'is-active' : ''}">${label}</button>`).join('')}</div>
      <div class="rich-segment" aria-label="Vị trí">${[['left', 'Trái'], ['center', 'Giữa'], ['right', 'Phải']].map(([value, label]) => `<button type="button" data-image-align="${value}" class="${align === value ? 'is-active' : ''}">${label}</button>`).join('')}</div>
      <div class="rich-popover-actions"><button type="button" class="rich-plain danger" data-image-remove>Xóa ảnh</button><button type="button" class="rich-primary" data-popover-cancel>Xong</button></div>`);
    popover.querySelectorAll('[data-image-width]').forEach((item) => item.addEventListener('click', () => {
      image.style.width = item.dataset.imageWidth;
      if (!image.getAttribute('style')) image.removeAttribute('style');
      popover.querySelectorAll('[data-image-width]').forEach((other) => other.classList.toggle('is-active', other === item));
      changed();
      positionPopover(image);
    }));
    popover.querySelectorAll('[data-image-align]').forEach((item) => item.addEventListener('click', () => {
      let holder = image.closest('p, div, li, td, th, h2, h3, h4, blockquote');
      if (!holder || holder === editor || !editor.contains(holder)) {
        holder = document.createElement('p');
        image.replaceWith(holder);
        holder.append(image);
      }
      holder.style.textAlign = item.dataset.imageAlign;
      popover.querySelectorAll('[data-image-align]').forEach((other) => other.classList.toggle('is-active', other === item));
      changed();
      positionPopover(image);
    }));
    popover.querySelector('[data-image-remove]').addEventListener('click', () => {
      image.remove();
      selectImage(null);
      closePopover();
      changed();
    });
  };

  // ---- Images: shrink big photos in the browser, then upload them. ----
  const readFile = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Không đọc được ảnh.'));
    reader.readAsDataURL(file);
  });
  const prepareImage = async (file) => {
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) throw new Error(`"${file.name}" không phải ảnh JPG, PNG, WEBP hoặc GIF.`);
    if (file.type === 'image/gif' || file.size < 300 * 1024) {
      if (file.size > 8 * 1024 * 1024) throw new Error(`Ảnh "${file.name}" lớn hơn 8MB.`);
      return readFile(file);
    }
    const source = await readFile(file);
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error(`Không mở được ảnh "${file.name}".`));
      element.src = source;
    });
    const scale = Math.min(1, 1800 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    let output = canvas.toDataURL('image/webp', 0.86);
    if (!output.startsWith('data:image/webp')) {
      const context = canvas.getContext('2d');
      context.globalCompositeOperation = 'destination-over';
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      output = canvas.toDataURL('image/jpeg', 0.86);
    }
    return output.length < source.length ? output : source;
  };
  const insertImages = async (files) => {
    const images = [...files].filter((file) => file.type.startsWith('image/'));
    if (!images.length) return;
    uploading += 1;
    form.querySelector('[type="submit"]').disabled = true;
    try {
      for (const [index, file] of images.entries()) {
        setHint(`Đang tải ảnh ${index + 1}/${images.length}...`);
        const data = await prepareImage(file);
        const response = await fetch('/api/announcements/images', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data }) });
        if (!response.ok) throw new Error(await response.text() || 'Không tải được ảnh.');
        const { url } = await response.json();
        insertHtml(`<img src="${escape(url)}" alt="${escape(file.name.replace(/\.[^.]+$/, '').slice(0, 120))}" />`);
      }
      setHint('');
    } catch (error) {
      setHint(error.message);
      hint.classList.add('is-error');
      setTimeout(() => { hint.classList.remove('is-error'); setHint(''); }, 6000);
    } finally {
      uploading -= 1;
      if (!uploading) form.querySelector('[type="submit"]').disabled = false;
    }
  };

  // ---- Wiring ----
  toolbar.addEventListener('mousedown', (event) => {
    if (event.target.closest('.rich-btn')) event.preventDefault();
  });
  toolbar.addEventListener('click', (event) => {
    const target = event.target.closest('[data-rich]');
    if (!target) return;
    const action = target.dataset.rich;
    if (popover.dataset.kind && target.classList.contains('is-open')) { closePopover(); return; }
    const simple = { undo: 'undo', redo: 'redo', bold: 'bold', italic: 'italic', underline: 'underline', strike: 'strikeThrough', left: 'justifyLeft', center: 'justifyCenter', right: 'justifyRight', justify: 'justifyFull', ul: 'insertUnorderedList', ol: 'insertOrderedList', outdent: 'outdent', indent: 'indent', unlink: 'unlink', hr: 'insertHorizontalRule' };
    if (simple[action]) { closePopover(); exec(simple[action]); return; }
    if (action === 'quote') {
      exec('formatBlock', closestInSelection('blockquote') ? '<p>' : '<blockquote>');
      return;
    }
    if (action === 'clear') {
      closePopover();
      exec('removeFormat');
      exec('unlink');
      if (closestInSelection('h2, h3, h4, blockquote')) exec('formatBlock', '<p>');
      return;
    }
    if (action === 'link') openLink(target);
    if (action === 'color' || action === 'highlight') openColors(action, target);
    if (action === 'image') openImage(target);
    if (action === 'attach') { closePopover(); attachInput.click(); }
    if (action === 'table') openTable(target);
  });
  toolbar.querySelector('[data-rich-block]').addEventListener('change', (event) => exec('formatBlock', `<${event.target.value}>`));
  toolbar.querySelector('[data-rich-size]').addEventListener('change', (event) => {
    if (event.target.value) exec('fontSize', event.target.value);
    event.target.value = '';
  });

  popover.addEventListener('click', (event) => {
    if (event.target.closest('[data-popover-cancel]')) { closePopover(); selectImage(null); restoreSelection(); }
  });
  popover.addEventListener('keydown', (event) => {
    // The popover lives inside the announcement form: never let Enter post the announcement.
    if (event.key === 'Enter') {
      event.preventDefault();
      popover.querySelector('[data-popover-submit]')?.click();
    }
    if (event.key === 'Escape') { event.preventDefault(); closePopover(); restoreSelection(); }
  });
  document.addEventListener('mousedown', (event) => {
    if (popover.hidden || popover.contains(event.target) || event.target.closest('.rich-btn.is-open')) return;
    if (popover.dataset.kind === 'image-edit' && event.target === selectedImage) return;
    closePopover();
    if (!editor.contains(event.target) || event.target.tagName !== 'IMG') selectImage(null);
  });

  editor.addEventListener('click', (event) => {
    if (event.target.tagName === 'IMG') selectImage(event.target);
    else if (event.target.closest('a') && (event.ctrlKey || event.metaKey)) window.open(event.target.closest('a').href, '_blank', 'noopener');
  });
  editor.addEventListener('input', changed);
  editor.addEventListener('keyup', updateState);
  editor.addEventListener('mouseup', updateState);
  editor.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      saveSelection();
      openLink(toolbar.querySelector('[data-rich="link"]'));
    }
    if ((event.key === 'Delete' || event.key === 'Backspace') && selectedImage) {
      event.preventDefault();
      selectedImage.remove();
      selectImage(null);
      closePopover();
      changed();
    }
  });
  document.addEventListener('selectionchange', saveSelection);
  editor.addEventListener('paste', (event) => {
    const data = event.clipboardData;
    if (!data) return;
    const files = [...data.files].filter((file) => file.type.startsWith('image/'));
    const html = data.getData('text/html');
    event.preventDefault();
    if (files.length && !html) { saveSelection(); insertImages(files); return; }
    if (html) insertHtml(cleanHtml(html, { paste: true }));
    else exec('insertText', data.getData('text/plain'));
  });
  editor.addEventListener('dragover', (event) => {
    if ([...event.dataTransfer.types].includes('Files')) { event.preventDefault(); editorRoot.classList.add('is-dragging'); }
  });
  editor.addEventListener('dragleave', () => editorRoot.classList.remove('is-dragging'));
  editor.addEventListener('drop', (event) => {
    editorRoot.classList.remove('is-dragging');
    if (!event.dataTransfer.files.length) return;
    event.preventDefault();
    const range = document.caretRangeFromPoint?.(event.clientX, event.clientY)
      || (() => { const position = document.caretPositionFromPoint?.(event.clientX, event.clientY); if (!position) return null; const result = document.createRange(); result.setStart(position.offsetNode, position.offset); return result; })();
    if (range && insideEditor(range.startContainer)) savedRange = range;
    const dropped = [...event.dataTransfer.files];
    const inline = dropped.filter((item) => /^image\/(jpeg|png|webp|gif)$/.test(item.type));
    if (inline.length) insertImages(inline);
    if (dropped.length > inline.length) addAttachments(dropped.filter((item) => !inline.includes(item)));
  });
  fileInput.addEventListener('change', () => {
    insertImages(fileInput.files);
    fileInput.value = '';
  });
  form.querySelector('[data-rich-label]').addEventListener('click', () => editor.focus());
  form.elements.title.addEventListener('input', changed);


  // ---- File attachments: uploaded straight away, listed under the editor, sent with the announcement. ----
  const attachBox = form.querySelector('[data-attachments]');
  const attachList = form.querySelector('[data-attachment-list]');
  const attachInput = form.querySelector('[data-attachment-input]');
  const attachError = form.querySelector('[data-attachment-error]');
  const attachmentExtensions = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'jpg', 'jpeg', 'png', 'webp', 'gif', 'zip', 'rar', '7z', 'mp4', 'mp3'];
  const maxAttachmentSize = 25 * 1024 * 1024;
  let attachments = [];
  let attachmentKey = 0;
  const renderAttachments = () => {
    attachBox.classList.toggle('has-files', attachments.length > 0);
    attachList.innerHTML = attachments.map((item) => `<li class="attachment-chip${item.error ? ' is-error' : ''}${item.file ? '' : ' is-uploading'}" data-attachment-key="${item.key}">
      ${fileBadge(item.name)}
      <span class="attachment-chip-text"><b title="${escape(item.name)}">${escape(item.name)}</b><small>${item.error ? escape(item.error) : item.file ? fileSize(item.size) : `Đang tải lên... ${item.progress || 0}%`}</small></span>
      ${item.file || item.error ? '' : `<span class="attachment-progress" style="width:${item.progress || 0}%"></span>`}
      <button type="button" class="attachment-remove" data-remove-attachment="${item.key}" aria-label="Bỏ file ${escape(item.name)}" title="Bỏ file">×</button>
    </li>`).join('');
  };
  const uploadAttachment = (item, file) => new Promise((resolve) => {
    const request = new XMLHttpRequest();
    item.request = request;
    request.open('POST', '/api/announcements/files');
    request.setRequestHeader('X-File-Name', encodeURIComponent(file.name));
    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      item.progress = Math.min(99, Math.round((event.loaded / event.total) * 100));
      const chip = attachList.querySelector(`[data-attachment-key="${item.key}"]`);
      if (chip) {
        chip.querySelector('small').textContent = `Đang tải lên... ${item.progress}%`;
        chip.querySelector('.attachment-progress')?.style.setProperty('width', `${item.progress}%`);
      }
    };
    request.onload = () => {
      if (request.status === 201) Object.assign(item, JSON.parse(request.responseText));
      else item.error = request.responseText || 'Không tải được file.';
      resolve();
    };
    request.onerror = () => { item.error = 'Mất kết nối khi tải file.'; resolve(); };
    request.onabort = () => resolve();
    request.send(file);
  });
  const addAttachments = async (files) => {
    attachError.textContent = '';
    const picked = [...files];
    if (!picked.length) return;
    if (attachments.length + picked.length > 20) { attachError.textContent = 'Tối đa 20 file cho mỗi thông báo.'; return; }
    const jobs = [];
    picked.forEach((file) => {
      const extension = (file.name.split('.').pop() || '').toLowerCase();
      const item = { key: ++attachmentKey, name: file.name, size: file.size, progress: 0 };
      if (!file.name.includes('.') || !attachmentExtensions.includes(extension)) item.error = 'Định dạng chưa được hỗ trợ';
      else if (file.size > maxAttachmentSize) item.error = 'File lớn hơn 25MB';
      else if (!file.size) item.error = 'File rỗng';
      attachments.push(item);
      if (!item.error) jobs.push(uploadAttachment(item, file));
    });
    renderAttachments();
    uploading += 1;
    form.querySelector('[type="submit"]').disabled = true;
    await Promise.all(jobs);
    uploading -= 1;
    if (!uploading) form.querySelector('[type="submit"]').disabled = false;
    renderAttachments();
    changed();
  };
  attachList.addEventListener('click', (event) => {
    const remove = event.target.closest('[data-remove-attachment]');
    if (!remove) return;
    const item = attachments.find((entry) => entry.key === Number(remove.dataset.removeAttachment));
    item?.request?.abort();
    attachments = attachments.filter((entry) => entry !== item);
    renderAttachments();
    changed();
  });
  attachBox.querySelector('[data-attachment-pick]').addEventListener('click', () => attachInput.click());
  attachInput.addEventListener('change', () => { addAttachments(attachInput.files); attachInput.value = ''; });
  attachBox.addEventListener('dragover', (event) => {
    if ([...event.dataTransfer.types].includes('Files')) { event.preventDefault(); attachBox.classList.add('is-dragging'); }
  });
  attachBox.addEventListener('dragleave', (event) => { if (!attachBox.contains(event.relatedTarget)) attachBox.classList.remove('is-dragging'); });
  attachBox.addEventListener('drop', (event) => {
    attachBox.classList.remove('is-dragging');
    if (!event.dataTransfer.files.length) return;
    event.preventDefault();
    addAttachments(event.dataTransfer.files);
  });

  try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch {}
  try {
    const draft = JSON.parse(localStorage.getItem(draftKey) || 'null');
    if (draft) {
      form.elements.title.value = draft.title || '';
      editor.innerHTML = cleanHtml(draft.html || '');
      attachments = (Array.isArray(draft.files) ? draft.files : []).filter((item) => item?.file).map((item) => ({ ...item, key: ++attachmentKey }));
      renderAttachments();
      if (draft.html || draft.title || attachments.length) setHint('Đã khôi phục bản nháp chưa đăng.');
      setTimeout(() => setHint(''), 5000);
    }
  } catch {}
  changed();

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
    if (uploading) return;
    const submit = form.querySelector('[type="submit"]');
    const data = new FormData(form);
    closePopover();
    selectImage(null);
    const ready = attachments.filter((item) => item.file);
    if (isEditorEmpty() && !ready.length) {
      status.textContent = 'Vui lòng nhập nội dung thông báo hoặc đính kèm file.';
      status.classList.add('is-error');
      editor.focus();
      return;
    }
    status.classList.remove('is-error');
    submit.disabled = true;
    submit.textContent = 'Đang đăng...';
    try {
      const response = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: data.get('title'), content: editor.innerText.trim(), contentHtml: isEditorEmpty() ? '' : cleanHtml(editor.innerHTML), attachments: ready.map(({ file, name }) => ({ file, name })), pinned: data.get('pinned') === 'on', important: data.get('important') === 'on' }),
      });
      if (!response.ok) throw new Error(await response.text() || 'Không đăng được thông báo.');
      const { announcement } = await response.json();
      markRead([announcement.id]);
      form.reset();
      editor.innerHTML = '';
      attachments = [];
      renderAttachments();
      attachError.textContent = '';
      clearTimeout(draftTimer);
      try { localStorage.removeItem(draftKey); } catch {}
      changed();
      clearTimeout(draftTimer);
      status.textContent = 'Đã đăng thông báo và gửi tới toàn bộ nhân viên.';
      await load();
    } catch (error) {
      status.textContent = error.message;
      status.classList.add('is-error');
    } finally {
      submit.disabled = false;
      submit.textContent = 'Đăng thông báo';
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
    const picture = event.target.closest('.announcement-body img');
    if (picture && !picture.closest('a')) { window.open(picture.src, '_blank', 'noopener'); return; }
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
    const filterButton = event.target.closest('[data-announcement-filter]');
    if (!filterButton) return;
    filter = filterButton.dataset.announcementFilter;
    filters.querySelectorAll('button').forEach((item) => item.classList.toggle('is-active', item === filterButton));
    render();
  });
  search.addEventListener('input', render);
  load().catch((error) => { list.innerHTML = `<p class="announcement-empty">${escape(error.message)}</p>`; });
})();
