(function () {
const categoriesBar = document.querySelector('[data-categories]');
const jobsGrid = document.querySelector('[data-jobs]');
const statusText = document.querySelector('[data-status]');
const searchInput = document.querySelector('[data-search]');
const detailModal = document.querySelector('[data-detail-modal]');
const detail = document.querySelector('[data-detail]');
const jobModal = document.querySelector('[data-job-modal]');
const jobForm = document.querySelector('[data-job-form]');
const jobError = document.querySelector('[data-job-error]');
const categoryModal = document.querySelector('[data-category-modal]');
const categoryList = document.querySelector('[data-category-list]');
const categoryForm = document.querySelector('[data-category-form]');
const categoryError = document.querySelector('[data-category-error]');
let state = { categories: [], jobs: [], canEdit: false };
let activeCategory = '';
let applications = [];
let applicationStatuses = {};
const applicationsModal = document.querySelector('[data-applications-modal]');
const applicationsList = document.querySelector('[data-applications]');
const applicationJobFilter = document.querySelector('[data-application-job]');
const applicationStatusFilter = document.querySelector('[data-application-status]');

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const formatDate = (value) => value ? value.split('-').reverse().join('/') : '';
const todayKey = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
const isOpen = (job) => job.status === 'open' && !(job.deadline && job.deadline < todayKey());
const categoryName = (id) => state.categories.find((category) => category.id === id)?.name || '';

// Mỗi dòng (hoặc mỗi ý ngăn bằng dấu ;) thành một gạch đầu dòng.
function bulletList(value) {
  const items = String(value || '').split(value.includes('\n') ? /\n+/ : ';').map((item) => item.trim().replace(/^[-•+*]\s*/, '').trim()).filter(Boolean);
  if (!items.length) return '';
  return items.length === 1 ? `<p>${escapeHtml(items[0])}</p>` : `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

async function request(url, options = {}) {
  const response = await fetch(url, { cache: 'no-store', headers: { 'Content-Type': 'application/json' }, ...options });
  if (!response.ok) throw new Error(await response.text() || 'Có lỗi xảy ra, vui lòng thử lại.');
  return response.json();
}

async function load() {
  try {
    const data = await request('/api/recruitment');
    state = { ...state, ...data };
    document.querySelector('[data-admin-actions]').hidden = !state.canEdit;
    const applicationsButton = document.querySelector('[data-open-applications]');
    applicationsButton.hidden = !state.canViewApplications;
    const applicationsCount = document.querySelector('[data-applications-count]');
    applicationsCount.textContent = state.newApplications > 99 ? '99+' : String(state.newApplications || 0);
    applicationsCount.hidden = !state.newApplications;
    if (state.canViewApplications && new URLSearchParams(location.search).get('view') === 'applications' && !applicationsModal.dataset.autoOpened) {
      applicationsModal.dataset.autoOpened = '1';
      openApplications();
    }
    if (activeCategory && !state.categories.some((category) => category.id === activeCategory)) activeCategory = '';
    render();
    const jobId = new URLSearchParams(location.search).get('job');
    if (jobId && !detailModal.dataset.autoOpened) {
      detailModal.dataset.autoOpened = '1';
      openDetail(jobId);
    }
  } catch (error) {
    statusText.textContent = error.message;
    statusText.hidden = false;
  }
}

function render() {
  const openCount = (categoryId) => state.jobs.filter((job) => isOpen(job) && (!categoryId || job.categoryId === categoryId)).length;
  categoriesBar.innerHTML = [{ id: '', name: 'Tất cả' }, ...state.categories].map((category) => `
    <button type="button" role="tab" aria-selected="${activeCategory === category.id}" data-category="${escapeHtml(category.id)}">
      ${escapeHtml(category.name)}<span>${openCount(category.id)}</span>
    </button>`).join('');
  const query = searchInput.value.trim().toLowerCase();
  const jobs = state.jobs
    .filter((job) => !activeCategory || job.categoryId === activeCategory)
    .filter((job) => !query || [job.title, job.location, categoryName(job.categoryId)].some((value) => String(value || '').toLowerCase().includes(query)))
    .sort((a, b) => Number(isOpen(b)) - Number(isOpen(a)));
  statusText.hidden = true;
  if (!state.categories.length) {
    jobsGrid.innerHTML = `<div class="recruit-empty"><strong>Chưa có thông tin tuyển dụng</strong><p>${state.canEdit ? 'Bấm "Quản lý danh mục" để tạo các lĩnh vực (Kế toán, Bán hàng…), sau đó thêm vị trí tuyển dụng.' : 'Hiện chưa có vị trí nào đang tuyển. Vui lòng quay lại sau.'}</p></div>`;
    return;
  }
  jobsGrid.innerHTML = jobs.length ? jobs.map((job) => `
    <button type="button" class="recruit-card${isOpen(job) ? '' : ' is-closed'}" data-open-job="${job.id}">
      <span class="recruit-card-top"><span class="recruit-tag">${escapeHtml(categoryName(job.categoryId))}</span><span class="recruit-badge${isOpen(job) ? '' : ' is-closed'}">${isOpen(job) ? 'Đang tuyển' : job.status === 'closed' ? 'Đã đủ người' : 'Hết hạn nộp'}</span></span>
      <strong class="recruit-card-title">${escapeHtml(job.title)}</strong>
      ${job.salary ? `<span class="recruit-salary">${escapeHtml(job.salary)}</span>` : ''}
      <span class="recruit-meta">
        ${job.location ? `<span>📍 ${escapeHtml(job.location)}</span>` : ''}
        ${job.quantity ? `<span>👥 ${escapeHtml(job.quantity)}</span>` : ''}
        ${job.workType ? `<span>🕒 ${escapeHtml(job.workType)}</span>` : ''}
        ${job.deadline ? `<span>📅 Hạn nộp ${formatDate(job.deadline)}</span>` : ''}
      </span>
      <span class="recruit-card-action">Xem chi tiết →</span>
    </button>`).join('') : '<div class="recruit-empty"><strong>Chưa có vị trí nào trong danh mục này</strong><p>Hãy chọn danh mục khác hoặc quay lại sau.</p></div>';
}

function openDetail(jobId) {
  const job = state.jobs.find((item) => item.id === jobId);
  if (!job) return;
  const sections = [['Mô tả công việc', job.description], ['Yêu cầu ứng viên', job.requirements], ['Quyền lợi', job.benefits], ['Liên hệ ứng tuyển', job.contact]]
    .filter(([, value]) => value)
    .map(([title, value]) => `<section class="recruit-section"><h3>${title}</h3>${bulletList(value)}</section>`).join('');
  detail.innerHTML = `
    <header class="recruit-detail-head">
      <span class="recruit-tag">${escapeHtml(categoryName(job.categoryId))}</span>
      <h2 id="recruit-detail-title">${escapeHtml(job.title)}</h2>
      <span class="recruit-badge${isOpen(job) ? '' : ' is-closed'}">${isOpen(job) ? 'Đang tuyển' : job.status === 'closed' ? 'Đã đủ người' : 'Hết hạn nộp'}</span>
    </header>
    <dl class="recruit-facts">
      ${[['Mức lương', job.salary], ['Số lượng', job.quantity], ['Nơi làm việc', job.location], ['Hình thức', job.workType], ['Hạn nộp hồ sơ', formatDate(job.deadline)]].filter(([, value]) => value).map(([label, value]) => `<div><dt>${label}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}
    </dl>
    ${sections || '<p class="recruit-hint">Chưa có mô tả chi tiết.</p>'}
    <div class="recruit-share"><span>Gửi vị trí này cho người ứng tuyển qua Zalo — người nhận xem được mà không cần đăng nhập.</span><button class="recruit-button is-secondary" type="button" data-copy-link="/tuyen-dung/${job.id}">Sao chép link</button></div>
    ${state.canEdit ? `<div class="recruit-form-actions"><button class="recruit-button is-danger" type="button" data-delete-job="${job.id}">Xóa vị trí</button><button class="recruit-button" type="button" data-edit-job="${job.id}">Chỉnh sửa</button></div>` : ''}`;
  detailModal.hidden = false;
  history.replaceState(null, '', `?job=${job.id}`);
}

function closeModals() {
  document.querySelectorAll('.recruit-modal').forEach((modal) => { modal.hidden = true; });
  if (location.search) history.replaceState(null, '', location.pathname);
}

function openJobForm(job = null) {
  jobForm.reset();
  jobError.textContent = '';
  jobForm.querySelector('[data-category-select]').innerHTML = state.categories.map((category) => `<option value="${escapeHtml(category.id)}">${escapeHtml(category.name)}</option>`).join('');
  document.querySelector('[data-job-form-title]').textContent = job ? 'Chỉnh sửa vị trí tuyển dụng' : 'Thêm vị trí tuyển dụng';
  const values = job || { categoryId: activeCategory || state.categories[0]?.id, status: 'open' };
  ['id', 'title', 'categoryId', 'status', 'salary', 'quantity', 'location', 'workType', 'deadline', 'description', 'requirements', 'benefits', 'contact']
    .forEach((name) => { if (values[name] != null) jobForm.elements[name].value = values[name]; });
  detailModal.hidden = true;
  jobModal.hidden = false;
  jobForm.elements.title.focus();
}

jobForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(jobForm));
  try {
    state = { ...state, ...(await request('/api/recruitment/jobs', { method: 'POST', body: JSON.stringify(payload) })) };
    jobModal.hidden = true;
    render();
    const saved = payload.id ? payload.id : state.jobs[0]?.id;
    if (saved) openDetail(saved);
  } catch (error) {
    jobError.textContent = error.message;
  }
});

function renderCategoryList() {
  categoryList.innerHTML = state.categories.length ? state.categories.map((category) => `
    <li><input value="${escapeHtml(category.name)}" maxlength="80" data-category-name="${escapeHtml(category.id)}" aria-label="Tên danh mục" />
    <span>${state.jobs.filter((job) => job.categoryId === category.id).length} vị trí</span>
    <button type="button" class="recruit-button is-secondary" data-rename-category="${escapeHtml(category.id)}">Lưu</button>
    <button type="button" class="recruit-button is-danger" data-delete-category="${escapeHtml(category.id)}">Xóa</button></li>`).join('')
    : '<li class="recruit-hint">Chưa có danh mục nào.</li>';
}

async function saveCategories(url, options) {
  categoryError.textContent = '';
  try {
    state = { ...state, ...(await request(url, options)) };
    renderCategoryList();
    render();
  } catch (error) {
    categoryError.textContent = error.message;
  }
}

categoryForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  await saveCategories('/api/recruitment/categories', { method: 'POST', body: JSON.stringify({ name: categoryForm.elements.name.value }) });
  if (!categoryError.textContent) categoryForm.reset();
});
categoryList.addEventListener('click', (event) => {
  const rename = event.target.closest('[data-rename-category]');
  if (rename) {
    const id = rename.dataset.renameCategory;
    saveCategories('/api/recruitment/categories', { method: 'POST', body: JSON.stringify({ id, name: categoryList.querySelector(`[data-category-name="${id}"]`).value }) });
  }
  const remove = event.target.closest('[data-delete-category]');
  if (remove && confirm('Xóa danh mục này?')) saveCategories(`/api/recruitment/categories/${remove.dataset.deleteCategory}`, { method: 'DELETE' });
});

// Danh sách ứng tuyển (Admin/CEO/Nhân sự).
const formatDateTime = (value) => value ? new Date(value).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : '';

async function openApplications() {
  applicationsModal.hidden = false;
  applicationsList.innerHTML = '<p class="recruit-hint">Đang tải...</p>';
  try {
    const data = await request('/api/recruitment/applications');
    applications = data.applications;
    applicationStatuses = data.statuses;
    const jobIds = [...new Set(applications.map((item) => item.jobId))];
    applicationJobFilter.innerHTML = '<option value="">Tất cả vị trí</option>' + jobIds.map((id) => `<option value="${escapeHtml(id)}">${escapeHtml(applications.find((item) => item.jobId === id).jobTitle)}</option>`).join('');
    applicationStatusFilter.innerHTML = '<option value="">Tất cả trạng thái</option>' + Object.entries(applicationStatuses).map(([key, label]) => `<option value="${key}">${label}</option>`).join('');
    renderApplications();
  } catch (error) {
    applicationsList.innerHTML = `<p class="recruit-error">${escapeHtml(error.message)}</p>`;
  }
}

function renderApplications() {
  const list = applications.filter((item) => (!applicationJobFilter.value || item.jobId === applicationJobFilter.value) && (!applicationStatusFilter.value || item.status === applicationStatusFilter.value));
  applicationsList.innerHTML = list.length ? list.map((item) => `
    <article class="recruit-applicant" data-application="${item.id}" data-status="${item.status}">
      <header>
        <div><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.jobTitle)} · ${formatDateTime(item.createdAt)}</span></div>
        <select data-application-status-change aria-label="Trạng thái">${Object.entries(applicationStatuses).map(([key, label]) => `<option value="${key}" ${item.status === key ? 'selected' : ''}>${label}</option>`).join('')}</select>
      </header>
      <div class="recruit-applicant-contact">
        <a href="tel:${escapeHtml(item.phone)}">📞 ${escapeHtml(item.phone)}</a>
        <a href="https://zalo.me/${escapeHtml(item.phone.replace(/^\+?84/, '0'))}" target="_blank" rel="noopener">💬 Zalo</a>
        ${item.email ? `<a href="mailto:${escapeHtml(item.email)}">✉️ ${escapeHtml(item.email)}</a>` : ''}
        ${item.cv ? `<a href="/api/recruitment/applications/${item.id}/cv" target="_blank" rel="noopener">📄 Xem CV (${escapeHtml(item.cv.name)})</a>` : '<span>Không gửi CV</span>'}
      </div>
      ${item.message ? `<p class="recruit-applicant-message">${escapeHtml(item.message)}</p>` : ''}
      <label class="recruit-applicant-note">Ghi chú nội bộ<textarea rows="2" maxlength="1000" data-application-note placeholder="VD: Đã gọi, hẹn phỏng vấn 9h thứ Hai">${escapeHtml(item.note || '')}</textarea></label>
      <footer>${item.updatedBy ? `<span>Cập nhật bởi ${escapeHtml(item.updatedBy)} · ${formatDateTime(item.updatedAt)}</span>` : '<span></span>'}<button type="button" class="recruit-button is-danger" data-delete-application>Xóa hồ sơ</button></footer>
    </article>`).join('') : '<div class="recruit-empty"><strong>Chưa có hồ sơ ứng tuyển</strong><p>Gửi link vị trí tuyển dụng qua Zalo để người ứng tuyển nộp hồ sơ.</p></div>';
}

async function updateApplication(card, changes) {
  const id = card.dataset.application;
  try {
    const { application } = await request(`/api/recruitment/applications/${id}`, { method: 'POST', body: JSON.stringify(changes) });
    applications = applications.map((item) => (item.id === id ? application : item));
    card.dataset.status = application.status;
    state.newApplications = applications.filter((item) => item.status === 'new').length;
    const applicationsCount = document.querySelector('[data-applications-count]');
    applicationsCount.textContent = String(state.newApplications);
    applicationsCount.hidden = !state.newApplications;
    window.refreshNotifications?.();
  } catch (error) {
    alert(error.message);
  }
}

applicationsList.addEventListener('change', (event) => {
  const card = event.target.closest('[data-application]');
  if (card && event.target.matches('[data-application-status-change]')) updateApplication(card, { status: event.target.value });
  if (card && event.target.matches('[data-application-note]')) updateApplication(card, { note: event.target.value });
});
applicationsList.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-delete-application]');
  if (!button || !confirm('Xóa hồ sơ ứng tuyển này? CV đính kèm cũng sẽ bị xóa.')) return;
  const id = button.closest('[data-application]').dataset.application;
  try {
    await request(`/api/recruitment/applications/${id}`, { method: 'DELETE' });
    applications = applications.filter((item) => item.id !== id);
    renderApplications();
    window.refreshNotifications?.();
  } catch (error) {
    alert(error.message);
  }
});
applicationJobFilter.addEventListener('change', renderApplications);
applicationStatusFilter.addEventListener('change', renderApplications);
document.querySelector('[data-open-applications]').addEventListener('click', () => {
  history.replaceState(null, '', '?view=applications');
  openApplications();
});

// Sao chép link trang công khai để dán vào Zalo.
async function copyLink(button) {
  const url = location.origin + button.dataset.copyLink;
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    window.prompt('Sao chép link này để gửi:', url);
    return;
  }
  const label = button.textContent;
  button.textContent = 'Đã sao chép ✓';
  setTimeout(() => { button.textContent = label; }, 2000);
}
document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-copy-link]');
  if (button) copyLink(button);
});

detail.addEventListener('click', async (event) => {
  const edit = event.target.closest('[data-edit-job]');
  if (edit) return openJobForm(state.jobs.find((job) => job.id === edit.dataset.editJob));
  const remove = event.target.closest('[data-delete-job]');
  if (remove && confirm('Xóa vị trí tuyển dụng này?')) {
    try {
      state = { ...state, ...(await request(`/api/recruitment/jobs/${remove.dataset.deleteJob}`, { method: 'DELETE' })) };
      closeModals();
      render();
    } catch (error) {
      alert(error.message);
    }
  }
});

categoriesBar.addEventListener('click', (event) => {
  const button = event.target.closest('[data-category]');
  if (!button) return;
  activeCategory = button.dataset.category;
  render();
});
jobsGrid.addEventListener('click', (event) => {
  const card = event.target.closest('[data-open-job]');
  if (card) openDetail(card.dataset.openJob);
});
searchInput.addEventListener('input', render);
document.querySelector('[data-new-job]').addEventListener('click', () => {
  if (!state.categories.length) {
    renderCategoryList();
    categoryModal.hidden = false;
    categoryError.textContent = 'Vui lòng tạo ít nhất một danh mục trước khi thêm vị trí.';
    return;
  }
  openJobForm();
});
document.querySelector('[data-manage-categories]').addEventListener('click', () => {
  renderCategoryList();
  categoryError.textContent = '';
  categoryModal.hidden = false;
});
document.querySelectorAll('[data-close-modal]').forEach((button) => button.addEventListener('click', closeModals));
document.querySelectorAll('.recruit-modal').forEach((modal) => modal.addEventListener('click', (event) => { if (event.target === modal) closeModals(); }));
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeModals(); });

document.addEventListener('gusa:notifications', (event) => {
  if (!state.canViewApplications) return;
  const item = event.detail.items.find((entry) => entry.id === 'new-applications');
  state.newApplications = item?.count || 0;
  const applicationsCount = document.querySelector('[data-applications-count]');
  applicationsCount.textContent = state.newApplications > 99 ? '99+' : String(state.newApplications);
  applicationsCount.hidden = !state.newApplications;
  if (!applicationsModal.hidden && state.newApplications !== applications.filter((entry) => entry.status === 'new').length) openApplications();
});
load();
})();
