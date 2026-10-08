import { kyivParts } from './time.js';
import { bump, snapshot } from './utils.js';

function avg(arr) {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export function runQuests(p, g, cfg, month, day, events, week) {
  let bonus = 0;
  for (const q of cfg.quests.filter(q => q.active)) {
    if (q.type === 'growth') {
      const { window, minHistory, delta, minGrade } = q.params;
      const base = avg(p.recent.slice(-window));
      if (p.recent.length >= minHistory && g >= minGrade && g >= base + delta)
        bonus += award(p, q, cfg, month, events, week);
    }
    if (q.type === 'streak' && g >= q.params.minGrade) {
      p.hot = [...p.hot.filter(d => day - d < q.params.windowDays), day];
      if (p.hot.length >= q.params.length) { p.hot = []; bonus += award(p, q, cfg, month, events, week); }
    }
  }
  
  const growthQuests = cfg.quests.filter(q => q.type === 'growth');
  const maxWindow = growthQuests.length > 0 ? Math.max(...growthQuests.map(q => q.params.window)) : 10;
  p.recent = [...p.recent, g].slice(-Math.max(maxWindow, 10));
  
  return bonus;
}

/** Нарахування квесту з урахуванням лімітів; повертає нараховану кількість ✦. Використовується і для manual-квестів. */
export function award(p, q, cfg, month, events, week) {
  const isWeekly = q.period === 'week' || q.perWeek != null;
  const periodKey = isWeekly ? (week || month) : month;
  const limit = isWeekly ? (q.perWeek ?? q.perMonth ?? 2) : (q.perMonth ?? 2);
  const cap = isWeekly ? (cfg.questWeeklyCap ?? 6) : (cfg.questMonthlyCap ?? 8);

  const c = (p.counters[periodKey] ??= {});
  if ((c[q.id] ?? 0) >= limit) return 0;
  const give = Math.min(q.reward, Math.max(cap - (c.questStars ?? 0), 0));
  if (give <= 0) return 0;
  c[q.id] = (c[q.id] ?? 0) + 1;
  c.questStars = (c.questStars ?? 0) + give;
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
