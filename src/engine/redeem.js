import { kyivParts } from './time.js';
import { bump, snapshot, fail } from './utils.js';

export function redeem(p, item, qty, cfg, nowMs, stock) {
  const { month } = kyivParts(nowMs);
  if (!item || !item.active) return fail('inactive');
  if (qty < 1) return fail('qty');
  if (stock[item.id] != null && stock[item.id] < qty) return fail('out-of-stock');
  if (p.balance < item.price * qty) return fail('insufficient', { missing: item.price * qty - p.balance });
  
  const lim = item.limits ?? {};
  if (lim.perMonth && (p.counters[month]?.[item.id] ?? 0) + qty > lim.perMonth) return fail('limit-month');
  if (lim.cooldownDays) {
    const last = p.lastAt?.[item.id];
    if (last != null && nowMs - last < lim.cooldownDays * 86400000)
      return fail('cooldown', { availableAt: last + lim.cooldownDays * 86400000 });
    if (qty > 1) return fail('limit-month'); // cooldown дозволяє лише 1 за раз
  }
  
  const prev = snapshot(p);
  const next = structuredClone(p);
  const delta = -item.price * qty;
  
  next.balance += delta;
  (next.counters[month] ??= {})[item.id] = (next.counters[month][item.id] ?? 0) + qty;
  bump(next.stats.redeemed, item.id, qty);
  
  if (lim.cooldownDays) next.lastAt = { ...next.lastAt, [item.id]: nowMs };
  
  return { ok: true, profile: next, delta, prev, stockDelta: { [item.id]: -qty } };
}
