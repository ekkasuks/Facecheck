// ============================================
// api.js — Frontend API Client
// เรียกใช้ Google Apps Script REST API
// ============================================

const API = (() => {
  function getToken() {
    const user = sessionStorage.getItem('user');
    return user ? JSON.parse(user).token || '' : '';
  }

  async function call(action, params = {}, method = 'POST') {
    const url = CONFIG.API_URL;
    if (!url || url.includes('YOUR_SCRIPT')) {
      // Demo mode — use localStorage
      return demoCall(action, params);
    }

    const payload = { action, token: getToken(), ...params };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload),
        mode: 'cors'
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'API Error');
      return data.data;
    } catch (err) {
      if (CONFIG.DEBUG) console.warn(`API call failed (${action}):`, err.message, '— using demo data');
      return demoCall(action, params);
    }
  }

  // Demo fallback using localStorage
  function demoCall(action, params) {
    switch (action) {
      case 'ping': return { pong: true };
      case 'getStudents': {
        let s = getStudents();
        if (params.class) s = s.filter(st => st.class === params.class);
        if (params.room) s = s.filter(st => st.room === params.room);
        return s;
      }
      case 'addStudent': {
        const all = getStudents();
        all.push(params);
        saveStudents(all);
        return { id: params.id, success: true };
      }
      case 'updateStudent': {
        const all = getStudents();
        const idx = all.findIndex(s => s.id === params.studentId);
        if (idx >= 0) { all[idx] = { ...all[idx], ...params }; saveStudents(all); }
        return { success: true };
      }
      case 'deleteStudent': {
        const all = getStudents().filter(s => s.id !== params.studentId);
        saveStudents(all);
        return { success: true };
      }
      case 'checkAttendance': {
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
        const [lh, lm] = CONFIG.LATE_TIME.split(':').map(Number);
        const [ch, cm] = timeStr.split(':').map(Number);
        const status = (ch > lh || (ch === lh && cm > lm)) ? 'late' : 'present';
        const student = getStudents().find(s => s.id === params.studentId);
        const record = {
          id: `A${Date.now()}`,
          date: dateStr, time: timeStr,
          studentId: params.studentId,
          studentName: student ? `${student.prefix}${student.firstName} ${student.lastName}` : params.studentId,
          class: student?.class, room: student?.room,
          status, method: params.method || 'face',
          deviceId: params.deviceId || 'DEVICE-01', note: ''
        };
        const all = getAttendance();
        all.push(record);
        saveAttendance(all);
        return record;
      }
      case 'getAttendance': {
        let records = getAttendance();
        if (params.date) records = records.filter(r => r.date === params.date);
        if (params.studentId) records = records.filter(r => r.studentId === params.studentId);
        return records;
      }
      case 'getDashboard': return buildDemoDashboard(params);
      case 'getSettings': return { schoolName: CONFIG.SCHOOL_NAME, lateTime: CONFIG.LATE_TIME };
      default: return { demo: true, action };
    }
  }

  function buildDemoDashboard(params) {
    const { start, end } = getDateRange(params.range || 'today');
    const records = getAttendance().filter(r => {
      const d = new Date(r.date);
      return d >= start && d <= end;
    });
    const counts = { present: 0, late: 0, absent: 0, leave: 0 };
    const seen = new Set();
    records.forEach(r => {
      const key = `${r.studentId}_${r.date}`;
      if (!seen.has(key)) { seen.add(key); counts[r.status] = (counts[r.status] || 0) + 1; }
    });
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    return { counts, total, presentRate: total > 0 ? ((counts.present / total) * 100).toFixed(1) : 0 };
  }

  return {
    // Students
    getStudents: (params) => call('getStudents', params),
    addStudent: (data) => call('addStudent', data),
    updateStudent: (data) => call('updateStudent', data),
    deleteStudent: (id) => call('deleteStudent', { studentId: id }),

    // Attendance
    checkAttendance: (studentId, method, deviceId) => call('checkAttendance', { studentId, method, deviceId }),
    getAttendance: (params) => call('getAttendance', params),
    updateAttendanceStatus: (attendanceId, studentId, date, status, note) =>
      call('updateAttendanceStatus', { attendanceId, studentId, date, status, note }),

    // Dashboard
    getDashboard: (range) => call('getDashboard', { range }),
    getClassSummary: (params) => call('getClassSummary', params),

    // Settings
    getSettings: () => call('getSettings', {}),
    saveSetting: (key, value) => call('saveSettings', { key, value }),

    // Face
    uploadFaceImage: (studentId, imageBase64) => call('uploadFaceImage', { studentId, imageBase64 }),
    saveFaceDescriptor: (studentId, descriptor, imageUrl) =>
      call('saveFaceDescriptor', { studentId, descriptor, imageUrl }),

    // Ping
    ping: () => call('ping', {}),
  };
})();
