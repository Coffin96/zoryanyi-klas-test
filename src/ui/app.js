import { onTeacherStateChanged, logoutTeacher } from '../data/firebase.js';
import { listenConfig, listenStock } from '../data/repo.js';
import { renderAuth } from './auth.js';
import { renderScanner, stopScanner, startScanner } from './scanner.js';
import { renderStudentPanel } from './student-panel.js';
import { renderStudentList } from './student-list.js';
import { renderAdmin } from './admin.js';
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db } from '../data/firebase.js';
import { defaultConfig } from '../data/default-config.js';
import { iconPrimogem, iconFiligreeDivider } from '../components/genshin-icons.js';

export const appState = {
  user: null,
  config: null,
  stock: null,
  view: 'auth', // 'auth', 'scanner', 'student-panel', 'student-list', 'admin'
  currentStudent: null, // { uuid, alias }
  toastTimeout: null
};

if (typeof window !== 'undefined') {
  window.zklas = appState;
}

export function initApp() {
  onTeacherStateChanged(user => {
    appState.user = user;
    if (user) {
      if (appState.view === 'auth') {
        appState.view = 'scanner';
      }
      listenConfig(
        c => { appState.config = c; render(); },
        e => { console.error('Config listen error:', e); render(); }
      );
      listenStock(
        s => { appState.stock = s; render(); },
        e => console.error('Stock listen error:', e)
      );
    } else {
      stopScanner();
      appState.view = 'auth';
      render();
    }
  });
}

export function navigate(view, params = {}) {
  // If moving away from scanner to any other tab, cleanly release camera
  if (view !== 'scanner') {
    stopScanner();
  }
  appState.view = view;
  if (view === 'student-panel') {
    appState.currentStudent = params.student;
    appState.currentOrder = params.order || null;
  }
  render();
  if (view === 'scanner') {
    startScanner();
  }
}

export function showToast(msg, action = null) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'receipt-toast flex justify-between items-center gap-md';
    toast.setAttribute('aria-live', 'polite');
    document.body.appendChild(toast);
  }
  
  toast.innerHTML = `<span>${msg}</span>`;
  if (action) {
    const btn = document.createElement('button');
    btn.textContent = action.text;
    btn.className = 'btn-genshin-gold';
    btn.style.padding = '4px 10px';
    btn.style.minHeight = '32px';
    btn.style.fontSize = '12px';
    btn.style.borderRadius = '10px';
    btn.addEventListener('click', () => {
      action.handler();
      toast.classList.remove('show');
    });
    toast.appendChild(btn);
  }

  toast.classList.add('show');
  
  if (appState.toastTimeout) clearTimeout(appState.toastTimeout);
  appState.toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 4000);
}

function render() {
  const root = document.getElementById('app');
  if (!root) return;

  // 1. Auth view
  if (appState.view === 'auth') {
    renderAuth(root);
    return;
  }

  // 2. Uninitialized database state
  if (!appState.config) {
    root.innerHTML = `
      <div class="container text-center flex flex-col items-center gap-md" style="padding-top: var(--spacing-xl);">
        <div style="filter: drop-shadow(0 0 16px var(--gold-glow));">
          ${iconPrimogem(56)}
        </div>
        <h2 class="fantasy-title" style="margin: 0; font-size: 24px;">Кабінет вчителя</h2>
        <p class="text-muted" style="max-width: 380px;">Якщо це перший запуск, ініціалізуйте початкову конфігурацію в базі даних:</p>
        <button id="btn-seed-config" class="btn-genshin-gold" style="padding: 12px 24px;">Завантажити початкову конфігурацію</button>
        <div class="surface-card text-left" style="font-size: 13px; margin-top: var(--spacing-md); max-width: 450px;">
          <strong style="color: var(--gold-light);">Ваш UID вчителя:</strong><br>
          <code style="word-break: break-all; color: var(--cyan-accent); font-size: 12px;">${appState.user?.uid || ''}</code>
          <p style="margin-top: 8px; margin-bottom: 0;" class="text-muted">
            У Firebase Console → Firestore Database створіть колекцію <code>admins</code> із документом <code>${appState.user?.uid || ''}</code>, щоб надати собі права вчителя.
          </p>
        </div>
      </div>
    `;
    const btn = document.getElementById('btn-seed-config');
    if (btn) {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.textContent = 'Збереження...';
        try {
          await setDoc(doc(db, "config", "published"), defaultConfig);
          await setDoc(doc(db, "config", "stock"), { items: { tartlet: 24 } });
          showToast('Конфігурацію успішно збережено!');
        } catch (err) {
          console.error(err);
          alert('Помилка: ' + err.message + '\n\nПеревірте у Firebase Console:\n1. Чи створено документ admins/' + appState.user?.uid + '\n2. Чи збережено firestore.rules у Rules');
          btn.disabled = false;
          btn.textContent = 'Завантажити початкову конфігурацію';
        }
      });
    }
    return;
  }

  // 3. Main teacher layout with fixed bottom navigation in Genshin style
  root.innerHTML = `
    <div id="teacher-view-container" style="padding-bottom: 80px;"></div>
    
    <nav class="genshin-bottom-nav" aria-label="Вчительська навігація">
      <button class="genshin-nav-btn ${appState.view === 'scanner' ? 'active' : ''}" data-view="scanner">
        <span class="nav-icon" style="font-size: 20px;">📷</span>
        <span class="nav-label">Сканер</span>
      </button>
      <button class="genshin-nav-btn ${appState.view === 'student-list' ? 'active' : ''}" data-view="student-list">
        <span class="nav-icon" style="font-size: 20px;">👥</span>
        <span class="nav-label">Учні</span>
      </button>
      <button class="genshin-nav-btn ${appState.view === 'admin' ? 'active' : ''}" data-view="admin">
        <span class="nav-icon" style="font-size: 20px;">⚙️</span>
        <span class="nav-label">Адмінка</span>
      </button>
      <button id="btn-global-logout" class="genshin-nav-btn" style="color: #ff8585;">
        <span class="nav-icon" style="font-size: 20px;">🚪</span>
        <span class="nav-label">Вийти</span>
      </button>
    </nav>
  `;

  document.querySelectorAll('.genshin-nav-btn[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetView = btn.dataset.view;
      if (targetView !== 'scanner') {
        stopScanner();
      }
      navigate(targetView);
    });
  });

  const logoutBtn = document.getElementById('btn-global-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      if (confirm('Вийти з облікового запису вчителя?')) {
        stopScanner();
        logoutTeacher();
      }
    });
  }

  const container = document.getElementById('teacher-view-container');
  if (appState.view === 'scanner') {
    renderScanner(container);
    startScanner();
  } else if (appState.view === 'student-panel') {
    renderStudentPanel(container);
  } else if (appState.view === 'student-list') {
    renderStudentList(container);
  } else if (appState.view === 'admin') {
    renderAdmin(container);
  }
}
