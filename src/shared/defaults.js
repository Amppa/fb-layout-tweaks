/**
 * FB Layout Tweaks - Shared Default Settings
 * Single source of truth shared by the service worker (via importScripts)
 * and extension pages (via <script> tag).
 *
 * Settings are authored in four section groups (TOP / LEFT / RIGHT / MAIN) and
 * flattened into DEFAULT_SETTINGS. Storage and all consumers use the flat
 * shape, so grouping is organizational only (no migration needed).
 */

self.TOP_SETTINGS = {
  // Section master (popup quick toggle, true = declutter active)
  trimTopNav: true,
  // Section: Top Navigation (true = visible)
  showTopReels: true,
  showTopMarketplace: false,
  showTopGroups: true,
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
  showLeftOrdersPayments: false,
  hoverExpandLeftRail: true
};

self.RIGHT_SETTINGS = {
  // Section master (popup quick toggle, true = declutter active)
  trimRightRail: true,
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
  // Feed width: 'default' (680px) | 'w1000' | 'w1600' | 'w50' | 'w75' | 'w100'
  feedWidth: 'w75',
  // Feed font size: 'default' (100%) | 'f150' | 'f200' | 'f300'
  feedFontSize: 'f150',
  // Feed media height scale: 'default' (100%) | 'h75' (75%) | 'h50' (50%)
  feedMediaHeight: 'default'
};

self.DEFAULT_SETTINGS = {
  enabled: true,
  sidebarScope: 'homeOnly',
  ...self.TOP_SETTINGS,
  ...self.LEFT_SETTINGS,
  ...self.RIGHT_SETTINGS,
  ...self.MAIN_SETTINGS
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

