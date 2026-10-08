import { fail } from './utils.js';

export function undoLast(p, op) {
  if (p.lastOp !== op.id) return fail('not-last');
  const profile = { ...structuredClone(p), ...structuredClone(op.prev), lastOp: null };
  return { ok: true, profile, delta: -op.delta, stockDelta: op.type === 'redeem' ? { [op.item]: op.qty } : {} };
}

// adjust: ±N ✦ з причиною (balance не може стати < 0); не змінює earned
export function adjust(p, amount, reason) {
  if (p.balance + amount < 0) return fail('negative');
  const prev = structuredClone(p);
  const next = structuredClone(p);
  next.balance += amount;
  return { ok: true, prev, profile: next, delta: amount, reason };
}
