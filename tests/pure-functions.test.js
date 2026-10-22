// tests/pure-functions.test.js
// Unit tests for pure functions and transformation logic:
// - getUiCleanClassName (content script CSS class mapping & content.css rule coverage)
// - toUIChecked / toStoredValue (options page setting transformation & invert-key logic)
// - getMsg (i18n resolution and fallback handling)
//
// Run with: node tests/pure-functions.test.js

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

// Ensure self exists for defaults.js
globalThis.self ??= globalThis;
require('../src/shared/defaults.js');

const { getUiCleanClassName, normalizeRightRailMode } = require('../src/content/content.js');
const { getMsg, setLocaleMessages, resolveEffectiveLocale } = require('../src/shared/i18n.js');

const ROOT_DIR = path.resolve(__dirname, '..');

test('getUiCleanClassName correctly transforms settings keys to CSS hide tokens', () => {
  // Special exception keys
  assert.strictEqual(getUiCleanClassName('showLeftMetaAI'), 'fb-layout-tweaks-hide-left-metaai');
  assert.strictEqual(getUiCleanClassName('showRightMetaAI'), 'fb-layout-tweaks-hide-right-metaai');

  // Standard kebab-cased keys across sections
  assert.strictEqual(getUiCleanClassName('showTopReels'), 'fb-layout-tweaks-hide-top-reels');
  assert.strictEqual(getUiCleanClassName('showTopFriends'), 'fb-layout-tweaks-hide-top-friends');
  assert.strictEqual(getUiCleanClassName('showTopMarketplace'), 'fb-layout-tweaks-hide-top-marketplace');
  assert.strictEqual(getUiCleanClassName('showTopGroups'), 'fb-layout-tweaks-hide-top-groups');
  assert.strictEqual(getUiCleanClassName('showTopGaming'), 'fb-layout-tweaks-hide-top-gaming');

  assert.strictEqual(getUiCleanClassName('showLeftFriends'), 'fb-layout-tweaks-hide-left-friends');
  assert.strictEqual(getUiCleanClassName('showLeftGaming'), 'fb-layout-tweaks-hide-left-gaming');
  assert.strictEqual(getUiCleanClassName('showLeftGamingVideo'), 'fb-layout-tweaks-hide-left-gaming-video');
  assert.strictEqual(getUiCleanClassName('showLeftAdsManager'), 'fb-layout-tweaks-hide-left-ads-manager');
  assert.strictEqual(getUiCleanClassName('showLeftRecentAdActivity'), 'fb-layout-tweaks-hide-left-recent-ad-activity');
  assert.strictEqual(getUiCleanClassName('showLeftProfessionalDashboard'), 'fb-layout-tweaks-hide-left-professional-dashboard');
  assert.strictEqual(getUiCleanClassName('showLeftOrdersPayments'), 'fb-layout-tweaks-hide-left-orders-payments');

  assert.strictEqual(getUiCleanClassName('showRightSponsored'), 'fb-layout-tweaks-hide-right-sponsored');
  assert.strictEqual(getUiCleanClassName('showRightBirthdays'), 'fb-layout-tweaks-hide-right-birthdays');
});

test('Every configurable show* key in DEFAULT_SETTINGS maps to a matching CSS rule in content.css', () => {
  const cssContent = fs.readFileSync(path.join(ROOT_DIR, 'src', 'content', 'content.css'), 'utf8');
  const defaults = globalThis.DEFAULT_SETTINGS || self.DEFAULT_SETTINGS;

  const fixedKeys = new Set(['showLeftProfile']);
  const configurableKeys = Object.keys(defaults).filter(k => k.startsWith('show') && !fixedKeys.has(k));

  const missingRules = [];
  for (const key of configurableKeys) {
    const className = getUiCleanClassName(key);
    if (!cssContent.includes(className)) {
      missingRules.push({ key, className });
    }
  }

  assert.deepStrictEqual(
    missingRules,
    [],
    `The following keys do not have corresponding hiding rules in content.css: ${JSON.stringify(missingRules)}`
  );
});

test('toUIChecked and toStoredValue handle inverted switches and standard pills with round-trip fidelity', () => {
  const { INVERTED_KEYS, toUIChecked, toStoredValue } = self;

  assert.ok(INVERTED_KEYS instanceof Set, 'INVERTED_KEYS should be a Set');
  assert.ok(INVERTED_KEYS.has('showRightSponsored'));
  assert.ok(INVERTED_KEYS.has('showRightBirthdays'));
  assert.ok(INVERTED_KEYS.has('showRightMetaAI'));

  // Inverted keys: checked in UI means hidden (stored value is false)
  for (const invKey of INVERTED_KEYS) {
    // When stored value is false (hidden on FB) -> UI checkbox must be checked (true)
    assert.strictEqual(toUIChecked(invKey, false), true, `${invKey} with stored=false should be checked in UI`);
    // When stored value is true (visible on FB) -> UI checkbox must be unchecked (false)
    assert.strictEqual(toUIChecked(invKey, true), false, `${invKey} with stored=true should be unchecked in UI`);

    // Inverted write: checked UI (true) -> stored false
    assert.strictEqual(toStoredValue(invKey, true), false);
    assert.strictEqual(toStoredValue(invKey, false), true);

    // Round-trip invariant
    assert.strictEqual(toStoredValue(invKey, toUIChecked(invKey, true)), true);
    assert.strictEqual(toStoredValue(invKey, toUIChecked(invKey, false)), false);
  }

  // Standard non-inverted keys: checked in UI means visible (stored value is true)
  const standardKeys = ['showLeftFriends', 'showTopReels', 'showLeftMarketplace'];
  for (const key of standardKeys) {
    assert.strictEqual(toUIChecked(key, true), true);
    assert.strictEqual(toUIChecked(key, false), false);

    assert.strictEqual(toStoredValue(key, true), true);
    assert.strictEqual(toStoredValue(key, false), false);

    // Round-trip invariant
    assert.strictEqual(toStoredValue(key, toUIChecked(key, true)), true);
    assert.strictEqual(toStoredValue(key, toUIChecked(key, false)), false);
  }
});

test('getMsg resolves messages in order: in-memory localeMessages -> chrome.i18n -> empty fallback', () => {
  // 1. In-memory dictionary priority
  setLocaleMessages({
    greeting: { message: 'Hello from in-memory dictionary' },
    partiallyMissing: null
  });
  assert.strictEqual(getMsg('greeting'), 'Hello from in-memory dictionary');

  // 2. Fallback to chrome.i18n when key is missing in in-memory dictionary
  globalThis.chrome = {
    i18n: {
      getMessage: (k) => (k === 'fromChrome' ? 'Resolved from chrome.i18n' : '')
    }
  };
  assert.strictEqual(getMsg('fromChrome'), 'Resolved from chrome.i18n');

  // 3. Fallback to empty string when not found anywhere
  assert.strictEqual(getMsg('totallyNonExistentKey'), '');

  // Clean up mock
  delete globalThis.chrome;
  setLocaleMessages(null);
  assert.strictEqual(getMsg('greeting'), '');
});

test('isFeedPage correctly identifies feeds and home URLs vs non-feed pages', () => {
  const { isFeedPage } = self;
  assert.strictEqual(typeof isFeedPage, 'function', 'isFeedPage must be a function on self');

  // Feed / Home URLs (Should return true)
  assert.strictEqual(isFeedPage('/'), true);
  assert.strictEqual(isFeedPage('/index.php'), true);
  assert.strictEqual(isFeedPage('/home.php'), true);
  assert.strictEqual(isFeedPage('/feed'), true);
  assert.strictEqual(isFeedPage('/feed/'), true);

  // Non-feed pages (Groups, Pages, Marketplace, Watch, Profile - Should return false)
  assert.strictEqual(isFeedPage('/groups/feed'), false);
  assert.strictEqual(isFeedPage('/groups/feed/'), false);
  assert.strictEqual(isFeedPage('/friends/feed'), false);
  assert.strictEqual(isFeedPage('/friends/feed/'), false);
  assert.strictEqual(isFeedPage('/groups/12345678/'), false);
  assert.strictEqual(isFeedPage('/groups/react_developers/'), false);
  assert.strictEqual(isFeedPage('/groups/mygroup/permalink/999/'), false);
  assert.strictEqual(isFeedPage('/marketplace/'), false);
  assert.strictEqual(isFeedPage('/watch/'), false);
  assert.strictEqual(isFeedPage('/gaming/'), false);
  assert.strictEqual(isFeedPage('/messages/t/123/'), false);
  assert.strictEqual(isFeedPage('/events/'), false);
  assert.strictEqual(isFeedPage('/zuck/'), false);
  assert.strictEqual(isFeedPage(''), false);
  assert.strictEqual(isFeedPage(null), false);
});

test('normalizeRightRailMode correctly resolves modes and falls back to hidden', () => {
  assert.strictEqual(normalizeRightRailMode('hidden', true), 'hidden');
  assert.strictEqual(normalizeRightRailMode('hover', true), 'hover');
  assert.strictEqual(normalizeRightRailMode('visible', true), 'visible');

  // Legacy boolean mappings
  assert.strictEqual(normalizeRightRailMode(true, true), 'hover');
  assert.strictEqual(normalizeRightRailMode(false, true), 'visible');

  // Fallbacks
  assert.strictEqual(normalizeRightRailMode(undefined, true), 'hidden');
  assert.strictEqual(normalizeRightRailMode('invalid', true), 'hidden');

  // Inactive sidebar scope forces visible
  assert.strictEqual(normalizeRightRailMode('hidden', false), 'visible');
  assert.strictEqual(normalizeRightRailMode('hover', false), 'visible');
});

test('resolveEffectiveLocale correctly resolves explicit and auto locales', () => {
  assert.strictEqual(resolveEffectiveLocale('en'), 'en');
  assert.strictEqual(resolveEffectiveLocale('zh_TW'), 'zh_TW');

  // Auto with Chinese UI
  globalThis.chrome = { i18n: { getUILanguage: () => 'zh-TW' } };
  assert.strictEqual(resolveEffectiveLocale('auto'), 'zh_TW');

  // Auto with English UI
  globalThis.chrome = { i18n: { getUILanguage: () => 'en-US' } };
  assert.strictEqual(resolveEffectiveLocale('auto'), 'en');

  // Auto with Japanese UI
  globalThis.chrome = { i18n: { getUILanguage: () => 'ja' } };
  assert.strictEqual(resolveEffectiveLocale('auto'), 'en');

  // Fallback for undefined with non-Chinese UI
  globalThis.chrome = { i18n: { getUILanguage: () => 'fr' } };
  assert.strictEqual(resolveEffectiveLocale(undefined), 'en');
  delete globalThis.chrome;
});

