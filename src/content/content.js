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

  // Load initial settings as early as possible
  chrome.storage.local.get('settings', (data) => {
    currentSettings = data?.settings || {};
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
      currentSettings = changes.settings.newValue || {};
      applyUiCleanClasses(currentSettings);
    }
  });
})();
