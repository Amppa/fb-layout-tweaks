/**
 * FB Layout Tweaks - Popup
 * Shared i18n helpers are provided by src/shared/i18n.js (loaded by popup.html).
 */

document.addEventListener('DOMContentLoaded', async () => {
  const openBtn = document.getElementById('openSettingsBtn');
  const enableToggle = document.getElementById('enableToggle');
  const versionEl = document.getElementById('popupVersion');
  if (versionEl) versionEl.textContent = chrome.runtime.getManifest().version;

  // Section quick toggles (ids match settings keys)
  const sectionKeys = ['trimTopNav', 'trimLeftItems', 'hoverExpandLeftRail'];
  const sectionToggles = {};
  sectionKeys.forEach(key => {
    sectionToggles[key] = document.getElementById(key);
  });

  // Load settings & locale: do not auto-detect system language, default to 'en'
  const { settings } = await chrome.storage.local.get('settings');
  const prefLocale = settings?.locale || 'en';
  await loadLocaleMessages(prefLocale);
  applyI18n();
  if (enableToggle) {
    enableToggle.checked = settings?.enabled !== false;

    enableToggle.addEventListener('change', async () => {
      const data = await chrome.storage.local.get('settings');
      const current = data.settings || {};
      const updated = { ...current, enabled: enableToggle.checked };
      await chrome.storage.local.set({ settings: updated });
    });
  }

  // Handle section toggles (unchecked = restore native section)
  for (const key of sectionKeys) {
    const toggle = sectionToggles[key];
    if (toggle) {
      toggle.checked = settings?.[key] !== false;
      toggle.addEventListener('change', async () => {
        const data = await chrome.storage.local.get('settings');
        const current = data.settings || {};
        const updated = { ...current, [key]: toggle.checked };
        await chrome.storage.local.set({ settings: updated });
      });
    }
  }

  // Listen for storage changes from Options page
  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area === 'local' && changes.settings) {
      const newSettings = changes.settings.newValue || {};
      if (typeof newSettings.enabled === 'boolean' && enableToggle) {
        enableToggle.checked = newSettings.enabled;
      }
      for (const key of sectionKeys) {
        if (typeof newSettings[key] === 'boolean' && sectionToggles[key]) {
          sectionToggles[key].checked = newSettings[key];
        }
      }
      if (newSettings.locale) {
        await loadLocaleMessages(newSettings.locale);
        applyI18n();
      }
    }
  });

  if (openBtn) {
    openBtn.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
  }
});
