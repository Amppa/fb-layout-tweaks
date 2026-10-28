// tests/photo-viewer-scope.test.js
// Automated verification for photo viewer overlay scope preservation in Facebook SPA.
// Verifies that expanding a photo modal (/photo/, /photo.php) does not strip Feed
// layout classes or trigger font-size/media height reflows, and cleanly deactivates
// only upon genuine navigation away from the feed (e.g. to Marketplace).

const test = require('node:test');
const assert = require('node:assert');

globalThis.self ??= globalThis;
require('../src/shared/defaults.js');

test('Photo overlay maintains feed scope and prevents layout shift', () => {
  // Clear any existing debug exports or state
  delete require.cache[require.resolve('../src/content/content.js')];

  // Setup DOM mock
  const classList = new Set();
  const root = {
    classList: {
      add: (c) => classList.add(c),
      remove: (c) => classList.delete(c),
      contains: (c) => classList.has(c),
      toggle: (c, force) => {
        if (force === undefined) {
          if (classList.has(c)) classList.delete(c);
          else classList.add(c);
        } else if (force) {
          classList.add(c);
        } else {
          classList.delete(c);
        }
      },
      [Symbol.iterator]: function* () {
        for (const item of classList) yield item;
      }
    },
    dataset: {},
    removeAttribute: (attr) => { delete root.dataset[attr]; }
  };

  let pathname = '/';
  let feedInDom = true;
  let overlayInDom = false;

  const mockFeedElement = {
    tagName: 'DIV',
    getAttribute: (attr) => attr === 'data-pagelet' ? 'Feed' : null,
    isConnected: true
  };

  const mockOverlayElement = {
    tagName: 'DIV',
    getAttribute: (attr) => attr === 'role' ? 'dialog' : (attr === 'data-pagelet' ? 'MediaViewer' : null),
    isConnected: true
  };

  globalThis.document = {
    documentElement: root,
    addEventListener: () => {},
    removeEventListener: () => {},
    querySelector: (selector) => {
      if (selector.includes('[data-pagelet="Feed"]') || selector.includes('div[role="feed"]')) {
        return feedInDom ? mockFeedElement : null;
      }
      if (selector.includes('[role="dialog"]') || selector.includes('[data-pagelet="MediaViewer"]')) {
        return overlayInDom ? mockOverlayElement : null;
      }
      return null;
    },
    querySelectorAll: () => []
  };

  globalThis.window = {
    location: {
      get pathname() { return pathname; }
    },
    getComputedStyle: () => ({ paddingTop: '0px', width: '680px', height: '680px' })
  };

  const contentModule = require('../src/content/content.js');
  const { isSidebarScopeActive, deriveLayoutClasses } = contentModule;

  const settings = {
    enabled: true,
    sidebarScope: 'homeOnly',
    trimMainFeed: true,
    centerMainFeed: true,
    feedFontSize: 'f150',
    feedMediaHeight: 'h50',
    hoverExpandLeftRail: true,
    trimRightRail: 'hidden'
  };

  // 1. Initial State on Home Feed (/)
  pathname = '/';
  feedInDom = true;
  overlayInDom = false;
  assert.strictEqual(isSidebarScopeActive(settings), true, 'Home feed should be in feed scope');
  const homeClasses = deriveLayoutClasses(settings, true);
  assert.strictEqual(homeClasses.has('fb-layout-tweaks-feed-font-150'), true, 'Should include feed font size');
  assert.strictEqual(homeClasses.has('fb-layout-tweaks-center-main-feed'), true, 'Should include center main feed');
  assert.strictEqual(homeClasses.has('fb-layout-tweaks-feed-media-h50'), true, 'Should include feed media scaling');

  // 2. User clicks photo: SPA updates URL to /photo/?fbid=123 and mounts MediaViewer overlay
  pathname = '/photo/';
  overlayInDom = true;
  assert.strictEqual(isSidebarScopeActive(settings), true, 'Overlay state while feed connected must stay in scope');
  const overlayClasses = deriveLayoutClasses(settings, isSidebarScopeActive(settings));
  assert.deepStrictEqual([...overlayClasses].sort(), [...homeClasses].sort(), 'Classes must remain identical during photo overlay');

  // 3. User navigates through multiple photos (/photo.php?fbid=456)
  pathname = '/photo.php';
  assert.strictEqual(isSidebarScopeActive(settings), true, 'Alternative photo.php overlay must stay in scope');
  const photoPhpClasses = deriveLayoutClasses(settings, isSidebarScopeActive(settings));
  assert.deepStrictEqual([...photoPhpClasses].sort(), [...homeClasses].sort(), 'Classes must remain identical across photo flips');

  // 4. User exits photo overlay (returns to /)
  pathname = '/';
  overlayInDom = false;
  assert.strictEqual(isSidebarScopeActive(settings), true, 'Closing overlay returns to active home feed scope');
  const restoredClasses = deriveLayoutClasses(settings, isSidebarScopeActive(settings));
  assert.deepStrictEqual([...restoredClasses].sort(), [...homeClasses].sort(), 'Classes must remain stable when closing overlay');

  // 5. Genuine navigation to non-feed page (e.g. /marketplace/) unmounts feed
  pathname = '/marketplace/';
  feedInDom = false;
  overlayInDom = false;
  assert.strictEqual(isSidebarScopeActive(settings), false, 'Navigating to Marketplace must exit feed scope');
  const marketplaceClasses = deriveLayoutClasses(settings, isSidebarScopeActive(settings));
  assert.strictEqual(marketplaceClasses.has('fb-layout-tweaks-feed-font-150'), false, 'Feed font must be stripped on Marketplace');
  assert.strictEqual(marketplaceClasses.has('fb-layout-tweaks-feed-media-h50'), false, 'Feed media must be stripped on Marketplace');
});

test('Lightbox / photo viewer stage is immune to centerMainFeed X-axis offset', () => {
  const fs = require('fs');
  const path = require('path');
  const cssPath = path.join(__dirname, '..', 'src', 'content', 'content.css');
  const cssContent = fs.readFileSync(cssPath, 'utf8');

  // 1. Verify CSS rules for centerMainFeed exclude dialogs, modals, and media overlays
  assert.ok(
    cssContent.includes(':is([role="main"], [data-pagelet="Feed"]):not(:is([role="dialog"], [aria-modal="true"], [data-pagelet*="Media"], [data-pagelet*="Photo"], [data-pagelet*="Tahoe"]) *)'),
    'Center feed rules must exclude descendants of dialog, aria-modal, and Media/Photo overlays'
  );

  // 2. Verify document-level suspension when a lightbox overlay is present
  assert.ok(
    cssContent.includes('html.fb-layout-tweaks-center-main-feed:has(:is([role="dialog"], [aria-modal="true"], [data-pagelet*="Media"], [data-pagelet*="Photo"], [data-pagelet*="Tahoe"])) :is([role="main"], [data-pagelet="Feed"])'),
    'Must suspend feed translateX transform when any lightbox overlay is mounted in DOM'
  );

  // 3. Verify explicit immunity reset for photo viewer stage
  assert.ok(
    cssContent.includes(':is([role="dialog"], [aria-modal="true"], [data-pagelet*="Media"], [data-pagelet*="Photo"], [data-pagelet*="Tahoe"]) :is([role="main"], [data-pagelet="Feed"])'),
    'Must provide explicit transform: none immunity for photo stage [role="main"] inside dialogs'
  );

  // 4. Verify feed width depths 1-5 also exclude dialogs
  assert.ok(
    cssContent.includes('[role="main"]:not(:is([role="dialog"], [aria-modal="true"], [data-pagelet*="Media"], [data-pagelet*="Photo"], [data-pagelet*="Tahoe"]) *) > div'),
    'Feed width column release must not constrain depths inside lightbox dialogs'
  );
});

