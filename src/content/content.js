/**
 * FB Layout Tweaks - Content Script
 * Applies CSS class tokens to document.documentElement based on user preferences,
 * and runs a targeted dynamic scan for asynchronous items like Ads Manager.
 */

(() => {
  let currentSettings = null;

  function getUiCleanClassName(key) {
    // Maps show* settings keys to hide-based fb-layout-tweaks-* CSS tokens
    // (content.css rules suppress elements when the hide token is present).
    if (key === 'showLeftMetaAI') return 'fb-layout-tweaks-hide-left-metaai';
    return 'fb-layout-tweaks-' + key.replace(/^show/, 'hide').replace(/([A-Z])/g, '-$1').toLowerCase();
  }

  function applyUiCleanClasses(settings) {
    if (!settings) return;
    const root = document.documentElement;
    if (!root) return;

    const isMasterEnabled = settings.enabled !== false;

    // Section masters from popup: a trimmed-off section restores native items.
    const trimTopNav = isMasterEnabled && settings.trimTopNav !== false;
    const trimLeftItems = isMasterEnabled && settings.trimLeftItems !== false;

    for (const [key, value] of Object.entries(settings)) {
      if (!key.startsWith('show')) continue;
      // Fixed anchor (Profile) has no hide rule.
      if (key === 'showLeftProfile') continue;
      const sectionActive = key.startsWith('showTop') ? trimTopNav : trimLeftItems;
      const className = getUiCleanClassName(key);
      const isHidden = sectionActive && value === false;
      root.classList.toggle(className, isHidden);
    }

    const isHoverExpand = isMasterEnabled && Boolean(settings.hoverExpandLeftRail);
    root.classList.toggle('fb-layout-tweaks-hover-expand-left-rail', isHoverExpand);

    if (isMasterEnabled && settings.showLeftAdsManager === false) {
      triggerThrottledScan();
    }
  }

  function isAdsManagerHidden() {
    if (!currentSettings) return false;
    return currentSettings.showLeftAdsManager === false;
  }

  function scanLeftRailDynamicItems() {
    try {
      if (!currentSettings || currentSettings.enabled === false) return;

      if (isAdsManagerHidden()) {
        const candidates = document.querySelectorAll(
          'a[href*="adsmanager"], a[href*="ads/manager"], a[href*="ad_center"], a[aria-label*="廣告管理員"], a[aria-label*="Ads Manager" i]'
        );
        for (const el of candidates) {
          const row = el.closest('li, div[role="listitem"], div[role="button"], div[data-visualcompletion]') || el;
          row.classList.add('fb-layout-tweaks-hide-left-ads-manager-node');
        }

        const spans = document.querySelectorAll('span');
        for (const span of spans) {
          if (span.children.length === 0) {
            const text = span.textContent.trim();
            if (text === '廣告管理員' || text.toLowerCase() === 'ads manager') {
              const row = span.closest('li, div[role="listitem"], div[role="button"], div[data-visualcompletion]') || span.closest('a') || span;
              row.classList.add('fb-layout-tweaks-hide-left-ads-manager-node');
            }
          }
        }
      }
    } catch (e) {
      // Non-fatal
    }
  }

  let scanScheduled = false;
  function triggerThrottledScan() {
    if (scanScheduled) return;
    scanScheduled = true;
    requestAnimationFrame(() => {
      scanScheduled = false;
      scanLeftRailDynamicItems();
    });
  }

  // Load initial settings as early as possible with fallback to DEFAULT_SETTINGS
  chrome.storage.local.get('settings', (data) => {
    const baseDefaults = (typeof DEFAULT_SETTINGS !== 'undefined' ? DEFAULT_SETTINGS : {});
    currentSettings = { ...baseDefaults, ...(data?.settings || {}) };
    applyUiCleanClasses(currentSettings);
  });

  // Observe for dynamic content loads (e.g. "See More" bookmark expansion)
  try {
    const observer = new MutationObserver(() => {
      if (currentSettings?.enabled !== false) {
        triggerThrottledScan();
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  } catch (e) {
    // Non-fatal
  }

  // Listen for realtime settings changes from Options page
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.settings) {
      const baseDefaults = (typeof DEFAULT_SETTINGS !== 'undefined' ? DEFAULT_SETTINGS : {});
      currentSettings = { ...baseDefaults, ...(changes.settings.newValue || {}) };
      applyUiCleanClasses(currentSettings);
      if (!currentSettings.hoverExpandLeftRail) {
        setRailExpanded(false);
      }
    }
  });

  // Button-Targeted Hover Expand Manager (Zero-Pixel Guessing, Clean Flyout)
  let expandTimer = null;
  let collapseTimer = null;
  let isRailExpanded = false;

  function setRailExpanded(expanded) {
    if (isRailExpanded === expanded) return;
    isRailExpanded = expanded;
    document.documentElement.classList.toggle('fb-layout-tweaks-rail-expanded', expanded);
  }

  function handleButtonHover(e) {
    if (!currentSettings || currentSettings.enabled === false || !currentSettings.hoverExpandLeftRail) {
      if (isRailExpanded) setRailExpanded(false);
      return;
    }

    const target = e.target;
    if (!target || !target.closest) return;

    // Check if mouse is directly over any left navigation button / link / item
    const isOverItem = Boolean(target.closest(
      '[data-pagelet="LeftRail"] :is(a, [role="button"], [role="listitem"], li), div[role="navigation"]:not(header *):not([role="banner"] *):not([data-pagelet="Header"] *) :is(a, [role="button"], [role="listitem"], li)'
    ));

    // When already expanded, allow smooth navigation within the expanded left rail container
    const isOverRail = isRailExpanded && Boolean(target.closest(
      '[data-pagelet="LeftRail"], div[role="navigation"]:not(header *):not([role="banner"] *):not([data-pagelet="Header"] *)'
    ));

    if (isOverItem || isOverRail) {
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
        // Crisp 120ms grace period so cursor navigating between items won't jitter
        collapseTimer = setTimeout(() => {
          setRailExpanded(false);
          collapseTimer = null;
        }, 120);
      }
    }
  }

  document.addEventListener('mouseover', handleButtonHover, { passive: true });
})();

