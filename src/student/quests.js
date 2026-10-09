import { kyivParts } from '../engine/time.js';
import { 
  iconFiligreeDivider, 
  iconFlame, 
  iconGrowth, 
  iconContrib, 
  iconPrimogem 
} from '../components/genshin-icons.js';

export function renderQuests(root, state) {
  const p = state.profile;
  const c = state.config;
  const quests = (c.quests || []).filter(q => q.active);
  const nowMs = Date.now();
  const { month, week } = kyivParts(nowMs);
  
  // Тижневі та місячні лічильники
  const weekCounters = (p.counters && p.counters[week]) || {};
  const monthCounters = (p.counters && p.counters[month]) || {};
  
  const weekStars = weekCounters.questStars || 0;
  const weeklyCap = c.questWeeklyCap || 6;
  const monthStars = monthCounters.questStars || 0;
  const monthlyCap = c.questMonthlyCap || 8;
  
  const capPercent = Math.min(100, Math.floor((monthStars / monthlyCap) * 100));

  root.innerHTML = `
    <div class="container">
      <div class="text-center" style="margin-bottom: var(--spacing-sm);">
        <h2 class="fantasy-title" style="margin: 0 0 4px 0; font-size: 22px;">Квести місяця</h2>
        <p class="text-muted" style="margin: 0; font-size: 13px;">Виконуй завдання та отримуй додаткові зірки!</p>
        ${iconFiligreeDivider()}
      </div>
      
      <!-- Загальний лічильник зароблених зірок за квести -->
      <div class="parchment-card" style="margin-bottom: var(--spacing-md); padding: 14px 16px;">
        <div class="flex justify-between items-center" style="margin-bottom: 8px;">
          <div class="flex items-center gap-xs">
            <span style="display:inline-flex; align-items:center;">
              ${iconPrimogem(20)}
            </span>
            <span style="font-weight: 700; font-size: 14px; color: var(--text-parchment);">Зароблено за квести у цьому місяці:</span>
          </div>
          <span style="font-weight: 800; font-size: 16px; font-family: var(--font-fantasy); color: var(--gold-deep);">
            ${monthStars} / ${monthlyCap} ✦
          </span>
        </div>
        <div class="genshin-progress-track">
          <div class="${monthStars >= monthlyCap ? 'genshin-progress-fill-cyan' : 'genshin-progress-fill-gold'}" style="width: ${capPercent}%;"></div>
        </div>
      </div>

      <!-- Список завдань у стилі Книги Шукача Пригод -->
      <div class="flex flex-col gap-sm">
        ${quests.map(quest => {
          const isLifetime = quest.type === 'lifetime_milestone' || quest.period === 'lifetime';
          const isWeekly = !isLifetime && (quest.period === 'week' || quest.period === 'weekly' || quest.perWeek != null);
          const counters = isLifetime ? (p.counters?.lifetime || {}) : (isWeekly ? weekCounters : monthCounters);
          const currentStars = isLifetime ? 0 : (isWeekly ? weekStars : monthStars);
          const currentCap = isLifetime ? Infinity : (isWeekly ? weeklyCap : monthlyCap);
          const limit = isLifetime ? 1 : (isWeekly ? (quest.perWeek ?? quest.limit ?? quest.perMonth ?? 1) : (quest.perMonth ?? quest.limit ?? 1));
          const count = Math.max(counters[quest.id] || 0, p.stats?.quests?.[quest.id] || 0);
          const isDone = count >= limit || currentStars >= currentCap;

          const target = quest.target ?? quest.params?.target ?? limit;
          const progress = isLifetime ? (p.earned || 0) : count;
          const percent = isDone ? 100 : (target > 0 ? Math.min(100, Math.floor((progress / target) * 100)) : 0);

          let desc = quest.desc || quest.description;
          if (!desc) {
            if (quest.type === 'weekly_count' || quest.type === 'grade_count') desc = 'Отримай 4 оцінки протягом тижня';
            else if (quest.type === 'consecutive') desc = '3 оцінки від 7 балів поспіль';
            else if (quest.type === 'target_grade' || quest.type === 'grade') desc = 'Отримай оцінку 12';
            else if (quest.type === 'monthly_growth') desc = 'Підвищ середній бал порівняно з минулим місяцем';
            else if (quest.type === 'monthly_average') desc = 'Середній бал понад 10 протягом місяця';
            else if (quest.type === 'growth') desc = 'Отримай оцінку, вищу за середній бал твоїх робіт';
            else if (quest.type === 'streak') desc = '3 оцінки від 8 балів протягом 7 днів';
            else if (quest.type === 'lifetime_milestone') desc = `Назбирай ${quest.target ?? 100} зірочок за весь час`;
            else if (quest.type === 'manual') desc = 'Корисна допомога класу або спільній справі';
            else desc = 'Спеціальне завдання';
          }

          // Підбір векторної іконки
          let iconHtml = '';
          if (quest.type === 'streak') iconHtml = iconFlame(26);
          else if (quest.type === 'growth') iconHtml = iconGrowth(26);
          else if (quest.type === 'manual') iconHtml = iconContrib(26);
          else iconHtml = `<span style="font-size: 24px;">${quest.icon || '🏆'}</span>`;

          const periodText = isLifetime ? 'за весь час' : (isWeekly ? 'цього тижня' : 'цього місяця');

          return `
            <div class="parchment-card" style="padding: 14px 16px;">
              <div class="flex justify-between items-start" style="gap: 8px;">
                <div class="flex items-start gap-sm">
                  <!-- Круглий золотий медальйон з іконкою -->
                  <div style="width: 44px; height: 44px; min-width: 44px; border-radius: 50%; background: radial-gradient(circle, #f9eed7 0%, #e8d2a7 100%); border: 1.5px solid var(--gold-deep); display: flex; align-items: center; justify-content: center; box-shadow: inset 0 1px 2px rgba(255,255,255,0.8), 0 2px 4px rgba(0,0,0,0.15);">
                    ${iconHtml}
                  </div>
                  <div>
                    <div style="font-weight: 700; font-size: 15px; color: var(--text-parchment); margin-bottom: 2px;">
                      ${quest.title || quest.name}
                    </div>
                    <div style="font-size: 12px; color: var(--text-parchment-muted); line-height: 1.35; max-width: 250px;">
                      ${desc}
                    </div>
                  </div>
                </div>

                <!-- Золотий бейдж нагороди +3 ✦ -->
                <div class="badge-gold" style="white-space: nowrap; font-size: 14px; padding: 4px 10px; border-radius: 14px;">
                  +${quest.reward} ✦
                </div>
              </div>

              <!-- Прогрес виконання -->
              <div style="margin-top: 10px;">
                <div class="flex justify-between" style="font-size: 11px; margin-bottom: 4px; color: var(--text-parchment-subtle);">
                  <span>${isDone ? (count >= limit ? 'Виконано ✓' : 'Ліміт зірок вичерпано') : `Прогрес ${periodText}:`}</span>
                  <span style="font-weight: 700; color: var(--text-parchment);">${isLifetime ? `${Math.min(progress, target)} / ${target}` : `${count} / ${limit}`}</span>
                </div>
                <div class="genshin-progress-track">
                  <div class="${isDone ? 'genshin-progress-fill-cyan' : 'genshin-progress-fill-gold'}" style="width: ${percent}%;"></div>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}
