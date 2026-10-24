const sidebarScroll = document.querySelector('.sidebar-scroll');

function applySharedAppearance() {
  try {
    const theme = localStorage.getItem('gusa-theme') === 'dark' ? 'dark' : 'light';
    const storedPalette = JSON.parse(localStorage.getItem('gusa-palette') || 'null');
    if (storedPalette && (!/^#[0-9a-f]{6}$/i.test(storedPalette.primary) || !/^#[0-9a-f]{6}$/i.test(storedPalette.surface))) {
      throw new Error('Bảng màu đã lưu không hợp lệ.');
    }
    const primary = storedPalette?.primary || '#174b8e';
    const surface = storedPalette?.surface || '#eaf2fa';
    document.body.dataset.theme = theme;
    document.documentElement.style.setProperty('--navy', primary);
    document.documentElement.style.setProperty('--blue-100', surface);
    document.documentElement.style.setProperty('--active', surface);
    document.querySelectorAll('[data-interface-theme-toggle]').forEach((button) => {
      button.setAttribute('aria-checked', String(theme === 'dark'));
      button.classList.toggle('is-on', theme === 'dark');
    });
    const themeStatus = document.querySelector('[data-interface-theme-status]');
    if (themeStatus) themeStatus.textContent = theme === 'dark' ? 'Đang bật' : 'Đang tắt';
    document.querySelectorAll('[data-theme-primary]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.themePrimary === primary));
    });
    const audioEnabled = localStorage.getItem('gusa-proposal-audio-enabled') !== 'false';
    document.querySelectorAll('[data-audio-permission-button]').forEach((button) => {
      button.setAttribute('aria-checked', String(audioEnabled));
      button.classList.toggle('is-on', audioEnabled);
    });
  } catch (error) {
    console.error('Không áp dụng được cài đặt giao diện.', error);
    let notice = document.querySelector('[data-appearance-error]');
    if (!notice) {
      notice = document.createElement('p');
      notice.dataset.appearanceError = '';
      notice.setAttribute('role', 'alert');
      document.querySelector('.workspace')?.prepend(notice);
    }
    notice.textContent = 'Không đọc được cài đặt giao diện. Vui lòng chọn lại cài đặt trên thiết bị này.';
  }
}

const sharedAppearanceStyles = document.createElement('link');
sharedAppearanceStyles.rel = 'stylesheet';
sharedAppearanceStyles.href = '/shared-appearance.css?v=20261007-1';
document.head.append(sharedAppearanceStyles);
applySharedAppearance();

// Thanh trên cùng: thêm chuông thông báo, nút sáng/tối và bảng màu cho các trang chưa có.
function ensureTopActions() {
  const avatar = document.querySelector('.top-actions [data-top-avatar]');
  if (!avatar || document.querySelector('[data-notification-trigger]')) return;
  avatar.insertAdjacentHTML('beforebegin', '<button class="top-icon notification-icon" type="button" data-notification-trigger aria-label="Thông báo"><svg class="bell-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg><b data-notification-count hidden></b></button>'
    + '<button class="top-icon" type="button" data-shared-theme-trigger aria-label="Đổi giao diện sáng tối"><svg class="theme-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 15.5A8.5 8.5 0 0 1 8.5 3.5 8.5 8.5 0 1 0 20.5 15.5Z" /></svg></button>'
    + '<a class="top-icon" href="interface-settings.html" aria-label="Đổi màu giao diện"><svg class="palette-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 0 0 0 18h1.2a1.8 1.8 0 0 0 0-3.6h-.7a1.8 1.8 0 0 1 0-3.6H15a6 6 0 0 0 0-12H12Z" /><circle cx="7.5" cy="10" r="1" /><circle cx="10" cy="6.8" r="1" /><circle cx="14" cy="6.8" r="1" /></svg></a>');
  const menu = document.createElement('div');
  menu.className = 'notification-menu';
  menu.dataset.notificationMenu = '';
  menu.hidden = true;
  menu.innerHTML = '<strong>Thông báo</strong><div class="notification-list"><p class="notification-empty">Đang tải thông báo...</p></div>';
  (document.querySelector('.workspace') || document.body).append(menu);
  const bell = document.querySelector('[data-notification-trigger]');
  bell.addEventListener('click', (event) => {
    event.stopPropagation();
    menu.hidden = !menu.hidden;
  });
  document.addEventListener('click', (event) => {
    if (!menu.contains(event.target) && !event.target.closest('[data-notification-trigger]')) menu.hidden = true;
  });
  document.querySelector('[data-shared-theme-trigger]').addEventListener('click', () => {
    try { localStorage.setItem('gusa-theme', document.body.dataset.theme === 'dark' ? 'light' : 'dark'); } catch {}
    applySharedAppearance();
  });
}
ensureTopActions();

// Bấm ảnh đại diện góc trên: mở khung thông tin tài khoản (cho các trang chưa có sẵn).
function ensureProfileMenu() {
  const avatar = document.querySelector('.topbar [data-top-avatar]');
  if (!avatar || document.querySelector('.profile-menu')) return;
  const menu = document.createElement('div');
  menu.className = 'profile-menu';
  menu.hidden = true;
  menu.innerHTML = '<div class="profile-header"><div class="profile-avatar" data-profile-avatar>B</div><div><strong data-profile-name>Tài khoản Google</strong><small data-profile-email></small></div></div><div class="profile-role" data-profile-role>Nhân viên</div><a class="profile-logout" href="/auth/logout">Đăng xuất</a>';
  (document.querySelector('.workspace') || document.body).append(menu);
  avatar.addEventListener('click', (event) => {
    event.stopPropagation();
    menu.hidden = !menu.hidden;
    document.querySelectorAll('[data-notification-menu], .notification-menu').forEach((element) => { element.hidden = true; });
  });
  document.addEventListener('click', (event) => {
    if (!menu.contains(event.target) && !event.target.closest('[data-top-avatar]')) menu.hidden = true;
  });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') menu.hidden = true; });
}
ensureProfileMenu();

// Biểu tượng thanh trên cùng (chuông, sáng/tối, bảng màu): bộ nét đều, to và rõ hơn.
const topIconPaths = {
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />',
  theme: '<g class="icon-moon"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" /></g><g class="icon-sun"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></g>',
  palette: '<path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.65-.75 1.65-1.69 0-.44-.18-.84-.44-1.13-.29-.29-.44-.65-.44-1.13a1.64 1.64 0 0 1 1.67-1.67h2c3.05 0 5.56-2.5 5.56-5.55C21.97 6.01 17.46 2 12 2Z" /><circle cx="13.5" cy="6.5" r="1.2" /><circle cx="17.5" cy="10.5" r="1.2" /><circle cx="8.5" cy="7.5" r="1.2" /><circle cx="6.5" cy="12.5" r="1.2" />',
};
function upgradeTopIcons() {
  [['.bell-icon', 'bell'], ['.theme-icon', 'theme'], ['.palette-icon', 'palette']].forEach(([selector, name]) => {
    document.querySelectorAll(`.topbar ${selector}`).forEach((svg) => {
      if (svg.dataset.iconSet === name) return;
      svg.dataset.iconSet = name;
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.innerHTML = topIconPaths[name];
    });
  });
}
upgradeTopIcons();
window.addEventListener('load', upgradeTopIcons);

// Trang có thanh trên cùng riêng (vd. Báo cáo đề xuất) tự tạo chuông sau khi trang tải:
// bổ sung nút sáng/tối, bảng màu và ảnh đại diện cho đồng bộ với các trang khác.
function completeTopBar() {
  const topbar = document.querySelector('.topbar');
  if (!topbar || topbar.querySelector('[data-top-avatar]')) return;
  let actions = topbar.querySelector('.top-actions');
  if (!actions) {
    actions = document.createElement('div');
    actions.className = 'top-actions';
    topbar.append(actions);
  }
  const bell = topbar.querySelector('[data-notification-trigger]');
  if (bell) actions.append(bell);
  actions.insertAdjacentHTML('beforeend', '<button class="top-icon" type="button" data-shared-theme-trigger aria-label="Đổi giao diện sáng tối"><svg class="theme-icon" viewBox="0 0 24 24" aria-hidden="true"></svg></button>'
    + '<a class="top-icon" href="interface-settings.html" aria-label="Đổi màu giao diện"><svg class="palette-icon" viewBox="0 0 24 24" aria-hidden="true"></svg></a>'
    + '<button class="top-avatar" type="button" data-top-avatar aria-label="Tài khoản">B</button>');
  actions.querySelector('[data-shared-theme-trigger]').addEventListener('click', () => {
    try { localStorage.setItem('gusa-theme', document.body.dataset.theme === 'dark' ? 'light' : 'dark'); } catch {}
    applySharedAppearance();
  });
  upgradeTopIcons();
  ensureProfileMenu();
  fetch('/api/me', { cache: 'no-store' }).then((response) => response.json()).then(({ user }) => {
    if (!user) return;
    const initial = (user.name || user.email || 'U').charAt(0).toUpperCase();
    document.querySelectorAll('[data-top-avatar], [data-profile-avatar]').forEach((element) => {
      if (!user.picture) {
        element.textContent = initial;
        return;
      }
      const image = document.createElement('img');
      image.src = user.picture;
      image.referrerPolicy = 'no-referrer';
      image.alt = `Ảnh đại diện Gmail của ${user.name || user.email}`;
      image.onerror = () => { element.textContent = initial; };
      element.replaceChildren(image);
    });
    const name = document.querySelector('.profile-menu [data-profile-name]');
    if (name) name.textContent = user.name || user.email || 'Tài khoản Google';
    const email = document.querySelector('.profile-menu [data-profile-email]');
    if (email) email.textContent = user.email || '';
    const role = document.querySelector('.profile-menu [data-profile-role]');
    if (role) role.textContent = document.querySelector('[data-user-role]')?.textContent || role.textContent;
  }).catch(() => {});
}
window.addEventListener('load', completeTopBar);
window.addEventListener('storage', (event) => {
  if (event.key === null || ['gusa-theme', 'gusa-palette', 'gusa-proposal-audio-enabled'].includes(event.key)) applySharedAppearance();
});
window.addEventListener('pageshow', applySharedAppearance);

function initializeBrowserNavigation() {
  const topbar = document.querySelector('.topbar');
  if (!topbar || !window.desktopSettings?.isDesktop || document.querySelector('[data-browser-navigation]')) return;
  const navigation = document.createElement('nav');
  navigation.className = 'browser-navigation';
  navigation.dataset.browserNavigation = '';
  navigation.setAttribute('aria-label', 'Điều hướng trang');
  navigation.innerHTML = `
    <button type="button" data-browser-back aria-label="Quay lại" title="Quay lại"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg></button>
    <button type="button" data-browser-reload aria-label="Tải lại trang" title="Tải lại trang"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 1 0 1 4" /><path d="M20 5v6h-6" /></svg></button>
    <button type="button" data-browser-home aria-label="Về trang chủ" title="Về trang chủ"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10M9 20v-6h6v6" /></svg></button>`;
  topbar.insertBefore(navigation, topbar.firstChild);
  navigation.querySelector('[data-browser-back]').addEventListener('click', () => window.history.back());
  navigation.querySelector('[data-browser-reload]').addEventListener('click', () => window.location.reload());
  navigation.querySelector('[data-browser-home]').addEventListener('click', () => { window.location.href = 'organization-chart.html'; });
}

initializeBrowserNavigation();
const proposalVoiceAudios = {
  general: new Audio('ban_co_de_xuat_moi_tu_nhan_su_trong_danh_muc_de_1e969bce-ab7b-4812-a7cd-a61a981e15cd.mp3'),
  leave: new Audio('ban_co_de_xuat_nghi_co_phep_tu_nhan_su_83c37535-136e-4f99-8602-573ecd286adb.mp3'),
  unauthorizedLeave: new Audio('ban_co_de_xuat_nghi_khong_phep_tu_nhan_su_c3d170f6-08a2-470e-9fd4-44fa8e15a6d5.mp3'),
  late: new Audio('ban_co_de_xuat_di_tre_tu_nhan_su_8a90c570-7e7e-4958-831a-2f1d2b366c80.mp3'),
  earlyLeave: new Audio('ban_co_de_xuat_ve_som_tu_nhan_su_6a1da0c4-340f-44d5-8fcb-55921a3179c2.mp3'),
  halfDay: new Audio('ban_co_de_xuat_lam_mot_phan_hai_ngay_tu_nhan_su_fd35d92f-5a9f-437e-a0f0-4df68e3fbd14.mp3'),
  payment: new Audio('ban_co_de_xuat_moi_tu_nhan_su_trong_danh_muc_de_b5e06310-5fad-4e0d-a280-47d4bca56183.mp3'),
  paymentDirectToAccountant: new Audio('ban_co_de_xuat_thanh_toan_truc_tiep_tu_nhan_su_59b1405d-69b2-4eb7-aa6e-81bd7f8c45c3.mp3'),
  paymentApprovedByCeo: new Audio('ban_co_de_xuat_thanh_toan_da_duoc_duyet_tu_ceo_c69e7e0e-7155-40ae-8f27-cd3b676a2493.mp3'),
  paymentConfirmedByAccountant: new Audio('ke_toan_da_xac_nhan_don_duyet_cua_ban_8e3f1f90-f4ef-49c8-b578-cb2a2b1e3806.mp3'),
  approved: new Audio('de_xuat_cua_ban_da_duoc_duyet_0f638daa-fee3-4942-adb5-f8242adc7a72 (1).mp3'),
  rejected: new Audio('de_xuat_cua_ban_da_bi_tu_choi_2a0d6172-489b-4f49-aac2-54f0f765504b.mp3'),
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
  if (window.Capacitor?.getPlatform?.() === 'android') return;
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

function playProposalVoice(proposalVoiceAudio) {
  proposalAudioEnabled = localStorage.getItem('gusa-proposal-audio-enabled') !== 'false';
  if (!proposalVoiceAudio || !proposalAudioEnabled) return;
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
}

window.speakProposalNotification = (proposal) => {
  if (!proposal) return;
  if (proposal.type === 'late') {
    if (!window.Capacitor?.isNativePlatform?.()) playProposalVoice(proposalVoiceAudios.late);
    return;
  }
  if (proposal.type === 'early-leave') {
    if (!window.Capacitor?.isNativePlatform?.()) playProposalVoice(proposalVoiceAudios.earlyLeave);
    return;
  }
  if (proposal.type === 'half-day') {
    if (!window.Capacitor?.isNativePlatform?.()) playProposalVoice(proposalVoiceAudios.halfDay);
    return;
  }
  if (proposal.type === 'leave') {
    if (!window.Capacitor?.isNativePlatform?.()) playProposalVoice(proposalVoiceAudios.leave);
    return;
  }
  if (proposal.type === 'unauthorized-leave') {
    if (!window.Capacitor?.isNativePlatform?.()) playProposalVoice(proposalVoiceAudios.unauthorizedLeave);
    return;
  }
  if (proposal.type === 'payment' && proposal.paymentFlow === 'ceo' && proposal.paymentStage === 'accounting') {
    if (window.Capacitor?.isNativePlatform?.()) return;
    playProposalVoice(proposalVoiceAudios.paymentApprovedByCeo);
    return;
  }
  if (proposal.type === 'payment' && proposal.paymentFlow === 'accountant') {
    if (window.Capacitor?.isNativePlatform?.()) return;
    playProposalVoice(proposalVoiceAudios.paymentDirectToAccountant);
    return;
  }
  playProposalVoice(proposal.type === 'payment' ? proposalVoiceAudios.payment : proposalVoiceAudios.general);
};

window.speakApprovedProposal = () => playProposalVoice(proposalVoiceAudios.approved);
window.speakRejectedProposal = () => playProposalVoice(proposalVoiceAudios.rejected);
window.speakPaymentConfirmedByAccountant = () => {
  if (!window.Capacitor?.isNativePlatform?.()) playProposalVoice(proposalVoiceAudios.paymentConfirmedByAccountant);
};
let proposalRejectionNoticeTimer;
let proposalSuccessToastTimer;
window.showProposalSuccessToast = (message = 'Đã gửi đề xuất thành công') => {
  document.querySelector('[data-proposal-success-toast]')?.remove();
  const toast = document.createElement('div');
  toast.className = 'proposal-success-toast';
  toast.dataset.proposalSuccessToast = '';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  const checkmark = document.createElement('span');
  checkmark.className = 'proposal-success-check';
  checkmark.setAttribute('aria-hidden', 'true');
  checkmark.textContent = '✓';
  const label = document.createElement('span');
  label.textContent = message;
  toast.append(checkmark, label);
  document.body.append(toast);
  requestAnimationFrame(() => toast.classList.add('is-visible'));
  clearTimeout(proposalSuccessToastTimer);
  proposalSuccessToastTimer = setTimeout(() => {
    toast.classList.remove('is-visible');
    setTimeout(() => toast.remove(), 220);
  }, 2600);
};
window.showProposalRejectionNotice = (proposal) => {
  if (!proposal?.rejectionReason) return;
  let notice = document.querySelector('[data-proposal-rejection-notice]');
  if (!notice) {
    notice = document.createElement('aside');
    notice.className = 'proposal-rejection-notice';
    notice.dataset.proposalRejectionNotice = '';
    notice.setAttribute('role', 'status');
    notice.innerHTML = '<div class="proposal-rejection-notice-heading"><strong>Đề xuất của bạn đã bị từ chối</strong><button type="button" aria-label="Đóng">×</button></div><p></p>';
    notice.querySelector('button').addEventListener('click', () => notice.remove());
    document.body.append(notice);
  }
  notice.querySelector('p').textContent = proposal.rejectionReason;
  clearTimeout(proposalRejectionNoticeTimer);
  proposalRejectionNoticeTimer = setTimeout(() => notice.remove(), 15000);
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
  const notificationCount = notificationButton?.querySelector('[data-notification-count]');
  const notificationList = notificationMenu?.querySelector('.notification-list');
  let knownIds = new Set(JSON.parse(localStorage.getItem('gusa-proposal-notification-ids') || '[]'));
  let hasLoadedOnce = false;
  let notificationTimer;
  const formatProposal = (proposal) => `${proposal.userName || 'Nhân viên'} vừa gửi ${proposal.type === 'payment' ? `đề xuất thanh toán (${proposal.paymentFlow === 'accountant' ? 'Kế toán' : 'CEO'})` : 'đề xuất nghỉ phép và giờ làm'}.`;
  const showNotifications = async (newProposals) => {
    if (!newProposals.length) return;
    if (!(await window.claimProposalNotification(newProposals[0].id))) return;
    if (notificationList) notificationList.innerHTML = newProposals.slice(0, 5).map((proposal) => `<p><b>Đề xuất mới</b><span>${formatProposal(proposal)}</span></p>`).join('');
    if (notificationCount) {
      notificationCount.textContent = String(newProposals.length);
      notificationCount.hidden = false;
    }
    if (notificationMenu) notificationMenu.hidden = false;
    if (notificationButton) {
      notificationButton.classList.remove('is-notifying');
      void notificationButton.offsetWidth;
      notificationButton.classList.add('is-notifying');
    }
    window.speakProposalNotification?.(newProposals[0]);
    clearTimeout(notificationTimer);
    notificationTimer = setTimeout(() => {
      if (notificationMenu) notificationMenu.hidden = true;
      notificationButton?.classList.remove('is-notifying');
      window.refreshNotifications?.();
    }, 5000);
    if (window.desktopSettings?.notify) {
      window.desktopSettings.notify({ title: 'Có đề xuất mới', body: formatProposal(newProposals[0]) });
    } else if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification('Có đề xuất mới', { body: formatProposal(newProposals[0]), tag: 'gusa-proposal' });
      notification.onclick = () => window.desktopSettings?.showApp?.();
    }
  };
  notificationButton?.addEventListener('click', () => {
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
  });
  const poll = async () => {
    const response = await fetch(`/api/proposals?scope=review-queue&refresh=${Date.now()}`, { cache: 'no-store' });
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

function initializeProposalApprovalNotifications() {
  if (!('EventSource' in window) || window.proposalApprovalEvents) return;
  window.proposalApprovalEvents = new EventSource('/api/proposals/events');
  window.proposalApprovalEvents.addEventListener('proposal-status', (event) => {
    try {
      const proposal = JSON.parse(event.data);
      if (proposal.notificationKind === 'payment-accounting-confirmed') window.speakPaymentConfirmedByAccountant?.(proposal);
      else if (proposal.notificationKind === 'payment-management-approved') window.speakApprovedProposal?.(proposal);
      else if (proposal.status === 'approved') window.speakApprovedProposal?.(proposal);
      else if (proposal.status === 'rejected') {
        window.speakRejectedProposal?.(proposal);
        window.showProposalRejectionNotice?.(proposal);
      }
    } catch {}
  });
}

// Chuông thông báo: việc đang chờ người dùng và kết quả đề xuất của họ.
function initializeNotificationCenter(user) {
  const button = document.querySelector('[data-notification-trigger]');
  const menu = document.querySelector('[data-notification-menu]') || document.querySelector('.notification-menu');
  const list = menu?.querySelector('.notification-list');
  if (!button || !list || window.refreshNotifications) return;
  const count = button.querySelector('[data-notification-count]');
  const seenKey = `gusa-seen-notifications-${user?.id || user?.email || ''}`;
  const readSeen = () => { try { return new Set(JSON.parse(localStorage.getItem(seenKey) || '[]')); } catch { return new Set(); } };
  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  let items = [];
  const render = () => {
    const seen = readSeen();
    const unread = items.filter((item) => item.kind === 'action' || !seen.has(item.id));
    list.innerHTML = items.length
      ? items.map((item) => `<a class="notification-link${item.kind === 'action' || !seen.has(item.id) ? ' is-unread' : ''}" href="${escape(item.url)}"><p><b>${escape(item.title)}</b><span>${escape(item.text)}</span></p></a>`).join('')
      : '<p class="notification-empty">Không có thông báo mới.</p>';
    if (count) {
      count.textContent = unread.length > 99 ? '99+' : String(unread.length);
      count.hidden = !unread.length;
    }
    renderMenuBadges(unread);
    document.dispatchEvent(new CustomEvent('gusa:notifications', { detail: { items } }));
  };
  // Mục menu nhận chấm đỏ theo trang mà thông báo dẫn tới (việc sản xuất đã có chấm riêng ở menu Quy Trình).
  const menuTargets = { '/user-management.html': 'user-management.html', '/recruitment.html': 'recruitment.html', '/proposals.html': 'proposal-choice.html', '/payment-proposal.html': 'proposal-choice.html' };
  const renderMenuBadges = (unread) => {
    const totals = {};
    unread.forEach((item) => {
      const href = menuTargets[new URL(item.url, location.origin).pathname];
      if (href) totals[href] = (totals[href] || 0) + (item.count || 1);
    });
    new Set(Object.values(menuTargets)).forEach((href) => {
      document.querySelectorAll(`.menu-item[href="${href}"] .menu-icon`).forEach((icon) => {
        let badge = icon.querySelector(':scope > [data-menu-badge]');
        if (!totals[href]) return badge?.remove();
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'notification-badge';
          badge.dataset.menuBadge = '';
          icon.append(badge);
        }
        badge.textContent = totals[href] > 99 ? '99+' : String(totals[href]);
      });
    });
  };
  window.refreshNotifications = () => fetch('/api/notifications', { cache: 'no-store' })
    .then((response) => response.ok ? response.json() : { items: [] })
    .then((data) => { items = data.items || []; render(); })
    .catch(() => {});
  // Mở chuông là đã xem các thông báo kết quả (việc cần làm vẫn giữ số cho đến khi xử lý xong).
  button.addEventListener('click', () => {
    const seen = readSeen();
    items.filter((item) => item.kind === 'update').forEach((item) => seen.add(item.id));
    try { localStorage.setItem(seenKey, JSON.stringify([...seen].slice(-200))); } catch {}
    setTimeout(render, 1500);
  });
  window.refreshNotifications();
  ['production', 'proposal', 'proposal-status'].forEach((type) => window.proposalApprovalEvents?.addEventListener(type, () => window.refreshNotifications()));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) window.refreshNotifications(); });
  setInterval(() => { if (!document.hidden) window.refreshNotifications(); }, 60000);
}

// Chấm đỏ mục Báo cáo: tổng số mục mới/cập nhật chưa xem — cùng cách đếm với các thẻ trong trang Báo cáo.
function initializeReportMenuBadge() {
  if (window.refreshReportMenuBadge) return;
  const reportKeys = ['online', 'late', 'overview', 'personnel', 'payment'];
  const setBadge = (count) => {
    document.querySelectorAll('.menu-item[href="report-choice.html"] .menu-icon').forEach((icon) => {
      let badge = icon.querySelector(':scope > [data-report-menu-badge]');
      if (!count) return badge?.remove();
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'notification-badge';
        badge.dataset.reportMenuBadge = '';
        icon.append(badge);
      }
      badge.textContent = count > 99 ? '99+' : String(count);
      badge.setAttribute('aria-label', `${count} mục báo cáo mới chưa xem`);
    });
  };
  let summary = null;
  const render = () => {
    if (!summary) return;
    let total = 0;
    reportKeys.filter((key) => Array.isArray(summary.reports[key])).forEach((key) => {
      let seen = {};
      try { seen = JSON.parse(localStorage.getItem(`gusa-report-seen:${encodeURIComponent(summary.accountId)}:${key}`) || '{}') || {}; } catch {}
      total += summary.reports[key].filter((item) => seen[item.id] !== item.version).length;
    });
    setBadge(total);
  };
  window.refreshReportMenuBadge = () => fetch('/api/report-notifications', { cache: 'no-store' })
    .then((response) => (response.ok ? response.json() : null))
    .then((data) => { summary = data; render(); })
    .catch(() => {});
  window.refreshReportMenuBadge();
  ['proposal', 'proposal-status'].forEach((type) => window.proposalApprovalEvents?.addEventListener(type, () => window.refreshReportMenuBadge()));
  window.addEventListener('storage', (event) => { if (event.key === null || event.key.startsWith('gusa-report-seen:')) render(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) window.refreshReportMenuBadge(); });
  setInterval(() => { if (!document.hidden) window.refreshReportMenuBadge(); }, 30000);
  // Trang báo cáo đánh dấu đã xem trong cùng tab: cập nhật ngay.
  const markSeen = window.GusaReportNotifications?.markSeen;
  if (markSeen) window.GusaReportNotifications.markSeen = (snapshot) => { markSeen(snapshot); render(); };
}

// Chấm đỏ: số hồ sơ sản xuất đang chờ người dùng xử lý.
function initializeProductionBadge() {
  if (window.refreshProductionBadge) return;
  const baseTitle = document.title.replace(/^\(\d+\) /, '');
  const setBadge = (host, count) => {
    if (!host) return;
    let badge = host.querySelector(':scope > [data-production-badge]');
    if (!count) return badge?.remove();
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'notification-badge';
      badge.dataset.productionBadge = '';
      host.append(badge);
    }
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.setAttribute('aria-label', `${count} việc đang chờ bạn xử lý`);
  };
  let pending = null;
  window.refreshProductionBadge = () => {
    pending ||= fetch('/api/production/count', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : { count: 0 })
      .then(({ count }) => {
        document.querySelectorAll('.menu-item[href="process-choice.html"] .menu-icon').forEach((icon) => setBadge(icon, count));
        document.querySelectorAll('.attendance-choice-card[href="production.html"]').forEach((card) => setBadge(card, count));
        document.title = count ? `(${count}) ${baseTitle}` : baseTitle;
      })
      .catch(() => {})
      .finally(() => { pending = null; });
    return pending;
  };
  window.refreshProductionBadge();
  window.proposalApprovalEvents?.addEventListener('production', () => {
    window.refreshProductionBadge();
    document.dispatchEvent(new Event('gusa:production-changed'));
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) window.refreshProductionBadge(); });
  setInterval(() => { if (!document.hidden) window.refreshProductionBadge(); }, 60000);
}

function initializeMobilePush() {
  if (!window.Capacitor?.isNativePlatform?.() || document.querySelector('[data-mobile-push-script]')) return;
  const script = document.createElement('script');
  script.src = '/mobile/www/push-client.bundle.js';
  script.dataset.mobilePushScript = '';
  script.addEventListener('load', () => window.initializeGusaMobilePush?.(), { once: true });
  script.addEventListener('error', () => console.error('Không tải được tích hợp thông báo mobile.'), { once: true });
  document.head.append(script);
}

if (sidebarScroll) {
  sidebarScroll.innerHTML = `
    <p class="menu-label">DANH MỤC</p>
    <nav class="menu" aria-label="Danh mục chính">
      <a class="menu-item" href="organization-chart.html"><span class="menu-icon">▤</span><span>Sơ đồ tổ chức</span></a>
      <a class="menu-item" href="process-choice.html"><span class="menu-icon">⌘</span><span>Quy Trình</span></a>
      <a class="menu-item" href="#"><span class="menu-icon">▣</span><span>Lương &amp; KPI</span></a>
      <a class="menu-item" href="recruitment.html"><span class="menu-icon">♙</span><span>Tuyển dụng</span></a>
      <a class="menu-item" href="#"><span class="menu-icon">▥</span><span>Báo cáo doanh số</span></a>
    </nav>
    <p class="menu-label">CHẤM CÔNG</p>
    <nav class="menu" aria-label="Menu chấm công">
      <a class="menu-item" href="attendance-choice.html"><span class="menu-icon">◷</span><span>Chấm công</span></a>
      <a class="menu-item" href="attendance.html?view=days"><span class="menu-icon">▦</span><span>Tổng ngày công</span></a>
    </nav>
    <p class="menu-label">BIỂU MẪU</p>
    <nav class="menu" aria-label="Menu biểu mẫu">
      <a class="menu-item" href="proposal-choice.html"><span class="menu-icon">☷</span><span>Đề xuất</span></a>
    </nav>
    <nav class="menu" aria-label="Menu báo cáo">
      <a class="menu-item" href="report-choice.html" data-report-menu hidden><span class="menu-icon">▥</span><span>Báo cáo</span></a>
    </nav>
    <p class="menu-label">CÀI ĐẶT</p>
    <nav class="menu"><a class="menu-item" href="interface-settings.html"><span class="menu-icon">⚙</span><span>Cài đặt</span></a></nav>
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
    const attendanceSectionMatch = href === 'attendance-choice.html' && currentPath === 'attendance.html' && currentQuery !== '?view=days';
    const reportSectionMatch = href === 'report-choice.html' && ['attendance-overview.html', 'proposal-report.html'].includes(currentPath);
    const processSectionMatch = href === 'process-choice.html' && currentPath === 'production.html';
    const proposalSectionMatch = href === 'proposal-choice.html' && ['proposals.html', 'payment-proposal.html'].includes(currentPath);
    const samePath = url.pathname.split('/').pop() === currentPath || attendanceSectionMatch || reportSectionMatch || proposalSectionMatch || processSectionMatch;
    const sameQuery = url.search === currentQuery || attendanceSectionMatch || reportSectionMatch || proposalSectionMatch || processSectionMatch;
    const targetHash = url.hash || '';
    const matchesCurrentSection = href === 'interface-settings.html' || (targetHash ? targetHash === currentHash : !currentHash);
    if (samePath && sameQuery && matchesCurrentSection) {
      link.classList.add('is-active');
      link.setAttribute('aria-current', 'page');
    }
  });

  fetch('/api/me', { cache: 'no-store' })
    .then((response) => {
      if (!response.ok) throw new Error('Không tải được thông tin tài khoản.');
      return response.json();
    })
    .then(({ user }) => {
      if (user) {
        document.querySelectorAll('[data-user-name]').forEach((element) => {
          element.textContent = user.name || user.email || 'Tài khoản Google';
        });
        document.querySelectorAll('[data-user-role], [data-profile-role]').forEach((element) => {
          element.textContent = user.role === 'admin' ? 'Quản trị viên' : user.role === 'ceo' ? 'CEO' : user.role === 'accountant' ? 'Kế toán' : user.role === 'warehouse' ? 'Vận hành kho' : user.role === 'manager' ? 'Quản lý cấp 1' : user.role === 'production' ? 'Sản xuất' : user.role === 'hr' ? 'Nhân sự' : 'Nhân viên';
        });
        const roleChipLabel = user.role === 'ceo' ? 'CEO' : user.role === 'admin' ? 'Quản trị' : user.role === 'accountant' ? 'Kế toán' : user.role === 'warehouse' ? 'Vận hành kho' : user.role === 'manager' ? 'Quản lý cấp 1' : user.role === 'production' ? 'Sản xuất' : user.role === 'hr' ? 'Nhân sự' : 'Nhân viên';
        document.querySelectorAll('.role-chip').forEach((button) => {
          const originalRole = button.dataset.role || button.textContent.trim();
          button.dataset.role = originalRole;
          const expectedRole = ['ceo', 'admin'].includes(user.role) ? roleChipLabel : 'Nhân viên';
          const matchesRole = originalRole === expectedRole;
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
        if (!user.picture) document.querySelectorAll('[data-profile-avatar]').forEach((element) => { element.textContent = (user.name || user.email || 'U').charAt(0).toUpperCase(); });
        const profileName = document.querySelector('[data-profile-name]');
        const profileEmail = document.querySelector('[data-profile-email]');
        if (profileName) profileName.textContent = user.name || 'Tài khoản Google';
        if (profileEmail) profileEmail.textContent = user.email || '';
      }
      const isAdmin = user?.role === 'admin' || user?.role === 'ceo';
      const isCeo = user?.role === 'ceo';
      const isAccountant = user?.role === 'accountant';
      initializeProposalApprovalNotifications();
      initializeProductionBadge();
      initializeNotificationCenter(user);
      initializeMobilePush();
      if (isAdmin || isAccountant) initializeSharedProposalNotifications();
      if (isAdmin || isAccountant) initializeReportMenuBadge();
      sidebarScroll.querySelector('[data-admin-menu]').hidden = !isAdmin;
      sidebarScroll.querySelector('[data-admin-menu-label]').hidden = !isAdmin;
      const employeeAttendanceOverview = sidebarScroll.querySelector('a[href="attendance.html?view=days"]');
      if (employeeAttendanceOverview) employeeAttendanceOverview.hidden = isAdmin;
      sidebarScroll.querySelector('[data-report-menu]').hidden = !(isAdmin || isAccountant);
      document.querySelectorAll('[data-report-access]').forEach((card) => {
        card.hidden = card.dataset.reportAccess === 'payment' ? !(isAdmin || isAccountant) : !isAdmin;
      });
      const reportStatus = document.querySelector('[data-report-choice-status]');
      if (reportStatus) {
        reportStatus.textContent = isAdmin || isAccountant ? '' : 'Bạn không có quyền xem các báo cáo này.';
        reportStatus.hidden = isAdmin || isAccountant;
      }
      document.querySelectorAll('[data-proposal-personnel-choice]').forEach((card) => {
        card.hidden = isCeo;
      });
      const proposalStatus = document.querySelector('[data-proposal-choice-status]');
      if (proposalStatus) proposalStatus.hidden = true;
      if (isCeo) {
        sidebarScroll.querySelectorAll('a[href="attendance-choice.html"]').forEach((link) => {
          link.hidden = true;
        });
        sidebarScroll.querySelectorAll('[data-admin-menu] .menu-item[href="#"]').forEach((link) => {
          link.hidden = true;
        });
      }
    })
    .catch((error) => {
      sidebarScroll.querySelector('[data-admin-menu]').hidden = true;
      sidebarScroll.querySelector('[data-admin-menu-label]').hidden = true;
      sidebarScroll.querySelector('[data-report-menu]').hidden = true;
      document.querySelectorAll('[data-report-access]').forEach((card) => { card.hidden = true; });
      const reportStatus = document.querySelector('[data-report-choice-status]');
      if (reportStatus) {
        reportStatus.textContent = 'Không tải được danh sách báo cáo. Vui lòng tải lại trang.';
        reportStatus.hidden = false;
      }
      document.querySelectorAll('[data-proposal-personnel-choice]').forEach((card) => { card.hidden = true; });
      const proposalStatus = document.querySelector('[data-proposal-choice-status]');
      if (proposalStatus) {
        proposalStatus.textContent = 'Không tải được thông tin tài khoản. Vui lòng tải lại trang.';
        proposalStatus.hidden = false;
      }
      console.error('Không tải được thông tin menu.', error);
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
