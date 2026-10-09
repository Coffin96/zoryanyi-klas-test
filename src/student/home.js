import { levelOf, progressTo } from '../engine/economy.js';
import { logout, showStudentToast } from './app.js';
import { updateStudentAlias } from '../data/repo.js';
import { iconPrimogem, iconRankCrest, iconFiligreeDivider } from '../components/genshin-icons.js';

export function renderHome(root, state) {
  const p = state.profile;
  const c = state.config;
  
  const level = levelOf(p.earned, c);
  const prog = progressTo(p.earned, c);
  
  // Визначаємо порядковий номер рангу (1, 2, 3...)
  const levelIdx = Math.max(1, (c.levels || []).findIndex(l => l.name === level.name) + 1);

  let countdownHtml = '';
  if (c.settings && c.settings.yearEnd) {
    const end = new Date(c.settings.yearEnd).getTime();
    const now = Date.now();
    const daysLeft = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
    if (daysLeft <= 14 && daysLeft > 0) {
      countdownHtml = `
        <div class="surface-card text-center" style="margin-bottom: var(--spacing-md); border-color: rgba(207,67,67,0.6); color: #ffa3a3; font-weight: 600;">
          ⏳ До завершення навчального року ${daysLeft} дн. Залишок: ${p.balance} ✦ — встигни обміняти нагороди!
        </div>
      `;
    }
  }

  root.innerHTML = `
    <div class="container">
      <!-- 1. Верхня плашка учня -->
      <div class="top-bar flex justify-between items-center" style="gap: 8px;">
        <div class="flex items-center gap-xs">
          <span style="display:inline-flex; align-items:center; filter:drop-shadow(0 0 6px var(--gold-glow));">
            ${iconPrimogem(22)}
          </span>
          <h2 style="margin:0; font-size: 20px; font-family: var(--font-fantasy); letter-spacing: 0.03em;">${p.alias}</h2>
          <button id="btn-edit-alias" style="background:transparent; border:none; cursor:pointer; font-size:15px; padding:4px; min-height:auto; min-width:auto; color:var(--gold-light);" title="Змінити псевдонім">✏️</button>
        </div>
        <button id="btn-logout" class="btn-genshin-crimson" style="padding: 6px 14px; min-height: 38px; font-size: 13px; border-radius: 18px;">
          Це не я
        </button>
      </div>
      
      ${countdownHtml}

      <!-- 2. Банер «Збережи свій профіль!» (як у Genshin) -->
      <div id="pwa-install-hint" class="surface-card text-left" style="margin-bottom: var(--spacing-md); background: rgba(14, 38, 56, 0.9); border: 1.5px solid var(--cyan-accent); box-shadow: 0 4px 16px rgba(0,0,0,0.4), 0 0 10px var(--cyan-glow); display: none;">
        <div class="flex justify-between items-start" style="margin-bottom: 6px;">
          <div class="flex items-center gap-xs">
            <span style="font-size: 20px;">📲</span>
            <h3 style="margin: 0; color: var(--cyan-accent); font-size: 15px; font-family: var(--font-fantasy);">Збережи свій профіль!</h3>
          </div>
          <button id="btn-close-hint" style="background: transparent; border: none; color: var(--muted); font-size: 20px; cursor: pointer; min-height: auto; min-width: auto; padding: 0 4px; line-height: 1;">×</button>
        </div>
        <p style="margin: 0; font-size: 13px; color: var(--text);">
          Додай цю сторінку на головний екран телефону (або в закладки). Тобі більше не знадобиться QR-код, щоб перевіряти баланс!
        </p>
      </div>

      <!-- 3. Головна картка Рангу та Балансу Зірок (Adventure Rank Card) -->
      <div class="surface-card text-center" style="margin-bottom: var(--spacing-md); padding: 20px 16px; border: 1.5px solid rgba(229, 195, 120, 0.45); box-shadow: 0 6px 24px rgba(0,0,0,0.5), inset 0 0 20px rgba(229,195,120,0.06);">
        <!-- Герб рангу та поточний рівень -->
        <div class="flex items-center justify-center gap-sm" style="margin-bottom: 8px;">
          ${iconRankCrest(levelIdx)}
          <div class="text-left">
            <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--gold-light);">Ранг шукача пригод</div>
            <div style="font-size: 18px; font-family: var(--font-fantasy); color: #fff; font-weight: bold; line-height: 1.2;">${level.name}</div>
          </div>
        </div>

        <!-- Величезний баланс зірок-примогемів -->
        <div class="flex items-center justify-center gap-xs" style="margin: 8px 0 12px 0;">
          <span style="font-size: 64px; font-weight: 800; font-family: var(--font-fantasy); color: var(--star); line-height: 1; text-shadow: 0 0 18px var(--gold-glow), 0 2px 6px #000;">
            ${p.balance}
          </span>
          <span style="display:inline-flex; align-items:center; filter:drop-shadow(0 0 12px var(--gold-glow)); margin-top: -6px;">
            ${iconPrimogem(46)}
          </span>
        </div>
        
        <!-- Смуга прогресу до наступного рангу -->
        <div style="text-align: left; background: rgba(10, 14, 30, 0.6); padding: 10px 14px; border-radius: var(--radius-md); border: 1px solid rgba(214, 181, 115, 0.25);">
          <div class="flex justify-between" style="font-size: 12px; margin-bottom: 6px;">
            <span style="color: var(--gold-light); font-weight: 600;">${level.name}</span>
            <span style="color: var(--muted);">до <strong>${prog.nextName}</strong>: ${prog.remaining} ✦</span>
          </div>
          <div class="genshin-progress-track dark-track">
            <div class="genshin-progress-fill-cyan" style="width: ${prog.percent}%;"></div>
          </div>
        </div>
      </div>

      <!-- 4. Вітрина нагород (Нагороди) у стилі пергаментних карток -->
      <div style="margin-bottom: var(--spacing-md);">
        <div class="flex justify-between items-center" style="margin-bottom: 10px; padding: 0 4px;">
          <h3 class="fantasy-title" style="margin:0; font-size: 18px; color: var(--gold-light);">Нагороди</h3>
          <span style="font-size: 12px; color: var(--muted);">Обирай у магазині</span>
        </div>
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
    const isSweet = item.category === 'sweet';
    
    return `
      <div class="parchment-card" style="padding: 12px 14px;">
        <div class="flex justify-between items-center" style="margin-bottom: 6px;">
          <div class="flex items-center gap-sm">
            <span style="font-size: 26px; line-height: 1;">${item.icon || '🎁'}</span>
            <div>
              <div style="font-weight: 700; font-size: 15px; color: var(--text-parchment);">${item.name}</div>
              <span class="badge-tag">${isSweet ? 'Смаколик' : 'Привілей'}</span>
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-weight: 800; font-size: 16px; color: ${canAfford ? 'var(--ok)' : 'var(--text-parchment)'}; font-family: var(--font-fantasy);">
              ${item.price} ✦ ${canAfford ? '✓' : ''}
            </div>
            ${!canAfford ? `<span style="font-size: 11px; color: var(--text-parchment-muted);">ще ${item.price - p.balance} ✦</span>` : ''}
          </div>
        </div>
        <div class="genshin-progress-track">
          <div class="${canAfford ? 'genshin-progress-fill-cyan' : 'genshin-progress-fill-gold'}" style="width: ${percent}%;"></div>
        </div>
      </div>
    `;
  }).join('');
}
