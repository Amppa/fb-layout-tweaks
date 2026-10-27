/**
 * FB Layout Tweaks - Content Script
 * Applies CSS class tokens to document.documentElement based on user preferences,
 * and runs a targeted dynamic scan for asynchronous items like Ads Manager.
 */

(() => {
  let currentSettings = null;
  let expandTimer = null;
  let collapseTimer = null;
  let isRailExpanded = false;
  let rightExpandTimer = null;
  let rightCollapseTimer = null;
  let isRightRailExpanded = false;

  function nowMs() {
    return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  }

  const LABEL_SCAN_COOLDOWN_MS = 1000;
  let adsLabelScanAfter = 0;
  let crisisLabelScanAfter = 0;
  let adsManagerTaggedEl = null;
  let crisisResponseTaggedEl = null;

  function resetLeftRailLabelScanCache() {
    adsLabelScanAfter = 0;
    crisisLabelScanAfter = 0;
    adsManagerTaggedEl = null;
    crisisResponseTaggedEl = null;
  }

  const RAIL_MISS_COOLDOWN_MS = 250;
  const RIGHT_RAIL_SCAN_COOLDOWN_MS = 1000;
  let leftRailTaggedEl = null;
  let rightRailTaggedEl = null;
  let leftRailMissAfter = 0;
  let rightRailMissAfter = 0;
  let rightSponsoredScanAfter = 0;
  let rightBirthdaysScanAfter = 0;
  let rightMetaAiScanAfter = 0;
  let rightSponsoredTaggedEl = null;
  let rightBirthdaysTaggedEl = null;
  let rightMetaAiTaggedEl = null;

  function isConnectedEl(el) {
    return Boolean(el && el.isConnected !== false);
  }

  function isDescendantOf(child, parent) {
    if (!child || !parent) return false;
    if (child === parent) return true;
    if (typeof parent.contains === 'function') {
      try {
        return parent.contains(child);
      } catch (_) {}
    }
    let curr = child.parentElement;
    while (curr) {
      if (curr === parent) return true;
      curr = curr.parentElement;
    }
    return false;
  }

  function resetRailTaggingMissCache() {
    leftRailMissAfter = 0;
    rightRailMissAfter = 0;
  }

  function resetRightRailScanCache() {
    rightSponsoredScanAfter = 0;
    rightBirthdaysScanAfter = 0;
    rightMetaAiScanAfter = 0;
    rightSponsoredTaggedEl = null;
    rightBirthdaysTaggedEl = null;
    rightMetaAiTaggedEl = null;
  }

  function setRailExpanded(expanded) {
    if (isRailExpanded === expanded) return;
    isRailExpanded = expanded;
    document.documentElement.classList.toggle('fb-layout-tweaks-rail-expanded', expanded);
  }

  function setRightRailExpanded(expanded) {
    if (isRightRailExpanded === expanded) return;
    isRightRailExpanded = expanded;
    document.documentElement.classList.toggle('fb-layout-tweaks-right-rail-expanded', expanded);
  }

  function getUiCleanClassName(key) {
    // Maps show* settings keys to hide-based fb-layout-tweaks-* CSS tokens
    // (content.css rules suppress elements when the hide token is present).
    if (key === 'showLeftMetaAI') return 'fb-layout-tweaks-hide-left-metaai';
    if (key === 'showRightMetaAI') return 'fb-layout-tweaks-hide-right-metaai';
    return 'fb-layout-tweaks-' + key.replace(/^show/, 'hide').replace(/([A-Z])/g, '-$1').toLowerCase();
  }

  function deriveLayoutClasses(settings, isSidebarActive) {
    const classes = new Set();
    if (!settings || settings.enabled === false) return classes;

    const trimTopNav = settings.trimTopNav !== false;
    const trimLeftItems = isSidebarActive && settings.trimLeftItems !== false;
    const rightRailMode = normalizeRightRailMode(settings.trimRightRail, isSidebarActive);
    const isHoverRightRail = rightRailMode === 'hover';
    const isHideRightRail = rightRailMode === 'hidden';
    const trimMainFeed = isSidebarActive && settings.trimMainFeed !== false;

    for (const [key, value] of Object.entries(settings)) {
      if (!key.startsWith('show')) continue;
      if (key === 'showLeftProfile') continue; // Fixed anchor (Profile) has no hide rule
      const sectionActive = key.startsWith('showTop') ? trimTopNav
        : key.startsWith('showRight') ? (rightRailMode !== 'visible')
        : trimLeftItems;
      if (sectionActive && value === false) {
        classes.add(getUiCleanClassName(key));
      }
    }

    if (isSidebarActive && Boolean(settings.hoverExpandLeftRail)) {
      classes.add('fb-layout-tweaks-hover-expand-left-rail');
    }
    if (isHoverRightRail) {
      classes.add('fb-layout-tweaks-hover-expand-right-rail');
    }
    if (isHideRightRail) {
      classes.add('fb-layout-tweaks-hide-right-rail');
    }

    if (trimMainFeed && Boolean(settings.centerMainFeed)) {
      classes.add('fb-layout-tweaks-center-main-feed');
    }

    if (Boolean(settings.extendShareToGroupList)) {
      classes.add('fb-layout-tweaks-extend-share-to-group-list');
    }

    if (trimMainFeed) {
      const feedWidth = settings.feedWidth;
      if (feedWidth === 'w50') classes.add('fb-layout-tweaks-feed-width-50');
      else if (feedWidth === 'w75') classes.add('fb-layout-tweaks-feed-width-75');
      else if (feedWidth === 'w100') classes.add('fb-layout-tweaks-feed-width-100');
      else if (feedWidth === 'w1000') classes.add('fb-layout-tweaks-feed-width-1000');
      else if (feedWidth === 'w1600') classes.add('fb-layout-tweaks-feed-width-1600');

      const feedFontSize = settings.feedFontSize;
      if (feedFontSize === 'f150') classes.add('fb-layout-tweaks-feed-font-150');
      else if (feedFontSize === 'f200') classes.add('fb-layout-tweaks-feed-font-200');
      else if (feedFontSize === 'f300') classes.add('fb-layout-tweaks-feed-font-300');

      const feedMediaHeight = settings.feedMediaHeight;
      if (feedMediaHeight === 'h75') classes.add('fb-layout-tweaks-feed-media-h75');
      else if (feedMediaHeight === 'h50') classes.add('fb-layout-tweaks-feed-media-h50');
      else if (feedMediaHeight === 'h25') classes.add('fb-layout-tweaks-feed-media-h25');
      else if (feedMediaHeight === 'px400') classes.add('fb-layout-tweaks-feed-media-px400');
      else if (feedMediaHeight === 'px300') classes.add('fb-layout-tweaks-feed-media-px300');
      else if (feedMediaHeight === 'px200') classes.add('fb-layout-tweaks-feed-media-px200');
    }

    return classes;
  }

  function applyUiCleanClasses(settings) {
    if (!settings) return;
    resetLeftRailLabelScanCache();
    resetRailTaggingMissCache();
    resetRightRailScanCache();
    const root = document.documentElement;
    if (!root) return;

    const isMasterEnabled = settings.enabled !== false;
    const isSidebarActive = isSidebarScopeActive(settings);

    const targetClasses = deriveLayoutClasses(settings, isSidebarActive);

    // Synchronize root layout classes efficiently
    const currentClasses = Array.from(root.classList);
    for (const cls of currentClasses) {
      if (cls.startsWith('fb-layout-tweaks-') &&
          cls !== 'fb-layout-tweaks-rail-expanded' &&
          cls !== 'fb-layout-tweaks-right-rail-expanded' &&
          !targetClasses.has(cls)) {
        root.classList.remove(cls);
      }
    }
    for (const cls of targetClasses) {
      if (!root.classList.contains(cls)) {
        root.classList.add(cls);
      }
    }

    // Stop auto refresh: the MAIN-world guard reads this flag at event time.
    if (isMasterEnabled && settings.stopAutoRefresh === true) {
      root.dataset.fbLtStopAutoRefresh = '1';
    } else {
      root.removeAttribute('data-fb-lt-stop-auto-refresh');
    }

    const isHoverExpand = targetClasses.has('fb-layout-tweaks-hover-expand-left-rail');
    const isHoverRightRail = targetClasses.has('fb-layout-tweaks-hover-expand-right-rail');
    const feedMediaHeight = (isMasterEnabled && isSidebarActive && settings.trimMainFeed !== false)
      ? (settings.feedMediaHeight || 'default')
      : 'default';

    if (feedMediaHeight !== 'default') {
      scanAndScaleFeedMedia(feedMediaHeight);
      lastAppliedFeedMediaMode = feedMediaHeight;
    } else if (lastAppliedFeedMediaMode && lastAppliedFeedMediaMode !== 'default') {
      restoreFeedMedia();
      lastAppliedFeedMediaMode = 'default';
    }

    if (!isHoverExpand && isRailExpanded) {
      setRailExpanded(false);
    }
    if (!isHoverRightRail && isRightRailExpanded) {
      setRightRailExpanded(false);
    }

    if (isMasterEnabled) {
      tagRailContainers();
    }

    if (isMasterEnabled && settings.extendShareToGroupList === true) {
      tagShareGroupPanel();
    } else {
      clearShareGroupPanelTags();
    }

    if (isMasterEnabled && (settings.showLeftAdsManager === false || settings.showLeftCrisisResponse === false || settings.showLeftShortcuts === false)) {
      triggerThrottledScan();
    }
    if (!isMasterEnabled || settings.showLeftCrisisResponse !== false) {
      clearCrisisResponseTags();
    }
    if (!isMasterEnabled || settings.showLeftAdsManager !== false) {
      clearAdsManagerTags();
    }
    if (!isMasterEnabled || settings.showLeftShortcuts !== false) {
      clearShortcutsTags();
    }

    if (isHoverRightRail && (settings.showRightSponsored === false || settings.showRightBirthdays === false || settings.showRightMetaAI === false)) {
      triggerThrottledScan();
    }
  }

  function isAdsManagerHidden() {
    if (!currentSettings) return false;
    return currentSettings.showLeftAdsManager === false;
  }

  let lastAppliedFeedMediaMode = null;
  let isFeedScopeActive = false;

  function hasConnectedHomeFeed() {
    if (typeof document === 'undefined') return false;
    const feed = document.querySelector(
      '[data-pagelet="Feed"], div[role="feed"], div[data-pagelet^="FeedUnit"], div[role="article"], [role="main"]'
    );
    return Boolean(feed && feed.isConnected !== false);
  }

  function isOverlayState(pathname) {
    if (typeof document !== 'undefined') {
      const hasOverlayEl = Boolean(
        document.querySelector('[role="dialog"], [aria-modal="true"], [data-pagelet="MediaViewer"], [data-pagelet*="Photo"], [data-pagelet*="Media"]')
      );
      if (hasOverlayEl) return true;
    }
    if (!pathname) return false;
    const p = pathname.toLowerCase();
    return p.includes('photo') ||
      p.includes('/posts/') ||
      p.includes('permalink') ||
      p.includes('/media/') ||
      p.includes('/stories/') ||
      p.includes('/reel/') ||
      p.includes('/watch');
  }

  // Sidebar scope gate shared by layout classes, rail tagging, and feed scans.
  function isSidebarScopeActive(settings) {
    if (!settings || settings.enabled === false) return false;
    if (settings.sidebarScope === 'global') return true;
    if (typeof window === 'undefined' || !window.location) return true;
    const pathname = window.location.pathname;
    const isFeed = (typeof self !== 'undefined' && self.isFeedPage)
      ? self.isFeedPage(pathname)
      : true;

    if (isFeed) {
      isFeedScopeActive = true;
      return true;
    }

    // Modal/overlay state: if already in feed scope, keep active while in overlay state
    if (isFeedScopeActive && (isOverlayState(pathname) || hasConnectedHomeFeed())) {
      // Only deactivate if explicitly navigating to a top-level non-feed standalone section
      const norm = (pathname.length > 1 && pathname.endsWith('/')) ? pathname.slice(0, -1) : pathname;
      const nonFeedRoutes = ['/marketplace', '/friends', '/gaming', '/messages', '/events', '/saved', '/memories', '/settings', '/groups'];
      const isExplicitNonFeed = nonFeedRoutes.some(r => norm === r || norm.startsWith(r + '/'));
      if (!isExplicitNonFeed) {
        return true;
      }
    }

    isFeedScopeActive = false;
    return false;
  }

  // Left sidebar scans only matter when the sidebar master switch is on and the
  // current page is in the configured sidebar scope (mirrors applyUiCleanClasses).
  function isLeftSidebarActive(settings) {
    return isSidebarScopeActive(settings) && settings.trimLeftItems !== false;
  }

  // The left rail class also drives hover-expand, which works independently of
  // the trimLeftItems switch.
  function isLeftRailTaggingNeeded(settings) {
    return isSidebarScopeActive(settings)
      && (settings.trimLeftItems !== false || settings.hoverExpandLeftRail === true || settings.showLeftShortcuts === false);
  }

  // Right-rail tagging is needed for both hidden and hover modes; only visible
  // mode has no right-rail CSS to apply.
  function isRightRailTaggingNeeded(settings) {
    return isSidebarScopeActive(settings)
      && normalizeRightRailMode(settings.trimRightRail, true) !== 'visible';
  }

  const ADS_MANAGER_NODE_CLASS = 'fb-layout-tweaks-hide-left-ads-manager-node';
  const ADS_MANAGER_TEXTS = new Set([
    'ads manager',
    '廣告管理員',
    '廣告分析',
    '廣告中心',
    'ad center',
    'ad insights',
    'meta ads',
    'meta 廣告'
  ]);

  const PRIMARY_BOOKMARKS_SELECTOR = 'ul, a[href*="/friends"], a[href*="/saved"], a[href*="/memories"], a[href*="/feeds"], a[href*="/marketplace"], a[href*="/groups"], a[href*="/events"], a[href="/"]';

  function isPrimaryBookmarksContainer(node) {
    if (!node || typeof node !== 'object') return true;
    if (typeof document !== 'undefined' && (node === document.body || node === document.documentElement)) return true;
    if (node.tagName === 'UL' || node.tagName === 'NAV') return true;
    if (typeof node.matches === 'function' && node.matches('.fb-layout-tweaks-left-rail, [data-pagelet="LeftRail"], div[role="navigation"]')) {
      return true;
    }
    if (typeof node.querySelector === 'function' && node.querySelector(PRIMARY_BOOKMARKS_SELECTOR)) {
      return true;
    }
    return false;
  }

  function findLeftBookmarkRow(el, root) {
    if (!el || el === root) return null;
    const row = el.closest ? el.closest('li, [role="listitem"]') : null;
    if (row && row !== root && !isPrimaryBookmarksContainer(row)) {
      return row;
    }
    const link = el.closest ? el.closest('a') : null;
    if (link && !isPrimaryBookmarksContainer(link)) {
      return link;
    }
    return !isPrimaryBookmarksContainer(el) ? el : null;
  }

  function clearAdsManagerTags() {
    adsManagerTaggedEl = null;
    if (typeof document === 'undefined') return;
    const tagged = document.querySelectorAll(`.${ADS_MANAGER_NODE_CLASS}`);
    for (const el of tagged) {
      el.classList.remove(ADS_MANAGER_NODE_CLASS);
    }
  }

  // Crisis Response is rendered as a bookmark without a stable href in some
  // rollouts, so fall back to matching its visible label.
  const CRISIS_RESPONSE_LABELS = new Set(['crisis response', '危機回應', '危機應變', '危机响应']);
  const CRISIS_RESPONSE_NODE_CLASS = 'fb-layout-tweaks-hide-left-crisis-response-node';

  function clearCrisisResponseTags() {
    crisisResponseTaggedEl = null;
    if (typeof document === 'undefined') return;
    const tagged = document.querySelectorAll(`.${CRISIS_RESPONSE_NODE_CLASS}`);
    for (const el of tagged) {
      el.classList.remove(CRISIS_RESPONSE_NODE_CLASS);
    }
  }

  function tagCrisisResponseRows(root) {
    if (typeof document === 'undefined' || !root) return;
    const scope = (root === document.body)
      ? (document.querySelector('.fb-layout-tweaks-left-rail, [data-pagelet="LeftRail"], div[role="navigation"]:not(header *):not([role="banner"] *)') || null)
      : root;
    if (!scope) return;

    if (isConnectedEl(crisisResponseTaggedEl) && isDescendantOf(crisisResponseTaggedEl, scope)) return;
    crisisResponseTaggedEl = null;

    const alreadyTagged = scope.querySelector(`.${CRISIS_RESPONSE_NODE_CLASS}`);
    if (alreadyTagged && alreadyTagged.isConnected !== false) {
      crisisResponseTaggedEl = alreadyTagged;
      return;
    }

    // Prefer the bookmark href; it is stable and language-independent.
    const links = scope.querySelectorAll('a[href*="crisisresponse"], a[href*="crisis_response"]');
    for (const link of links) {
      const row = findLeftBookmarkRow(link, scope);
      if (row) {
        row.classList.add(CRISIS_RESPONSE_NODE_CLASS);
        if (!crisisResponseTaggedEl) crisisResponseTaggedEl = row;
      }
    }
    if (links.length > 0) return;

    // Fallback: match the visible label when the row has no anchor. Cache
    // misses so rollouts without the bookmark do not re-walk the rail every scan.
    const now = nowMs();
    if (now < crisisLabelScanAfter) return;

    const spans = scope.querySelectorAll('span');
    let found = false;
    for (const span of spans) {
      if (span.children && span.children.length !== 0) continue;
      const label = (span.textContent || '').trim().replace(/\s+/g, ' ').toLowerCase();
      if (!CRISIS_RESPONSE_LABELS.has(label)) continue;

      const row = findLeftBookmarkRow(span, scope);
      if (!row) continue;

      row.classList.add(CRISIS_RESPONSE_NODE_CLASS);
      crisisResponseTaggedEl = row;
      found = true;
      break;
    }
    if (!found) crisisLabelScanAfter = now + LABEL_SCAN_COOLDOWN_MS;
  }

  const SHORTCUTS_NODE_CLASS = 'fb-layout-tweaks-hide-left-shortcuts-node';
  const SHORTCUTS_HEADING_TEXTS = new Set([
    'your shortcuts',
    '你的捷徑',
    '你的快捷方式',
    'ショートカット',
    'tus accesos directos',
    'seus atalhos',
    'vos raccourcis',
    'deine shortcuts',
    'deine verknüpfungen'
  ]);

  function clearShortcutsTags() {
    if (typeof document === 'undefined') return;
    const tagged = document.querySelectorAll('.' + SHORTCUTS_NODE_CLASS);
    for (const el of tagged) {
      el.classList.remove(SHORTCUTS_NODE_CLASS);
    }
  }

  function isSafeShortcutsNode(el) {
    return !isPrimaryBookmarksContainer(el);
  }

  function tagShortcutsSection(root) {
    if (!root) return;
    const alreadyTagged = root.querySelector('.' + SHORTCUTS_NODE_CLASS);
    if (alreadyTagged && alreadyTagged.isConnected !== false) return;

    let targetOrigin = null;

    // 1. Search for heading by text content
    const headings = root.querySelectorAll('[role="heading"], h2, h3, h4, span');
    for (const h of headings) {
      if (h.children.length === 0) {
        const text = h.textContent.trim().toLowerCase();
        if (SHORTCUTS_HEADING_TEXTS.has(text)) {
          targetOrigin = h;
          break;
        }
      }
    }

    // 2. Fallback: Search for "Edit Shortcuts" button
    if (!targetOrigin) {
      const editBtn = root.querySelector(
        'a[href*="edit/shortcuts"], a[href*="shortcuts/edit"], a[href*="bookmarks/edit"], [aria-label*="shortcuts" i], [aria-label*="捷徑"]'
      );
      if (editBtn) targetOrigin = editBtn;
    }

    if (!targetOrigin) return;

    // Climb up to the highest container within the rail that does NOT contain primary bookmarks
    let targetBlock = targetOrigin;
    while (targetBlock.parentElement && targetBlock.parentElement !== root && isSafeShortcutsNode(targetBlock.parentElement)) {
      targetBlock = targetBlock.parentElement;
    }

    if (!isSafeShortcutsNode(targetBlock)) return;

    // A) Tag preceding separator if present
    const prev = targetBlock.previousElementSibling;
    if (prev && isSafeShortcutsNode(prev)) {
      if ((typeof prev.getAttribute === 'function' && prev.getAttribute('role') === 'separator') ||
          (typeof prev.querySelector === 'function' && prev.querySelector('[role="separator"]'))) {
        prev.classList.add(SHORTCUTS_NODE_CLASS);
      }
    }

    // B) Tag the shortcuts header/section block
    targetBlock.classList.add(SHORTCUTS_NODE_CLASS);

    // C) Tag following sibling lists/items (e.g., shortcut links ul/div) until footer is reached
    let sibling = targetBlock.nextElementSibling;
    while (sibling && isSafeShortcutsNode(sibling)) {
      if (typeof sibling.querySelector === 'function' &&
          sibling.querySelector('a[href*="privacy"], a[href*="policies"], a[href*="cookies"], a[href*="/terms/"]')) {
        break;
      }
      if (typeof sibling.getAttribute === 'function' && sibling.getAttribute('role') === 'contentinfo') {
        break;
      }
      sibling.classList.add(SHORTCUTS_NODE_CLASS);
      sibling = sibling.nextElementSibling;
    }
  }

  function scanLeftRailDynamicItems(settings = currentSettings) {
    try {
      if (!settings || settings.enabled === false) return;
      if (!isLeftSidebarActive(settings)) return;

      const hideAdsManager = settings.showLeftAdsManager === false;
      const hideCrisisResponse = settings.showLeftCrisisResponse === false;
      const hideShortcuts = settings.showLeftShortcuts === false;
      if (!hideAdsManager && !hideCrisisResponse && !hideShortcuts) return;

      if (!isConnectedEl(leftRailTaggedEl) && nowMs() < leftRailMissAfter) return;
      const leftRail = isConnectedEl(leftRailTaggedEl)
        ? leftRailTaggedEl
        : document.querySelector(
          '.fb-layout-tweaks-left-rail, [data-pagelet="LeftRail"], div[role="navigation"]:not(header *):not([role="banner"] *)'
        );
      if (!leftRail) return;
      const root = leftRail;

      let spansCount = 0;
      let candidateCount = 0;

      if (hideAdsManager) {
        // Fast-path: check in-memory reference first, then fallback to DOM class query
        const isTagged = (isConnectedEl(adsManagerTaggedEl) && isDescendantOf(adsManagerTaggedEl, root))
          || Boolean(root.querySelector(`.${ADS_MANAGER_NODE_CLASS}`));
        if (isTagged) {
          if (!adsManagerTaggedEl || !isDescendantOf(adsManagerTaggedEl, root)) {
            adsManagerTaggedEl = root.querySelector(`.${ADS_MANAGER_NODE_CLASS}`);
          }
          if (!hideCrisisResponse && !hideShortcuts) {
            return { spansCount: 0, candidateCount: 0, cached: true };
          }
        } else {
          adsManagerTaggedEl = null;
          const candidates = root.querySelectorAll(
            'a[href*="adsmanager"], a[href*="ads/manager"], a[href*="ads/manage"], a[href*="ad_campaign"], a[href*="bkmk_admgr"], a[href*="ad_center"], a[href*="adcenter"], a[href*="ad_insights"], ' +
            '[aria-label*="廣告管理員"], [aria-label*="廣告分析"], [aria-label*="廣告中心"], [aria-label*="Ads Manager" i], [aria-label*="Ad Center" i]'
          );
          for (const el of candidates) {
            const row = findLeftBookmarkRow(el, root);
            if (row) {
              row.classList.add(ADS_MANAGER_NODE_CLASS);
              if (!adsManagerTaggedEl) adsManagerTaggedEl = row;
            }
          }
          candidateCount += candidates.length;

          // Performance: only fall back to scanning spans if attribute selectors
          // found no candidates, and remember misses so accounts without this
          // bookmark do not re-walk the rail on every scan.
          if (candidates.length === 0) {
            const now = nowMs();
            if (now >= adsLabelScanAfter) {
              const spans = root.querySelectorAll('span');
              spansCount += spans.length;
              let found = false;
              for (const span of spans) {
                if (!span.children || span.children.length <= 1) {
                  const text = (span.textContent || '').trim().toLowerCase();
                  if (text && ADS_MANAGER_TEXTS.has(text)) {
                    const row = findLeftBookmarkRow(span, root);
                    if (row) {
                      row.classList.add(ADS_MANAGER_NODE_CLASS);
                      if (!adsManagerTaggedEl) adsManagerTaggedEl = row;
                      found = true;
                      break;
                    }
                  }
                }
              }
              if (!found) adsLabelScanAfter = now + LABEL_SCAN_COOLDOWN_MS;
            }
          }
        }
      }

      if (hideCrisisResponse && document.documentElement.classList.contains('fb-layout-tweaks-hide-left-crisis-response')) {
        tagCrisisResponseRows(root);
      }

      if (hideShortcuts && document.documentElement.classList.contains('fb-layout-tweaks-hide-left-shortcuts')) {
        tagShortcutsSection(root);
      }

      return { spansCount, candidateCount };
    } catch (e) {
      // Non-fatal
    }
  }

  function normalizeRightRailMode(rawVal, isSidebarActive) {
    if (!isSidebarActive) return 'visible';
    if (rawVal === 'hover' || rawVal === true) return 'hover';
    if (rawVal === 'visible' || rawVal === false) return 'visible';
    return 'hidden';
  }

  function isRightRailActive(settings = currentSettings) {
    if (!settings || settings.enabled === false) return false;
    const mode = settings.trimRightRail;
    return mode === 'hover' || mode === true;
  }

  function scanRightRailDynamicItems(settings = currentSettings) {
    try {
      if (!isRightRailActive(settings)) return;
      if (!settings) return;
      if (!isConnectedEl(rightRailTaggedEl) && nowMs() < rightRailMissAfter) return;
      const rail = isConnectedEl(rightRailTaggedEl)
        ? rightRailTaggedEl
        : (document.getElementById('right_rail_container')
          || document.querySelector('[data-pagelet="RightRail"] div[role="complementary"]')
          || document.querySelector('div[role="complementary"][data-pagelet="RightRail"]')
          || document.querySelector('[data-pagelet="RightRail"]')
          || document.querySelector('div[role="complementary"]:not([role="dialog"] *):not([aria-modal="true"] *):not([role="main"] *):not([data-pagelet*="Photo"] *):not([data-pagelet*="Media"] *)'));
      if (!rail) return;
      if (rail.closest('[role="dialog"], [aria-modal="true"], [role="main"], [data-pagelet*="Photo"], [data-pagelet*="Media"], [data-pagelet*="Tahoe"]')) return;

      const now = nowMs();

      // Sponsored: heading-text anchor only (no stable link). Walk up from the
      // heading while the ancestor holds a single h3; the first multi-h3
      // ancestor is the section boundary, so the last single-h3 node is the
      // Sponsored section root. Aborts at rail/depth cap to avoid over-hiding.
      if (settings.showRightSponsored === false) {
        if (!isConnectedEl(rightSponsoredTaggedEl)) {
          rightSponsoredTaggedEl = null;
          if (now >= rightSponsoredScanAfter) {
            const headings = rail.querySelectorAll('h3');
            let found = false;
            for (const h of headings) {
              if (h.closest('.fb-layout-tweaks-hide-right-sponsored-node')) continue;
              const title = h.textContent.replace(/[\u200b-\u200f\ufeff]/g, '').trim().toLowerCase();
              if (title !== 'sponsored' && !title.startsWith('贊助')) continue;
              let node = h.parentElement;
              let section = null;
              for (let depth = 0; depth < 15 && node && node !== rail; depth++) {
                if (node.querySelectorAll(':scope h3').length > 1) break;
                section = node;
                node = node.parentElement;
              }
              if (section && node && node !== rail) {
                section.classList.add('fb-layout-tweaks-hide-right-sponsored-node');
                rightSponsoredTaggedEl = section;
                found = true;
                break;
              }
            }
            rightSponsoredScanAfter = found ? 0 : now + RIGHT_RAIL_SCAN_COOLDOWN_MS;
          }
        }
      } else {
        rightSponsoredTaggedEl = null;
      }

      // Birthdays: hide the whole section (heading + row). Anchor on the stable
      // /events/birthdays/ link, then walk up to the smallest ancestor holding an h3.
      if (settings.showRightBirthdays === false) {
        if (!isConnectedEl(rightBirthdaysTaggedEl)) {
          rightBirthdaysTaggedEl = null;
          if (now >= rightBirthdaysScanAfter) {
            const links = rail.querySelectorAll('a[href*="/events/birthdays/"]');
            let found = false;
            for (const el of links) {
              if (el.closest('.fb-layout-tweaks-hide-right-birthdays-node')) continue;
              let node = el.parentElement;
              while (node && node !== rail) {
                const heading = node.querySelector(':scope h3');
                if (heading) {
                  const title = heading.textContent.trim().toLowerCase();
                  if (title === 'birthdays' || title === '生日') {
                    node.classList.add('fb-layout-tweaks-hide-right-birthdays-node');
                    rightBirthdaysTaggedEl = node;
                    found = true;
                  }
                  break;
                }
                node = node.parentElement;
              }
              if (found) break;
            }
            rightBirthdaysScanAfter = found ? 0 : now + RIGHT_RAIL_SCAN_COOLDOWN_MS;
          }
        }
      } else {
        rightBirthdaysTaggedEl = null;
      }

      // Meta AI row fallback (primary rule is static CSS on the aria-label icon).
      if (settings.showRightMetaAI === false) {
        if (!isConnectedEl(rightMetaAiTaggedEl)) {
          rightMetaAiTaggedEl = null;
          if (now >= rightMetaAiScanAfter) {
            const spans = rail.querySelectorAll('span');
            let found = false;
            for (const span of spans) {
              if (span.closest('.fb-layout-tweaks-hide-right-metaai-node')) continue;
              const hasName = Array.from(span.childNodes).some(
                n => n.nodeType === Node.TEXT_NODE && n.textContent.trim() === 'Meta AI'
              );
              if (!hasName) continue;
              const row = span.closest('li');
              if (row) {
                row.classList.add('fb-layout-tweaks-hide-right-metaai-node');
                rightMetaAiTaggedEl = row;
                found = true;
                break;
              }
            }
            rightMetaAiScanAfter = found ? 0 : now + RIGHT_RAIL_SCAN_COOLDOWN_MS;
          }
        }
      } else {
        rightMetaAiTaggedEl = null;
      }
    } catch (e) {
      // Non-fatal
    }
  }

  const RIGHT_RAIL_EXCLUDE_ANCESTORS = '[role="dialog"], [aria-modal="true"], [role="main"], [data-pagelet*="Photo"], [data-pagelet*="Media"], [data-pagelet*="Tahoe"]';

  // Share → To a group: Facebook caps the group picker with
  // height: calc(100vh - 500px) (about 3 rows). Tag the panel and its scroll
  // container so content.css can lengthen the visible list.
  const SHARE_GROUP_PANEL_CLASS = 'fb-layout-tweaks-share-group-panel';
  const SHARE_GROUP_SCROLL_CLASS = 'fb-layout-tweaks-share-group-scroll';

  function clearShareGroupPanelTags() {
    if (typeof document === 'undefined') return;
    const tagged = document.querySelectorAll(`.${SHARE_GROUP_PANEL_CLASS}, .${SHARE_GROUP_SCROLL_CLASS}`);
    for (const el of tagged) {
      el.classList.remove(SHARE_GROUP_PANEL_CLASS, SHARE_GROUP_SCROLL_CLASS);
    }
  }

  function tagShareGroupPanel() {
    try {
      if (typeof document === 'undefined') return;

      // The group picker only exists inside an open share dialog. Gate on that
      // first so ordinary feed mutations never scan the whole document.
      const dialogs = document.querySelectorAll('[role="dialog"], [aria-modal="true"]');
      if (!dialogs.length) return;

      for (const dialog of dialogs) {
        const searchInputs = dialog.querySelectorAll('input[type="search"]');
        for (const input of searchInputs) {
          // The picker pairs its group list with a search field in the same panel.
          let panel = input.parentElement;
          let matchedPanel = null;
          let groupLink = null;
          for (let depth = 0; depth < 8 && panel && panel !== document.body; depth++) {
            groupLink = panel.querySelector('div[role="list"] a[href*="/groups/"]');
            if (groupLink) {
              matchedPanel = panel;
              break;
            }
            panel = panel.parentElement;
          }
          if (!matchedPanel || !groupLink) continue;

          const list = groupLink.closest('div[role="list"]');
          // Skip navigation rails and other non-picker group lists.
          if (!list || list.closest('[role="navigation"], [role="banner"], [data-pagelet="LeftRail"]')) continue;

          matchedPanel.classList.add(SHARE_GROUP_PANEL_CLASS);

          // The nearest scrollable ancestor holds the fixed height that caps rows.
          let scroller = list.parentElement;
          while (scroller && scroller !== matchedPanel) {
            const overflowY = window.getComputedStyle(scroller).overflowY;
            if (overflowY === 'auto' || overflowY === 'scroll') {
              scroller.classList.add(SHARE_GROUP_SCROLL_CLASS);
              break;
            }
            scroller = scroller.parentElement;
          }
          return;
        }
      }
    } catch (e) {
      // Non-fatal
    }
  }

  function tagRailContainers(force = false) {
    try {
      if (typeof document === 'undefined') return;

      const now = nowMs();
      const leftNeeded = isLeftRailTaggingNeeded(currentSettings);
      const rightNeeded = isRightRailTaggingNeeded(currentSettings);

      if (!force) {
        const leftOk = !leftNeeded || isConnectedEl(leftRailTaggedEl) || now < leftRailMissAfter;
        const rightOk = !rightNeeded || isConnectedEl(rightRailTaggedEl) || now < rightRailMissAfter;
        if (leftOk && rightOk) {
          return {
            leftCount: isConnectedEl(leftRailTaggedEl) ? 1 : 0,
            rightCount: isConnectedEl(rightRailTaggedEl) ? 1 : 0
          };
        }
      }

      let leftCount = 0;
      let rightCount = 0;

      if ((force || leftNeeded) && (force || now >= leftRailMissAfter)) {
        const leftCandidates = document.querySelectorAll(
          '[data-pagelet="LeftRail"], div[role="navigation"]:not(header *):not([role="banner"] *):not([data-pagelet="Header"] *)'
        );
        let firstTagged = null;
        for (const el of leftCandidates) {
          if (el.parentElement && el.parentElement.closest('[data-pagelet="LeftRail"], .fb-layout-tweaks-left-rail')) {
            continue;
          }
          leftCount++;
          if (!el.classList.contains('fb-layout-tweaks-left-rail')) {
            el.classList.add('fb-layout-tweaks-left-rail');
          }
          if (!firstTagged) firstTagged = el;
          let parent = el.parentElement;
          if (parent && parent !== document.body && !parent.classList.contains('fb-layout-tweaks-left-rail-parent')) {
            parent.classList.add('fb-layout-tweaks-left-rail-parent');
          }
        }
        if (firstTagged) {
          leftRailTaggedEl = firstTagged;
          leftRailMissAfter = 0;
        } else {
          leftRailTaggedEl = null;
          leftRailMissAfter = now + RAIL_MISS_COOLDOWN_MS;
        }
      }

      // Tag genuine Right Rail containers (strictly excluding photo/dialog overlays and nested descendants)
      if ((force || rightNeeded) && (force || now >= rightRailMissAfter)) {
        const rightCandidates = document.querySelectorAll(
          '#right_rail_container, [data-pagelet="RightRail"], div[role="complementary"]'
        );
        let firstTagged = null;
        for (const el of rightCandidates) {
          if (el.closest(RIGHT_RAIL_EXCLUDE_ANCESTORS)) {
            el.classList.remove('fb-layout-tweaks-right-rail');
            continue;
          }
          if (el.parentElement && el.parentElement.closest('#right_rail_container, [data-pagelet="RightRail"], .fb-layout-tweaks-right-rail')) {
            continue;
          }
          rightCount++;
          if (!el.classList.contains('fb-layout-tweaks-right-rail')) {
            el.classList.add('fb-layout-tweaks-right-rail');
          }
          if (!firstTagged) firstTagged = el;
          let parent = el.parentElement;
          if (parent && parent !== document.body && !parent.classList.contains('fb-layout-tweaks-right-rail-parent')) {
            parent.classList.add('fb-layout-tweaks-right-rail-parent');
          }
        }
        if (firstTagged) {
          if (rightRailTaggedEl !== firstTagged) resetRightRailScanCache();
          rightRailTaggedEl = firstTagged;
          rightRailMissAfter = 0;
        } else {
          rightRailTaggedEl = null;
          rightRailMissAfter = now + RAIL_MISS_COOLDOWN_MS;
        }
      }

      return { leftCount, rightCount };
    } catch (e) {
      // Non-fatal
    }
  }

  // Layout anchors the extension expects on an applicable Facebook page.
  // Zero matches after page settle suggests a Facebook redesign broke targeting.
  const LAYOUT_ANCHOR_SELECTORS = [
    '[data-pagelet="LeftRail"]',
    '[data-pagelet="RightRail"]',
    '[data-pagelet="Feed"]',
    'div[role="feed"]',
    'div[role="navigation"]',
    'div[role="complementary"]',
    '#right_rail_container'
  ];

  function countLayoutAnchors(root) {
    const scope = root || (typeof document !== 'undefined' ? document : null);
    if (!scope || typeof scope.querySelectorAll !== 'function') return 0;
    let count = 0;
    for (const sel of LAYOUT_ANCHOR_SELECTORS) {
      try {
        count += scope.querySelectorAll(sel).length;
      } catch (_) {
        // Skip invalid selectors in this environment.
      }
    }
    return count;
  }

  // Content health check: reports {ok, ts} under the "health" storage key for
  // the background badge. Only runs where tweaks are expected to be active,
  // only writes on state change, and uses delayed checks so async Facebook
  // rendering is not mistaken for breakage.
  let lastReportedHealthOk = null;
  let healthCheckTimers = [];
  const HEALTH_RECOVERY_COOLDOWN_MS = 2000;
  let lastHealthRecoveryAt = 0;

  function clearHealthCheckTimers() {
    for (const t of healthCheckTimers) {
      try { clearTimeout(t); } catch (_) {}
    }
    healthCheckTimers = [];
  }

  function isHealthCheckApplicable() {
    if (!currentSettings || currentSettings.enabled === false) return false;
    if (currentSettings.sidebarScope === 'global') return true;
    const pathname = (typeof window !== 'undefined' && window.location) ? window.location.pathname : '';
    const isFeed = (typeof self !== 'undefined' && self.isFeedPage) ? self.isFeedPage(pathname) : true;
    return isFeed;
  }

  function reportHealth(ok) {
    if (lastReportedHealthOk === ok) return;
    lastReportedHealthOk = ok;
    try {
      const store = (typeof chrome !== 'undefined' && chrome.storage) ? chrome.storage.local : null;
      if (store) {
        const done = store.set({ health: { ok, ts: Date.now() } });
        if (done && typeof done.catch === 'function') done.catch(() => {});
      }
    } catch (_) {
      // Non-fatal
    }
  }

  function evaluateHealth() {
    if (!isHealthCheckApplicable()) return;
    reportHealth(countLayoutAnchors() > 0);
  }

  function scheduleHealthChecks() {
    clearHealthCheckTimers();
    if (!isHealthCheckApplicable()) return;
    // Delayed only: document_start DOM is legitimately empty.
    for (const delayMs of [4000, 10000]) {
      try {
        healthCheckTimers.push(setTimeout(evaluateHealth, delayMs));
      } catch (_) {}
    }
  }

  function recoverHealthIfFound() {
    if (lastReportedHealthOk !== false) return;
    if (!isHealthCheckApplicable()) return;
    const now = nowMs();
    if (lastHealthRecoveryAt && now - lastHealthRecoveryAt < HEALTH_RECOVERY_COOLDOWN_MS) return;
    lastHealthRecoveryAt = now;
    if (countLayoutAnchors() > 0) reportHealth(true);
  }

  let lastPathname = typeof window !== 'undefined' ? window.location.pathname : '';

  function checkUrlChange() {
    if (typeof window === 'undefined') return;
    const currentPath = window.location.pathname;
    if (currentPath !== lastPathname) {
      lastPathname = currentPath;
      if (currentSettings) {
        applyUiCleanClasses(currentSettings);
        scheduleHealthChecks();
      }
    }
  }

  const FEED_MEDIA_SCALE_FACTORS = {
    h75: 0.75,
    h50: 0.5,
    h25: 0.25
  };
  const FEED_MEDIA_PIXEL_LIMITS = {
    px400: 400,
    px300: 300,
    px200: 200
  };

  function scanAndScaleFeedMedia(mode) {
    try {
      if (typeof document === 'undefined') return;
      if (!mode || mode === 'default') {
        restoreFeedMedia();
        return;
      }
      const isFactorMode = FEED_MEDIA_SCALE_FACTORS[mode] !== undefined;
      const isPixelMode = FEED_MEDIA_PIXEL_LIMITS[mode] !== undefined;
      if (!isFactorMode && !isPixelMode) {
        restoreFeedMedia();
        return;
      }

      // Query media image elements inside main feed column with incremental mode stamp exclusion
      const feed = (typeof document.querySelector === 'function' && document.querySelector('[data-pagelet="Feed"], div[role="feed"], [role="main"]')) || document;
      const mediaElements = feed.querySelectorAll(
        `img:not([data-fb-lt-scaled-mode="${mode}"])`
      );

      // Pass 1: Read & Collect phase (zero writes to avoid forced reflows)
      const tasks = [];

      for (const el of mediaElements) {
        // Incremental stamp cache: if already scaled to current mode, skip
        if (el.dataset.fbLtScaledMode === mode) continue;

        // Skip dialogs, overlays, media viewer, banners, and navigations
        if (el.closest && el.closest('[role="dialog"], [aria-modal="true"], [data-pagelet="MediaViewer"], [data-pagelet*="Photo"], [data-pagelet*="Media"], [role="banner"], [role="navigation"]')) continue;

        // Skip small icons, badges, avatars (threshold 140px width or height)
        // Prefer natural metadata first to avoid triggering layout reflow
        const w = el.naturalWidth || parseFloat(el.getAttribute('width')) || el.clientWidth || 0;
        const h = el.naturalHeight || parseFloat(el.getAttribute('height')) || el.clientHeight || 0;
        if (w < 140 && h < 90) continue;

        // Walk up ancestors to find the padding-top aspect wrapper.
        // First check all inline styles up to depth 12 to avoid getComputedStyle calls on intermediate nodes.
        let curr = el.parentElement;
        let wrapper = null;
        const ancestors = [];
        let d = 0;
        while (curr && curr !== document.body && d < 12) {
          ancestors.push(curr);
          const inlineStyle = curr.getAttribute('style') || '';
          if (inlineStyle.includes('padding-top') || inlineStyle.includes('--x-paddingTop')) {
            wrapper = curr;
            break;
          }
          curr = curr.parentElement;
          d++;
        }

        // Fallback: check computed paddingTop if inline style was absent
        if (!wrapper && typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
          for (const a of ancestors) {
            const cs = window.getComputedStyle(a);
            if (cs && parseFloat(cs.paddingTop) > 40) {
              wrapper = a;
              break;
            }
          }
        }

        if (wrapper) {
          let origPadding = wrapper.dataset.fbLtOrigPadding ? parseFloat(wrapper.dataset.fbLtOrigPadding) : null;
          let origWidth = wrapper.dataset.fbLtOrigWidth ? parseFloat(wrapper.dataset.fbLtOrigWidth) : null;

          if (origPadding === null || origWidth === null) {
            const wcs = (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function')
              ? window.getComputedStyle(wrapper)
              : null;
            if (origPadding === null) {
              origPadding = parseFloat(wcs && wcs.paddingTop) || 0;
            }
            if (origWidth === null) {
              origWidth = parseFloat(wcs && wcs.width) ||
                wrapper.offsetWidth ||
                wrapper.clientWidth ||
                (typeof wrapper.getBoundingClientRect === 'function' ? wrapper.getBoundingClientRect().width : 0) ||
                0;
            }
          }

          let factor = 1.0;
          if (isFactorMode) {
            factor = FEED_MEDIA_SCALE_FACTORS[mode];
          } else if (isPixelMode && origPadding > 0) {
            const maxPx = FEED_MEDIA_PIXEL_LIMITS[mode];
            factor = origPadding > maxPx ? (maxPx / origPadding) : 1.0;
          }

          if (factor < 1.0 && origPadding > 0) {
            const targetPadding = Math.round(origPadding * factor);
            const targetWidth = origWidth > 0 ? Math.round(origWidth * factor) : 0;

            let parentInfo = null;
            const parent = wrapper.parentElement;
            if (parent && parent !== document.body && (!parent.matches || !parent.matches('[role="article"], [role="main"], [data-pagelet^="FeedUnit"], .post-card'))) {
              const pInline = parent.getAttribute('style') || '';
              let origH = parent.dataset.fbLtOrigHeight ? parseFloat(parent.dataset.fbLtOrigHeight) : 0;
              if (!origH && typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
                const pcs = window.getComputedStyle(parent);
                const computedH = pcs ? parseFloat(pcs.height) : 0;
                if (pInline.includes('height:') || computedH > (targetPadding + 40)) {
                  origH = computedH;
                }
              }
              if (origH > 0) {
                parentInfo = { parent, origH, pInline };
              }
            }

            tasks.push({
              el,
              wrapper,
              origPadding,
              origWidth,
              targetPadding,
              targetWidth,
              factor,
              parentInfo
            });
          }
        }
      }

      // Pass 2: Batch DOM write phase
      for (const task of tasks) {
        const { el, wrapper, origPadding, origWidth, targetPadding, targetWidth, factor, parentInfo } = task;

        if (!wrapper.dataset.fbLtOrigPadding) {
          wrapper.dataset.fbLtOrigPadding = String(origPadding);
          wrapper.dataset.fbLtOrigWidth = String(origWidth);
          wrapper.dataset.fbLtOrigStyle = wrapper.getAttribute('style') || '__EMPTY__';
        }
        wrapper.style.setProperty('padding-top', `${targetPadding}px`, 'important');
        if (targetWidth > 0) {
          wrapper.style.setProperty('width', `${targetWidth}px`, 'important');
          wrapper.style.setProperty('max-width', `${targetWidth}px`, 'important');
          wrapper.style.setProperty('margin-inline', 'auto', 'important');
        }
        wrapper.style.setProperty('overflow', 'hidden', 'important');

        if (!el.dataset.fbLtOrigStyle) {
          el.dataset.fbLtOrigStyle = el.getAttribute('style') || '__EMPTY__';
        }
        el.style.setProperty('object-fit', 'contain', 'important');
        el.style.setProperty('object-position', 'center', 'important');
        el.dataset.fbLtScaledMode = mode;

        if (parentInfo) {
          const { parent, origH, pInline } = parentInfo;
          if (!parent.dataset.fbLtOrigStyle) {
            parent.dataset.fbLtOrigStyle = pInline || '__EMPTY__';
            parent.dataset.fbLtOrigHeight = String(origH);
          }
          parent.style.setProperty('max-height', `${Math.round(origH * factor)}px`, 'important');
          parent.style.setProperty('overflow', 'hidden', 'important');
        }
      }
    } catch (_) {
      // Non-fatal
    }
  }

  function restoreFeedMedia() {
    try {
      if (typeof document === 'undefined') return;
      const modified = document.querySelectorAll('[data-fb-lt-orig-style]');
      for (const el of modified) {
        const orig = el.dataset.fbLtOrigStyle;
        if (orig && orig !== '__EMPTY__') {
          el.setAttribute('style', orig);
        } else {
          el.removeAttribute('style');
        }
        delete el.dataset.fbLtOrigStyle;
        delete el.dataset.fbLtOrigPadding;
        delete el.dataset.fbLtOrigWidth;
        delete el.dataset.fbLtOrigHeight;
        delete el.dataset.fbLtScaledMode;
      }
      const scaledImages = document.querySelectorAll('[data-fb-lt-scaled-mode]');
      for (const el of scaledImages) {
        delete el.dataset.fbLtScaledMode;
      }
    } catch (_) {
      // Non-fatal
    }
  }

  const SCAN_MIN_INTERVAL_MS = 150;
  let scanScheduled = false;
  let lastScanAt = 0;

  function runThrottledScan() {
    scanScheduled = false;
    lastScanAt = nowMs();
    const isDebug = typeof document !== 'undefined' && Boolean(document.documentElement?.dataset?.fbLtDebug);
    if (!isDebug) {
      checkUrlChange();
      tagRailContainers();
      scanLeftRailDynamicItems();
      scanRightRailDynamicItems();
      if (currentSettings && currentSettings.enabled !== false && currentSettings.extendShareToGroupList === true) {
        tagShareGroupPanel();
      }
      if (currentSettings && isSidebarScopeActive(currentSettings) && currentSettings.trimMainFeed !== false && currentSettings.feedMediaHeight && currentSettings.feedMediaHeight !== 'default') {
        scanAndScaleFeedMedia(currentSettings.feedMediaHeight);
      }
      recoverHealthIfFound();
      return;
    }

    const t0 = performance.now();
    checkUrlChange();
    const t1 = performance.now();
    const tagStats = tagRailContainers();
    const t2 = performance.now();
    const leftStats = scanLeftRailDynamicItems();
    const t3 = performance.now();
    scanRightRailDynamicItems();
    const t4 = performance.now();
    if (currentSettings && currentSettings.enabled !== false && currentSettings.extendShareToGroupList === true) {
      tagShareGroupPanel();
    }
    if (currentSettings && isSidebarScopeActive(currentSettings) && currentSettings.trimMainFeed !== false && currentSettings.feedMediaHeight && currentSettings.feedMediaHeight !== 'default') {
      scanAndScaleFeedMedia(currentSettings.feedMediaHeight);
    }

    try {
      document.dispatchEvent(new CustomEvent('__fb_lt_perf__', {
        detail: {
          type: 'scan',
          totalMs: t4 - t0,
          urlCheckMs: t1 - t0,
          tagRailMs: t2 - t1,
          tagLeftCount: tagStats?.leftCount || 0,
          tagRightCount: tagStats?.rightCount || 0,
          leftRailMs: t3 - t2,
          leftRailSpans: leftStats?.spansCount || 0,
          leftRailCandidates: leftStats?.candidateCount || 0,
          rightRailMs: t4 - t3,
          dockMs: 0,
          dockBubbles: 0,
          dockRectCalls: 0,
          timestamp: Date.now()
        }
      }));
    } catch (_) {}
  }

  function triggerThrottledScan() {
    if (scanScheduled) return;
    scanScheduled = true;

    const wait = Math.max(0, SCAN_MIN_INTERVAL_MS - (nowMs() - lastScanAt));
    if (wait === 0) {
      requestAnimationFrame(runThrottledScan);
      return;
    }
    setTimeout(() => requestAnimationFrame(runThrottledScan), wait);
  }

  const IRRELEVANT_TAG_NAMES = new Set(['SCRIPT', 'STYLE', 'LINK', 'META', 'NOSCRIPT']);

  function hasRelevantMutations(mutations) {
    if (!mutations || !mutations.length) return false;
    for (let i = 0; i < mutations.length; i++) {
      const m = mutations[i];
      const added = m?.addedNodes;
      if (!added || added.length === 0) continue;
      for (let j = 0; j < added.length; j++) {
        const node = added[j];
        if (!node) continue;
        const isElement = node.nodeType ? node.nodeType === 1 : Boolean(node.tagName);
        if (!isElement) continue;
        const tag = (node.tagName || node.nodeName || '').toUpperCase();
        if (tag && IRRELEVANT_TAG_NAMES.has(tag)) continue;
        return true;
      }
    }
    return false;
  }

  function hasOpenDialog() {
    return typeof document !== 'undefined' && Boolean(
      document.querySelector('[role="dialog"], [aria-modal="true"], [data-pagelet="MediaViewer"]')
    );
  }

  // Check if current settings require dynamic DOM subtree scanning
  function needsDynamicScan(settings) {
    if (!settings || settings.enabled === false) return false;
    const isLeftActive = isLeftSidebarActive(settings);
    const isAdsManagerActive = isLeftActive && settings.showLeftAdsManager === false && !isConnectedEl(adsManagerTaggedEl);
    const isCrisisResponseActive = isLeftActive && settings.showLeftCrisisResponse === false && !isConnectedEl(crisisResponseTaggedEl);
    const isShortcutsActive = isLeftActive && settings.showLeftShortcuts === false && (typeof document !== 'undefined' && !document.querySelector('.' + SHORTCUTS_NODE_CLASS));
    const isFeedMediaActive = isSidebarScopeActive(settings) &&
      settings.trimMainFeed !== false &&
      Boolean(settings.feedMediaHeight) && settings.feedMediaHeight !== 'default';
    const isRightRailDynamicActive = (settings.trimRightRail === 'hover' || settings.trimRightRail === true) && (
      (settings.showRightSponsored === false && !isConnectedEl(rightSponsoredTaggedEl)) ||
      (settings.showRightBirthdays === false && !isConnectedEl(rightBirthdaysTaggedEl)) ||
      (settings.showRightMetaAI === false && !isConnectedEl(rightMetaAiTaggedEl))
    );
    const isShareGroupActive = settings.extendShareToGroupList === true && hasOpenDialog();
    const leftRailNeeded = isLeftRailTaggingNeeded(settings);
    const rightRailNeeded = isRightRailTaggingNeeded(settings);
    const now = nowMs();
    const railsNeedTagging = typeof document !== 'undefined' && (
      (leftRailNeeded && !isConnectedEl(leftRailTaggedEl) && now >= leftRailMissAfter) ||
      (rightRailNeeded && !isConnectedEl(rightRailTaggedEl) && now >= rightRailMissAfter)
    );
    return isAdsManagerActive || isCrisisResponseActive || isShortcutsActive || isFeedMediaActive || isRightRailDynamicActive || isShareGroupActive || railsNeedTagging;
  }

  // Load initial settings and set up observers when running in extension environment
  if (typeof chrome !== 'undefined' && chrome.storage && typeof document !== 'undefined') {
    if (typeof window !== 'undefined') {
      window.addEventListener('popstate', checkUrlChange);
      if (window.navigation && window.navigation.addEventListener) {
        window.navigation.addEventListener('navigate', () => {
          setTimeout(checkUrlChange, 0);
        });
      }
    }

    chrome.storage.local.get('settings', (data) => {
      const baseDefaults = (typeof DEFAULT_SETTINGS !== 'undefined' ? DEFAULT_SETTINGS : {});
      currentSettings = { ...baseDefaults, ...(data?.settings || {}) };
      applyUiCleanClasses(currentSettings);
      scheduleHealthChecks();
    });

    // Observe for dynamic content loads (e.g. "See More" bookmark expansion)
    try {
      const observer = new MutationObserver((mutations) => {
        if (currentSettings?.enabled === false) return;
        if (!hasRelevantMutations(mutations)) return;
        if (!needsDynamicScan(currentSettings)) return;
        triggerThrottledScan();
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
    } catch (e) {
      // Non-fatal
    }

    // Listen for realtime settings changes from Options page
    if (chrome.storage.onChanged && chrome.storage.onChanged.addListener) {
      chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.settings) {
        const baseDefaults = (typeof DEFAULT_SETTINGS !== 'undefined' ? DEFAULT_SETTINGS : {});
        currentSettings = { ...baseDefaults, ...(changes.settings.newValue || {}) };
        applyUiCleanClasses(currentSettings);
        if (currentSettings.enabled !== false) {
          scheduleHealthChecks();
        } else {
          clearHealthCheckTimers();
        }
        if (!currentSettings.hoverExpandLeftRail) {
          setRailExpanded(false);
        }
        if (!isRightRailActive()) {
          setRightRailExpanded(false);
        }
      }
    });
  }
}

  // Button-Targeted Hover Expand Manager (Zero-Pixel Guessing, Clean Flyout)

  const LEFT_RAIL_EXCLUDE_ANCESTORS = 'header *, [role="banner"] *, [data-pagelet="Header"] *';

  function getLeftRailContainer(node) {
    if (!node || !node.closest) return null;
    const rail = node.closest('.fb-layout-tweaks-left-rail, [data-pagelet="LeftRail"], div[role="navigation"]');
    if (!rail) return null;
    if (rail.closest && rail.closest(LEFT_RAIL_EXCLUDE_ANCESTORS)) return null;
    return rail;
  }

  function handleButtonHover(e) {
    const isDebug = typeof document !== 'undefined' && Boolean(document.documentElement?.dataset?.fbLtDebug);
    const t0 = isDebug ? performance.now() : 0;
    if (!currentSettings || currentSettings.enabled === false || !currentSettings.hoverExpandLeftRail) {
      if (isRailExpanded) setRailExpanded(false);
      return;
    }

    // Boundary fast-exit: when rail is collapsed and mouse is in feed (clientX > 72px)
    if (!isRailExpanded && typeof e.clientX === 'number' && e.clientX > 72) {
      if (expandTimer) {
        clearTimeout(expandTimer);
        expandTimer = null;
      }
      return;
    }

    const target = e.target;
    if (!target) return;

    // Check DOM hierarchy (rail container or any button / link / listitem / text / overlay item)
    const railContainer = getLeftRailContainer(target);
    const isOverItem = Boolean(railContainer || (target.closest && target.closest(
      ':is(.fb-layout-tweaks-left-rail, [data-pagelet="LeftRail"], div[role="navigation"]) :is(a, [role="button"], [role="listitem"], li, [data-visualcompletion])'
    )));

    // Zero-reflow boundary check:
    // The left expanded drawer occupies [0, 340px] (320px expanded width + 20px grace buffer)
    // below the top navigation bar (56px). Pure numeric comparison avoids forced synchronous layout.
    let isInsideDrawerBounds = false;
    if (isRailExpanded && !railContainer && !isOverItem) {
      if (typeof e.clientX === 'number' && typeof e.clientY === 'number') {
        if (e.clientX >= 0 && e.clientX <= 340 && e.clientY >= 50) {
          isInsideDrawerBounds = true;
        }
      }
    }

    const isHoverActive = Boolean(railContainer || isOverItem || isInsideDrawerBounds);

    if (isHoverActive) {
      if (collapseTimer) {
        clearTimeout(collapseTimer);
        collapseTimer = null;
      }
      if (!isRailExpanded && !expandTimer) {
        // Instant microtask response on direct item hover for zero perceived latency
        expandTimer = setTimeout(() => {
          setRailExpanded(true);
          expandTimer = null;
        }, 0);
      }
    } else {
      if (expandTimer) {
        clearTimeout(expandTimer);
        expandTimer = null;
      }
      if (isRailExpanded && !collapseTimer) {
        // Safe 280ms grace period so moving outside physical bounds won't flicker
        collapseTimer = setTimeout(() => {
          setRailExpanded(false);
          collapseTimer = null;
        }, 280);
      }
    }

    if (isDebug) {
      const dur = performance.now() - t0;
      if (dur >= 0) {
        try {
          document.dispatchEvent(new CustomEvent('__fb_lt_perf__', {
            detail: {
              type: 'hover',
              target: 'left',
              durationMs: dur,
              isHoverActive,
              isRailExpanded,
              isInsideDrawerBounds,
              timestamp: Date.now()
            }
          }));
        } catch (_) {}
      }
    }
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('mouseover', handleButtonHover, { passive: true });
    document.addEventListener('mousemove', (e) => {
      // High-performance: only check on mousemove when rail is currently expanded or hovering near left edge
      if (isRailExpanded || (e.clientX <= 72 && currentSettings?.hoverExpandLeftRail)) {
        handleButtonHover(e);
      }
      if (isRightRailExpanded || (typeof window !== 'undefined' && e.clientX >= (window.innerWidth - 72) && isRightRailActive())) {
        handleRightRailHover(e);
      }
    }, { passive: true });
  }

  // Right Rail Hover Expand Manager (mirrors left rail, anchored on complementary rail)

  function getRightRailContainer(node) {
    if (!node || !node.closest) return null;
    const rail = node.closest('.fb-layout-tweaks-right-rail, #right_rail_container, [data-pagelet="RightRail"], div[role="complementary"]');
    if (!rail) return null;
    if (rail.closest(RIGHT_RAIL_EXCLUDE_ANCESTORS)) return null;
    return rail;
  }

  function handleRightRailHover(e) {
    const isDebug = typeof document !== 'undefined' && Boolean(document.documentElement?.dataset?.fbLtDebug);
    const t0 = isDebug ? performance.now() : 0;
    if (!isRightRailActive()) {
      if (isRightRailExpanded) setRightRailExpanded(false);
      return;
    }

    // Boundary fast-exit: when right rail is collapsed and mouse is well outside right edge
    const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 0;
    if (!isRightRailExpanded && typeof e.clientX === 'number' && screenWidth > 0 && e.clientX < (screenWidth - 72)) {
      if (rightExpandTimer) {
        clearTimeout(rightExpandTimer);
        rightExpandTimer = null;
      }
      return;
    }

    const target = e.target;
    if (!target || !target.closest) return;

    const rail = getRightRailContainer(target);
    if (!rail) {
      if (rightExpandTimer) {
        clearTimeout(rightExpandTimer);
        rightExpandTimer = null;
      }
      if (isRightRailExpanded && !rightCollapseTimer) {
        rightCollapseTimer = setTimeout(() => {
          setRightRailExpanded(false);
          rightCollapseTimer = null;
        }, 280);
      }
      return;
    }

    // Check if mouse is directly over any right rail contact row / button / link or rail container
    const isOverItem = Boolean(target.closest(':is(a, [role="button"], [role="listitem"], li)'));
    const isOverRail = Boolean(rail || isRightRailExpanded);

    if (isOverItem || isOverRail) {
      if (rightCollapseTimer) {
        clearTimeout(rightCollapseTimer);
        rightCollapseTimer = null;
      }
      if (!isRightRailExpanded && !rightExpandTimer) {
        // Instant microtask response on direct item hover for zero perceived latency
        rightExpandTimer = setTimeout(() => {
          setRightRailExpanded(true);
          rightExpandTimer = null;
        }, 0);
      }
    } else {
      if (rightExpandTimer) {
        clearTimeout(rightExpandTimer);
        rightExpandTimer = null;
      }
      if (isRightRailExpanded && !rightCollapseTimer) {
        // Safe 280ms grace period so cursor navigating between items won't jitter
        rightCollapseTimer = setTimeout(() => {
          setRightRailExpanded(false);
          rightCollapseTimer = null;
        }, 280);
      }
    }

    if (isDebug) {
      const dur = performance.now() - t0;
      if (dur >= 0) {
        try {
          document.dispatchEvent(new CustomEvent('__fb_lt_perf__', {
            detail: {
              type: 'hover',
              target: 'right',
              durationMs: dur,
              isOverItem,
              isOverRail,
              isRightRailExpanded,
              timestamp: Date.now()
            }
          }));
        } catch (_) {}
      }
    }
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('mouseover', handleRightRailHover, { passive: true });
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      getUiCleanClassName,
      normalizeRightRailMode,
      deriveLayoutClasses,
      isAdsManagerHidden,
      isSidebarScopeActive,
      isLeftSidebarActive,
      isLeftRailTaggingNeeded,
      isRightRailTaggingNeeded,
      scanLeftRailDynamicItems,
      scanRightRailDynamicItems,
      tagShareGroupPanel,
      resetLeftRailLabelScanCache,
      resetRightRailScanCache,
      SCAN_MIN_INTERVAL_MS,
      LABEL_SCAN_COOLDOWN_MS,
      RAIL_MISS_COOLDOWN_MS,
      RIGHT_RAIL_SCAN_COOLDOWN_MS,
      HEALTH_RECOVERY_COOLDOWN_MS,
      isRightRailActive,
      isFeedPage: (typeof self !== 'undefined' && self.isFeedPage) || null,
      scanAndScaleFeedMedia,
      restoreFeedMedia,
      FEED_MEDIA_SCALE_FACTORS,
      FEED_MEDIA_PIXEL_LIMITS,
      LAYOUT_ANCHOR_SELECTORS,
      countLayoutAnchors,
      hasRelevantMutations,
      hasOpenDialog,
      needsDynamicScan,
      hasConnectedHomeFeed,
      isOverlayState,
      setIsFeedScopeActive: (val) => { isFeedScopeActive = Boolean(val); }
    };
  }
})();

