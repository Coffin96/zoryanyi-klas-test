import { navigate, appState, showToast } from './app.js';
import { parseQR } from '../engine/qr-protocol.js';
import { getProfile } from '../data/repo.js';
import { texts } from '../i18n/uk.js';
import { kyivParts } from '../engine/time.js';
import { iconFiligreeDivider } from '../components/genshin-icons.js';

let stream = null;
let scanInterval = null;

export function renderScanner(root) {
  root.innerHTML = `
    <div class="container">
      <div class="top-bar flex justify-between items-center">
        <h2 class="fantasy-title" style="margin:0; font-size: 20px;">Сканер QR-кодів</h2>
        <button id="btn-to-students-top" class="btn-genshin-gold" style="padding: 6px 14px; font-size: 13px; min-height: 36px; border-radius: 12px;">
          👥 Учні
        </button>
      </div>

      <div class="scanner-container">
        <video id="scanner-video" class="scanner-video" playsinline></video>
        <div class="scanner-overlay"></div>
      </div>
      
      <p id="scanner-msg" class="text-center" style="margin: 8px 0 16px 0; font-size: 14px; color: var(--gold-light);">
        Наведи камеру на QR-картку або екран учня
      </p>
      
      <div class="flex flex-col gap-sm">
        <button id="btn-list" class="btn-genshin-gold" style="width: 100%; padding: 13px; font-size: 15px; border-radius: 14px;">
          👥 Вибрати учня зі списку
        </button>
        <button id="btn-quick-create" class="surface-card" style="width: 100%; padding: 13px; font-size: 15px; border-radius: 14px; border: 1px solid var(--gold-border); text-align: center; justify-content: center; color: var(--gold-light); cursor: pointer;">
          ➕ Створити учня в класі
        </button>
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
      msgEl.style.color = '#ff7575';
      setTimeout(() => {
        if (msgEl) {
          msgEl.textContent = 'Наведи камеру на QR учня';
          msgEl.style.color = 'var(--gold-light)';
        }
      }, 3000);
    }
  } finally {
    setTimeout(() => { isProcessing = false; }, 2000); // debounce
  }
}
