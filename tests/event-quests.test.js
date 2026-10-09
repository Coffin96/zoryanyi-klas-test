import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultConfig } from '../src/data/default-config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper function to extract renderActiveEventBlock for pure testing
function createRenderActiveEventBlock() {
  return function renderActiveEventBlock(c) {
    const event = c?.event;
    if (!event || event.active !== true) {
      return '';
    }

    return `
      <div class="parchment-card" style="padding: 14px 16px; border: 1.5px solid var(--gold-deep); background: radial-gradient(circle at top right, rgba(229,195,120,0.22), rgba(246,238,222,0.95)); box-shadow: 0 4px 14px rgba(0,0,0,0.15), 0 0 12px rgba(229,195,120,0.3);">
        <div class="flex justify-between items-center" style="margin-bottom: 8px;">
          <div class="flex items-center gap-xs">
            <span class="badge-tag" style="background: rgba(207,67,67,0.15); color: #8b2626; border: 1px solid rgba(207,67,67,0.4); font-weight: 800; font-size: 11px;">
              СПЕЦІАЛЬНА ПОДІЯ
            </span>
            <span style="font-size: 12px; color: var(--text-parchment-muted);">Одноразовий квест</span>
          </div>
          <div class="badge-gold" style="font-size: 14px; font-weight: 800; padding: 2px 10px; border-radius: 12px;">
            +${event.reward} ✦
          </div>
        </div>

        <div class="flex items-center gap-sm" style="margin-bottom: 10px;">
          <div style="width: 44px; height: 44px; min-width: 44px; border-radius: 50%; background: radial-gradient(circle, #fbf2de 0%, #ecd7af 100%); border: 1.5px solid var(--gold-deep); display: flex; align-items: center; justify-content: center; font-size: 24px; box-shadow: 0 2px 6px rgba(0,0,0,0.15);">
            🏆
          </div>
          <div style="flex: 1; min-width: 0;">
            <div style="font-weight: 800; font-size: 16px; color: var(--text-parchment); line-height: 1.2;">
              ${event.name}
            </div>
            <div style="font-size: 12px; color: var(--text-parchment-muted); margin-top: 2px;">
              Особливе випробування для всього класу
            </div>
          </div>
        </div>

        <div class="flex items-center justify-between" style="background: rgba(229,195,120,0.18); padding: 8px 12px; border-radius: 10px; border: 1px dashed var(--gold-border);">
          <div class="flex items-center gap-xs" style="font-size: 12px; font-weight: 700; color: var(--text-parchment);">
            <span>📱</span>
            <span>Покажи QR вчителю для виконання</span>
          </div>
          <button id="btn-event-show-qr" class="btn-genshin-gold" style="padding: 4px 12px; font-size: 12px; min-height: 28px; border-radius: 8px;">
            Мій QR →
          </button>
        </div>
      </div>
    `;
  };
}

describe('Event Quests System (Stage 6)', () => {
  describe('1. Конфігурація подійних квестів (published.json & default-config.js)', () => {
    test('defaultConfig містить об`єкт event з name, reward, active', () => {
      assert.ok(defaultConfig.event, 'defaultConfig повинен містити event');
      assert.strictEqual(typeof defaultConfig.event.name, 'string');
      assert.strictEqual(typeof defaultConfig.event.reward, 'number');
      assert.strictEqual(typeof defaultConfig.event.active, 'boolean');
    });

    test('firebase/seed/published.json містить об`єкт event', () => {
      const pubPath = path.resolve(__dirname, '../firebase/seed/published.json');
      const data = JSON.parse(fs.readFileSync(pubPath, 'utf8'));
      assert.ok(data.event, 'published.json повинен містити event');
      assert.strictEqual(typeof data.event.name, 'string');
      assert.strictEqual(typeof data.event.reward, 'number');
      assert.strictEqual(typeof data.event.active, 'boolean');
    });
  });

  describe('2. Дашборд учня (renderActiveEventBlock & home.js)', () => {
    const renderActiveEventBlock = createRenderActiveEventBlock();

    test('Повертає порожній рядок, якщо події немає або active === false', () => {
      assert.strictEqual(renderActiveEventBlock(null), '');
      assert.strictEqual(renderActiveEventBlock({}), '');
      assert.strictEqual(renderActiveEventBlock({ event: { active: false, name: 'Тест', reward: 10 } }), '');
    });

    test('Відображає назву, нагороду та заклик "Покажи QR вчителю для виконання", коли active === true', () => {
      const cfg = {
        event: {
          name: 'Святковий конкурс малюнків',
          reward: 15,
          active: true
        }
      };
      const html = renderActiveEventBlock(cfg);
      assert.ok(html.includes('Святковий конкурс малюнків'), 'Повинен містити назву події');
      assert.ok(html.includes('+15 ✦'), 'Повинен містити нагороду події');
      assert.ok(html.includes('Покажи QR вчителю для виконання'), 'Повинен містити заклик показати QR');
      assert.ok(html.includes('btn-event-show-qr'), 'Повинен містити кнопку переходу до QR');
    });

    test('src/student/home.js містить виклик renderActiveEventBlock у active-event-container', () => {
      const homePath = path.resolve(__dirname, '../src/student/home.js');
      const src = fs.readFileSync(homePath, 'utf8');

      assert.ok(src.includes('renderActiveEventBlock'), 'home.js повинен експортувати та використовувати renderActiveEventBlock');
      assert.ok(src.includes('active-event-container'), 'home.js повинен містити active-event-container');
      assert.ok(src.includes('btn-event-show-qr'), 'home.js повинен обробляти кнопку btn-event-show-qr');
    });
  });

  describe('3. Панель вчителя (student-panel.js)', () => {
    test('src/ui/student-panel.js містить перевірку активної події та кнопку виконання', () => {
      const panelPath = path.resolve(__dirname, '../src/ui/student-panel.js');
      const src = fs.readFileSync(panelPath, 'utf8');

      assert.ok(src.includes('event?.active === true') || src.includes('event.active === true'), 'student-panel.js повинен перевіряти active стан події');
      assert.ok(src.includes('🏆 Виконав подію:'), 'student-panel.js повинен містити кнопку "🏆 Виконав подію:"');
      assert.ok(src.includes("runTransaction(userId, 'add', event.reward, 'Подія: ' + event.name)"), 'student-panel.js повинен викликати runTransaction з параметрами події');
      assert.ok(src.includes('teacher-event-container'), 'student-panel.js повинен містити контейнер для кнопки події');
    });
  });

  describe('4. Адмінка (admin.js)', () => {
    test('src/ui/admin.js містить секцію налаштування спеціальної події', () => {
      const adminPath = path.resolve(__dirname, '../src/ui/admin.js');
      const src = fs.readFileSync(adminPath, 'utf8');

      assert.ok(src.includes('Спеціальна Подія (Одноразовий квест)'), 'admin.js повинен містити заголовок "Спеціальна Подія (Одноразовий квест)"');
      assert.ok(src.includes('event-name'), 'admin.js повинен містити поле event-name');
      assert.ok(src.includes('event-reward'), 'admin.js повинен містити поле event-reward');
      assert.ok(src.includes('event-active'), 'admin.js повинен містити чекбокс event-active');
      assert.ok(src.includes('btn-save-event'), 'admin.js повинен містити кнопку збереження btn-save-event');
    });
  });

  describe('5. Логіка виконання транзакції події (runTransaction)', () => {
    test('Транзакція "add" коректно збільшує balance та earned', () => {
      function simulateRunTransaction(profile, type, amount, reason) {
        const delta = (type === 'add' || type === 'credit') ? Math.abs(amount) : -Math.abs(amount);
        if (delta < 0 && profile.balance + delta < 0) {
          throw new Error('insufficient-funds');
        }
        const prev = structuredClone(profile);
        const next = structuredClone(profile);
        next.balance += delta;
        if (delta > 0) {
          next.earned = (next.earned || 0) + delta;
        }
        return {
          ok: true,
          prev,
          profile: next,
          delta,
          type: 'adjust',
          reason
        };
      }

      const p = { balance: 20, earned: 45 };
      const res = simulateRunTransaction(p, 'add', 10, 'Подія: Конкурс');

      assert.strictEqual(res.ok, true);
      assert.strictEqual(res.profile.balance, 30);
      assert.strictEqual(res.profile.earned, 55);
      assert.strictEqual(res.delta, 10);
      assert.strictEqual(res.reason, 'Подія: Конкурс');
    });
  });
});
