import { navigate, appState, showToast } from './app.js';
import { getActiveProfiles } from '../data/repo.js';
import { db } from '../data/firebase.js';
import { doc, writeBatch, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { generateQRUrl } from '../engine/qr-protocol.js';
import { renderBudgetSection } from './budget.js';
import { renderOpsSection } from './ops.js';
import { iconPrimogem, iconFiligreeDivider } from '../components/genshin-icons.js';

export async function renderAdmin(root) {
  let profiles = [];
  try {
    profiles = await getActiveProfiles();
  } catch (e) {
    console.error("Failed to load active profiles for admin", e);
  }

  // Копія списку товарів для редагування
  let shopItems = structuredClone(appState.config?.shop || []);

  root.innerHTML = `
    <div class="container" style="padding-bottom: 90px;">
      <div class="top-bar flex justify-between items-center" style="flex-wrap: wrap; gap: 8px;">
        <button id="btn-back" class="btn-genshin-gold" style="padding: 6px 14px; font-size: 13px; min-height: 36px; border-radius: 12px;">← До списку</button>
        <h2 class="fantasy-title" style="margin:0; font-size: 20px;">Адміністрування</h2>
        <button id="btn-to-scanner" class="btn-genshin-gold" style="padding: 6px 14px; font-size: 13px; min-height: 36px; border-radius: 12px;">📷 Сканер</button>
      </div>

      <!-- 1. Керування магазином нагород -->
      <div class="surface-card flex flex-col gap-md" style="margin-bottom: var(--spacing-md); border: 1.5px solid var(--gold-border);">
        <div class="flex justify-between items-center" style="flex-wrap: wrap; gap: 8px;">
          <h3 class="fantasy-title" style="margin:0; font-size: 17px; color: var(--gold-light);">🎁 Магазин нагород</h3>
          <button id="btn-save-shop" class="btn-genshin-gold" style="padding: 8px 16px; font-size: 13px; font-weight: bold; min-height: 38px; border-radius: 12px;">💾 Зберегти ціни</button>
        </div>
        <p class="text-muted" style="margin:0; font-size: 13px;">
          Тут можна змінювати ціни, приховувати тимчасово недоступні нагороди або додавати нові.
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
              <select id="reward-cat" style="flex: 1; min-width: 110px; padding: 8px 10px; border-radius: var(--radius-md); background: rgba(21, 29, 56, 0.9); color: var(--text); border: 1px solid var(--gold-border); min-height: 44px; font-size: 14px;">
                <option value="sweet">Смаколик</option>
                <option value="privilege">Привілей</option>
              </select>
              <button type="submit" class="btn-genshin-gold" style="flex: 1; min-width: 90px; min-height: 44px; padding: 8px 16px; white-space: nowrap; font-weight: bold; border-radius: 12px;">Додати</button>
            </div>
          </form>
        </div>
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
    </div>
  `;

  // Навігація
  document.getElementById('btn-back').addEventListener('click', () => navigate('student-list'));
  document.getElementById('btn-to-scanner').addEventListener('click', () => navigate('scanner'));

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
      return `
        <div class="parchment-card flex justify-between items-center" style="flex-wrap: wrap; gap: 10px; padding: 10px 14px; opacity: ${isActive ? '1' : '0.6'};">
          <div class="flex items-center gap-sm" style="min-width: 160px; flex: 1;">
            <span style="font-size: 26px; line-height: 1;">${item.icon || '🎁'}</span>
            <div>
              <div style="font-weight: 700; font-size: 15px; color: var(--text-parchment);">${item.name}</div>
              <div style="font-size: 11px; margin-top: 2px; color: var(--text-parchment-muted);">
                ${item.category === 'sweet' ? 'Смаколик' : 'Привілей'} · ${isActive ? '<span style="color:#217346; font-weight: 700;">Активний</span>' : '<span style="color:#8b2626;">Приховано</span>'}
              </div>
            </div>
          </div>

          <div class="flex items-center gap-xs" style="flex-wrap: nowrap;">
            <div class="flex items-center gap-xs">
              <input type="number" class="item-price-input" data-index="${index}" value="${item.price}" min="1" max="999" style="width: 58px; min-height: 38px; padding: 4px; text-align: center; font-weight: bold; font-size: 15px; background: #fff; color: #222; border: 1.5px solid var(--gold-deep);">
              <span style="color: var(--gold-deep); font-weight: bold; font-size: 15px; font-family: var(--font-fantasy);">✦</span>
            </div>
            
            <button class="btn-toggle-active" data-index="${index}" style="padding: 6px 10px; min-height: 38px; font-size: 12px; font-weight: 600; border-radius: var(--radius-sm); background: ${isActive ? 'rgba(61, 220, 151, 0.2)' : 'rgba(0,0,0,0.08)'}; color: ${isActive ? '#137a4a' : 'var(--text-parchment-muted)'}; border: 1px solid rgba(0,0,0,0.1);" title="${isActive ? 'Приховати з магазину' : 'Показати в магазині'}">
              ${isActive ? 'Вимкнути' : 'Увімкнути'}
            </button>

            <button class="btn-delete-item btn-genshin-crimson" data-index="${index}" style="padding: 6px 8px; min-height: 38px; min-width: 38px; font-size: 13px; border-radius: var(--radius-sm);" title="Видалити">
              🗑️
            </button>
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

  // Додавання нової нагороди
  document.getElementById('form-add-reward').addEventListener('submit', (e) => {
    e.preventDefault();
    const icon = document.getElementById('reward-icon').value.trim() || '🎁';
    const name = document.getElementById('reward-name').value.trim();
    const price = Number(document.getElementById('reward-price').value) || 10;
    const category = document.getElementById('reward-cat').value;

    if (!name) return;

    const id = 'item_' + Date.now().toString(36);
    shopItems.push({
      id,
      name,
      icon,
      price,
      category,
      active: true,
      order: shopItems.length + 1
    });

    document.getElementById('reward-name').value = '';
    renderAdminShop();
    showToast(`Нагороду "${name}" додано до списку! Не забудьте натиснути «Зберегти ціни».`);
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
}
