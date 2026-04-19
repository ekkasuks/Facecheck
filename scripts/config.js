// ============================================
// config.js — ตั้งค่าระบบ
// ⚠️  แก้ API_URL ด้านล่างให้เป็น URL จริงของคุณ
// ============================================

const CONFIG = {

  // ══════════════════════════════════════════
  //  ★ 1) Google Apps Script URL ★
  //  ได้จาก: Apps Script → Deploy → Web App → Copy URL
  // ══════════════════════════════════════════
  API_URL: 'https://script.google.com/macros/s/AKfycbxxqJKga6G1qeLmmp1jzzrZJt2ait7iORBiSXyY95svcKJFCqYnH8RBRyRS1L58JnQk/exec',
  //        ↑ แก้ตรงนี้

  // ══════════════════════════════════════════
  //  ★ 2) Google OAuth 2.0 Client ID ★
  //  วิธีสร้าง:
  //  1. ไปที่ https://console.cloud.google.com/
  //  2. APIs & Services → Credentials
  //  3. + CREATE CREDENTIALS → OAuth client ID
  //  4. Application type: Web application
  //  5. Authorized JavaScript origins:
  //     - http://localhost (สำหรับทดสอบ)
  //     - https://YOUR_USERNAME.github.io (สำหรับ production)
  //  6. คัดลอก Client ID มาวางที่นี่
  // ══════════════════════════════════════════
  GOOGLE_CLIENT_ID: '927009801291-kevld3oikvb61borggjd1uul8mbhmkvk.apps.googleusercontent.com',
  //                 ↑ แก้ตรงนี้ — รูปแบบ: xxxxxxx.apps.googleusercontent.com

  // ══════════════════════════════════════════
  //  ★ 3) Role Mapping — ระบุว่า Email ไหน = Role อะไร ★
  //  Admin: เพิ่ม/แก้ไข/ลบข้อมูลทุกอย่าง
  //  Teacher: เช็คชื่อ + ดูรายงานห้องตัวเอง
  //  Viewer: ดู Dashboard อย่างเดียว
  // ══════════════════════════════════════════
  ROLE_MAP: {
    'admin@school.ac.th':        'admin',
    'ekasak@school.ac.th':       'admin',    // ← ใส่ Gmail ของอาจารย์เอกศักดิ์
    'teacher@school.ac.th':      'teacher',
    // เพิ่ม email ครูคนอื่นๆ ที่นี่:
    // 'somjai@school.ac.th':    'teacher',
    // 'parent@gmail.com':       'viewer',
  },
  // หมายเหตุ: email ที่ไม่ได้ระบุใน ROLE_MAP จะได้ role = 'teacher' อัตโนมัติ

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

// ── ตรวจว่า API_URL ตั้งค่าแล้วหรือยัง ──────
CONFIG._hasRealAPI    = !CONFIG.API_URL.includes('YOUR_SCRIPT');
CONFIG._hasGoogleAuth = !CONFIG.GOOGLE_CLIENT_ID.includes('YOUR_CLIENT_ID');

if (!CONFIG._hasRealAPI) {
  console.warn(
    '%c⚠️ FaceAttend: ยังไม่ได้ตั้งค่า API_URL\n' +
    'ข้อมูลจะถูกบันทึกเฉพาะ localStorage (ไม่ส่ง Google Sheet)\n' +
    'แก้ไข scripts/config.js → CONFIG.API_URL',
    'background:#f59e0b;color:#000;padding:8px;font-size:13px'
  );
}

// ════════════════════════════════════════════
// Mock / Seed Data (ใช้เมื่อ API ไม่พร้อม)
// ════════════════════════════════════════════

const SEED_STUDENTS = [
  { id:'S001', prefix:'ด.ช.', firstName:'ธนกฤต',   lastName:'มั่นคง',  classLevel:'ม.1', room:'1', no:1, gender:'ชาย',   activeStatus:'active', faceImageUrl:'', faceDescriptor:null },
  { id:'S002', prefix:'ด.ญ.', firstName:'พิชญา',    lastName:'สุวรรณ', classLevel:'ม.1', room:'1', no:2, gender:'หญิง', activeStatus:'active', faceImageUrl:'', faceDescriptor:null },
  { id:'S003', prefix:'ด.ช.', firstName:'กิตติภูมิ', lastName:'โชติกิจ',classLevel:'ม.1', room:'1', no:3, gender:'ชาย',   activeStatus:'active', faceImageUrl:'', faceDescriptor:null },
  { id:'S004', prefix:'ด.ญ.', firstName:'ณัฐนรี',   lastName:'ทองดี',  classLevel:'ม.1', room:'2', no:1, gender:'หญิง', activeStatus:'active', faceImageUrl:'', faceDescriptor:null },
  { id:'S005', prefix:'ด.ช.', firstName:'ชยานันต์', lastName:'พิสุทธิ์',classLevel:'ม.2', room:'1', no:1, gender:'ชาย',   activeStatus:'active', faceImageUrl:'', faceDescriptor:null },
  { id:'S006', prefix:'ด.ญ.', firstName:'อริสา',    lastName:'วงศ์สว่าง',classLevel:'ม.2',room:'1', no:2, gender:'หญิง', activeStatus:'active', faceImageUrl:'', faceDescriptor:null },
  { id:'S007', prefix:'ด.ช.', firstName:'ภัทรพล',   lastName:'สิงห์เดช',classLevel:'ม.2', room:'2', no:1, gender:'ชาย',   activeStatus:'active', faceImageUrl:'', faceDescriptor:null },
  { id:'S008', prefix:'ด.ญ.', firstName:'วราภรณ์',  lastName:'นาคประเสริฐ',classLevel:'ม.3',room:'1',no:1, gender:'หญิง', activeStatus:'active', faceImageUrl:'', faceDescriptor:null },
  { id:'S009', prefix:'ด.ช.', firstName:'ศุภณัฐ',   lastName:'เกษมสุข',classLevel:'ม.3', room:'1', no:2, gender:'ชาย',   activeStatus:'active', faceImageUrl:'', faceDescriptor:null },
  { id:'S010', prefix:'ด.ญ.', firstName:'ปัณฑิตา',  lastName:'ชลวิถี', classLevel:'ม.3', room:'2', no:1, gender:'หญิง', activeStatus:'active', faceImageUrl:'', faceDescriptor:null },
];

// ════════════════════════════════════════════
// LocalStorage Helpers
// key ใช้ classLevel (ตรงกับ Apps Script)
// ════════════════════════════════════════════

function lsGetStudents() {
  const raw = localStorage.getItem('fa_students');
  if (raw) {
    try { return JSON.parse(raw); } catch(_) {}
  }
  // seed ครั้งแรก
  localStorage.setItem('fa_students', JSON.stringify(SEED_STUDENTS));
  return SEED_STUDENTS;
}

function lsSaveStudents(arr) {
  localStorage.setItem('fa_students', JSON.stringify(arr));
}

function lsGetAttendance() {
  const raw = localStorage.getItem('fa_attendance');
  if (raw) { try { return JSON.parse(raw); } catch(_) {} }
  return [];
}

function lsSaveAttendance(arr) {
  localStorage.setItem('fa_attendance', JSON.stringify(arr));
}

function lsGetTodayAttendance() {
  const today = new Date().toISOString().split('T')[0];
  return lsGetAttendance().filter(r => r.date === today);
}

// ── aliases ที่โค้ดเก่าใช้ ──────────────────
function getStudents()      { return lsGetStudents(); }
function saveStudents(arr)  { lsSaveStudents(arr); }
function getAttendance()    { return lsGetAttendance(); }
function saveAttendance(arr){ lsSaveAttendance(arr); }
function getTodayAttendance(){ return lsGetTodayAttendance(); }

// ── Utility ──────────────────────────────────
const STATUS_LABELS = {
  present: { label:'มาเรียน', badge:'badge-green',  icon:'✅' },
  late:    { label:'สาย',    badge:'badge-yellow', icon:'⏰' },
  absent:  { label:'ขาด',    badge:'badge-red',    icon:'❌' },
  leave:   { label:'ลา',     badge:'badge-blue',   icon:'📝' },
};

const ROLE_LABELS = {
  admin:   { label:'ผู้ดูแลระบบ',    icon:'👑' },
  teacher: { label:'ครูผู้สอน',      icon:'👨‍🏫' },
  viewer:  { label:'ผู้สังเกตการณ์', icon:'👁️' },
};

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
