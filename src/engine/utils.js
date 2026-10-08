export function bump(obj, key, amount = 1) {
  obj[key] = (obj[key] ?? 0) + amount;
}

export function snapshot(p) {
  return {
    balance: p.balance, earned: p.earned, recent: [...p.recent], hot: [...p.hot], last: p.last,
    lastOp: p.lastOp ?? null, lastAt: { ...p.lastAt }, stats: structuredClone(p.stats),
    counters: structuredClone(p.counters), achievements: [...p.achievements]
  };
}

export function fail(reason, extra = {}) {
  return { ok: false, reason, ...extra };
}
