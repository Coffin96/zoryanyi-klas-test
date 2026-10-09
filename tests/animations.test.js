import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Stage 7: Animations & Tactile Feedback Tests', () => {
  const baseCssPath = path.resolve(__dirname, '../styles/base.css');
  const baseCss = fs.readFileSync(baseCssPath, 'utf8');
  const homeJsPath = path.resolve(__dirname, '../src/student/home.js');
  const homeJs = fs.readFileSync(homeJsPath, 'utf8');

  describe('1. CSS Tactile Feedback Rules in base.css', () => {
    test('contains tactile active state for buttons and clickable cards', () => {
      assert.ok(baseCss.includes('.btn-genshin-gold:active'), 'Contains .btn-genshin-gold:active');
      assert.ok(baseCss.includes('.btn-genshin-crimson:active'), 'Contains .btn-genshin-crimson:active');
      assert.ok(baseCss.includes('.nav-btn:active') || baseCss.includes('.genshin-nav-btn:active'), 'Contains nav-btn:active');
      assert.ok(baseCss.includes('.btn-wishlist:active'), 'Contains .btn-wishlist:active');
      assert.ok(baseCss.includes('.btn-toggle-active:active'), 'Contains .btn-toggle-active:active');
      assert.ok(baseCss.includes('#nearest-quest-card:active') || baseCss.includes('.clickable-card:active'), 'Contains clickable card:active');
    });

    test('tactile active states apply transform scale squeeze and brightness filter', () => {
      assert.ok(baseCss.includes('transform: scale(0.95)'), 'Applies squeeze scale(0.95) on active');
      assert.ok(baseCss.includes('filter: brightness(0.9)'), 'Applies brightness(0.9) on active');
      assert.ok(baseCss.includes('transition: transform 0.1s ease'), 'Includes smooth transition for tactile feel');
    });

    test('defines star collection pulse animation keyframes and utility class', () => {
      assert.ok(baseCss.includes('@keyframes starPulseAnim'), 'Defines @keyframes starPulseAnim');
      assert.ok(baseCss.includes('.star-pulse-anim'), 'Defines .star-pulse-anim class');
      assert.ok(baseCss.includes('scale(1.18)'), 'Star animation scales up');
    });
  });

  describe('2. Student Home Balance Star & Pulse Interaction in home.js', () => {
    test('home.js template contains #main-balance-star with cursor pointer', () => {
      assert.ok(homeJs.includes('id="main-balance-star"'), 'Contains id="main-balance-star" on balance star');
      assert.ok(homeJs.includes('cursor: pointer'), 'Contains cursor: pointer on main-balance-star');
    });

    test('home.js attaches click listener to #main-balance-star that triggers star-pulse-anim', () => {
      assert.ok(homeJs.includes("getElementById('main-balance-star')"), 'Finds main-balance-star element');
      assert.ok(homeJs.includes('star-pulse-anim'), 'Toggles star-pulse-anim class on click');
      assert.ok(homeJs.includes('setTimeout'), 'Removes animation class after timeout');
    });

    test('nearest-quest-card has clickable-card styling for tactile feedback', () => {
      assert.ok(homeJs.includes('clickable-card'), 'Nearest quest card marked with clickable-card class');
    });
  });
});
