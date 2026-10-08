import { test, describe } from 'node:test';
import assert from 'node:assert';
import { checkDataIntegrity } from '../src/engine/helpers.js';

describe('Data Integrity & Export Tests (M8)', () => {
  test('Integrity: Виявлення від\'ємного балансу', () => {
    const profiles = [
      { id: 'u1', alias: 'Сокіл-01', balance: -5, earned: 10 },
      { id: 'u2', alias: 'Лис-02', balance: 15, earned: 20 }
    ];
    const issues = checkDataIntegrity(profiles);
    assert.strictEqual(issues.length, 1);
    assert.strictEqual(issues[0].uuid, 'u1');
    assert.strictEqual(issues[0].type, 'negative-balance');
  });

  test('Integrity: Виявлення розбіжності earned < balance', () => {
    const profiles = [
      { id: 'u1', alias: 'Сокіл-01', balance: 25, earned: 10 }
    ];
    const issues = checkDataIntegrity(profiles);
    assert.strictEqual(issues.length, 1);
    assert.strictEqual(issues[0].uuid, 'u1');
    assert.strictEqual(issues[0].type, 'earned-less-than-balance');
  });

  test('Integrity: Виявлення дублікатів псевдонімів', () => {
    const profiles = [
      { id: 'u1', alias: 'Сокіл-01', balance: 5, earned: 10 },
      { id: 'u2', alias: 'сокіл-01', balance: 15, earned: 20 }
    ];
    const issues = checkDataIntegrity(profiles);
    assert.strictEqual(issues.length, 1);
    assert.strictEqual(issues[0].type, 'duplicate-alias');
  });

  test('Integrity: Ідеальні профілі проходять без помилок', () => {
    const profiles = [
      { id: 'u1', alias: 'Сокіл-01', balance: 5, earned: 10 },
      { id: 'u2', alias: 'Лис-02', balance: 15, earned: 20 }
    ];
    const issues = checkDataIntegrity(profiles);
    assert.strictEqual(issues.length, 0);
  });
});
