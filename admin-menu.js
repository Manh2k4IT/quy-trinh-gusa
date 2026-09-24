const sidebarScroll = document.querySelector('.sidebar-scroll');

window.speakProposalNotification = (proposal) => {
  if (!('speechSynthesis' in window) || !proposal) return;
  const person = proposal.userName || proposal.email || 'một nhân sự';
  const category = proposal.category ? ` danh mục ${proposal.category}` : ' một danh mục mới';
  const message = `Nhân sự ${person} vừa đề xuất${category} trong đề xuất chung.`;
  window.speechSynthesis.cancel();
  for (let repeat = 0; repeat < 2; repeat += 1) {
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = 'vi-VN';
    utterance.rate = 0.9;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  }
};

function initializeSharedProposalNotifications() {
  if (document.querySelector('.proposal-notification-trigger')) return;
  const notificationButton = document.querySelector('[data-notification-trigger]');
  const notificationMenu = document.querySelector('[data-notification-menu]') || document.querySelector('.notification-menu');
  if (!notificationButton || !notificationMenu) return;
  const notificationCount = notificationButton.querySelector('[data-notification-count]');
  const notificationList = notificationMenu.querySelector('.notification-list');
  let knownIds = new Set(JSON.parse(localStorage.getItem('gusa-proposal-notification-ids') || '[]'));
  let hasLoadedOnce = false;
  let notificationTimer;
  const formatProposal = (proposal) => `${proposal.userName || 'Nhân viên'} vừa gửi ${proposal.type === 'payment' ? 'đề xuất thanh toán' : 'đề xuất chung'}.`;
  const showNotifications = (newProposals) => {
    if (!newProposals.length) return;
    notificationList.innerHTML = newProposals.slice(0, 5).map((proposal) => `<p><b>Đề xuất mới</b><span>${formatProposal(proposal)}</span></p>`).join('');
    if (notificationCount) {
      notificationCount.textContent = String(newProposals.length);
      notificationCount.hidden = false;
    }
    notificationMenu.hidden = false;
    notificationButton.classList.remove('is-notifying');
    void notificationButton.offsetWidth;
    notificationButton.classList.add('is-notifying');
    window.speakProposalNotification(newProposals[0]);
    clearTimeout(notificationTimer);
    notificationTimer = setTimeout(() => {
      notificationMenu.hidden = true;
      if (notificationCount) notificationCount.hidden = true;
      notificationButton.classList.remove('is-notifying');
    }, 5000);
    if ('Notification' in window && Notification.permission === 'granted') new Notification('Có đề xuất mới', { body: formatProposal(newProposals[0]), tag: 'gusa-proposal' });
  };
  notificationButton.addEventListener('click', () => {
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
  });
  const poll = async () => {
    const response = await fetch(`/api/proposals?scope=all&refresh=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) return;
    const nextProposals = (await response.json()).proposals || [];
    const nextIds = new Set(nextProposals.map((proposal) => proposal.id));
    const recentThreshold = Date.now() - 10 * 60 * 1000;
    const newProposals = hasLoadedOnce
      ? nextProposals.filter((proposal) => !knownIds.has(proposal.id) && proposal.status === 'pending')
      : nextProposals.filter((proposal) => proposal.status === 'pending' && new Date(proposal.createdAt).getTime() >= recentThreshold);
    knownIds = nextIds;
    hasLoadedOnce = true;
    localStorage.setItem('gusa-proposal-notification-ids', JSON.stringify([...knownIds]));
    showNotifications(newProposals);
  };
  if (notificationCount) notificationCount.hidden = true;
  poll().catch(() => {});
  setInterval(() => poll().catch(() => {}), 3000);
}

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
      <a class="menu-item" href="payment-proposal.html"><span class="menu-icon">₫</span><span>Đề xuất thanh toán</span></a>
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
      if (user) {
        document.querySelectorAll('[data-user-name]').forEach((element) => {
          element.textContent = user.name || user.email || 'Tài khoản Google';
        });
        document.querySelectorAll('[data-user-role], [data-profile-role]').forEach((element) => {
          element.textContent = user.role === 'admin' ? 'Quản trị viên' : user.role === 'ceo' ? 'CEO' : 'Nhân viên';
        });
        const roleChipLabel = user.role === 'ceo' ? 'CEO' : user.role === 'admin' ? 'Quản trị' : 'Nhân viên';
        document.querySelectorAll('.role-chip').forEach((button) => {
          const originalRole = button.dataset.role || button.textContent.trim();
          button.dataset.role = originalRole;
          const matchesRole = user.role === 'employee'
            ? originalRole === 'Nhân viên'
            : originalRole === 'Quản trị' || originalRole === 'CEO';
          button.textContent = matchesRole ? roleChipLabel : originalRole;
          button.hidden = !matchesRole;
          button.classList.toggle('is-selected', matchesRole);
        });
        if (user.picture) {
          document.querySelectorAll('[data-user-avatar], [data-top-avatar], [data-profile-avatar]').forEach((element) => {
            const image = document.createElement('img');
            image.src = user.picture;
            image.referrerPolicy = 'no-referrer';
            image.alt = `Ảnh đại diện Gmail của ${user.name || user.email || 'người dùng'}`;
            image.loading = 'eager';
            image.decoding = 'async';
            image.onerror = () => {
              const fallback = document.createElement('span');
              fallback.className = 'avatar-fallback';
              fallback.textContent = (user.name || user.email || 'U').charAt(0).toUpperCase();
              element.replaceChildren(fallback);
            };
            element.replaceChildren(image);
          });
        }
        const profileName = document.querySelector('[data-profile-name]');
        const profileEmail = document.querySelector('[data-profile-email]');
        if (profileName) profileName.textContent = user.name || 'Tài khoản Google';
        if (profileEmail) profileEmail.textContent = user.email || '';
      }
      const isAdmin = user?.role === 'admin' || user?.role === 'ceo';
      const isCeo = user?.role === 'ceo';
      sidebarScroll.querySelector('[data-admin-menu]').hidden = !isAdmin;
      sidebarScroll.querySelector('[data-admin-menu-label]').hidden = !isAdmin;
      const employeeAttendanceOverview = sidebarScroll.querySelector('a[href="attendance.html?view=days"]');
      if (employeeAttendanceOverview) employeeAttendanceOverview.hidden = isAdmin;
      const proposalReport = sidebarScroll.querySelector('[data-admin-proposal-report]');
      if (proposalReport) proposalReport.hidden = !isAdmin;
      sidebarScroll.querySelectorAll('a[href^="attendance-overview.html"]').forEach((link) => {
        link.hidden = !isAdmin;
      });
      if (isCeo) {
        sidebarScroll.querySelectorAll('a[href="attendance.html"], a[href="attendance.html?view=online"], a[href="proposals.html"], a[href="payment-proposal.html"]').forEach((link) => {
          link.hidden = true;
        });
        sidebarScroll.querySelectorAll('[data-admin-menu] .menu-item[href="#"]').forEach((link) => {
          link.hidden = true;
        });
      }
      if (isAdmin) initializeSharedProposalNotifications();
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
