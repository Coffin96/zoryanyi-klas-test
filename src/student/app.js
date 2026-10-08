import { listenConfig, listenProfile } from '../data/repo.js';
import { renderHome } from './home.js';
import { renderQr } from './qr.js';
import { renderShop } from './shop.js';
import { renderQuests } from './quests.js';
import { renderHistory } from './history.js';

export const state = {
  uuid: null,
  profile: null,
  config: null,
  view: 'home',
  offline: !navigator.onLine,
  error: null,
  toastTimeout: null
};

export function initStudentApp() {
  const urlParams = new URLSearchParams(window.location.search);
  let u = urlParams.get('u');
  
  if (!u && window.location.hash) {
    const hashMatch = window.location.hash.match(/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/i);
    if (hashMatch) {
      u = hashMatch[1];
    }
  }
  
  if (u) {
    u = u.toLowerCase();
    try {
      localStorage.setItem('zk_student_uuid', u);
      // Clean up URL so it's clean and cannot be accidentally peeked/shared
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (e) {
      console.warn("Storage or history error:", e);
    }
    state.uuid = u;
  } else {
    try {
      state.uuid = localStorage.getItem('zk_student_uuid');
    } catch (e) {
      state.uuid = null;
    }
  }

  window.addEventListener('online', () => { state.offline = false; state.error = null; renderApp(); });
  window.addEventListener('offline', () => { state.offline = true; renderApp(); });

  // IMMEDIATELY render app state (shows loading or welcome screen, never empty black screen)
  renderApp();

  if (state.uuid) {
    listenConfig(
      c => { 
        state.config = c; 
        state.error = null;
        renderApp(); 
      },
      e => {
        console.error("Config error:", e);
        state.error = 'Помилка конфігурації: ' + e.message;
        renderApp();
      }
    );
    listenProfile(state.uuid,
      p => { 
        if (state.profile && p.balance !== state.profile.balance) {
          const delta = p.balance - state.profile.balance;
          if (delta > 0) {
            showStudentToast(`+${delta} ✦`);
          } else {
            showStudentToast(`${delta} ✦ (Залишок: ${p.balance} ✦)`);
          }
        }
        state.profile = p;
        state.error = null;
        localStorage.setItem('zk_last_profile', JSON.stringify(p));
        renderApp();
      },
      e => {
        console.error("Profile error:", e);
        if (state.offline) {
          const cached = localStorage.getItem('zk_last_profile');
          if (cached) {
            state.profile = JSON.parse(cached);
            renderApp();
            return;
          }
        }
        state.error = 'Профіль учня не знайдено або відсутній доступ.';
        renderApp();
      }
    );
  }
}

export function navigate(view) {
  state.view = view;
  renderApp();
}

export function logout() {
  if (confirm("Відв'язати цей пристрій від учня?")) {
    localStorage.removeItem('zk_student_uuid');
    localStorage.removeItem('zk_last_profile');
    location.reload();
  }
}

export function showStudentToast(msg) {
  let toast = document.getElementById('student-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'student-toast';
    toast.className = 'receipt-toast';
    toast.setAttribute('aria-live', 'polite');
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  
  if (state.toastTimeout) clearTimeout(state.toastTimeout);
  state.toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 3500);
}

function renderApp() {
  const root = document.getElementById('app');
  if (!root) return;

  // Case 1: No UUID linked
  if (!state.uuid) {
    root.innerHTML = `
      <div class="container flex flex-col items-center justify-center text-center" style="min-height: 90vh;">
        <div style="font-size: 56px; margin-bottom: var(--spacing-sm); color: var(--star);">✦</div>
        <h1 class="text-xl" style="margin-bottom: var(--spacing-sm);">Зоряний клас</h1>
        <p class="text-muted" style="max-width: 320px; margin-bottom: var(--spacing-lg);">
          Відскануй свій персональний QR-код або перейди за посиланням від вчителя, щоб відкрити свій зоряний профіль.
        </p>
        <div class="surface-card text-left" style="font-size: 13px; max-width: 320px;">
          <p style="margin: 0;" class="text-muted">
            Підказка: вчитель може згенерувати QR-картку в розділі <strong>«Адміністрування → Друк карток»</strong>.
          </p>
        </div>
      </div>
    `;
    return;
  }

  // Case 2: Error
  if (state.error && !state.profile) {
    root.innerHTML = `
      <div class="container flex flex-col items-center justify-center text-center" style="min-height: 90vh;">
        <div style="font-size: 48px; margin-bottom: var(--spacing-sm); color: var(--danger);">⚠️</div>
        <h2 class="text-lg" style="margin-bottom: var(--spacing-sm);">Помилка завантаження</h2>
        <p class="error-text" style="margin-bottom: var(--spacing-lg); max-width: 340px;">${state.error}</p>
        <div class="flex gap-sm">
          <button onclick="location.reload()" class="primary">Спробувати знову</button>
          <button id="btn-reset-uuid" class="danger">Це не я</button>
        </div>
      </div>
    `;
    const btnReset = document.getElementById('btn-reset-uuid');
    if (btnReset) btnReset.addEventListener('click', logout);
    return;
  }

  // Case 3: Still loading config or profile
  if (!state.profile || !state.config) {
    root.innerHTML = `
      <div class="container flex flex-col items-center justify-center text-center" style="min-height: 90vh;">
        <div style="font-size: 48px; margin-bottom: var(--spacing-sm); color: var(--star);">✦</div>
        <h2 class="text-lg" style="margin-bottom: var(--spacing-sm);">Завантаження профілю...</h2>
        <p class="text-muted">${state.offline ? 'Немає зв\'язку з інтернетом' : 'Отримуємо дані із зоряної бази...'}</p>
      </div>
    `;
    return;
  }

  // Case 4: Loaded successfully - Main student view
  root.innerHTML = `
    ${state.offline ? '<div style="background:var(--muted); color:white; text-align:center; padding:4px; font-size:12px;">Немає зв\'язку, показано останній збережений баланс</div>' : ''}
    <div id="view-container" style="padding-bottom: 75px;"></div>
    
    <nav style="position:fixed; bottom:0; left:0; right:0; background:var(--surface); display:flex; justify-content:space-around; padding:8px 0; border-top: 1px solid rgba(255,255,255,0.08); z-index:100; box-shadow: 0 -4px 12px rgba(0,0,0,0.2);">
      <button class="nav-btn ${state.view === 'home' ? 'active' : ''}" data-view="home" style="flex:1; background:transparent; border:none; display:flex; flex-direction:column; align-items:center; min-height:auto; cursor:pointer;">
        <span style="font-size:20px; line-height: 1;">✦</span>
        <span style="font-size:11px; margin-top: 4px;">Мої ✦</span>
      </button>
      <button class="nav-btn ${state.view === 'qr' ? 'active' : ''}" data-view="qr" style="flex:1; background:transparent; border:none; display:flex; flex-direction:column; align-items:center; min-height:auto; cursor:pointer;">
        <span style="font-size:20px; line-height: 1;">📱</span>
        <span style="font-size:11px; margin-top: 4px;">Мій QR</span>
      </button>
      <button class="nav-btn ${state.view === 'shop' ? 'active' : ''}" data-view="shop" style="flex:1; background:transparent; border:none; display:flex; flex-direction:column; align-items:center; min-height:auto; cursor:pointer;">
        <span style="font-size:20px; line-height: 1;">🛒</span>
        <span style="font-size:11px; margin-top: 4px;">Магазин</span>
      </button>
      <button class="nav-btn ${state.view === 'quests' ? 'active' : ''}" data-view="quests" style="flex:1; background:transparent; border:none; display:flex; flex-direction:column; align-items:center; min-height:auto; cursor:pointer;">
        <span style="font-size:20px; line-height: 1;">🏆</span>
        <span style="font-size:11px; margin-top: 4px;">Квести</span>
      </button>
      <button class="nav-btn ${state.view === 'history' ? 'active' : ''}" data-view="history" style="flex:1; background:transparent; border:none; display:flex; flex-direction:column; align-items:center; min-height:auto; cursor:pointer;">
        <span style="font-size:20px; line-height: 1;">📜</span>
        <span style="font-size:11px; margin-top: 4px;">Історія</span>
      </button>
    </nav>
  `;

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.view));
    if (btn.classList.contains('active')) {
      btn.style.color = 'var(--star)';
      btn.style.fontWeight = 'bold';
    } else {
      btn.style.color = 'var(--muted)';
      btn.style.fontWeight = 'normal';
    }
  });

  const viewContainer = document.getElementById('view-container');
  
  if (state.view === 'home') renderHome(viewContainer, state);
  else if (state.view === 'qr') renderQr(viewContainer, state);
  else if (state.view === 'shop') renderShop(viewContainer, state);
  else if (state.view === 'quests') renderQuests(viewContainer, state);
  else if (state.view === 'history') renderHistory(viewContainer, state);
}
