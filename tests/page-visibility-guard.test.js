// tests/page-visibility-guard.test.js
// Runs the MAIN-world guard in a VM with a mocked Document to verify that the
// Page Visibility spoofing is opt-in and reversible at runtime.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const GUARD_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'content', 'page-visibility-guard.js'),
  'utf8'
);

function createEnvironment(options = {}) {
  const state = {
    hidden: options.hidden !== undefined ? options.hidden : true,
    visibilityState: options.visibilityState || 'hidden',
    focused: options.focused === true
  };

  class FakeDocument {}

  Object.defineProperty(FakeDocument.prototype, 'hidden', {
    configurable: true,
    enumerable: true,
    get() { return state.hidden; }
  });
  Object.defineProperty(FakeDocument.prototype, 'visibilityState', {
    configurable: true,
    enumerable: true,
    get() { return state.visibilityState; }
  });
  FakeDocument.prototype.hasFocus = function () {
    return state.focused;
  };

  const listeners = [];
  FakeDocument.prototype.addEventListener = function (type, fn, capture) {
    listeners.push({ target: 'document', type, fn, capture });
  };

  const documentElement = { dataset: {} };
  const fakeDocument = Object.create(FakeDocument.prototype);
  fakeDocument.documentElement = documentElement;
  fakeDocument.querySelector = () => documentElement;

  const fakeWindow = {
    addEventListener(type, fn, capture) {
      listeners.push({ target: 'window', type, fn, capture });
    }
  };

  vm.runInNewContext(GUARD_SRC, {
    window: fakeWindow,
    document: fakeDocument,
    Document: FakeDocument
  });

  return { state, fakeDocument, fakeWindow, FakeDocument, documentElement, listeners };
}

test('Page visibility guard leaves native values untouched while disabled', () => {
  const env = createEnvironment({ hidden: true, visibilityState: 'hidden', focused: false });

  assert.strictEqual(env.fakeDocument.hidden, true);
  assert.strictEqual(env.fakeDocument.visibilityState, 'hidden');
  assert.strictEqual(env.fakeDocument.hasFocus(), false);
});

test('Page visibility guard spoofs values only while the flag is set', () => {
  const env = createEnvironment({ hidden: true, visibilityState: 'hidden', focused: false });

  env.documentElement.dataset.fbLtStopAutoRefresh = '1';
  assert.strictEqual(env.fakeDocument.hidden, false);
  assert.strictEqual(env.fakeDocument.visibilityState, 'visible');
  assert.strictEqual(env.fakeDocument.hasFocus(), true);

  delete env.documentElement.dataset.fbLtStopAutoRefresh;
  assert.strictEqual(env.fakeDocument.hidden, true);
  assert.strictEqual(env.fakeDocument.visibilityState, 'hidden');
  assert.strictEqual(env.fakeDocument.hasFocus(), false);
});

test('Page visibility guard blocks visibilitychange only while the flag is set', () => {
  const env = createEnvironment();
  const blockers = env.listeners.filter(entry => entry.type === 'visibilitychange');

  assert.strictEqual(blockers.length, 2, 'guard should listen on both window and document');
  assert.ok(blockers.every(entry => entry.capture === true), 'blockers must run in capture phase');

  function makeEvent() {
    return { stopped: false, stopImmediatePropagation() { this.stopped = true; } };
  }

  env.documentElement.dataset.fbLtStopAutoRefresh = '1';
  for (const blocker of blockers) {
    const event = makeEvent();
    blocker.fn(event);
    assert.strictEqual(event.stopped, true, 'event should be blocked while enabled');
  }

  delete env.documentElement.dataset.fbLtStopAutoRefresh;
  for (const blocker of blockers) {
    const event = makeEvent();
    blocker.fn(event);
    assert.strictEqual(event.stopped, false, 'event should pass through while disabled');
  }
});

test('Page visibility guard installs only once', () => {
  const env = createEnvironment();
  const initialCount = env.listeners.length;

  vm.runInNewContext(GUARD_SRC, {
    window: env.fakeWindow,
    document: env.fakeDocument,
    Document: env.FakeDocument
  });

  assert.strictEqual(env.listeners.length, initialCount);
});
