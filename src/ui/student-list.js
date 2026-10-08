import { navigate, appState, showToast } from './app.js';
import { getActiveProfiles } from '../data/repo.js';
import { getInitials } from '../data/names-db.js';
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db } from '../data/firebase.js';
import { generateQRUrl } from '../engine/qr-protocol.js';

export async function renderStudentList(root) {
  root.innerHTML = `
    <div class="container">
      <div class="top-bar">
        <h2 style="margin:0;">Учні класу</h2>
        <div class="flex gap-sm">
          <button id="btn-quick-scan" class="primary" style="padding: 6px 12px; font-size: 13px;">📷 Сканер</button>
        </div>
      </div>

      <!-- Швидке створення учня -->
      <div class="surface-card" style="margin-bottom: var(--spacing-md); padding: 14px 16px;">
        <div style="font-weight: 600; font-size: 14px; margin-bottom: 8px;">➕ Додати учня:</div>
        <form id="form-quick-add" class="flex gap-sm">
          <input type="text" id="quick-alias-input" placeholder="Псевдонім (напр. Сокіл-01)" maxlength="24" required style="flex:1; min-height: 44px; padding: 8px 12px; font-size: 15px;">
          <button type="submit" id="btn-quick-submit" class="primary" style="min-height: 44px; padding: 8px 16px; white-space: nowrap;">Створити</button>
        </form>
      </div>

      <!-- Додаткові дії -->
      <div class="flex gap-sm" style="margin-bottom: var(--spacing-md);">
        <button id="btn-batch-add" style="flex:1; padding: 10px; background: var(--surface); border: 1px solid rgba(255,255,255,0.1); font-size: 14px;">📝 Списком</button>
        <button id="btn-print-cards-nav" class="primary" style="flex:1; padding: 10px; font-size: 14px;">🖨️ Друк карток</button>
      </div>

      <div class="surface-card">
        <input type="text" id="search" placeholder="Пошук за псевдонімом чи ініціалами..." style="margin-bottom: var(--spacing-md); width:100%; min-height: 44px;">
        <div id="list-container" class="flex flex-col gap-sm">
          <p class="text-muted text-center" style="padding: 16px;">Завантаження...</p>
        </div>
      </div>
    </div>

    <!-- Модальне вікно для відображення QR учня прямо на екрані -->
    <div id="qr-modal" style="display:none; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.8); z-index:200; align-items:center; justify-content:center; padding:16px;">
      <div class="surface-card text-center" style="max-width:320px; width:100%; padding:24px; position:relative;">
        <h3 id="modal-alias" style="margin-top:0; margin-bottom:8px;"></h3>
        <p class="text-muted" style="font-size:13px; margin-bottom:16px;">Учень може відсканувати цей QR камерою телефона:</p>
        <div id="modal-qr-container" style="background:white; padding:12px; border-radius:12px; display:inline-block; margin-bottom:16px;"></div>
        <div id="modal-url" class="text-muted" style="font-size:11px; word-break:break-all; margin-bottom:16px;"></div>
        <div class="flex gap-sm">
          <button id="btn-copy-link" style="flex:1; padding:8px; font-size:13px;">📋 Скопіювати</button>
          <button id="btn-close-modal" class="primary" style="flex:1; padding:8px; font-size:13px;">Закрити</button>
        </div>
      </div>
    </div>
  `;

  // Швидка навігація
  document.getElementById('btn-quick-scan').addEventListener('click', () => navigate('scanner'));
  document.getElementById('btn-batch-add').addEventListener('click', () => navigate('admin'));
  document.getElementById('btn-print-cards-nav').addEventListener('click', () => navigate('admin'));

  // Закриття модального вікна QR
  const modal = document.getElementById('qr-modal');
  document.getElementById('btn-close-modal').addEventListener('click', () => {
    modal.style.display = 'none';
  });
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.style.display = 'none';
  });

  // Завантаження списку
  let profiles = [];
  try {
    profiles = await getActiveProfiles();
    renderListFiltered('');
  } catch (err) {
    console.error(err);
    document.getElementById('list-container').innerHTML = '<p class="error-text text-center">Помилка завантаження списку</p>';
  }

  // Обробка форми швидкого додавання одного учня
  const formAdd = document.getElementById('form-quick-add');
  formAdd.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('quick-alias-input');
    const alias = input.value.trim();
    if (!alias) return;

    const btnSubmit = document.getElementById('btn-quick-submit');
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Збереження...';

    try {
      const pid = crypto.randomUUID();
      await setDoc(doc(db, "profiles", pid), {
        alias: alias,
        archived: false,
        balance: 0,
        earned: 0,
        recent: [],
        hot: [],
        last: null,
        lastOp: null,
        lastAt: {},
        stats: { gradeCount: {}, quests: {}, redeemed: {} },
        counters: {},
        achievements: [],
        v: 1
      });

      input.value = '';
      showToast(`Учня ${alias} успішно створено!`);
      // Оновити список
      profiles = await getActiveProfiles();
      renderListFiltered(document.getElementById('search').value);
      // Відкрити профіль створеного учня
      navigate('student-panel', { student: { uuid: pid, alias: alias } });
    } catch (err) {
      console.error(err);
      alert('Помилка створення учня: ' + err.message);
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'Створити';
    }
  });

  // Фільтрація та рендеринг списку
  function renderListFiltered(filter) {
    const listContainer = document.getElementById('list-container');
    const q = filter.trim().toLowerCase();

    if (profiles.length === 0) {
      listContainer.innerHTML = `
        <div class="text-center" style="padding: 24px;">
          <p class="text-muted">Учнів ще немає. Створіть першого за допомогою форми вище!</p>
        </div>
      `;
      return;
    }

    const filtered = profiles.filter(p => {
      const initials = getInitials(p.alias).toLowerCase();
      return p.alias.toLowerCase().includes(q) || initials.includes(q);
    });

    if (filtered.length === 0) {
      listContainer.innerHTML = '<p class="text-muted text-center" style="padding: 16px;">Нікого не знайдено</p>';
      return;
    }

    listContainer.innerHTML = filtered.map(p => {
      const initials = getInitials(p.alias);
      const display = initials ? `${p.alias} <span class="text-muted">(${initials})</span>` : p.alias;
      return `
        <div class="shop-item flex justify-between items-center" style="padding: 10px 12px; gap: 8px; flex-wrap: wrap;">
          <div class="btn-open-student flex flex-col" data-id="${p.id}" data-alias="${p.alias}" style="cursor: pointer; flex: 1; min-width: 160px;">
            <div style="font-size: 16px; font-weight: bold;">${display}</div>
            <div class="text-muted" style="font-size: 12px; margin-top: 2px;">Баланс: <span style="color:var(--star); font-weight:bold;">${p.balance} ✦</span> (зароблено ${p.earned} ✦)</div>
          </div>
          <div class="flex items-center gap-xs" style="flex-wrap: nowrap;">
            <button class="btn-show-qr" data-id="${p.id}" data-alias="${p.alias}" title="Показати QR для учня" style="padding: 8px 10px; min-height: 40px; min-width: 40px; background: rgba(255,255,255,0.06); font-size: 16px;">
              📱
            </button>
            <button class="btn-open-student primary" data-id="${p.id}" data-alias="${p.alias}" style="padding: 8px 12px; min-height: 40px; font-size: 13px; font-weight: bold; white-space: nowrap;">
              Відкрити →
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Клік на учня
    listContainer.querySelectorAll('.btn-open-student').forEach(el => {
      el.addEventListener('click', () => {
        navigate('student-panel', { student: { uuid: el.dataset.id, alias: el.dataset.alias } });
      });
    });

    // Клік на кнопку QR
    listContainer.querySelectorAll('.btn-show-qr').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openQrModal(btn.dataset.id, btn.dataset.alias);
      });
    });
  }

  const searchInput = document.getElementById('search');
  searchInput.addEventListener('input', (e) => renderListFiltered(e.target.value));

  function openQrModal(uuid, alias) {
    const url = generateQRUrl({ type: 'P', uuid, alias });
    document.getElementById('modal-alias').textContent = alias;
    document.getElementById('modal-url').textContent = url;
    
    const qrContainer = document.getElementById('modal-qr-container');
    qrContainer.innerHTML = '';
    if (window.qrcode) {
      const qr = window.qrcode(0, 'M');
      qr.addData(url);
      qr.make();
      qrContainer.innerHTML = qr.createImgTag(5, 0);
    }

    const btnCopy = document.getElementById('btn-copy-link');
    btnCopy.onclick = () => {
      navigator.clipboard.writeText(url).then(() => {
        showToast('Посилання скопійовано!');
      }).catch(() => {
        prompt('Скопіюйте посилання:', url);
      });
    };

    modal.style.display = 'flex';
  }
}
