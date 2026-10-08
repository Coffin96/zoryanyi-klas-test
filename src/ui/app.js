import { onTeacherStateChanged, logoutTeacher } from '../data/firebase.js';
import { listenConfig, listenStock } from '../data/repo.js';
import { renderAuth } from './auth.js';
import { renderScanner, stopScanner } from './scanner.js';
import { renderStudentPanel } from './student-panel.js';
import { renderStudentList } from './student-list.js';
import { renderAdmin } from './admin.js';
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db } from '../data/firebase.js';
import { defaultConfig } from '../data/default-config.js';

export const appState = {
  user: null,
  config: null,
  stock: null,
  view: 'auth', // 'auth', 'scanner', 'student-panel', 'student-list', 'admin'
  currentStudent: null, // { uuid, alias }
  toastTimeout: null
};

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
      appState.view = 'auth';
      render();
    }
  });
}

export function navigate(view, params = {}) {
  // If moving away from scanner, cleanly release camera
  if (appState.view === 'scanner' && view !== 'scanner') {
    stopScanner();
  }
  appState.view = view;
  if (view === 'student-panel') {
    appState.currentStudent = params.student;
    appState.currentOrder = params.order || null;
  }
  render();
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
    btn.style.padding = '4px 8px';
    btn.style.minHeight = 'auto';
    btn.style.backgroundColor = 'rgba(255,255,255,0.2)';
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
        <h2>Завантаження конфігурації...</h2>
        <p class="text-muted">Якщо це перший запуск, ініціалізуйте початкові налаштування в базі даних:</p>
        <button id="btn-seed-config" class="primary">Завантажити початкову конфігурацію</button>
        <div class="surface-card text-left" style="font-size: 13px; margin-top: var(--spacing-md); max-width: 450px;">
          <strong>Ваш UID вчителя:</strong><br>
          <code style="word-break: break-all; color: var(--accent);">${appState.user?.uid || ''}</code>
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

  // 3. Main teacher layout with fixed bottom navigation
  root.innerHTML = `
    <div id="teacher-view-container" style="padding-bottom: 75px;"></div>
    
    <nav style="position:fixed; bottom:0; left:0; right:0; background:var(--surface); display:flex; justify-content:space-around; padding:8px 0; border-top: 1px solid rgba(255,255,255,0.08); z-index:100; box-shadow: 0 -4px 12px rgba(0,0,0,0.2);">
      <button class="nav-teacher-btn ${appState.view === 'scanner' ? 'active' : ''}" data-view="scanner" style="flex:1; background:transparent; border:none; display:flex; flex-direction:column; align-items:center; cursor:pointer;">
        <span style="font-size:20px; line-height: 1;">📷</span>
        <span style="font-size:11px; margin-top: 4px;">Сканер</span>
      </button>
      <button class="nav-teacher-btn ${appState.view === 'student-list' ? 'active' : ''}" data-view="student-list" style="flex:1; background:transparent; border:none; display:flex; flex-direction:column; align-items:center; cursor:pointer;">
        <span style="font-size:20px; line-height: 1;">👥</span>
        <span style="font-size:11px; margin-top: 4px;">Учні</span>
      </button>
      <button class="nav-teacher-btn ${appState.view === 'admin' ? 'active' : ''}" data-view="admin" style="flex:1; background:transparent; border:none; display:flex; flex-direction:column; align-items:center; cursor:pointer;">
        <span style="font-size:20px; line-height: 1;">⚙️</span>
        <span style="font-size:11px; margin-top: 4px;">Адмінка</span>
      </button>
      <button id="btn-global-logout" style="flex:1; background:transparent; border:none; display:flex; flex-direction:column; align-items:center; cursor:pointer; color: var(--danger);">
        <span style="font-size:20px; line-height: 1;">🚪</span>
        <span style="font-size:11px; margin-top: 4px;">Вийти</span>
      </button>
    </nav>
  `;

  document.querySelectorAll('.nav-teacher-btn').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.view));
    if (btn.classList.contains('active')) {
      btn.style.color = 'var(--star)';
      btn.style.fontWeight = 'bold';
    } else {
      btn.style.color = 'var(--muted)';
      btn.style.fontWeight = 'normal';
    }
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
  } else if (appState.view === 'student-panel') {
    renderStudentPanel(container);
  } else if (appState.view === 'student-list') {
    renderStudentList(container);
  } else if (appState.view === 'admin') {
    renderAdmin(container);
  }
}
