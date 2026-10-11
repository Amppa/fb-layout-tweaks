/**
 * FB Layout Tweaks - Shared Default Settings
 * Single source of truth shared by the service worker (via importScripts)
 * and extension pages (via <script> tag).
 */

self.DEFAULT_SETTINGS = {
  enabled: true,
  // Section masters (popup quick toggles, true = declutter active)
  trimTopNav: true,
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
  hoverExpandLeftRail: false,
  // Section: Top Navigation (true = visible)
  showTopReels: true,
  showTopMarketplace: false,
  showTopGroups: true,
  showTopGaming: false
};