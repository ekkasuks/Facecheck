// ============================================
// config.js — Configuration & Mock Data
// ============================================

const CONFIG = {
  // Google Apps Script URL (แทนที่ด้วย URL จริงเมื่อ deploy)
  API_URL: 'https://script.google.com/macros/s/AKfycbzlkPfdlqyE3k7c5PvWTlwhc4tXxyYU9WZaWSSqrupk-w-OFk41s9e27RVchRQYqday/exec',

  // Google OAuth (แทนที่ด้วย Client ID จริง)
  GOOGLE_CLIENT_ID: '927009801291-kevld3oikvb61borggjd1uul8mbhmkvk.apps.googleusercontent.com',

  // School Settings
  SCHOOL_NAME: 'โรงเรียนบ้านใหม่',
  SCHOOL_SHORT: 'ร.ร.บ้านใหม่',

  // Face Recognition Settings
  FACE_MATCH_THRESHOLD: 0.5,
  DUPLICATE_CHECK_MINUTES: 10,

  // Time Settings
  LATE_TIME: '08:30',
  ABSENT_AFTER: '10:00',

  // App Settings
  VERSION: '2.1.0',
  DEBUG: true,
};

// ============================================
// Mock Data (ข้อมูลทดสอบ)
// ============================================

const MOCK_STUDENTS = [
  { id: 'S001', prefix: 'ด.ช.', firstName: 'ธนกฤต', lastName: 'มั่นคง', class: 'ม.1', room: '1', no: 1, gender: 'ชาย', status: 'active', faceDescriptor: null, imageUrl: '' },
  { id: 'S002', prefix: 'ด.ญ.', firstName: 'พิชญา', lastName: 'สุวรรณ', class: 'ม.1', room: '1', no: 2, gender: 'หญิง', status: 'active', faceDescriptor: null, imageUrl: '' },
  { id: 'S003', prefix: 'ด.ช.', firstName: 'กิตติภูมิ', lastName: 'โชติกิจ', class: 'ม.1', room: '1', no: 3, gender: 'ชาย', status: 'active', faceDescriptor: null, imageUrl: '' },
  { id: 'S004', prefix: 'ด.ญ.', firstName: 'ณัฐนรี', lastName: 'ทองดี', class: 'ม.1', room: '2', no: 1, gender: 'หญิง', status: 'active', faceDescriptor: null, imageUrl: '' },
  { id: 'S005', prefix: 'ด.ช.', firstName: 'ชยานันต์', lastName: 'พิสุทธิ์', class: 'ม.2', room: '1', no: 1, gender: 'ชาย', status: 'active', faceDescriptor: null, imageUrl: '' },
  { id: 'S006', prefix: 'ด.ญ.', firstName: 'อริสา', lastName: 'วงศ์สว่าง', class: 'ม.2', room: '1', no: 2, gender: 'หญิง', status: 'active', faceDescriptor: null, imageUrl: '' },
  { id: 'S007', prefix: 'ด.ช.', firstName: 'ภัทรพล', lastName: 'สิงห์เดช', class: 'ม.2', room: '2', no: 1, gender: 'ชาย', status: 'active', faceDescriptor: null, imageUrl: '' },
  { id: 'S008', prefix: 'ด.ญ.', firstName: 'วราภรณ์', lastName: 'นาคประเสริฐ', class: 'ม.3', room: '1', no: 1, gender: 'หญิง', status: 'active', faceDescriptor: null, imageUrl: '' },
  { id: 'S009', prefix: 'ด.ช.', firstName: 'ศุภณัฐ', lastName: 'เกษมสุข', class: 'ม.3', room: '1', no: 2, gender: 'ชาย', status: 'active', faceDescriptor: null, imageUrl: '' },
  { id: 'S010', prefix: 'ด.ญ.', firstName: 'ปัณฑิตา', lastName: 'ชลวิถี', class: 'ม.3', room: '2', no: 1, gender: 'หญิง', status: 'active', faceDescriptor: null, imageUrl: '' },
];

const MOCK_ATTENDANCE = generateMockAttendance();

function generateMockAttendance() {
  const records = [];
  const today = new Date();
  const statuses = ['present','present','present','present','late','absent','leave'];

  for (let d = 30; d >= 0; d--) {
    const date = new Date(today);
    date.setDate(date.getDate() - d);
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    const dateStr = date.toISOString().split('T')[0];

    MOCK_STUDENTS.forEach(s => {
      const statusRoll = Math.random();
      let status;
      if (statusRoll < 0.72) status = 'present';
      else if (statusRoll < 0.85) status = 'late';
      else if (statusRoll < 0.93) status = 'absent';
      else status = 'leave';

      const hour = status === 'present' ? 7 + Math.floor(Math.random() * 1.5) : 8;
      const min = status === 'present' ? 30 + Math.floor(Math.random() * 59) : 31 + Math.floor(Math.random() * 29);
      const hStr = String(hour).padStart(2,'0');
      const mStr = String(min % 60).padStart(2,'0');

      records.push({
        id: `A${Date.now()}${Math.random()}`,
        date: dateStr,
        time: `${hStr}:${mStr}`,
        studentId: s.id,
        studentName: `${s.prefix}${s.firstName} ${s.lastName}`,
        class: s.class,
        room: s.room,
        status: status,
        method: Math.random() > 0.2 ? 'face' : 'manual',
        deviceId: 'DEVICE-01',
        note: ''
      });
    });
  }
  return records;
}

const STATUS_LABELS = {
  present: { label: 'มาเรียน', badge: 'badge-green', icon: '✅' },
  late: { label: 'สาย', badge: 'badge-yellow', icon: '⏰' },
  absent: { label: 'ขาด', badge: 'badge-red', icon: '❌' },
  leave: { label: 'ลา', badge: 'badge-blue', icon: '📝' }
};

const ROLE_LABELS = {
  admin: { label: 'ผู้ดูแลระบบ', icon: '👑' },
  teacher: { label: 'ครูผู้สอน', icon: '👨‍🏫' },
  viewer: { label: 'ผู้สังเกตการณ์', icon: '👁️' }
};

// Persist students to localStorage
function getStudents() {
  const stored = localStorage.getItem('fa_students');
  return stored ? JSON.parse(stored) : MOCK_STUDENTS;
}

function saveStudents(students) {
  localStorage.setItem('fa_students', JSON.stringify(students));
}

function getAttendance() {
  const stored = localStorage.getItem('fa_attendance');
  return stored ? JSON.parse(stored) : MOCK_ATTENDANCE;
}

function saveAttendance(records) {
  localStorage.setItem('fa_attendance', JSON.stringify(records));
}

function getTodayAttendance() {
  const today = new Date().toISOString().split('T')[0];
  return getAttendance().filter(r => r.date === today);
}
