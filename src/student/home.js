import { levelOf, progressTo } from '../engine/economy.js';
import { logout, showStudentToast } from './app.js';
import { updateStudentAlias } from '../data/repo.js';

export function renderHome(root, state) {
  const p = state.profile;
  const c = state.config;
  
  const level = levelOf(p.earned, c);
  const prog = progressTo(p.earned, c);
  
  let countdownHtml = '';
  if (c.settings && c.settings.yearEnd) {
    const end = new Date(c.settings.yearEnd).getTime();
    const now = Date.now();
    const daysLeft = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
    if (daysLeft <= 14 && daysLeft > 0) {
      countdownHtml = `<div class="surface-card text-center" style="margin-bottom: var(--spacing-md); color: var(--danger); font-weight: bold;">
        До кінця року ${daysLeft} дн. Залишок ${p.balance} ✦: встигни обміняти!
      </div>`;
    }
  }

  root.innerHTML = `
    <div class="container">
      <div class="top-bar flex justify-between items-center" style="gap: 8px;">
        <div class="flex items-center gap-xs">
          <h2 style="margin:0; font-size: 20px;">${p.alias}</h2>
          <button id="btn-edit-alias" style="background:transparent; border:none; cursor:pointer; font-size:16px; padding:4px;" title="Змінити псевдонім">✏️</button>
        </div>
        <button id="btn-logout" class="danger" style="padding: 6px 10px; min-height: auto; font-size: 13px;">Це не я</button>
      </div>
      
      ${countdownHtml}

      <div id="pwa-install-hint" class="surface-card text-left" style="margin-bottom: var(--spacing-md); background: rgba(61, 220, 151, 0.1); border: 1px solid var(--ok); display: none;">
        <div class="flex justify-between items-start" style="margin-bottom: 8px;">
          <h3 style="margin: 0; color: var(--ok); font-size: 14px;">📲 Збережи свій профіль!</h3>
          <button id="btn-close-hint" style="background: transparent; border: none; color: var(--muted); font-size: 16px; cursor: pointer; min-height: auto; padding: 0;">×</button>
        </div>
        <p style="margin: 0; font-size: 13px; color: var(--text);">
          Додай цю сторінку на головний екран телефону (або в закладки). Тобі більше не знадобиться QR-код, щоб перевіряти баланс!
        </p>
      </div>

      <div class="surface-card text-center" style="margin-bottom: var(--spacing-md);">
        <div style="font-size: 16px; color: var(--muted);">${level.name}</div>
        <div style="font-size: 72px; font-weight: bold; color: var(--star); line-height: 1;">${p.balance} ✦</div>
        
        <div style="margin-top: var(--spacing-md); text-align: left;">
          <div class="flex justify-between text-muted" style="font-size: 14px; margin-bottom: 4px;">
            <span>${level.name}</span>
            <span>до ${prog.nextName}: ${prog.remaining} ✦</span>
          </div>
          <div style="width: 100%; background: var(--bg); height: 8px; border-radius: 4px; overflow: hidden;">
            <div style="width: ${prog.percent}%; background: var(--accent); height: 100%;"></div>
          </div>
        </div>
      </div>

      <div class="surface-card" style="margin-bottom: var(--spacing-md);">
        <h3 style="margin-top:0;">Нагороди</h3>
        <div class="flex flex-col gap-sm">
          ${renderTopShop(p, c)}
        </div>
      </div>
    </div>
  `;

  document.getElementById('btn-logout').addEventListener('click', logout);

  const btnEdit = document.getElementById('btn-edit-alias');
  if (btnEdit) {
    btnEdit.addEventListener('click', async () => {
      const newAlias = prompt('Введіть новий псевдонім (до 24 символів):', p.alias);
      if (!newAlias) return;
      const trimmed = newAlias.trim();
      if (!trimmed || trimmed === p.alias) return;
      if (trimmed.length > 24) {
        alert('Псевдонім занадто довгий (максимум 24 символи)');
        return;
      }
      btnEdit.disabled = true;
      try {
        await updateStudentAlias(state.uuid, trimmed);
        showStudentToast('Псевдонім успішно оновлено!');
      } catch (err) {
        console.error(err);
        alert('Помилка оновлення псевдоніма: ' + err.message);
      } finally {
        btnEdit.disabled = false;
      }
    });
  }

  setTimeout(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    const hintClosed = localStorage.getItem('zk_hide_install_hint');
    if (!isStandalone && !hintClosed) {
      const hint = document.getElementById('pwa-install-hint');
      if (hint) {
        hint.style.display = 'block';
        const btnClose = document.getElementById('btn-close-hint');
        if (btnClose) {
          btnClose.addEventListener('click', () => {
            hint.style.display = 'none';
            localStorage.setItem('zk_hide_install_hint', 'true');
          });
        }
      }
    }
  }, 100);
}

function renderTopShop(p, c) {
  const shop = c.shop || [];
  return shop.slice(0, 3).map(item => {
    const percent = Math.min(100, Math.floor((p.balance / item.price) * 100));
    const canAfford = p.balance >= item.price;
    return `
      <div style="background: var(--bg); padding: var(--spacing-sm); border-radius: var(--radius-sm);">
        <div class="flex justify-between" style="margin-bottom: 4px;">
          <span>${item.icon} ${item.name}</span>
          <span style="font-weight: bold;">${item.price} ✦ ${canAfford ? ' [✓]' : ''}</span>
        </div>
        <div style="width: 100%; background: var(--surface); height: 6px; border-radius: 3px; overflow: hidden;">
          <div style="width: ${percent}%; background: ${canAfford ? 'var(--ok)' : 'var(--star)'}; height: 100%;"></div>
        </div>
      </div>
    `;
  }).join('');
}
