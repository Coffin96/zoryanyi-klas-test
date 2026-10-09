import { navigate, appState, showToast } from './app.js';
import { getActiveProfiles } from '../data/repo.js';
import { db } from '../data/firebase.js';
import { doc, writeBatch, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { generateQRUrl } from '../engine/qr-protocol.js';
import { renderBudgetSection } from './budget.js';
import { renderOpsSection } from './ops.js';
import { iconPrimogem, iconFiligreeDivider } from '../components/genshin-icons.js';
import { defaultConfig } from '../data/default-config.js';

export async function renderAdmin(root) {
  let profiles = [];
  try {
    profiles = await getActiveProfiles();
  } catch (e) {
    console.error("Failed to load active profiles for admin", e);
  }

  // Копія списку товарів для редагування
  let shopItems = structuredClone(appState.config?.shop || []);
  const currentEvent = appState.config?.event || { name: '', reward: 10, active: false };

  root.innerHTML = `
    <div class="container" style="padding-bottom: 90px;">
      <div class="top-bar flex justify-between items-center" style="flex-wrap: wrap; gap: 8px;">
        <h2 class="fantasy-title" style="margin:0; font-size: 20px;">Адміністрування</h2>
      </div>

      <!-- 1. Керування магазином нагород -->
      <div class="surface-card flex flex-col gap-md" style="margin-bottom: var(--spacing-md); border: 1.5px solid var(--gold-border);">
        <div class="flex justify-between items-center" style="flex-wrap: wrap; gap: 8px;">
          <h3 class="fantasy-title" style="margin:0; font-size: 17px; color: var(--gold-light);">🎁 Магазин нагород</h3>
          <button id="btn-save-shop" class="btn-genshin-gold" style="padding: 8px 16px; font-size: 13px; font-weight: bold; min-height: 38px; border-radius: 12px;">💾 Зберегти зміни</button>
        </div>
        <p class="text-muted" style="margin:0; font-size: 13px;">
          Тут можна змінювати ціни, залишки на складі, приховувати тимчасово недоступні нагороди або додавати нові.
        </p>

        <!-- Список наявних нагород -->
        <div id="admin-shop-list" class="flex flex-col gap-sm"></div>

        <!-- Додавання нової нагороди -->
        <div style="background: rgba(10, 15, 34, 0.6); padding: var(--spacing-md); border-radius: var(--radius-md); border: 1px dashed var(--gold-border);">
          <div class="fantasy-title" style="font-weight: 600; font-size: 14px; margin-bottom: 8px; color: var(--gold-light);">➕ Додати нову нагороду:</div>
          <form id="form-add-reward" class="flex flex-col gap-sm">
            <div class="flex gap-sm items-center">
              <input type="text" id="reward-icon" placeholder="Іконка" maxlength="4" style="width: 56px; text-align: center; font-size: 22px; min-height: 44px; padding: 4px;" required value="🎁">
              <input type="text" id="reward-name" placeholder="Назва нагороди (напр. Шоколадка)" required style="flex:1; min-height: 44px; padding: 8px 12px; font-size: 14px;">
            </div>
            <div class="flex gap-sm items-center" style="flex-wrap: wrap;">
              <div class="flex items-center gap-xs" style="min-width: 100px; flex: 1;">
                <input type="number" id="reward-price" placeholder="Ціна" min="1" max="999" required style="width: 65px; min-height: 44px; text-align: center; font-weight: bold; font-size: 16px;" value="10">
                <span style="font-weight: bold; color: var(--star); font-size: 16px;">✦</span>
              </div>
              <input type="text" id="new-item-category" placeholder="Тип (опціонально)" style="flex: 1; min-width: 110px; padding: 12px; border-radius: var(--radius-md); background: rgba(21, 29, 56, 0.9); color: var(--text); border: 1px solid var(--gold-border); min-height: 44px; font-size: 14px;">
              <button type="submit" class="btn-genshin-gold" style="flex: 1; min-width: 90px; min-height: 44px; padding: 8px 16px; white-space: nowrap; font-weight: bold; border-radius: 12px;">Додати</button>
            </div>
            <div class="flex gap-md items-center" style="flex-wrap: wrap; margin-top: 4px;">
              <label class="flex items-center gap-xs" style="cursor: pointer; font-size: 13px; color: var(--gold-light); user-select: none;">
                <input type="checkbox" id="reward-has-stock" style="cursor: pointer; width: 16px; height: 16px;">
                <span>Обмежена кількість</span>
              </label>
              <div id="reward-stock-wrap" style="display: none; align-items: center; gap: 6px;">
                <input type="number" id="reward-stock" placeholder="Залишок" min="0" max="9999" value="10" style="width: 75px; min-height: 36px; text-align: center; font-weight: bold; font-size: 14px; padding: 4px; border-radius: var(--radius-sm); background: #fff; color: #222; border: 1.5px solid var(--gold-deep);">
                <span style="font-size: 12px; color: var(--muted);">шт.</span>
              </div>
            </div>
          </form>
        </div>
      </div>

      <!-- 2. Спеціальна Подія (Одноразовий квест) -->
      <div class="surface-card flex flex-col gap-md" style="margin-bottom: var(--spacing-md); border: 1.5px solid var(--gold-border);">
        <div class="flex justify-between items-center" style="flex-wrap: wrap; gap: 8px;">
          <h3 class="fantasy-title" style="margin:0; font-size: 17px; color: var(--gold-light);">🏆 Спеціальна Подія (Одноразовий квест)</h3>
          <button id="btn-save-event" class="btn-genshin-gold" style="padding: 8px 16px; font-size: 13px; font-weight: bold; min-height: 38px; border-radius: 12px;">💾 Зберегти подію</button>
        </div>
        <p class="text-muted" style="margin:0; font-size: 13px;">
          Швидкий загальнокласний квест або конкурс (наприклад: святковий малюнок, олімпіада, суботник).
        </p>

        <form id="form-event" class="flex flex-col gap-sm" onsubmit="return false;">
          <div class="flex gap-sm items-center" style="flex-wrap: wrap;">
            <div style="flex: 2; min-width: 180px;">
              <label for="event-name" style="font-size: 12px; color: var(--gold-light); display: block; margin-bottom: 4px;">Назва події:</label>
              <input type="text" id="event-name" placeholder="Назва події (напр. Конкурс малюнків)" style="width: 100%; min-height: 42px; padding: 8px 12px; font-size: 14px; border-radius: var(--radius-sm); border: 1px solid var(--gold-border); background: rgba(10, 15, 34, 0.7); color: var(--text);" value="${currentEvent.name || ''}">
            </div>
            <div style="flex: 1; min-width: 110px;">
              <label for="event-reward" style="font-size: 12px; color: var(--gold-light); display: block; margin-bottom: 4px;">Нагорода (✦):</label>
              <div class="flex items-center gap-xs">
                <input type="number" id="event-reward" placeholder="10" min="1" max="999" style="width: 100%; min-height: 42px; text-align: center; font-weight: bold; font-size: 16px; border-radius: var(--radius-sm); border: 1px solid var(--gold-border); background: rgba(10, 15, 34, 0.7); color: var(--text);" value="${currentEvent.reward ?? 10}">
                <span style="font-weight: bold; color: var(--star); font-size: 16px;">✦</span>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-md" style="margin-top: 4px;">
            <label class="flex items-center gap-xs" style="cursor: pointer; font-size: 14px; color: var(--gold-light); user-select: none;">
              <input type="checkbox" id="event-active" ${currentEvent.active ? 'checked' : ''} style="cursor: pointer; width: 18px; height: 18px;">
              <span style="font-weight: 600;">Подія активна (відображати для класу)</span>
            </label>
          </div>
        </form>
      </div>

      <!-- 2. Бюджет та прогноз потреби (M7) -->
      <div id="budget-container"></div>

      <!-- 3. Пакетне створення учнів -->
      <div class="surface-card flex flex-col gap-md" style="margin-bottom: var(--spacing-md); border: 1.5px solid var(--gold-border);">
        <h3 class="fantasy-title" style="margin:0; font-size: 17px; color: var(--gold-light);">👥 Створення учнів списком</h3>
        <p class="text-muted" style="margin:0; font-size: 13px;">Введіть вигадані псевдоніми учнів (по одному на рядок, до 24 символів):<br><em>Лис-01<br>Сокіл-02<br>Рись-03</em></p>
        <textarea id="aliases-input" rows="4" style="width: 100%; padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--gold-border); background: rgba(10, 15, 34, 0.7); color: var(--text); font-family: inherit; font-size: 14px;"></textarea>
        <button id="btn-create-batch" class="btn-genshin-gold" style="padding: 12px; border-radius: 12px;">Створити учнів списком</button>
      </div>

      <!-- 4. Друк карток -->
      <div class="surface-card flex flex-col gap-md" style="margin-bottom: var(--spacing-md); border: 1.5px solid var(--gold-border);">
        <h3 class="fantasy-title" style="margin:0; font-size: 17px; color: var(--gold-light);">🖨️ Друк карток</h3>
        <p class="text-muted" style="margin:0; font-size: 13px;">Згенерувати аркуш формату А4 із QR-кодами, псевдонімами та посиланнями для всіх активних учнів.</p>
        <button id="btn-print-cards" class="btn-genshin-gold" style="padding: 12px; border-radius: 12px;">Згенерувати аркуш для друку</button>
      </div>

      <!-- 5. Експлуатація та резервні копії (M8) -->
      <div id="ops-container"></div>

      <!-- 6. Системні налаштування -->
      <div class="surface-card flex flex-col gap-md" style="margin-bottom: var(--spacing-md); border: 1.5px solid var(--gold-border);">
        <h3 class="fantasy-title" style="margin:0; font-size: 17px; color: var(--gold-light);">🔧 Системні налаштування</h3>
        <p class="text-muted" style="margin:0; font-size: 13px;">
          Оновлення системних квестів, лімітів та титулів до актуальної версії конфігурації (v2.0) у базі Firebase без зміни цін у магазині чи активних подій.
        </p>
        <button id="btn-migrate-v2" class="btn-genshin-gold" style="padding: 12px; border-radius: 12px; font-weight: bold; background: linear-gradient(135deg, #a83232 0%, #d4af37 100%); color: #fff; border: 1.5px solid var(--gold-border); cursor: pointer;">
          ⚠️ Оновити базу квестів та титулів (v2.0)
        </button>
      </div>
    </div>
  `;


  // Рендеринг списку товарів в адмінці
  function renderAdminShop() {
    const listEl = document.getElementById('admin-shop-list');
    if (!listEl) return;

    if (shopItems.length === 0) {
      listEl.innerHTML = '<p class="text-muted text-center">Товарів ще немає</p>';
      return;
    }

    listEl.innerHTML = shopItems.map((item, index) => {
      const isActive = item.active !== false;
      const hasStock = typeof item.stock === 'number';
      return `
        <div class="parchment-card admin-shop-item" style="opacity: ${isActive ? '1' : '0.6'};">
          <!-- Заголовок товару: Іконка, Назва, Категорія, Статус -->
          <div class="shop-item-header">
            <div class="shop-item-info">
              <span class="shop-item-icon">${item.icon || '🎁'}</span>
              <div class="shop-item-text">
                <div class="shop-item-title">${item.name}</div>
                <div class="shop-item-meta">
                  ${item.category ? `<span class="badge-tag">${item.category}</span> · ` : ''}${isActive ? '<span style="color:#217346; font-weight: 700;">Активний</span>' : '<span style="color:#8b2626;">Приховано</span>'}
                  ${hasStock ? ` · <span style="font-weight: 700; color: ${item.stock === 0 ? '#b71c1c' : '#217346'};">Залишок: ${item.stock} шт.</span>` : ''}
                </div>
              </div>
            </div>
          </div>

          <!-- Контроли товару (2 адаптивні логічні рядки) -->
          <div class="shop-item-controls">
            <!-- Рядок 1: Ціна та статус (Увімкнути/Вимкнути) + Видалення -->
            <div class="shop-controls-row">
              <div class="shop-price-group" title="Ціна товару">
                <span class="shop-price-label">Ціна:</span>
                <input type="number" class="item-price-input shop-price-input" data-index="${index}" value="${item.price}" min="1" max="999">
                <span class="shop-price-currency">✦</span>
              </div>

              <div class="shop-actions-group">
                <button class="btn-toggle-active ${isActive ? 'is-active' : 'is-hidden'}" data-index="${index}" style="padding: 6px 12px; min-height: 36px; font-size: 12px; font-weight: 600; border-radius: var(--radius-sm); background: ${isActive ? 'rgba(61, 220, 151, 0.2)' : 'rgba(0,0,0,0.08)'}; color: ${isActive ? '#137a4a' : 'var(--text-parchment-muted)'}; border: 1px solid rgba(0,0,0,0.1);" title="${isActive ? 'Приховати з магазину' : 'Показати в магазині'}">
                  ${isActive ? 'Вимкнути' : 'Увімкнути'}
                </button>

                <button class="btn-delete-item btn-genshin-crimson" data-index="${index}" style="padding: 6px 8px; min-height: 36px; min-width: 36px; font-size: 13px; border-radius: var(--radius-sm);" title="Видалити">
                  🗑️
                </button>
              </div>
            </div>

            <!-- Рядок 2: Налаштування залишку (Чекбокс "Обмежено" і, якщо вибрано, поле кількості) -->
            <div class="shop-controls-row shop-stock-row">
              <div class="shop-stock-control">
                <label class="shop-stock-toggle-label">
                  <input type="checkbox" class="item-stock-toggle" data-index="${index}" ${hasStock ? 'checked' : ''} style="cursor: pointer;">
                  <span>Обмежено</span>
                </label>
                <div class="shop-stock-input-wrap" style="display: ${hasStock ? 'inline-flex' : 'none'}; align-items: center; gap: 4px;">
                  <input type="number" class="item-stock-input shop-stock-input" data-index="${index}" value="${hasStock ? item.stock : 10}" min="0" max="9999" title="Залишок на складі">
                  <span class="shop-stock-unit">шт.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Зміна цін в інпутах
    listEl.querySelectorAll('.item-price-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const idx = Number(e.target.dataset.index);
        const val = Number(e.target.value);
        if (val > 0) {
          shopItems[idx].price = val;
        }
      });
    });

    // Перемикання чекбокса обмеження кількості
    listEl.querySelectorAll('.item-stock-toggle').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const idx = Number(e.target.dataset.index);
        if (e.target.checked) {
          const container = e.target.closest('.shop-stock-control') || e.target.closest('div');
          const stockInput = container ? container.querySelector('.item-stock-input') : null;
          const val = stockInput ? parseInt(stockInput.value, 10) : 10;
          shopItems[idx].stock = isNaN(val) ? 10 : Math.max(0, val);
        } else {
          delete shopItems[idx].stock;
        }
        renderAdminShop();
      });
    });

    // Зміна значення залишку в інпуті
    listEl.querySelectorAll('.item-stock-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const idx = Number(e.target.dataset.index);
        const val = parseInt(e.target.value, 10);
        if (!isNaN(val)) {
          shopItems[idx].stock = Math.max(0, val);
        }
      });
    });

    // Перемикання активності
    listEl.querySelectorAll('.btn-toggle-active').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.index);
        shopItems[idx].active = shopItems[idx].active === false ? true : false;
        renderAdminShop();
      });
    });

    // Видалення товару
    listEl.querySelectorAll('.btn-delete-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.index);
        const item = shopItems[idx];
        if (confirm(`Видалити "${item.name}" з магазину?`)) {
          shopItems.splice(idx, 1);
          renderAdminShop();
        }
      });
    });
  }

  renderAdminShop();

  // Додавання нової нагороди: перемикання видимості інпуту залишку
  const chkNewStock = document.getElementById('reward-has-stock');
  const wrapNewStock = document.getElementById('reward-stock-wrap');
  if (chkNewStock && wrapNewStock) {
    chkNewStock.addEventListener('change', (e) => {
      wrapNewStock.style.display = e.target.checked ? 'inline-flex' : 'none';
    });
  }

  // Додавання нової нагороди
  document.getElementById('form-add-reward').addEventListener('submit', (e) => {
    e.preventDefault();
    const icon = document.getElementById('reward-icon').value.trim() || '🎁';
    const name = document.getElementById('reward-name').value.trim();
    const price = Number(document.getElementById('reward-price').value) || 10;
    const catInput = document.getElementById('new-item-category') || document.getElementById('reward-cat');
    const category = catInput?.value.trim() || '';
    const hasStock = document.getElementById('reward-has-stock')?.checked;
    const stockVal = hasStock ? Math.max(0, parseInt(document.getElementById('reward-stock').value, 10) || 0) : null;

    if (!name) return;

    const id = 'item_' + Date.now().toString(36);
    const newItem = {
      id,
      name,
      icon,
      price,
      category,
      active: true,
      order: shopItems.length + 1
    };
    if (hasStock) {
      newItem.stock = stockVal;
    }
    shopItems.push(newItem);

    document.getElementById('reward-name').value = '';
    if (catInput) {
      catInput.value = '';
    }
    if (chkNewStock) {
      chkNewStock.checked = false;
      wrapNewStock.style.display = 'none';
    }
    renderAdminShop();
    showToast(`Нагороду "${name}" додано до списку! Не забудьте натиснути «Зберегти зміни».`);
  });

  // Збереження списку товарів у Firestore
  document.getElementById('btn-save-shop').addEventListener('click', async () => {
    const btn = document.getElementById('btn-save-shop');
    btn.disabled = true;
    btn.textContent = 'Збереження...';

    try {
      await updateDoc(doc(db, "config", "published"), {
        shop: shopItems
      });
      // Оновити глобальний стан
      if (appState.config) {
        appState.config.shop = shopItems;
      }
      showToast('Магазин успішно оновлено!');
    } catch (err) {
      console.error(err);
      alert('Помилка збереження магазину: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = '💾 Зберегти ціни';
    }
  });

  // Збереження події у Firestore
  const btnSaveEvent = document.getElementById('btn-save-event');
  if (btnSaveEvent) {
    btnSaveEvent.addEventListener('click', async () => {
      btnSaveEvent.disabled = true;
      btnSaveEvent.textContent = 'Збереження...';
      const eventName = (document.getElementById('event-name')?.value || '').trim();
      const eventReward = Number(document.getElementById('event-reward')?.value) || 0;
      const eventActive = document.getElementById('event-active')?.checked || false;

      const eventData = {
        name: eventName,
        reward: eventReward,
        active: eventActive
      };

      try {
        await updateDoc(doc(db, "config", "published"), {
          event: eventData
        });
        if (appState.config) {
          appState.config.event = eventData;
        }
        showToast('Подію успішно збережено!');
      } catch (err) {
        console.error(err);
        alert('Помилка збереження події: ' + err.message);
      } finally {
        btnSaveEvent.disabled = false;
        btnSaveEvent.textContent = '💾 Зберегти подію';
      }
    });
  }

  // Пакетне створення учнів
  document.getElementById('btn-create-batch').addEventListener('click', async () => {
    const text = document.getElementById('aliases-input').value;
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0 && l.length <= 24);
    if (lines.length === 0) {
      alert('Будь ласка, введіть хоча б один псевдонім.');
      return;
    }

    if (!confirm(`Створити ${lines.length} учнів?`)) return;

    const btn = document.getElementById('btn-create-batch');
    btn.disabled = true;
    btn.textContent = 'Створення...';

    try {
      const batch = writeBatch(db);
      
      lines.forEach(alias => {
        const pid = crypto.randomUUID();
        const pRef = doc(db, "profiles", pid);
        batch.set(pRef, {
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
      });

      await batch.commit();
      document.getElementById('aliases-input').value = '';
      alert(`Успішно створено ${lines.length} учнів!`);
      navigate('student-list');
    } catch (err) {
      console.error(err);
      alert('Помилка: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Створити учнів списком';
    }
  });

  // Друк карток
  document.getElementById('btn-print-cards').addEventListener('click', async () => {
    try {
      const activeProfiles = await getActiveProfiles();
      if (activeProfiles.length === 0) {
        alert('Немає активних учнів для друку. Спочатку створіть учнів.');
        return;
      }

      let printContent = `
        <!DOCTYPE html>
        <html><head><title>Картки учнів — Зоряний клас</title>
        <meta charset="utf-8">
        <style>
          body { font-family: system-ui, sans-serif; margin: 0; padding: 15mm; }
          .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8mm; }
          .card { border: 2px dashed #b58d3c; padding: 6mm; text-align: center; border-radius: 8px; page-break-inside: avoid; background: #fdfaf3; }
          .title { font-size: 16px; font-weight: bold; margin: 0 0 4px 0; color: #181d45; }
          .alias { font-size: 22px; font-weight: bold; margin: 6px 0; color: #222; }
          .qr { margin: 6px 0; }
          .qr img { width: 140px; height: 140px; display: inline-block; }
          .url { font-size: 10px; color: #444; word-break: break-all; margin: 4px 0; font-family: monospace; }
          .hint { font-size: 11px; color: #666; margin: 4px 0 0 0; }
          @media print {
            body { padding: 5mm; background: #fff; }
            .card { border-color: #333; }
          }
        </style>
        </head><body><div class="grid">
      `;

      activeProfiles.forEach(p => {
        const url = generateQRUrl({ type: 'P', uuid: p.id, alias: p.alias });
        const qr = window.qrcode(0, 'M');
        qr.addData(url);
        qr.make();
        const qrImg = qr.createImgTag(4, 0);

        printContent += `
          <div class="card">
            <div class="title">✦ Зоряний клас</div>
            <div class="qr">${qrImg}</div>
            <div class="alias">${p.alias}</div>
            <div class="url">${url}</div>
            <p class="hint">Відскануй камерою телефона, щоб відкрити свій баланс</p>
          </div>
        `;
      });

      printContent += `</div></body></html>`;

      const printWindow = window.open('', '_blank');
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      
      setTimeout(() => {
        printWindow.print();
      }, 500);

    } catch (err) {
      console.error(err);
      alert('Помилка генерації карток: ' + err.message);
    }
  });

  // Ініціалізація розділів Бюджету (M7) та Експлуатації (M8)
  const budgetContainer = document.getElementById('budget-container');
  if (budgetContainer && appState.config) {
    renderBudgetSection(budgetContainer, profiles, appState.config, appState.stock);
  }

  const opsContainer = document.getElementById('ops-container');
  if (opsContainer) {
    renderOpsSection(opsContainer, profiles, () => renderAdmin(root));
  }

  // 6. Оновлення бази квестів та титулів (v2.0)
  const btnMigrateV2 = document.getElementById('btn-migrate-v2');
  if (btnMigrateV2) {
    btnMigrateV2.addEventListener('click', async () => {
      const confirmed = confirm('Увага! Це безпечно оновить квести, ліміти та титули в базі Firebase на основі нових файлів проекту. Ваші ціни в магазині та Спеціальні події залишаться недоторканими. Продовжити?');
      if (!confirmed) return;

      btnMigrateV2.disabled = true;
      const originalText = btnMigrateV2.textContent;
      btnMigrateV2.textContent = 'Оновлення...';

      try {
        await updateDoc(doc(db, "config", "published"), {
          quests: defaultConfig.quests,
          levels: defaultConfig.levels,
          questWeeklyCap: defaultConfig.questWeeklyCap,
          questMonthlyCap: defaultConfig.questMonthlyCap
        });

        if (appState.config) {
          appState.config.quests = defaultConfig.quests;
          appState.config.levels = defaultConfig.levels;
          appState.config.questWeeklyCap = defaultConfig.questWeeklyCap;
          appState.config.questMonthlyCap = defaultConfig.questMonthlyCap;
        }

        showToast('Базу успішно оновлено до v2.0!');
      } catch (err) {
        console.error('Помилка міграції бази:', err);
        alert('Помилка оновлення бази: ' + err.message);
      } finally {
        btnMigrateV2.disabled = false;
        btnMigrateV2.textContent = originalText;
      }
    });
  }
}
