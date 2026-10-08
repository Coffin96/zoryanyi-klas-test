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
  for (const g of grades) {
    if (!(String(g) in cfg.grades)) throw new Error(`grade-not-allowed:${g}`);
    const v = cfg.grades[g];
    next.balance += v; next.earned += v; delta += v;
    bump(next.stats.gradeCount, g);
    entries.push({ g, v });
    delta += runQuests(next, g, cfg, month, day, events, week);
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
