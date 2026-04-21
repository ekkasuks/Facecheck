// ============================================
// api.js — API Client
// บันทึกทั้ง localStorage (ทันที) AND Google Sheet (async)
// ทำให้ UI ไม่สะดุดแม้ network ช้า
// ============================================

const API = (() => {

  // ── ดึง token จาก session ────────────────
  // Google login จะไม่มี .token (GAS token)
  // ให้ใช้ gasToken ถ้ามี ไม่งั้นใช้ .token ปกติ
  function getToken() {
    try {
      const u = sessionStorage.getItem('user');
      if (!u) return '';
      const user = JSON.parse(u);
      // gasToken ถูกเซ็ตโดย syncGASToken() หลัง login Google
      return user.gasToken || user.token || '';
    } catch(_) { return ''; }
  }

  // ── ขอ GAS token โดยใช้ email (สำหรับ Google login) ──
  // เรียกครั้งเดียวหลัง login แล้ว cache ไว้ใน sessionStorage
  async function syncGASToken() {
    try {
      const u = sessionStorage.getItem('user');
      if (!u) return;
      const user = JSON.parse(u);

      // ถ้ามี gasToken อยู่แล้ว ไม่ต้องขอใหม่
      if (user.gasToken) return;

      // Google login: ขอ token จาก GAS โดย ping ก่อน
      // GAS ใช้ token-based auth → ต้องใช้ email+password login
      // แนวทาง: สร้าง session token พิเศษโดยใช้ email ที่ verified แล้ว
      if (user.loginMethod === 'google' && CONFIG._hasRealAPI) {
        const res = await fetch(CONFIG.API_URL, {
          method:  'POST',
          headers: { 'Content-Type': 'text/plain' },
          body:    JSON.stringify({
            action: 'loginGoogle',
            email:  user.email,
            // ส่ง Google ID token เพื่อ verify
            googleToken: user.googleToken || '',
          }),
          mode: 'cors',
        });
        const data = await res.json();
        if (data.success && data.data && data.data.token) {
          user.gasToken = data.data.token;
          sessionStorage.setItem('user', JSON.stringify(user));
          console.log('[API] GAS token obtained for Google user ✅');
        }
      }
    } catch(e) {
      console.warn('[API] syncGASToken failed:', e.message);
    }
  }

  // ── POST ไปยัง Apps Script ───────────────
  async function callGAS(action, params = {}) {
    const url = CONFIG.API_URL;
    if (!CONFIG._hasRealAPI) return null;   // ยังไม่มี URL จริง → ข้ามไป

    const payload = { action, token: getToken(), ...params };

    try {
      const res = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'text/plain' },   // GAS ต้องการ text/plain
        body:    JSON.stringify(payload),
        mode:    'cors',
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'GAS error');
      if (CONFIG.DEBUG) console.log(`[API] ${action} OK`, data.data);
      return data.data;
    } catch (err) {
      console.error(`[API] ${action} failed:`, err.message);
      throw err;   // ให้ caller จัดการ
    }
  }

  // ════════════════════════════════════════
  // STUDENTS
  // กลยุทธ์: localStorage ก่อน → แล้วค่อย sync GAS
  // ════════════════════════════════════════

  async function getStudents(filter = {}) {
    // ลอง GAS ก่อน ถ้าได้ก็ update localStorage ด้วย
    if (CONFIG._hasRealAPI) {
      try {
        const gasParams = {};
        if (filter.classLevel) gasParams.classLevel = filter.classLevel;
        if (filter.room)       gasParams.room       = filter.room;
        const result = await callGAS('getStudents', gasParams);
        if (Array.isArray(result)) {
          // GAS ตอบกลับมา (แม้จะ array ว่าง = Sheet ว่างจริง)
          if (result.length > 0) {
            lsSaveStudents(result);   // อัปเดต local cache
          }
          if (CONFIG.DEBUG) console.log('[API] getStudents from GAS:', result.length, 'records');
          return result;
        }
      } catch(err) {
        // GAS ล้มเหลว (network, token ผิด ฯลฯ) → fallback local
        console.warn('[API] getStudents GAS failed:', err.message, '→ using localStorage');
      }
    }
    // Fallback → localStorage
    let local = lsGetStudents();
    if (CONFIG.DEBUG) console.log('[API] getStudents from localStorage:', local.length, 'records');
    if (filter.classLevel) local = local.filter(s => (s.classLevel||s.class||'') === filter.classLevel);
    if (filter.room)       local = local.filter(s => String(s.room) === String(filter.room));
    return local;
  }

  async function addStudent(data) {
    // แปลง field ให้ตรงกับ Apps Script (classLevel ไม่ใช่ class)
    const payload = normalizeStudent(data);

    // 1) บันทึก localStorage ทันที
    const local = lsGetStudents();
    if (local.find(s => s.id === payload.studentId)) {
      throw new Error('รหัสนักเรียน ' + payload.studentId + ' มีในระบบแล้ว');
    }
    const localRecord = gasToLocal(payload);
    local.push(localRecord);
    lsSaveStudents(local);
    if (CONFIG.DEBUG) console.log('[API] addStudent saved to localStorage:', localRecord);

    // 2) sync GAS แบบ async (ไม่ block UI)
    if (CONFIG._hasRealAPI) {
      callGAS('addStudent', payload).then(r => {
        if (CONFIG.DEBUG) console.log('[API] addStudent synced to GAS ✅', r);
        showSyncBadge('✅ บันทึกลง Google Sheet แล้ว');
      }).catch(err => {
        console.error('[API] addStudent GAS sync failed:', err.message);
        showSyncBadge('⚠️ บันทึก Sheet ไม่สำเร็จ — ข้อมูลอยู่ใน Local', 'warning');
        // เก็บ queue สำหรับ retry
        queuePush('addStudent', payload);
      });
    } else {
      showSyncBadge('💾 บันทึกแบบ Local (ยังไม่เชื่อม Sheet)', 'warning');
    }

    return { success: true, studentId: payload.studentId };
  }

  async function updateStudent(data) {
    const payload = normalizeStudent(data);

    // 1) update localStorage
    const local = lsGetStudents();
    const idx   = local.findIndex(s => s.id === payload.studentId || s.studentId === payload.studentId);
    if (idx >= 0) {
      local[idx] = { ...local[idx], ...gasToLocal(payload) };
      lsSaveStudents(local);
    }

    // 2) sync GAS
    if (CONFIG._hasRealAPI) {
      callGAS('updateStudent', payload).then(r => {
        if (CONFIG.DEBUG) console.log('[API] updateStudent synced to GAS ✅');
        showSyncBadge('✅ แก้ไขใน Google Sheet แล้ว');
      }).catch(err => {
        console.error('[API] updateStudent GAS failed:', err.message);
        queuePush('updateStudent', payload);
      });
    }

    return { success: true };
  }

  async function deleteStudent(studentId) {
    // 1) ลบจาก localStorage
    let local = lsGetStudents();
    local = local.filter(s => s.id !== studentId && s.studentId !== studentId);
    lsSaveStudents(local);

    // 2) sync GAS
    if (CONFIG._hasRealAPI) {
      callGAS('deleteStudent', { studentId }).then(() => {
        if (CONFIG.DEBUG) console.log('[API] deleteStudent synced to GAS ✅');
      }).catch(err => {
        console.error('[API] deleteStudent GAS failed:', err.message);
        queuePush('deleteStudent', { studentId });
      });
    }

    return { success: true };
  }

  // ════════════════════════════════════════
  // ATTENDANCE
  // ════════════════════════════════════════

  async function checkAttendance(studentId, method = 'face', deviceId = 'DEVICE-01') {
    const now     = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toLocaleTimeString('th-TH', { hour:'2-digit', minute:'2-digit' });

    // Anti-duplicate check (local)
    const dupMs  = CONFIG.DUPLICATE_CHECK_MINUTES * 60 * 1000;
    const locals = lsGetAttendance();
    const dup    = locals.find(r => {
      if (r.studentId !== studentId || r.date !== dateStr) return false;
      const prev = new Date(dateStr + 'T' + r.time + ':00').getTime();
      return now.getTime() - prev < dupMs;
    });
    if (dup) return { duplicate: true, existingTime: dup.time };

    // Status
    const [lh, lm] = CONFIG.LATE_TIME.split(':').map(Number);
    const [ch, cm] = timeStr.split(':').map(Number);
    const status   = (ch > lh || (ch === lh && cm > lm)) ? 'late' : 'present';

    // Get student name from local
    const st   = lsGetStudents().find(s => s.id === studentId || s.studentId === studentId);
    const name = st ? `${st.prefix||''}${st.firstName||''}${st.lastName ? ' '+st.lastName : ''}`.trim() : studentId;

    const record = {
      id:          'A' + Date.now(),
      attendanceId:'A' + Date.now(),
      date:        dateStr,
      time:        timeStr,
      studentId,
      studentName: name,
      classLevel:  st ? (st.classLevel || st.class || '') : '',
      class:       st ? (st.classLevel || st.class || '') : '',
      room:        st ? (st.room || '') : '',
      status,
      method,
      deviceId,
      note: '',
    };

    // 1) บันทึก local
    locals.push(record);
    lsSaveAttendance(locals);

    // 2) sync GAS
    if (CONFIG._hasRealAPI) {
      callGAS('checkAttendance', { studentId, method, deviceId }).catch(err => {
        console.error('[API] checkAttendance GAS failed:', err.message);
        queuePush('checkAttendance', { studentId, method, deviceId });
      });
    }

    return record;
  }

  async function getAttendance(filter = {}) {
    if (CONFIG._hasRealAPI) {
      try {
        const result = await callGAS('getAttendance', filter);
        if (Array.isArray(result)) return result;
      } catch(_) {}
    }
    let local = lsGetAttendance();
    if (filter.date)      local = local.filter(r => r.date === filter.date);
    if (filter.studentId) local = local.filter(r => r.studentId === filter.studentId);
    if (filter.dateFrom)  local = local.filter(r => r.date >= filter.dateFrom);
    if (filter.dateTo)    local = local.filter(r => r.date <= filter.dateTo);
    return local;
  }

  async function updateAttendanceStatus(studentId, date, status, note = '') {
    // local
    const all = lsGetAttendance();
    const idx = all.findIndex(r => r.studentId === studentId && r.date === date);
    if (idx >= 0) { all[idx].status = status; all[idx].note = note; lsSaveAttendance(all); }

    // GAS
    if (CONFIG._hasRealAPI) {
      callGAS('updateAttendanceStatus', { studentId, date, status, note }).catch(err => {
        console.error('[API] updateAttendanceStatus GAS failed:', err.message);
      });
    }
    return { success: true };
  }

  // ════════════════════════════════════════
  // FACE IMAGE / DESCRIPTOR
  // ════════════════════════════════════════

  async function uploadFaceImage(studentId, imageBase64) {
    if (!CONFIG._hasRealAPI) {
      // Demo: ใช้ base64 โดยตรง
      return { imageUrl: imageBase64, fileId: 'local' };
    }
    return await callGAS('uploadFaceImage', { studentId, imageBase64 });
  }

  async function saveFaceDescriptor(studentId, descriptor, imageUrl) {
    // local
    const local = lsGetStudents();
    const idx   = local.findIndex(s => s.id === studentId || s.studentId === studentId);
    if (idx >= 0) {
      local[idx].faceDescriptor = descriptor;
      local[idx].faceImageUrl   = imageUrl || local[idx].faceImageUrl;
      local[idx].imageUrl       = local[idx].faceImageUrl;
      lsSaveStudents(local);
    }

    // GAS
    if (CONFIG._hasRealAPI) {
      callGAS('saveFaceDescriptor', { studentId, descriptor, imageUrl }).then(() => {
        if (CONFIG.DEBUG) console.log('[API] saveFaceDescriptor synced to GAS ✅');
        showSyncBadge('✅ บันทึก Face Descriptor ลง Google Sheet แล้ว');
      }).catch(err => {
        console.error('[API] saveFaceDescriptor GAS failed:', err.message);
        queuePush('saveFaceDescriptor', { studentId, descriptor, imageUrl });
      });
    }
    return { success: true };
  }

  // ════════════════════════════════════════
  // DASHBOARD
  // ════════════════════════════════════════

  async function getDashboard(range = 'today') {
    if (CONFIG._hasRealAPI) {
      try { return await callGAS('getDashboard', { range }); } catch(_) {}
    }
    // local fallback
    const { start, end } = getDateRange(range);
    const records = lsGetAttendance().filter(r => {
      const d = new Date(r.date); return d >= start && d <= end;
    });
    const counts = { present:0, late:0, absent:0, leave:0 };
    const seen   = new Set();
    records.forEach(r => {
      const k = r.studentId + '_' + r.date;
      if (!seen.has(k)) { seen.add(k); counts[r.status] = (counts[r.status]||0) + 1; }
    });
    const total = Object.values(counts).reduce((a,b)=>a+b,0);
    return { counts, total, presentRate: total ? ((counts.present/total)*100).toFixed(1) : '0.0' };
  }

  async function getSettings() {
    if (CONFIG._hasRealAPI) {
      try { return await callGAS('getSettings', {}); } catch(_) {}
    }
    return { schoolName: CONFIG.SCHOOL_NAME, lateTime: CONFIG.LATE_TIME };
  }

  async function ping() {
    if (!CONFIG._hasRealAPI) return { pong: false, reason: 'No API URL' };
    return await callGAS('ping', {});
  }

  // ════════════════════════════════════════
  // Offline Queue (retry ทีหลัง)
  // ════════════════════════════════════════

  function queuePush(action, params) {
    const q = JSON.parse(localStorage.getItem('fa_sync_queue') || '[]');
    q.push({ action, params, ts: Date.now() });
    localStorage.setItem('fa_sync_queue', JSON.stringify(q));
    if (CONFIG.DEBUG) console.log('[Queue] Added:', action, '— Queue size:', q.length);
  }

  async function flushQueue() {
    if (!CONFIG._hasRealAPI) return;
    const q = JSON.parse(localStorage.getItem('fa_sync_queue') || '[]');
    if (!q.length) return;
    const remaining = [];
    for (const item of q) {
      try {
        await callGAS(item.action, item.params);
        if (CONFIG.DEBUG) console.log('[Queue] Flushed:', item.action);
      } catch(_) {
        remaining.push(item);
      }
    }
    localStorage.setItem('fa_sync_queue', JSON.stringify(remaining));
    if (remaining.length === 0) {
      showSyncBadge('✅ Sync ข้อมูลครบแล้ว');
    }
  }

  // ════════════════════════════════════════
  // Helpers — field name mapping
  // ════════════════════════════════════════

  /** แปลง object จาก form → format ที่ Apps Script ต้องการ */
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

  /** แปลงจาก GAS format → local format (ให้ใช้ได้ทั้งสองทาง) */
  function gasToLocal(d) {
    return {
      id:            d.studentId   || d.id,
      studentId:     d.studentId   || d.id,
      prefix:        d.prefix      || '',
      firstName:     d.firstName   || '',
      lastName:      d.lastName    || '',
      classLevel:    d.classLevel  || d.class || '',
      class:         d.classLevel  || d.class || '',  // alias
      room:          String(d.room || ''),
      no:            d.number      || d.no || 1,
      number:        d.number      || d.no || 1,
      gender:        d.gender      || '',
      faceImageUrl:  d.faceImageUrl  || '',
      imageUrl:      d.faceImageUrl  || '',
      faceDescriptor:d.faceDescriptor || null,
      activeStatus:  d.activeStatus  || 'active',
      status:        d.activeStatus  || 'active',
    };
  }

  // ── Toast สำหรับแจ้ง Sync status ──────────
  function showSyncBadge(msg, type = 'success') {
    // ใช้ showToast จาก auth.js ถ้ามี
    if (typeof showToast === 'function') {
      showToast(msg, '', type, 2500);
    }
  }

  // Auto flush queue + sync GAS token ตอนหน้าเว็บโหลด
  window.addEventListener('load', () => {
    syncGASToken().then(() => {
      setTimeout(flushQueue, 2000);
    });
  });

  // ════════════════════════════════════════
  // Public API
  // ════════════════════════════════════════

  return {
    // Students
    getStudents,
    addStudent,
    updateStudent,
    deleteStudent,

    // Attendance
    checkAttendance,
    getAttendance,
    updateAttendanceStatus,

    // Face
    uploadFaceImage,
    saveFaceDescriptor,

    // Dashboard
    getDashboard,
    getSettings,
    ping,

    // Utils
    flushQueue,
    syncGASToken,
    normalizeStudent,
    gasToLocal,
  };

})();
