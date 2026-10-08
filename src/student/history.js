import { listenLedger } from '../data/repo.js';

export function renderHistory(root, state) {
  root.innerHTML = `
    <div class="container">
      <h2>Статистика та Історія</h2>
      
      <div id="stats-container" class="surface-card flex flex-col gap-sm" style="margin-bottom: var(--spacing-md); display: none;">
        <h3 style="margin: 0 0 8px 0; font-size: 14px; color: var(--muted);">Мої оцінки</h3>
        <div id="grade-stats-list" class="flex gap-sm" style="flex-wrap: wrap;"></div>
      </div>

      <div id="history-list" class="flex flex-col gap-sm">
        <p class="text-muted text-center" style="margin-top: 20px;">Завантаження...</p>
      </div>
    </div>
  `;

  if (state.profile && state.profile.stats && state.profile.stats.gradeCount) {
    const grades = state.profile.stats.gradeCount;
    const statsList = document.getElementById('grade-stats-list');
    const statsContainer = document.getElementById('stats-container');
    let hasStats = false;
    
    // Sort keys descending (e.g. 12, 11, 10, 9...)
    const sortedGrades = Object.keys(grades).sort((a, b) => Number(b) - Number(a));
    
    let statsHtml = '';
    sortedGrades.forEach(grade => {
      if (grades[grade] > 0) {
        hasStats = true;
        statsHtml += `
          <div style="background: var(--bg); padding: 6px 12px; border-radius: var(--radius-sm); border: 1px solid rgba(255,255,255,0.1);">
            <span style="font-weight: bold; font-size: 16px;">${grade}</span>
            <span class="text-muted" style="margin-left: 4px; font-size: 12px;">× ${grades[grade]}</span>
          </div>
        `;
      }
    });

    if (hasStats) {
      statsList.innerHTML = statsHtml;
      statsContainer.style.display = 'flex';
    }
  }

  // We could cache the listener, but for simplicity we fetch it each time the view is opened.
  // In a more robust app, we'd unsubscribe when navigating away.
  const unsubscribe = listenLedger(state.uuid, 20, (items) => {
    const listDiv = document.getElementById('history-list');
    if (!listDiv) {
      unsubscribe(); // the user navigated away
      return;
    }

    if (items.length === 0) {
      listDiv.innerHTML = '<p class="text-muted text-center" style="margin-top: 20px;">Історія порожня</p>';
      return;
    }

    listDiv.innerHTML = items.map(item => {
      const isPositive = item.delta > 0;
      
      // 1. Форматування дати (підтримка Firestore Timestamp, ms, ISO string)
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
        <div class="surface-card flex justify-between items-center" style="padding: 12px 16px;">
          <div>
            <div style="font-weight: bold; margin-bottom: 2px;">${desc}</div>
            <div class="text-muted" style="font-size: 12px;">${date}</div>
          </div>
          <div style="font-weight: bold; font-size: 16px; color: ${isPositive ? 'var(--star)' : 'var(--text)'};">
            ${isPositive ? '+' : ''}${item.delta} ✦
          </div>
        </div>
      `;
    }).join('');
  }, err => {
    const listDiv = document.getElementById('history-list');
    if (listDiv) {
      listDiv.innerHTML = '<p class="text-muted text-center" style="margin-top: 20px;">Помилка завантаження історії</p>';
    }
  });
}
