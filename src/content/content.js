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
    if (key === 'showRightMetaAI') return 'fb-layout-tweaks-hide-right-metaai';
    return 'fb-layout-tweaks-' + key.replace(/^show/, 'hide').replace(/([A-Z])/g, '-$1').toLowerCase();
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

    // Section masters from popup: a trimmed-off section restores native items.
    const trimTopNav = isMasterEnabled && settings.trimTopNav !== false;
    const trimLeftItems = isSidebarActive && settings.trimLeftItems !== false;
    const trimRightRail = isSidebarActive && settings.trimRightRail !== false;

    for (const [key, value] of Object.entries(settings)) {
      if (!key.startsWith('show')) continue;
      // Fixed anchor (Profile) has no hide rule.
      if (key === 'showLeftProfile') continue;
      const sectionActive = key.startsWith('showTop') ? trimTopNav
        : key.startsWith('showRight') ? trimRightRail
        : trimLeftItems;
      const className = getUiCleanClassName(key);
      const isHidden = sectionActive && value === false;
      root.classList.toggle(className, isHidden);
    }

    const isHoverExpand = isSidebarActive && Boolean(settings.hoverExpandLeftRail);
    root.classList.toggle('fb-layout-tweaks-hover-expand-left-rail', isHoverExpand);
    root.classList.toggle('fb-layout-tweaks-hover-expand-right-rail', trimRightRail);

    if (!isHoverExpand && isRailExpanded) {
      setRailExpanded(false);
    }
    if (!trimRightRail && isRightRailExpanded) {
      setRightRailExpanded(false);
    }

    if (isMasterEnabled) {
      tagRailContainers();
    }

    if (isMasterEnabled && settings.showLeftAdsManager === false) {
      triggerThrottledScan();
    }

    if (trimRightRail && (settings.showRightSponsored === false || settings.showRightBirthdays === false || settings.showRightMetaAI === false)) {
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

  function isRightRailActive() {
    if (!currentSettings) return false;
    return currentSettings.enabled !== false && currentSettings.trimRightRail !== false;
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

  function tagRailContainers() {
    try {
      // Tag genuine Left Rail containers (skip nested descendants)
      const leftCandidates = document.querySelectorAll(
        '[data-pagelet="LeftRail"], div[role="navigation"]:not(header *):not([role="banner"] *):not([data-pagelet="Header"] *)'
      );
      for (const el of leftCandidates) {
        if (el.parentElement && el.parentElement.closest('[data-pagelet="LeftRail"], .fb-layout-tweaks-left-rail')) {
          continue;
        }
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
        if (!el.classList.contains('fb-layout-tweaks-right-rail')) {
          el.classList.add('fb-layout-tweaks-right-rail');
        }
        let parent = el.parentElement;
        if (parent && parent !== document.body && !parent.classList.contains('fb-layout-tweaks-right-rail-parent')) {
          parent.classList.add('fb-layout-tweaks-right-rail-parent');
        }
      }
    } catch (e) {
      // Non-fatal
    }
  }

  let lastPathname = typeof window !== 'undefined' ? window.location.pathname : '';

  function checkUrlChange() {
    if (typeof window === 'undefined') return;
    const currentPath = window.location.pathname;
    if (currentPath !== lastPathname) {
      lastPathname = currentPath;
      if (currentSettings) {
        applyUiCleanClasses(currentSettings);
      }
    }
  }

  let scanScheduled = false;
  function triggerThrottledScan() {
    if (scanScheduled) return;
    scanScheduled = true;
    requestAnimationFrame(() => {
      scanScheduled = false;
      checkUrlChange();
      tagRailContainers();
      scanLeftRailDynamicItems();
      scanRightRailDynamicItems();
    });
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
        if (!currentSettings.trimRightRail) {
          setRightRailExpanded(false);
        }
      }
    });
  }

  // Button-Targeted Hover Expand Manager (Zero-Pixel Guessing, Clean Flyout)
  let expandTimer = null;
  let collapseTimer = null;
  let isRailExpanded = false;

  function setRailExpanded(expanded) {
    if (isRailExpanded === expanded) return;
    isRailExpanded = expanded;
    document.documentElement.classList.toggle('fb-layout-tweaks-rail-expanded', expanded);
  }

  const LEFT_RAIL_EXCLUDE_ANCESTORS = 'header *, [role="banner"] *, [data-pagelet="Header"] *';

  function getLeftRailContainer(node) {
    if (!node || !node.closest) return null;
    const rail = node.closest('.fb-layout-tweaks-left-rail, [data-pagelet="LeftRail"], div[role="navigation"]');
    if (!rail) return null;
    if (rail.closest && rail.closest(LEFT_RAIL_EXCLUDE_ANCESTORS)) return null;
    return rail;
  }

  function handleButtonHover(e) {
    if (!currentSettings || currentSettings.enabled === false || !currentSettings.hoverExpandLeftRail) {
      if (isRailExpanded) setRailExpanded(false);
      return;
    }

    const target = e.target;
    if (!target) return;

    // Check DOM hierarchy (rail container or any button / link / listitem / text / overlay item)
    const railContainer = getLeftRailContainer(target);
    const isOverItem = Boolean(target.closest && target.closest(
      ':is(.fb-layout-tweaks-left-rail, [data-pagelet="LeftRail"], div[role="navigation"]) :is(a, [role="button"], [role="listitem"], li, [data-visualcompletion])'
    ));

    // Dynamic physical bounding rect check:
    // When rail is already expanded, dynamically measure the active drawer's right edge (no hardcoded width)
    let isInsideDrawerBounds = false;
    if (isRailExpanded) {
      const activeRail = railContainer || document.querySelector('.fb-layout-tweaks-left-rail, [data-pagelet="LeftRail"], div[role="navigation"]:not(header *):not([role="banner"] *)');
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
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('mouseover', handleButtonHover, { passive: true });
    document.addEventListener('mousemove', (e) => {
      // High-performance: only check on mousemove when rail is currently expanded or hovering near left edge
      if (isRailExpanded || (e.clientX <= 72 && currentSettings?.hoverExpandLeftRail)) {
        handleButtonHover(e);
      }
      if (isRightRailExpanded || (typeof window !== 'undefined' && e.clientX >= (window.innerWidth - 72) && currentSettings?.trimRightRail)) {
        handleRightRailHover(e);
      }
    }, { passive: true });
  }

  // Right Rail Hover Expand Manager (mirrors left rail, anchored on complementary rail)
  let rightExpandTimer = null;
  let rightCollapseTimer = null;
  let isRightRailExpanded = false;

  function setRightRailExpanded(expanded) {
    if (isRightRailExpanded === expanded) return;
    isRightRailExpanded = expanded;
    document.documentElement.classList.toggle('fb-layout-tweaks-right-rail-expanded', expanded);
  }

  function getRightRailContainer(node) {
    if (!node || !node.closest) return null;
    const rail = node.closest('.fb-layout-tweaks-right-rail, #right_rail_container, [data-pagelet="RightRail"], div[role="complementary"]');
    if (!rail) return null;
    if (rail.closest(RIGHT_RAIL_EXCLUDE_ANCESTORS)) return null;
    return rail;
  }

  function handleRightRailHover(e) {
    if (!currentSettings || currentSettings.enabled === false || currentSettings.trimRightRail === false) {
      if (isRightRailExpanded) setRightRailExpanded(false);
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

    // Check if mouse is directly over any right rail contact row / button / link
    const isOverItem = Boolean(target.closest(':is(a, [role="button"], [role="listitem"], li)'));
    const isOverRail = isRightRailExpanded;

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
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('mouseover', handleRightRailHover, { passive: true });
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      getUiCleanClassName,
      isFeedPage: (typeof self !== 'undefined' && self.isFeedPage) || null
    };
  }
})();

