import { listenLedger } from '../data/repo.js';
import { iconFiligreeDivider, iconPrimogem } from '../components/genshin-icons.js';
import { renderStudentStats } from './stats.js';

export function renderHistory(root, state) {
  root.innerHTML = `
    <div class="container">
      <div class="text-center" style="margin-bottom: var(--spacing-sm);">
        <h2 class="fantasy-title" style="margin: 0 0 4px 0; font-size: 22px;">Хроніка пригод</h2>
        <p class="text-muted" style="margin: 0; font-size: 13px;">Журнал успішності, зароблених та витрачених зірок</p>
        ${iconFiligreeDivider()}
      </div>
      
      <!-- Секція статистики та графіків успішності учня -->
      <div id="student-stats-section"></div>

      <!-- Хронологічний список записів -->
      <div class="flex justify-between items-center" style="margin: var(--spacing-md) 0 var(--spacing-xs) 0; padding: 0 4px;">
        <h3 class="fantasy-title" style="margin: 0; font-size: 16px; color: var(--gold-light);">Останні події</h3>
        <span class="text-muted" style="font-size: 12px;">Журнал операцій</span>
      </div>
      <div id="history-list" class="flex flex-col gap-sm">
        <p class="text-muted text-center" style="margin-top: 20px;">Завантаження хроніки...</p>
      </div>
    </div>
  `;

  const statsSection = document.getElementById('student-stats-section');
  if (statsSection) {
    renderStudentStats(statsSection, { profile: state.profile, ledgerItems: [] });
  }

  const unsubscribe = listenLedger(state.uuid, 50, (items) => {
    const listDiv = document.getElementById('history-list');
    if (!listDiv) {
      unsubscribe();
      return;
    }

    // Оновлюємо статистику з новими даними журналу
    const statsContainer = document.getElementById('student-stats-section');
    if (statsContainer) {
      renderStudentStats(statsContainer, { profile: state.profile, ledgerItems: items });
    }

    if (items.length === 0) {
      listDiv.innerHTML = '<p class="text-muted text-center" style="margin-top: 20px;">Хроніка порожня. Отримуй оцінки за щоденником!</p>';
      return;
    }

    listDiv.innerHTML = items.map(item => {
      const isPositive = item.delta > 0;
      
      // 1. Форматування дати
      let date = 'Нещодавно';
      if (item.ts) {
        let ms = null;
        if (typeof item.ts === 'number') {
          ms = item.ts;
        } else if (item.ts.toMillis && typeof item.ts.toMillis === 'function') {
          ms = item.ts.toMillis();
        } else if (item.ts.seconds) {
          ms = item.ts.seconds * 1000;
        } else if (typeof item.ts === 'string') {
          ms = Date.parse(item.ts);
        }
        if (ms && !isNaN(ms)) {
          date = new Date(ms).toLocaleString('uk-UA', { 
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
          });
        }
      }

      // 2. Форматування опису операції
      let desc = item.desc;
      if (!desc) {
        if (item.type === 'credit') {
          if (item.entries && item.entries.length > 0) {
            const gradesList = item.entries.map(e => e.g).join(', ');
            desc = `Оцінки: ${gradesList}`;
          } else {
            desc = 'Зарахування за оцінки';
          }
        } else if (item.type === 'redeem') {
          const shopItem = (state.config?.shop || []).find(s => s.id === item.item);
          const itemName = shopItem ? `${shopItem.icon || '🎁'} ${shopItem.name}` : (item.item || 'Винагорода');
          const qtyText = item.qty && item.qty > 1 ? ` (${item.qty} шт.)` : '';
          desc = `Видача: ${itemName}${qtyText}`;
        } else if (item.type === 'quest') {
          const questItem = (state.config?.quests || []).find(q => q.id === item.quest);
          const questTitle = questItem ? `${questItem.icon || '🏆'} ${questItem.title || questItem.name}` : 'Квест';
          desc = `Квест: ${questTitle}`;
        } else if (item.type === 'adjust') {
          desc = item.reason ? `Коригування (${item.reason})` : 'Коригування балансу';
        } else if (item.type === 'void') {
          desc = 'Скасування операції';
        } else {
          desc = isPositive ? 'Зарахування зірок' : 'Списання зірок';
        }
      }

      return `
        <div class="parchment-card flex justify-between items-center" style="padding: 12px 16px;">
          <div>
            <div style="font-weight: 700; font-size: 14px; color: var(--text-parchment); margin-bottom: 2px;">${desc}</div>
            <div style="font-size: 11px; color: var(--text-parchment-subtle);">${date}</div>
          </div>
          <div style="font-weight: 800; font-size: 16px; font-family: var(--font-fantasy); color: ${isPositive ? 'var(--gold-deep)' : '#8b2626'}; white-space: nowrap;">
            ${isPositive ? '+' : ''}${item.delta} ✦
          </div>
        </div>
      `;
    }).join('');
  }, err => {
    const listDiv = document.getElementById('history-list');
    if (listDiv) {
      listDiv.innerHTML = '<p class="error-text text-center" style="margin-top: 20px;">Помилка завантаження хроніки</p>';
    }
  });
}
