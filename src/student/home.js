import { levelOf, progressTo } from '../engine/economy.js';
import { logout, navigate, showStudentToast } from './app.js';
import { updateStudentAlias } from '../data/repo.js';
import { validateQuest, findNearestQuest } from '../engine/quests.js';
import { kyivParts } from '../engine/time.js';
import { getWishlist } from './shop.js';
import { 
  iconPrimogem, 
  iconRankCrest, 
  iconFiligreeDivider,
  iconFlame,
  iconGrowth,
  iconContrib
} from '../components/genshin-icons.js';

export { findNearestQuest };

export function renderNearestQuestBlock(p, c) {
  const best = findNearestQuest(p, c);
  if (!best) {
    return `
      <div class="parchment-card text-center" style="padding: 16px; border: 1.5px dashed var(--gold-border);">
        <div style="font-size: 26px; margin-bottom: 4px;">🌟</div>
        <div style="font-weight: 700; font-size: 14px; color: var(--text-parchment);">
          Усі доступні квести виконано!
        </div>
        <div style="font-size: 12px; color: var(--text-parchment-muted); margin-top: 2px;">
          Відпочинь або завітай наступного періоду за новими завданнями.
        </div>
      </div>
    `;
  }

  let iconHtml = '';
  if (best.quest.type === 'streak') iconHtml = iconFlame(24);
  else if (best.quest.type === 'growth') iconHtml = iconGrowth(24);
  else if (best.quest.type === 'manual') iconHtml = iconContrib(24);
  else iconHtml = `<span style="font-size: 22px;">${best.quest.icon || '🏆'}</span>`;

  const progText = (typeof best.progress === 'number' && !Number.isInteger(best.progress))
    ? `${best.progress.toFixed(1)} / ${best.target}`
    : `${best.progress} / ${best.target}`;

  return `
    <div id="nearest-quest-card" class="parchment-card clickable-card" style="padding: 14px 16px; cursor: pointer; transition: transform 0.15s ease;" title="Натисни, щоб перейти до квестів">
      <div class="flex justify-between items-center" style="margin-bottom: 8px;">
        <div class="flex items-center gap-xs">
          <span class="badge-tag" style="background: rgba(229,195,120,0.2); color: var(--text-parchment); border: 1px solid var(--gold-deep); font-weight: 700;">
            ${best.isLifetime ? 'Досягнення' : (best.isWeekly ? 'Тижневий' : 'Місячний')}
          </span>
          <span style="font-size: 12px; color: var(--text-parchment-muted);">Рекомендоване завдання</span>
        </div>
        <div class="badge-gold" style="font-size: 13px; font-weight: 800; padding: 2px 8px; border-radius: 12px;">
          +${best.reward} ✦
        </div>
      </div>

      <div class="flex items-center gap-sm" style="margin-bottom: 8px;">
        <div style="width: 40px; height: 40px; min-width: 40px; border-radius: 50%; background: radial-gradient(circle, #f9eed7 0%, #e8d2a7 100%); border: 1.5px solid var(--gold-deep); display: flex; align-items: center; justify-content: center; box-shadow: inset 0 1px 2px rgba(255,255,255,0.8), 0 2px 4px rgba(0,0,0,0.15);">
          ${iconHtml}
        </div>
        <div style="flex: 1; min-width: 0;">
          <div style="font-weight: 700; font-size: 15px; color: var(--text-parchment); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${best.quest.title || best.quest.name}
          </div>
          <div style="font-size: 12px; color: var(--text-parchment-muted); line-height: 1.3; margin-top: 1px;">
            ${best.desc}
          </div>
        </div>
      </div>

      <div>
        <div class="flex justify-between items-center" style="font-size: 11px; margin-bottom: 4px;">
          <span style="color: var(--text-parchment-muted);">Прогрес виконання:</span>
          <span style="font-weight: 700; color: var(--text-parchment);">${progText} (${best.percent}%)</span>
        </div>
        <div class="genshin-progress-track">
          <div class="genshin-progress-fill-cyan" style="width: ${best.percent}%;"></div>
        </div>
      </div>
    </div>
  `;
}

export function renderActiveEventBlock(c) {
  const event = c?.event;
  if (!event || event.active !== true) {
    return '';
  }

  return `
    <div class="parchment-card" style="padding: 14px 16px; border: 1.5px solid var(--gold-deep); background: radial-gradient(circle at top right, rgba(229,195,120,0.22), rgba(246,238,222,0.95)); box-shadow: 0 4px 14px rgba(0,0,0,0.15), 0 0 12px rgba(229,195,120,0.3);">
      <div class="flex justify-between items-center" style="margin-bottom: 8px;">
        <div class="flex items-center gap-xs">
          <span class="badge-tag" style="background: rgba(207,67,67,0.15); color: #8b2626; border: 1px solid rgba(207,67,67,0.4); font-weight: 800; font-size: 11px;">
            СПЕЦІАЛЬНА ПОДІЯ
          </span>
          <span style="font-size: 12px; color: var(--text-parchment-muted);">Одноразовий квест</span>
        </div>
        <div class="badge-gold" style="font-size: 14px; font-weight: 800; padding: 2px 10px; border-radius: 12px;">
          +${event.reward} ✦
        </div>
      </div>

      <div class="flex items-center gap-sm" style="margin-bottom: 10px;">
        <div style="width: 44px; height: 44px; min-width: 44px; border-radius: 50%; background: radial-gradient(circle, #fbf2de 0%, #ecd7af 100%); border: 1.5px solid var(--gold-deep); display: flex; align-items: center; justify-content: center; font-size: 24px; box-shadow: 0 2px 6px rgba(0,0,0,0.15);">
          🏆
        </div>
        <div style="flex: 1; min-width: 0;">
          <div style="font-weight: 800; font-size: 16px; color: var(--text-parchment); line-height: 1.2;">
            ${event.name}
          </div>
          <div style="font-size: 12px; color: var(--text-parchment-muted); margin-top: 2px;">
            Особливе випробування для всього класу
          </div>
        </div>
      </div>

      <div class="flex items-center justify-between" style="background: rgba(229,195,120,0.18); padding: 8px 12px; border-radius: 10px; border: 1px dashed var(--gold-border);">
        <div class="flex items-center gap-xs" style="font-size: 12px; font-weight: 700; color: var(--text-parchment);">
          <span>📱</span>
          <span>Покажи QR вчителю для виконання</span>
        </div>
        <button id="btn-event-show-qr" class="btn-genshin-gold" style="padding: 4px 12px; font-size: 12px; min-height: 28px; border-radius: 8px;">
          Мій QR →
        </button>
      </div>
    </div>
  `;
}

export function renderWishlist(p, c) {
  const shop = c?.shop || [];
  let wishlist = [];
  try {
    wishlist = getWishlist();
  } catch {
    wishlist = [];
  }

  const wishItems = wishlist.map(val => {
    let found = shop.find(item => item.id === val || String(item.id) === String(val));
    if (!found && typeof val === 'number' && shop[val]) {
      found = shop[val];
    }
    return found;
  }).filter(Boolean);

  if (wishItems.length === 0) {
    return `
      <div class="parchment-card text-center" style="padding: 22px 16px; border: 1.5px dashed var(--gold-border);">
        <div style="font-size: 30px; margin-bottom: 6px;">🎁</div>
        <div style="font-weight: 700; font-size: 15px; color: var(--text-parchment); margin-bottom: 4px;">
          Список бажань порожній
        </div>
        <p style="font-size: 13px; color: var(--text-parchment-muted); margin: 0 0 12px 0;">
          Обери бажані нагороди у Магазині, щоб відстежувати їх тут
        </p>
        <button id="btn-goto-shop" class="btn-genshin-gold" style="padding: 6px 16px; font-size: 13px; min-height: 34px; border-radius: 12px;">
          Обрати в Магазині →
        </button>
      </div>
    `;
  }

  return `
    <div class="flex flex-col gap-sm">
      ${wishItems.map(item => {
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
      }).join('')}
    </div>
  `;
}

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
        <div class="flex items-center justify-center gap-xs" style="margin: 8px 0 2px 0;">
          <span style="font-size: 64px; font-weight: 800; font-family: var(--font-fantasy); color: var(--star); line-height: 1; text-shadow: 0 0 18px var(--gold-glow), 0 2px 6px #000;">
            ${p.balance}
          </span>
          <span id="main-balance-star" style="display:inline-flex; align-items:center; filter:drop-shadow(0 0 12px var(--gold-glow)); margin-top: -6px; cursor: pointer; user-select: none;" title="Зірка балансу">
            ${iconPrimogem(46)}
          </span>
        </div>
        <div style="font-size: 13px; color: var(--muted); margin-bottom: 12px; letter-spacing: 0.02em;">
          Загалом здобуто за весь час: ${p.earned} ✦
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

      <!-- 4. Контейнер подійних квестів (Етап 6) -->
      <div id="active-event-container" style="margin-bottom: ${c?.event?.active ? 'var(--spacing-md)' : '0'};">
        ${renderActiveEventBlock(c)}
      </div>

      <!-- 5. Розумний Дашборд Учня: Найближча ціль та Список бажань -->
      <div id="student-dashboard" style="margin-bottom: var(--spacing-md);">
        <!-- Секція: Найближча ціль -->
        <div style="margin-bottom: var(--spacing-md);">
          <div class="flex justify-between items-center" style="margin-bottom: 8px; padding: 0 4px;">
            <h3 class="fantasy-title" style="margin:0; font-size: 18px; color: var(--gold-light);">Найближча ціль</h3>
            <button id="btn-goto-quests" style="background:transparent; border:none; color:var(--muted); font-size:12px; cursor:pointer; text-decoration:underline;">Усі квести →</button>
          </div>
          ${renderNearestQuestBlock(p, c)}
        </div>

        <!-- Секція: Список бажань -->
        <div>
          <div class="flex justify-between items-center" style="margin-bottom: 8px; padding: 0 4px;">
            <h3 class="fantasy-title" style="margin:0; font-size: 18px; color: var(--gold-light);">Список бажань</h3>
            <button id="btn-edit-wishlist" style="background:transparent; border:none; color:var(--muted); font-size:12px; cursor:pointer; text-decoration:underline;">Магазин →</button>
          </div>
          ${renderWishlist(p, c)}
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

  const btnGoQuests = document.getElementById('btn-goto-quests');
  if (btnGoQuests) {
    btnGoQuests.addEventListener('click', () => navigate('quests'));
  }
  const btnNearestQuest = document.getElementById('nearest-quest-card');
  if (btnNearestQuest) {
    btnNearestQuest.addEventListener('click', () => navigate('quests'));
  }
  const btnGoShop = document.getElementById('btn-goto-shop');
  if (btnGoShop) {
    btnGoShop.addEventListener('click', () => navigate('shop'));
  }
  const btnEditWishlist = document.getElementById('btn-edit-wishlist');
  if (btnEditWishlist) {
    btnEditWishlist.addEventListener('click', () => navigate('shop'));
  }
  const btnEventQr = document.getElementById('btn-event-show-qr');
  if (btnEventQr) {
    btnEventQr.addEventListener('click', () => navigate('qr'));
  }

  const balanceStar = document.getElementById('main-balance-star');
  if (balanceStar) {
    let animTimeout;
    balanceStar.addEventListener('click', () => {
      balanceStar.classList.remove('star-pulse-anim');
      void balanceStar.offsetWidth;
      balanceStar.classList.add('star-pulse-anim');
      clearTimeout(animTimeout);
      animTimeout = setTimeout(() => {
        balanceStar.classList.remove('star-pulse-anim');
      }, 350);
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

export function renderTopShop(p, c) {
  return renderWishlist(p, c);
}
