// ============================================
// api.js — API Client (Google Sheet ONLY)
// v2.4.2 — แก้ Unauthorized: No token
//   • syncGASToken() เรียกก่อน callGAS() เสมอ
//   • ensureToken() รอ token พร้อมก่อน request
// ============================================

const API = (() => {

  // ── สถานะ token sync ─────────────────────
  let _tokenSyncing = false;      // กำลัง sync อยู่หรือเปล่า
  let _tokenReady   = false;      // sync เสร็จแล้วหรือยัง
  let _syncPromise  = null;       // promise เดิมถ้ากำลัง sync

  // ── ดึง token จาก session ────────────────
  function getToken() {
    try {
      const u = sessionStorage.getItem('user');
      if (!u) return '';
      const user = JSON.parse(u);
      return user.gasToken || user.token || '';
    } catch(_) { return ''; }
  }

  // ── Ensure token พร้อมก่อน request ──────
  //    ถ้ายังไม่มี gasToken → sync ก่อน (ครั้งเดียว)
  async function ensureToken() {
    // ถ้า login ด้วย password → token มีแล้วใน user.token
    const tok = getToken();
    if (tok) { _tokenReady = true; return; }

    // ถ้ากำลัง sync อยู่ → รอ promise เดิม
    if (_syncPromise) { await _syncPromise; return; }

    // เริ่ม sync ครั้งแรก
    _syncPromise = _doSyncGASToken();
    await _syncPromise;
    _syncPromise = null;
  }

  // ── Internal sync (เรียกครั้งเดียว) ──────
  async function _doSyncGASToken() {
    try {
      const raw = sessionStorage.getItem('user');
      if (!raw) return;
      const user = JSON.parse(raw);

      // password login → token อยู่ใน user.token แล้ว ไม่ต้อง sync
      if (user.loginMethod === 'password' && user.token) {
        _tokenReady = true;
        return;
      }

      // google login → ขอ GAS token ด้วย loginGoogle
      if (!CONFIG._hasRealAPI) return;

      console.log('[API] ขอ GAS token จาก loginGoogle...');
      const res = await fetch(CONFIG.API_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'text/plain' },
        body:    JSON.stringify({
          action:      'loginGoogle',
          email:       user.email,
          googleToken: user.googleToken || '',
        }),
        mode: 'cors',
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();

      if (data.success && data.data && data.data.token) {
        user.gasToken = data.data.token;
        user.role     = data.data.role || user.role;  // อัปเดต role จาก GAS
        sessionStorage.setItem('user', JSON.stringify(user));
        console.log('[API] GAS token ✅ role:', user.role);
        _tokenReady = true;
      } else {
        console.warn('[API] loginGoogle ไม่ได้ token:', data.error);
      }
    } catch(e) {
      console.warn('[API] _doSyncGASToken failed:', e.message);
      // ไม่ throw — ให้ระบบทำงานต่อได้ (GAS จะตอบ Unauthorized)
    }
  }

  // ── POST ไปยัง Apps Script (พร้อม auto-sync) ─
  async function callGAS(action, params = {}) {
    const url = CONFIG.API_URL;
    if (!CONFIG._hasRealAPI) throw new Error('ยังไม่ได้ตั้งค่า API_URL ใน config.js');

    // ★ รอให้ token พร้อมก่อนทุก request
    await ensureToken();

    const payload = { action, token: getToken(), ...params };

    const res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'text/plain' },
      body:    JSON.stringify(payload),
      mode:    'cors',
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();

    // ★ ถ้า GAS ตอบ Unauthorized → ลอง sync token ใหม่ 1 ครั้ง
    if (!data.success && data.error && data.error.includes('Unauthorized')) {
      console.warn('[API] Unauthorized — ลอง re-sync token...');
      _tokenReady = false;
      await _doSyncGASToken();
      // ส่งใหม่อีกครั้งด้วย token ใหม่
      const retry = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'text/plain' },
        body:    JSON.stringify({ action, token: getToken(), ...params }),
        mode:    'cors',
      });
      const retryData = await retry.json();
      if (!retryData.success) throw new Error(retryData.error || 'GAS error (retry)');
      if (CONFIG.DEBUG) console.log(`[API] ${action} OK (retry)`, retryData.data);
      return retryData.data;
    }

    if (!data.success) throw new Error(data.error || 'GAS error');
    if (CONFIG.DEBUG) console.log(`[API] ${action} OK`, data.data);
    return data.data;
  }

  // ── Public call (ไม่ต้องมี token) ────────
  async function callGASPublic(action, params = {}) {
    const url = CONFIG.API_URL;
    if (!CONFIG._hasRealAPI) throw new Error('ยังไม่ได้ตั้งค่า API_URL');
    const res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'text/plain' },
      body:    JSON.stringify({ action, ...params }),
      mode:    'cors',
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'GAS error');
    return data.data;
  }

  // ── syncGASToken (เรียกจากภายนอกได้) ────
  async function syncGASToken() {
    await ensureToken();
  }

  // ════════════════════════════════════════
  // STUDENTS
  // ════════════════════════════════════════

  async function getStudents(filter = {}) {
    const params = {};
    if (filter.classLevel) params.classLevel = filter.classLevel;
    if (filter.room)       params.room       = filter.room;
    const result = await callGAS('getStudents', params);
    if (!Array.isArray(result)) return [];
    return result.map(s => {
      // ★ parse faceDescriptor ให้ได้ Array[128] เสมอ
      //   GAS อาจส่งมาเป็น: Array, JSON string, หรือ null
      let desc = null;
      if (Array.isArray(s.faceDescriptor) && s.faceDescriptor.length === 128) {
        desc = s.faceDescriptor;                       // GAS parse ให้แล้ว ✅
      } else if (s.faceDescriptorJson && typeof s.faceDescriptorJson === 'string') {
        try {
          const p = JSON.parse(s.faceDescriptorJson);
          if (Array.isArray(p) && p.length === 128) desc = p;
        } catch(_) {}
      } else if (typeof s.faceDescriptor === 'string' && s.faceDescriptor.startsWith('[')) {
        try {
          const p = JSON.parse(s.faceDescriptor);
          if (Array.isArray(p) && p.length === 128) desc = p;
        } catch(_) {}
      }

      if (CONFIG.DEBUG && desc === null && (s.faceDescriptorJson || s.faceDescriptor)) {
        console.warn('[API] faceDescriptor parse ล้มเหลว สำหรับ', s.studentId,
          '| type:', typeof s.faceDescriptor,
          '| jsonType:', typeof s.faceDescriptorJson);
      }

      return {
        ...s,
        id:            s.studentId || s.id || '',
        studentId:     s.studentId || s.id || '',
        classLevel:    s.classLevel || '',
        class:         s.classLevel || '',
        no:            s.number || s.no || '',
        number:        s.number || s.no || '',
        faceDescriptor: desc,
      };
    });
  }

  async function addStudent(data) {
    return await callGAS('addStudent', normalizeStudent(data));
  }

  async function updateStudent(data) {
    return await callGAS('updateStudent', normalizeStudent(data));
  }

  async function deleteStudent(studentId) {
    return await callGAS('deleteStudent', { studentId });
  }

  // ════════════════════════════════════════
  // ATTENDANCE
  // ════════════════════════════════════════

  async function checkAttendance(studentId, method = 'face', deviceId = 'DEVICE-01', note = '') {
    return await callGAS('checkAttendance', { studentId, method, deviceId, note });
  }

  async function getAttendance(filter = {}) {
    const result = await callGAS('getAttendance', filter);
    return Array.isArray(result) ? result : [];
  }

  async function updateAttendanceStatus(studentId, date, status, note = '') {
    return await callGAS('updateAttendanceStatus', { studentId, date, status, note });
  }

  async function addManualAttendance(record) {
    return await callGAS('checkAttendance', {
      studentId:      record.studentId,
      method:         'manual',
      note:           record.note || 'เช็คชื่อด้วยมือ',
      overrideStatus: record.status,
    });
  }

  // ════════════════════════════════════════
  // FACE IMAGE / DESCRIPTOR
  // ════════════════════════════════════════

  async function uploadFaceImage(studentId, imageBase64) {
    return await callGAS('uploadFaceImage', { studentId, imageBase64 });
  }

  async function saveFaceDescriptor(studentId, descriptor, imageUrl) {
    return await callGAS('saveFaceDescriptor', { studentId, descriptor, imageUrl });
  }

  // ════════════════════════════════════════
  // DASHBOARD / SETTINGS
  // ════════════════════════════════════════

  async function getDashboard(range = 'today') {
    return await callGAS('getDashboard', { range });
  }

  async function getSettings() {
    const result = await callGAS('getSettings', {});
    return result || {};
  }

  async function saveSetting(key, value) {
    return await callGAS('saveSetting', { key, value });
  }

  async function ping() {
    if (!CONFIG._hasRealAPI) return { pong: false, reason: 'No API URL' };
    return await callGASPublic('ping', {});
  }

  // ════════════════════════════════════════
  // Helpers
  // ════════════════════════════════════════

  function normalizeStudent(d) {
    return {
      studentId:      d.id        || d.studentId     || '',
      prefix:         d.prefix                        || '',
      firstName:      d.firstName                     || '',
      lastName:       d.lastName                      || '',
      classLevel:     d.classLevel || d.class         || '',
      room:           String(d.room                   || ''),
      number:         d.number     || d.no            || 1,
      gender:         d.gender                        || 'ชาย',
      faceImageUrl:   d.faceImageUrl || d.imageUrl   || '',
      faceDescriptor: d.faceDescriptor                || null,
      activeStatus:   d.activeStatus || d.status     || 'active',
    };
  }

  // ════════════════════════════════════════
  // Public API
  // ════════════════════════════════════════
  return {
    getStudents,
    addStudent,
    updateStudent,
    deleteStudent,
    checkAttendance,
    getAttendance,
    updateAttendanceStatus,
    addManualAttendance,
    uploadFaceImage,
    saveFaceDescriptor,
    getDashboard,
    getSettings,
    saveSetting,
    ping,
    syncGASToken,
    normalizeStudent,
    callGAS,
  };

})();
