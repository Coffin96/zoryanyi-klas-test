import { listenLedger } from '../data/repo.js';
import { iconFiligreeDivider, iconPrimogem } from '../components/genshin-icons.js';

export function renderHistory(root, state) {
  root.innerHTML = `
    <div class="container">
      <div class="text-center" style="margin-bottom: var(--spacing-sm);">
        <h2 class="fantasy-title" style="margin: 0 0 4px 0; font-size: 22px;">Хроніка пригод</h2>
        <p class="text-muted" style="margin: 0; font-size: 13px;">Журнал зароблених та витрачених зірок</p>
        ${iconFiligreeDivider()}
      </div>
      
      <!-- Мої оцінки (стилізовані під золоті монети / медалі) -->
      <div id="stats-container" class="surface-card flex flex-col gap-sm" style="margin-bottom: var(--spacing-md); display: none; padding: 14px 16px;">
        <h3 class="fantasy-title" style="margin: 0 0 8px 0; font-size: 14px; color: var(--gold-light);">Мої оцінки у щоденнику</h3>
        <div id="grade-stats-list" class="flex gap-sm" style="flex-wrap: wrap;"></div>
      </div>

      <!-- Хронологічний список записів -->
      <div id="history-list" class="flex flex-col gap-sm">
        <p class="text-muted text-center" style="margin-top: 20px;">Завантаження хроніки...</p>
      </div>
    </div>
  `;

  if (state.profile && state.profile.stats && state.profile.stats.gradeCount) {
    const grades = state.profile.stats.gradeCount;
    const statsList = document.getElementById('grade-stats-list');
    const statsContainer = document.getElementById('stats-container');
    let hasStats = false;
    
    // Сортуємо оцінки за спаданням (12, 11, 10...)
    const sortedGrades = Object.keys(grades).sort((a, b) => Number(b) - Number(a));
    
    let statsHtml = '';
    sortedGrades.forEach(grade => {
      if (grades[grade] > 0) {
        hasStats = true;
        statsHtml += `
          <div style="background: rgba(10, 15, 34, 0.7); padding: 6px 12px; border-radius: var(--radius-md); border: 1.5px solid var(--gold-border); display: inline-flex; align-items: center; gap: 4px; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">
            <span style="font-weight: 800; font-size: 16px; color: var(--gold-primary); font-family: var(--font-fantasy);">${grade}</span>
            <span style="color: var(--muted); font-size: 12px;">× ${grades[grade]}</span>
          </div>
        `;
      }
    });

    if (hasStats) {
      statsList.innerHTML = statsHtml;
      statsContainer.style.display = 'flex';
    }
  }

  const unsubscribe = listenLedger(state.uuid, 20, (items) => {
    const listDiv = document.getElementById('history-list');
    if (!listDiv) {
      unsubscribe();
      return;
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
