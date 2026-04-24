// ============================================
// api.js — API Client (Google Sheet ONLY)
// ★ ไม่มี localStorage เลย — ดึงข้อมูลจาก GAS 100%
// ============================================

const API = (() => {

  // ── ดึง token จาก session ────────────────
  function getToken() {
    try {
      const u = sessionStorage.getItem('user');
      if (!u) return '';
      const user = JSON.parse(u);
      return user.gasToken || user.token || '';
    } catch(_) { return ''; }
  }

  // ── POST ไปยัง Apps Script ───────────────
  async function callGAS(action, params = {}) {
    const url = CONFIG.API_URL;
    if (!CONFIG._hasRealAPI) throw new Error('ยังไม่ได้ตั้งค่า API_URL ใน config.js');

    const payload = { action, token: getToken(), ...params };

    const res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'text/plain' },
      body:    JSON.stringify(payload),
      mode:    'cors',
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'GAS error');
    if (CONFIG.DEBUG) console.log(`[API] ${action} OK`, data.data);
    return data.data;
  }

  // ── ขอ GAS token หลัง Google Login ──────
  async function syncGASToken() {
    try {
      const u = sessionStorage.getItem('user');
      if (!u) return;
      const user = JSON.parse(u);
      if (user.gasToken) return;

      if (user.loginMethod === 'google' && CONFIG._hasRealAPI) {
        const data = await callGASPublic('loginGoogle', {
          email: user.email,
          googleToken: user.googleToken || '',
        });
        if (data && data.token) {
          user.gasToken = data.token;
          sessionStorage.setItem('user', JSON.stringify(user));
          console.log('[API] GAS token obtained ✅');
        }
      }
    } catch(e) {
      console.warn('[API] syncGASToken failed:', e.message);
    }
  }

  // public call (ไม่ต้องมี token)
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

  // ════════════════════════════════════════
  // STUDENTS — Google Sheet 100%
  // ════════════════════════════════════════

  async function getStudents(filter = {}) {
    const params = {};
    if (filter.classLevel) params.classLevel = filter.classLevel;
    if (filter.room)       params.room       = filter.room;
    const result = await callGAS('getStudents', params);
    if (!Array.isArray(result)) return [];
    // normalize field names
    return result.map(s => ({
      ...s,
      id:        s.studentId || s.id || '',
      studentId: s.studentId || s.id || '',
      classLevel: s.classLevel || '',
      class:      s.classLevel || '',
      no:         s.number || s.no || '',
      number:     s.number || s.no || '',
      faceDescriptor: s.faceDescriptorJson
        ? (() => { try { return JSON.parse(s.faceDescriptorJson); } catch(_) { return null; } })()
        : (s.faceDescriptor || null),
    }));
  }

  async function addStudent(data) {
    const payload = normalizeStudent(data);
    return await callGAS('addStudent', payload);
  }

  async function updateStudent(data) {
    const payload = normalizeStudent(data);
    return await callGAS('updateStudent', payload);
  }

  async function deleteStudent(studentId) {
    return await callGAS('deleteStudent', { studentId });
  }

  // ════════════════════════════════════════
  // ATTENDANCE — Google Sheet 100%
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

  // manual add (กรณีไม่มีในระบบเลย)
  async function addManualAttendance(record) {
    return await callGAS('checkAttendance', {
      studentId: record.studentId,
      method:    'manual',
      note:      record.note || 'เช็คชื่อด้วยมือ',
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
  // Field mapping helpers
  // ════════════════════════════════════════

  function normalizeStudent(d) {
    return {
      studentId:     d.id        || d.studentId     || '',
      prefix:        d.prefix                        || '',
      firstName:     d.firstName                     || '',
      lastName:      d.lastName                      || '',
      classLevel:    d.classLevel || d.class         || '',
      room:          String(d.room                   || ''),
      number:        d.number     || d.no            || 1,
      gender:        d.gender                        || 'ชาย',
      faceImageUrl:  d.faceImageUrl || d.imageUrl   || '',
      faceDescriptor:d.faceDescriptor                || null,
      activeStatus:  d.activeStatus || d.status     || 'active',
    };
  }

  // ── toast แจ้งผล ──────────────────────────
  function showSyncBadge(msg, type = 'success') {
    if (typeof showToast === 'function') showToast(msg, '', type, 2500);
  }

  // ── sync token ตอน load ──────────────────
  window.addEventListener('load', () => {
    syncGASToken();
  });

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
