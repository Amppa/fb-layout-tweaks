// tests/badge.test.js
// Unit tests for the toolbar badge state decision and layout anchor counting:
// - decideBadgeState (shared/badge.js): off wins, fresh failure alerts, else clear.
// - countLayoutAnchors (content.js): sums matches across anchor selectors.
//
// Run with: node --test tests/badge.test.js

const test = require('node:test');
const assert = require('node:assert');

globalThis.self ??= globalThis;

const {
  BADGE_OFF_TEXT,
  BADGE_OFF_COLOR,
  BADGE_ALERT_TEXT,
  BADGE_ALERT_COLOR,
  HEALTH_MAX_AGE_MS,
  decideBadgeState
} = require('../src/shared/badge.js');
const { LAYOUT_ANCHOR_SELECTORS, countLayoutAnchors } = require('../src/content/content.js');

test('decideBadgeState shows gray lowercase off whenever disabled (off wins)', () => {
  assert.strictEqual(BADGE_OFF_TEXT, 'off');
  const state = decideBadgeState({ enabled: false, healthOk: false, healthTs: Date.now(), now: Date.now() });
  assert.deepStrictEqual(state, { text: 'off', backgroundColor: BADGE_OFF_COLOR });
});

test('decideBadgeState shows red alert for a fresh failure report', () => {
  const now = 1_700_000_000_000;
  const state = decideBadgeState({ enabled: true, healthOk: false, healthTs: now - 1000, now });
  assert.deepStrictEqual(state, { text: BADGE_ALERT_TEXT, backgroundColor: BADGE_ALERT_COLOR });
  assert.strictEqual(BADGE_ALERT_TEXT, '!');
});

test('decideBadgeState clears the badge when healthy, unknown, or stale', () => {
  const now = 1_700_000_000_000;
  assert.strictEqual(decideBadgeState({ enabled: true, healthOk: true, healthTs: now, now }), null);
  assert.strictEqual(decideBadgeState({ enabled: true, healthOk: undefined, healthTs: undefined, now }), null);
  assert.strictEqual(
    decideBadgeState({ enabled: true, healthOk: false, healthTs: now - HEALTH_MAX_AGE_MS - 1, now }),
    null
  );
  assert.strictEqual(decideBadgeState({ enabled: true }), null);
  assert.strictEqual(decideBadgeState(), null);
});

function fakeDoc(matchesBySelector) {
  return {
    querySelectorAll: (sel) => matchesBySelector[sel] || []
  };
}

test('countLayoutAnchors sums matches across every anchor selector', () => {
  assert.ok(Array.isArray(LAYOUT_ANCHOR_SELECTORS) && LAYOUT_ANCHOR_SELECTORS.length > 0);
  const doc = fakeDoc({
    'div[role="feed"]': [{}, {}],
    '[data-pagelet="LeftRail"]': [{}]
  });
  assert.strictEqual(countLayoutAnchors(doc), 3);
  assert.strictEqual(countLayoutAnchors(fakeDoc({})), 0);
});

test('countLayoutAnchors tolerates missing or throwing query backends', () => {
  assert.strictEqual(countLayoutAnchors(null), 0);
  assert.strictEqual(countLayoutAnchors({}), 0);
  assert.strictEqual(countLayoutAnchors({ querySelectorAll: () => { throw new Error('bad selector'); } }), 0);
});
