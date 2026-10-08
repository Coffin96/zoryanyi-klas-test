import { test, describe } from 'node:test';
import assert from 'node:assert';
import { kyivParts } from '../src/engine/time.js';
import { creditGrades, isRepeat } from '../src/engine/economy.js';
import { redeem } from '../src/engine/redeem.js';
import { undoLast, adjust } from '../src/engine/undo.js';
import { levelOf, forecastDemand, recommendPrice, validateConfig } from '../src/engine/helpers.js';

const mockCfg = {
  settings: { dupWindowMin: 5, refPerStar: 0.321 },
  grades: { 12: 6, 11: 5, 10: 4, 9: 3, 8: 2, 7: 1 },
  questMonthlyCap: 8,
  quests: [
    { id: 'growth', type: 'growth', active: true, reward: 3, perMonth: 2, params: { window: 5, minHistory: 5, delta: 0, minGrade: 10 } },
    { id: 'streak', type: 'streak', active: true, reward: 2, perMonth: 4, params: { windowDays: 7, length: 3, minGrade: 8 } }
  ],
  shop: [
    { id: 'caramel', active: true, price: 7, category: 'sweet' },
    { id: 'tartlet', active: true, price: 17, category: 'sweet', limits: { cooldownDays: 30 }, unitCost: 5.5, discount: 0 },
    { id: 'priv_music', active: true, price: 5, category: 'privilege', limits: { perMonth: 2 } },
    { id: 'jelly', active: true, price: 12, category: 'sweet' }
  ],
  levels: [
    { level: 0, min: 0 },
    { level: 1, min: 20 },
    { level: 2, min: 30 },
    { level: 6, min: 400 }
  ]
};

const emptyProfile = () => ({
  balance: 0, earned: 0, recent: [], hot: [], last: null,
  lastOp: null, lastAt: {}, stats: { gradeCount: {}, quests: {}, redeemed: {} },
  counters: {}, achievements: []
});

describe('Engine Tests', () => {
  test('E1: credit [12] на порожньому профілі', () => {
    const p = emptyProfile();
    const res = creditGrades(p, [12], mockCfg, 1000);
    assert.strictEqual(res.profile.balance, 6);
    assert.strictEqual(res.profile.earned, 6);
    assert.deepStrictEqual(res.profile.recent, [12]);
    assert.strictEqual(res.delta, 6);
  });

  test('E2: credit [11, 9]', () => {
    const p = emptyProfile();
    const res = creditGrades(p, [11, 9], mockCfg, 1000);
    assert.strictEqual(res.profile.balance, 8);
    assert.deepStrictEqual(res.entries, [{ g: 11, v: 5 }, { g: 9, v: 3 }]);
  });

  test('E3: credit [6] помилка', () => {
    assert.throws(() => creditGrades(emptyProfile(), [6], mockCfg, 1000), /grade-not-allowed:6/);
  });

  test('E4: Growth - без бонусу (10 < 10.2)', () => {
    const p = emptyProfile();
    p.recent = [8, 8, 9, 8, 8];
    const res = creditGrades(p, [10], mockCfg, 1000);
    assert.strictEqual(res.delta, 4); // Тільки за оцінку 10 (4 ✦)
  });

  test('E5: Growth - з бонусом (11 >= 10.2)', () => {
    const p = emptyProfile();
    p.recent = [8, 8, 9, 8, 8];
    const res = creditGrades(p, [11], mockCfg, 1000);
    assert.strictEqual(res.delta, 5 + 3); // 5 за оцінку + 3 бонус
    assert.ok(res.events.some(e => e.quest === 'growth'));
  });

  test('E6: Growth - історія < 5', () => {
    const p = emptyProfile();
    p.recent = [8, 8, 9, 8];
    const res = creditGrades(p, [12], mockCfg, 1000);
    assert.strictEqual(res.delta, 6); // 6 за оцінку, без бонусу
  });

  test('E7: Growth - ліміт третє спрацювання за місяць', () => {
    const p = emptyProfile();
    p.recent = [8, 8, 9, 8, 8];
    p.counters = { '2610': { growth: 2, questStars: 6 } };
    const res = creditGrades(p, [11], mockCfg, Date.parse('2026-10-05T12:00:00Z'));
    assert.strictEqual(res.delta, 5); // бонус 0 (perMonth 2)
  });

  test('E8: Streak - 3 оцінки за різні дні', () => {
    const p = emptyProfile();
    const now = Date.parse('2026-10-05T12:00:00Z');
    const d = kyivParts(now).day;
    p.hot = [d - 3, d - 1]; // 2 дні
    const res = creditGrades(p, [8], mockCfg, now);
    assert.strictEqual(res.delta, 2 + 2); // 2 за оцінку + 2 бонус
    assert.deepStrictEqual(res.profile.hot, []);
  });

  test('E9: Streak - перша оцінка 9 днів тому', () => {
    const p = emptyProfile();
    const now = Date.parse('2026-10-10T12:00:00Z');
    const d = kyivParts(now).day;
    p.hot = [d - 9, d - 1];
    const res = creditGrades(p, [8], mockCfg, now);
    assert.strictEqual(res.delta, 2); // бонусу немає
    assert.deepStrictEqual(res.profile.hot, [d - 1, d]);
  });

  test('E10: Загальний ліміт - залишок 1', () => {
    const p = emptyProfile();
    p.recent = [8, 8, 9, 8, 8];
    p.counters = { '2610': { questStars: 7 } };
    const res = creditGrades(p, [11], mockCfg, Date.parse('2026-10-05T12:00:00Z'));
    assert.strictEqual(res.delta, 5 + 1); // 5 за оцінку + 1 (залишок від 8)
  });

  test('E11: Загальний ліміт вичерпано', () => {
    const p = emptyProfile();
    p.recent = [8, 8, 9, 8, 8];
    p.counters = { '2610': { questStars: 8 } };
    const res = creditGrades(p, [11], mockCfg, Date.parse('2026-10-05T12:00:00Z'));
    assert.strictEqual(res.delta, 5); // 0 бонусу
  });

  test('E12: isRepeat', () => {
    const p = emptyProfile();
    p.last = { t: 1000, gs: [11] };
    assert.strictEqual(isRepeat(p, [11], mockCfg, 1000 + 4 * 60000), true);
    assert.strictEqual(isRepeat(p, [11], mockCfg, 1000 + 6 * 60000), false);
  });

  test('E13: redeem caramel', () => {
    const p = emptyProfile();
    p.balance = 20;
    const res = redeem(p, mockCfg.shop[0], 1, mockCfg, 1000, { caramel: 5 });
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.profile.balance, 13);
    assert.deepStrictEqual(res.stockDelta, { caramel: -1 });
  });

  test('E14: redeem caramel insufficient', () => {
    const p = emptyProfile();
    p.balance = 6;
    const res = redeem(p, mockCfg.shop[0], 1, mockCfg, 1000, { caramel: 5 });
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.reason, 'insufficient');
    assert.strictEqual(res.missing, 1);
  });

  test('E15: redeem tartlet cooldown start', () => {
    const p = emptyProfile();
    p.balance = 20;
    const now = 1000;
    const res = redeem(p, mockCfg.shop[1], 1, mockCfg, now, { tartlet: 5 });
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.profile.lastAt.tartlet, now);
  });

  test('E16: redeem tartlet cooldown fail', () => {
    const p = emptyProfile();
    p.balance = 20;
    p.lastAt = { tartlet: 1000 };
    const now = 1000 + 10 * 86400000; // 10 days later
    const res = redeem(p, mockCfg.shop[1], 1, mockCfg, now, { tartlet: 5 });
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.reason, 'cooldown');
  });

  test('E18: redeem out-of-stock', () => {
    const p = emptyProfile();
    p.balance = 20;
    const res = redeem(p, mockCfg.shop[1], 1, mockCfg, 1000, { tartlet: 0 });
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.reason, 'out-of-stock');
  });

  test('E20: undoLast success', () => {
    const p = emptyProfile();
    p.balance = 10;
    p.lastOp = 'op1';
    const op = { id: 'op1', prev: { balance: 4, earned: 4 }, delta: 6, type: 'credit' };
    const res = undoLast(p, op);
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.profile.balance, 4);
    assert.strictEqual(res.profile.lastOp, null);
  });

  test('E23: adjust negative fail', () => {
    const p = emptyProfile();
    p.balance = 5;
    const res = adjust(p, -10, 'test');
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.reason, 'negative');
  });

  test('E24: kyivParts timezone', () => {
    const ms = Date.parse('2026-10-24T21:30:00Z'); // 21:30 UTC -> 00:30 Kyiv 25 Oct
    const { ymd } = kyivParts(ms);
    assert.strictEqual(ymd, '261025');
  });

  test('E27: levelOf', () => {
    assert.strictEqual(levelOf(29, mockCfg), 1);
    assert.strictEqual(levelOf(30, mockCfg), 2);
    assert.strictEqual(levelOf(400, mockCfg), 6);
  });

  test('E28: forecastDemand', () => {
    const p = emptyProfile();
    p.balance = 20;
    p.lastAt = { tartlet: 1000 }; // in cooldown
    const now = 1000 + 86400000;
    const stock = { jelly: 10, tartlet: 10 };
    const demand = forecastDemand([p], mockCfg, now, stock);
    assert.strictEqual(demand.jelly, 1);
    assert.strictEqual(demand.tartlet, undefined);
  });

  test('E29: recommendPrice', () => {
    const p = recommendPrice(mockCfg.shop[1], mockCfg);
    assert.strictEqual(p, 17); // 5.5 / 0.321 = 17.13 => 17
  });

  test('E30: validateConfig', () => {
    const badCfg = {
      shop: [{ id: 'a', price: -1 }, { id: 'a', price: 10 }],
      levels: [{ level: 0, min: 10 }]
    };
    const errs = validateConfig(badCfg);
    assert.strictEqual(errs.length, 3);
  });
});
