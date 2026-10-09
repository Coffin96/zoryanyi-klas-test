import { kyivParts } from './time.js';
import { bump, snapshot } from './utils.js';
import { runQuests } from './quests.js';

/**
 * @typedef {import('./utils.js').ProfileState} ProfileState
 */

/**
 * @param {ProfileState} p  поточний стан
 * @param {number[]} grades оцінки в порядку, у якому їх тапнув вчитель
 * @param {object} cfg конфігурація
 * @param {number} nowMs поточний час
 * @returns {{profile:ProfileState, entries:{g:number,v:number}[], events:object[], delta:number, prev:object}}
 */
export function creditGrades(p, grades, cfg, nowMs) {
  const { month, day, week } = kyivParts(nowMs);
  const next = structuredClone(p);
  const events = [];
  const entries = [];
  const prev = snapshot(p);
  let delta = 0;
  next.grades = Array.isArray(p.grades)
    ? [...p.grades]
    : (Array.isArray(p.ledger)
      ? [...p.ledger]
      : (Array.isArray(p.history) ? [...p.history] : []));
  for (const g of grades) {
    if (!(String(g) in cfg.grades)) throw new Error(`grade-not-allowed:${g}`);
    const v = cfg.grades[g];
    next.balance += v; next.earned += v; delta += v;
    bump(next.stats.gradeCount, g);
    entries.push({ g, v });
    next.grades.push({ grade: g, ts: nowMs });
    delta += runQuests(next, g, cfg, month, day, events, week, nowMs);
  }
  next.last = { t: nowMs, gs: [...grades] };
  return { profile: next, entries, events, delta, prev };
}

/** Чи схоже на повторне зарахування (м'яке застереження, не блокування). */
export const isRepeat = (p, grades, cfg, nowMs) =>
  !!p.last && nowMs - p.last.t < cfg.settings.dupWindowMin * 60000 && grades.some(g => p.last.gs.includes(g));

export function levelOf(earned, cfg) {
  const levels = cfg.levels || [];
  let current = levels[0] || { min: 0, name: 'Іскорка' };
  for (const lvl of levels) {
    if (earned >= lvl.min) current = lvl;
    else break;
  }
  return current;
}

export function progressTo(earned, cfg) {
  const levels = cfg.levels || [];
  let currentIdx = 0;
  for (let i = 0; i < levels.length; i++) {
    if (earned >= levels[i].min) currentIdx = i;
    else break;
  }
  const current = levels[currentIdx] || { min: 0, name: 'Іскорка' };
  const next = levels[currentIdx + 1];
  if (!next) {
    return { nextName: 'Максимум', remaining: 0, percent: 100 };
  }
  const range = next.min - current.min;
  const currentInRange = earned - current.min;
  const percent = range > 0 ? Math.min(100, Math.floor((currentInRange / range) * 100)) : 100;
  return {
    nextName: next.name,
    remaining: Math.max(0, next.min - earned),
    percent
  };
}

/**
 * Безпечний парсинг часу в ms (число, Date, Firestore Timestamp, ISO рядок).
 * Чиста функція без зовнішнього стану.
 * @param {any} ts
 * @returns {number|null}
 */
export function parseGradeTimestamp(ts) {
  if (ts == null) return null;
  if (typeof ts === 'number') return isNaN(ts) ? null : ts;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.seconds === 'number') {
    return ts.seconds * 1000 + (ts.nanoseconds ? Math.round(ts.nanoseconds / 1e6) : 0);
  }
  if (typeof ts === 'string') {
    const parsed = Date.parse(ts);
    return isNaN(parsed) ? null : parsed;
  }
  if (ts instanceof Date) return ts.getTime();
  return null;
}

/**
 * Нормалізація вхідного масиву оцінок або транзакцій у плоский список { grade, ts }.
 * Підтримує:
 * - прості числа [10, 11, 12]
 * - об'єкти { grade, ts } або { g, ts }
 * - транзакції ledger { type: 'credit', entries: [{ g: 11, v: 5 }], ts }
 *
 * @param {Array} items
 * @returns {Array<{grade: number, ts: number|null}>}
 */
export function normalizeGrades(items) {
  if (!Array.isArray(items)) return [];
  const result = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (typeof item === 'number') {
      if (!isNaN(item) && item >= 1 && item <= 12) {
        result.push({ grade: item, ts: null, order: i });
      }
    } else if (item && typeof item === 'object') {
      const ts = parseGradeTimestamp(item.ts ?? item.date ?? item.time);
      if (item.type === 'credit' && Array.isArray(item.entries)) {
        for (let j = 0; j < item.entries.length; j++) {
          const entry = item.entries[j];
          const g = Number(entry?.g ?? entry?.grade);
          if (!isNaN(g) && g >= 1 && g <= 12) {
            result.push({ grade: g, ts, order: i * 1000 + j });
          }
        }
      } else if (item.grade != null || item.g != null) {
        const g = Number(item.grade ?? item.g);
        if (!isNaN(g) && g >= 1 && g <= 12) {
          result.push({ grade: g, ts, order: i });
        }
      }
    }
  }

  // Якщо є часові мітки, сортуємо стабільно хронологічно
  const hasTs = result.some(r => r.ts != null);
  if (hasTs) {
    result.sort((a, b) => {
      const ta = a.ts ?? 0;
      const tb = b.ts ?? 0;
      return ta - tb || (a.order ?? 0) - (b.order ?? 0);
    });
  }

  return result.map(({ grade, ts }) => ({ grade, ts }));
}

/**
 * Підрахунок кількості оцінок за вказаний тиждень або мапа за всі тижні.
 *
 * @param {Array} items Масив оцінок або транзакцій
 * @param {string|number|null} [weekOrMs] Код тижня ('26W41') або часова мітка. Якщо null/undefined — повертає об'єкт { [week]: count }
 * @returns {number|Record<string, number>}
 */
export function countWeeklyGrades(items, weekOrMs) {
  const list = normalizeGrades(items);

  if (weekOrMs == null) {
    const counts = {};
    for (const item of list) {
      if (item.ts != null) {
        const w = kyivParts(item.ts).week;
        counts[w] = (counts[w] || 0) + 1;
      }
    }
    return counts;
  }

  const targetWeek = typeof weekOrMs === 'number' ? kyivParts(weekOrMs).week : String(weekOrMs);
  let count = 0;
  for (const item of list) {
    if (item.ts != null && kyivParts(item.ts).week === targetWeek) {
      count++;
    }
  }
  return count;
}

export const countGradesForWeek = (items, weekOrMs) => {
  if (weekOrMs == null) return 0;
  return countWeeklyGrades(items, weekOrMs);
};

/**
 * Аналіз серій хороших оцінок поспіль.
 *
 * @param {Array} items Масив оцінок або транзакцій
 * @param {number} [minGrade=10] Мінімальний бал для зарахування в серію (за замовчуванням 10 — високий рівень)
 * @param {number} [targetLength=3] Цільова довжина для кваліфікації серії (наприклад, 3)
 * @returns {{ current: number, max: number, minGrade: number, targetLength: number, qualifies: boolean, hasStreak: boolean, grades: number[] }}
 */
export function calculateStreak(items, minGrade = 10, targetLength = 3) {
  const list = normalizeGrades(items);
  const grades = list.map(x => x.grade);

  let current = 0;
  let max = 0;

  for (const g of grades) {
    if (g >= minGrade) {
      current++;
      if (current > max) max = current;
    } else {
      current = 0;
    }
  }

  return {
    current,
    max,
    minGrade,
    targetLength,
    qualifies: current >= targetLength,
    hasStreak: max >= targetLength,
    grades
  };
}

export const analyzeGradeStreak = calculateStreak;

/**
 * Підрахунок кількості хороших оцінок поспіль.
 *
 * @param {Array} items Масив оцінок або транзакцій
 * @param {number} [minGrade=10] Поріг оцінки (за замовчуванням 10)
 * @param {{ mode?: 'current'|'max', targetLength?: number }} [options] Опції
 * @returns {number} Кількість оцінок у серії
 */
export function countConsecutiveGoodGrades(items, minGrade = 10, options = {}) {
  const streak = calculateStreak(items, minGrade, options.targetLength ?? 3);
  return options.mode === 'max' ? streak.max : streak.current;
}

/**
 * Аналіз динаміки (тренду) оцінок: падіння, зростання або стабільність.
 *
 * @param {Array} items
 * @param {{ baselineAverage?: number, threshold?: number, window?: number }} [options]
 * @returns {{ trend: 'up'|'down'|'steady'|'none', trendLabel: string, delta: number, recentAvg: number, baselineAvg: number, hasData: boolean }}
 */
export function calculateGradeTrend(items, options = {}) {
  const list = normalizeGrades(items);
  const grades = list.map(x => x.grade);
  const threshold = options.threshold ?? 0.3;

  if (grades.length === 0) {
    return {
      trend: 'none',
      trendLabel: 'Немає даних',
      delta: 0,
      recentAvg: 0,
      baselineAvg: 0,
      hasData: false
    };
  }

  const overallAvg = grades.reduce((s, g) => s + g, 0) / grades.length;

  if (options.baselineAverage != null) {
    const delta = Math.round((overallAvg - options.baselineAverage) * 10) / 10;
    let trend = 'steady';
    let trendLabel = 'Стабільно';
    if (delta >= threshold) {
      trend = 'up';
      trendLabel = 'Зростання';
    } else if (delta <= -threshold) {
      trend = 'down';
      trendLabel = 'Потребує уваги';
    }
    return {
      trend,
      trendLabel,
      delta,
      recentAvg: Math.round(overallAvg * 10) / 10,
      baselineAvg: Math.round(options.baselineAverage * 10) / 10,
      hasData: true
    };
  }

  if (grades.length === 1) {
    return {
      trend: 'steady',
      trendLabel: 'Стабільно',
      delta: 0,
      recentAvg: grades[0],
      baselineAvg: grades[0],
      hasData: true
    };
  }

  const window = options.window ?? (grades.length >= 4 ? Math.min(3, Math.floor(grades.length / 2)) : 1);
  const recent = grades.slice(-window);
  const earlier = grades.slice(0, grades.length - window);

  const recentAvg = recent.reduce((s, g) => s + g, 0) / recent.length;
  const earlierAvg = earlier.reduce((s, g) => s + g, 0) / earlier.length;
  const delta = Math.round((recentAvg - earlierAvg) * 10) / 10;

  let trend = 'steady';
  let trendLabel = 'Стабільно';
  if (delta >= threshold) {
    trend = 'up';
    trendLabel = 'Зростання';
  } else if (delta <= -threshold) {
    trend = 'down';
    trendLabel = 'Потребує уваги';
  }

  return {
    trend,
    trendLabel,
    delta,
    recentAvg: Math.round(recentAvg * 10) / 10,
    baselineAvg: Math.round(earlierAvg * 10) / 10,
    hasData: true
  };
}

/**
 * Розрахунок середнього балу та статистики за вказаний період.
 *
 * @param {Array} items Масив оцінок або транзакцій
 * @param {object|number} [optionsOrFromMs] Об'єкт опцій або початковий timestamp fromMs
 * @param {number} [maybeToMs] Кінцевий timestamp toMs (якщо другий параметр був числом)
 * @returns {{ count: number, sum: number, average: number, rawAverage: number, hasData: boolean, min: number, max: number, trend: 'up'|'down'|'steady'|'none', trendLabel: string, trendDelta: number }}
 */
export function calculatePeriodAverage(items, optionsOrFromMs = {}, maybeToMs = null) {
  const options = typeof optionsOrFromMs === 'number'
    ? { fromMs: optionsOrFromMs, toMs: maybeToMs }
    : (optionsOrFromMs || {});

  const list = normalizeGrades(items);

  const filtered = list.filter(item => {
    if (options.fromMs != null && item.ts != null && item.ts < options.fromMs) return false;
    if (options.toMs != null && item.ts != null && item.ts > options.toMs) return false;
    if (options.targetWeek != null && item.ts != null) {
      if (kyivParts(item.ts).week !== options.targetWeek) return false;
    }
    if (options.targetMonth != null && item.ts != null) {
      if (kyivParts(item.ts).month !== options.targetMonth) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    return {
      count: 0,
      sum: 0,
      average: 0,
      rawAverage: 0,
      hasData: false,
      min: 0,
      max: 0,
      trend: 'none',
      trendLabel: 'Немає даних',
      trendDelta: 0
    };
  }

  const count = filtered.length;
  const sum = filtered.reduce((s, x) => s + x.grade, 0);
  const rawAverage = sum / count;
  const average = Math.round(rawAverage * 10) / 10;
  const min = Math.min(...filtered.map(x => x.grade));
  const max = Math.max(...filtered.map(x => x.grade));

  const trendInfo = calculateGradeTrend(filtered, {
    baselineAverage: options.baselineAverage,
    threshold: options.threshold
  });

  return {
    count,
    sum,
    average,
    rawAverage,
    hasData: true,
    min,
    max,
    trend: trendInfo.trend,
    trendLabel: trendInfo.trendLabel,
    trendDelta: trendInfo.delta
  };
}

export const calculateAverageForPeriod = calculatePeriodAverage;

