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
    const root = document.documentElement;
    if (!root) return;

    const isMasterEnabled = settings.enabled !== false;
    const isSidebarActive = isMasterEnabled && (
      settings.sidebarScope === 'global' ||
      (typeof self !== 'undefined' && self.isFeedPage ? self.isFeedPage(typeof window !== 'undefined' ? window.location.pathname : '') : true)
    );

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

    const isHoverExpand = targetClasses.has('fb-layout-tweaks-hover-expand-left-rail');
    const isHoverRightRail = targetClasses.has('fb-layout-tweaks-hover-expand-right-rail');
    const feedMediaHeight = (isMasterEnabled && isSidebarActive && settings.trimMainFeed !== false)
      ? (settings.feedMediaHeight || 'default')
      : 'default';

    if (feedMediaHeight !== 'default') {
      scanAndScaleFeedMedia(feedMediaHeight);
    } else {
      restoreFeedMedia();
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

    if (isMasterEnabled && settings.showLeftAdsManager === false) {
      triggerThrottledScan();
    }

    if (isHoverRightRail && (settings.showRightSponsored === false || settings.showRightBirthdays === false || settings.showRightMetaAI === false)) {
      triggerThrottledScan();
    }
  }

  function isAdsManagerHidden() {
    if (!currentSettings) return false;
    return currentSettings.showLeftAdsManager === false;
  }

  function scanLeftRailDynamicItems(settings = currentSettings) {
    try {
      if (!settings || settings.enabled === false) return;

      if (settings.showLeftAdsManager === false) {
        const leftRail = document.querySelector(
          '.fb-layout-tweaks-left-rail, [data-pagelet="LeftRail"], div[role="navigation"]:not(header *):not([role="banner"] *)'
        );
        const root = leftRail || (typeof document !== 'undefined' ? document.body : null);
        if (!root) return;

        // O(1) Fast-path: if Ads Manager is already tagged and connected in the DOM, skip querying spans
        const alreadyTagged = root.querySelector('.fb-layout-tweaks-hide-left-ads-manager-node');
        if (alreadyTagged && (alreadyTagged.isConnected !== false)) {
          return { spansCount: 0, candidateCount: 0, cached: true };
        }

        const candidates = root.querySelectorAll(
          'a[href*="adsmanager"], a[href*="ads/manager"], a[href*="ad_center"], a[aria-label*="廣告管理員"], a[aria-label*="Ads Manager" i]'
        );
        for (const el of candidates) {
          const row = el.closest('li, div[role="listitem"], div[role="button"], div[data-visualcompletion]') || el;
          row.classList.add('fb-layout-tweaks-hide-left-ads-manager-node');
        }

        const spans = root.querySelectorAll('span');
        for (const span of spans) {
          if (span.children.length === 0) {
            const text = span.textContent.trim();
            if (text === '廣告管理員' || text.toLowerCase() === 'ads manager') {
              const row = span.closest('li, div[role="listitem"], div[role="button"], div[data-visualcompletion]') || span.closest('a') || span;
              row.classList.add('fb-layout-tweaks-hide-left-ads-manager-node');
            }
          }
        }
        return { spansCount: spans.length, candidateCount: candidates.length };
      }
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

  function isRightRailActive() {
    if (!currentSettings || currentSettings.enabled === false) return false;
    const mode = currentSettings.trimRightRail;
    return mode === 'hover' || mode === true;
  }

  function scanRightRailDynamicItems() {
    try {
      if (!isRightRailActive()) return;
      const rail = document.getElementById('right_rail_container')
        || document.querySelector('[data-pagelet="RightRail"] div[role="complementary"]')
        || document.querySelector('div[role="complementary"][data-pagelet="RightRail"]')
        || document.querySelector('[data-pagelet="RightRail"]')
        || document.querySelector('div[role="complementary"]:not([role="dialog"] *):not([aria-modal="true"] *):not([role="main"] *):not([data-pagelet*="Photo"] *):not([data-pagelet*="Media"] *)');
      if (!rail) return;
      if (rail.closest('[role="dialog"], [aria-modal="true"], [role="main"], [data-pagelet*="Photo"], [data-pagelet*="Media"], [data-pagelet*="Tahoe"]')) return;

      // Sponsored: heading-text anchor only (no stable link). Walk up from the
      // heading while the ancestor holds a single h3; the first multi-h3
      // ancestor is the section boundary, so the last single-h3 node is the
      // Sponsored section root. Aborts at rail/depth cap to avoid over-hiding.
      if (currentSettings.showRightSponsored === false) {
        const headings = rail.querySelectorAll('h3');
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
          }
        }
      }

      // Birthdays: hide the whole section (heading + row). Anchor on the stable
      // /events/birthdays/ link, then walk up to the smallest ancestor holding an h3.
      if (currentSettings.showRightBirthdays === false) {
        const links = rail.querySelectorAll('a[href*="/events/birthdays/"]');
        for (const el of links) {
          if (el.closest('.fb-layout-tweaks-hide-right-birthdays-node')) continue;
          let node = el.parentElement;
          while (node && node !== rail) {
            const heading = node.querySelector(':scope h3');
            if (heading) {
              const title = heading.textContent.trim().toLowerCase();
              if (title === 'birthdays' || title === '生日') {
                node.classList.add('fb-layout-tweaks-hide-right-birthdays-node');
              }
              break;
            }
            node = node.parentElement;
          }
        }
      }

      // Meta AI row fallback (primary rule is static CSS on the aria-label icon).
      if (currentSettings.showRightMetaAI === false) {
        const spans = rail.querySelectorAll('span');
        for (const span of spans) {
          if (span.closest('.fb-layout-tweaks-hide-right-metaai-node')) continue;
          const hasName = Array.from(span.childNodes).some(
            n => n.nodeType === Node.TEXT_NODE && n.textContent.trim() === 'Meta AI'
          );
          if (!hasName) continue;
          const row = span.closest('li');
          if (row) row.classList.add('fb-layout-tweaks-hide-right-metaai-node');
        }
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

      const searchInputs = document.querySelectorAll('input[type="search"]');
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
    } catch (e) {
      // Non-fatal
    }
  }

  function tagRailContainers(force = false) {
    try {
      if (!force && typeof document !== 'undefined') {
        const leftTagged = document.querySelector('.fb-layout-tweaks-left-rail');
        const rightNeeded = isRightRailActive();
        const rightTagged = rightNeeded ? document.querySelector('.fb-layout-tweaks-right-rail') : true;
        if (leftTagged && leftTagged.isConnected && rightTagged && (rightTagged === true || rightTagged.isConnected)) {
          return { leftCount: 1, rightCount: rightNeeded ? 1 : 0 };
        }
      }

      // Tag genuine Left Rail containers (skip nested descendants)
      let leftCount = 0;
      let rightCount = 0;
      const leftCandidates = document.querySelectorAll(
        '[data-pagelet="LeftRail"], div[role="navigation"]:not(header *):not([role="banner"] *):not([data-pagelet="Header"] *)'
      );
      for (const el of leftCandidates) {
        if (el.parentElement && el.parentElement.closest('[data-pagelet="LeftRail"], .fb-layout-tweaks-left-rail')) {
          continue;
        }
        leftCount++;
        if (!el.classList.contains('fb-layout-tweaks-left-rail')) {
          el.classList.add('fb-layout-tweaks-left-rail');
        }
        let parent = el.parentElement;
        if (parent && parent !== document.body && !parent.classList.contains('fb-layout-tweaks-left-rail-parent')) {
          parent.classList.add('fb-layout-tweaks-left-rail-parent');
        }
      }

      // Tag genuine Right Rail containers (strictly excluding photo/dialog overlays and nested descendants)
      const rightCandidates = document.querySelectorAll(
        '#right_rail_container, [data-pagelet="RightRail"], div[role="complementary"]'
      );
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
        let parent = el.parentElement;
        if (parent && parent !== document.body && !parent.classList.contains('fb-layout-tweaks-right-rail-parent')) {
          parent.classList.add('fb-layout-tweaks-right-rail-parent');
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
      const feed = (typeof document.querySelector === 'function' && document.querySelector('[role="main"], [data-pagelet="Feed"], div[role="feed"]')) || document;
      const mediaElements = feed.querySelectorAll(
        `img:not([data-fb-lt-scaled-mode="${mode}"])`
      );

      for (const el of mediaElements) {
        // Incremental stamp cache: if already scaled to current mode, skip to avoid forced reflow
        if (el.dataset.fbLtScaledMode === mode) continue;

        // Skip dialogs, banners, and navigations
        if (el.closest && el.closest('[role="dialog"], [role="banner"], [role="navigation"]')) continue;

        // Skip small icons, badges, avatars (threshold 140px width or height)
        // Prefer natural metadata first to avoid triggering layout reflow
        const w = el.naturalWidth || parseFloat(el.getAttribute('width')) || el.clientWidth || 0;
        const h = el.naturalHeight || parseFloat(el.getAttribute('height')) || el.clientHeight || 0;
        if (w < 140 && h < 90) continue;

        // Walk up ancestors to find the padding-top aspect wrapper
        // Prioritize inline styles first to avoid triggering getComputedStyle reflows on intermediate nodes
        let curr = el.parentElement;
        let wrapper = null;
        let d = 0;
        while (curr && curr !== document.body && d < 12) {
          d++;
          const inlineStyle = curr.getAttribute('style') || '';
          if (inlineStyle.includes('padding-top') || inlineStyle.includes('--x-paddingTop')) {
            wrapper = curr;
            break;
          }
          const cs = window.getComputedStyle(curr);
          if (parseFloat(cs.paddingTop) > 40) {
            wrapper = curr;
            break;
          }
          curr = curr.parentElement;
        }

        if (wrapper) {
          const wcs = window.getComputedStyle(wrapper);
          if (!wrapper.dataset.fbLtOrigPadding) {
            wrapper.dataset.fbLtOrigPadding = String(parseFloat(wcs.paddingTop) || 0);
            wrapper.dataset.fbLtOrigWidth = String(parseFloat(wcs.width) || wrapper.getBoundingClientRect().width || 0);
            wrapper.dataset.fbLtOrigStyle = wrapper.getAttribute('style') || '__EMPTY__';
          }
          const origPadding = parseFloat(wrapper.dataset.fbLtOrigPadding);
          const origWidth = parseFloat(wrapper.dataset.fbLtOrigWidth);

          let factor = 1.0;
          if (isFactorMode) {
            factor = FEED_MEDIA_SCALE_FACTORS[mode];
          } else if (isPixelMode && origPadding > 0) {
            const maxPx = FEED_MEDIA_PIXEL_LIMITS[mode];
            factor = origPadding > maxPx ? (maxPx / origPadding) : 1.0;
          }

          if (factor < 1.0 && origPadding > 0) {
            const targetPadding = Math.round(origPadding * factor);
            wrapper.style.setProperty('padding-top', `${targetPadding}px`, 'important');
            if (origWidth > 0) {
              const targetWidth = Math.round(origWidth * factor);
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

            // Also clamp immediate parent if it has fixed height
            let parent = wrapper.parentElement;
            if (parent && parent !== document.body && !parent.matches('[role="article"], [role="main"], [data-pagelet^="FeedUnit"], .post-card')) {
              const pcs = window.getComputedStyle(parent);
              const pInline = parent.getAttribute('style') || '';
              if (pInline.includes('height:') || parseFloat(pcs.height) > (targetPadding + 40)) {
                if (!parent.dataset.fbLtOrigStyle) {
                  parent.dataset.fbLtOrigStyle = pInline || '__EMPTY__';
                  parent.dataset.fbLtOrigHeight = String(parseFloat(pcs.height) || 0);
                }
                const origH = parseFloat(parent.dataset.fbLtOrigHeight);
                if (origH > 0) {
                  parent.style.setProperty('max-height', `${Math.round(origH * factor)}px`, 'important');
                  parent.style.setProperty('overflow', 'hidden', 'important');
                }
              }
            }
          }
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

  let scanScheduled = false;
  function triggerThrottledScan() {
    if (scanScheduled) return;
    scanScheduled = true;
    requestAnimationFrame(() => {
      scanScheduled = false;
      const isDebug = typeof document !== 'undefined' && Boolean(document.documentElement?.dataset?.fbLtDebug);
      if (!isDebug) {
        checkUrlChange();
        tagRailContainers();
        scanLeftRailDynamicItems();
        scanRightRailDynamicItems();
        if (currentSettings && currentSettings.enabled !== false && currentSettings.extendShareToGroupList === true) {
          tagShareGroupPanel();
        }
        if (currentSettings && currentSettings.enabled !== false && currentSettings.trimMainFeed !== false && currentSettings.feedMediaHeight && currentSettings.feedMediaHeight !== 'default') {
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
      if (currentSettings && currentSettings.enabled !== false && currentSettings.trimMainFeed !== false && currentSettings.feedMediaHeight && currentSettings.feedMediaHeight !== 'default') {
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
    });
  }

  function hasRelevantMutations(mutations) {
    if (!mutations || !mutations.length) return false;
    for (let i = 0; i < mutations.length; i++) {
      const m = mutations[i];
      if (m && m.addedNodes && m.addedNodes.length > 0) {
        return true;
      }
    }
    return false;
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

    // Check if current settings require dynamic DOM subtree scanning
    function needsDynamicScan(settings) {
      if (!settings || settings.enabled === false) return false;
      const isAdsManagerActive = settings.showLeftAdsManager === false;
      const isFeedMediaActive = settings.trimMainFeed !== false &&
        Boolean(settings.feedMediaHeight) && settings.feedMediaHeight !== 'default';
      const isRightRailDynamicActive = (settings.trimRightRail === 'hover' || settings.trimRightRail === true) && (
        settings.showRightSponsored === false ||
        settings.showRightBirthdays === false ||
        settings.showRightMetaAI === false
      );
      const isShareGroupActive = settings.extendShareToGroupList === true;
      const railsNeedTagging = typeof document !== 'undefined' && (
        !document.querySelector('.fb-layout-tweaks-left-rail') ||
        (isRightRailActive() && !document.querySelector('.fb-layout-tweaks-right-rail'))
      );
      return isAdsManagerActive || isFeedMediaActive || isRightRailDynamicActive || isShareGroupActive || railsNeedTagging;
    }

    // Observe for dynamic content loads (e.g. "See More" bookmark expansion)
    try {
      const observer = new MutationObserver((mutations) => {
        if (currentSettings?.enabled !== false && needsDynamicScan(currentSettings) && hasRelevantMutations(mutations)) {
          triggerThrottledScan();
        }
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

    // Dynamic physical bounding rect check:
    // Only measure physical bounding rect if cursor is NOT already over a known rail container/item
    // (avoids calling getBoundingClientRect on every mousemove when user is browsing rail items)
    let isInsideDrawerBounds = false;
    if (isRailExpanded && !railContainer && !isOverItem) {
      const activeRail = document.querySelector('.fb-layout-tweaks-left-rail, [data-pagelet="LeftRail"], div[role="navigation"]:not(header *):not([role="banner"] *)');
      if (activeRail) {
        const drawer = activeRail.querySelector(':scope > div') || activeRail;
        const rect = drawer.getBoundingClientRect();
        if (typeof e.clientX === 'number' && e.clientX >= 0 && e.clientX <= (rect.right + 6) && e.clientY >= (rect.top - 6) && e.clientY <= (rect.bottom + 6)) {
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
      scanLeftRailDynamicItems,
      isRightRailActive,
      isFeedPage: (typeof self !== 'undefined' && self.isFeedPage) || null,
      scanAndScaleFeedMedia,
      restoreFeedMedia,
      FEED_MEDIA_SCALE_FACTORS,
      FEED_MEDIA_PIXEL_LIMITS,
      LAYOUT_ANCHOR_SELECTORS,
      countLayoutAnchors,
      hasRelevantMutations
    };
  }
})();

