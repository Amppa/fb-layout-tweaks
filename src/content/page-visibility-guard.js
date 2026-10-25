/**
 * FB Layout Tweaks - Page Visibility Guard (MAIN world)
 *
 * Facebook refreshes the news feed when a tab becomes visible again, which
 * loses the scroll position. This script runs in the page context before
 * Facebook's own scripts and spoofs the Page Visibility API so the site
 * believes the tab was never hidden.
 *
 * The isolated content script controls it at runtime by toggling
 * <html data-fb-lt-stop-auto-refresh="1">, so no page reload is required.
 */

(function () {
  'use strict';

  const FLAG_ATTR = 'fbLtStopAutoRefresh';
  const GUARD_KEY = '__fbLtVisibilityGuardInstalled';

  if (window[GUARD_KEY]) return;
  window[GUARD_KEY] = true;

  function isEnabled() {
    const root = document.documentElement || document.querySelector('html');
    return Boolean(root && root.dataset[FLAG_ATTR] === '1');
  }

  function spoofGetter(prop, spoofedValue) {
    const target = Object.getOwnPropertyDescriptor(Document.prototype, prop)
      ? Document.prototype
      : Object.getOwnPropertyDescriptor(document, prop)
        ? document
        : null;
    if (!target) return;

    const descriptor = Object.getOwnPropertyDescriptor(target, prop);
    if (!descriptor || typeof descriptor.get !== 'function') return;

    Object.defineProperty(target, prop, {
      configurable: true,
      enumerable: descriptor.enumerable,
      get() {
        if (isEnabled()) return spoofedValue;
        return descriptor.get.call(this);
      }
    });
  }

  spoofGetter('hidden', false);
  spoofGetter('visibilityState', 'visible');

  const hasFocusTarget = typeof Document.prototype.hasFocus === 'function'
    ? Document.prototype
    : typeof document.hasFocus === 'function'
      ? document
      : null;
  if (hasFocusTarget) {
    const originalHasFocus = hasFocusTarget.hasFocus;
    Object.defineProperty(hasFocusTarget, 'hasFocus', {
      configurable: true,
      writable: true,
      value: function () {
        if (isEnabled()) return true;
        return originalHasFocus.apply(this, arguments);
      }
    });
  }

  // Capture phase runs before Facebook's own listeners, so the event never
  // reaches handlers that would trigger a feed refresh.
  const BLOCKED_EVENTS = ['visibilitychange', 'webkitvisibilitychange'];

  function blockVisibilityEvent(event) {
    if (isEnabled()) event.stopImmediatePropagation();
  }

  for (const target of [window, document]) {
    for (const type of BLOCKED_EVENTS) {
      target.addEventListener(type, blockVisibilityEvent, true);
    }
  }
})();
