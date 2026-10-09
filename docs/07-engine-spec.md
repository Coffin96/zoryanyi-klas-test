# 07. Рушій (`src/engine`)

Чиста логіка: **без I/O, без DOM, без Firebase, без `Date.now()`**. Час передається параметром `nowMs`. Нижче еталонний код і контракти; агент може змінити реалізацію, але не поведінку (її фіксує таблиця тестів у розділі 7).

## 1. Типи (JSDoc)

```js
/** @typedef {{balance:number, earned:number, recent:number[], hot:number[], last:?{t:number,gs:number[]},
 *   lastOp:?string, lastAt:Object<string,number>, stats:{gradeCount:Object,quests:Object,redeemed:Object},
 *   counters:Object<string,Object>, achievements:string[]}} ProfileState */
/** @typedef {{ok:true, profile:ProfileState, delta:number, ...}|{ok:false, reason:string, ...}} Result */
```

Конфігурація (`cfg`) має форму `config/published` (`04-data-model.md`).

## 2. Час (`time.js`)

```js
const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit' });

/** Київська дата з мілісекунд. */
export function kyivParts(ms) {
  const [y, m, d] = fmt.format(ms).split('-').map(Number);          // 'YYYY-MM-DD'
  return {
    ymd: `${String(y).slice(2)}${String(m).padStart(2, '0')}${String(d).padStart(2, '0')}`,   // YYMMDD
    month: `${String(y).slice(2)}${String(m).padStart(2, '0')}`,                              // YYMM
    day: Math.floor(Date.UTC(y, m - 1, d) / 86400000),                                        // номер дня
  };
}
```

## 3. Зарахування (`economy.js`)

```js
export const snapshot = p => ({
  balance: p.balance, earned: p.earned, recent: [...p.recent], hot: [...p.hot], last: p.last,
  lastOp: p.lastOp ?? null, lastAt: { ...p.lastAt }, stats: structuredClone(p.stats),
  counters: structuredClone(p.counters), achievements: [...p.achievements],
});

/**
 * @param {ProfileState} p  поточний стан
 * @param {number[]} grades оцінки в порядку, у якому їх тапнув вчитель
 * @returns {{profile:ProfileState, entries:{g:number,v:number}[], events:object[], delta:number, prev:object}}
 */
export function creditGrades(p, grades, cfg, nowMs) {
  const { month, day } = kyivParts(nowMs);
  const next = structuredClone(p);
  const events = [], entries = [];
  const prev = snapshot(p);
  let delta = 0;
  for (const g of grades) {
    if (!(String(g) in cfg.grades)) throw new Error(`grade-not-allowed:${g}`);
    const v = cfg.grades[g];
    next.balance += v; next.earned += v; delta += v;
    bump(next.stats.gradeCount, g);
    entries.push({ g, v });
    delta += runQuests(next, g, cfg, month, day, events);
  }
  next.last = { t: nowMs, gs: [...grades] };
  return { profile: next, entries, events, delta, prev };
}

/** Чи схоже на повторне зарахування (м'яке застереження, не блокування). */
export const isRepeat = (p, grades, cfg, nowMs) =>
  !!p.last && nowMs - p.last.t < cfg.settings.dupWindowMin * 60000 && grades.some(g => p.last.gs.includes(g));
```

## 4. Квести (`quests.js`)

```js
function runQuests(p, g, cfg, month, day, events) {
  let bonus = 0;
  for (const q of cfg.quests.filter(q => q.active)) {
    if (q.type === 'growth') {
      const { window, minHistory, delta, minGrade } = q.params;
      const base = avg(p.recent.slice(-window));
      if (p.recent.length >= minHistory && g >= minGrade && g >= base + delta)
        bonus += award(p, q, cfg, month, events);
    }
    if (q.type === 'streak' && g >= q.params.minGrade) {
      p.hot = [...p.hot.filter(d => day - d < q.params.windowDays), day];
      if (p.hot.length >= q.params.length) { p.hot = []; bonus += award(p, q, cfg, month, events); }
    }
  }
  p.recent = [...p.recent, g].slice(-Math.max(...cfg.quests.filter(q => q.type === 'growth').map(q => q.params.window), 10));
  return bonus;
}

/** Нарахування квесту з урахуванням лімітів; повертає нараховану кількість ✦. Використовується і для manual-квестів. */
export function award(p, q, cfg, month, events) {
  const c = (p.counters[month] ??= {});
  if ((c[q.id] ?? 0) >= q.perMonth) return 0;
  const give = Math.min(q.reward, Math.max(cfg.questMonthlyCap - (c.questStars ?? 0), 0));
  if (give <= 0) return 0;
  c[q.id] = (c[q.id] ?? 0) + 1;
  c.questStars = (c.questStars ?? 0) + give;
  p.balance += give; p.earned += give;
  bump(p.stats.quests, q.id);
  events.push({ quest: q.id, delta: give });
  return give;
}

/** Ручний квест («Внесок»): повертає Result з delta, prev, events. */
export function awardManual(p, questId, cfg, nowMs) { /* знайти quest type==='manual', викликати award на клоні; reason:'limit' якщо give===0 */ }
```

Правила:
- **Зростання:** база = середнє останніх `window` оцінок **до** додавання нової; потрібна історія ≥ `minHistory`.
- **Активний тиждень:** лічильник днів `hot` зберігає номери київських днів оцінок ≥ `minGrade` за вікно `windowDays`; при досягненні `length` нагорода і очищення `hot`.
- Обидва квести застосовують `perMonth` і загальний `questMonthlyCap` (місяць = місяць зарахування за Києвом).

## 5. Списання, скасування, коригування

```js
// redeem.js
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
    if (qty > 1) return fail('limit-month');                     // cooldown дозволяє лише 1 за раз
  }
  const prev = snapshot(p), next = structuredClone(p);
  const delta = -item.price * qty;
  next.balance += delta;
  (next.counters[month] ??= {})[item.id] = (next.counters[month][item.id] ?? 0) + qty;
  bump(next.stats.redeemed, item.id, qty);
  if (lim.cooldownDays) next.lastAt = { ...next.lastAt, [item.id]: nowMs };
  return { ok: true, profile: next, delta, prev, stockDelta: { [item.id]: -qty } };
}

// undo.js — скасовується лише остання операція (p.lastOp === opId)
export function undoLast(p, op /* документ журналу з id */) {
  if (p.lastOp !== op.id) return fail('not-last');
  const profile = { ...structuredClone(p), ...structuredClone(op.prev), lastOp: null };
  return { ok: true, profile, delta: -op.delta, stockDelta: op.type === 'redeem' ? { [op.item]: op.qty } : {} };
}

// adjust: ±N ✦ з причиною (balance не може стати < 0); не змінює earned
export function adjust(p, amount, reason) { /* fail('negative') якщо balance+amount<0; повертає prev, delta */ }
```

**Примітка щодо `earned` при скасуванні:** `undoLast` відновлює повний знімок `prev`, тому `earned` повертається до попереднього значення автоматично.
**Після будь-якої операції** шар `data/tx.js` встановлює `profile.lastOp = opId`.

## 6. Допоміжні функції

| Функція | Призначення |
|---|---|
| `levelOf(earned, cfg)` | номер рівня за порогами |
| `progressTo(profile, item, cfg, nowMs)` | `{need, have, missing, canBuy, reason}`: скільки ✦ не вистачає, чи діє cooldown/ліміт/запас |
| `affordable(profile, cfg, nowMs, stock)` | список позицій магазину зі статусом доступності |
| `forecastDemand(profiles, cfg, nowMs, stock)` | верхня межа потреби: для кожного профілю найдорожча доступна нагорода (`sweet`), підсумок по позиціях |
| `budgetSummary({ledgers, cfg, from, to})` | видано по позиціях, вартість у грн, вартість зірки, порівняння зі «старою» системою |
| `validateConfig(cfg)` | список `{level:'error'\|'warn', path, msg}` (правила в `09-admin-panel.md`) |
| `recommendPrice(item, cfg)` | `round(unitCost / refPerStar × (1 − discount))` |
| `plural(n, forms)` | відмінювання («1 зірка, 2 зірки, 5 зірок, 11 зірок, 21 зірка») |

## 7. Тест-кейси (мінімум)

Базова конфігурація: `04-data-model.md §2`. «Порожній профіль» = `balance 0, earned 0, recent [], hot [], counters {}, stats {…}`.

| № | Вхід | Очікування |
|---|---|---|
| E1 | credit `[12]` на порожньому профілі | balance 6, earned 6, recent `[12]`, delta 6 |
| E2 | credit `[11, 9]` | balance 8, entries `[{11,5},{9,3}]` |
| E3 | credit `[6]` | помилка `grade-not-allowed:6` |
| E4 | Growth: recent `[8,8,9,8,8]` (середнє 8,2), credit `[10]` | бонусу немає (10 < 10,2) |
| E5 | Growth: ті самі recent, credit `[11]` | +3 ✦ бонус (11 ≥ 10,2), події містять `growth` |
| E6 | Growth: recent з 4 елементів, credit `[12]` | бонусу немає (історія < 5) |
| E7 | Growth ліміт: третє спрацювання за один місяць | бонус 0 (`perMonth` 2) |
| E8 | Streak: три оцінки ≥ 8 за 3 різні дні в межах 7 днів | +2 ✦ на третій; `hot` очищено |
| E9 | Streak: перша оцінка 9 днів тому, ще дві сьогодні | бонусу немає (вікно 7 днів) |
| E10 | Загальний ліміт: `questStars` 7, спрацював Growth (+3) | нараховано 1 ✦ (залишок ліміту) |
| E11 | Загальний ліміт вичерпано (8) | квест нічого не додає |
| E12 | `isRepeat`: `last = {t, gs:[11]}`, через 5 хв credit `[11]` | `true`; через 11 хв `false` |
| E13 | redeem caramel (7) при balance 20 | balance 13, `stockDelta {caramel:-1}` |
| E14 | redeem caramel при balance 6 | `insufficient`, `missing: 1` |
| E15 | redeem tartlet (17, cooldown 30) вперше | balance −17, `lastAt.tartlet = now` |
| E16 | redeem tartlet через 10 днів | `cooldown`, `availableAt` = last + 30 днів |
| E17 | redeem tartlet через 31 день | успіх |
| E18 | stock `{tartlet:0}`, redeem tartlet | `out-of-stock` |
| E19 | redeem `priv_music` двічі, третій раз у тому ж місяці | третій `limit-month` |
| E20 | undoLast після credit, `lastOp === op.id` | профіль = `prev`, `lastOp null` |
| E21 | undoLast, коли `lastOp` інший | `not-last` |
| E22 | undoLast після redeem tartlet | `lastAt` повернуто, баланс повернуто, `stockDelta {tartlet:+1}` |
| E23 | adjust −10 при balance 5 | помилка `negative` |
| E24 | `kyivParts`: 2026-10-24 21:30 UTC (Київ 00:30 25 жовтня, літній час закінчується 25.10.2026) | `ymd '261025'` |
| E25 | `kyivParts` через перехід на зимовий час | коректний номер дня, без дубля й пропуску |
| E26 | `plural` | 1 зірка; 2–4 зірки; 5, 11–14, 20 зірок; 21 зірка; 22 зірки; 111 зірок |
| E27 | `levelOf(29)`, `levelOf(30)`, `levelOf(400)` | 1, 2, 6 |
| E28 | `forecastDemand`: профіль з 20 ✦, у cooldown на тарталетку | передбачає желейку; тарталетка не рахується |
| E29 | `recommendPrice(tartlet)` | ≈ 47 ✦ (при refPerStar ≈ 0,321 і знижці 0) |
| E30 | `validateConfig` з дубльованим `id`, від'ємною ціною, `levels` без `min: 0` | помилки `error` для кожного |

**Властивісні тести (property-based за бажанням):** для будь-якої послідовності допустимих операцій `balance ≥ 0`; `credit` + `undoLast` повертає початковий стан; `Σ delta` журналу дорівнює `balance`.
