const sidebarScroll = document.querySelector('.sidebar-scroll');

if (sidebarScroll) {
  sidebarScroll.innerHTML = `
    <p class="menu-label">DANH MỤC</p>
    <nav class="menu" aria-label="Danh mục chính">
      <a class="menu-item" href="organization-chart.html"><span class="menu-icon">▤</span><span>Sơ đồ tổ chức</span></a>
      <a class="menu-item" href="#"><span class="menu-icon">⌘</span><span>Quy Trình</span></a>
      <a class="menu-item" href="#"><span class="menu-icon">▣</span><span>Lương &amp; KPI</span></a>
      <a class="menu-item" href="#"><span class="menu-icon">♙</span><span>Tuyển dụng</span></a>
      <a class="menu-item" href="#"><span class="menu-icon">▥</span><span>Báo cáo doanh số</span></a>
    </nav>
    <p class="menu-label">CHẤM CÔNG</p>
    <nav class="menu" aria-label="Menu chấm công">
      <a class="menu-item" href="attendance.html"><span class="menu-icon">◷</span><span>Chấm công tại công ty</span></a>
      <a class="menu-item" href="attendance.html?view=online"><span class="menu-icon">⌁</span><span>Chấm công làm online</span></a>
      <a class="menu-item" href="attendance.html?view=days"><span class="menu-icon">▦</span><span>Tổng quan ngày công</span></a>
      <a class="menu-item" href="attendance-overview.html?report=online"><span class="menu-icon">♙</span><span>Báo cáo nhân sự làm online</span></a>
      <a class="menu-item" href="attendance-overview.html?report=late"><span class="menu-icon">◷</span><span>Báo cáo đi trễ</span></a>
      <a class="menu-item" href="attendance-overview.html"><span class="menu-icon">♙</span><span>Tổng quan nhân sự</span></a>
    </nav>
    <p class="menu-label">BIỂU MẪU</p>
    <nav class="menu" aria-label="Menu biểu mẫu">
      <a class="menu-item" href="proposals.html"><span class="menu-icon">☷</span><span>Đề xuất chung</span></a>
      <a class="menu-item" href="#"><span class="menu-icon">₫</span><span>Đề xuất thanh toán</span></a>
      <a class="menu-item" href="proposal-report.html" data-admin-proposal-report><span class="menu-icon">▥</span><span>Báo cáo đề xuất</span></a>
    </nav>
    <p class="menu-label">CÀI ĐẶT</p>
    <nav class="menu"><a class="menu-item" href="interface-settings.html"><span class="menu-icon">⚙</span><span>Cài đặt giao diện</span></a></nav>
    <p class="menu-label" data-admin-menu-label>QUẢN TRỊ</p>
    <nav class="menu" aria-label="Menu quản trị" data-admin-menu>
      <a class="menu-item" href="user-management.html"><span class="menu-icon">⚙</span><span>Quản lý user</span></a>
      <a class="menu-item" href="#"><span class="menu-icon">▥</span><span>Thùng rác</span></a>
      <a class="menu-item" href="#"><span class="menu-icon">◉</span><span>Nhật ký lỗi</span></a>
    </nav>`;

  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  const currentQuery = window.location.search;
  sidebarScroll.querySelectorAll('.menu-item').forEach((link) => {
    if (link.getAttribute('href') === '#') return;
    const url = new URL(link.getAttribute('href'), window.location.href);
    if (url.pathname.split('/').pop() === currentPath && url.search === currentQuery) {
      link.classList.add('is-active');
      link.setAttribute('aria-current', 'page');
    }
  });

  fetch('/api/me', { cache: 'no-store' })
    .then((response) => response.json())
    .then(({ user }) => {
      const isAdmin = user?.role === 'admin';
      sidebarScroll.querySelector('[data-admin-menu]').hidden = !isAdmin;
      sidebarScroll.querySelector('[data-admin-menu-label]').hidden = !isAdmin;
      const employeeAttendanceOverview = sidebarScroll.querySelector('a[href="attendance.html?view=days"]');
      if (employeeAttendanceOverview) employeeAttendanceOverview.hidden = isAdmin;
      const proposalReport = sidebarScroll.querySelector('[data-admin-proposal-report]');
      if (proposalReport) proposalReport.hidden = !isAdmin;
      sidebarScroll.querySelectorAll('a[href^="attendance-overview.html"]').forEach((link) => {
        link.hidden = !isAdmin;
      });
    })
    .catch(() => {
      sidebarScroll.querySelector('[data-admin-menu]').hidden = true;
      sidebarScroll.querySelector('[data-admin-menu-label]').hidden = true;
    });

  const appShell = document.querySelector('.app-shell');
  const sidebarToggle = document.querySelector('[data-sidebar-toggle]');
  const mobileToggle = document.querySelector('[data-mobile-menu-toggle]');
  const backdrop = document.querySelector('[data-mobile-menu-backdrop]');
  if (appShell && !appShell.dataset.sharedMenuBound) {
    appShell.dataset.sharedMenuBound = 'true';
    if (localStorage.getItem('gusa-sidebar-collapsed') === 'true') appShell.classList.add('is-collapsed');
    sidebarToggle?.addEventListener('click', () => {
      const collapsed = appShell.classList.toggle('is-collapsed');
      localStorage.setItem('gusa-sidebar-collapsed', String(collapsed));
    });
    const setMobileMenu = (open) => {
      appShell.classList.toggle('is-mobile-menu-open', open);
      if (backdrop) backdrop.hidden = !open;
      mobileToggle?.setAttribute('aria-expanded', String(open));
    };
    document.addEventListener('click', (event) => {
      const toggle = event.target.closest('[data-mobile-menu-toggle]');
      if (!toggle) return;
      event.preventDefault();
      event.stopPropagation();
      setMobileMenu(!appShell.classList.contains('is-mobile-menu-open'));
    }, true);
    backdrop?.addEventListener('click', () => setMobileMenu(false));
  }
}
