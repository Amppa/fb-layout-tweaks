// tests/feed-width.test.js
// Automated verification for Facebook feed width options and horizontal overflow prevention.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const cssPath = path.join(__dirname, '..', 'src', 'content', 'content.css');
const cssContent = fs.readFileSync(cssPath, 'utf8');

test('Document & layout viewport containment prevents horizontal scrollbars in feed width modes', () => {
  // 1. Root has overflow-x containment without trapping body into a second scroll container
  assert.ok(
    cssContent.includes('html[class*="fb-layout-tweaks-feed-width-"] {') &&
    cssContent.includes('overflow-x: hidden !important;'),
    'Root must enforce overflow-x: hidden in widened feed width modes'
  );
  assert.ok(
    !cssContent.includes('html[class*="fb-layout-tweaks-feed-width-"] body'),
    'Body must not have overflow-x: hidden to prevent secondary vertical scrollbars'
  );

  // 2. Three-column flex wrapper has overflow-x containment
  assert.ok(
    cssContent.includes(':has(> :is([role="main"], [data-pagelet="Feed"])):not(:is([role="dialog"], [aria-modal="true"], [data-pagelet*="Media"], [data-pagelet*="Photo"], [data-pagelet*="Tahoe"]) *)') &&
    cssContent.includes('overflow-x: clip !important;'),
    'Three-column flex wrapper must have overflow-x: clip to contain widened child items'
  );

  // 3. [role="main"] has min-width: 0 to allow flex shrinking
  assert.ok(
    cssContent.includes(':is([role="main"], [data-pagelet="Feed"]):not(:is([role="dialog"], [aria-modal="true"], [data-pagelet*="Media"], [data-pagelet*="Photo"], [data-pagelet*="Tahoe"]) *)') &&
    cssContent.includes('min-width: 0 !important;'),
    '[role="main"] must specify min-width: 0 to allow flex container shrinking'
  );

  // 4. Stories & reels carousel tray has overflow-x clip containment
  assert.ok(
    cssContent.includes('html[class*="fb-layout-tweaks-feed-width-"] div[data-pagelet^="Stories"]') &&
    cssContent.includes('overflow-x: clip !important;'),
    'Stories tray must enforce overflow-x: clip to prevent multi-card carousels from spilling horizontally'
  );

  // 5. Floating pills / anchors inside feed column are protected against inflating
  assert.ok(
    cssContent.includes(':is(.xbudbmw, [class*="xbudbmw"])') &&
    cssContent.includes('max-width: 0 !important;'),
    'Floating pills like .xbudbmw must be constrained to 0 max-width to prevent horizontal overhang'
  );

  // 6. Feed column containers must not use :has(.xbudbmw) to avoid collapsing the entire column
  assert.ok(
    !cssContent.includes(':has(.xbudbmw)'),
    'Feed column containers must never use :has(.xbudbmw) to avoid collapsing the entire feed column upon new posts'
  );
});

test('Right rail parent wrapper collapses cleanly only when it is an only-child wrapper', () => {
  assert.ok(
    cssContent.includes('html.fb-layout-tweaks-hide-right-rail .fb-layout-tweaks-right-rail-parent:has(> :is(.fb-layout-tweaks-right-rail, [data-pagelet="RightRail"], #right_rail_container, div[role="complementary"]):only-child)'),
    'Right rail parent wrapper must only collapse when right rail is an only-child to prevent hiding sibling main feed'
  );
});

test('Articles and feed units expand to 100% column width without compound percentage shrinking', () => {
  assert.ok(
    cssContent.includes('html[class*="fb-layout-tweaks-feed-width-"] :is(div[role="feed"] > div, div[data-pagelet^="FeedUnit"], div[role="article"])') &&
    cssContent.includes('width: 100% !important;'),
    'Feed articles must occupy 100% of the widened column without compound percentage reduction'
  );
});
