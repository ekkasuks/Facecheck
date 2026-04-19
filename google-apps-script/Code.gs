// ============================================
// Google Apps Script — FaceAttend API
// วางโค้ดนี้ใน Google Apps Script แล้ว Deploy เป็น Web App
// ============================================

const SHEET_ID = 'YOUR_GOOGLE_SHEET_ID'; // ← แทนที่ด้วย Sheet ID จริง
const DRIVE_FOLDER_ID = 'YOUR_DRIVE_FOLDER_ID'; // ← แทนที่ด้วย Folder ID จริง
const SECRET_KEY = 'YOUR_SECRET_KEY_HERE'; // ← กำหนด secret key

// Sheet names
const SHEETS = {
  STUDENTS: 'Students',
  ATTENDANCE: 'Attendance',
  USERS: 'Users',
  SETTINGS: 'Settings',
  AUDIT: 'AuditLog'
};

// ── Main Handler ─────────────────────────────────────────────
function doGet(e) {
  return handleRequest(e, 'GET');
}

function doPost(e) {
  return handleRequest(e, 'POST');
}

function handleRequest(e, method) {
  // CORS headers
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  try {
    const params = method === 'GET' ? e.parameter : JSON.parse(e.postData.contents || '{}');
    const action = params.action || e.parameter?.action || '';
    const token = params.token || '';

    // Public endpoints (no auth needed)
    const publicActions = ['login', 'ping'];
    if (!publicActions.includes(action)) {
      const authResult = verifyToken(token);
      if (!authResult.valid) {
        return respond({ success: false, error: 'Unauthorized', code: 401 });
      }
    }

    let result;
    switch (action) {
      case 'ping': result = { pong: true, version: '2.1.0', time: new Date().toISOString() }; break;
      case 'login': result = handleLogin(params); break;

      // Students
      case 'getStudents': result = getStudents(params); break;
      case 'addStudent': result = addStudent(params); break;
      case 'updateStudent': result = updateStudent(params); break;
      case 'deleteStudent': result = deleteStudent(params); break;

      // Attendance
      case 'checkAttendance': result = checkAttendance(params); break;
      case 'getAttendance': result = getAttendance(params); break;
      case 'updateAttendanceStatus': result = updateAttendanceStatus(params); break;

      // Dashboard
      case 'getDashboard': result = getDashboard(params); break;
      case 'getClassSummary': result = getClassSummary(params); break;

      // Face Image
      case 'uploadFaceImage': result = uploadFaceImage(params); break;
      case 'saveFaceDescriptor': result = saveFaceDescriptor(params); break;

      // Settings
      case 'getSettings': result = getSchoolSettings(); break;
      case 'saveSettings': result = saveSchoolSettings(params); break;

      default: result = { error: 'Unknown action: ' + action };
    }

    return respond({ success: true, data: result });

  } catch (err) {
    logAudit('ERROR', 'system', err.message);
    return respond({ success: false, error: err.message, stack: err.stack });
  }
}

function respond(data) {
  const json = JSON.stringify(data);
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

// ── Auth ─────────────────────────────────────────────────────
function handleLogin(params) {
  const { email, password } = params;
  const sheet = getSheet(SHEETS.USERS);
  const rows = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    const [userEmail, name, role, rooms, hash] = rows[i];
    if (userEmail === email) {
      const passwordHash = Utilities.computeDigest(
        Utilities.DigestAlgorithm.SHA_256,
        password + SECRET_KEY
      ).map(b => (b + 256).toString(16).slice(-2)).join('');

      if (passwordHash === hash) {
        const token = Utilities.base64Encode(
          JSON.stringify({ email, role, exp: Date.now() + 86400000 })
        );
        logAudit('LOGIN', email, `Login success — role: ${role}`);
        return { token, email, name, role, rooms };
      }
    }
  }
  throw new Error('Invalid credentials');
}

function verifyToken(token) {
  try {
    if (!token) return { valid: false };
    const payload = JSON.parse(Utilities.newBlob(Utilities.base64Decode(token)).getDataAsString());
    if (payload.exp < Date.now()) return { valid: false, error: 'Token expired' };
    return { valid: true, payload };
  } catch (e) {
    return { valid: false, error: e.message };
  }
}

// ── Students ─────────────────────────────────────────────────
function getStudents(params) {
  const sheet = getSheet(SHEETS.STUDENTS);
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  const students = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row[0]) continue;
    const s = {};
    headers.forEach((h, j) => { s[h] = row[j]; });

    // Filter by class/room if specified
    if (params.class && s.classLevel !== params.class) continue;
    if (params.room && s.room !== params.room) continue;

    // Parse face descriptor
    if (s.faceDescriptorJson) {
      try { s.faceDescriptor = JSON.parse(s.faceDescriptorJson); } catch (e) {}
    }
    delete s.faceDescriptorJson;
    students.push(s);
  }
  return students;
}

function addStudent(params) {
  const sheet = getSheet(SHEETS.STUDENTS);
  const id = params.studentId || generateId('S');

  // Check duplicate
  const existing = sheet.getDataRange().getValues();
  for (let i = 1; i < existing.length; i++) {
    if (existing[i][0] === id) throw new Error(`Student ID ${id} already exists`);
  }

  const descriptorJson = params.faceDescriptor ? JSON.stringify(params.faceDescriptor) : '';
  const newRow = [
    id, params.prefix || '', params.firstName, params.lastName,
    params.classLevel || params.class, params.room, params.number || 1,
    params.gender || 'ชาย', params.faceImageUrl || '', descriptorJson,
    'active', new Date().toISOString()
  ];
  sheet.appendRow(newRow);
  logAudit('ADD_STUDENT', id, `${params.prefix}${params.firstName} ${params.lastName}`);
  return { id, success: true };
}

function updateStudent(params) {
  const sheet = getSheet(SHEETS.STUDENTS);
  const rows = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === params.studentId) {
      if (params.firstName) sheet.getRange(i + 1, 3).setValue(params.firstName);
      if (params.lastName) sheet.getRange(i + 1, 4).setValue(params.lastName);
      if (params.classLevel) sheet.getRange(i + 1, 5).setValue(params.classLevel);
      if (params.room) sheet.getRange(i + 1, 6).setValue(params.room);
      if (params.faceImageUrl) sheet.getRange(i + 1, 9).setValue(params.faceImageUrl);
      if (params.faceDescriptor) sheet.getRange(i + 1, 10).setValue(JSON.stringify(params.faceDescriptor));
      logAudit('UPDATE_STUDENT', params.studentId, 'Updated');
      return { success: true };
    }
  }
  throw new Error('Student not found');
}

function deleteStudent(params) {
  const sheet = getSheet(SHEETS.STUDENTS);
  const rows = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === params.studentId) {
      sheet.deleteRow(i + 1);
      logAudit('DELETE_STUDENT', params.studentId, 'Deleted');
      return { success: true };
    }
  }
  throw new Error('Student not found');
}

// ── Attendance ───────────────────────────────────────────────
function checkAttendance(params) {
  const { studentId, method, deviceId, note } = params;
  const sheet = getSheet(SHEETS.ATTENDANCE);

  const now = new Date();
  const dateStr = Utilities.formatDate(now, 'Asia/Bangkok', 'yyyy-MM-dd');
  const timeStr = Utilities.formatDate(now, 'Asia/Bangkok', 'HH:mm');

  // Check duplicate
  const existingRows = sheet.getDataRange().getValues();
  const dupMinutes = parseInt(getSettingValue('checkDuplicateMinutes')) || 10;
  const dupMs = dupMinutes * 60 * 1000;

  for (let i = 1; i < existingRows.length; i++) {
    const row = existingRows[i];
    if (row[3] === studentId && row[1] === dateStr) {
      const rowTime = new Date(`${dateStr}T${row[2]}:00+07:00`);
      if (now - rowTime < dupMs) {
        return { duplicate: true, message: 'นักเรียนคนนี้เช็คชื่อแล้ว', existingTime: row[2] };
      }
    }
  }

  // Determine status
  const lateTime = getSettingValue('lateTime') || '08:30';
  const [lh, lm] = lateTime.split(':').map(Number);
  const [ch, cm] = timeStr.split(':').map(Number);
  const status = (ch > lh || (ch === lh && cm > lm)) ? 'late' : 'present';

  // Get student name
  const students = getStudents({});
  const student = students.find(s => s.studentId === studentId);
  const studentName = student ? `${student.prefix}${student.firstName} ${student.lastName}` : studentId;

  const attendanceId = generateId('A');
  const newRow = [
    attendanceId, dateStr, timeStr, studentId,
    studentName, student?.classLevel || '', student?.room || '',
    status, method || 'face', deviceId || 'DEVICE-01', note || '',
    new Date().toISOString()
  ];
  sheet.appendRow(newRow);

  return {
    attendanceId, studentId, studentName,
    date: dateStr, time: timeStr, status,
    class: student?.classLevel, room: student?.room
  };
}

function getAttendance(params) {
  const sheet = getSheet(SHEETS.ATTENDANCE);
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  const records = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row[0]) continue;
    const r = {};
    headers.forEach((h, j) => { r[h] = row[j]; });

    if (params.date && r.date !== params.date) continue;
    if (params.studentId && r.studentId !== params.studentId) continue;
    if (params.class && r.classLevel !== params.class) continue;
    if (params.dateFrom && r.date < params.dateFrom) continue;
    if (params.dateTo && r.date > params.dateTo) continue;
    records.push(r);
  }
  return records;
}

function updateAttendanceStatus(params) {
  const sheet = getSheet(SHEETS.ATTENDANCE);
  const rows = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === params.attendanceId || (rows[i][3] === params.studentId && rows[i][1] === params.date)) {
      sheet.getRange(i + 1, 8).setValue(params.status);
      sheet.getRange(i + 1, 11).setValue(params.note || 'แก้ไขย้อนหลัง');
      logAudit('UPDATE_ATTENDANCE', params.studentId, `Status → ${params.status}`);
      return { success: true };
    }
  }
  throw new Error('Attendance record not found');
}

// ── Dashboard ────────────────────────────────────────────────
function getDashboard(params) {
  const { range } = params;
  const now = new Date();
  let dateFrom, dateTo;

  if (range === 'today') {
    dateFrom = dateTo = Utilities.formatDate(now, 'Asia/Bangkok', 'yyyy-MM-dd');
  } else if (range === 'week') {
    const mon = new Date(now); mon.setDate(now.getDate() - now.getDay() + 1);
    dateFrom = Utilities.formatDate(mon, 'Asia/Bangkok', 'yyyy-MM-dd');
    dateTo = Utilities.formatDate(now, 'Asia/Bangkok', 'yyyy-MM-dd');
  } else {
    dateFrom = Utilities.formatDate(new Date(now.getFullYear(), now.getMonth(), 1), 'Asia/Bangkok', 'yyyy-MM-dd');
    dateTo = Utilities.formatDate(now, 'Asia/Bangkok', 'yyyy-MM-dd');
  }

  const records = getAttendance({ dateFrom, dateTo });
  const students = getStudents({});

  const counts = { present: 0, late: 0, absent: 0, leave: 0 };
  const seen = new Set();
  records.forEach(r => {
    const key = `${r.studentId}_${r.date}`;
    if (!seen.has(key)) { seen.add(key); counts[r.status] = (counts[r.status] || 0) + 1; }
  });

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const presentRate = total > 0 ? ((counts.present / total) * 100).toFixed(1) : 0;

  return { counts, total, presentRate, students: students.length, range: { dateFrom, dateTo } };
}

function getClassSummary(params) {
  const students = getStudents(params);
  const records = getAttendance(params);
  const classMap = {};

  students.forEach(s => {
    const key = `${s.classLevel}/${s.room}`;
    if (!classMap[key]) classMap[key] = { class: s.classLevel, room: s.room, total: 0, present: 0, late: 0, absent: 0 };
    classMap[key].total++;
  });

  records.forEach(r => {
    const key = `${r.classLevel}/${r.room}`;
    if (classMap[key]) {
      if (r.status === 'present') classMap[key].present++;
      else if (r.status === 'late') classMap[key].late++;
      else if (r.status === 'absent') classMap[key].absent++;
    }
  });

  return Object.values(classMap).map(c => ({
    ...c,
    rate: c.total > 0 ? ((c.present + c.late) / c.total * 100).toFixed(1) : 0
  })).sort((a, b) => b.rate - a.rate);
}

// ── Face Image ───────────────────────────────────────────────
function uploadFaceImage(params) {
  const { studentId, imageBase64, mimeType } = params;
  const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
  const faceFolder = getOrCreateSubfolder(folder, 'Faces');

  const imageData = Utilities.base64Decode(imageBase64.replace(/^data:image\/\w+;base64,/, ''));
  const blob = Utilities.newBlob(imageData, mimeType || 'image/jpeg', `${studentId}.jpg`);
  const file = faceFolder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  const fileId = file.getId();
  const imageUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;

  logAudit('UPLOAD_FACE', studentId, `Image uploaded: ${fileId}`);
  return { fileId, imageUrl };
}

function saveFaceDescriptor(params) {
  return updateStudent({
    studentId: params.studentId,
    faceDescriptor: params.descriptor,
    faceImageUrl: params.imageUrl
  });
}

// ── Settings ─────────────────────────────────────────────────
function getSchoolSettings() {
  const sheet = getSheet(SHEETS.SETTINGS);
  const rows = sheet.getDataRange().getValues();
  const settings = {};
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0]) settings[rows[i][0]] = rows[i][1];
  }
  return settings;
}

function getSettingValue(key) {
  const settings = getSchoolSettings();
  return settings[key] || null;
}

function saveSchoolSettings(params) {
  const sheet = getSheet(SHEETS.SETTINGS);
  const rows = sheet.getDataRange().getValues();
  const { key, value } = params;

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      return { success: true };
    }
  }
  sheet.appendRow([key, value, new Date().toISOString()]);
  return { success: true };
}

// ── Helpers ──────────────────────────────────────────────────
function getSheet(name) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    initSheetHeaders(sheet, name);
  }
  return sheet;
}

function initSheetHeaders(sheet, name) {
  const headers = {
    [SHEETS.STUDENTS]: ['studentId','prefix','firstName','lastName','classLevel','room','number','gender','faceImageUrl','faceDescriptorJson','activeStatus','createdAt'],
    [SHEETS.ATTENDANCE]: ['attendanceId','date','time','studentId','studentName','classLevel','room','status','method','deviceId','note','createdAt'],
    [SHEETS.USERS]: ['email','name','role','allowedClassRoom','passwordHash','createdAt'],
    [SHEETS.SETTINGS]: ['key','value','updatedAt'],
    [SHEETS.AUDIT]: ['timestamp','action','userId','detail']
  };
  if (headers[name]) {
    sheet.appendRow(headers[name]);
    sheet.getRange(1, 1, 1, headers[name].length).setFontWeight('bold').setBackground('#4f46e5').setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  }
}

function getOrCreateSubfolder(parent, name) {
  const folders = parent.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : parent.createFolder(name);
}

function generateId(prefix) {
  return `${prefix}${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

function logAudit(action, userId, detail) {
  try {
    const sheet = getSheet(SHEETS.AUDIT);
    sheet.appendRow([new Date().toISOString(), action, userId, detail]);
  } catch (e) {}
}

// ── Setup Function (รันครั้งแรกเพื่อสร้าง Sheets) ────────────
function setupSheets() {
  Object.values(SHEETS).forEach(name => {
    const sheet = getSheet(name);
    Logger.log(`Sheet "${name}" ready`);
  });

  // Add default settings
  const settingsSheet = getSheet(SHEETS.SETTINGS);
  const defaults = [
    ['schoolName', 'โรงเรียนสาธิตมหาวิทยาลัย'],
    ['schoolLogoUrl', ''],
    ['checkDuplicateMinutes', '10'],
    ['lateTime', '08:30'],
    ['absentTime', '10:00'],
    ['faceThreshold', '0.5']
  ];
  defaults.forEach(([k, v]) => {
    const rows = settingsSheet.getDataRange().getValues();
    const exists = rows.some(r => r[0] === k);
    if (!exists) settingsSheet.appendRow([k, v, new Date().toISOString()]);
  });

  // Add default admin user
  const usersSheet = getSheet(SHEETS.USERS);
  const userRows = usersSheet.getDataRange().getValues();
  if (userRows.length <= 1) {
    const hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, 'admin1234' + SECRET_KEY)
      .map(b => (b + 256).toString(16).slice(-2)).join('');
    usersSheet.appendRow(['admin@school.ac.th', 'ผู้ดูแลระบบ', 'admin', 'all', hash, new Date().toISOString()]);
  }

  Logger.log('✅ Setup complete!');
}

// ── Sample Data (รันเพื่อเพิ่มข้อมูลตัวอย่าง) ────────────────
function insertSampleData() {
  const sampleStudents = [
    ['S001','ด.ช.','ธนกฤต','มั่นคง','ม.1','1',1,'ชาย','','','active'],
    ['S002','ด.ญ.','พิชญา','สุวรรณ','ม.1','1',2,'หญิง','','','active'],
    ['S003','ด.ช.','กิตติภูมิ','โชติกิจ','ม.1','1',3,'ชาย','','','active'],
    ['S004','ด.ญ.','ณัฐนรี','ทองดี','ม.1','2',1,'หญิง','','','active'],
    ['S005','ด.ช.','ชยานันต์','พิสุทธิ์','ม.2','1',1,'ชาย','','','active'],
  ];

  const sheet = getSheet(SHEETS.STUDENTS);
  sampleStudents.forEach(row => sheet.appendRow([...row, new Date().toISOString()]));
  Logger.log(`✅ Inserted ${sampleStudents.length} sample students`);
}
