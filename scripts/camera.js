// ============================================
// camera.js — Camera Manager
// จัดการ WebRTC Camera สำหรับการถ่ายภาพ
// ============================================

const CameraManager = (() => {
  let stream = null;
  let currentVideoEl = null;
  let facingMode = 'user';

  // ── Start Camera ────────────────────────────
  async function start(videoElement, options = {}) {
    stop(); // Close any existing stream

    const constraints = {
      video: {
        width: { ideal: options.width || 640 },
        height: { ideal: options.height || 480 },
        facingMode: options.facingMode || facingMode,
        frameRate: { ideal: options.fps || 30 }
      },
      audio: false
    };

    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
      videoElement.srcObject = stream;
      await new Promise((resolve, reject) => {
        videoElement.onloadedmetadata = resolve;
        videoElement.onerror = reject;
        setTimeout(reject, 10000);
      });
      await videoElement.play();
      currentVideoEl = videoElement;
      return { success: true, width: videoElement.videoWidth, height: videoElement.videoHeight };
    } catch (err) {
      let msg = err.message;
      if (err.name === 'NotAllowedError') msg = 'กรุณาอนุญาตการใช้กล้อง';
      else if (err.name === 'NotFoundError') msg = 'ไม่พบกล้องในอุปกรณ์';
      else if (err.name === 'NotReadableError') msg = 'กล้องถูกใช้งานโดยแอปอื่น';
      throw new Error(msg);
    }
  }

  // ── Stop Camera ──────────────────────────────
  function stop() {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
    if (currentVideoEl) {
      currentVideoEl.srcObject = null;
      currentVideoEl = null;
    }
  }

  // ── Capture Frame ────────────────────────────
  function capture(videoElement, options = {}) {
    if (!videoElement || !videoElement.videoWidth) return null;
    const canvas = document.createElement('canvas');
    canvas.width = options.width || videoElement.videoWidth;
    canvas.height = options.height || videoElement.videoHeight;
    const ctx = canvas.getContext('2d');
    if (options.mirror !== false) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL(options.format || 'image/jpeg', options.quality || 0.85);
  }

  // ── Flip Camera ──────────────────────────────
  async function flip(videoElement) {
    facingMode = facingMode === 'user' ? 'environment' : 'user';
    return await start(videoElement, { facingMode });
  }

  // ── Get Available Cameras ─────────────────────
  async function getDevices() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(d => d.kind === 'videoinput').map(d => ({
      id: d.deviceId,
      label: d.label || `กล้อง ${d.deviceId.slice(0, 8)}`
    }));
  }

  // ── Switch Camera ─────────────────────────────
  async function switchTo(videoElement, deviceId) {
    stop();
    stream = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: { exact: deviceId } },
      audio: false
    });
    videoElement.srcObject = stream;
    await videoElement.play();
    currentVideoEl = videoElement;
  }

  function isActive() { return !!stream; }
  function getStream() { return stream; }

  return { start, stop, capture, flip, getDevices, switchTo, isActive, getStream };
})();
