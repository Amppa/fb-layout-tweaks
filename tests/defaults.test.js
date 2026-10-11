// tests/defaults.test.js
// Unit tests for FB Layout Tweaks using Node.js built-in test runner (Node 18+).
// Run with: node --test tests/defaults.test.js

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

// Mock self / globalThis for loading defaults.js
globalThis.self ??= globalThis;
require('../src/shared/defaults.js');

const ROOT_DIR = path.resolve(__dirname, '..');

test('DEFAULT_SETTINGS contains required core keys and valid types', () => {
  const defaults = globalThis.DEFAULT_SETTINGS || self.DEFAULT_SETTINGS;

  assert.ok(defaults, 'DEFAULT_SETTINGS must be defined on globalThis/self');
  assert.strictEqual(typeof defaults.enabled, 'boolean', 'enabled should be boolean');
  assert.strictEqual(typeof defaults.hoverExpandLeftRail, 'boolean', 'hoverExpandLeftRail should be boolean');
  assert.strictEqual(typeof defaults.trimTopNav, 'boolean', 'trimTopNav should be boolean');
  assert.strictEqual(typeof defaults.trimLeftItems, 'boolean', 'trimLeftItems should be boolean');

  // Verify all show* keys are booleans
  const showKeys = Object.keys(defaults).filter(k => k.startsWith('show'));
  assert.ok(showKeys.length >= 20, 'Should have at least 20 show toggle keys');

  for (const key of showKeys) {
    assert.strictEqual(typeof defaults[key], 'boolean', `${key} should be boolean`);
  }
});

test('i18n message dictionaries are symmetrically aligned (en <-> zh_TW)', () => {
  const enPath = path.join(ROOT_DIR, '_locales', 'en', 'messages.json');
  const zhPath = path.join(ROOT_DIR, '_locales', 'zh_TW', 'messages.json');

  assert.ok(fs.existsSync(enPath), 'en messages.json must exist');
  assert.ok(fs.existsSync(zhPath), 'zh_TW messages.json must exist');

  const enMessages = JSON.parse(fs.readFileSync(enPath, 'utf8'));
  const zhMessages = JSON.parse(fs.readFileSync(zhPath, 'utf8'));

  const enKeys = Object.keys(enMessages).sort();
  const zhKeys = Object.keys(zhMessages).sort();

  const missingInZh = enKeys.filter(k => !zhMessages[k]);
  const missingInEn = zhKeys.filter(k => !enMessages[k]);

  assert.deepStrictEqual(missingInZh, [], `Keys missing in zh_TW: ${missingInZh.join(', ')}`);
  assert.deepStrictEqual(missingInEn, [], `Keys missing in en: ${missingInEn.join(', ')}`);
});

test('All configurable show* keys in DEFAULT_SETTINGS have corresponding inputs in options.html', () => {
  const optionsHtmlPath = path.join(ROOT_DIR, 'src', 'options', 'options.html');
  assert.ok(fs.existsSync(optionsHtmlPath), 'options.html must exist');

  const html = fs.readFileSync(optionsHtmlPath, 'utf8');
  const defaults = globalThis.DEFAULT_SETTINGS || self.DEFAULT_SETTINGS;
  const fixedKeys = new Set(['showLeftProfile']);
  const configurableKeys = Object.keys(defaults).filter(k => k.startsWith('show') && !fixedKeys.has(k));

  for (const key of configurableKeys) {
    const hasId = html.includes(`id="${key}"`);
    assert.ok(hasId, `options.html should contain an input with id="${key}"`);
  }
});

test('All inputs with id in options.html have aria-label for accessibility', () => {
  const optionsHtmlPath = path.join(ROOT_DIR, 'src', 'options', 'options.html');
  const html = fs.readFileSync(optionsHtmlPath, 'utf8');

  const inputMatches = html.matchAll(/<input[^>]+id="([^"]+)"[^>]*>/g);
  for (const match of inputMatches) {
    const fullTag = match[0];
    const id = match[1];
    assert.ok(
      fullTag.includes('aria-label='),
      `Input #${id} in options.html must have an aria-label attribute`
    );
  }
});

test('All production icons exist (16, 32, 48, 128px)', () => {
  const sizes = [16, 32, 48, 128];
  for (const size of sizes) {
    const iconPath = path.join(ROOT_DIR, 'icons', `icon${size}.png`);
    assert.ok(fs.existsSync(iconPath), `icons/icon${size}.png must exist`);
    const stats = fs.statSync(iconPath);
    assert.ok(stats.size > 0, `icons/icon${size}.png should not be empty`);
  }
});

test('Popup section masters have linked switches in options.html', () => {
  const optionsHtmlPath = path.join(ROOT_DIR, 'src', 'options', 'options.html');
  const html = fs.readFileSync(optionsHtmlPath, 'utf8');

  for (const key of ['trimTopNav', 'trimLeftItems']) {
    assert.ok(html.includes(`id="${key}"`), `options.html should contain a switch with id="${key}"`);
  }
});
