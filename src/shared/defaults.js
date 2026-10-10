/**
 * FB Layout Tweaks - Shared Default Settings
 * Single source of truth shared by the service worker (via importScripts)
 * and extension pages (via <script> tag).
 */

self.DEFAULT_SETTINGS = {
  enabled: true,
  // Section: Left Sidebar (Curated clean defaults)
  hideLeftProfile: false,
  hideLeftFriends: false,
  hideLeftFeeds: false,
  hideLeftMessenger: true,
  hideLeftGroups: false,
  hideLeftMarketplace: true,
  hideLeftReels: true,
  hideLeftMemories: true,
  hideLeftSaved: true,
  hideLeftPages: true,
  hideLeftEvents: true,
  hideLeftBirthdays: true,
  hideLeftGaming: true,
  hideLeftGamingVideo: true,
  hideLeftMetaAI: true,
  hideLeftAdsManager: true,
  hideLeftRecentAdActivity: true,
  hideLeftProfessionalDashboard: true,
  hideLeftMessengerKids: true,
  hideLeftMetaQuest: true,
  hideLeftFundraisers: true,
  hideLeftOrdersPayments: true,
  hoverExpandLeftRail: false,
  leftWidth: 360,
  // Section: Top Navigation
  hideTopReels: false,
  hideTopMarketplace: true,
  hideTopGroups: false,
  hideTopGaming: true
};