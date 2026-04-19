// ============================================
// auth.js — Authentication & Shared Utils
// (PATCHED: ใช้ Google Apps Script login เพื่อรับ token)
// ============================================

// ── Auth ────────────────────────────────────
const DEMO_ACCOUNTS = {
  admin:   { email: 'admin@school.ac.th',   password: 'admin1234',   role: 'admin',   name: 'ผู้ดูแลระบบ' },
  teacher: { email: 'teacher@school.ac.th', password: 'teacher1234', role: 'teacher', name: 'อาจารย์สมใจ ดีงาม' },
  viewer:  { email: 'viewer@school.ac.th',  password: 'viewer1234',  role: 'viewer',  name: 'ผู้ปกครอง ทดสอบ' }
};

function getCurrentUser() {
  try {
    const u = sessionStorage.getItem('user');
    return u ? JSON.parse(u) : null;
  } catch (_) {
    return null;
  }
}

function requireAuth() {
  const user = getCurrentUser();
  if (!user || !user.token) {
    sessionStorage.removeItem('user');
    window.location.href = 'index.html';
    return false;
  }
  return true;
}

// ── Login (ใช้ GAS จริง) ─────────────────────
async function doLogin() {
  const email    = document.getElementById('emailInput').value.trim();
  const password = document.getElementById('passwordInput').value;
  const btn      = document.getElementById('loginBtnText');
  const errEl    = document.getElementById('errorMsg');

  if (errEl) errEl.classList.remove('show');

  if (!email || !password) {
    if (errEl) errEl.classList.add('show');
    return;
  }

  btn.textContent = 'กำลังตรวจสอบ...';

  try {
    // ยิงไปที่ Google Apps Script
    const res = await fetch(CONFIG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        action: 'login',
        email,
        password
      }),
      mode: 'cors'
    });

    if (!res.ok) throw new Error('HTTP ' + res.status);

    const json = await res.json();

    if (!json.success) {
      throw new Error(json.error || 'เข้าสู่ระบบไม่สำเร็จ');
    }

    const userData = json.data || {};

    // ต้องมี token
    if (!userData.token) {
      throw new Error('ระบบไม่ได้ส่ง token กลับมา');
    }

    // เก็บ session
    sessionStorage.setItem('user', JSON.stringify({
      email: userData.email || email,
      name:  userData.name  || 'ผู้ใช้งาน',
      role:  userData.role  || 'viewer',
      rooms: userData.rooms || '',
      token: userData.token
    }));

    btn.textContent = '✅ สำเร็จ';
    window.location.href = 'dashboard.html';

  } catch (err) {
    console.error('[Auth] Login failed:', err.message);

    btn.textContent = '🔐 เข้าสู่ระบบ';
    if (errEl) errEl.classList.add('show');

    showToast('เข้าสู่ระบบไม่สำเร็จ', err.message, 'error', 3500);
  }
}

// ── Demo fill ────────────────────────────────
function fillDemo(role) {
  const acc = DEMO_ACCOUNTS[role];
  if (!acc) return;
  document.getElementById('emailInput').value = acc.email;
  document.getElementById('passwordInput').value = acc.password;
}

// ── Google login (ตอนนี้เป็น mock แต่สร้าง token จาก GAS ไม่ได้) ──
function loginGoogle() {
  showToast('ยังไม่เปิดใช้ Google Login', 'ตอนนี้ใช้ระบบ login ผ่าน email/password ก่อน', 'warning', 4000);
}

// ── Logout ───────────────────────────────────
function doLogout() {
  sessionStorage.removeItem('user');
  window.location.href = 'index.html';
}

// ── Theme ────────────────────────────────────
function initTheme() {
  if (localStorage.getItem('theme') === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
    updateThemeButton('light');
  }
}

function toggleTheme() {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  if (isLight) {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('theme', 'dark');
    updateThemeButton('dark');
  } else {
    document.documentElement.setAttribute('data-theme', 'light');
    localStorage.setItem('theme', 'light');
    updateThemeButton('light');
  }
}

function updateThemeButton(theme) {
  const btn = document.querySelector('.theme-toggle');
  if (btn) btn.textContent = theme === 'light' ? '☀️' : '🌙';
}

// ── Toast ────────────────────────────────────
function showToast(title, message = '', type = 'success', duration = 4000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️', face: '👤' };
  const colors = { success: '#10b981', error: '#ef4444', warning: '#f59e0b', info: '#3b82f6', face: '#4f46e5' };

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.style.setProperty('--toast-color', colors[type] || colors.info);
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <div class="toast-body">
      <div class="toast-title">${title}</div>
      ${message ? `<div class="toast-msg">${message}</div>` : ''}
    </div>
    <button onclick="this.parentElement.remove()" style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:16px;padding:0 4px;flex-shrink:0">×</button>
  `;

  container.appendChild(toast);

  if (duration > 0) {
    setTimeout(() => {
      toast.classList.add('removing');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }
}

// ── Sidebar ────────────────────────────────────
function renderSidebar(activePage) {
  const user = getCurrentUser();
  if (!user) return;

  const navItems = [
    { icon: '📊', label: 'แดชบอร์ด', href: 'dashboard.html', page: 'dashboard' },
    { icon: '📷', label: 'เช็คชื่อ', href: 'attendance.html', page: 'attendance' },
    { icon: '👥', label: 'นักเรียน', href: 'students.html', page: 'students' },
    { icon: '📋', label: 'รายงาน', href: 'reports.html', page: 'reports' },
    { icon: '⚙️', label: 'ตั้งค่า', href: 'settings.html', page: 'settings' },
  ];

  const initials = (user.name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2);

  const html = `
    <div class="sidebar-brand">
      <div class="brand-icon">🎓</div>
      <div>
        <div class="brand-name">FaceAttend</div>
        <div class="brand-tagline">${CONFIG.SCHOOL_SHORT}</div>
      </div>
    </div>
    <nav class="sidebar-nav">
      <div class="nav-section-label">เมนูหลัก</div>
      ${navItems.map(item => `
        <a href="${item.href}" class="nav-item ${activePage === item.page ? 'active' : ''}">
          <span class="nav-icon">${item.icon}</span>
          <span>${item.label}</span>
        </a>
      `).join('')}
    </nav>
    <div class="sidebar-footer">
      <div class="user-profile" onclick="doLogout()">
        <div class="user-avatar avatar-initials">${initials}</div>
        <div>
          <div class="user-name">${(user.name || '').replace('อาจารย์','อ.')}</div>
          <div class="user-role">${ROLE_LABELS[user.role]?.label || user.role} · ออกจากระบบ</div>
        </div>
      </div>
    </div>
  `;

  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.innerHTML = html;
}

function renderTopbar(title, subtitle = '') {
  const topbar = document.getElementById('topbar');
  if (!topbar) return;

  const now = new Date();
  const dateStr = now.toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

  topbar.innerHTML = `
    <button class="btn-icon" onclick="document.getElementById('sidebar').classList.toggle('open')" style="display:none" id="menuBtn">☰</button>
    <div>
      <div class="topbar-title">${title}</div>
      ${subtitle ? `<div class="topbar-meta">${subtitle}</div>` : ''}
    </div>
    <div style="flex:1"></div>
    <div class="topbar-meta" id="topbarClock">${dateStr} · ${timeStr}</div>
    <button class="theme-toggle" onclick="toggleTheme()">🌙</button>
  `;

  setInterval(() => {
    const now = new Date();
    const el = document.getElementById('topbarClock');
    if (el) {
      const d = now.toLocaleDateString('th-TH', { weekday: 'short', month: 'long', day: 'numeric' });
      const t = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      el.textContent = `${d} · ${t}`;
    }
  }, 1000);

  updateThemeButton(localStorage.getItem('theme') || 'dark');
}

// ── Number format ────────────────────────────
function fmt(n, decimals = 1) {
  if (n === undefined || n === null) return '0';
  return Number(n).toFixed(decimals);
}

function fmtPercent(num, total) {
  if (!total) return '0%';
  return `${((num / total) * 100).toFixed(1)}%`;
}

// ── Confirm dialog ────────────────────────────
function confirm(title, message, onConfirm) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:420px">
      <div class="modal-header">
        <h2 class="modal-title">⚠️ ${title}</h2>
      </div>
      <p style="color:var(--text-muted);font-size:14px">${message}</p>
      <div class="modal-actions">
        <button class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">ยกเลิก</button>
        <button class="btn btn-danger" id="confirmBtn">ยืนยัน</button>
      </div>
    </div>
  `;
  overlay.querySelector('#confirmBtn').onclick = () => {
    overlay.remove();
    onConfirm();
  };
  document.body.appendChild(overlay);
}

// Init on page load
document.addEventListener('DOMContentLoaded', () => {
  initTheme();

  if (!document.getElementById('toast-container')) {
    const tc = document.createElement('div');
    tc.id = 'toast-container';
    document.body.appendChild(tc);
  }

  if (window.innerWidth <= 768) {
    const menuBtn = document.getElementById('menuBtn');
    if (menuBtn) menuBtn.style.display = 'flex';
  }

  // Enter key login
  if (document.getElementById('passwordInput')) {
    document.addEventListener('keypress', e => {
      if (e.key === 'Enter') doLogin();
    });
  }
});
