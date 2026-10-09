import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  parseTimestamp,
  extractGradeHistory,
  calculateGradeStats,
  renderProgressionChartSvg,
  renderGradeDistributionHtml,
  renderEmptyStatsHtml
} from '../src/student/stats.js';

describe('Student Stats & Progression Tests', () => {
  test('parseTimestamp handles numbers, dates, objects, and strings', () => {
    const now = 1728500000000;
    assert.strictEqual(parseTimestamp(now), now);
    assert.strictEqual(parseTimestamp(new Date(now)), now);
    assert.strictEqual(parseTimestamp({ toMillis: () => now }), now);
    assert.strictEqual(parseTimestamp({ seconds: 1728500000, nanoseconds: 0 }), 1728500000000);
    assert.strictEqual(parseTimestamp('2024-10-09T18:00:00.000Z'), Date.parse('2024-10-09T18:00:00.000Z'));
  });

  test('extractGradeHistory: returns empty array on empty input', () => {
    assert.deepStrictEqual(extractGradeHistory([]), []);
    assert.deepStrictEqual(extractGradeHistory(null), []);
    assert.deepStrictEqual(extractGradeHistory(undefined), []);
  });

  test('extractGradeHistory: ignores non-credit entries', () => {
    const ledger = [
      { id: '1', type: 'redeem', item: 'caramel', delta: -7, ts: 1000 },
      { id: '2', type: 'quest', quest: 'streak', delta: 2, ts: 2000 },
      { id: '3', type: 'adjust', delta: 5, ts: 3000 }
    ];
    const res = extractGradeHistory(ledger);
    assert.strictEqual(res.length, 0);
  });

  test('extractGradeHistory: correctly extracts and sorts credit entries chronologically', () => {
    const ledger = [
      { id: 'op2', type: 'credit', delta: 5, ts: 200000, entries: [{ g: 11, v: 5 }] },
      { id: 'op1', type: 'credit', delta: 4, ts: 100000, entries: [{ g: 10, v: 4 }] },
      { id: 'op3', type: 'credit', delta: 6, ts: 300000, entries: [{ g: 12, v: 6 }] }
    ];

    const history = extractGradeHistory(ledger);
    assert.strictEqual(history.length, 3);
    assert.strictEqual(history[0].grade, 10);
    assert.strictEqual(history[1].grade, 11);
    assert.strictEqual(history[2].grade, 12);

    // Cumulative averages
    assert.strictEqual(history[0].cumAvg, 10.0);
    assert.strictEqual(history[1].cumAvg, 10.5); // (10 + 11) / 2
    assert.strictEqual(history[2].cumAvg, 11.0); // (10 + 11 + 12) / 3
  });

  test('extractGradeHistory: handles multiple grades within one credit transaction', () => {
    const ledger = [
      { id: 'op1', type: 'credit', delta: 9, ts: 100000, entries: [{ g: 10, v: 4 }, { g: 11, v: 5 }] }
    ];

    const history = extractGradeHistory(ledger);
    assert.strictEqual(history.length, 2);
    assert.strictEqual(history[0].grade, 10);
    assert.strictEqual(history[1].grade, 11);
    assert.strictEqual(history[0].index, 1);
    assert.strictEqual(history[1].index, 2);
    assert.strictEqual(history[1].cumAvg, 10.5);
  });

  test('calculateGradeStats: calculates average, min, max, stars from history', () => {
    const history = [
      { grade: 10, stars: 4 },
      { grade: 12, stars: 6 },
      { grade: 8, stars: 2 }
    ];

    const stats = calculateGradeStats(history);
    assert.strictEqual(stats.hasData, true);
    assert.strictEqual(stats.totalCount, 3);
    assert.strictEqual(stats.totalSum, 30);
    assert.strictEqual(stats.averageGrade, 10.0); // 30 / 3
    assert.strictEqual(stats.minGrade, 8);
    assert.strictEqual(stats.maxGrade, 12);
    assert.strictEqual(stats.totalStars, 12);
  });

  test('calculateGradeStats: fallback to profileStats when history is empty', () => {
    const profileStats = {
      gradeCount: {
        '12': 2,
        '10': 2
      }
    };

    const stats = calculateGradeStats([], profileStats);
    assert.strictEqual(stats.hasData, true);
    assert.strictEqual(stats.totalCount, 4);
    assert.strictEqual(stats.totalSum, 44); // 12*2 + 10*2
    assert.strictEqual(stats.averageGrade, 11.0);
    assert.strictEqual(stats.minGrade, 10);
    assert.strictEqual(stats.maxGrade, 12);
  });

  test('calculateGradeStats: returns hasData: false when no data exists', () => {
    const stats = calculateGradeStats([], null);
    assert.strictEqual(stats.hasData, false);
    assert.strictEqual(stats.totalCount, 0);
    assert.strictEqual(stats.averageGrade, 0);
    assert.strictEqual(stats.minGrade, 0);
    assert.strictEqual(stats.maxGrade, 0);
  });

  test('calculateGradeStats: calculates distribution array', () => {
    const history = [
      { grade: 12, stars: 6 },
      { grade: 12, stars: 6 },
      { grade: 10, stars: 4 }
    ];

    const stats = calculateGradeStats(history);
    const item12 = stats.distribution.find(d => d.grade === 12);
    const item10 = stats.distribution.find(d => d.grade === 10);

    assert.ok(item12);
    assert.strictEqual(item12.count, 2);
    assert.strictEqual(item12.percent, 67); // 2/3 ≈ 67%

    assert.ok(item10);
    assert.strictEqual(item10.count, 1);
    assert.strictEqual(item10.percent, 33); // 1/3 ≈ 33%
  });

  test('calculateGradeStats: detects upward and downward trends', () => {
    // Upward trend: recent grades (11, 12, 12) avg 11.67 vs overall avg 10.2
    const upHistory = [
      { grade: 8, stars: 2 },
      { grade: 8, stars: 2 },
      { grade: 11, stars: 5 },
      { grade: 12, stars: 6 },
      { grade: 12, stars: 6 }
    ];
    const upStats = calculateGradeStats(upHistory);
    assert.strictEqual(upStats.trend, 'up');
    assert.strictEqual(upStats.trendLabel, 'Зростання');

    // Downward trend: recent grades (8, 7, 7) avg 7.33 vs overall avg 9.6
    const downHistory = [
      { grade: 12, stars: 6 },
      { grade: 12, stars: 6 },
      { grade: 8, stars: 2 },
      { grade: 7, stars: 1 },
      { grade: 7, stars: 1 }
    ];
    const downStats = calculateGradeStats(downHistory);
    assert.strictEqual(downStats.trend, 'down');
    assert.strictEqual(downStats.trendLabel, 'Потребує уваги');
  });

  test('renderProgressionChartSvg: returns valid SVG string with viewBox and axes', () => {
    const history = [
      { grade: 10, cumAvg: 10, dateStr: '1 жов', fullDateStr: '1 жовт' },
      { grade: 12, cumAvg: 11, dateStr: '3 жов', fullDateStr: '3 жовт' }
    ];
    const stats = calculateGradeStats(history);
    const svg = renderProgressionChartSvg(history, stats);

    assert.ok(svg.startsWith('<svg'));
    assert.ok(svg.endsWith('</svg>'));
    assert.ok(svg.includes('viewBox="0 0 520 230"'));
    assert.ok(svg.includes('polyline points='));
    assert.ok(svg.includes('zk-line-gold'));
    assert.ok(svg.includes('Сер: 11'));
  });

  test('renderProgressionChartSvg: returns empty string when no data', () => {
    const stats = calculateGradeStats([]);
    const svg = renderProgressionChartSvg([], stats);
    assert.strictEqual(svg, '');
  });

  test('renderGradeDistributionHtml: renders bars for grades', () => {
    const history = [{ grade: 11, stars: 5 }, { grade: 10, stars: 4 }];
    const stats = calculateGradeStats(history);
    const html = renderGradeDistributionHtml(stats);

    assert.ok(html.includes('stats-distribution-grid'));
    assert.ok(html.includes('stats-dist-row'));
    assert.ok(html.includes('11'));
    assert.ok(html.includes('10'));
  });

  test('renderEmptyStatsHtml: renders styled Genshin empty placeholder', () => {
    const html = renderEmptyStatsHtml();
    assert.ok(html.includes('Немає даних'));
    assert.ok(html.includes('surface-card'));
    assert.ok(html.includes('fantasy-title'));
  });
});
