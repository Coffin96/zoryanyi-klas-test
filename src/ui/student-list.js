import { navigate, appState, showToast } from './app.js';
import { getActiveProfiles } from '../data/repo.js';
import { getInitials } from '../data/names-db.js';
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db } from '../data/firebase.js';
import { generateQRUrl } from '../engine/qr-protocol.js';
import { iconPrimogem, iconFiligreeDivider } from '../components/genshin-icons.js';

export async function renderStudentList(root) {
  root.innerHTML = `
    <div class="container">
      <div class="top-bar flex justify-between items-center">
        <h2 class="fantasy-title" style="margin:0; font-size: 20px;">Учні класу</h2>
        <div class="flex gap-sm">
          <button id="btn-quick-scan" class="btn-genshin-gold" style="padding: 6px 14px; font-size: 13px; min-height: 36px; border-radius: 12px;">
            📷 Сканер
          </button>
        </div>
      </div>

      <!-- Швидке створення учня -->
      <div class="surface-card" style="margin-bottom: var(--spacing-md); padding: 14px 16px; border: 1.5px solid var(--gold-border);">
        <div class="fantasy-title" style="font-weight: 600; font-size: 14px; margin-bottom: 8px; color: var(--gold-light);">➕ Додати учня до класу:</div>
        <form id="form-quick-add" class="flex gap-sm">
          <input type="text" id="quick-alias-input" placeholder="Псевдонім (напр. Сокіл-01)" maxlength="24" required style="flex:1; min-height: 44px; padding: 8px 12px; font-size: 14px;">
          <button type="submit" id="btn-quick-submit" class="btn-genshin-gold" style="min-height: 44px; padding: 8px 16px; white-space: nowrap; border-radius: 12px;">Створити</button>
        </form>
      </div>

      <!-- Додаткові дії -->
      <div class="flex gap-sm" style="margin-bottom: var(--spacing-md);">
        <button id="btn-batch-add" class="surface-card" style="flex:1; padding: 10px; font-size: 13px; border: 1px solid var(--gold-border); justify-content: center; color: var(--gold-light); cursor: pointer; border-radius: 12px;">📝 Списком</button>
        <button id="btn-print-cards-nav" class="btn-genshin-gold" style="flex:1; padding: 10px; font-size: 13px; border-radius: 12px;">🖨️ Друк карток</button>
      </div>

      <div class="surface-card">
        <input type="text" id="search" placeholder="Пошук за псевдонімом чи ініціалами..." style="margin-bottom: var(--spacing-md); width:100%; min-height: 44px;">
        <div id="list-container" class="flex flex-col gap-sm">
          <p class="text-muted text-center" style="padding: 16px;">Завантаження реєстру...</p>
        </div>
      </div>
    </div>

    <!-- Модальне вікно для відображення QR учня прямо на екрані -->
    <div id="qr-modal" class="genshin-modal-overlay" style="display:none;">
      <div class="genshin-modal-content text-center">
        <h3 id="modal-alias" class="fantasy-title" style="margin-top:0; margin-bottom:6px; color:var(--text-parchment);"></h3>
        <p style="font-size:12px; color:var(--text-parchment-muted); margin-bottom:12px;">Учень може відсканувати цей QR камерою телефона:</p>
        <div id="modal-qr-container" style="background:#fff; padding:12px; border-radius:14px; border:2px solid var(--gold-border); display:inline-block; margin-bottom:12px;"></div>
        <div id="modal-url" style="font-size:11px; word-break:break-all; margin-bottom:16px; color:var(--text-parchment-subtle);"></div>
        <div class="flex gap-sm">
          <button id="btn-copy-link" class="parchment-card" style="flex:1; padding:8px; font-size:13px; justify-content:center; cursor:pointer;">📋 Скопіювати</button>
          <button id="btn-close-modal" class="btn-genshin-gold" style="flex:1; padding:8px; font-size:13px; justify-content:center; border-radius:12px;">Закрити</button>
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
      showToast(`Учня "${alias}" успішно створено!`);
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
      const display = initials ? `${p.alias} <span style="color:var(--text-parchment-muted); font-size:13px;">(${initials})</span>` : p.alias;
      return `
        <div class="parchment-card flex justify-between items-center" style="padding: 10px 14px; gap: 8px; flex-wrap: wrap;">
          <div class="btn-open-student flex flex-col" data-id="${p.id}" data-alias="${p.alias}" style="cursor: pointer; flex: 1; min-width: 150px;">
            <div style="font-size: 15px; font-weight: 700; color: var(--text-parchment);">${display}</div>
            <div style="font-size: 12px; margin-top: 2px; color: var(--text-parchment-muted);">
              Баланс: <strong style="color:var(--gold-deep); font-family:var(--font-fantasy);">${p.balance} ✦</strong> (зароблено ${p.earned} ✦)
            </div>
          </div>
          <div class="flex items-center gap-xs" style="flex-wrap: nowrap;">
            <button class="btn-show-qr" data-id="${p.id}" data-alias="${p.alias}" title="Показати QR для учня" style="padding: 6px 10px; min-height: 38px; min-width: 38px; background: var(--surface-parchment-inner); border: 1px solid var(--gold-border); border-radius: 10px; font-size: 15px; cursor: pointer;">
              📱
            </button>
            <button class="btn-open-student btn-genshin-gold" data-id="${p.id}" data-alias="${p.alias}" style="padding: 6px 12px; min-height: 38px; font-size: 12px; font-weight: bold; white-space: nowrap; border-radius: 10px;">
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
