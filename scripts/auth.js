// ============================================
// auth.js — Auth + Shared UI Utilities
// ★ ไม่มี localStorage helpers ของข้อมูล
//   (เหลือแค่ theme/session ซึ่งจำเป็น)
// ============================================

// ════════════════════════════════════════════
// Session Management (sessionStorage เท่านั้น)
// ════════════════════════════════════════════

function getCurrentUser() {
  try {
    const u = sessionStorage.getItem('user');
    return u ? JSON.parse(u) : null;
  } catch(_) { return null; }
}

function requireAuth() {
  if (!getCurrentUser()) {
    window.location.href = 'index.html';
    return false;
  }
  return true;
}

function doLogout() {
  const user = getCurrentUser();
  if (user && user.loginMethod === 'google') {
    try {
      if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
        google.accounts.id.disableAutoSelect();
        google.accounts.id.revoke(user.email, () => {});
      }
    } catch(_) {}
  }
  sessionStorage.clear();
  window.location.href = 'index.html';
}

// ════════════════════════════════════════════
// Theme (localStorage สำหรับ UI preference เท่านั้น)
// ════════════════════════════════════════════

function initTheme() {
  const saved = localStorage.getItem('theme');
  if (saved === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  _updateThemeBtn(saved || 'dark');

  // primary color preference
  const color = localStorage.getItem('fa_primaryColor');
  if (color) document.documentElement.style.setProperty('--primary', color);
}

function toggleTheme() {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  if (isLight) {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('theme', 'dark');
    _updateThemeBtn('dark');
  } else {
    document.documentElement.setAttribute('data-theme', 'light');
    localStorage.setItem('theme', 'light');
    _updateThemeBtn('light');
  }
}

function _updateThemeBtn(theme) {
  document.querySelectorAll('.theme-toggle, #themeBtn').forEach(btn => {
    btn.textContent = theme === 'light' ? '☀️' : '🌙';
  });
}

// ════════════════════════════════════════════
// Toast Notification
// ════════════════════════════════════════════

function showToast(title, message = '', type = 'success', duration = 4000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const icons  = { success:'✅', error:'❌', warning:'⚠️', info:'ℹ️', face:'👤' };
  const colors = { success:'#10b981', error:'#ef4444', warning:'#f59e0b', info:'#3b82f6', face:'#4f46e5' };

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.style.setProperty('--toast-color', colors[type] || colors.info);
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <div class="toast-body">
      <div class="toast-title">${title}</div>
      ${message ? `<div class="toast-msg">${message}</div>` : ''}
    </div>
    <button onclick="this.parentElement.remove()"
      style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:16px;padding:0 4px;flex-shrink:0">×</button>
  `;
  container.appendChild(toast);

  if (duration > 0) {
    setTimeout(() => {
      toast.classList.add('removing');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }
}

// ════════════════════════════════════════════
// Sidebar
// ════════════════════════════════════════════

function renderSidebar(activePage) {
  const user    = getCurrentUser();
  if (!user) return;
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  const nav = [
    { icon:'📊', label:'แดชบอร์ด',  href:'dashboard.html',  page:'dashboard'  },
    { icon:'📷', label:'เช็คชื่อ',   href:'attendance.html', page:'attendance' },
    { icon:'👥', label:'นักเรียน',   href:'students.html',   page:'students'   },
    { icon:'📋', label:'รายงาน',     href:'reports.html',    page:'reports'    },
    { icon:'⚙️', label:'ตั้งค่า',    href:'settings.html',   page:'settings'   },
  ];

  const initials = (user.name || user.email || 'U')
    .split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  const avatarHtml = user.picture
    ? `<img src="${user.picture}"
         style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:2px solid var(--border-strong)"
         onerror="this.outerHTML='<div class=\\'user-avatar avatar-initials\\'>${initials}</div>'">`
    : `<div class="user-avatar avatar-initials">${initials}</div>`;

  const rl = (typeof ROLE_LABELS !== 'undefined' && ROLE_LABELS && ROLE_LABELS[user.role])
    ? ROLE_LABELS[user.role]
    : { label: user.role || 'ผู้ใช้', icon: '👤' };

  const roleColors = { admin:'#10b981', teacher:'#3b82f6', viewer:'#94a3b8' };
  const roleColor  = roleColors[user.role] || '#94a3b8';

  const loginBadge = user.loginMethod === 'google'
    ? `<span style="font-size:9px;background:rgba(66,133,244,.2);color:#60a5fa;padding:1px 5px;border-radius:4px;margin-left:4px">Google</span>`
    : '';

  sidebar.innerHTML = `
    <div class="sidebar-brand">
      <div class="brand-icon">🎓</div>
      <div>
        <div class="brand-name">FaceAttend</div>
        <div class="brand-tagline">${(typeof CONFIG !== 'undefined' && CONFIG.SCHOOL_SHORT) || 'ระบบเช็คชื่อ'}</div>
      </div>
    </div>
    <nav class="sidebar-nav">
      <div class="nav-section-label">เมนูหลัก</div>
      ${nav.map(item => `
        <a href="${item.href}" class="nav-item ${activePage === item.page ? 'active' : ''}">
          <span class="nav-icon">${item.icon}</span>
          <span>${item.label}</span>
        </a>`).join('')}
    </nav>
    <div class="sidebar-footer">
      <div class="user-profile" onclick="doLogout()" title="คลิกเพื่อออกจากระบบ">
        ${avatarHtml}
        <div style="min-width:0">
          <div class="user-name" style="display:flex;align-items:center;flex-wrap:wrap">
            <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:140px">${user.name || user.email}</span>
            ${loginBadge}
          </div>
          <div class="user-role">
            <span style="color:${roleColor};font-weight:700">${rl.label}</span> · ออกจากระบบ
          </div>
        </div>
      </div>
    </div>
  `;
}

// ════════════════════════════════════════════
// Topbar
// ════════════════════════════════════════════

function renderTopbar(title, subtitle = '') {
  const topbar = document.getElementById('topbar');
  if (!topbar) return;

  const now     = new Date();
  const dateStr = now.toLocaleDateString('th-TH', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  const timeStr = now.toLocaleTimeString('th-TH', { hour:'2-digit', minute:'2-digit' });

  const u = getCurrentUser();
  const roleColors = { admin:'#10b981', teacher:'#3b82f6', viewer:'#94a3b8' };
  const roleIcons  = { admin:'👑', teacher:'👨‍🏫', viewer:'👁️' };
  const rl = (typeof ROLE_LABELS !== 'undefined' && u && ROLE_LABELS[u.role])
    ? ROLE_LABELS[u.role].label : (u?.role || '');
  const roleBadge = u
    ? `<span style="padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;
        background:${(roleColors[u.role]||'#94a3b8')}22;color:${roleColors[u.role]||'#94a3b8'};
        border:1px solid ${(roleColors[u.role]||'#94a3b8')}44">
        ${roleIcons[u.role]||'👤'} ${rl}
      </span>` : '';

  topbar.innerHTML = `
    <button class="btn-icon" id="menuBtnMobile"
      onclick="document.getElementById('sidebar').classList.toggle('open')"
      style="display:none">☰</button>
    <div>
      <div class="topbar-title">${title}</div>
      ${subtitle ? `<div class="topbar-meta" style="font-size:12px;color:var(--text-muted)">${subtitle}</div>` : ''}
    </div>
    <div style="flex:1"></div>
    ${roleBadge}
    <div class="topbar-meta" id="topbarClock" style="font-size:12px">${dateStr} · ${timeStr}</div>
    <button class="theme-toggle" onclick="toggleTheme()">🌙</button>
  `;

  // นาฬิกา live
  setInterval(() => {
    const n  = new Date();
    const el = document.getElementById('topbarClock');
    if (el) el.textContent =
      n.toLocaleDateString('th-TH', { weekday:'short', month:'long', day:'numeric' }) +
      ' · ' + n.toLocaleTimeString('th-TH');
  }, 1000);

  _updateThemeBtn(localStorage.getItem('theme') || 'dark');

  if (window.innerWidth <= 768) {
    const btn = document.getElementById('menuBtnMobile');
    if (btn) btn.style.display = 'flex';
  }
}

// ════════════════════════════════════════════
// Confirm Dialog
// ════════════════════════════════════════════

function confirm(title, message, onConfirm) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:420px">
      <div class="modal-header">
        <h2 class="modal-title">⚠️ ${title}</h2>
      </div>
      <p style="color:var(--text-muted);font-size:14px;line-height:1.6;margin-bottom:4px">${message}</p>
      <div class="modal-actions">
        <button class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">ยกเลิก</button>
        <button class="btn btn-danger" id="_confirmOkBtn">ยืนยัน</button>
      </div>
    </div>
  `;
  overlay.querySelector('#_confirmOkBtn').addEventListener('click', () => {
    overlay.remove();
    onConfirm();
  });
  document.body.appendChild(overlay);
}

// ════════════════════════════════════════════
// Date Range Helper
// ════════════════════════════════════════════

function getDateRange(type) {
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (type === 'week') {
    const mon = new Date(today);
    mon.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    return { start: mon, end: sun };
  }
  if (type === 'month') {
    return {
      start: new Date(today.getFullYear(), today.getMonth(), 1),
      end:   new Date(today.getFullYear(), today.getMonth() + 1, 0),
    };
  }
  return { start: today, end: today };
}

// ════════════════════════════════════════════
// Auto-init
// ════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  if (!document.getElementById('toast-container')) {
    const tc = document.createElement('div');
    tc.id = 'toast-container';
    document.body.appendChild(tc);
  }
});
