// ============================================
// faceRecognition.js — Face Recognition Engine
// ใช้ face-api.js สำหรับตรวจจับและจับคู่ใบหน้า
// ============================================

const FaceEngine = (() => {
  let isLoaded = false;
  let faceMatcher = null;
  let studentDescriptors = [];

  const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/model/';

  // ── Load Models ──────────────────────────────
  async function loadModels(onProgress) {
    if (isLoaded) return true;
    if (typeof faceapi === 'undefined') throw new Error('face-api.js ยังไม่โหลด');

    const steps = [
      { name: 'SSD MobileNet', net: faceapi.nets.ssdMobilenetv1, progress: 30 },
      { name: 'Face Landmarks', net: faceapi.nets.faceLandmark68Net, progress: 65 },
      { name: 'Face Recognition', net: faceapi.nets.faceRecognitionNet, progress: 100 },
    ];

    for (const step of steps) {
      onProgress?.(step.progress - 10, `โหลด ${step.name}...`);
      await step.net.loadFromUri(MODEL_URL);
      onProgress?.(step.progress, `${step.name} พร้อม ✓`);
      await sleep(100);
    }

    isLoaded = true;
    return true;
  }

  // ── Build Face Matcher ────────────────────────
  async function buildMatcher(students) {
    if (!isLoaded) throw new Error('โหลด models ก่อน');

    const labeled = students
      .filter(s => s.faceDescriptor && Array.isArray(s.faceDescriptor) && s.faceDescriptor.length === 128)
      .map(s => {
        const desc = new Float32Array(s.faceDescriptor);
        return new faceapi.LabeledFaceDescriptors(s.id, [desc]);
      });

    if (labeled.length === 0) {
      faceMatcher = null;
      return 0;
    }

    faceMatcher = new faceapi.FaceMatcher(labeled, CONFIG.FACE_MATCH_THRESHOLD);
    studentDescriptors = labeled;
    return labeled.length;
  }

  // ── Detect Faces ──────────────────────────────
  async function detectFaces(videoElement) {
    if (!isLoaded) return [];
    return await faceapi
      .detectAllFaces(videoElement, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
      .withFaceLandmarks()
      .withFaceDescriptors();
  }

  // ── Detect Single Face ────────────────────────
  async function detectSingleFace(imageElement) {
    if (!isLoaded) throw new Error('โหลด models ก่อน');
    return await faceapi
      .detectSingleFace(imageElement, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
      .withFaceLandmarks()
      .withFaceDescriptor();
  }

  // ── Match Face ────────────────────────────────
  function matchFace(descriptor) {
    if (!faceMatcher) return null;
    const match = faceMatcher.findBestMatch(descriptor);
    if (match.label === 'unknown') return null;
    return {
      studentId: match.label,
      distance: match.distance,
      confidence: Math.max(0, Math.min(100, (1 - match.distance) * 100))
    };
  }

  // ── Draw Detection ────────────────────────────
  function drawDetections(canvas, video, detections, matchResults = []) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    detections.forEach((det, i) => {
      const box = det.detection.box;
      const match = matchResults[i];
      const color = match ? '#10b981' : '#ef4444';
      const lineWidth = 2;

      // Corner-style bounding box
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;

      const cornerLen = Math.min(box.width, box.height) * 0.2;
      drawCornerBox(ctx, box.x, box.y, box.width, box.height, cornerLen);

      // Face mesh dots (landmarks)
      if (det.landmarks) {
        ctx.fillStyle = `${color}80`;
        ctx.shadowBlur = 0;
        det.landmarks.positions.forEach(pt => {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 1.5, 0, 2 * Math.PI);
          ctx.fill();
        });
      }

      // Label
      if (match) {
        ctx.shadowBlur = 0;
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.9;
        const label = `${match.confidence.toFixed(0)}%`;
        ctx.font = 'bold 13px IBM Plex Sans Thai, sans-serif';
        const tw = ctx.measureText(label).width;
        ctx.fillRect(box.x, box.y - 22, tw + 14, 20);
        ctx.fillStyle = '#fff';
        ctx.globalAlpha = 1;
        ctx.fillText(label, box.x + 7, box.y - 6);
      }
    });
  }

  function drawCornerBox(ctx, x, y, w, h, len) {
    const corners = [
      [x, y, x + len, y, x, y + len],
      [x + w, y, x + w - len, y, x + w, y + len],
      [x, y + h, x + len, y + h, x, y + h - len],
      [x + w, y + h, x + w - len, y + h, x + w, y + h - len]
    ];
    corners.forEach(([ax, ay, bx, by, cx, cy]) => {
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(ax, ay);
      ctx.lineTo(cx, cy);
      ctx.stroke();
    });
  }

  // ── Extract Descriptor from Image ────────────
  async function extractDescriptorFromImage(imageSource) {
    if (!isLoaded) throw new Error('โหลด models ก่อน');

    let img;
    if (typeof imageSource === 'string') {
      img = new Image();
      img.src = imageSource;
      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = rej;
      });
    } else {
      img = imageSource;
    }

    const detection = await faceapi
      .detectSingleFace(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 }))
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) throw new Error('ไม่พบใบหน้าในภาพ กรุณาถ่ายรูปใหม่');
    return Array.from(detection.descriptor);
  }

  // ── Crop Face from Canvas ─────────────────────
  function cropFaceFromVideo(video, detection, paddingRatio = 0.3) {
    const canvas = document.createElement('canvas');
    const box = detection.detection.box;
    const pad = Math.min(box.width, box.height) * paddingRatio;
    const x = Math.max(0, box.x - pad);
    const y = Math.max(0, box.y - pad);
    const w = Math.min(video.videoWidth - x, box.width + pad * 2);
    const h = Math.min(video.videoHeight - y, box.height + pad * 2);
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d').drawImage(video, x, y, w, h, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', 0.85);
  }

  // ── TTS ────────────────────────────────────────
  function speak(text, lang = 'th-TH') {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang;
    utter.rate = 0.95;
    utter.pitch = 1.0;
    utter.volume = 1.0;
    window.speechSynthesis.speak(utter);
  }

  function speakWelcome(student, status) {
    const name = `${student.prefix}${student.firstName}`;
    const classRoom = `${student.class} ${student.room}`;
    const msg = status === 'present'
      ? `ยินดีต้อนรับ ${name} ชั้น ${classRoom}`
      : `${name} มาสาย กรุณาพบครูที่ปรึกษา`;
    speak(msg);
  }

  function speakUnknown() {
    speak('ไม่พบข้อมูลใบหน้า กรุณาติดต่อครูประจำชั้น');
  }

  // ── Helpers ────────────────────────────────────
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function isReady() { return isLoaded; }
  function hasDescriptors() { return studentDescriptors.length > 0; }
  function getDescriptorCount() { return studentDescriptors.length; }

  return {
    loadModels,
    buildMatcher,
    detectFaces,
    detectSingleFace,
    matchFace,
    drawDetections,
    extractDescriptorFromImage,
    cropFaceFromVideo,
    speak,
    speakWelcome,
    speakUnknown,
    isReady,
    hasDescriptors,
    getDescriptorCount,
  };
})();
