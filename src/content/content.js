/**
 * FB Trim - Content Script
 * Applies CSS class tokens to document.documentElement based on user preferences,
 * and runs a targeted dynamic scan for asynchronous items like Ads Manager.
 */

(() => {
  let currentSettings = null;

  function getUiCleanClassName(key) {
    if (key === 'hideLeftMetaAI') return 'fb-diet-hide-left-metaai';
    return 'fb-diet-' + key.replace(/([A-Z])/g, '-$1').toLowerCase();
  }

  function applyUiCleanClasses(settings) {
    if (!settings) return;
    const root = document.documentElement;
    if (!root) return;

    const isMasterEnabled = settings.enabled !== false;

    for (const [key, value] of Object.entries(settings)) {
      if (!key.startsWith('hide')) continue;
      const className = getUiCleanClassName(key);
      const isEnabled = isMasterEnabled && Boolean(value);
      root.classList.toggle(className, isEnabled);
    }

    const isHoverExpand = isMasterEnabled && Boolean(settings.hoverExpandLeftRail);
    root.classList.toggle('fb-trim-hover-expand-left-rail', isHoverExpand);

    const widthVal = parseInt(settings.leftWidth, 10);
    if (isMasterEnabled && !isHoverExpand && Number.isInteger(widthVal) && widthVal < 360) {
      root.style.setProperty('--fb-trim-left-width', `${Math.max(0, widthVal)}px`);
    } else {
      root.style.removeProperty('--fb-trim-left-width');
    }

    if (isMasterEnabled && Boolean(settings.hideLeftAdsManager)) {
      triggerThrottledScan();
    }
  }

  function scanLeftRailDynamicItems() {
    try {
      if (!currentSettings || currentSettings.enabled === false) return;

      if (currentSettings.hideLeftAdsManager) {
        const candidates = document.querySelectorAll(
          'a[href*="adsmanager"], a[href*="ads/manager"], a[href*="ad_center"], a[aria-label*="廣告管理員"], a[aria-label*="Ads Manager" i]'
        );
        for (const el of candidates) {
          const row = el.closest('li, div[role="listitem"], div[role="button"], div[data-visualcompletion]') || el;
          row.classList.add('fb-diet-hide-left-ads-manager-node');
        }

        const spans = document.querySelectorAll('span');
        for (const span of spans) {
          if (span.children.length === 0) {
            const text = span.textContent.trim();
            if (text === '廣告管理員' || text.toLowerCase() === 'ads manager') {
              const row = span.closest('li, div[role="listitem"], div[role="button"], div[data-visualcompletion]') || span.closest('a') || span;
              row.classList.add('fb-diet-hide-left-ads-manager-node');
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
        hideBadges();
      }
    }
  });

  // Floating Individual Badges Manager (Clean & Displayed Together)
  let badgesContainer = null;
  let hoverTimer = null;
  let isBadgesVisible = false;

  function ensureBadgesContainer() {
    if (badgesContainer && document.body.contains(badgesContainer)) return badgesContainer;
    badgesContainer = document.getElementById('fb-trim-floating-badges');
    if (!badgesContainer) {
      badgesContainer = document.createElement('div');
      badgesContainer.id = 'fb-trim-floating-badges';
      document.body.appendChild(badgesContainer);
    }
    return badgesContainer;
  }

  function hideBadges() {
    if (badgesContainer) {
      badgesContainer.textContent = '';
    }
    isBadgesVisible = false;
  }

  function renderFloatingBadges() {
    const container = ensureBadgesContainer();
    const leftNav = document.querySelector('[data-pagelet="LeftRail"], div[role="navigation"]:not(header *):not([role="banner"] *):not([data-pagelet="Header"] *)');
    if (!leftNav) return;

    const items = leftNav.querySelectorAll('a[role="link"], div[role="button"]');
    const fragment = document.createDocumentFragment();
    const seenTitles = new Set();

    for (const el of items) {
      if (el.offsetParent === null) continue;
      const rect = el.getBoundingClientRect();
      if (rect.height === 0 || rect.width === 0 || rect.bottom <= 0 || rect.top >= window.innerHeight) continue;

      let title = '';
      const textSpans = el.querySelectorAll('span');
      for (const span of textSpans) {
        if (span.children.length === 0 && span.textContent.trim()) {
          title = span.textContent.trim();
          break;
        }
      }
      if (!title) {
        title = el.getAttribute('aria-label') || '';
      }
      title = title.trim();
      if (!title || seenTitles.has(title)) continue;
      seenTitles.add(title);

      const pill = document.createElement('div');
      pill.className = 'fb-trim-badge-pill';
      pill.textContent = title;

      // Accurately align badge vertical center with item center
      const topPos = rect.top + (rect.height - 30) / 2;
      pill.style.top = `${Math.round(topPos)}px`;
      pill.style.left = `${Math.round(rect.right)}px`;

      pill.addEventListener('click', (e) => {
        e.preventDefault();
        el.click();
      });

      fragment.appendChild(pill);
    }

    container.textContent = '';
    container.appendChild(fragment);
    isBadgesVisible = true;
  }

  function isInsideLeftRail(e) {
    return e.clientX <= 76;
  }

  function isOverBadge(e) {
    return Boolean(e.target && e.target.closest && e.target.closest('.fb-trim-badge-pill'));
  }

  document.addEventListener('mousemove', (e) => {
    if (!currentSettings || currentSettings.enabled === false || !currentSettings.hoverExpandLeftRail) {
      if (isBadgesVisible) hideBadges();
      return;
    }

    if (isInsideLeftRail(e) || isOverBadge(e)) {
      if (!isBadgesVisible) {
        if (!hoverTimer) {
          hoverTimer = setTimeout(() => {
            renderFloatingBadges();
            hoverTimer = null;
          }, 50);
        }
      }
    } else {
      if (hoverTimer) {
        clearTimeout(hoverTimer);
        hoverTimer = null;
      }
      if (isBadgesVisible) {
        hideBadges();
      }
    }
  });

  window.addEventListener('scroll', () => {
    if (isBadgesVisible) hideBadges();
  }, { passive: true });
})();
