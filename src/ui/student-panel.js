import { appState, navigate, showToast } from './app.js';
import { listenProfile, updateStudentAlias } from '../data/repo.js';
import { credit, redeem, undo, awardManual } from '../data/tx.js';
import { creditGrades, levelOf } from '../engine/economy.js';
import { getInitials } from '../data/names-db.js';
import { generateQRUrl } from '../engine/qr-protocol.js';
import { doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db } from '../data/firebase.js';
import { iconPrimogem, iconRankCrest, iconFiligreeDivider } from '../components/genshin-icons.js';

let unsubscribeProfile = null;
let profile = null;
let selectedGrades = [];
let inactivityTimer = null;

export function renderStudentPanel(root) {
  let { uuid, alias } = appState.currentStudent;
  const initials = getInitials(alias);
  const aliasDisplay = initials ? `${alias} (${initials})` : alias;
  
  root.innerHTML = `
    <div class="container">
      <div class="top-bar flex justify-between items-center" style="gap: 8px;">
        <button id="btn-back-list" class="btn-genshin-gold" style="padding: 6px 14px; font-size: 13px; min-height: 36px; border-radius: 12px;">
          ← До списку
        </button>
        <div class="flex items-center gap-xs">
          <h2 id="panel-title-alias" class="fantasy-title" style="margin:0; font-size: 18px;">${aliasDisplay}</h2>
          <button id="btn-edit-student-alias" style="background:transparent; border:none; cursor:pointer; font-size:15px; padding:2px; min-height:auto; min-width:auto; color:var(--gold-light);" title="Змінити псевдонім">✏️</button>
        </div>
        <button id="btn-to-scanner-top" class="btn-genshin-gold" style="padding: 6px 14px; font-size: 13px; min-height: 36px; border-radius: 12px;">
          📷 Сканер
        </button>
      </div>

      <!-- Картка учня з балансом та QR-кнопкою (у стилі Genshin) -->
      <div class="surface-card flex justify-between items-center" style="margin-bottom: var(--spacing-md); padding: 14px 18px; border: 1.5px solid var(--gold-border);">
        <div>
          <div style="font-size: 12px; color: var(--gold-light); text-transform: uppercase; letter-spacing: 0.05em;" id="panel-level">Рівень: ...</div>
          <div style="font-size: 34px; font-weight: 800; font-family: var(--font-fantasy); color: var(--star); line-height: 1.1; text-shadow: 0 0 12px var(--gold-glow);" id="panel-balance">-- ✦</div>
        </div>
        <button id="btn-open-qr" class="surface-card" style="padding: 8px 14px; font-size: 13px; border: 1px solid var(--gold-border); border-radius: 14px; min-height: 42px; color: var(--gold-light); cursor: pointer;">
          📱 QR для учня
        </button>
      </div>

      <!-- Банер активного замовлення учня за QR-кодом -->
      <div id="order-banner-container"></div>

      <!-- Оцінки з щоденника (Клавіатура у стилі талантів Genshin) -->
      <div class="surface-card" style="margin-bottom: var(--spacing-md);">
        <p class="fantasy-title" style="margin-top:0; margin-bottom: 10px; font-size: 15px; color: var(--gold-light);">Оцінки з щоденника:</p>
        <div id="grades-grid" class="grades-grid"></div>
        
        <div id="calc-preview" style="min-height: 24px; margin-bottom: var(--spacing-md); color: var(--cyan-accent); font-weight: bold; font-size: 14px; text-shadow: 0 0 8px var(--cyan-glow);"></div>
        
        <button id="btn-credit" class="btn-genshin-gold" style="width: 100%; padding: 13px; font-size: 16px; border-radius: 14px;" disabled>
          Зарахувати оцінки
        </button>
      </div>

      <!-- Нагороди та квести -->
      <div class="surface-card">
        <p class="fantasy-title" style="margin-top:0; margin-bottom: 8px; font-size: 15px; color: var(--gold-light);">Обмін на нагороди:</p>
        <div id="shop-list" class="shop-grid"></div>
        
        <p class="fantasy-title" style="margin-top: var(--spacing-md); margin-bottom: 8px; font-size: 15px; color: var(--gold-light);">Ручні квести («Внесок у клас»):</p>
        <div id="quests-list" class="shop-grid"></div>
      </div>

      <div class="flex gap-sm" style="margin-top: var(--spacing-md);">
        <button id="btn-next-student" class="btn-genshin-gold" style="flex:1; padding: 13px; font-size: 14px; border-radius: 14px;">
          📷 Наступний учень
        </button>
        <button id="btn-back-bottom" class="surface-card" style="flex:1; padding: 13px; font-size: 14px; border-radius: 14px; border: 1px solid var(--gold-border); text-align: center; justify-content: center; color: var(--gold-light); cursor: pointer;">
          👥 До списку учнів
        </button>
      </div>

      <div style="margin-top: var(--spacing-lg); text-align: center; padding-bottom: 16px;">
        <button id="btn-delete-student" class="btn-genshin-crimson" style="font-size: 13px; padding: 8px 18px; min-height: 38px; border-radius: 14px;">
          🗑️ Видалити учня з класу
        </button>
      </div>
    </div>

    <!-- Модальне вікно для QR-коду учня -->
    <div id="student-qr-modal" class="genshin-modal-overlay" style="display:none;">
      <div class="genshin-modal-content text-center">
        <h3 id="panel-modal-alias" class="fantasy-title" style="margin-top:0; margin-bottom:4px; color:var(--text-parchment);">${aliasDisplay}</h3>
        <p style="font-size:12px; color:var(--text-parchment-muted); margin-bottom:12px;">Учень може відсканувати цей QR прямо зараз:</p>
        <div id="panel-qr-container" style="background:#fff; padding:12px; border-radius:14px; border:2px solid var(--gold-border); display:inline-block; margin-bottom:12px;"></div>
        <div id="panel-url-text" style="font-size:11px; word-break:break-all; margin-bottom:16px; color:var(--text-parchment-subtle);"></div>
        <div class="flex gap-sm">
          <button id="btn-copy-url" class="parchment-card" style="flex:1; padding:8px; font-size:13px; justify-content:center; cursor:pointer;">📋 Скопіювати</button>
          <button id="btn-close-qr" class="btn-genshin-gold" style="flex:1; padding:8px; font-size:13px; justify-content:center; border-radius:12px;">Закрити</button>
        </div>
      </div>
    </div>
  `;

  resetInactivityTimer();
  document.body.addEventListener('click', resetInactivityTimer);

  // Навігаційні слухачі
  const goBackToList = () => {
    cleanup();
    appState.currentStudent = null;
    navigate('student-list');
  };

  const goToScanner = () => {
    cleanup();
    appState.currentStudent = null;
    navigate('scanner');
  };

  document.getElementById('btn-back-list').addEventListener('click', goBackToList);
  document.getElementById('btn-back-bottom').addEventListener('click', goBackToList);
  document.getElementById('btn-to-scanner-top').addEventListener('click', goToScanner);
  document.getElementById('btn-next-student').addEventListener('click', goToScanner);

  const btnEditAlias = document.getElementById('btn-edit-student-alias');
  if (btnEditAlias) {
    btnEditAlias.addEventListener('click', async () => {
      const newAlias = prompt('Введіть новий псевдонім учня (до 24 символів):', alias);
      if (!newAlias) return;
      const trimmed = newAlias.trim();
      if (!trimmed || trimmed === alias) return;
      if (trimmed.length > 24) {
        alert('Псевдонім занадто довгий (максимум 24 символи)');
        return;
      }
      btnEditAlias.disabled = true;
      try {
        await updateStudentAlias(uuid, trimmed);
        alias = trimmed;
        appState.currentStudent.alias = trimmed;
        const inits = getInitials(trimmed);
        document.getElementById('panel-title-alias').textContent = inits ? `${trimmed} (${inits})` : trimmed;
        showToast(`Псевдонім оновлено на "${trimmed}"`);
      } catch (err) {
        console.error(err);
        alert('Помилка оновлення: ' + err.message);
      } finally {
        btnEditAlias.disabled = false;
      }
    });
  }

  // Модальне вікно QR
  const qrModal = document.getElementById('student-qr-modal');
  document.getElementById('btn-open-qr').addEventListener('click', () => {
    const url = generateQRUrl({ type: 'P', uuid, alias });
    const qrContainer = document.getElementById('panel-qr-container');
    document.getElementById('panel-url-text').textContent = url;
    qrContainer.innerHTML = '';
    if (window.qrcode) {
      const qr = window.qrcode(0, 'M');
      qr.addData(url);
      qr.make();
      qrContainer.innerHTML = qr.createImgTag(5, 0);
    }
    qrModal.style.display = 'flex';
  });

  document.getElementById('btn-close-qr').addEventListener('click', () => {
    qrModal.style.display = 'none';
  });
  qrModal.addEventListener('click', (e) => {
    if (e.target === qrModal) qrModal.style.display = 'none';
  });

  document.getElementById('btn-copy-url').addEventListener('click', () => {
    const url = generateQRUrl({ type: 'P', uuid, alias });
    navigator.clipboard.writeText(url).then(() => {
      showToast('Посилання скопійовано!');
    }).catch(() => {
      prompt('Скопіюйте посилання:', url);
    });
  });

  // Підписка на профіль
  unsubscribeProfile = listenProfile(uuid, p => {
    profile = p;
    updatePanel();
  }, err => {
    console.error(err);
    goToScanner();
  });

  renderGradesGrid();
  renderShop();
  renderQuests();

  document.getElementById('btn-credit').addEventListener('click', handleCredit);

  const btnDelete = document.getElementById('btn-delete-student');
  if (btnDelete) {
    btnDelete.addEventListener('click', async () => {
      if (!confirm(`Ви дійсно бажаєте видалити учня "${alias}"? Всі його дані та зірки буде незворотно видалено.`)) {
        return;
      }
      btnDelete.disabled = true;
      btnDelete.textContent = 'Видалення...';
      try {
        await deleteDoc(doc(db, "profiles", uuid));
        cleanup();
        appState.currentStudent = null;
        showToast(`Учня "${alias}" успішно видалено`);
        navigate('student-list');
      } catch (err) {
        console.error(err);
        alert('Помилка видалення: ' + err.message);
        btnDelete.disabled = false;
        btnDelete.textContent = '🗑️ Видалити учня з класу';
      }
    });
  }
}

function cleanup() {
  if (unsubscribeProfile) {
    unsubscribeProfile();
    unsubscribeProfile = null;
  }
  if (inactivityTimer) {
    clearTimeout(inactivityTimer);
    inactivityTimer = null;
  }
  document.body.removeEventListener('click', resetInactivityTimer);
}

function resetInactivityTimer() {
  if (inactivityTimer) clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(() => {
    cleanup();
    appState.currentStudent = null;
    navigate('scanner');
  }, 90000); // 90 секунд таймаут
}

function renderGradesGrid() {
  const grid = document.getElementById('grades-grid');
  const gradesConf = appState.config.grades || { "12": 6, "11": 5, "10": 4, "9": 3, "8": 2, "7": 1 };
  grid.innerHTML = '';
  Object.keys(gradesConf).sort((a,b) => Number(b) - Number(a)).forEach(g => {
    const btn = document.createElement('button');
    btn.className = 'grade-btn';
    btn.textContent = g;
    btn.addEventListener('click', () => {
      const idx = selectedGrades.indexOf(Number(g));
      if (idx > -1) {
        selectedGrades.splice(idx, 1);
        btn.classList.remove('selected');
      } else {
        selectedGrades.push(Number(g));
        btn.classList.add('selected');
      }
      updatePreview();
    });
    grid.appendChild(btn);
  });
}

function updatePreview() {
  const preview = document.getElementById('calc-preview');
  const btnCredit = document.getElementById('btn-credit');
  if (selectedGrades.length === 0 || !profile) {
    preview.textContent = '';
    btnCredit.disabled = true;
    return;
  }
  
  try {
    const res = creditGrades(profile, selectedGrades, appState.config, Date.now());
    let questBonus = '';
    if (res.events && res.events.length > 0) {
      questBonus = ' + бонус квестів: ' + res.events.map(e => `+${e.delta} ✦`).join(', ');
    }
    preview.textContent = `Вибрано оцінки: [ ${selectedGrades.join(', ')} ] → Разом: +${res.delta} ✦${questBonus}`;
    btnCredit.disabled = false;
  } catch (err) {
    preview.textContent = err.message.startsWith('grade-not-allowed') ? 'Неприпустима оцінка' : 'Помилка розрахунку';
    btnCredit.disabled = true;
  }
}

async function handleCredit() {
  if (selectedGrades.length === 0 || !profile) return;
  const grades = [...selectedGrades];
  
  const opId = crypto.randomUUID();
  try {
    const res = await credit(profile.id, opId, appState.config, grades);
    if (res.ok) {
      showToast(`Зараховано +${res.delta} ✦`, {
        text: 'Скасувати',
        handler: async () => {
          await undo(profile.id, crypto.randomUUID(), appState.config, { id: opId, type: 'credit', delta: res.delta });
          showToast('Скасовано');
        }
      });
      // Очистити вибір
      selectedGrades = [];
      document.querySelectorAll('.grade-btn').forEach(b => b.classList.remove('selected'));
      updatePreview();
    }
  } catch (err) {
    console.error(err);
    alert("Помилка збереження: " + err.message);
  }
}

function renderShop() {
  const shopList = document.getElementById('shop-list');
  if (!shopList || !profile) return;
  
  const shop = (appState.config.shop || []).filter(item => item.active !== false);
  shopList.innerHTML = '';
  
  shop.forEach(item => {
    const hasStock = typeof item.stock === 'number';
    const isSoldOut = hasStock && item.stock <= 0;
    const canAfford = profile.balance >= item.price && !isSoldOut;
    const btn = document.createElement('button');
    btn.className = `parchment-card ${canAfford ? '' : 'disabled'}`;
    btn.style.width = '100%';
    btn.style.textAlign = 'left';
    btn.style.cursor = canAfford ? 'pointer' : 'not-allowed';
    btn.style.opacity = canAfford ? '1' : '0.6';
    btn.style.display = 'flex';
    btn.style.justifyContent = 'space-between';
    btn.style.alignItems = 'center';
    btn.style.padding = '10px 14px';

    let statusText = '';
    if (isSoldOut) {
      statusText = 'Розпродано';
    } else if (canAfford) {
      statusText = '✓' + (hasStock ? ` (${item.stock} шт.)` : '');
    } else {
      statusText = `(бракує ${item.price - profile.balance} ✦)`;
    }

    btn.innerHTML = `
      <span style="font-size: 15px; font-weight: 700; color: var(--text-parchment);">
        ${item.icon} ${item.name} ${hasStock ? `<small style="font-size:11px; opacity:0.8; font-weight:normal;">[залишок: ${item.stock}]</small>` : ''}
      </span>
      <span style="font-weight: 800; font-family: var(--font-fantasy); color: ${isSoldOut ? '#b71c1c' : (canAfford ? 'var(--gold-deep)' : 'var(--text-parchment-muted)')}; font-size: 14px;">
        ${item.price} ✦ ${statusText}
      </span>
    `;
    
    if (canAfford) {
      btn.addEventListener('click', () => handleRedeem(item));
    }
    shopList.appendChild(btn);
  });
}

function renderQuests() {
  const questsList = document.getElementById('quests-list');
  if (!questsList || !profile) return;
  
  const quests = (appState.config.quests || []).filter(q => q.active !== false && q.type === 'manual');
  questsList.innerHTML = '';
  
  quests.forEach(q => {
    const btn = document.createElement('button');
    btn.className = 'parchment-card';
    btn.style.width = '100%';
    btn.style.textAlign = 'left';
    btn.style.cursor = 'pointer';
    btn.style.display = 'flex';
    btn.style.justifyContent = 'space-between';
    btn.style.alignItems = 'center';
    btn.style.padding = '10px 14px';
    btn.innerHTML = `
      <span style="font-size: 15px; font-weight: 700; color: var(--text-parchment);">${q.icon} ${q.title || q.name}</span>
      <span class="badge-gold">+${q.reward} ✦</span>
    `;
    btn.addEventListener('click', () => handleManualQuest(q));
    questsList.appendChild(btn);
  });
}

async function handleRedeem(itemObj, qty = 1) {
  const hasStock = typeof itemObj.stock === 'number';
  if (hasStock && (itemObj.stock <= 0 || itemObj.stock < qty)) {
    alert("Розпродано");
    return;
  }
  const totalCost = itemObj.price * qty;
  if (!confirm(`Списати ${totalCost} ✦ за "${itemObj.name}"${qty > 1 ? ` (${qty} шт.)` : ''}?`)) return;
  const opId = crypto.randomUUID();
  try {
    const res = await redeem(profile.id, opId, appState.config, itemObj, qty);
    if (res.ok) {
      showToast(`Видано ${itemObj.icon} −${totalCost} ✦ (Залишок: ${profile.balance - totalCost} ✦)`, {
        text: 'Скасувати',
        handler: async () => {
          await undo(profile.id, crypto.randomUUID(), appState.config, { id: opId, type: 'redeem', delta: -totalCost });
          showToast('Скасовано');
        }
      });
      if (appState.currentOrder && appState.currentOrder.item === itemObj.id) {
        appState.currentOrder = null;
        renderOrderBanner();
      }
    }
  } catch (err) {
    console.error(err);
    alert(err.message === 'insufficient-funds' ? 'Недостатньо ✦' : err.message);
  }
}

async function handleManualQuest(quest) {
  if (!confirm(`Зарахувати нагороду +${quest.reward} ✦ за "${quest.title || quest.name}"?`)) return;
  const opId = crypto.randomUUID();
  try {
    const res = await awardManual(profile.id, opId, appState.config, quest.id);
    if (res.ok) {
      showToast(`Нагорода ${quest.icon} зарахована +${res.delta} ✦`, {
        text: 'Скасувати',
        handler: async () => {
          await undo(profile.id, crypto.randomUUID(), appState.config, { id: opId, type: 'quest', delta: res.delta });
          showToast('Скасовано');
        }
      });
    }
  } catch (err) {
    console.error(err);
    alert(err.message === 'quest-limit-reached' ? 'Місячний ліміт виконань вичерпано' : err.message);
  }
}

function renderOrderBanner() {
  const container = document.getElementById('order-banner-container');
  if (!container) return;
  if (!appState.currentOrder || !profile || !appState.config) {
    container.innerHTML = '';
    return;
  }

  const { item: itemId, qty = 1 } = appState.currentOrder;
  const orderItem = (appState.config.shop || []).find(i => i.id === itemId);
  if (!orderItem) {
    container.innerHTML = '';
    return;
  }

  const totalCost = orderItem.price * qty;
  const hasStock = typeof orderItem.stock === 'number';
  const isSoldOut = hasStock && (orderItem.stock <= 0 || orderItem.stock < qty);
  const canAfford = profile.balance >= totalCost && !isSoldOut;

  container.innerHTML = `
    <div class="surface-card flex justify-between items-center" style="margin-bottom: var(--spacing-md); border: 2px solid var(--gold-primary); background: rgba(14, 38, 56, 0.95); padding: 14px;">
      <div>
        <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--gold-light); font-weight: bold;">
          🎁 Замовлення за QR-кодом
        </div>
        <div style="font-size: 17px; font-weight: bold; margin-top: 2px;">
          ${orderItem.icon || '🎁'} ${orderItem.name} ${qty > 1 ? `(${qty} шт.)` : ''}
          ${hasStock ? `<span style="font-size: 12px; margin-left: 6px; font-weight: normal; color: ${isSoldOut ? '#ffa3a3' : 'var(--gold-light)'};">[залишок: ${orderItem.stock} шт.]</span>` : ''}
        </div>
        <div style="font-size: 13px; color: var(--muted); margin-top: 2px;">
          Вартість: <strong style="color: var(--star);">${totalCost} ✦</strong> 
          ${isSoldOut ? `<span style="color: #ffa3a3; font-weight: bold;">(Розпродано!)</span>` : canAfford ? `<span style="color: var(--cyan-accent);">(вистачає)</span>` : `<span style="color: #ffa3a3;">(бракує ${totalCost - profile.balance} ✦)</span>`}
        </div>
      </div>
      <div class="flex gap-xs items-center">
        <button id="btn-fulfill-order" class="btn-genshin-gold" style="padding: 8px 14px; font-size: 13px; font-weight: bold; min-height: 38px; border-radius: 12px;" ${canAfford ? '' : 'disabled'}>
          ${isSoldOut ? 'Розпродано' : 'Видати ✓'}
        </button>
        <button id="btn-dismiss-order" style="padding: 6px 10px; min-height: 38px; background: transparent; border: 1px solid rgba(255,255,255,0.2); font-size: 14px; border-radius: 10px; color: var(--muted);" title="Закрити замовлення">
          ✕
        </button>
      </div>
    </div>
  `;

  const btnFulfill = document.getElementById('btn-fulfill-order');
  if (btnFulfill) {
    btnFulfill.addEventListener('click', async () => {
      await handleRedeem(orderItem, qty);
    });
  }

  const btnDismiss = document.getElementById('btn-dismiss-order');
  if (btnDismiss) {
    btnDismiss.addEventListener('click', () => {
      appState.currentOrder = null;
      renderOrderBanner();
    });
  }
}

function updatePanel() {
  const balEl = document.getElementById('panel-balance');
  if (balEl) balEl.textContent = `${profile.balance} ✦`;
  
  const lvlEl = document.getElementById('panel-level');
  if (lvlEl && appState.config) {
    const lvl = levelOf(profile.earned, appState.config);
    lvlEl.textContent = `Рівень: ${lvl.name} (зароблено ${profile.earned} ✦)`;
  }

  renderOrderBanner();
  updatePreview();
  renderShop();
  renderQuests();
}
