import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Admin Panel Shop UI & Layout Tests', () => {
  const adminJsPath = path.resolve(__dirname, '../src/ui/admin.js');
  const baseCssPath = path.resolve(__dirname, '../styles/base.css');
  const adminJs = fs.readFileSync(adminJsPath, 'utf8');
  const baseCss = fs.readFileSync(baseCssPath, 'utf8');

  test('admin.js: renderAdminShop includes 2-row structured controls and responsive classes', () => {
    // Check classes in admin.js
    assert.ok(adminJs.includes('admin-shop-item'), 'Must contain .admin-shop-item card class');
    assert.ok(adminJs.includes('shop-item-controls'), 'Must contain .shop-item-controls class');
    assert.ok(adminJs.includes('shop-controls-row'), 'Must contain .shop-controls-row class');
    assert.ok(adminJs.includes('shop-stock-row'), 'Must contain .shop-stock-row class');
    assert.ok(adminJs.includes('shop-stock-control'), 'Must contain .shop-stock-control class');
    assert.ok(adminJs.includes('item-price-input'), 'Must maintain .item-price-input class for price inputs');
    assert.ok(adminJs.includes('item-stock-toggle'), 'Must maintain .item-stock-toggle class for stock checkbox');
    assert.ok(adminJs.includes('item-stock-input'), 'Must maintain .item-stock-input class for stock input');
    assert.ok(adminJs.includes('btn-toggle-active'), 'Must maintain .btn-toggle-active class');
    assert.ok(adminJs.includes('btn-delete-item'), 'Must maintain .btn-delete-item class');
  });

  test('admin.js: event listeners are correctly wired up to the elements', () => {
    // Check listener selectors
    assert.ok(adminJs.includes("querySelectorAll('.item-price-input')"), 'Price change listener exists');
    assert.ok(adminJs.includes("querySelectorAll('.item-stock-toggle')"), 'Stock checkbox listener exists');
    assert.ok(adminJs.includes("querySelectorAll('.item-stock-input')"), 'Stock input listener exists');
    assert.ok(adminJs.includes("querySelectorAll('.btn-toggle-active')"), 'Active toggle listener exists');
    assert.ok(adminJs.includes("querySelectorAll('.btn-delete-item')"), 'Delete item listener exists');
    
    // Check safe navigation to find stock input from checkbox
    assert.ok(adminJs.includes('.shop-stock-control'), 'Stock toggle finds container via .shop-stock-control');
  });

  test('base.css: contains styles for .shop-item-controls and responsive layout', () => {
    assert.ok(baseCss.includes('.admin-shop-item'), 'base.css has .admin-shop-item');
    assert.ok(baseCss.includes('.shop-item-controls'), 'base.css has .shop-item-controls');
    assert.ok(baseCss.includes('.shop-controls-row'), 'base.css has .shop-controls-row');
    assert.ok(baseCss.includes('.shop-stock-control'), 'base.css has .shop-stock-control');
    assert.ok(baseCss.includes('.shop-price-input'), 'base.css has .shop-price-input');
    assert.ok(baseCss.includes('.shop-stock-input'), 'base.css has .shop-stock-input');
    assert.ok(baseCss.includes('.btn-toggle-active'), 'base.css has .btn-toggle-active');
  });

  test('Stage 8: admin.js contains v2 database migration section, button and handler', async () => {
    assert.ok(adminJs.includes("import { defaultConfig } from '../data/default-config.js';"), 'Imports defaultConfig');
    assert.ok(adminJs.includes('🔧 Системні налаштування'), 'Includes System Settings section title');
    assert.ok(adminJs.includes('btn-migrate-v2'), 'Includes migration button id btn-migrate-v2');
    assert.ok(adminJs.includes('⚠️ Оновити базу квестів та титулів (v2.0)'), 'Includes migration button text');
    assert.ok(adminJs.includes("confirm('Увага! Це безпечно оновить квести, ліміти та титули в базі Firebase на основі нових файлів проекту. Ваші ціни в магазині та Спеціальні події залишаться недоторканими. Продовжити?')"), 'Asks for explicit confirmation');
    assert.ok(adminJs.includes('quests: defaultConfig.quests'), 'Updates quests from defaultConfig');
    assert.ok(adminJs.includes('levels: defaultConfig.levels'), 'Updates levels from defaultConfig');
    assert.ok(adminJs.includes('questWeeklyCap: defaultConfig.questWeeklyCap'), 'Updates questWeeklyCap from defaultConfig');
    assert.ok(adminJs.includes('questMonthlyCap: defaultConfig.questMonthlyCap'), 'Updates questMonthlyCap from defaultConfig');
    assert.ok(adminJs.includes("showToast('Базу успішно оновлено до v2.0!')"), 'Shows success toast after migration');

    // Verify fields exist in defaultConfig
    const { defaultConfig } = await import('../src/data/default-config.js');
    assert.ok(Array.isArray(defaultConfig.quests) && defaultConfig.quests.length > 0, 'quests is a populated array');
    assert.ok(Array.isArray(defaultConfig.levels) && defaultConfig.levels.length > 0, 'levels is a populated array');
    assert.strictEqual(typeof defaultConfig.questWeeklyCap, 'number');
    assert.strictEqual(typeof defaultConfig.questMonthlyCap, 'number');
  });
});
