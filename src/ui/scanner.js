import { navigate, appState, showToast } from './app.js';
import { parseQR } from '../engine/qr-protocol.js';
import { getProfile } from '../data/repo.js';
import { texts } from '../i18n/uk.js';
import { logoutTeacher } from '../data/firebase.js';
import { kyivParts } from '../engine/time.js';

let stream = null;
let scanInterval = null;

export function renderScanner(root) {
  root.innerHTML = `
    <div class="container">
      <div class="top-bar">
        <h2 style="margin:0;">Сканер QR-кодів</h2>
        <button id="btn-to-students-top" class="primary" style="padding: 6px 12px; font-size: 13px;">👥 Учні</button>
      </div>

      <div class="scanner-container">
        <video id="scanner-video" class="scanner-video" playsinline></video>
        <div class="scanner-overlay"></div>
      </div>
      
      <p id="scanner-msg" class="text-center text-muted" style="margin: 8px 0 16px 0;">Наведи камеру на QR-картку або телефон учня</p>
      
      <div class="flex flex-col gap-sm">
        <button id="btn-list" class="primary" style="width: 100%; padding: 12px;">👥 Вибрати учня зі списку</button>
        <button id="btn-quick-create" style="width: 100%; padding: 12px; background: var(--surface); border: 1px solid rgba(255,255,255,0.1);">➕ Створити учня</button>
      </div>
    </div>
  `;

  const goToList = () => {
    stopScanner();
    navigate('student-list');
  };

  document.getElementById('btn-to-students-top').addEventListener('click', goToList);
  document.getElementById('btn-list').addEventListener('click', goToList);
  document.getElementById('btn-quick-create').addEventListener('click', goToList);

  startScanner();
}

async function startScanner() {
  const video = document.getElementById('scanner-video');
  const msgEl = document.getElementById('scanner-msg');
  if (!video) return;

  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    video.srcObject = stream;
    video.setAttribute("playsinline", true);
    await video.play();
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    scanInterval = setInterval(() => {
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.height = video.videoHeight;
        canvas.width = video.videoWidth;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // window.jsQR comes from vendor/jsQR.min.js
        const code = window.jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert",
        });

        if (code && code.data) {
          handleScan(code.data);
        }
      }
    }, 250);
  } catch (err) {
    console.error(err);
    msgEl.textContent = texts.scan.noCamera;
    msgEl.classList.add('error-text');
  }
}

export function stopScanner() {
  if (scanInterval) {
    clearInterval(scanInterval);
    scanInterval = null;
  }
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
}

let isProcessing = false;

async function handleScan(data) {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const nowMs = Date.now();
    const qrData = parseQR(data, nowMs); // throws Error on invalid
    
    if (qrData.type === 'P') {
      const profile = await getProfile(qrData.uuid);
      stopScanner();
      navigate('student-panel', { student: { uuid: profile.id, alias: profile.alias } });
    } else if (qrData.type === 'R') {
      const { ymd } = kyivParts(nowMs);
      if (qrData.ymd !== ymd) {
        throw new Error("expired-order");
      }
      const profile = await getProfile(qrData.uuid);
      stopScanner();
      navigate('student-panel', { 
        student: { uuid: profile.id, alias: profile.alias }, 
        order: { item: qrData.item, qty: qrData.qty } 
      });
    } else {
      throw new Error("unsupported-qr");
    }
  } catch (err) {
    console.error(err);
    const msgEl = document.getElementById('scanner-msg');
    if (msgEl) {
      msgEl.textContent = err.message === 'expired-order' ? 'Замовлення прострочено (створено не сьогодні)' : texts.scan.unknown;
      msgEl.style.color = 'var(--danger)';
      setTimeout(() => {
        if (msgEl) {
          msgEl.textContent = 'Наведи на QR учня';
          msgEl.style.color = 'var(--muted)';
        }
      }, 3000);
    }
  } finally {
    setTimeout(() => { isProcessing = false; }, 2000); // debounce
  }
}
