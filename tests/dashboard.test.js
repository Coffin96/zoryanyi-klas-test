import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getWishlist, saveWishlist, renderShop } from '../src/student/shop.js';
import { findNearestQuest } from '../src/engine/quests.js';
import { kyivParts } from '../src/engine/time.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In-memory localStorage mock for Node test runner
class MockLocalStorage {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] ?? null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

globalThis.localStorage = new MockLocalStorage();

describe('Stage 4: Student Dynamic Dashboard & Wishlist Tests', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
  });

  describe('1. Wishlist Logic in shop.js', () => {
    test('getWishlist returns empty array when nothing is stored', () => {
      assert.deepStrictEqual(getWishlist(), []);
    });

    test('saveWishlist and getWishlist persist and retrieve items in localStorage', () => {
      saveWishlist(['candy', 'sticker']);
      assert.deepStrictEqual(getWishlist(), ['candy', 'sticker']);
      assert.strictEqual(globalThis.localStorage.getItem('wishlist'), JSON.stringify(['candy', 'sticker']));
    });

    test('getWishlist safely handles corrupted JSON in localStorage', () => {
      globalThis.localStorage.setItem('wishlist', 'invalid-json{{{');
      assert.deepStrictEqual(getWishlist(), []);
    });

    test('renderShop includes wishlist toggle buttons and counter in HTML', () => {
      saveWishlist(['bubble_gum']);
      const root = { innerHTML: '', querySelectorAll: () => [] };
      const state = {
        profile: { balance: 10 },
        config: {
          shop: [
            { id: 'bubble_gum', name: 'Жуйка', price: 5, category: 'sweet' },
            { id: 'pencil', name: 'Олівець', price: 15, category: 'privilege' }
          ]
        }
      };

      renderShop(root, state);
      assert.ok(root.innerHTML.includes('btn-wishlist'), 'Contains wishlist buttons');
      assert.ok(root.innerHTML.includes('id="wishlist-counter"'), 'Contains wishlist counter element');
      assert.ok(root.innerHTML.includes('❤️'), 'Contains filled heart for wishlist item');
      assert.ok(root.innerHTML.includes('🤍'), 'Contains empty heart for non-wishlist item');
    });

    test('shop.js limits wishlist to maximum 3 items', () => {
      const shopJsPath = path.resolve(__dirname, '../src/student/shop.js');
      const shopJs = fs.readFileSync(shopJsPath, 'utf8');
      assert.ok(shopJs.includes('currentWishlist.length >= 3'), 'Limits wishlist additions to max 3 items');
      assert.ok(shopJs.includes('localStorage.getItem(\'wishlist\')'), 'Reads wishlist directly from localStorage');
    });
  });

  describe('2. Smart Dashboard: Nearest Goal (findNearestQuest in engine)', () => {
    const sampleConfig = {
      questWeeklyCap: 15,
      questMonthlyCap: 30,
      quests: [
        {
          id: 'q_weekly_grades',
          name: 'Збирач знань',
          type: 'weekly_count',
          period: 'weekly',
          perWeek: 1,
          reward: 3,
          active: true,
          params: { count: 4 }
        },
        {
          id: 'q_streak',
          name: 'Послідовність',
          type: 'consecutive',
          period: 'weekly',
          perWeek: 1,
          reward: 4,
          active: true,
          params: { length: 3, minGrade: 7 }
        },
        {
          id: 'q_twelve',
          name: 'Блискучий результат',
          type: 'target_grade',
          period: 'weekly',
          perWeek: 2,
          reward: 5,
          active: true,
          params: { grade: 12 }
        }
      ]
    };

    test('selects uncompleted quest with highest completion percentage (e.g. 2/3 -> 66%)', () => {
      // 2/3 consecutive streak -> 66%
      // 2/4 weekly count -> 50%
      const now = new Date('2026-10-12T10:00:00Z').getTime(); // Monday of week 2642
      const profile = {
        balance: 10,
        earned: 10,
        counters: {},
        grades: [
          { grade: 8, ts: now - 3600000 },
          { grade: 9, ts: now - 1800000 }
        ]
      };

      const nearest = findNearestQuest(profile, sampleConfig, now);
      assert.ok(nearest, 'Found a nearest quest');
      assert.strictEqual(nearest.quest.id, 'q_streak', 'Streak quest (66%) selected over weekly_grades (50%)');
      assert.strictEqual(nearest.progress, 2);
      assert.strictEqual(nearest.target, 3);
      assert.strictEqual(nearest.percent, 66);
    });

    test('skips completed quests and picks next highest available', () => {
      const now = new Date('2026-10-12T10:00:00Z').getTime();
      const { week } = kyivParts(now);
      const profile = {
        balance: 10,
        earned: 10,
        counters: {
          [week]: {
            'q_streak': 1 // Streak already completed for this week!
          }
        },
        grades: [
          { grade: 8, ts: now - 3600000 },
          { grade: 9, ts: now - 1800000 }
        ]
      };

      const nearest = findNearestQuest(profile, sampleConfig, now);
      assert.ok(nearest);
      assert.strictEqual(nearest.quest.id, 'q_weekly_grades', 'Weekly grades selected since streak is already capped');
      assert.strictEqual(nearest.progress, 2);
      assert.strictEqual(nearest.target, 4);
      assert.strictEqual(nearest.percent, 50);
    });

    test('returns null when all quests or star caps are reached', () => {
      const now = new Date('2026-10-12T10:00:00Z').getTime();
      const { week } = kyivParts(now);
      const profile = {
        balance: 10,
        earned: 10,
        counters: {
          [week]: {
            'q_weekly_grades': 1,
            'q_streak': 1,
            'q_twelve': 2
          }
        },
        grades: []
      };

      const nearest = findNearestQuest(profile, sampleConfig, now);
      assert.strictEqual(nearest, null, 'Returns null when all quests reached limit');
    });
  });

  describe('3. Student Home UI & Dashboard Structure (home.js)', () => {
    const homeJsPath = path.resolve(__dirname, '../src/student/home.js');
    const homeJs = fs.readFileSync(homeJsPath, 'utf8');

    test('contains #active-event-container placeholder for Stage 6', () => {
      assert.ok(homeJs.includes('id="active-event-container"'), 'Contains active event container for Stage 6');
    });

    test('contains #student-dashboard with Nearest Goal and Wishlist sections', () => {
      assert.ok(homeJs.includes('id="student-dashboard"'), 'Contains student dashboard root element');
      assert.ok(homeJs.includes('Найближча ціль'), 'Contains section header for nearest goal');
      assert.ok(homeJs.includes('Список бажань'), 'Contains section header for wishlist');
      assert.ok(homeJs.includes('renderNearestQuestBlock'), 'Invokes renderNearestQuestBlock');
      assert.ok(homeJs.includes('renderWishlist'), 'Invokes renderWishlist');
    });

    test('displays fallback placeholder when wishlist is empty', () => {
      assert.ok(
        homeJs.includes('Обери бажані нагороди у Магазині, щоб відстежувати їх тут'),
        'Contains required fallback message when wishlist is empty'
      );
    });

    test('wires navigation handlers to shop and quests views', () => {
      assert.ok(homeJs.includes('btn-goto-quests'), 'Wired button to navigate to quests');
      assert.ok(homeJs.includes('nearest-quest-card'), 'Wired nearest quest card click to quests');
      assert.ok(homeJs.includes('btn-goto-shop') || homeJs.includes('btn-edit-wishlist'), 'Wired buttons to navigate to shop');
    });
  });
});
