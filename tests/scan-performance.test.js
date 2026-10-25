// tests/scan-performance.test.js
// Regression tests for content-script scan gating:
// - dialog-scoped share-group scanning
// - left sidebar scope/master-switch gating
// - negative cache for left-rail label fallback scans

const test = require('node:test');
const assert = require('node:assert');

globalThis.self ??= globalThis;
require('../src/shared/defaults.js');

const {
  isLeftSidebarActive,
  scanLeftRailDynamicItems,
  tagShareGroupPanel,
  resetLeftRailLabelScanCache,
  SCAN_MIN_INTERVAL_MS,
  LABEL_SCAN_COOLDOWN_MS
} = require('../src/content/content.js');

test('scan throttle and label cooldown constants stay bounded', () => {
  assert.strictEqual(SCAN_MIN_INTERVAL_MS, 150);
  assert.strictEqual(LABEL_SCAN_COOLDOWN_MS, 1000);
});

test('isLeftSidebarActive respects master switch and sidebar scope', () => {
  assert.strictEqual(isLeftSidebarActive({ enabled: false, trimLeftItems: true }), false);
  assert.strictEqual(isLeftSidebarActive({ enabled: true, trimLeftItems: false }), false);
  assert.strictEqual(isLeftSidebarActive({ enabled: true, trimLeftItems: true, sidebarScope: 'global' }), true);

  globalThis.window = { location: { pathname: '/' } };
  assert.strictEqual(isLeftSidebarActive({ enabled: true, trimLeftItems: true, sidebarScope: 'homeOnly' }), true);

  globalThis.window = { location: { pathname: '/groups/123/' } };
  assert.strictEqual(isLeftSidebarActive({ enabled: true, trimLeftItems: true, sidebarScope: 'homeOnly' }), false);

  delete globalThis.window;
  // Non-browser/test environment: do not block scans.
  assert.strictEqual(isLeftSidebarActive({ enabled: true, trimLeftItems: true, sidebarScope: 'homeOnly' }), true);
});

test('tagShareGroupPanel does not query document-wide search inputs when no dialog is open', () => {
  const queries = [];
  globalThis.document = {
    querySelectorAll: (selector) => {
      queries.push(selector);
      return [];
    }
  };

  tagShareGroupPanel();

  assert.deepStrictEqual(queries, ['[role="dialog"], [aria-modal="true"]']);
  assert.strictEqual(queries.some(q => q.includes('input[type="search"]')), false);

  delete globalThis.document;
});

test('tagShareGroupPanel still tags a picker inside an open dialog', () => {
  const added = [];
  const scroller = {
    parentElement: null,
    classList: { add: (cls) => added.push(cls) }
  };
  const list = {
    parentElement: scroller,
    closest: () => null
  };
  const groupLink = {
    closest: () => list
  };
  const panel = {
    parentElement: null,
    querySelector: () => groupLink,
    classList: { add: (cls) => added.push(cls) }
  };
  const input = { parentElement: panel };
  const dialog = {
    querySelectorAll: (selector) => (selector === 'input[type="search"]' ? [input] : [])
  };

  globalThis.window = { getComputedStyle: () => ({ overflowY: 'auto' }) };
  globalThis.document = {
    body: {},
    querySelectorAll: (selector) => (selector === '[role="dialog"], [aria-modal="true"]' ? [dialog] : [])
  };

  tagShareGroupPanel();

  assert.deepStrictEqual(added, [
    'fb-layout-tweaks-share-group-panel',
    'fb-layout-tweaks-share-group-scroll'
  ]);

  delete globalThis.document;
  delete globalThis.window;
});

test('left-rail label scans are cached after a miss and reset explicitly', () => {
  resetLeftRailLabelScanCache();
  let spanQueries = 0;

  const noMatchSpan = {
    children: { length: 0 },
    textContent: 'Not an ads bookmark',
    closest: () => null
  };
  const mockRail = {
    isConnected: true,
    querySelector: () => null,
    querySelectorAll: (selector) => {
      if (selector === 'span') {
        spanQueries++;
        return [noMatchSpan];
      }
      return [];
    }
  };

  globalThis.document = {
    querySelector: (selector) => (selector.includes('fb-layout-tweaks-left-rail') ? mockRail : null)
  };

  const settings = {
    enabled: true,
    trimLeftItems: true,
    sidebarScope: 'global',
    showLeftAdsManager: false,
    showLeftCrisisResponse: true
  };

  const first = scanLeftRailDynamicItems(settings);
  assert.strictEqual(first.spansCount, 1);
  assert.strictEqual(spanQueries, 1);

  const second = scanLeftRailDynamicItems(settings);
  assert.strictEqual(second.spansCount, 0);
  assert.strictEqual(spanQueries, 1, 'second scan inside cooldown should skip span traversal');

  resetLeftRailLabelScanCache();
  const third = scanLeftRailDynamicItems(settings);
  assert.strictEqual(third.spansCount, 1);
  assert.strictEqual(spanQueries, 2);

  delete globalThis.document;
});

test('crisis label fallback is cached after a miss', () => {
  resetLeftRailLabelScanCache();
  let spanQueries = 0;

  const noMatchSpan = {
    children: { length: 0 },
    textContent: 'Not a crisis bookmark'
  };
  const mockRail = {
    isConnected: true,
    querySelector: () => null,
    querySelectorAll: (selector) => {
      if (selector === 'span') {
        spanQueries++;
        return [noMatchSpan];
      }
      return [];
    }
  };

  globalThis.document = {
    documentElement: { classList: { contains: () => true } },
    querySelector: (selector) => (selector.includes('fb-layout-tweaks-left-rail') ? mockRail : null)
  };

  const settings = {
    enabled: true,
    trimLeftItems: true,
    sidebarScope: 'global',
    showLeftAdsManager: true,
    showLeftCrisisResponse: false
  };

  scanLeftRailDynamicItems(settings);
  assert.strictEqual(spanQueries, 1);

  scanLeftRailDynamicItems(settings);
  assert.strictEqual(spanQueries, 1, 'second scan inside cooldown should skip crisis span traversal');

  resetLeftRailLabelScanCache();
  scanLeftRailDynamicItems(settings);
  assert.strictEqual(spanQueries, 2);

  delete globalThis.document;
});
