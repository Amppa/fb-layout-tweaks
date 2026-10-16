/**
 * FB Layout Tweaks - Background Service Worker
 * Manages default settings persistence across installations and updates,
 * and mirrors extension state onto the toolbar badge: gray "off" while the
 * master switch is disabled, red "!" while the content health check reports
 * unrecognized page structure (off wins on conflict).
 */

// Single source of truth for all default settings (see src/shared/defaults.js).
// importScripts() must be called at the top level of a classic service worker.
importScripts('../shared/defaults.js', '../shared/badge.js');

async function updateBadge() {
  try {
    const data = await chrome.storage.local.get(['settings', 'health']);
    const settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
    const health = data.health || {};
    const state = decideBadgeState({
      enabled: settings.enabled !== false,
      healthOk: health.ok,
      healthTs: health.ts,
      now: Date.now()
    });
    if (!chrome.action) return;
    if (state) {
      await chrome.action.setBadgeText({ text: state.text });
      await chrome.action.setBadgeBackgroundColor({ color: state.backgroundColor });
    } else {
      await chrome.action.setBadgeText({ text: '' });
    }
  } catch (_) {
    // Non-fatal: badge is best-effort UI.
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.local.get('settings');
  if (!data.settings) {
    await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
  } else {
    const merged = { ...DEFAULT_SETTINGS, ...data.settings };
    // Single-user cleanup: drop legacy hide* keys from the pre-pill schema.
    for (const key of Object.keys(merged)) {
      if (key.startsWith('hide')) delete merged[key];
    }
    await chrome.storage.local.set({ settings: merged });
  }
  updateBadge();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.settings || changes.health) updateBadge();
});

// Service workers sleep: refresh the badge on every startup.
updateBadge();
