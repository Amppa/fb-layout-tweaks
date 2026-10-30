// tests/layout-guard.test.js
// Unit tests for the Architectural Layout Guard & Negative Invariant Enforcer

const test = require('node:test');
const assert = require('node:assert');

// Ensure self exists for defaults
globalThis.self ??= globalThis;
require('../src/shared/defaults.js');

const {
  isSafeExclusiveContainer,
  verifyLayoutHealth,
  tripLayoutCircuitBreaker,
  CRITICAL_LAYOUT_SELECTORS
} = require('../src/content/content.js');

test('CRITICAL_LAYOUT_SELECTORS includes core layout foundations', () => {
  assert.ok(CRITICAL_LAYOUT_SELECTORS.includes('[role="main"]'));
  assert.ok(CRITICAL_LAYOUT_SELECTORS.includes('header'));
  assert.ok(CRITICAL_LAYOUT_SELECTORS.includes('[role="banner"]'));
  assert.ok(CRITICAL_LAYOUT_SELECTORS.includes('[role="navigation"]'));
});

test('isSafeExclusiveContainer rejects null, body, or documentElement candidates', () => {
  const fakeTarget = { contains: () => false };
  assert.strictEqual(isSafeExclusiveContainer(null, fakeTarget), false);
  assert.strictEqual(isSafeExclusiveContainer(fakeTarget, null), false);
});

test('isSafeExclusiveContainer rejects parent container when it contains main feed (anti-false-positive invariant)', () => {
  const mainFeedNode = { id: 'main-feed' };
  const rightRailNode = { id: 'right-rail', contains: (el) => el === rightRailNode };

  const threeColumnContainer = {
    children: [
      { id: 'left-rail', tagName: 'DIV', offsetWidth: 300, offsetHeight: 800, getAttribute: () => 'navigation' },
      mainFeedNode,
      rightRailNode
    ],
    querySelectorAll: (selector) => {
      if (selector === '[role="main"]') return [mainFeedNode];
      return [];
    }
  };

  const isSafe = isSafeExclusiveContainer(threeColumnContainer, rightRailNode);
  assert.strictEqual(
    isSafe,
    false,
    'A multi-column container holding [role="main"] must NEVER be recognized as an exclusive right rail parent'
  );
});

test('isSafeExclusiveContainer rejects container when it contains other critical sections', () => {
  const headerNode = { id: 'header' };
  const targetNode = { id: 'target', contains: (el) => el === targetNode };

  const container = {
    children: [headerNode, targetNode],
    querySelectorAll: (selector) => {
      if (selector === 'header' || selector === '[role="banner"]') return [headerNode];
      return [];
    }
  };

  assert.strictEqual(
    isSafeExclusiveContainer(container, targetNode),
    false,
    'Container enclosing header/banner landmark must be rejected'
  );
});

test('isSafeExclusiveContainer rejects container when it has unrelated visible layout siblings', () => {
  const targetNode = { id: 'target', contains: (el) => el === targetNode };
  const siblingNode = {
    id: 'sibling',
    tagName: 'DIV',
    offsetWidth: 200,
    offsetHeight: 400,
    getAttribute: (attr) => (attr === 'role' ? 'complementary' : null)
  };

  const container = {
    children: [targetNode, siblingNode],
    querySelectorAll: () => []
  };

  assert.strictEqual(
    isSafeExclusiveContainer(container, targetNode),
    false,
    'Container with active layout sibling elements must not be treated as an exclusive wrapper'
  );
});

test('isSafeExclusiveContainer approves dedicated single-child wrapper for target element', () => {
  const targetNode = { id: 'right-rail', contains: (el) => el === targetNode };
  const exclusiveWrapper = {
    children: [targetNode],
    querySelectorAll: () => []
  };

  assert.strictEqual(
    isSafeExclusiveContainer(exclusiveWrapper, targetNode),
    true,
    'Dedicated single-child wrapper without critical section intrusion must be approved'
  );
});
