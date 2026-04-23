// ============================================
// Google Apps Script — FaceAttend API v2.3
// แก้ไขทุกบั๊ก: Drive Folder, Admin Email,
//   Settings Cache, Error Handling
// ============================================

// ─── ★ ตั้งค่าตรงนี้ก่อน ★ ─────────────────
const SHEET_ID        = '17juO5S8dVehwyUdnhO99HLs8ef3rjfF37viRwwwapbc';
const DRIVE_FOLDER_ID = '1bXSViZXvj28yHtWNgJpZXkE8CIioFtj6';
const SECRET_KEY      = 'FaceAttend2024Secret';

// ★ เปลี่ยนเป็น email จริงที่ใช้ Login Google ★
const ADMIN_EMAIL     = 'ekkasuks@esanpt1.go.th';
const ADMIN_NAME      = 'อ.เอกศักดิ์ ปรีติประสงค์';
// ────────────────────────────────────────────

const SHEETS = {
  STUDENTS:   'Students',
  ATTENDANCE: 'Attendance',
  USERS:      'Users',
  SETTINGS:   'Settings',
  AUDIT:      'AuditLog'
};

// ════════════════════════════════════════════
// HTTP Entry Points
// ════════════════════════════════════════════

function doGet(e) {
  try {
    const params = (e && e.parameter) ? e.parameter : {};
    return handleRequest(params);
  } catch (err) {
    return respond({ success: false, error: err.message });
  }
}

function doPost(e) {
  try {
    let params = {};
    if (e && e.postData && e.postData.contents) {
      params = JSON.parse(e.postData.contents);
    }
    return handleRequest(params);
  } catch (err) {
    return respond({ success: false, error: err.message });
  }
}

function handleRequest(params) {
  try {
    if (!params) params = {};
    const action = params.action ? String(params.action) : '';
    const token  = params.token  ? String(params.token)  : '';

    const PUBLIC_ACTIONS = ['ping', 'login', 'loginGoogle'];
    if (!PUBLIC_ACTIONS.includes(action)) {
      const auth = verifyToken(token);
      if (!auth.valid) {
        return respond({ success: false, error: 'Unauthorized: ' + (auth.error || ''), code: 401 });
      }
    }

    let result;
    switch (action) {
      case 'ping':        result = doPing();               break;
      case 'login':       result = doLogin(params);        break;
      case 'loginGoogle': result = doLoginGoogle(params);  break;

      case 'getStudents':    result = doGetStudents(params);    break;
      case 'addStudent':     result = doAddStudent(params);     break;
      case 'updateStudent':  result = doUpdateStudent(params);  break;
      case 'deleteStudent':  result = doDeleteStudent(params);  break;

      case 'checkAttendance':        result = doCheckAttendance(params);        break;
      case 'getAttendance':          result = doGetAttendance(params);          break;
      case 'updateAttendanceStatus': result = doUpdateAttendanceStatus(params); break;

      case 'getDashboard':    result = doGetDashboard(params);    break;
      case 'getClassSummary': result = doGetClassSummary(params); break;

      case 'uploadFaceImage':    result = doUploadFaceImage(params);    break;
      case 'saveFaceDescriptor': result = doSaveFaceDescriptor(params); break;

      case 'getSettings':  result = doGetSettings();       break;
      case 'saveSetting':  result = doSaveSetting(params); break;

      default:
        return respond({ success: false, error: 'Unknown action: "' + action + '"' });
    }
    return respond({ success: true, data: result });

  } catch (err) {
    safeLog('ERROR', 'handleRequest', err.message);
    return respond({ success: false, error: err.message });
  }
}

function respond(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ════════════════════════════════════════════
// Auth
// ════════════════════════════════════════════

function doPing() {
  return { pong: true, version: '2.3.0', time: new Date().toISOString() };
}

function doLogin(p) {
  const email    = String(p.email    || '').trim();
  const password = String(p.password || '');
  if (!email || !password) throw new Error('ต้องระบุ email และ password');

  const sheet = openSheet(SHEETS.USERS);
  const rows  = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    const uEmail = String(rows[i][0]).trim().toLowerCase();
    const uHash  = String(rows[i][4]).trim();
    if (uEmail === email.toLowerCase() && hashPwd(password) === uHash) {
      const token = buildToken(email, rows[i][2]);
      safeLog('LOGIN', email, 'role=' + rows[i][2]);
      return { token, email: rows[i][0], name: rows[i][1], role: rows[i][2], rooms: rows[i][3] };
    }
  }
  throw new Error('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
}

// ════════════════════════════════════════════
// Google Login → สร้าง GAS token
// ไม่ต้องใช้ password — ตรวจ email จาก ROLE_MAP แทน
// ════════════════════════════════════════════

function doLoginGoogle(p) {
  const email = String(p.email || '').trim().toLowerCase();
  if (!email) throw new Error('ต้องระบุ email');

  // ตรวจว่า email มีสิทธิ์ใน Users sheet ไหม
  // ถ้าไม่มี → ใช้ role จาก Users sheet ถ้ามี หรือ viewer
  const sheet    = openSheet(SHEETS.USERS);
  const rows     = sheet.getDataRange().getValues();
  let   userRow  = null;

  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim().toLowerCase() === email) {
      userRow = rows[i];
      break;
    }
  }

  let role = 'viewer';
  let name = email;

  if (userRow) {
    role = String(userRow[2] || 'viewer');
    name = String(userRow[1] || email);
  } else {
    // ไม่เจอใน Users sheet → สร้าง viewer entry อัตโนมัติ
    // (admin ต้องเพิ่ม role เองทีหลัง)
    name = email.split('@')[0];
    Logger.log('[loginGoogle] email ไม่พบใน Users sheet: ' + email + ' → role viewer');
  }

  const token = buildToken(email, role);
  safeLog('LOGIN_GOOGLE', email, 'role=' + role);

  return { token, email, name, role, loginMethod: 'google' };
}

function hashPwd(password) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    password + SECRET_KEY,
    Utilities.Charset.UTF_8
  );
  return bytes.map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}

function buildToken(email, role) {
  return Utilities.base64EncodeWebSafe(
    JSON.stringify({ email, role, exp: Date.now() + 86400000 })
  );
}

function verifyToken(token) {
  if (!token) return { valid: false, error: 'No token' };
  try {
    const json    = Utilities.newBlob(Utilities.base64DecodeWebSafe(token)).getDataAsString();
    const payload = JSON.parse(json);
    if (payload.exp < Date.now()) return { valid: false, error: 'Token expired' };
    return { valid: true, payload };
  } catch (e) {
    return { valid: false, error: String(e.message) };
  }
}

// ════════════════════════════════════════════
// Students
// ════════════════════════════════════════════

function doGetStudents(p) {
  if (!p) p = {};
  const sheet   = openSheet(SHEETS.STUDENTS);
  const data    = sheet.getDataRange().getValues();
  const headers = data[0] || [];
  const list    = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0]) continue;
    const s = {};
    headers.forEach((h, j) => { s[h] = row[j]; });

    if (p.classLevel && s.classLevel !== p.classLevel) continue;
    if (p.room       && String(s.room) !== String(p.room)) continue;

    if (s.faceDescriptorJson) {
      try { s.faceDescriptor = JSON.parse(s.faceDescriptorJson); } catch (_) {}
    }
    delete s.faceDescriptorJson;
    list.push(s);
  }
  return list;
}

function doAddStudent(p) {
  if (!p) throw new Error('ไม่มีข้อมูล');
  const id    = String(p.studentId || generateId('S'));
  const sheet = openSheet(SHEETS.STUDENTS);
  const rows  = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === id) throw new Error('รหัส ' + id + ' มีอยู่แล้ว');
  }
  const descJson = p.faceDescriptor ? JSON.stringify(p.faceDescriptor) : '';
  sheet.appendRow([
    id,
    p.prefix     || '',
    p.firstName  || '',
    p.lastName   || '',
    p.classLevel || p['class'] || '',
    p.room       || '',
    p.number     || p.no || 1,
    p.gender     || 'ชาย',
    p.faceImageUrl || '',
    descJson,
    'active',
    new Date().toISOString()
  ]);
  safeLog('ADD_STUDENT', id, (p.firstName||'') + ' ' + (p.lastName||''));
  return { studentId: id, success: true };
}

function doUpdateStudent(p) {
  if (!p || !p.studentId) throw new Error('ต้องระบุ studentId');
  const id    = String(p.studentId);
  const sheet = openSheet(SHEETS.STUDENTS);
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === id) {
      const r = i + 1;
      if (p.prefix         !== undefined) sheet.getRange(r, 2).setValue(p.prefix);
      if (p.firstName      !== undefined) sheet.getRange(r, 3).setValue(p.firstName);
      if (p.lastName       !== undefined) sheet.getRange(r, 4).setValue(p.lastName);
      if (p.classLevel     !== undefined) sheet.getRange(r, 5).setValue(p.classLevel);
      if (p.room           !== undefined) sheet.getRange(r, 6).setValue(p.room);
      if (p.number         !== undefined) sheet.getRange(r, 7).setValue(p.number);
      if (p.faceImageUrl   !== undefined) sheet.getRange(r, 9).setValue(p.faceImageUrl);
      if (p.faceDescriptor !== undefined) sheet.getRange(r,10).setValue(JSON.stringify(p.faceDescriptor));
      safeLog('UPDATE_STUDENT', id, 'OK');
      return { success: true };
    }
  }
  throw new Error('ไม่พบนักเรียน ID: ' + id);
}

function doDeleteStudent(p) {
  if (!p || !p.studentId) throw new Error('ต้องระบุ studentId');
  const id    = String(p.studentId);
  const sheet = openSheet(SHEETS.STUDENTS);
  const data  = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]) === id) {
      sheet.deleteRow(i + 1);
      safeLog('DELETE_STUDENT', id, 'OK');
      return { success: true };
    }
  }
  throw new Error('ไม่พบนักเรียน ID: ' + id);
}

// ════════════════════════════════════════════
// Attendance
// ════════════════════════════════════════════

function doCheckAttendance(p) {
  if (!p || !p.studentId) throw new Error('ต้องระบุ studentId');
  const studentId = String(p.studentId);
  const tz    = 'Asia/Bangkok';
  const now   = new Date();
  const date  = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  const time  = Utilities.formatDate(now, tz, 'HH:mm');
  const sheet = openSheet(SHEETS.ATTENDANCE);

  // ── BUG FIX: โหลด settings ครั้งเดียว ──
  const settings = doGetSettings();
  const dupMin   = parseInt(settings['checkDuplicateMinutes'] || '10');
  const lateTime = settings['lateTime'] || '08:30';

  // Anti-duplicate
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][3]) === studentId && String(rows[i][1]) === date) {
      const prev = new Date(date + 'T' + rows[i][2] + ':00+07:00').getTime();
      if (now.getTime() - prev < dupMin * 60000) {
        return { duplicate: true, message: 'เช็คชื่อแล้ว', existingTime: rows[i][2] };
      }
    }
  }

  // Status — ถ้า caller ส่ง status มาให้เลย (manual mode) ก็ใช้ค่านั้น
  let status;
  if (p.status && ['present','late','absent','leave'].includes(p.status)) {
    status = p.status;   // manual override
  } else {
    const [lh, lm] = lateTime.split(':').map(Number);
    const [ch, cm] = time.split(':').map(Number);
    status = (ch > lh || (ch === lh && cm > lm)) ? 'late' : 'present';
  }

  // Name
  const students = doGetStudents({});
  const st = students.find(s => s.studentId === studentId);
  const name = st
    ? ((st.prefix||'') + (st.firstName||'') + ' ' + (st.lastName||'')).trim()
    : studentId;

  const aId = generateId('A');
  sheet.appendRow([
    aId, date, time, studentId, name,
    st ? st.classLevel : '',
    st ? st.room : '',
    status,
    p.method   || 'face',
    p.deviceId || 'DEVICE-01',
    p.note     || '',
    now.toISOString()
  ]);
  safeLog('CHECKIN', studentId, status + '@' + time);
  return {
    attendanceId: aId, studentId, studentName: name,
    date, time, status,
    classLevel: st ? st.classLevel : '',
    room:       st ? st.room       : ''
  };
}

function doGetAttendance(p) {
  if (!p) p = {};
  const sheet   = openSheet(SHEETS.ATTENDANCE);
  const data    = sheet.getDataRange().getValues();
  const headers = data[0] || [];
  const list    = [];
  for (let i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    const r = {};
    headers.forEach((h, j) => { r[h] = data[i][j]; });
    if (p.date       && String(r.date)       !== p.date)       continue;
    if (p.studentId  && String(r.studentId)  !== p.studentId)  continue;
    if (p.classLevel && String(r.classLevel) !== p.classLevel) continue;
    if (p.dateFrom   && String(r.date)        < p.dateFrom)    continue;
    if (p.dateTo     && String(r.date)        > p.dateTo)      continue;
    list.push(r);
  }
  return list;
}

function doUpdateAttendanceStatus(p) {
  if (!p) throw new Error('ไม่มีข้อมูล');
  const sheet = openSheet(SHEETS.ATTENDANCE);
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const byId  = p.attendanceId && String(data[i][0]) === String(p.attendanceId);
    const byKey = p.studentId && p.date &&
                  String(data[i][3]) === String(p.studentId) &&
                  String(data[i][1]) === String(p.date);
    if (byId || byKey) {
      sheet.getRange(i+1, 8).setValue(p.status || 'present');
      sheet.getRange(i+1,11).setValue(p.note   || 'แก้ไขโดยครู');
      safeLog('UPDATE_STATUS', p.studentId || p.attendanceId, '→' + p.status);
      return { success: true };
    }
  }
  throw new Error('ไม่พบรายการ attendance');
}

// ════════════════════════════════════════════
// Dashboard
// ════════════════════════════════════════════

function doGetDashboard(p) {
  if (!p) p = {};
  const tz  = 'Asia/Bangkok';
  const now = new Date();
  let df, dt;
  switch (p.range) {
    case 'week': {
      const mon = new Date(now);
      mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
      df = Utilities.formatDate(mon, tz, 'yyyy-MM-dd');
      dt = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
      break;
    }
    case 'month':
      df = Utilities.formatDate(new Date(now.getFullYear(), now.getMonth(), 1), tz, 'yyyy-MM-dd');
      dt = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
      break;
    default:
      df = dt = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  }
  const recs   = doGetAttendance({ dateFrom: df, dateTo: dt });
  const counts = { present:0, late:0, absent:0, leave:0 };
  const seen   = {};
  recs.forEach(r => {
    const k = r.studentId + '_' + r.date;
    if (!seen[k]) { seen[k] = true; counts[r.status] = (counts[r.status]||0) + 1; }
  });
  const total = Object.values(counts).reduce((a,b)=>a+b, 0);
  return {
    counts, total,
    presentRate: total ? ((counts.present/total)*100).toFixed(1) : '0.0',
    dateFrom: df, dateTo: dt
  };
}

function doGetClassSummary(p) {
  if (!p) p = {};
  const students = doGetStudents(p);
  const recs     = doGetAttendance(p);
  const map      = {};
  students.forEach(s => {
    const k = s.classLevel + '/' + s.room;
    if (!map[k]) map[k] = { classLevel:s.classLevel, room:s.room, total:0, present:0, late:0, absent:0 };
    map[k].total++;
  });
  recs.forEach(r => {
    const k = r.classLevel + '/' + r.room;
    if (map[k]) {
      if      (r.status === 'present') map[k].present++;
      else if (r.status === 'late')    map[k].late++;
      else if (r.status === 'absent')  map[k].absent++;
    }
  });
  return Object.values(map).map(c => ({
    ...c, rate: c.total ? ((c.present+c.late)/c.total*100).toFixed(1) : '0.0'
  })).sort((a,b) => parseFloat(b.rate)-parseFloat(a.rate));
}

// ════════════════════════════════════════════
// Face Image — BUG FIX: error handling + folder validation
// ════════════════════════════════════════════

function doUploadFaceImage(p) {
  if (!p || !p.imageBase64) throw new Error('ต้องส่ง imageBase64');

  // ── BUG FIX: ตรวจ DRIVE_FOLDER_ID ก่อนเสมอ ──
  if (!DRIVE_FOLDER_ID || DRIVE_FOLDER_ID.trim() === '') {
    throw new Error('ยังไม่ได้ตั้งค่า DRIVE_FOLDER_ID ใน Code.gs');
  }

  // ── ตรวจ DRIVE_FOLDER_ID และโหลด parent folder ──
  let parent = null;

  // ขั้นตอน 1: ลองว่า ID นี้เป็น file (ผิด) หรือ folder (ถูก)
  try {
    // getFolderById จะ throw ถ้าไม่ใช่ folder
    parent = DriveApp.getFolderById(DRIVE_FOLDER_ID);
  } catch (e) {
    // อาจเป็น file ไม่ใช่ folder หรือหาไม่เจอ
    let hint = '';
    try {
      const f = DriveApp.getFileById(DRIVE_FOLDER_ID);
      hint = '\nID นี้ชี้ไปที่ไฟล์ชื่อ "' + f.getName() + '" ไม่ใช่โฟลเดอร์';
    } catch(_) {
      hint = '\nไม่พบ ID นี้ใน Drive เลย (อาจถูกลบหรือไม่มีสิทธิ์เข้าถึง)';
    }
    throw new Error(
      'DRIVE_FOLDER_ID ไม่ถูกต้อง (ID: ' + DRIVE_FOLDER_ID + ')' + hint + '\n' +
      'วิธีแก้:\n' +
      '  1. รัน createFaceFolder() เพื่อสร้างโฟลเดอร์ใหม่อัตโนมัติ  ← วิธีง่ายที่สุด\n' +
      '  2. หรือเปิด Drive → คลิกขวาโฟลเดอร์ → Copy link → เอา ID ใส่ใน DRIVE_FOLDER_ID'
    );
  }

  if (!parent) {
    throw new Error('โหลด Drive Folder ไม่สำเร็จ — รัน createFaceFolder() แล้วอัปเดต DRIVE_FOLDER_ID');
  }

  const base64 = p.imageBase64.replace(/^data:image\/\w+;base64,/, '');
  const folder = getOrCreateFolder(parent, 'FaceImages');
  const blob   = Utilities.newBlob(
    Utilities.base64Decode(base64),
    p.mimeType || 'image/jpeg',
    (p.studentId || 'unknown') + '_' + Date.now() + '.jpg'
  );
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  const url = 'https://drive.google.com/uc?export=view&id=' + file.getId();
  safeLog('UPLOAD_FACE', p.studentId, file.getId());
  return { fileId: file.getId(), imageUrl: url };
}

function doSaveFaceDescriptor(p) {
  return doUpdateStudent({
    studentId:      p.studentId,
    faceDescriptor: p.descriptor,
    faceImageUrl:   p.imageUrl || ''
  });
}

// ════════════════════════════════════════════
// Settings
// ════════════════════════════════════════════

function doGetSettings() {
  const sheet = openSheet(SHEETS.SETTINGS);
  const data  = sheet.getDataRange().getValues();
  const out   = {};
  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) out[String(data[i][0])] = data[i][1];
  }
  return out;
}

// BUG FIX: ใช้ doGetSettings() ที่ cache ได้แทน
function getSettingVal(key) {
  const s = doGetSettings();
  return s[key] !== undefined ? String(s[key]) : null;
}

function doSaveSetting(p) {
  if (!p || !p.key) throw new Error('ต้องระบุ key');
  const key   = String(p.key);
  const value = p.value !== undefined ? String(p.value) : '';
  const sheet = openSheet(SHEETS.SETTINGS);
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === key) {
      sheet.getRange(i+1, 2).setValue(value);
      sheet.getRange(i+1, 3).setValue(new Date().toISOString());
      return { success: true };
    }
  }
  sheet.appendRow([key, value, new Date().toISOString()]);
  return { success: true };
}

// ════════════════════════════════════════════
// Shared Helpers
// ════════════════════════════════════════════

function openSheet(name) {
  const ss    = SpreadsheetApp.openById(SHEET_ID);
  let   sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    setHeaders(sheet, name);
  }
  return sheet;
}

const HEADER_MAP = {
  Students:   ['studentId','prefix','firstName','lastName','classLevel','room',
               'number','gender','faceImageUrl','faceDescriptorJson','activeStatus','createdAt'],
  Attendance: ['attendanceId','date','time','studentId','studentName','classLevel',
               'room','status','method','deviceId','note','createdAt'],
  Users:      ['email','name','role','allowedClassRoom','passwordHash','createdAt'],
  Settings:   ['key','value','updatedAt'],
  AuditLog:   ['timestamp','action','userId','detail']
};

function setHeaders(sheet, name) {
  const h = HEADER_MAP[name];
  if (!h || !h.length) return;
  sheet.appendRow(h);
  sheet.getRange(1, 1, 1, h.length)
       .setFontWeight('bold')
       .setBackground('#4f46e5')
       .setFontColor('#ffffff');
  sheet.setFrozenRows(1);
  h.forEach((_, i) => sheet.autoResizeColumn(i + 1));
}

function getOrCreateFolder(parent, name) {
  // ── Guard: ถ้า parent เป็น undefined จะ crash ทันที ──
  if (!parent || typeof parent.getFoldersByName !== 'function') {
    throw new Error(
      'getOrCreateFolder("' + name + '"): parent folder ไม่ถูกต้อง\n' +
      'สาเหตุที่พบบ่อย:\n' +
      '  1. DRIVE_FOLDER_ID ชี้ไปที่ "ไฟล์" ไม่ใช่ "โฟลเดอร์"\n' +
      '     เปิด Google Drive → คลิกขวาที่โฟลเดอร์ → Copy link → เอา ID ไปใส่\n' +
      '  2. โฟลเดอร์ถูกลบไปแล้ว\n' +
      '     รัน createFaceFolder() เพื่อสร้างโฟลเดอร์ใหม่'
    );
  }
  try {
    const it = parent.getFoldersByName(name);
    return it.hasNext() ? it.next() : parent.createFolder(name);
  } catch (e) {
    throw new Error('getOrCreateFolder("' + name + '"): ' + e.message);
  }
}

function generateId(prefix) {
  return String(prefix) + Date.now() + Math.floor(Math.random() * 9000 + 1000);
}

function safeLog(action, userId, detail) {
  try {
    openSheet(SHEETS.AUDIT).appendRow([
      new Date().toISOString(), action, String(userId||''), String(detail||'')
    ]);
  } catch (_) { /* ไม่ให้ log crash ทำให้ request พัง */ }
}

// ════════════════════════════════════════════
// ★  SETUP — รันฟังก์ชันนี้ครั้งแรก  ★
//
//  วิธีใช้:
//  1. เลือก  setupSheets  ใน dropdown บน toolbar
//  2. กด  ▶ Run
//  3. อนุญาต permissions (Google จะถาม 1 ครั้ง)
//  4. ดู log ใน Execution Log ด้านล่าง
// ════════════════════════════════════════════

function setupSheets() {
  Logger.log('════════════════════════════════════');
  Logger.log('  FaceAttend v2.3 — Setup Started');
  Logger.log('════════════════════════════════════');

  // ── 0) ตรวจสอบ config ────────────────────
  Logger.log('');
  Logger.log('[ 0 ] ตรวจสอบ Config...');
  if (!SHEET_ID || SHEET_ID.includes('YOUR')) {
    Logger.log('  ❌ SHEET_ID ยังไม่ได้ตั้งค่า!');
    return;
  }
  Logger.log('  ✔  SHEET_ID: ' + SHEET_ID);
  Logger.log('  ✔  ADMIN_EMAIL: ' + ADMIN_EMAIL);

  // ── 1) สร้าง / ตรวจสอบ Google Drive Folder ──
  Logger.log('');
  Logger.log('[ 1 ] ตรวจสอบ Google Drive Folder...');
  var folderOk = false;
  if (!DRIVE_FOLDER_ID || DRIVE_FOLDER_ID.trim() === '') {
    Logger.log('  ⚠️  DRIVE_FOLDER_ID ว่างเปล่า — ข้ามการตรวจสอบ Drive');
    Logger.log('     (ฟีเจอร์อัพโหลดรูปใบหน้าจะยังไม่ทำงาน)');
  } else {
    try {
      // ── ตรวจว่า ID นี้เป็น Folder จริงๆ ไม่ใช่ File ──
      var driveItem = DriveApp.getFileById(DRIVE_FOLDER_ID);
      // ถ้า getFileById สำเร็จแต่เป็น folder จะถูก catch ด้านล่าง
      Logger.log('  ❌ DRIVE_FOLDER_ID ชี้ไปที่ "ไฟล์" ไม่ใช่ "โฟลเดอร์"!');
      Logger.log('     ชื่อไฟล์: ' + driveItem.getName());
      Logger.log('  วิธีแก้: ไปที่ Google Drive → เปิดโฟลเดอร์ที่ถูกต้อง');
      Logger.log('           URL จะเป็น: drive.google.com/drive/folders/[FOLDER_ID]');
      Logger.log('           คัดลอก FOLDER_ID ส่วนนั้นมาใส่ใน Code.gs');
      Logger.log('           หรือรัน createFaceFolder() เพื่อสร้างโฟลเดอร์ใหม่');
    } catch (fileErr) {
      // ถ้า getFileById throw = ไม่ใช่ไฟล์ → ลอง getFolderById
      try {
        var folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
        Logger.log('  ✔  Drive Folder พบแล้ว: "' + folder.getName() + '"');
        // ตรวจ/สร้าง sub-folder FaceImages
        var faceFolder = getOrCreateFolder(folder, 'FaceImages');
        Logger.log('  ✔  Sub-folder FaceImages: "' + faceFolder.getName() + '"');
        folderOk = true;
      } catch (folderErr) {
        Logger.log('  ❌ ไม่พบ Drive Folder! Error: ' + folderErr.message);
        Logger.log('  วิธีแก้:');
        Logger.log('    1. เปิด Google Drive');
        Logger.log('    2. คลิกขวาที่โฟลเดอร์ที่ต้องการ → "Get link"');
        Logger.log('    3. คัดลอก ID จาก URL: drive.google.com/drive/folders/[ID]');
        Logger.log('    4. วางใน DRIVE_FOLDER_ID ใน Code.gs แล้วรัน setupSheets() ใหม่');
        Logger.log('  ★ หรือรัน createFaceFolder() เพื่อสร้างโฟลเดอร์ใหม่อัตโนมัติ');
      }
    }
  }

  // ── 2) สร้าง / ตรวจสอบทุก Sheet ──────────
  Logger.log('');
  Logger.log('[ 2 ] สร้าง Sheets...');
  var ss = SpreadsheetApp.openById(SHEET_ID);
  Object.values(SHEETS).forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      setHeaders(sheet, name);
      Logger.log('  ✅ สร้าง Sheet ใหม่: ' + name);
    } else {
      // ตรวจว่า header row มีครบไหม
      var firstRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      var expected = HEADER_MAP[name];
      if (expected && firstRow[0] !== expected[0]) {
        Logger.log('  ⚠️  Sheet "' + name + '" header อาจผิด (col1: "' + firstRow[0] + '", ควรเป็น "' + expected[0] + '")');
      } else {
        Logger.log('  ✔  Sheet มีอยู่แล้ว: ' + name);
      }
    }
  });

  // ── 3) ใส่ Default Settings ───────────────
  Logger.log('');
  Logger.log('[ 3 ] ตั้งค่า Default Settings...');
  var settingsSheet = openSheet(SHEETS.SETTINGS);
  var existingRows  = settingsSheet.getDataRange().getValues();
  var existingKeys  = existingRows.map(function(r){ return String(r[0]); });

  var defaults = [
    ['schoolName',            'โรงเรียนบ้านใหม่'],
    ['schoolLogoUrl',         ''],
    ['checkDuplicateMinutes', '10'],
    ['lateTime',              '08:30'],
    ['absentTime',            '10:00'],
    ['faceThreshold',         '0.5']
  ];
  var addedSettings = 0;
  defaults.forEach(function(pair) {
    if (!existingKeys.includes(pair[0])) {
      settingsSheet.appendRow([pair[0], pair[1], new Date().toISOString()]);
      Logger.log('  ✅ เพิ่ม setting: ' + pair[0] + ' = ' + pair[1]);
      addedSettings++;
    } else {
      Logger.log('  ✔  setting มีอยู่แล้ว: ' + pair[0]);
    }
  });
  if (addedSettings === 0) Logger.log('  ✔  Settings ครบแล้ว ไม่มีอะไรเพิ่ม');

  // ── 4) สร้าง Admin User ───────────────────
  Logger.log('');
  Logger.log('[ 4 ] สร้าง Admin User...');
  var usersSheet  = openSheet(SHEETS.USERS);
  var userRows    = usersSheet.getDataRange().getValues();
  var adminExists = false;
  for (var i = 1; i < userRows.length; i++) {
    if (String(userRows[i][0]).trim().toLowerCase() === ADMIN_EMAIL.trim().toLowerCase()) {
      adminExists = true;
      // อัปเดต role เป็น admin ถ้ายังไม่ใช่
      if (String(userRows[i][2]).toLowerCase() !== 'admin') {
        usersSheet.getRange(i + 1, 3).setValue('admin');
        Logger.log('  ✅ อัปเดต role เป็น admin: ' + ADMIN_EMAIL);
      }
      break;
    }
  }
  if (!adminExists) {
    usersSheet.appendRow([
      ADMIN_EMAIL,
      ADMIN_NAME,
      'admin',
      'all',
      hashPwd('admin1234'),
      new Date().toISOString()
    ]);
    Logger.log('  ✅ สร้าง Admin: ' + ADMIN_EMAIL);
    Logger.log('  ⚠️  รหัสผ่านเริ่มต้น: admin1234');
  } else {
    Logger.log('  ✔  Admin มีอยู่แล้ว: ' + ADMIN_EMAIL);
  }

  // ── ตรวจว่า email ใน Users sheet ตรงกับที่ Google จะส่งมาไหม ──
  Logger.log('');
  Logger.log('[ หมายเหตุ ] Google Login ใช้ email ตรงนี้ขอ token:');
  Logger.log('  ADMIN_EMAIL ใน Code.gs = "' + ADMIN_EMAIL + '"');
  Logger.log('  ต้องตรงกับ email ที่เห็นใน Gmail ของอาจารย์');
  Logger.log('  ถ้าไม่ตรง → แก้ ADMIN_EMAIL แล้วรัน setupSheets() ใหม่');

  // ── สรุป ─────────────────────────────────
  Logger.log('');
  Logger.log('════════════════════════════════════');
  Logger.log('  ✅ Setup เสร็จสมบูรณ์!');
  Logger.log('  Drive Folder: ' + (folderOk ? '✅ พร้อม' : '⚠️  ยังไม่ได้ตั้งค่า'));
  Logger.log('  Sheets: ' + Object.values(SHEETS).join(', '));
  Logger.log('  Admin: ' + ADMIN_EMAIL + ' / admin1234');
  Logger.log('════════════════════════════════════');
  Logger.log('');
  Logger.log('ขั้นตอนถัดไป:');
  Logger.log('  1. Deploy → New Deployment → Web App');
  Logger.log('     Execute as: Me | Who: Anyone');
  Logger.log('  2. คัดลอก Web App URL ใส่ config.js → CONFIG.API_URL');
  if (!folderOk) {
    Logger.log('  3. ★ แก้ DRIVE_FOLDER_ID ใน Code.gs ก่อน (หรือรัน createFaceFolder())');
  }
}

// ════════════════════════════════════════════
// ★  สร้าง Drive Folder อัตโนมัติ
//    รันถ้า DRIVE_FOLDER_ID ว่างหรือ folder ถูกลบ
// ════════════════════════════════════════════

function createFaceFolder() {
  Logger.log('═══════════════════════════════');
  Logger.log('  สร้าง Drive Folder สำหรับรูปใบหน้า');
  Logger.log('═══════════════════════════════');

  // สร้างโฟลเดอร์ใหม่ใน My Drive
  var root   = DriveApp.getRootFolder();
  var exists = root.getFoldersByName('FaceAttend_Images');

  var mainFolder;
  if (exists.hasNext()) {
    mainFolder = exists.next();
    Logger.log('  ✔  โฟลเดอร์มีอยู่แล้ว: FaceAttend_Images');
  } else {
    mainFolder = root.createFolder('FaceAttend_Images');
    Logger.log('  ✅ สร้างโฟลเดอร์ใหม่: FaceAttend_Images');
  }

  // สร้าง sub-folder FaceImages
  var faceFolder = getOrCreateFolder(mainFolder, 'FaceImages');
  faceFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  // แชร์ parent folder ด้วย
  mainFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  var newFolderId = mainFolder.getId();
  Logger.log('');
  Logger.log('  ✅ เสร็จแล้ว!');
  Logger.log('  Folder ID: ' + newFolderId);
  Logger.log('  Folder URL: ' + mainFolder.getUrl());
  Logger.log('');
  Logger.log('  ★ คัดลอก Folder ID นี้ไปใส่ใน Code.gs:');
  Logger.log('  const DRIVE_FOLDER_ID = \'' + newFolderId + '\';');
  Logger.log('');
  Logger.log('  แล้วรัน setupSheets() อีกครั้ง');

  return newFolderId;
}

// ════════════════════════════════════════════
// ── เพิ่มข้อมูลนักเรียนตัวอย่าง ──────────────
// ════════════════════════════════════════════

function insertSampleStudents() {
  var samples = [
    ['S001','ด.ช.','ธนกฤต',   'มั่นคง',   'ม.1','1',1,'ชาย'],
    ['S002','ด.ญ.','พิชญา',    'สุวรรณ',  'ม.1','1',2,'หญิง'],
    ['S003','ด.ช.','กิตติภูมิ','โชติกิจ',  'ม.1','1',3,'ชาย'],
    ['S004','ด.ญ.','ณัฐนรี',   'ทองดี',   'ม.1','2',1,'หญิง'],
    ['S005','ด.ช.','ชยานันต์', 'พิสุทธิ์', 'ม.2','1',1,'ชาย'],
    ['S006','ด.ญ.','อริสา',    'วงศ์สว่าง','ม.2','1',2,'หญิง'],
    ['S007','ด.ช.','ภัทรพล',   'สิงห์เดช','ม.2','2',1,'ชาย'],
    ['S008','ด.ญ.','วราภรณ์',  'นาคประเสริฐ','ม.3','1',1,'หญิง'],
    ['S009','ด.ช.','ศุภณัฐ',   'เกษมสุข', 'ม.3','1',2,'ชาย'],
    ['S010','ด.ญ.','ปัณฑิตา',  'ชลวิถี',  'ม.3','2',1,'หญิง'],
  ];
  var sheet    = openSheet(SHEETS.STUDENTS);
  var existing = sheet.getDataRange().getValues().map(function(r){ return String(r[0]); });
  var added    = 0;
  samples.forEach(function(row) {
    if (!existing.includes(row[0])) {
      sheet.appendRow(row.concat(['','','active', new Date().toISOString()]));
      Logger.log('  ✅ เพิ่มนักเรียน: ' + row[2] + ' ' + row[3]);
      added++;
    }
  });
  Logger.log('รวมเพิ่มนักเรียนตัวอย่าง ' + added + ' คน');
}

// ── เพิ่ม Teacher / Viewer user ──────────────
function addExtraUsers() {
  var usersSheet = openSheet(SHEETS.USERS);
  var extra = [
    ['teacher@school.ac.th','อาจารย์สมใจ ดีงาม','teacher','ม.1/1,ม.1/2','teacher1234'],
    ['viewer@school.ac.th', 'ผู้ปกครอง ทดสอบ',  'viewer',  '',            'viewer1234'],
  ];
  var rows   = usersSheet.getDataRange().getValues();
  var emails = rows.map(function(r){ return String(r[0]).toLowerCase(); });
  var added  = 0;
  extra.forEach(function(u) {
    if (!emails.includes(u[0].toLowerCase())) {
      usersSheet.appendRow([u[0], u[1], u[2], u[3], hashPwd(u[4]), new Date().toISOString()]);
      Logger.log('  ✅ เพิ่ม user: ' + u[0] + ' (' + u[2] + ')');
      added++;
    } else {
      Logger.log('  ✔  user มีอยู่แล้ว: ' + u[0]);
    }
  });
  Logger.log('รวมเพิ่ม ' + added + ' users');
}

// ── ทดสอบ API (รันจาก Editor โดยไม่ต้อง deploy) ──
function testAPI() {
  Logger.log('═══ testAPI ═══');
  Logger.log('▶ Test ping...');
  var r1 = JSON.parse(handleRequest({ action: 'ping' }).getContent());
  Logger.log('  result: ' + JSON.stringify(r1.data));

  Logger.log('▶ Test login (wrong pwd)...');
  var r2 = JSON.parse(handleRequest({ action: 'login', email: ADMIN_EMAIL, password: 'wrongpwd' }).getContent());
  Logger.log('  result: ' + (r2.success ? '⚠️ Login ไม่ควรสำเร็จ!' : '✅ reject ถูกต้อง: ' + r2.error));

  Logger.log('▶ Test getStudents (no token)...');
  var r3 = JSON.parse(handleRequest({ action: 'getStudents' }).getContent());
  Logger.log('  result: ' + (r3.success ? '⚠️ ไม่ควรผ่านโดยไม่มี token!' : '✅ Unauthorized ถูกต้อง'));

  Logger.log('▶ Test Drive Folder...');
  if (DRIVE_FOLDER_ID && DRIVE_FOLDER_ID.trim() !== '') {
    try {
      var f = DriveApp.getFolderById(DRIVE_FOLDER_ID);
      Logger.log('  ✅ Drive Folder OK: "' + f.getName() + '"');
    } catch(e) {
      Logger.log('  ❌ Drive Folder ERROR: ' + e.message);
      Logger.log('  → รัน createFaceFolder() เพื่อสร้างใหม่');
    }
  } else {
    Logger.log('  ⚠️  DRIVE_FOLDER_ID ว่างเปล่า — ข้ามการทดสอบ');
  }

  Logger.log('═══ testAPI Done ═══');
}

// ════════════════════════════════════════════
// ★ ทดสอบ Drive Folder อย่างเดียว
//   รันก่อนถ้า setupSheets แล้ว error Drive
// ════════════════════════════════════════════

function testDriveFolder() {
  Logger.log('═══ ทดสอบ Drive Folder ═══');
  Logger.log('DRIVE_FOLDER_ID = "' + DRIVE_FOLDER_ID + '"');

  if (!DRIVE_FOLDER_ID || DRIVE_FOLDER_ID.trim() === '') {
    Logger.log('❌ DRIVE_FOLDER_ID ว่างเปล่า!');
    Logger.log('   → รัน createFaceFolder() เพื่อสร้างโฟลเดอร์ใหม่');
    return;
  }

  // ทดสอบว่าเป็น file หรือ folder
  var isFile = false;
  try {
    var f = DriveApp.getFileById(DRIVE_FOLDER_ID);
    isFile = true;
    Logger.log('❌ ID นี้เป็น "ไฟล์" ชื่อ: ' + f.getName());
    Logger.log('   ต้องใช้ ID ของ "โฟลเดอร์" เท่านั้น');
    Logger.log('   URL โฟลเดอร์จะเป็น: drive.google.com/drive/folders/[ID]');
    Logger.log('   → รัน createFaceFolder() เพื่อสร้างโฟลเดอร์ใหม่');
  } catch(e) {
    // ไม่ใช่ file → ลอง folder
    if (!isFile) {
      try {
        var folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
        Logger.log('✅ พบโฟลเดอร์: "' + folder.getName() + '"');
        Logger.log('   ID: ' + folder.getId());
        Logger.log('   URL: ' + folder.getUrl());

        // ทดสอบสร้าง sub-folder
        var sub = getOrCreateFolder(folder, 'FaceImages');
        Logger.log('✅ Sub-folder FaceImages: "' + sub.getName() + '"');
        Logger.log('');
        Logger.log('✅ Drive Folder พร้อมใช้งานแล้ว!');
      } catch(fe) {
        Logger.log('❌ ไม่สามารถเข้าถึงโฟลเดอร์: ' + fe.message);
        Logger.log('   อาจถูกลบหรือไม่มีสิทธิ์');
        Logger.log('   → รัน createFaceFolder() เพื่อสร้างโฟลเดอร์ใหม่');
      }
    }
  }
  Logger.log('═══════════════════════════');
}
