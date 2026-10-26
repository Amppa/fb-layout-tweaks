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

const { getUiCleanClassName, normalizeRightRailMode, deriveLayoutClasses } = require('../src/content/content.js');
const { getMsg, setLocaleMessages, resolveEffectiveLocale, applyI18n } = require('../src/shared/i18n.js');

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
  assert.strictEqual(getUiCleanClassName('showTopFeeds'), 'fb-layout-tweaks-hide-top-feeds');
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

test('applyI18n replaces text and attributes, then sets data-i18n-ready attribute', () => {
  setLocaleMessages({
    testTitle: { message: '測試標題' },
    testAttr: { message: '測試提示' }
  });

  const docElement = {
    hasAttribute: (a) => false,
    setAttribute: (a, v) => { docElement[a] = v; }
  };
  const textEl = {
    getAttribute: (attr) => (attr === 'data-i18n' ? 'testTitle' : null),
    textContent: 'Original Title'
  };
  const titleEl = {
    getAttribute: (attr) => (attr === 'data-i18n-title' ? 'testAttr' : null),
    title: 'Original Tooltip'
  };

  globalThis.document = {
    documentElement: docElement,
    querySelectorAll: (sel) => {
      if (sel === '[data-i18n]') return [textEl];
      if (sel === '[data-i18n-title]') return [titleEl];
      return [];
    }
  };

  applyI18n();

  assert.strictEqual(textEl.textContent, '測試標題');
  assert.strictEqual(titleEl.title, '測試提示');
  assert.strictEqual(docElement['data-i18n-ready'], 'true');

  delete globalThis.document;
  setLocaleMessages(null);
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

test('SETTINGS_ENUMS contains valid sets and matches default settings', () => {
  const { SETTINGS_ENUMS, DEFAULT_SETTINGS } = self;
  assert.ok(SETTINGS_ENUMS, 'SETTINGS_ENUMS must be defined on self');

  const expectedEnums = ['locale', 'sidebarScope', 'trimRightRail', 'feedWidth', 'feedFontSize', 'feedMediaHeight'];
  for (const key of expectedEnums) {
    assert.ok(SETTINGS_ENUMS[key] instanceof Set, `${key} should have a Set of valid values`);
    assert.ok(SETTINGS_ENUMS[key].has(DEFAULT_SETTINGS[key]), `Default value for ${key} (${DEFAULT_SETTINGS[key]}) must be in SETTINGS_ENUMS`);
  }
});

test('sanitizeSettingValue validates enum values, normalizes legacy booleans, and falls back to defaults', () => {
  const { sanitizeSettingValue, DEFAULT_SETTINGS } = self;
  assert.strictEqual(typeof sanitizeSettingValue, 'function');

  // Valid values
  assert.strictEqual(sanitizeSettingValue('trimRightRail', 'hidden'), 'hidden');
  assert.strictEqual(sanitizeSettingValue('trimRightRail', 'hover'), 'hover');
  assert.strictEqual(sanitizeSettingValue('trimRightRail', 'visible'), 'visible');
  assert.strictEqual(sanitizeSettingValue('feedWidth', 'w100'), 'w100');
  assert.strictEqual(sanitizeSettingValue('sidebarScope', 'global'), 'global');

  // Legacy boolean mapping for trimRightRail
  assert.strictEqual(sanitizeSettingValue('trimRightRail', true), 'hover');
  assert.strictEqual(sanitizeSettingValue('trimRightRail', false), 'visible');

  // Invalid values fallback to DEFAULT_SETTINGS
  assert.strictEqual(sanitizeSettingValue('trimRightRail', 'invalid-mode'), DEFAULT_SETTINGS.trimRightRail);
  assert.strictEqual(sanitizeSettingValue('trimRightRail', undefined), DEFAULT_SETTINGS.trimRightRail);
  assert.strictEqual(sanitizeSettingValue('trimRightRail', null), DEFAULT_SETTINGS.trimRightRail);
  assert.strictEqual(sanitizeSettingValue('feedWidth', 'w999'), DEFAULT_SETTINGS.feedWidth);
  assert.strictEqual(sanitizeSettingValue('locale', 'invalid-lang'), DEFAULT_SETTINGS.locale);

  // Non-enum keys pass through if defined
  assert.strictEqual(sanitizeSettingValue('enabled', false), false);
  assert.strictEqual(sanitizeSettingValue('enabled', undefined), DEFAULT_SETTINGS.enabled);
});

test('bindSelectDropdown initializes element value and handles changes and updates', async () => {
  const { bindSelectDropdown, DEFAULT_SETTINGS } = self;
  assert.strictEqual(typeof bindSelectDropdown, 'function');

  // Null element guard
  assert.strictEqual(bindSelectDropdown(null, 'feedWidth'), null);

  // Mock DOM Select Element
  const listeners = [];
  const mockSelect = {
    value: '',
    disabled: false,
    addEventListener: (type, handler) => {
      listeners.push({ type, handler });
    }
  };

  let savedVal = null;
  const binding = bindSelectDropdown(mockSelect, 'feedWidth', {
    initialValue: 'w50',
    onChange: async (val) => {
      savedVal = val;
    }
  });

  assert.strictEqual(mockSelect.value, 'w50');
  assert.strictEqual(binding.element, mockSelect);
  assert.strictEqual(binding.key, 'feedWidth');

  // Simulate user selection change
  mockSelect.value = 'w100';
  const changeListener = listeners.find(l => l.type === 'change');
  assert.ok(changeListener, 'Should register a change listener');
  await changeListener.handler();
  assert.strictEqual(savedVal, 'w100');

  // Simulate update() from storage
  binding.update('w75');
  assert.strictEqual(mockSelect.value, 'w75');

  // Invalid update value falls back to default
  binding.update('invalid-choice');
  assert.strictEqual(mockSelect.value, DEFAULT_SETTINGS.feedWidth);
});

test('deriveLayoutClasses returns complete set of active layout tokens based on settings and scope', () => {
  const { DEFAULT_SETTINGS } = self;

  // Disabled master switch produces zero classes
  const disabledClasses = deriveLayoutClasses({ ...DEFAULT_SETTINGS, enabled: false }, true);
  assert.strictEqual(disabledClasses.size, 0);

  // Default settings on active feed
  const defaultClasses = deriveLayoutClasses(DEFAULT_SETTINGS, true);
  assert.ok(defaultClasses.has('fb-layout-tweaks-hover-expand-left-rail'));
  assert.ok(defaultClasses.has('fb-layout-tweaks-hide-right-rail'));
  assert.ok(defaultClasses.has('fb-layout-tweaks-center-main-feed'));
  assert.strictEqual(defaultClasses.has('fb-layout-tweaks-feed-width-75'), false); // 680px default width uses standard feed layout
  assert.ok(defaultClasses.has('fb-layout-tweaks-feed-font-150'));
  assert.ok(defaultClasses.has('fb-layout-tweaks-extend-share-to-group-list'));
  assert.ok(defaultClasses.has('fb-layout-tweaks-hide-left-crisis-response'));

  // Feed/Sidebar inactive (non-feed page with homeOnly scope)
  const nonFeedClasses = deriveLayoutClasses(DEFAULT_SETTINGS, false);
  // Sidebar expand & right rail hide should not be present
  assert.strictEqual(nonFeedClasses.has('fb-layout-tweaks-hover-expand-left-rail'), false);
  assert.strictEqual(nonFeedClasses.has('fb-layout-tweaks-hide-right-rail'), false);
  // Top nav trimming is still active even outside feed
  assert.strictEqual(nonFeedClasses.has('fb-layout-tweaks-hide-top-marketplace'), true);

  // Custom configuration test
  const customSettings = {
    ...DEFAULT_SETTINGS,
    trimRightRail: 'hover',
    feedWidth: 'w100',
    feedFontSize: 'f200',
    feedMediaHeight: 'h50',
    showTopReels: false,
    showLeftFriends: false,
    extendShareToGroupList: false
  };
  const customClasses = deriveLayoutClasses(customSettings, true);
  assert.ok(customClasses.has('fb-layout-tweaks-hover-expand-right-rail'));
  assert.strictEqual(customClasses.has('fb-layout-tweaks-hide-right-rail'), false);
  assert.ok(customClasses.has('fb-layout-tweaks-feed-width-100'));
  assert.ok(customClasses.has('fb-layout-tweaks-feed-font-200'));
  assert.ok(customClasses.has('fb-layout-tweaks-feed-media-h50'));
  assert.ok(customClasses.has('fb-layout-tweaks-hide-top-reels'));
  assert.ok(customClasses.has('fb-layout-tweaks-hide-left-friends'));
  assert.strictEqual(customClasses.has('fb-layout-tweaks-extend-share-to-group-list'), false);
});

test('updateSettings executes sequential updates without race condition data loss', async () => {
  const { updateSettings } = self;
  assert.strictEqual(typeof updateSettings, 'function');

  // Mock chrome.storage.local with asynchronous delay
  let mockStore = { settings: { initialKey: true } };
  globalThis.chrome = {
    storage: {
      local: {
        get: async (key) => {
          await new Promise(r => setTimeout(r, 5));
          return { settings: { ...mockStore.settings } };
        },
        set: async (obj) => {
          await new Promise(r => setTimeout(r, 5));
          mockStore.settings = { ...obj.settings };
        }
      }
    }
  };

  // Launch multiple rapid concurrent updates without awaiting between them
  const p1 = updateSettings({ key1: 'value1' });
  const p2 = updateSettings({ key2: 'value2' });
  const p3 = updateSettings((current) => ({ key3: (current.key1 ? 'has-key1' : 'missing') }));

  const [res1, res2, res3] = await Promise.all([p1, p2, p3]);

  assert.strictEqual(mockStore.settings.initialKey, true);
  assert.strictEqual(mockStore.settings.key1, 'value1');
  assert.strictEqual(mockStore.settings.key2, 'value2');
  assert.strictEqual(mockStore.settings.key3, 'has-key1');
  assert.strictEqual(res3.key3, 'has-key1');

  delete globalThis.chrome;
});

test('scanLeftRailDynamicItems short-circuits when ads manager is already tagged and connected', () => {
  const { scanLeftRailDynamicItems } = require('../src/content/content.js');
  assert.strictEqual(typeof scanLeftRailDynamicItems, 'function');

  const mockRail = {
    isConnected: true,
    querySelector: (sel) => {
      if (sel.includes('.fb-layout-tweaks-hide-left-ads-manager-node')) {
        return { isConnected: true };
      }
      return null;
    },
    querySelectorAll: () => {
      throw new Error('querySelectorAll should not be called when already tagged!');
    }
  };

  globalThis.document = {
    querySelector: (sel) => {
      if (sel.includes('fb-layout-tweaks-left-rail') || sel.includes('LeftRail')) return mockRail;
      return null;
    }
  };

  const result = scanLeftRailDynamicItems({ enabled: true, showLeftAdsManager: false });
  assert.strictEqual(result.cached, true);
  assert.strictEqual(result.spansCount, 0);

  delete globalThis.document;
});

test('scanLeftRailDynamicItems skips querySelectorAll(span) when attribute candidates are found', () => {
  const { scanLeftRailDynamicItems } = require('../src/content/content.js');
  let queriedSpans = false;

  const mockCandidate = {
    closest: () => ({ classList: { add: () => {} } }),
    classList: { add: () => {} }
  };

  const mockRail = {
    isConnected: true,
    querySelector: () => null,
    querySelectorAll: (sel) => {
      if (sel.includes('adsmanager')) {
        return [mockCandidate];
      }
      if (sel === 'span') {
        queriedSpans = true;
        return [];
      }
      return [];
    }
  };

  globalThis.document = {
    querySelector: (sel) => {
      if (sel.includes('fb-layout-tweaks-left-rail') || sel.includes('LeftRail')) return mockRail;
      return null;
    }
  };

  const result = scanLeftRailDynamicItems({ enabled: true, showLeftAdsManager: false });
  assert.strictEqual(result.candidateCount, 1);
  assert.strictEqual(result.spansCount, 0);
  assert.strictEqual(queriedSpans, false, 'Should not query spans when attribute candidate was found');

  delete globalThis.document;
});

test('scanLeftRailDynamicItems does not fallback to document.body when leftRail is not found', () => {
  const { scanLeftRailDynamicItems } = require('../src/content/content.js');
  let bodyAccessed = false;

  globalThis.document = {
    querySelector: () => null,
    get body() {
      bodyAccessed = true;
      return { querySelector: () => null, querySelectorAll: () => [] };
    }
  };

  const result = scanLeftRailDynamicItems({ enabled: true, showLeftAdsManager: false });
  assert.strictEqual(result, undefined);
  assert.strictEqual(bodyAccessed, false, 'Should not access or query document.body');

  delete globalThis.document;
});

test('hasRelevantMutations filters mutation records and only triggers when nodes are added', () => {
  const { hasRelevantMutations } = require('../src/content/content.js');
  assert.strictEqual(typeof hasRelevantMutations, 'function');

  // Empty or invalid input
  assert.strictEqual(hasRelevantMutations(null), false);
  assert.strictEqual(hasRelevantMutations([]), false);

  // Pure node removal (e.g. tooltip closed, popup unmounted)
  assert.strictEqual(hasRelevantMutations([
    { addedNodes: [], removedNodes: [{ tagName: 'DIV' }] }
  ]), false);

  // Node additions present
  assert.strictEqual(hasRelevantMutations([
    { addedNodes: [{ tagName: 'IMG' }], removedNodes: [] }
  ]), true);

  // Mixed mutations
  assert.strictEqual(hasRelevantMutations([
    { addedNodes: [], removedNodes: [{ tagName: 'DIV' }] },
    { addedNodes: [{ tagName: 'SPAN' }], removedNodes: [] }
  ]), true);

  // Non-element additions (text nodes nodeType: 3, comments nodeType: 8)
  assert.strictEqual(hasRelevantMutations([
    { addedNodes: [{ nodeType: 3, textContent: 'hello' }], removedNodes: [] },
    { addedNodes: [{ nodeType: 8, textContent: 'comment' }], removedNodes: [] }
  ]), false);

  // Metadata/script/style elements
  assert.strictEqual(hasRelevantMutations([
    { addedNodes: [{ nodeType: 1, tagName: 'SCRIPT' }], removedNodes: [] },
    { addedNodes: [{ nodeType: 1, tagName: 'STYLE' }], removedNodes: [] },
    { addedNodes: [{ nodeType: 1, tagName: 'LINK' }], removedNodes: [] }
  ]), false);
});

test('isSidebarScopeActive stays active during photo/media overlay states on top of feed', () => {
  const { isSidebarScopeActive, setIsFeedScopeActive } = require('../src/content/content.js');

  const settings = {
    enabled: true,
    sidebarScope: 'homeOnly',
    trimMainFeed: true
  };

  const origWindow = globalThis.window;
  const origDoc = globalThis.document;

  let currentPath = '/';
  globalThis.window = {
    location: {
      get pathname() { return currentPath; }
    }
  };

  let mockFeedConnected = true;
  globalThis.document = {
    querySelector: (selector) => {
      if ((selector.includes('[data-pagelet="Feed"]') || selector.includes('div[role="feed"]')) && mockFeedConnected) {
        return { isConnected: true };
      }
      return null;
    }
  };

  try {
    // 1. Initial Home Feed load: scope is active
    currentPath = '/';
    assert.strictEqual(isSidebarScopeActive(settings), true);

    // 2. Open photo overlay from feed (/photo/): scope stays active
    currentPath = '/photo/';
    assert.strictEqual(isSidebarScopeActive(settings), true);

    // 3. Navigate through photos in album (/photo.php): scope stays active
    currentPath = '/photo.php';
    assert.strictEqual(isSidebarScopeActive(settings), true);

    // 4. Return to home feed: scope stays active
    currentPath = '/';
    assert.strictEqual(isSidebarScopeActive(settings), true);

    // 5. Navigate to marketplace: feed unmounted, scope turns off
    mockFeedConnected = false;
    currentPath = '/marketplace/';
    assert.strictEqual(isSidebarScopeActive(settings), false);

    // 6. Direct cold load to a photo URL with no home feed: scope is false
    setIsFeedScopeActive(false);
    currentPath = '/photo/';
    assert.strictEqual(isSidebarScopeActive(settings), false);
  } finally {
    globalThis.window = origWindow;
    globalThis.document = origDoc;
    if (setIsFeedScopeActive) setIsFeedScopeActive(false);
  }
});


