const sidebarScroll = document.querySelector('.sidebar-scroll');
const proposalVoiceAudios = {
  general: new Audio('ban_co_de_xuat_moi_tu_nhan_su_trong_danh_muc_de_1e969bce-ab7b-4812-a7cd-a61a981e15cd.mp3'),
  payment: new Audio('ban_co_de_xuat_moi_tu_nhan_su_trong_danh_muc_de_b5e06310-5fad-4e0d-a280-47d4bca56183.mp3'),
};
Object.values(proposalVoiceAudios).forEach((audio) => { audio.preload = 'auto'; });
let proposalAudioEnabled = localStorage.getItem('gusa-proposal-audio-enabled') !== 'false';

window.playProposalVoiceTest = () => {
  const audio = proposalVoiceAudios.general;
  audio.pause();
  audio.currentTime = 0;
  return audio.play().then(() => {
    proposalAudioEnabled = true;
    localStorage.setItem('gusa-proposal-audio-enabled', 'true');
  });
};

function showProposalPermissionPrompt(user, force = false) {
  const accountKey = user?.email || 'default';
  const promptSeenKey = `gusa-proposal-permission-prompt-seen:${accountKey}`;
  if (document.querySelector('[data-proposal-permission-prompt]') || localStorage.getItem(promptSeenKey) === 'true') return;
  const soundState = proposalAudioEnabled ? 'granted' : 'default';
  if (soundState === 'granted' && !force) return;
  localStorage.setItem(promptSeenKey, 'true');
  const prompt = document.createElement('div');
  prompt.className = 'proposal-permission-prompt';
  prompt.dataset.proposalPermissionPrompt = '';
  prompt.innerHTML = `<div class="proposal-permission-card" role="dialog" aria-modal="true" aria-labelledby="proposal-permission-title"><strong id="proposal-permission-title">Bật âm thanh thông báo</strong><p>Bấm nút bên dưới để bật file voice thông báo đề xuất trên thiết bị này.</p><div class="proposal-permission-status"></div><div class="proposal-permission-actions"><button type="button" class="proposal-permission-enable">Bật âm thanh và nghe thử</button></div></div>`;
  document.body.append(prompt);
  const status = prompt.querySelector('.proposal-permission-status');
  const updateStatus = () => {
    status.textContent = 'Âm thanh của website đang bị tắt hoặc trình duyệt đang chặn phát voice. Hãy bật mục Âm thanh trong Cài đặt trang web rồi thử lại.';
  };
  const enable = async () => {
    try { await window.playProposalVoiceTest?.(); } catch { status.textContent = 'Trình duyệt đang chặn âm thanh. Hãy kiểm tra biểu tượng loa trên tab hoặc cài đặt trang web.'; return; }
    updateStatus();
    if (proposalAudioEnabled) prompt.remove();
  };
  prompt.querySelector('.proposal-permission-enable').addEventListener('click', enable);
  updateStatus();
}

window.showProposalPermissionPrompt = showProposalPermissionPrompt;

window.speakProposalNotification = (proposal) => {
  if (!proposal || !proposalAudioEnabled) return;
  const proposalVoiceAudio = proposal.type === 'payment' ? proposalVoiceAudios.payment : proposalVoiceAudios.general;
  let completedPlays = 0;
  proposalVoiceAudio.pause();
  proposalVoiceAudio.currentTime = 0;
  proposalVoiceAudio.onended = () => {
    completedPlays += 1;
    if (completedPlays >= 2) {
      proposalVoiceAudio.onended = null;
      return;
    }
    proposalVoiceAudio.currentTime = 0;
    proposalVoiceAudio.play().catch(() => {});
  };
  proposalVoiceAudio.play().catch(() => {
    showProposalPermissionPrompt(undefined, true);
  });
};

window.claimProposalNotification = async (proposalId) => {
  const claim = async () => {
    const handledIds = new Set(JSON.parse(localStorage.getItem('gusa-proposal-notification-ids') || '[]'));
    if (handledIds.has(proposalId)) return false;
    handledIds.add(proposalId);
    localStorage.setItem('gusa-proposal-notification-ids', JSON.stringify([...handledIds]));
    return true;
  };
  if (navigator.locks?.request) {
    return navigator.locks.request(`gusa-proposal-notification:${proposalId}`, { ifAvailable: true }, async (lock) => lock ? claim() : false);
  }
  return claim();
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
  const showNotifications = async (newProposals) => {
    if (!newProposals.length) return;
    if (!(await window.claimProposalNotification(newProposals[0].id))) return;
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
    const storedIds = new Set(JSON.parse(localStorage.getItem('gusa-proposal-notification-ids') || '[]'));
    const handledIds = new Set([...knownIds, ...storedIds]);
    const newProposals = hasLoadedOnce
      ? nextProposals.filter((proposal) => !handledIds.has(proposal.id) && proposal.status === 'pending')
      : [];
    knownIds = hasLoadedOnce ? handledIds : new Set([...handledIds, ...nextIds]);
    hasLoadedOnce = true;
    localStorage.setItem('gusa-proposal-notification-ids', JSON.stringify([...knownIds]));
    showNotifications(newProposals);
  };
  if (notificationCount) notificationCount.hidden = true;
  poll().catch(() => {});
  if ('EventSource' in window) {
    const proposalEvents = new EventSource('/api/proposals/events');
    proposalEvents.addEventListener('proposal', (event) => {
      try {
        const proposal = JSON.parse(event.data);
        if (proposal.status !== 'pending') return;
        if (knownIds.has(proposal.id)) return;
        knownIds.add(proposal.id);
        showNotifications([proposal]).catch(() => {});
      } catch {}
    });
  }
  setInterval(() => poll().catch(() => {}), 30000);
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
    <nav class="menu"><a class="menu-item" href="interface-settings.html"><span class="menu-icon">⚙</span><span>Cài đặt giao diện</span></a><a class="menu-item" href="interface-settings.html#audio-permission"><span class="menu-icon">♬</span><span>Cài đặt quyền âm thanh</span></a></nav>
    <p class="menu-label" data-admin-menu-label>QUẢN TRỊ</p>
    <nav class="menu" aria-label="Menu quản trị" data-admin-menu>
      <a class="menu-item" href="user-management.html"><span class="menu-icon">⚙</span><span>Quản lý user</span></a>
      <a class="menu-item" href="#"><span class="menu-icon">▥</span><span>Thùng rác</span></a>
      <a class="menu-item" href="#"><span class="menu-icon">◉</span><span>Nhật ký lỗi</span></a>
    </nav>`;

  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  const currentQuery = window.location.search;
  const currentHash = window.location.hash;
  sidebarScroll.querySelectorAll('.menu-item').forEach((link) => {
    const href = link.getAttribute('href');
    if (!href || href === '#') return;
    const url = new URL(href, window.location.href);
    const samePath = url.pathname.split('/').pop() === currentPath;
    const sameQuery = url.search === currentQuery;
    const targetHash = url.hash || '';
    const matchesCurrentSection = targetHash ? targetHash === currentHash : !currentHash;
    if (samePath && sameQuery && matchesCurrentSection) {
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
      if (isAdmin) {
        initializeSharedProposalNotifications();
      }
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
    document.addEventListener('click', (event) => {
      if (event.target.closest('.menu-item')) setMobileMenu(false);
    });
    backdrop?.addEventListener('click', () => setMobileMenu(false));
  }
}
