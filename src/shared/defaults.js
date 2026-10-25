/**
 * FB Layout Tweaks - Shared Default Settings
 * Single source of truth shared by the service worker (via importScripts)
 * and extension pages (via <script> tag).
 *
 * Settings are authored in five section groups (TOP / LEFT / RIGHT / MAIN / OTHER)
 * and flattened into DEFAULT_SETTINGS. Storage and all consumers use the flat
 * shape, so grouping is organizational only (no migration needed).
 */

self.TOP_SETTINGS = {
  // Section master (popup quick toggle, true = declutter active)
  trimTopNav: true,
  // Section: Top Navigation (true = visible)
  showTopReels: true,
  showTopFriends: true,
  showTopMarketplace: false,
  showTopGroups: true,
  showTopFeeds: true,
  showTopGaming: false
};

self.LEFT_SETTINGS = {
  // Section master (popup quick toggle, true = declutter active)
  trimLeftItems: true,
  // Section: Left Sidebar (Curated clean defaults, true = visible)
  showLeftProfile: true,
  showLeftFriends: true,
  showLeftFeeds: true,
  showLeftMessenger: false,
  showLeftGroups: true,
  showLeftMarketplace: false,
  showLeftReels: false,
  showLeftMemories: false,
  showLeftSaved: false,
  showLeftPages: false,
  showLeftEvents: false,
  showLeftBirthdays: false,
  showLeftGaming: false,
  showLeftGamingVideo: false,
  showLeftMetaAI: false,
  showLeftAdsManager: false,
  showLeftRecentAdActivity: false,
  showLeftProfessionalDashboard: false,
  showLeftMessengerKids: false,
  showLeftMetaQuest: false,
  showLeftFundraisers: false,
  showLeftCrisisResponse: false,
  showLeftOrdersPayments: false,
  hoverExpandLeftRail: true
};

self.RIGHT_SETTINGS = {
  // Right sidebar mode: 'hidden' (default) | 'hover' | 'visible'
  trimRightRail: 'hidden',
  // Section: Right Sidebar (true = visible; UI checkboxes are inverted: checked = hidden)
  showRightSponsored: false,
  showRightBirthdays: false,
  showRightMetaAI: false
};

self.MAIN_SETTINGS = {
  // Section master (popup quick toggle, true = feed customization active)
  trimMainFeed: true,
  // Section: Main Feed (true = keep feed centered when sidebars are asymmetric)
  centerMainFeed: true,
  // Feed width: 'default' (680px) | 'w50' | 'w75' | 'w100'
  feedWidth: 'default',
  // Feed font size: 'default' (100%) | 'f150' | 'f200' | 'f300'
  feedFontSize: 'f150',
  // Feed media height scale: 'default' (100%) | 'h75' (75%) | 'h50' (50%) | 'h25' (25%)
  feedMediaHeight: 'default'
};

self.OTHER_SETTINGS = {
  // Section: Others (true = lengthen the "Share to group" list to show at least 6 groups)
  extendShareToGroupList: true,
  // Stop Facebook from refreshing the feed when returning to the tab
  stopAutoRefresh: false
};

self.DEFAULT_SETTINGS = {
  enabled: true,
  locale: 'auto',
  sidebarScope: 'homeOnly',
  ...self.TOP_SETTINGS,
  ...self.LEFT_SETTINGS,
  ...self.RIGHT_SETTINGS,
  ...self.MAIN_SETTINGS,
  ...self.OTHER_SETTINGS
};

self.SETTINGS_ENUMS = {
  locale: new Set(['auto', 'en', 'zh_TW']),
  sidebarScope: new Set(['homeOnly', 'global']),
  trimRightRail: new Set(['hidden', 'hover', 'visible']),
  feedWidth: new Set(['default', 'w50', 'w75', 'w100']),
  feedFontSize: new Set(['default', 'f150', 'f200', 'f300']),
  feedMediaHeight: new Set(['default', 'h75', 'h50', 'h25'])
};

self.sanitizeSettingValue = function(key, rawValue) {
  const fallback = self.DEFAULT_SETTINGS[key];
  if (rawValue === undefined || rawValue === null) return fallback;

  // Handle trimRightRail legacy booleans (true -> 'hover', false -> 'visible')
  if (key === 'trimRightRail') {
    if (rawValue === true) rawValue = 'hover';
    else if (rawValue === false) rawValue = 'visible';
  }

  const validSet = self.SETTINGS_ENUMS ? self.SETTINGS_ENUMS[key] : null;
  if (validSet) {
    return validSet.has(rawValue) ? rawValue : fallback;
  }
  return rawValue;
};

self.bindSelectDropdown = function(selectEl, key, options = {}) {
  if (!selectEl) return null;
  const fallback = options.fallback !== undefined ? options.fallback : self.DEFAULT_SETTINGS[key];

  function getSanitized(val) {
    if (typeof self.sanitizeSettingValue === 'function') {
      return self.sanitizeSettingValue(key, val);
    }
    const validSet = self.SETTINGS_ENUMS ? self.SETTINGS_ENUMS[key] : null;
    return (validSet && validSet.has(val)) ? val : fallback;
  }

  const initial = options.initialValue !== undefined ? options.initialValue : fallback;
  selectEl.value = getSanitized(initial);

  selectEl.addEventListener('change', async () => {
    const val = getSanitized(selectEl.value);
    selectEl.value = val;
    if (typeof options.onChange === 'function') {
      await options.onChange(val);
    } else if (typeof self.updateSettings === 'function') {
      await self.updateSettings({ [key]: val });
    } else if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const { settings: current } = await chrome.storage.local.get('settings');
      await chrome.storage.local.set({ settings: { ...(current || {}), [key]: val } });
    }
  });

  return {
    key,
    element: selectEl,
    update(nextVal) {
      if (nextVal !== undefined) {
        selectEl.value = getSanitized(nextVal);
      }
    }
  };
};

let updateQueue = Promise.resolve();

self.updateSettings = function(patchOrUpdater) {
  updateQueue = updateQueue.catch(() => {}).then(async () => {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      return {};
    }
    const data = await chrome.storage.local.get('settings');
    const current = (data && data.settings) || {};
    const updates = typeof patchOrUpdater === 'function' ? patchOrUpdater(current) : patchOrUpdater;
    if (!updates || Object.keys(updates).length === 0) return current;

    const nextSettings = { ...current, ...updates };
    await chrome.storage.local.set({ settings: nextSettings });
    return nextSettings;
  });
  return updateQueue;
};

self.INVERTED_KEYS = new Set(['showRightSponsored', 'showRightBirthdays', 'showRightMetaAI']);

self.toUIChecked = function(key, storedValue) {
  return self.INVERTED_KEYS.has(key) ? !storedValue : storedValue;
};

self.toStoredValue = function(key, uiChecked) {
  return self.INVERTED_KEYS.has(key) ? !uiChecked : uiChecked;
};

self.isFeedPage = function(pathname) {
  if (!pathname) return false;
  const normalized = (pathname.length > 1 && pathname.endsWith('/'))
    ? pathname.slice(0, -1)
    : pathname;

  if (normalized === '/' || normalized === '/index.php' || normalized === '/home.php') return true;
  if (normalized === '/feed' || normalized.startsWith('/feed/')) return true;

  return false;
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DEFAULT_SETTINGS: self.DEFAULT_SETTINGS,
    TOP_SETTINGS: self.TOP_SETTINGS,
    LEFT_SETTINGS: self.LEFT_SETTINGS,
    RIGHT_SETTINGS: self.RIGHT_SETTINGS,
    MAIN_SETTINGS: self.MAIN_SETTINGS,
    OTHER_SETTINGS: self.OTHER_SETTINGS,
    SETTINGS_ENUMS: self.SETTINGS_ENUMS,
    sanitizeSettingValue: self.sanitizeSettingValue,
    bindSelectDropdown: self.bindSelectDropdown,
    updateSettings: self.updateSettings,
    INVERTED_KEYS: self.INVERTED_KEYS,
    toUIChecked: self.toUIChecked,
    toStoredValue: self.toStoredValue,
    isFeedPage: self.isFeedPage
  };
}

