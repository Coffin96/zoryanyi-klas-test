import test from 'node:test';
import assert from 'node:assert';
import { plural } from '../src/utils/plural.js';

test('plural rules for Ukrainian', () => {
  const forms = ['зірка', 'зірки', 'зірок'];
  
  assert.strictEqual(plural(1, forms), 'зірка');
  assert.strictEqual(plural(21, forms), 'зірка');
  
  assert.strictEqual(plural(2, forms), 'зірки');
  assert.strictEqual(plural(3, forms), 'зірки');
  assert.strictEqual(plural(4, forms), 'зірки');
  assert.strictEqual(plural(24, forms), 'зірки');
  
  assert.strictEqual(plural(0, forms), 'зірок');
  assert.strictEqual(plural(5, forms), 'зірок');
  assert.strictEqual(plural(11, forms), 'зірок');
  assert.strictEqual(plural(14, forms), 'зірок');
  assert.strictEqual(plural(100, forms), 'зірок');
});
