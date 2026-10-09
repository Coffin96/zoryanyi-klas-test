import { test, describe } from 'node:test';
import assert from 'node:assert';
import { kyivParts } from '../src/engine/time.js';
import { creditGrades } from '../src/engine/economy.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateQuest, getPreviousMonthKey, findNearestQuest } from '../src/engine/quests.js';
import { defaultConfig } from '../src/data/default-config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const questCfg = {
  settings: { dupWindowMin: 5, refPerStar: 0.321 },
  grades: { 12: 6, 11: 5, 10: 4, 9: 3, 8: 2, 7: 1, 6: 0 },
  questMonthlyCap: 30,
  questWeeklyCap: 15,
  quests: [
    {
      id: 'knowledge_gatherer',
      type: 'weekly_count',
      title: 'Збирач знань',
      period: 'weekly',
      active: true,
      reward: 3,
      perWeek: 1,
      params: { count: 4 }
    },
    {
      id: 'sequence',
      type: 'consecutive',
      title: 'Послідовність',
      period: 'weekly',
      active: true,
      reward: 3,
      perWeek: 1,
      params: { minGrade: 7, length: 3 }
    },
    {
      id: 'brilliant_result',
      type: 'target_grade',
      title: 'Блискучий результат',
      period: 'weekly',
      active: true,
      reward: 4,
      perWeek: 2,
      params: { grade: 12 }
    },
    {
      id: 'steady_step',
      type: 'monthly_growth',
      title: 'Впевнений крок',
      period: 'monthly',
      active: true,
      reward: 10,
      perMonth: 1,
      params: { minTotalGrades: 10 }
    },
    {
      id: 'holding_height',
      type: 'monthly_average',
      title: 'Утримання висоти',
      period: 'monthly',
      active: true,
      reward: 15,
      perMonth: 1,
      params: { minAverage: 10 }
    }
  ]
};

const emptyProfile = () => ({
  balance: 0,
  earned: 0,
  recent: [],
  grades: [],
  hot: [],
  last: null,
  lastOp: null,
  lastAt: {},
  stats: { gradeCount: {}, quests: {}, redeemed: {} },
  counters: {},
  achievements: []
});

describe('Expanded Quests System (Stage 3)', () => {
  describe('1. Допоміжні функції квестів', () => {
    test('getPreviousMonthKey: коректно обчислює попередній місяць', () => {
      assert.strictEqual(getPreviousMonthKey('2610'), '2609');
      assert.strictEqual(getPreviousMonthKey('2601'), '2512');
      assert.strictEqual(getPreviousMonthKey('2612'), '2611');
      assert.strictEqual(getPreviousMonthKey(null), null);
      assert.strictEqual(getPreviousMonthKey(''), null);
    });
  });

  describe('2. "Збирач знань" (weekly_count: 4 будь-які оцінки -> 3✦)', () => {
    test('Не спрацьовує при 1-3 оцінках за тиждень', () => {
      let p = emptyProfile();
      const t = Date.parse('2026-10-05T10:00:00Z'); // Понеділок тижня 26W41

      // 1-ша оцінка
      let res = creditGrades(p, [10], questCfg, t);
      p = res.profile;
      assert.strictEqual(res.events.some(e => e.quest === 'knowledge_gatherer'), false);

      // 2-га та 3-тя оцінка
      res = creditGrades(p, [8, 9], questCfg, t + 3600000);
      p = res.profile;
      assert.strictEqual(res.events.some(e => e.quest === 'knowledge_gatherer'), false);
    });

    test('Спрацьовує на 4-й оцінці за тиждень і дає +3✦', () => {
      let p = emptyProfile();
      const t = Date.parse('2026-10-05T10:00:00Z');

      const res = creditGrades(p, [10, 8, 9, 7], questCfg, t);
      // Оцінки: 10 (4✦) + 8 (2✦) + 9 (3✦) + 7 (1✦) = 10✦
      // Бонус квесту "Збирач знань" = +3✦
      // Разом дельта = 13✦
      assert.strictEqual(res.events.some(e => e.quest === 'knowledge_gatherer'), true);
      const ev = res.events.find(e => e.quest === 'knowledge_gatherer');
      assert.strictEqual(ev.delta, 3);
      assert.strictEqual(res.delta >= 13, true);
    });

    test('Ліміт 1 раз на тиждень: 5-та оцінка не нараховує повторний бонус', () => {
      let p = emptyProfile();
      const t = Date.parse('2026-10-05T10:00:00Z');

      let res = creditGrades(p, [10, 8, 9, 7], questCfg, t);
      p = res.profile;
      assert.strictEqual(res.events.some(e => e.quest === 'knowledge_gatherer'), true);

      // 5-та оцінка у той самий тиждень
      res = creditGrades(p, [10], questCfg, t + 7200000);
      assert.strictEqual(res.events.some(e => e.quest === 'knowledge_gatherer'), false);
    });

    test('Спрацьовує знову на наступному тижні', () => {
      let p = emptyProfile();
      const tWeek1 = Date.parse('2026-10-05T10:00:00Z'); // 26W41
      const tWeek2 = Date.parse('2026-10-12T10:00:00Z'); // 26W42

      let res = creditGrades(p, [10, 8, 9, 7], questCfg, tWeek1);
      p = res.profile;
      assert.strictEqual(res.events.some(e => e.quest === 'knowledge_gatherer'), true);

      // Наступного тижня: 4 оцінки
      res = creditGrades(p, [7, 7, 7, 7], questCfg, tWeek2);
      assert.strictEqual(res.events.some(e => e.quest === 'knowledge_gatherer'), true);
    });
  });

  describe('3. "Послідовність" (consecutive: 3 оцінки >= 7 поспіль -> 3✦)', () => {
    test('Не спрацьовує при менше 3 оцінок >= 7 поспіль', () => {
      const p = emptyProfile();
      const t = Date.parse('2026-10-05T10:00:00Z');

      const res = creditGrades(p, [6, 7, 8], questCfg, t);
      assert.strictEqual(res.events.some(e => e.quest === 'sequence'), false);
    });

    test('Спрацьовує при 3 оцінках >= 7 поспіль', () => {
      const p = emptyProfile();
      const t = Date.parse('2026-10-05T10:00:00Z');

      const res = creditGrades(p, [7, 8, 9], questCfg, t);
      assert.strictEqual(res.events.some(e => e.quest === 'sequence'), true);
      const ev = res.events.find(e => e.quest === 'sequence');
      assert.strictEqual(ev.delta, 3);
    });

    test('Оцінка нижче 7 скидає серію, але наступні 3 оцінки >= 7 активують квест', () => {
      const p = emptyProfile();
      const t = Date.parse('2026-10-05T10:00:00Z');

      // [7, 8, 6] -> серія скинута
      let res = creditGrades(p, [7, 8, 6], questCfg, t);
      assert.strictEqual(res.events.some(e => e.quest === 'sequence'), false);

      // [7, 9, 10] -> нова серія з трьох
      res = creditGrades(res.profile, [7, 9, 10], questCfg, t + 3600000);
      assert.strictEqual(res.events.some(e => e.quest === 'sequence'), true);
    });

    test('Ліміт 1 раз на тиждень діє для "Послідовність"', () => {
      let p = emptyProfile();
      const t = Date.parse('2026-10-05T10:00:00Z');

      let res = creditGrades(p, [7, 8, 9], questCfg, t);
      p = res.profile;
      assert.strictEqual(res.events.some(e => e.quest === 'sequence'), true);

      // 4-та оцінка підряд
      res = creditGrades(p, [10], questCfg, t + 3600000);
      assert.strictEqual(res.events.some(e => e.quest === 'sequence'), false);
    });
  });

  describe('4. "Блискучий результат" (target_grade: оцінка 12 -> 4✦, макс 2 рази/тижд)', () => {
    const brilliantCfg = {
      ...questCfg,
      quests: [questCfg.quests.find(q => q.id === 'brilliant_result')]
    };

    test('Оцінка 11 не активує квест', () => {
      const p = emptyProfile();
      const t = Date.parse('2026-10-05T10:00:00Z');

      const res = creditGrades(p, [11], brilliantCfg, t);
      assert.strictEqual(res.events.some(e => e.quest === 'brilliant_result'), false);
    });

    test('Перша оцінка 12 дає +4✦ бонус', () => {
      const p = emptyProfile();
      const t = Date.parse('2026-10-05T10:00:00Z');

      const res = creditGrades(p, [12], brilliantCfg, t);
      assert.strictEqual(res.events.some(e => e.quest === 'brilliant_result'), true);
      const ev = res.events.find(e => e.quest === 'brilliant_result');
      assert.strictEqual(ev.delta, 4);
      // 6 за оцінку 12 + 4 бонус = 10✦
      assert.strictEqual(res.delta, 10);
    });

    test('Друга оцінка 12 у той самий тиждень також нараховує +4✦', () => {
      let p = emptyProfile();
      const t = Date.parse('2026-10-05T10:00:00Z');

      let res = creditGrades(p, [12], brilliantCfg, t);
      p = res.profile;
      assert.strictEqual(res.events.some(e => e.quest === 'brilliant_result'), true);

      // Друга 12-ка
      res = creditGrades(p, [12], brilliantCfg, t + 3600000);
      p = res.profile;
      assert.strictEqual(res.events.some(e => e.quest === 'brilliant_result'), true);
      const ev2 = res.events.find(e => e.quest === 'brilliant_result');
      assert.strictEqual(ev2.delta, 4);
    });

    test('Третя оцінка 12 у той самий тиждень блокується лімітом 2 рази/тижд', () => {
      let p = emptyProfile();
      const t = Date.parse('2026-10-05T10:00:00Z');

      let res = creditGrades(p, [12, 12], brilliantCfg, t);
      p = res.profile;

      // Третя 12-ка
      res = creditGrades(p, [12], brilliantCfg, t + 7200000);
      assert.strictEqual(res.events.some(e => e.quest === 'brilliant_result'), false);
      // Тільки 6✦ за саму оцінку
      assert.strictEqual(res.delta, 6);
    });
  });

  describe('5. "Впевнений крок" (monthly_growth: середній бал місяця вищий за попередній + >= 10 оцінок -> 10✦)', () => {
    test('Не спрацьовує, якщо в базі менше 10 оцінок', () => {
      const p = emptyProfile();
      const tPrev = Date.parse('2026-09-15T10:00:00Z'); // Вересень (2609)
      const tCurr = Date.parse('2026-10-15T10:00:00Z'); // Жовтень (2610)

      // 4 оцінки у вересні (сер. 8.0)
      p.grades = [
        { grade: 8, ts: tPrev },
        { grade: 8, ts: tPrev },
        { grade: 8, ts: tPrev },
        { grade: 8, ts: tPrev }
      ];

      // 4 оцінки у жовтні (сер. 11.0) -> всього 8 оцінок (< 10)
      const res = creditGrades(p, [11, 11, 11, 11], questCfg, tCurr);
      assert.strictEqual(res.events.some(e => e.quest === 'steady_step'), false);
    });

    test('Не спрацьовує, якщо середній бал поточного місяця не вищий за попередній', () => {
      const p = emptyProfile();
      const tPrev = Date.parse('2026-09-15T10:00:00Z'); // Вересень
      const tCurr = Date.parse('2026-10-15T10:00:00Z'); // Жовтень

      // 6 оцінок у вересні (сер. 11.0)
      p.grades = [
        { grade: 11, ts: tPrev },
        { grade: 11, ts: tPrev },
        { grade: 11, ts: tPrev },
        { grade: 11, ts: tPrev },
        { grade: 11, ts: tPrev },
        { grade: 11, ts: tPrev }
      ];

      // 5 оцінок у жовтні (сер. 8.0) -> всього 11 оцінок, але сер. бал знизився
      const res = creditGrades(p, [8, 8, 8, 8, 8], questCfg, tCurr);
      assert.strictEqual(res.events.some(e => e.quest === 'steady_step'), false);
    });

    test('Спрацьовує, коли >= 10 оцінок і середній бал зріс порівняно з минулим місяцем', () => {
      const p = emptyProfile();
      const tPrev = Date.parse('2026-09-15T10:00:00Z'); // Вересень (сер. 8.0)
      const tCurr = Date.parse('2026-10-15T10:00:00Z'); // Жовтень

      // 6 оцінок по 8 у вересні
      p.grades = [
        { grade: 8, ts: tPrev },
        { grade: 8, ts: tPrev },
        { grade: 8, ts: tPrev },
        { grade: 8, ts: tPrev },
        { grade: 8, ts: tPrev },
        { grade: 8, ts: tPrev }
      ];

      // Додаємо 4 оцінки по 11 у жовтні -> всього 10 оцінок, сер. бал жовтня 11.0 > 8.0
      const res = creditGrades(p, [11, 11, 11, 11], questCfg, tCurr);
      assert.strictEqual(res.events.some(e => e.quest === 'steady_step'), true);
      const ev = res.events.find(e => e.quest === 'steady_step');
      assert.strictEqual(ev.delta, 10);
    });

    test('Ліміт 1 раз на місяць блокує повторне нарахування "Впевнений крок"', () => {
      const p = emptyProfile();
      const tPrev = Date.parse('2026-09-15T10:00:00Z');
      const tCurr = Date.parse('2026-10-15T10:00:00Z');

      p.grades = [
        { grade: 8, ts: tPrev },
        { grade: 8, ts: tPrev },
        { grade: 8, ts: tPrev },
        { grade: 8, ts: tPrev },
        { grade: 8, ts: tPrev },
        { grade: 8, ts: tPrev }
      ];

      let res = creditGrades(p, [11, 11, 11, 11], questCfg, tCurr);
      assert.strictEqual(res.events.some(e => e.quest === 'steady_step'), true);

      // Ще одна оцінка 11 у тому ж місяці
      res = creditGrades(res.profile, [11], questCfg, tCurr + 86400000);
      assert.strictEqual(res.events.some(e => e.quest === 'steady_step'), false);
    });
  });

  describe('6. "Утримання висоти" (monthly_average: середній бал > 10 протягом місяця -> 15✦)', () => {
    test('Не спрацьовує, якщо середній бал місяця <= 10', () => {
      const p = emptyProfile();
      const t = Date.parse('2026-10-15T10:00:00Z');

      const res = creditGrades(p, [10, 10, 9], questCfg, t); // сер. 9.7
      assert.strictEqual(res.events.some(e => e.quest === 'holding_height'), false);
    });

    test('Спрацьовує, коли середній бал місяця > 10 і дає +15✦', () => {
      const p = emptyProfile();
      const t = Date.parse('2026-10-15T10:00:00Z');

      const res = creditGrades(p, [11, 12, 11], questCfg, t); // сер. 11.3 > 10
      assert.strictEqual(res.events.some(e => e.quest === 'holding_height'), true);
      const ev = res.events.find(e => e.quest === 'holding_height');
      assert.strictEqual(ev.delta, 15);
    });

    test('Ліміт 1 раз на місяць діє для "Утримання висоти"', () => {
      const p = emptyProfile();
      const t = Date.parse('2026-10-15T10:00:00Z');

      let res = creditGrades(p, [11, 12, 11], questCfg, t);
      assert.strictEqual(res.events.some(e => e.quest === 'holding_height'), true);

      res = creditGrades(res.profile, [11], questCfg, t + 86400000);
      assert.strictEqual(res.events.some(e => e.quest === 'holding_height'), false);
    });
  });

  describe('7. Валідація квестів через validateQuest', () => {
    test('validateQuest повертає детальний об\'єкт прогресу', () => {
      const p = emptyProfile();
      const t = Date.parse('2026-10-05T10:00:00Z'); // 26W41
      p.grades = [
        { grade: 10, ts: t },
        { grade: 8, ts: t + 1000 }
      ];

      const qWeekly = questCfg.quests[0]; // knowledge_gatherer (ціль 4)
      const val = validateQuest(p, qWeekly, { nowMs: t });

      assert.strictEqual(val.isWeekly, true);
      assert.strictEqual(val.target, 4);
      assert.strictEqual(val.current, 2);
      assert.strictEqual(val.eligible, false);
      assert.strictEqual(val.percent, 50);
      assert.strictEqual(val.periodKey, '26W41');
    });

    test('validateQuest враховує ізоляцію тижнів', () => {
      const p = emptyProfile();
      const tWeek1 = Date.parse('2026-10-05T10:00:00Z'); // 26W41
      const tWeek2 = Date.parse('2026-10-15T10:00:00Z'); // 26W42

      p.grades = [
        { grade: 10, ts: tWeek1 },
        { grade: 10, ts: tWeek1 },
        { grade: 10, ts: tWeek1 },
        { grade: 10, ts: tWeek1 }
      ];

      const qWeekly = questCfg.quests[0];

      // Для тижня 1 умова виконана
      const valW1 = validateQuest(p, qWeekly, { nowMs: tWeek1 });
      assert.strictEqual(valW1.eligible, true);
      assert.strictEqual(valW1.current, 4);

      // Для тижня 2 оцінок немає
      const valW2 = validateQuest(p, qWeekly, { nowMs: tWeek2 });
      assert.strictEqual(valW2.eligible, false);
      assert.strictEqual(valW2.current, 0);
    });
  });

  describe('8. Комплексна робота та розділення weekly і monthly лічильників', () => {
    test('Правильно розділяє weekly (тижневі) та monthly (місячні) лічильники у counters', () => {
      let p = emptyProfile();
      const t = Date.parse('2026-10-05T10:00:00Z'); // Week 26W41, Month 2610

      // Зараховуємо [12]: повинно активувати "Блискучий результат" (weekly) та "Утримання висоти" (monthly)
      const res = creditGrades(p, [12], questCfg, t);
      p = res.profile;

      // Перевіряємо події
      const qIds = res.events.map(e => e.quest);
      assert.ok(qIds.includes('brilliant_result'), 'Повинно містити brilliant_result');
      assert.ok(qIds.includes('holding_height'), 'Повинно містити holding_height');

      // Перевіряємо розділення лічильників
      assert.strictEqual(p.counters['26W41']['brilliant_result'], 1);
      assert.strictEqual(p.counters['26W41'].questStars, 4);

      assert.strictEqual(p.counters['2610']['holding_height'], 1);
      assert.strictEqual(p.counters['2610'].questStars, 15);
    });
  });

  describe('9. Пасивна прогресія та квести життєвого циклу (lifetime_milestone) - Етап 5', () => {
    const lifetimeQuest100 = {
      id: 'lifetime_100',
      type: 'lifetime_milestone',
      title: 'Сотник зірок',
      target: 100,
      reward: 5,
      limit: 1,
      active: true,
      period: 'lifetime'
    };

    test('validateQuest: правильний розрахунок прогресу та цілі для lifetime_milestone', () => {
      const p = emptyProfile();
      p.earned = 45;

      const val = validateQuest(p, lifetimeQuest100);
      assert.strictEqual(val.isLifetime, true);
      assert.strictEqual(val.progress, 45);
      assert.strictEqual(val.target, 100);
      assert.strictEqual(val.percent, 45);
      assert.strictEqual(val.eligible, false);
      assert.strictEqual(val.completed, false);
      assert.strictEqual(val.limit, 1);
      assert.strictEqual(val.limitReached, false);
      assert.strictEqual(val.periodKey, 'lifetime');
    });

    test('validateQuest: квест виконано, коли profile.earned >= target', () => {
      const p = emptyProfile();
      p.earned = 100;

      const val = validateQuest(p, lifetimeQuest100);
      assert.strictEqual(val.progress, 100);
      assert.strictEqual(val.eligible, true);
      assert.strictEqual(val.completed, true);
      assert.strictEqual(val.percent, 100);
    });

    test('validateQuest: понад 100% прогресу обмежується 100% у percent', () => {
      const p = emptyProfile();
      p.earned = 150;

      const val = validateQuest(p, lifetimeQuest100);
      assert.strictEqual(val.progress, 150);
      assert.strictEqual(val.eligible, true);
      assert.strictEqual(val.percent, 100);
    });

    test('creditGrades: автоматично нагороджує при досягненні цілі', () => {
      let p = emptyProfile();
      p.earned = 95;
      p.balance = 50;

      const customCfg = {
        ...questCfg,
        quests: [...questCfg.quests, lifetimeQuest100]
      };

      const t = Date.parse('2026-10-05T10:00:00Z');
      // Оцінка 12 дає 6 зірок: 95 + 6 = 101 >= 100
      const res = creditGrades(p, [12], customCfg, t);
      p = res.profile;

      const lifetimeEv = res.events.find(e => e.quest === 'lifetime_100');
      assert.ok(lifetimeEv, 'Повинна бути подія виконання lifetime_100');
      assert.strictEqual(lifetimeEv.delta, 5);

      assert.strictEqual(p.counters.lifetime['lifetime_100'], 1);
      assert.strictEqual(p.stats.quests['lifetime_100'], 1);
      // Баланс: 50 + 6 (оцінка 12) + 4 (квест brilliant_result) + 15 (квест holding_height) + 5 (lifetime_100) = 80
      assert.strictEqual(p.balance, 80);
    });

    test('Одноразовість: повторне отримання оцінок не нараховує lifetime квест повторно', () => {
      let p = emptyProfile();
      p.earned = 95;
      p.balance = 50;

      const customCfg = {
        ...questCfg,
        quests: [...questCfg.quests, lifetimeQuest100]
      };

      const t = Date.parse('2026-10-05T10:00:00Z');
      let res = creditGrades(p, [12], customCfg, t);
      p = res.profile;
      assert.strictEqual(p.counters.lifetime['lifetime_100'], 1);

      // Наступна оцінка
      res = creditGrades(p, [10], customCfg, t + 3600000);
      p = res.profile;

      assert.strictEqual(res.events.some(e => e.quest === 'lifetime_100'), false);
      assert.strictEqual(p.counters.lifetime['lifetime_100'], 1);
    });

    test('findNearestQuest: знаходить незакритий lifetime_milestone за найвищим відсотком', () => {
      const p = emptyProfile();
      p.earned = 80;

      const cfgWithLifetime = {
        questWeeklyCap: 15,
        questMonthlyCap: 30,
        quests: [
          { id: 'q_far', type: 'target_grade', active: true, reward: 2, params: { grade: 12 } },
          lifetimeQuest100 // 80 / 100 = 80%
        ]
      };

      const nearest = findNearestQuest(p, cfgWithLifetime);
      assert.ok(nearest);
      assert.strictEqual(nearest.quest.id, 'lifetime_100');
      assert.strictEqual(nearest.percent, 80);
      assert.strictEqual(nearest.isLifetime, true);
    });

    test('firebase/seed/published.json та defaultConfig містять lifetime квести', () => {
      const publishedPath = path.resolve(__dirname, '../firebase/seed/published.json');
      const published = JSON.parse(fs.readFileSync(publishedPath, 'utf8'));

      const pubQuests = published.quests || [];
      const pubL100 = pubQuests.find(q => q.id === 'lifetime_100');
      assert.ok(pubL100, 'published.json повинен містити lifetime_100');
      assert.strictEqual(pubL100.type, 'lifetime_milestone');
      assert.strictEqual(pubL100.target, 100);
      assert.strictEqual(pubL100.reward, 5);

      const pubL50 = pubQuests.find(q => q.id === 'lifetime_50');
      assert.ok(pubL50, 'published.json повинен містити lifetime_50');
      assert.strictEqual(pubL50.type, 'lifetime_milestone');
      assert.strictEqual(pubL50.target, 50);

      const defQuests = defaultConfig.quests || [];
      const defL100 = defQuests.find(q => q.id === 'lifetime_100');
      assert.ok(defL100, 'defaultConfig повинен містити lifetime_100');
      assert.strictEqual(defL100.type, 'lifetime_milestone');
    });

    test('src/student/home.js містить підпис загалом здобутих зірок', () => {
      const homePath = path.resolve(__dirname, '../src/student/home.js');
      const homeSource = fs.readFileSync(homePath, 'utf8');

      assert.ok(
        homeSource.includes('Загалом здобуто за весь час: ${p.earned} ✦'),
        'home.js повинен містити підпис "Загалом здобуто за весь час: ${p.earned} ✦"'
      );
    });
  });
});
