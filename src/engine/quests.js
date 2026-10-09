import { kyivParts } from './time.js';
import { bump, snapshot } from './utils.js';
import {
  countWeeklyGrades,
  calculateStreak,
  calculatePeriodAverage,
  normalizeGrades
} from './economy.js';

function avg(arr) {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/**
 * Отримання ключа попереднього місяця у форматі YYMM (наприклад '2610' -> '2609', '2601' -> '2512').
 * @param {string} monthKey
 * @returns {string|null}
 */
export function getPreviousMonthKey(monthKey) {
  if (!monthKey || typeof monthKey !== 'string' || monthKey.length < 4) return null;
  const yy = parseInt(monthKey.slice(0, 2), 10);
  const mm = parseInt(monthKey.slice(2, 4), 10);
  if (isNaN(yy) || isNaN(mm)) return null;
  let prevY = yy;
  let prevM = mm - 1;
  if (prevM < 1) {
    prevM = 12;
    prevY = yy - 1;
  }
  return String(prevY).padStart(2, '0') + String(prevM).padStart(2, '0');
}

/**
 * Витягує список оцінок учня з профілю або контексту.
 * @param {object} p Профіль учня
 * @param {number|null} [fallbackGrade]
 * @param {number|null} [fallbackMs]
 * @returns {Array}
 */
export function getProfileGradeItems(p, fallbackGrade = null, fallbackMs = null) {
  let items = [];
  if (Array.isArray(p.grades) && p.grades.length > 0) {
    items = p.grades;
  } else if (Array.isArray(p.ledger) && p.ledger.length > 0) {
    items = p.ledger;
  } else if (Array.isArray(p.history) && p.history.length > 0) {
    items = p.history;
  } else if (Array.isArray(p.recent) && p.recent.length > 0) {
    items = p.recent.map((g, idx) => {
      if (typeof g === 'number') {
        return { grade: g, ts: fallbackMs ?? null, order: idx };
      }
      return g;
    });
  }
  return items;
}

/**
 * Чиста функція валідації квесту для перевірки прогресу учня у відповідному вікні часу (weekly/monthly).
 *
 * @param {object} p Профіль учня
 * @param {object} q Об'єкт конфігурації квесту
 * @param {object|number} [contextOrMs] Контекст або timestamp
 * @returns {{ eligible: boolean, progress: number, target: number, current: number, completed: boolean, limit: number, timesAwarded: number, limitReached: boolean, isWeekly: boolean, periodKey: string, percent: number }}
 */
export function validateQuest(p, q, contextOrMs = {}) {
  const context = typeof contextOrMs === 'number' ? { nowMs: contextOrMs } : (contextOrMs || {});
  const nowMs = context.nowMs ?? Date.now();
  const parts = kyivParts(nowMs);
  const targetMonth = context.month ?? parts.month;
  const targetWeek = context.week ?? parts.week;
  const targetDay = context.day ?? parts.day;
  const g = context.g ?? null;

  const isLifetime = q.type === 'lifetime_milestone' || q.period === 'lifetime';
  const isWeekly = !isLifetime && (q.period === 'weekly' || q.period === 'week' || q.perWeek != null);
  const periodKey = isLifetime ? 'lifetime' : (isWeekly ? targetWeek : targetMonth);
  const limit = isLifetime ? 1 : (isWeekly ? (q.perWeek ?? q.limit ?? 1) : (q.perMonth ?? q.limit ?? 1));
  const counters = (p.counters && p.counters[periodKey]) || {};
  const timesAwarded = isLifetime ? Math.max(counters[q.id] || 0, p.stats?.quests?.[q.id] || 0) : (counters[q.id] || 0);
  const isLimitReached = timesAwarded >= limit;

  // Нормалізовані оцінки учня
  const rawItems = context.items || getProfileGradeItems(p, g, nowMs);
  const items = normalizeGrades(rawItems);

  let eligible = false;
  let progress = 0;
  let target = 1;

  switch (q.type) {
    case 'weekly_count':
    case 'grade_count': {
      target = q.params?.count ?? q.params?.targetCount ?? 4;
      const weeklyCount = countWeeklyGrades(items, targetWeek);
      const effectiveCount = weeklyCount > 0 ? weeklyCount : (items.length > 0 && items.every(i => i.ts == null) ? items.length : 0);
      progress = effectiveCount;
      eligible = effectiveCount >= target;
      break;
    }

    case 'consecutive': {
      const minGrade = q.params?.minGrade ?? 7;
      target = q.params?.length ?? q.params?.targetLength ?? 3;
      const streak = calculateStreak(items, minGrade, target);
      progress = streak.current;
      eligible = streak.current >= target || streak.qualifies;
      break;
    }

    case 'streak': {
      if (q.params?.windowDays != null) {
        // Застарілий формат streak з вікном у днях (E8/E9)
        const hot = (p.hot || []).filter(d => targetDay - d < q.params.windowDays);
        progress = hot.length;
        target = q.params.length ?? 3;
        eligible = (g != null && g >= (q.params.minGrade ?? 8)) && (progress + 1 >= target);
      } else {
        const minGrade = q.params?.minGrade ?? 7;
        target = q.params?.length ?? q.params?.targetLength ?? 3;
        const streak = calculateStreak(items, minGrade, target);
        progress = streak.current;
        eligible = streak.current >= target || streak.qualifies;
      }
      break;
    }

    case 'target_grade':
    case 'grade':
    case 'score': {
      target = q.params?.grade ?? q.params?.exactGrade ?? q.params?.minGrade ?? 12;
      progress = g != null ? g : 0;
      eligible = g != null && g === target;
      break;
    }

    case 'monthly_growth':
    case 'period_growth': {
      const minTotal = q.params?.minTotalGrades ?? 10;
      const totalGrades = items.length || Object.values(p.stats?.gradeCount || {}).reduce((a, b) => a + b, 0);
      progress = totalGrades;
      target = minTotal;

      if (totalGrades >= minTotal) {
        const currStats = calculatePeriodAverage(items, { targetMonth: targetMonth });
        if (currStats.hasData && currStats.count > 0) {
          const prevMonth = getPreviousMonthKey(targetMonth);
          const prevStats = calculatePeriodAverage(items, { targetMonth: prevMonth });

          if (prevStats.hasData && prevStats.count > 0) {
            eligible = currStats.average > prevStats.average;
            progress = currStats.average;
            target = prevStats.average;
          } else {
            const priorItems = items.filter(x => x.ts != null && kyivParts(x.ts).month !== targetMonth && kyivParts(x.ts).month < targetMonth);
            const priorStats = calculatePeriodAverage(priorItems);
            if (priorStats.hasData && priorStats.count > 0) {
              eligible = currStats.average > priorStats.average;
              progress = currStats.average;
              target = priorStats.average;
            }
          }
        }
      }
      break;
    }

    case 'monthly_average':
    case 'period_average': {
      const minAvg = q.params?.minAverage ?? 10;
      target = minAvg;
      const currStats = calculatePeriodAverage(items, { targetMonth: targetMonth });
      progress = currStats.average;
      eligible = currStats.hasData && currStats.count >= (q.params?.minMonthlyGrades ?? 1) && currStats.average > minAvg;
      break;
    }

    case 'growth': {
      const { window = 10, minHistory = 5, delta = 2, minGrade = 7 } = q.params || {};
      const base = avg((p.recent || []).slice(-window));
      progress = p.recent ? p.recent.length : 0;
      target = minHistory;
      eligible = (p.recent || []).length >= minHistory && g != null && g >= minGrade && g >= base + delta;
      break;
    }

    case 'lifetime_milestone': {
      target = q.target ?? q.params?.target ?? 100;
      progress = p.earned || 0;
      eligible = progress >= target;
      break;
    }

    default:
      eligible = false;
      break;
  }

  const percent = target > 0 ? Math.min(100, Math.floor((progress / target) * 100)) : (eligible ? 100 : 0);

  return {
    eligible,
    progress,
    target,
    current: progress,
    completed: eligible,
    timesAwarded,
    limit,
    limitReached: isLimitReached,
    isWeekly,
    isLifetime,
    periodKey,
    percent
  };
}

export function runQuests(p, g, cfg, month, day, events, week, nowMs) {
  let bonus = 0;
  const currentMs = nowMs ?? Date.now();
  const quests = (cfg.quests || []).filter(q => q.active !== false);

  for (const q of quests) {
    if (q.type === 'manual') continue;

    // Сумісність: старий streak з p.hot
    if (q.type === 'streak' && q.params?.windowDays != null) {
      if (g >= q.params.minGrade) {
        p.hot = [...(p.hot || []).filter(d => day - d < q.params.windowDays), day];
        if (p.hot.length >= q.params.length) {
          p.hot = [];
          bonus += award(p, q, cfg, month, events, week);
        }
      }
      continue;
    }

    // Сумісність: старий growth з p.recent (базовий бал розраховується до додавання g)
    if (q.type === 'growth') {
      const { window = 10, minHistory = 5, delta = 2, minGrade = 7 } = q.params || {};
      const base = avg((p.recent || []).slice(-window));
      if ((p.recent || []).length >= minHistory && g >= minGrade && g >= base + delta) {
        bonus += award(p, q, cfg, month, events, week);
      }
      continue;
    }

    // Валідація нових типів квестів
    const validation = validateQuest(p, q, {
      g,
      nowMs: currentMs,
      month,
      day,
      week
    });

    if (validation.eligible) {
      bonus += award(p, q, cfg, month, events, week);
    }
  }

  // Оновлення p.recent для сумісності з growth
  const growthQuests = quests.filter(q => q.type === 'growth');
  const maxWindow = growthQuests.length > 0 ? Math.max(...growthQuests.map(q => q.params.window || 10)) : 10;
  p.recent = [...(p.recent || []), g].slice(-Math.max(maxWindow, 10));

  return bonus;
}

/** Нарахування квесту з урахуванням лімітів; повертає нараховану кількість ✦. Використовується і для manual-квестів. */
export function award(p, q, cfg, month, events, week) {
  const isLifetime = q.type === 'lifetime_milestone' || q.period === 'lifetime';
  const isWeekly = !isLifetime && (q.period === 'week' || q.period === 'weekly' || q.perWeek != null);
  const periodKey = isLifetime ? 'lifetime' : (isWeekly ? (week || month) : month);
  const limit = isLifetime ? 1 : (isWeekly ? (q.perWeek ?? q.limit ?? 1) : (q.perMonth ?? q.limit ?? 1));
  const cap = isLifetime ? Infinity : (isWeekly ? (cfg.questWeeklyCap ?? 15) : (cfg.questMonthlyCap ?? 30));

  if (!p.counters) p.counters = {};
  const c = (p.counters[periodKey] ??= {});
  const timesAwarded = isLifetime ? Math.max(c[q.id] ?? 0, p.stats?.quests?.[q.id] ?? 0) : (c[q.id] ?? 0);
  if (timesAwarded >= limit) return 0;
  const give = isLifetime ? q.reward : Math.min(q.reward, Math.max(cap - (c.questStars ?? 0), 0));
  if (give <= 0) return 0;
  c[q.id] = (c[q.id] ?? 0) + 1;
  if (!isLifetime) {
    c.questStars = (c.questStars ?? 0) + give;
  }
  p.balance += give; p.earned += give;
  bump(p.stats.quests, q.id);
  events.push({ quest: q.id, delta: give });
  return give;
}

/** Ручний квест («Внесок»): повертає Result з delta, prev, events. */
export function awardManual(p, questId, cfg, nowMs) {
  const q = cfg.quests.find(x => x.id === questId && x.type === 'manual');
  if (!q || !q.active) return { ok: false, reason: 'invalid-quest' };

  const { month, week } = kyivParts(nowMs);
  const next = structuredClone(p);
  const prev = snapshot(p);
  const events = [];

  const give = award(next, q, cfg, month, events, week);
  if (give === 0) return { ok: false, reason: 'limit' };

  return { ok: true, profile: next, delta: give, prev, events };
}

/**
 * Знаходить один незакритий квест з найвищим відсотком завершення для дашборду учня.
 * @param {object} p Профіль учня
 * @param {object} cfg Конфігурація системи (квести, ліміти)
 * @param {number} [nowMs] Поточний час
 * @returns {object|null}
 */
export function findNearestQuest(p, cfg, nowMs = Date.now()) {
  const quests = (cfg?.quests || (typeof window !== 'undefined' && window.zklas?.config?.quests) || []).filter(q => q.active !== false);
  if (!quests.length) return null;

  const { month, week } = kyivParts(nowMs);
  const weekCounters = (p?.counters && p.counters[week]) || {};
  const monthCounters = (p?.counters && p.counters[month]) || {};
  const lifetimeCounters = (p?.counters && p.counters['lifetime']) || {};

  const weekStars = weekCounters.questStars || 0;
  const weeklyCap = cfg?.questWeeklyCap ?? 6;
  const monthStars = monthCounters.questStars || 0;
  const monthlyCap = cfg?.questMonthlyCap ?? 8;

  const candidates = [];

  for (const q of quests) {
    const isLifetime = q.type === 'lifetime_milestone' || q.period === 'lifetime';
    const isWeekly = !isLifetime && (q.period === 'week' || q.period === 'weekly' || q.perWeek != null);
    const counters = isLifetime ? lifetimeCounters : (isWeekly ? weekCounters : monthCounters);
    const currentStars = isLifetime ? 0 : (isWeekly ? weekStars : monthStars);
    const currentCap = isLifetime ? Infinity : (isWeekly ? weeklyCap : monthlyCap);
    const limit = isLifetime ? 1 : (isWeekly ? (q.perWeek ?? q.limit ?? q.perMonth ?? 1) : (q.perMonth ?? q.limit ?? 1));
    const timesAwarded = isLifetime ? Math.max(counters[q.id] || 0, p?.stats?.quests?.[q.id] || 0) : (counters[q.id] || 0);

    // Якщо ліміт квесту або загальний ліміт зірок вичерпано — квест закритий
    if (timesAwarded >= limit || currentStars >= currentCap) {
      continue;
    }

    let progress = 0;
    let target = 1;
    let percent = 0;

    try {
      const val = validateQuest(p, q, { nowMs, month, week });
      progress = val.progress ?? 0;
      target = val.target ?? 1;
      percent = val.percent ?? 0;
    } catch {
      progress = isLifetime ? (p?.earned || 0) : (counters[q.id] || 0);
      target = isLifetime ? (q.target ?? 100) : limit;
      percent = target > 0 ? Math.min(100, Math.floor((progress / target) * 100)) : 0;
    }

    let desc = q.desc || q.description;
    if (!desc) {
      if (q.type === 'weekly_count' || q.type === 'grade_count') desc = 'Отримай 4 оцінки протягом тижня';
      else if (q.type === 'consecutive') desc = '3 оцінки від 7 балів поспіль';
      else if (q.type === 'target_grade' || q.type === 'grade') desc = 'Отримай оцінку 12';
      else if (q.type === 'monthly_growth') desc = 'Підвищ середній бал порівняно з минулим місяцем';
      else if (q.type === 'monthly_average') desc = 'Середній бал понад 10 протягом місяця';
      else if (q.type === 'growth') desc = 'Отримай оцінку, вищу за середній бал твоїх робіт';
      else if (q.type === 'streak') desc = '3 оцінки від 8 балів протягом 7 днів';
      else if (q.type === 'lifetime_milestone') desc = `Назбирай ${q.target ?? 100} зірочок за весь час`;
      else if (q.type === 'manual') desc = 'Корисна допомога класу або спільній справі';
      else desc = 'Спеціальне завдання';
    }

    candidates.push({
      quest: q,
      progress,
      target,
      percent,
      desc,
      reward: q.reward || 0,
      isWeekly,
      isLifetime
    });
  }

  if (candidates.length === 0) return null;

  // Обираємо квест з найвищим відсотком завершення (якщо однакові: за прогресом або нагородою)
  candidates.sort((a, b) => {
    if (b.percent !== a.percent) return b.percent - a.percent;
    if (b.progress !== a.progress) return b.progress - a.progress;
    return b.reward - a.reward;
  });

  return candidates[0];
}
