// tests/i18n-usage.test.js
// Every data-i18n / data-i18n-title key referenced by HTML must exist in
// both locale dictionaries (symmetry alone cannot catch a key missing in both).
// Run with: node --test tests/i18n-usage.test.js

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '..');

test('All data-i18n keys used in HTML exist in en and zh_TW dictionaries', () => {
  const enMessages = JSON.parse(
    fs.readFileSync(path.join(ROOT_DIR, '_locales', 'en', 'messages.json'), 'utf8'));
  const zhMessages = JSON.parse(
    fs.readFileSync(path.join(ROOT_DIR, '_locales', 'zh_TW', 'messages.json'), 'utf8'));

  const used = new Set();
  for (const file of ['src/options/options.html', 'src/popup/popup.html']) {
    const html = fs.readFileSync(path.join(ROOT_DIR, file), 'utf8');
    for (const m of html.matchAll(/data-i18n(?:-title)?="([^"]+)"/g)) {
      used.add(`${file}:${m[1]}`);
    }
  }
  assert.ok(used.size > 0, 'HTML must reference i18n keys');

  for (const ref of used) {
    const key = ref.slice(ref.indexOf(':') + 1);
    assert.ok(enMessages[key], `${ref} missing in en/messages.json`);
    assert.ok(zhMessages[key], `${ref} missing in zh_TW/messages.json`);
  }
});
