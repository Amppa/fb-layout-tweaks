/**
 * FB Trim - Background Service Worker
 * Manages default settings persistence across installations and updates.
 */

const DEFAULT_SETTINGS = {
  enabled: true,
  // Section: Left Sidebar (Curated clean defaults)
  hideLeftProfile: false,
  hideLeftFriends: false,
  hideLeftFeeds: false,
  hideLeftGroups: false,
  hideLeftMarketplace: false,
  hideLeftReels: false,
  hideLeftMemories: false,
  hideLeftSaved: false,
  hideLeftPages: false,
  hideLeftEvents: false,
  hideLeftGaming: true,
  hideLeftMetaAI: true,
  hideLeftAdsManager: true,
  hideLeftRecentAdActivity: true,
  hideLeftProfessionalDashboard: true,
  hideLeftMessengerKids: true,
  hideLeftMetaQuest: true,
  hideLeftFundraisers: true,
  hideLeftOrdersPayments: true,
  // Section: Top Navigation
  hideTopReels: false,
  hideTopMarketplace: false,
  hideTopGaming: true
};

chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.local.get('settings');
  if (!data.settings) {
    await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
  } else {
    const merged = { ...DEFAULT_SETTINGS, ...data.settings };
    await chrome.storage.local.set({ settings: merged });
  }
});
