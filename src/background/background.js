/**
 * FB Layout Tweaks - Background Service Worker
 * Manages default settings persistence across installations and updates.
 */

// Single source of truth for all default settings (see src/shared/defaults.js).
// importScripts() must be called at the top level of a classic service worker.
importScripts('../shared/defaults.js');

chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.local.get('settings');
  if (!data.settings) {
    await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
  } else {
    const merged = { ...DEFAULT_SETTINGS, ...data.settings };
    await chrome.storage.local.set({ settings: merged });
  }
});
