// ============================================
// Google Apps Script — FaceAttend API v2.4
// แก้ไข: overrideStatus, updateAttendanceStatus สร้าง record ใหม่ถ้าไม่มี,
//         doGetAttendance รองรับ filter ครบ
// ============================================

// ─── ★ ตั้งค่าตรงนี้ก่อน ★ ─────────────────
const SHEET_ID        = '17juO5S8dVehwyUdnhO99HLs8ef3rjfF37viRwwwapbc';
const DRIVE_FOLDER_ID = '1bXSViZXvj28yHtWNgJpZXkE8CIioFtj6';
const SECRET_KEY      = 'FaceAttend2024Secret';

// ★ เปลี่ยนเป็น email จริงที่ใช้ Login Google ★
const ADMIN_EMAIL = 'ekkasuks@esanpt1.go.th';
const ADMIN_NAME  = 'อ.เอกศักดิ์ ปรีติประสงค์';
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

    // ★ ดึง role จาก token (ใช้ตรวจสิทธิ์)
    var authPayload = null;
    try {
      var authResult = verifyToken(token);
      if (authResult.valid) authPayload = authResult.payload;
    } catch(_) {}
    var callerRole = (authPayload && authPayload.role) ? String(authPayload.role) : 'viewer';

    // ── role guard helper ──────────────────────────────────────────────────
    function requireGASRole(allowedRoles) {
      if (allowedRoles.indexOf(callerRole) === -1) {
        throw new Error('PermissionDenied: ต้องการสิทธิ์ ' + allowedRoles.join('/') + ' (ปัจจุบัน: ' + callerRole + ')');
      }
    }

    var result;
    switch (action) {
      case 'ping':        result = doPing();               break;
      case 'login':       result = doLogin(params);        break;
      case 'loginGoogle': result = doLoginGoogle(params);  break;

      // ── READ: ทุก role ดูได้ ──────────────────────────────────────────────
      case 'getStudents':    result = doGetStudents(params);    break;
      case 'getAttendance':  result = doGetAttendance(params);  break;
      case 'getDashboard':   result = doGetDashboard(params);   break;
      case 'getSettings':    result = doGetSettings();          break;
      case 'getClassSummary':result = doGetClassSummary(params);break;

      // ── WRITE students: admin เท่านั้น ───────────────────────────────────
      case 'addStudent':
        requireGASRole(['admin']);
        result = doAddStudent(params);
        break;
      case 'updateStudent':
        requireGASRole(['admin']);
        result = doUpdateStudent(params);
        break;
      case 'deleteStudent':
        requireGASRole(['admin']);
        result = doDeleteStudent(params);
        break;
      case 'uploadFaceImage':
        requireGASRole(['admin']);
        result = doUploadFaceImage(params);
        break;
      case 'saveFaceDescriptor':
        requireGASRole(['admin']);
        result = doSaveFaceDescriptor(params);
        break;

      // ── WRITE attendance: admin + teacher ────────────────────────────────
      case 'checkAttendance':
        requireGASRole(['admin','teacher']);
        result = doCheckAttendance(params);
        break;
      case 'updateAttendanceStatus':
        requireGASRole(['admin','teacher']);
        result = doUpdateAttendanceStatus(params);
        break;

      // ── settings: admin เท่านั้น ─────────────────────────────────────────
      case 'saveSetting':
        requireGASRole(['admin']);
        result = doSaveSetting(params);
        break;

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
  return { pong: true, version: '2.4.0', time: new Date().toISOString() };
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

function doLoginGoogle(p) {
  const email = String(p.email || '').trim().toLowerCase();
  if (!email) throw new Error('ต้องระบุ email');

  const sheet   = openSheet(SHEETS.USERS);
  const rows    = sheet.getDataRange().getValues();
  let   userRow = null;

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

    // ★ parse faceDescriptorJson → Array[128]
    //   ต้องตรวจทุกกรณี: ว่าง, string, Array ที่ parse แล้ว
    var rawDesc = s.faceDescriptorJson;
    s.faceDescriptor = null;  // default
    if (rawDesc) {
      var parsed = null;
      if (Array.isArray(rawDesc)) {
        parsed = rawDesc;                  // Sheet อาจส่งเป็น Array ตรงๆ
      } else {
        try { parsed = JSON.parse(String(rawDesc)); } catch(_) {}
      }
      if (Array.isArray(parsed) && parsed.length === 128) {
        s.faceDescriptor = parsed;
      }
    }
    delete s.faceDescriptorJson;
    // Ensure all string fields are strings (ป้องกัน Date object)
    ['studentId','prefix','firstName','lastName','classLevel','room',
     'gender','faceImageUrl','activeStatus'].forEach(function(k) {
      if (s[k] !== undefined && s[k] !== null) s[k] = String(s[k]);
    });
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
      if (p.activeStatus   !== undefined) sheet.getRange(r,11).setValue(p.activeStatus);
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
  var studentId = String(p.studentId);
  var tz        = 'Asia/Bangkok';
  var now       = new Date();
  var date      = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  var time      = Utilities.formatDate(now, tz, 'HH:mm');
  var sheet     = openSheet(SHEETS.ATTENDANCE);

  var settings = doGetSettings();

  // ★ dupMin: parseInt หลัง String() เพื่อป้องกัน NaN
  var dupMinRaw = settings['checkDuplicateMinutes'];
  var dupMin    = 10;
  if (dupMinRaw !== undefined && dupMinRaw !== '') {
    var parsed = parseInt(String(dupMinRaw), 10);
    if (!isNaN(parsed) && parsed > 0) dupMin = parsed;
  }

  // ★ lateTime: ตรวจสอบว่ามี ':' ก่อน split เสมอ
  var lateTimeRaw = settings['lateTime'];
  var lateTime    = '08:30'; // default
  if (lateTimeRaw && String(lateTimeRaw).indexOf(':') !== -1) {
    lateTime = String(lateTimeRaw).trim();
  }

  // Anti-duplicate (ข้ามถ้าเป็น manual override)
  var isManualOverride = !!p.overrideStatus;
  if (!isManualOverride) {
    var rows = sheet.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      var rowDate = rows[i][1] instanceof Date
        ? Utilities.formatDate(rows[i][1], tz, 'yyyy-MM-dd')
        : String(rows[i][1] || '').slice(0, 10);
      var rowTime = rows[i][2] instanceof Date
        ? Utilities.formatDate(rows[i][2], tz, 'HH:mm')
        : String(rows[i][2] || '00:00');
      if (String(rows[i][3]) === studentId && rowDate === date) {
        var prev = new Date(date + 'T' + rowTime + ':00+07:00').getTime();
        if (now.getTime() - prev < dupMin * 60000) {
          return { duplicate: true, message: 'เช็คชื่อแล้ว', existingTime: rowTime };
        }
      }
    }
  }

  // คำนวณ status
  var status;
  var validStatuses = ['present', 'late', 'absent', 'leave'];
  if (p.overrideStatus && validStatuses.indexOf(p.overrideStatus) !== -1) {
    status = p.overrideStatus;
  } else if (p.status && validStatuses.indexOf(p.status) !== -1) {
    status = p.status;
  } else {
    try {
      var lParts = lateTime.split(':');
      var lh = parseInt(lParts[0], 10) || 8;
      var lm = parseInt(lParts[1], 10) || 30;
      var cParts = time.split(':');
      var ch = parseInt(cParts[0], 10);
      var cm = parseInt(cParts[1], 10);
      status = (ch > lh || (ch === lh && cm > lm)) ? 'late' : 'present';
    } catch (e) {
      status = 'present';
      safeLog('WARN', 'doCheckAttendance', 'lateTime parse error: ' + lateTime + ' | ' + e.message);
    }
  }

  var students = doGetStudents({});
  var st = null;
  for (var j = 0; j < students.length; j++) {
    if (String(students[j].studentId) === studentId) { st = students[j]; break; }
  }
  var name = st
    ? ((st.prefix || '') + (st.firstName || '') + ' ' + (st.lastName || '')).trim()
    : studentId;

  var aId = generateId('A');
  sheet.appendRow([
    aId, date, time, studentId, name,
    st ? st.classLevel : '',
    st ? st.room       : '',
    status,
    p.method   || 'manual',
    p.deviceId || 'DEVICE-01',
    p.note     || '',
    now.toISOString()
  ]);
  safeLog('CHECKIN', studentId, status + '@' + time);
  return {
    attendanceId: aId,
    studentId:    studentId,
    studentName:  name,
    date:         date,
    time:         time,
    status:       status,
    classLevel:   st ? st.classLevel : '',
    room:         st ? st.room       : ''
  };
}

function doGetAttendance(p) {
  if (!p) p = {};
  var tz      = 'Asia/Bangkok';
  var sheet   = openSheet(SHEETS.ATTENDANCE);
  var data    = sheet.getDataRange().getValues();
  var headers = data[0] || [];
  var list    = [];

  // TIME_FIELDS — columns ที่เป็น Date object แต่ต้อง format ต่างกัน
  var dateFields = { date: true, createdAt: true };
  var timeFields = { time: true };

  for (var i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    var r = {};
    headers.forEach(function(h, j) {
      var raw = data[i][j];
      if (raw instanceof Date) {
        if (timeFields[h]) {
          // ★ คอลัมน์ time → format เป็น HH:mm
          r[h] = Utilities.formatDate(raw, tz, 'HH:mm');
        } else {
          // date, createdAt → format เป็น yyyy-MM-dd
          r[h] = Utilities.formatDate(raw, tz, 'yyyy-MM-dd');
        }
      } else {
        r[h] = (raw === null || raw === undefined) ? '' : raw;
      }
    });

    // normalize: ตัดส่วนเวลาออกถ้า date field ยาวเกิน
    if (r.date && String(r.date).length > 10) {
      r.date = String(r.date).slice(0, 10);
    }
    // ตรวจ time field — ถ้าเป็น string ยาว ตัดเอา HH:mm
    if (r.time && String(r.time).length > 5) {
      r.time = String(r.time).slice(0, 5);
    }

    if (p.date       && String(r.date)       !== String(p.date))       continue;
    if (p.studentId  && String(r.studentId)  !== String(p.studentId))  continue;
    if (p.classLevel && String(r.classLevel) !== String(p.classLevel)) continue;
    if (p.room       && String(r.room)       !== String(p.room))       continue;
    if (p.dateFrom   && String(r.date)        <  String(p.dateFrom))   continue;
    if (p.dateTo     && String(r.date)        >  String(p.dateTo))     continue;
    if (p.status     && String(r.status)     !== String(p.status))     continue;

    list.push(r);
  }
  return list;
}

function doUpdateAttendanceStatus(p) {
  if (!p) throw new Error('ไม่มีข้อมูล');
  const sheet = openSheet(SHEETS.ATTENDANCE);
  const data  = sheet.getDataRange().getValues();
  const tz    = 'Asia/Bangkok';
  const now   = new Date();

  for (var i = 1; i < data.length; i++) {
    var rowDate = data[i][1] instanceof Date
      ? Utilities.formatDate(data[i][1], tz, 'yyyy-MM-dd')
      : String(data[i][1] || '').slice(0, 10);
    var byId  = p.attendanceId && String(data[i][0]) === String(p.attendanceId);
    var byKey = p.studentId && p.date &&
                String(data[i][3]) === String(p.studentId) &&
                rowDate === String(p.date);
    if (byId || byKey) {
      sheet.getRange(i+1, 8).setValue(p.status || 'present');
      sheet.getRange(i+1,11).setValue(p.note   || 'แก้ไขโดยครู');
      safeLog('UPDATE_STATUS', p.studentId || p.attendanceId, '→' + p.status);
      return { success: true };
    }
  }

  // ถ้าไม่เจอ record → สร้างใหม่
  if (p.studentId && p.date && p.status) {
    const date = String(p.date);
    const time = Utilities.formatDate(now, tz, 'HH:mm');
    const students = doGetStudents({});
    const st = students.find(s => String(s.studentId) === String(p.studentId));
    const name = st ? ((st.prefix||'')+(st.firstName||'')+' '+(st.lastName||'')).trim() : p.studentId;
    const aId  = generateId('A');
    sheet.appendRow([
      aId, date, time, p.studentId, name,
      st ? st.classLevel : '',
      st ? st.room : '',
      p.status,
      'manual',
      'TEACHER',
      p.note || 'บันทึกย้อนหลัง',
      now.toISOString()
    ]);
    safeLog('CREATE_ATTENDANCE', p.studentId, p.status + ' on ' + date);
    return { success: true, created: true };
  }

  throw new Error('ไม่พบรายการ attendance (studentId=' + p.studentId + ', date=' + p.date + ')');
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
// Face Image
// ════════════════════════════════════════════

function doUploadFaceImage(p) {
  if (!p || !p.imageBase64) throw new Error('ต้องส่ง imageBase64');
  if (!DRIVE_FOLDER_ID || DRIVE_FOLDER_ID.trim() === '') {
    throw new Error('ยังไม่ได้ตั้งค่า DRIVE_FOLDER_ID ใน Code.gs');
  }

  let parent = null;
  try {
    parent = DriveApp.getFolderById(DRIVE_FOLDER_ID);
  } catch (e) {
    let hint = '';
    try {
      const f = DriveApp.getFileById(DRIVE_FOLDER_ID);
      hint = '\nID นี้ชี้ไปที่ไฟล์ชื่อ "' + f.getName() + '" ไม่ใช่โฟลเดอร์';
    } catch(_) {
      hint = '\nไม่พบ ID นี้ใน Drive (อาจถูกลบหรือไม่มีสิทธิ์)';
    }
    throw new Error('DRIVE_FOLDER_ID ไม่ถูกต้อง' + hint + '\nรัน createFaceFolder() แล้วอัปเดต DRIVE_FOLDER_ID');
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
  for (var i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    var key = String(data[i][0]).trim();
    var raw = data[i][1];

    // ★ Google Sheets อาจส่งค่าเป็น Date object, Number, หรือ Boolean
    //    บังคับเป็น String เสมอเพื่อป้องกัน .split() crash
    var val;
    if (raw === null || raw === undefined || raw === '') {
      val = '';
    } else if (raw instanceof Date) {
      // เวลา เช่น 08:30 → Sheets เก็บเป็น Date object
      val = Utilities.formatDate(raw, 'Asia/Bangkok', 'HH:mm');
    } else {
      val = String(raw).trim();
    }

    out[key] = val;
  }
  return out;
}

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
      sheet.getRange(i+1, 3).setValue(Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss'));
      return { success: true };
    }
  }
  sheet.appendRow([key, value, Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss')]);
  return { success: true };
}

// ════════════════════════════════════════════
// Helpers
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
  if (!parent || typeof parent.getFoldersByName !== 'function') {
    throw new Error('getOrCreateFolder: parent folder ไม่ถูกต้อง — รัน createFaceFolder()');
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
  } catch (_) {}
}

// ════════════════════════════════════════════
// Setup & Utilities
// ════════════════════════════════════════════

function setupSheets() {
  Logger.log('════════════════════════════════════');
  Logger.log('  FaceAttend v2.4 — Setup Started');
  Logger.log('════════════════════════════════════');

  Logger.log('\n[ 0 ] ตรวจสอบ Config...');
  if (!SHEET_ID || SHEET_ID.includes('YOUR')) {
    Logger.log('  ❌ SHEET_ID ยังไม่ได้ตั้งค่า!'); return;
  }
  Logger.log('  ✔  SHEET_ID: ' + SHEET_ID);
  Logger.log('  ✔  ADMIN_EMAIL: ' + ADMIN_EMAIL);

  Logger.log('\n[ 1 ] ตรวจสอบ Drive Folder...');
  var folderOk = false;
  if (!DRIVE_FOLDER_ID || DRIVE_FOLDER_ID.trim() === '') {
    Logger.log('  ⚠️  DRIVE_FOLDER_ID ว่างเปล่า — รัน createFaceFolder() ก่อน');
  } else {
    try {
      var folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
      Logger.log('  ✔  Drive Folder: "' + folder.getName() + '"');
      getOrCreateFolder(folder, 'FaceImages');
      folderOk = true;
    } catch (e) {
      Logger.log('  ❌ Drive Folder error: ' + e.message);
      Logger.log('  → รัน createFaceFolder() แล้วอัปเดต DRIVE_FOLDER_ID');
    }
  }

  Logger.log('\n[ 2 ] สร้าง Sheets...');
  var ss = SpreadsheetApp.openById(SHEET_ID);
  Object.values(SHEETS).forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      setHeaders(sheet, name);
      Logger.log('  ✅ สร้าง Sheet: ' + name);
    } else {
      Logger.log('  ✔  Sheet มีอยู่แล้ว: ' + name);
    }
  });

  Logger.log('\n[ 3 ] Default Settings...');
  var settingsSheet = openSheet(SHEETS.SETTINGS);
  var existingKeys  = settingsSheet.getDataRange().getValues().map(function(r){ return String(r[0]); });
  var defaults = [
    ['schoolName','โรงเรียนบ้านใหม่'],
    ['schoolLogoUrl',''],
    ['checkDuplicateMinutes','10'],
    ['lateTime','08:30'],
    ['absentTime','10:00'],
    ['faceThreshold','0.5']
  ];
  defaults.forEach(function(pair) {
    if (!existingKeys.includes(pair[0])) {
      settingsSheet.appendRow([pair[0], pair[1], new Date().toISOString()]);
      Logger.log('  ✅ เพิ่ม: ' + pair[0]);
    }
  });

  Logger.log('\n[ 4 ] Admin User...');
  var usersSheet  = openSheet(SHEETS.USERS);
  var userRows    = usersSheet.getDataRange().getValues();
  var adminExists = false;
  for (var i = 1; i < userRows.length; i++) {
    if (String(userRows[i][0]).trim().toLowerCase() === ADMIN_EMAIL.trim().toLowerCase()) {
      adminExists = true;
      if (String(userRows[i][2]).toLowerCase() !== 'admin') {
        usersSheet.getRange(i + 1, 3).setValue('admin');
        Logger.log('  ✅ อัปเดต role → admin: ' + ADMIN_EMAIL);
      }
      break;
    }
  }
  if (!adminExists) {
    usersSheet.appendRow([ADMIN_EMAIL, ADMIN_NAME, 'admin', 'all', hashPwd('admin1234'), new Date().toISOString()]);
    Logger.log('  ✅ สร้าง Admin: ' + ADMIN_EMAIL);
  } else {
    Logger.log('  ✔  Admin มีอยู่แล้ว');
  }

  Logger.log('\n════════════════════════════════════');
  Logger.log('  ✅ Setup เสร็จสมบูรณ์!');
  Logger.log('  Drive: ' + (folderOk ? '✅' : '⚠️  ต้องรัน createFaceFolder()'));
  Logger.log('════════════════════════════════════');
  Logger.log('\nขั้นตอนถัดไป:');
  Logger.log('  Deploy → New Deployment → Web App');
  Logger.log('  Execute as: Me | Who: Anyone');
  Logger.log('  คัดลอก URL ใส่ config.js → CONFIG.API_URL');
}

function createFaceFolder() {
  Logger.log('═══════════════════════════════');
  Logger.log('  สร้าง Drive Folder');
  Logger.log('═══════════════════════════════');
  var root   = DriveApp.getRootFolder();
  var exists = root.getFoldersByName('FaceAttend_Images');
  var mainFolder;
  if (exists.hasNext()) {
    mainFolder = exists.next();
    Logger.log('  ✔  โฟลเดอร์มีอยู่แล้ว');
  } else {
    mainFolder = root.createFolder('FaceAttend_Images');
    Logger.log('  ✅ สร้างโฟลเดอร์ใหม่');
  }
  var faceFolder = getOrCreateFolder(mainFolder, 'FaceImages');
  faceFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  mainFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  var id = mainFolder.getId();
  Logger.log('\n  ✅ Folder ID: ' + id);
  Logger.log('  ★ ใส่ค่านี้ใน Code.gs → DRIVE_FOLDER_ID');
  Logger.log('  แล้วรัน setupSheets() อีกครั้ง');
  return id;
}

function testAPI() {
  Logger.log('═══ testAPI ═══');
  var r1 = JSON.parse(handleRequest({ action: 'ping' }).getContent());
  Logger.log('ping: ' + JSON.stringify(r1.data));

  var r2 = JSON.parse(handleRequest({ action: 'login', email: ADMIN_EMAIL, password: 'wrongpwd' }).getContent());
  Logger.log('login wrong pwd: ' + (r2.success ? '⚠️ ไม่ควรสำเร็จ' : '✅ reject ถูกต้อง'));

  var r3 = JSON.parse(handleRequest({ action: 'getStudents' }).getContent());
  Logger.log('getStudents no token: ' + (r3.success ? '⚠️' : '✅ Unauthorized ถูกต้อง'));

  if (DRIVE_FOLDER_ID) {
    try {
      DriveApp.getFolderById(DRIVE_FOLDER_ID);
      Logger.log('Drive Folder: ✅ OK');
    } catch(e) {
      Logger.log('Drive Folder: ❌ ' + e.message);
    }
  }
  Logger.log('═══ testAPI Done ═══');
}

function insertSampleStudents() {
  var samples = [
    ['S001','ด.ช.','ธนกฤต',   'มั่นคง',        'อนุบาล2','1',1,'ชาย'],
    ['S002','ด.ญ.','พิชญา',    'สุวรรณ',        'อนุบาล2','1',2,'หญิง'],
    ['S003','ด.ช.','กิตติภูมิ','โชติกิจ',        'อนุบาล3','1',1,'ชาย'],
    ['S004','ด.ญ.','ณัฐนรี',   'ทองดี',          'อนุบาล3','1',2,'หญิง'],
    ['S005','ด.ช.','ชยานันต์', 'พิสุทธิ์',       'ป.1','1',1,'ชาย'],
    ['S006','ด.ญ.','อริสา',    'วงศ์สว่าง',      'ป.1','1',2,'หญิง'],
    ['S007','ด.ช.','ภัทรพล',   'สิงห์เดช',       'ป.2','1',1,'ชาย'],
    ['S008','ด.ญ.','วราภรณ์',  'นาคประเสริฐ',    'ป.3','1',1,'หญิง'],
    ['S009','ด.ช.','ศุภณัฐ',   'เกษมสุข',        'ป.4','1',1,'ชาย'],
    ['S010','ด.ญ.','ปัณฑิตา',  'ชลวิถี',         'ป.5','1',1,'หญิง'],
  ];
  var sheet    = openSheet(SHEETS.STUDENTS);
  var existing = sheet.getDataRange().getValues().map(function(r){ return String(r[0]); });
  var added    = 0;
  samples.forEach(function(row) {
    if (!existing.includes(row[0])) {
      sheet.appendRow(row.concat(['','','active', new Date().toISOString()]));
      Logger.log('  ✅ เพิ่ม: ' + row[2] + ' ' + row[3]);
      added++;
    }
  });
  Logger.log('รวมเพิ่ม ' + added + ' คน');
}
