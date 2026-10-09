import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  normalizeGrades,
  parseGradeTimestamp,
  countWeeklyGrades,
  countGradesForWeek,
  calculateStreak,
  countConsecutiveGoodGrades,
  calculateGradeTrend,
  calculatePeriodAverage,
  levelOf,
  progressTo
} from '../src/engine/economy.js';
import { defaultConfig } from '../src/data/default-config.js';
import { validateConfig } from '../src/engine/helpers.js';

describe('Economy Grade Progression & Streak Logic (Stage 2)', () => {
  describe('1. Абсолютна відсутність оцінок (Empty / No Data)', () => {
    test('calculatePeriodAverage: повертає нульову статистику без помилок', () => {
      const resEmpty = calculatePeriodAverage([]);
      assert.strictEqual(resEmpty.hasData, false);
      assert.strictEqual(resEmpty.count, 0);
      assert.strictEqual(resEmpty.sum, 0);
      assert.strictEqual(resEmpty.average, 0);
      assert.strictEqual(resEmpty.rawAverage, 0);
      assert.strictEqual(resEmpty.min, 0);
      assert.strictEqual(resEmpty.max, 0);
      assert.strictEqual(resEmpty.trend, 'none');
      assert.strictEqual(resEmpty.trendLabel, 'Немає даних');
      assert.strictEqual(resEmpty.trendDelta, 0);

      // null та undefined
      assert.strictEqual(calculatePeriodAverage(null).hasData, false);
      assert.strictEqual(calculatePeriodAverage(undefined).hasData, false);
    });

    test('calculateStreak: повертає нульову серію при відсутності оцінок', () => {
      const streak = calculateStreak([]);
      assert.strictEqual(streak.current, 0);
      assert.strictEqual(streak.max, 0);
      assert.strictEqual(streak.qualifies, false);
      assert.strictEqual(streak.hasStreak, false);
      assert.deepStrictEqual(streak.grades, []);

      assert.strictEqual(countConsecutiveGoodGrades([]), 0);
      assert.strictEqual(countConsecutiveGoodGrades(null), 0);
    });

    test('countWeeklyGrades & countGradesForWeek: нульовий підрахунок при порожніх даних', () => {
      assert.strictEqual(countWeeklyGrades([], '26W41'), 0);
      assert.deepStrictEqual(countWeeklyGrades([]), {});
      assert.strictEqual(countGradesForWeek([], '26W41'), 0);
      assert.strictEqual(countGradesForWeek(null, '26W41'), 0);
    });

    test('calculateGradeTrend: тренд "none" при відсутності даних', () => {
      const trend = calculateGradeTrend([]);
      assert.strictEqual(trend.trend, 'none');
      assert.strictEqual(trend.trendLabel, 'Немає даних');
      assert.strictEqual(trend.delta, 0);
      assert.strictEqual(trend.hasData, false);
    });
  });

  describe('2. Падіння середнього балу (Downward Trend)', () => {
    test('calculateGradeTrend: фіксує падіння у динаміці оцінок', () => {
      // Початок: відмінні оцінки (11, 12, 11), кінець: спад (8, 7, 7)
      const grades = [11, 12, 11, 8, 7, 7];
      const trend = calculateGradeTrend(grades);

      assert.strictEqual(trend.hasData, true);
      assert.strictEqual(trend.trend, 'down');
      assert.strictEqual(trend.trendLabel, 'Потребує уваги');
      assert.ok(trend.delta < 0, `Очікується від'ємна дельта, отримано: ${trend.delta}`);
      assert.strictEqual(trend.recentAvg, 7.3); // (8 + 7 + 7) / 3 = 7.33
      assert.strictEqual(trend.baselineAvg, 11.3); // (11 + 12 + 11) / 3 = 11.33
    });

    test('calculatePeriodAverage: виявляє спад відносно базового рівня', () => {
      const lowerGrades = [7, 8, 7];
      const res = calculatePeriodAverage(lowerGrades, { baselineAverage: 10.5 });

      assert.strictEqual(res.hasData, true);
      assert.strictEqual(res.average, 7.3);
      assert.strictEqual(res.trend, 'down');
      assert.strictEqual(res.trendLabel, 'Потребує уваги');
      assert.strictEqual(res.trendDelta, -3.2); // 7.3 - 10.5 = -3.2
    });

    test('Порівняння середнього балу між двома періодами показує падіння', () => {
      const tWeek1 = Date.parse('2026-10-05T10:00:00Z');
      const tWeek2 = Date.parse('2026-10-12T10:00:00Z');

      const ledger = [
        { type: 'credit', entries: [{ g: 12 }, { g: 11 }], ts: tWeek1 },
        { type: 'credit', entries: [{ g: 7 }, { g: 8 }], ts: tWeek2 }
      ];

      const period1 = calculatePeriodAverage(ledger, { toMs: tWeek1 + 86400000 });
      const period2 = calculatePeriodAverage(ledger, { fromMs: tWeek2 - 86400000 });

      assert.strictEqual(period1.average, 11.5);
      assert.strictEqual(period2.average, 7.5);
      assert.ok(period2.average < period1.average, 'Середній бал другого періоду повинен бути нижчим');
    });
  });

  describe('3. Зростання середнього балу (Upward Trend)', () => {
    test('calculateGradeTrend: фіксує підйом у динаміці оцінок', () => {
      // Початок: оцінки (7, 8, 7), кінець: ріст (11, 12, 12)
      const grades = [7, 8, 7, 11, 12, 12];
      const trend = calculateGradeTrend(grades);

      assert.strictEqual(trend.hasData, true);
      assert.strictEqual(trend.trend, 'up');
      assert.strictEqual(trend.trendLabel, 'Зростання');
      assert.ok(trend.delta > 0, `Очікується додатна дельта, отримано: ${trend.delta}`);
      assert.strictEqual(trend.recentAvg, 11.7);
      assert.strictEqual(trend.baselineAvg, 7.3);
    });

    test('calculatePeriodAverage: виявляє підйом відносно базового рівня', () => {
      const higherGrades = [11, 12, 12];
      const res = calculatePeriodAverage(higherGrades, { baselineAverage: 8.0 });

      assert.strictEqual(res.hasData, true);
      assert.strictEqual(res.average, 11.7);
      assert.strictEqual(res.trend, 'up');
      assert.strictEqual(res.trendLabel, 'Зростання');
      assert.strictEqual(res.trendDelta, 3.7);
    });

    test('calculateGradeTrend: зростання для короткої серії з двох оцінок', () => {
      const trend = calculateGradeTrend([8, 12]);
      assert.strictEqual(trend.trend, 'up');
      assert.strictEqual(trend.trendLabel, 'Зростання');
      assert.strictEqual(trend.delta, 4.0);
    });
  });

  describe('4. Серія з 3+ оцінок високого рівня (Streaks)', () => {
    test('Рівно 3 оцінки високого рівня поспіль кваліфікуються як серія', () => {
      const grades = [10, 11, 12];
      const streak = calculateStreak(grades, 10, 3);

      assert.strictEqual(streak.current, 3);
      assert.strictEqual(streak.max, 3);
      assert.strictEqual(streak.qualifies, true);
      assert.strictEqual(streak.hasStreak, true);
      assert.strictEqual(countConsecutiveGoodGrades(grades, 10), 3);
    });

    test('4+ оцінки високого рівня поспіль збільшують серію', () => {
      const grades = [10, 10, 11, 12];
      const streak = calculateStreak(grades, 10, 3);

      assert.strictEqual(streak.current, 4);
      assert.strictEqual(streak.max, 4);
      assert.strictEqual(streak.qualifies, true);
      assert.strictEqual(streak.hasStreak, true);
    });

    test('Попередні нижчі оцінки не блокують подальшу серію 3+ оцінок', () => {
      const grades = [7, 8, 9, 10, 11, 12];
      const streak = calculateStreak(grades, 10, 3);

      assert.strictEqual(streak.current, 3);
      assert.strictEqual(streak.max, 3);
      assert.strictEqual(streak.qualifies, true);
      assert.strictEqual(streak.hasStreak, true);
      assert.strictEqual(countConsecutiveGoodGrades(grades, 10), 3);
    });

    test('Оцінка нижче порогу скидає поточну серію, але зберігає max', () => {
      // Серія була [10, 11, 12], потім 8
      const grades = [10, 11, 12, 8];
      const streak = calculateStreak(grades, 10, 3);

      assert.strictEqual(streak.current, 0); // Поточна активна серія обнулилась
      assert.strictEqual(streak.max, 3);     // Максимальна серія збереглася
      assert.strictEqual(streak.qualifies, false);
      assert.strictEqual(streak.hasStreak, true);

      assert.strictEqual(countConsecutiveGoodGrades(grades, 10, { mode: 'current' }), 0);
      assert.strictEqual(countConsecutiveGoodGrades(grades, 10, { mode: 'max' }), 3);
    });

    test('Перезапуск серії після спаду: правильний підрахунок поточної та максимальної', () => {
      const grades = [10, 11, 12, 8, 10, 11];
      const streak = calculateStreak(grades, 10, 3);

      assert.strictEqual(streak.current, 2); // Нова серія налічує 2
      assert.strictEqual(streak.max, 3);     // Рекордна серія була 3
      assert.strictEqual(streak.qualifies, false); // Поточна ще не досягла 3
      assert.strictEqual(streak.hasStreak, true);  // Але рекорд досяг 3
    });

    test('Працює з реальними транзакціями ledger', () => {
      const ledger = [
        { type: 'credit', entries: [{ g: 10, v: 4 }], ts: 1000 },
        { type: 'credit', entries: [{ g: 11, v: 5 }, { g: 12, v: 6 }], ts: 2000 }
      ];

      const streak = calculateStreak(ledger, 10, 3);
      assert.strictEqual(streak.current, 3);
      assert.strictEqual(streak.max, 3);
      assert.strictEqual(streak.qualifies, true);
    });
  });

  describe('5. Кількість оцінок за тиждень (Weekly Counts)', () => {
    test('Підрахунок кількості оцінок за кодом тижня та за timestamp', () => {
      const week1Ms = Date.parse('2026-10-05T12:00:00Z'); // Kyiv 26W41
      const week2Ms = Date.parse('2026-10-15T12:00:00Z'); // Kyiv 26W42

      const items = [
        { type: 'credit', entries: [{ g: 10 }, { g: 11 }], ts: week1Ms },
        { type: 'credit', entries: [{ g: 12 }], ts: week1Ms + 86400000 },
        { type: 'credit', entries: [{ g: 9 }, { g: 10 }], ts: week2Ms }
      ];

      // За кодом тижня
      assert.strictEqual(countWeeklyGrades(items, '26W41'), 3);
      assert.strictEqual(countWeeklyGrades(items, '26W42'), 2);
      assert.strictEqual(countWeeklyGrades(items, '26W40'), 0);

      // За timestamp
      assert.strictEqual(countWeeklyGrades(items, week1Ms), 3);
      assert.strictEqual(countWeeklyGrades(items, week2Ms), 2);

      // countGradesForWeek
      assert.strictEqual(countGradesForWeek(items, '26W41'), 3);
      assert.strictEqual(countGradesForWeek(items, '26W42'), 2);

      // Зведення по всіх тижнях
      const allCounts = countWeeklyGrades(items);
      assert.deepStrictEqual(allCounts, {
        '26W41': 3,
        '26W42': 2
      });
    });
  });

  describe('6. Розрахунок середнього балу за період (Period Average & Filtering)', () => {
    test('Фільтрація за часовими межами fromMs та toMs', () => {
      const items = [
        { grade: 8, ts: 1000 },
        { grade: 10, ts: 2000 },
        { grade: 12, ts: 3000 },
        { grade: 6, ts: 4000 }
      ];

      const res = calculatePeriodAverage(items, 2000, 3000);
      assert.strictEqual(res.hasData, true);
      assert.strictEqual(res.count, 2);
      assert.strictEqual(res.sum, 22);
      assert.strictEqual(res.average, 11.0);
      assert.strictEqual(res.min, 10);
      assert.strictEqual(res.max, 12);
    });

    test('Фільтрація за targetWeek', () => {
      const week1Ms = Date.parse('2026-10-05T12:00:00Z');
      const week2Ms = Date.parse('2026-10-15T12:00:00Z');

      const items = [
        { grade: 12, ts: week1Ms },
        { grade: 10, ts: week1Ms },
        { grade: 6, ts: week2Ms }
      ];

      const resWeek1 = calculatePeriodAverage(items, { targetWeek: '26W41' });
      assert.strictEqual(resWeek1.count, 2);
      assert.strictEqual(resWeek1.average, 11.0);

      const resWeek2 = calculatePeriodAverage(items, { targetWeek: '26W42' });
      assert.strictEqual(resWeek2.count, 1);
      assert.strictEqual(resWeek2.average, 6.0);
    });

    test('Нормалізація різних форматів часових міток (Firestore, ISO, Date)', () => {
      assert.strictEqual(parseGradeTimestamp(1728500000000), 1728500000000);
      assert.strictEqual(parseGradeTimestamp({ toMillis: () => 1728500000000 }), 1728500000000);
      assert.strictEqual(parseGradeTimestamp({ seconds: 1728500000, nanoseconds: 0 }), 1728500000000);
      assert.strictEqual(parseGradeTimestamp('2024-10-09T18:00:00.000Z'), Date.parse('2024-10-09T18:00:00.000Z'));
      assert.strictEqual(parseGradeTimestamp(null), null);
    });
  });

  describe('7. Розширення прогресії титулів (Stage 4 - Titles Progression)', () => {
    test('validateConfig: defaultConfig містить валідний масив рівнів з min: 0', () => {
      const errs = validateConfig(defaultConfig);
      assert.strictEqual(errs.length, 0);
      assert.strictEqual(defaultConfig.levels.length, 16);
      assert.strictEqual(defaultConfig.levels[0].min, 0);
      assert.strictEqual(defaultConfig.levels[defaultConfig.levels.length - 1].min, 10000);
    });

    test('levelOf: коректно визначає всі ранги від "Іскорка" до "Легенда Всесвіту"', () => {
      const expectations = [
        { earned: 0, expected: 'Іскорка' },
        { earned: 29, expected: 'Іскорка' },
        { earned: 30, expected: 'Зірка' },
        { earned: 79, expected: 'Зірка' },
        { earned: 80, expected: 'Сузір\'я' },
        { earned: 150, expected: 'Туманність' },
        { earned: 250, expected: 'Галактика' },
        { earned: 400, expected: 'Всесвіт' },
        { earned: 599, expected: 'Всесвіт' },
        { earned: 600, expected: 'Наднова' },
        { earned: 850, expected: 'Пульсар' },
        { earned: 1150, expected: 'Квазар' },
        { earned: 1500, expected: 'Астральний Вартовий' },
        { earned: 2000, expected: 'Магістр Ефіру' },
        { earned: 3000, expected: 'Астральний Лорд' },
        { earned: 4500, expected: 'Хранитель Селестії' },
        { earned: 6000, expected: 'Володар Зорепаду' },
        { earned: 8000, expected: 'Творець Ефіру' },
        { earned: 10000, expected: 'Легенда Всесвіту' },
        { earned: 25000, expected: 'Легенда Всесвіту' }
      ];

      for (const { earned, expected } of expectations) {
        const lvl = levelOf(earned, defaultConfig);
        assert.strictEqual(lvl.name, expected, `Ранг для ${earned} зірочок повинен бути "${expected}"`);
      }
    });

    test('progressTo: коректно обраховує прогрес між рангами', () => {
      // 0 зірок: прогрес до "Зірка" (поріг 30)
      const p0 = progressTo(0, defaultConfig);
      assert.strictEqual(p0.nextName, 'Зірка');
      assert.strictEqual(p0.remaining, 30);
      assert.strictEqual(p0.percent, 0);

      // 4500 зірок ("Хранитель Селестії"), наступний 6000 ("Володар Зорепаду", діапазон 1500)
      // При 5250 зароблених: половина діапазону (750 / 1500 = 50%)
      const pMid = progressTo(5250, defaultConfig);
      assert.strictEqual(pMid.nextName, 'Володар Зорепаду');
      assert.strictEqual(pMid.remaining, 750);
      assert.strictEqual(pMid.percent, 50);

      // 10000+ зірок: абсолютний максимум
      const pMax = progressTo(10000, defaultConfig);
      assert.strictEqual(pMax.nextName, 'Максимум');
      assert.strictEqual(pMax.remaining, 0);
      assert.strictEqual(pMax.percent, 100);

      const pBeyond = progressTo(15000, defaultConfig);
      assert.strictEqual(pBeyond.nextName, 'Максимум');
      assert.strictEqual(pBeyond.remaining, 0);
      assert.strictEqual(pBeyond.percent, 100);
    });
  });
});

