// ============================================
// config.js — ตั้งค่าระบบ
// ★ ไม่มี localStorage ทั้งสิ้น — Google Sheet 100%
// ============================================

const CONFIG = {

  // ══════════════════════════════════════════
  //  ★ 1) Google Apps Script URL ★
  // ══════════════════════════════════════════
  API_URL: 'https://script.google.com/macros/s/AKfycbxF_mxKfeUwJW0IfYML-BJPo5eRMXa7X697Z0J6yeMLLgUJ3YLoMFNn6cO70Kw454fm/exec',

  // ══════════════════════════════════════════
  //  ★ 2) Google OAuth 2.0 Client ID ★
  // ══════════════════════════════════════════
  GOOGLE_CLIENT_ID: '927009801291-kevld3oikvb61borggjd1uul8mbhmkvk.apps.googleusercontent.com',

  // ══════════════════════════════════════════
  //  ★ 3) Role Mapping ★
  // ══════════════════════════════════════════
  ROLE_MAP: {
    'ekkasuks@esanpt1.go.th': 'admin',
    'ekkasuks@gmail.com':     'admin',
    // เพิ่มครูคนอื่น:
    // 'teacher1@gmail.com':  'teacher',
  },

  // School
  SCHOOL_NAME:  'โรงเรียนบ้านใหม่',
  SCHOOL_SHORT: 'ร.ร.บ้านใหม่',

  // Face Recognition
  FACE_MATCH_THRESHOLD:    0.5,
  DUPLICATE_CHECK_MINUTES: 10,

  // Time
  LATE_TIME:    '08:30',
  ABSENT_AFTER: '10:00',

  // Debug (เปลี่ยนเป็น false เมื่อ production)
  DEBUG: true,
};

// ── ตรวจสอบ API URL ───────────────────────
CONFIG._hasRealAPI    = !CONFIG.API_URL.includes('YOUR_SCRIPT');
CONFIG._hasGoogleAuth = !CONFIG.GOOGLE_CLIENT_ID.includes('YOUR_CLIENT_ID');

if (!CONFIG._hasRealAPI) {
  console.error(
    '%c❌ FaceAttend: ยังไม่ได้ตั้งค่า API_URL\nแก้ไข scripts/config.js → CONFIG.API_URL',
    'background:#ef4444;color:#fff;padding:8px;font-size:13px'
  );
}

// ════════════════════════════════════════════
// ค่าคงที่ UI
// ════════════════════════════════════════════

const STATUS_LABELS = {
  present: { label:'มาเรียน', badge:'badge-green',  icon:'✅' },
  late:    { label:'สาย',    badge:'badge-yellow', icon:'⏰' },
  absent:  { label:'ขาด',    badge:'badge-red',    icon:'❌' },
  leave:   { label:'ลา',     badge:'badge-blue',   icon:'📝' },
};

if (typeof ROLE_LABELS === 'undefined') {
  var ROLE_LABELS = {
    admin:   { label:'ผู้ดูแลระบบ',    icon:'👑' },
    teacher: { label:'ครูผู้สอน',      icon:'👨‍🏫' },
    viewer:  { label:'ผู้สังเกตการณ์', icon:'👁️' },
  };
}

// ════════════════════════════════════════════
// Date Range Helper
// ════════════════════════════════════════════
function getDateRange(type) {
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (type === 'week') {
    const mon = new Date(today);
    mon.setDate(today.getDate() - ((today.getDay()+6)%7));
    const sun = new Date(mon); sun.setDate(mon.getDate()+6);
    return { start:mon, end:sun };
  }
  if (type === 'month') {
    return {
      start: new Date(today.getFullYear(), today.getMonth(), 1),
      end:   new Date(today.getFullYear(), today.getMonth()+1, 0)
    };
  }
  return { start:today, end:today };
}
