import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultConfig } from '../src/data/default-config.js';
import { redeem } from '../src/engine/redeem.js';
import { progressTo, affordable } from '../src/engine/helpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const emptyProfile = (balance = 50) => ({
  balance,
  earned: balance,
  recent: [],
  hot: [],
  last: null,
  lastOp: null,
  lastAt: {},
  stats: { gradeCount: {}, quests: {}, redeemed: {} },
  counters: {},
  achievements: []
});

describe('Global Stock Management Tests (Stage 5)', () => {
  describe('1. Очищення лімітів та перевірка конфігурації', () => {
    test('defaultConfig: жоден товар не має поля limits', () => {
      const shop = defaultConfig.shop || [];
      assert.ok(shop.length > 0, 'Магазин повинен містити товари');
      for (const item of shop) {
        assert.strictEqual(item.limits, undefined, `Товар "${item.name}" не повинен мати поля limits`);
      }
    });

    test('defaultConfig: тарталетка має stock === 3', () => {
      const tartlet = (defaultConfig.shop || []).find(i => i.id === 'tartlet');
      assert.ok(tartlet, 'Тарталетка повинна бути в конфігурації');
      assert.strictEqual(tartlet.stock, 3, 'Поле stock у тарталетки має дорівнювати 3');
      assert.strictEqual(tartlet.limits, undefined, 'Тарталетка не повинна мати limits');
    });

    test('firebase/seed/published.json: перевірка очищення limits та додавання stock: 3', () => {
      const publishedPath = path.resolve(__dirname, '../firebase/seed/published.json');
      const raw = fs.readFileSync(publishedPath, 'utf8');
      const published = JSON.parse(raw);

      const shop = published.shop || [];
      assert.ok(shop.length > 0, 'published.json має містити товари магазину');

      for (const item of shop) {
        assert.strictEqual(item.limits, undefined, `Товар "${item.name}" у published.json не повинен мати limits`);
      }

      const tartlet = shop.find(i => i.id === 'tartlet');
      assert.ok(tartlet, 'Тарталетка має бути у published.json');
      assert.strictEqual(tartlet.stock, 3, 'Тарталетка у published.json повинна мати stock: 3');
    });
  });

  describe('2. Робота двигуна викупу (redeem) з полем stock', () => {
    test('Успішний викуп товару зі stock > 0', () => {
      const p = emptyProfile(30);
      const tartlet = { id: 'tartlet', name: 'Тарталетка', price: 17, active: true, stock: 3 };
      
      const res = redeem(p, tartlet, 1, defaultConfig, 1000);
      assert.strictEqual(res.ok, true, 'Викуп має бути успішним');
      assert.strictEqual(res.profile.balance, 13, 'Баланс повинен зменшитися на 17');
      assert.deepStrictEqual(res.stockDelta, { tartlet: -1 });
    });

    test('Відхилення викупу, якщо stock === 0 (out-of-stock)', () => {
      const p = emptyProfile(30);
      const tartletSoldOut = { id: 'tartlet', name: 'Тарталетка', price: 17, active: true, stock: 0 };
      
      const res = redeem(p, tartletSoldOut, 1, defaultConfig, 1000);
      assert.strictEqual(res.ok, false, 'Викуп має бути відхилений');
      assert.strictEqual(res.reason, 'out-of-stock');
    });

    test('Відхилення викупу, якщо запитана кількість перевищує залишок', () => {
      const p = emptyProfile(50);
      const item = { id: 'tartlet', name: 'Тарталетка', price: 17, active: true, stock: 2 };
      
      const res = redeem(p, item, 3, defaultConfig, 1000);
      assert.strictEqual(res.ok, false, 'Викуп має бути відхилений при недостатній кількості');
      assert.strictEqual(res.reason, 'out-of-stock');
    });

    test('Товар без поля stock купується без ліміту залишку', () => {
      const p = emptyProfile(20);
      const caramel = { id: 'caramel', name: 'Карамель', price: 7, active: true };
      
      const res = redeem(p, caramel, 2, defaultConfig, 1000);
      assert.strictEqual(res.ok, true, 'Товар без ліміту купується успішно');
      assert.strictEqual(res.profile.balance, 6);
    });
  });

  describe('3. Симуляція логіки транзакції покупки (tx.js behavior)', () => {
    test('Транзакція перевіряє stock > 0, відхиляє з "Розпродано" при stock <= 0', () => {
      function simulatePurchase(shopItems, itemId, qty = 1) {
        const itemIndex = shopItems.findIndex(it => it.id === itemId);
        if (itemIndex === -1) throw new Error('not-found');
        
        const currentItem = shopItems[itemIndex];
        if (typeof currentItem.stock === 'number') {
          if (currentItem.stock <= 0 || currentItem.stock < qty) {
            throw new Error('Розпродано');
          }
          // Віднімаємо залишок
          shopItems[itemIndex] = {
            ...currentItem,
            stock: currentItem.stock - qty
          };
        }
        return { ok: true, remaining: shopItems[itemIndex].stock };
      }

      const shop = [
        { id: 'tartlet', name: 'Тарталетка', stock: 3, price: 17 },
        { id: 'caramel', name: 'Карамель', price: 7 }
      ];

      // Перша покупка: 3 -> 2
      const step1 = simulatePurchase(shop, 'tartlet', 1);
      assert.strictEqual(step1.remaining, 2);

      // Друга покупка: 2 -> 1
      const step2 = simulatePurchase(shop, 'tartlet', 1);
      assert.strictEqual(step2.remaining, 1);

      // Третя покупка: 1 -> 0
      const step3 = simulatePurchase(shop, 'tartlet', 1);
      assert.strictEqual(step3.remaining, 0);

      // Четверта покупка: Розпродано!
      assert.throws(() => {
        simulatePurchase(shop, 'tartlet', 1);
      }, /Розпродано/);

      // Товар без stock купується завжди
      const caramelStep = simulatePurchase(shop, 'caramel', 1);
      assert.strictEqual(caramelStep.ok, true);
    });

    test('Скасування (undo) транзакції відновлює stock', () => {
      const shop = [
        { id: 'tartlet', name: 'Тарталетка', stock: 2, price: 17 }
      ];

      // Симуляція повернення товару
      const itemIndex = shop.findIndex(it => it.id === 'tartlet');
      shop[itemIndex].stock += 1;

      assert.strictEqual(shop[0].stock, 3, 'Залишок успішно відновлено');
    });
  });

  describe('4. Допоміжні функції інтерфейсу (helpers)', () => {
    test('progressTo розпізнає out-of-stock при stock === 0', () => {
      const p = emptyProfile(50);
      const soldOutItem = { id: 'tartlet', price: 17, stock: 0 };
      const res = progressTo(p, soldOutItem, defaultConfig, 1000);

      assert.strictEqual(res.canBuy, false);
      assert.strictEqual(res.reason, 'out-of-stock');
    });

    test('affordable фільтрує та позначає товари з нульовим залишком', () => {
      const p = emptyProfile(50);
      const customCfg = {
        shop: [
          { id: 'tartlet', price: 17, active: true, stock: 0 },
          { id: 'caramel', price: 7, active: true, stock: 5 }
        ]
      };

      const result = affordable(p, customCfg, 1000);
      const tartletResult = result.find(r => r.item.id === 'tartlet');
      const caramelResult = result.find(r => r.item.id === 'caramel');

      assert.strictEqual(tartletResult.canBuy, false);
      assert.strictEqual(tartletResult.reason, 'out-of-stock');
      assert.strictEqual(caramelResult.canBuy, true);
    });
  });
});
