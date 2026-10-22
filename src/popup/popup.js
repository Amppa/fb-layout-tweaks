/**
 * FB Layout Tweaks - Popup
 * Shared i18n helpers are provided by src/shared/i18n.js (loaded by popup.html).
 */

document.addEventListener('DOMContentLoaded', async () => {
  const openBtn = document.getElementById('openSettingsBtn');
  const enableToggle = document.getElementById('enableToggle');
  const sectionsEl = document.getElementById('popupSections');
  const versionEl = document.getElementById('popupVersion');
  if (versionEl) versionEl.textContent = chrome.runtime.getManifest().version;

  // Section quick toggles (ids match settings keys)
  const sectionKeys = ['hoverExpandLeftRail', 'trimMainFeed'];
  const sectionToggles = {};
  sectionKeys.forEach(key => {
    sectionToggles[key] = document.getElementById(key);
  });


  // Load settings & locale
  const { settings } = await chrome.storage.local.get('settings');
  const mergedSettings = { ...DEFAULT_SETTINGS, ...(settings || {}) };
  const prefLocale = mergedSettings.locale || DEFAULT_SETTINGS.locale || 'auto';
  await loadLocaleMessages(prefLocale);
  applyI18n();

  function updateMasterUI(isEnabled) {
    if (sectionsEl) sectionsEl.classList.toggle('disabled', !isEnabled);
  }
  updateMasterUI(mergedSettings.enabled !== false);
  if (enableToggle) {
    enableToggle.checked = mergedSettings.enabled !== false;

    enableToggle.addEventListener('change', async () => {
      updateMasterUI(enableToggle.checked);
      await updateSettings({ enabled: enableToggle.checked });
    });
  }

  // Handle section toggles
  for (const key of sectionKeys) {
    const toggle = sectionToggles[key];
    if (toggle) {
      toggle.checked = Boolean(mergedSettings[key]);
      toggle.addEventListener('change', async () => {
        await updateSettings({ [key]: toggle.checked });
        if (key === 'trimMainFeed') updateFeedSubUI(toggle.checked);
      });
    }
  }

  // Dropdown bindings (trimRightRail, feedWidth, feedFontSize, feedMediaHeight)
  const dropdownKeys = ['trimRightRail', 'feedWidth', 'feedFontSize', 'feedMediaHeight'];
  const dropdowns = {};
  dropdownKeys.forEach(key => {
    const el = document.getElementById(key);
    if (el) {
      dropdowns[key] = bindSelectDropdown(el, key, { initialValue: mergedSettings[key] });
    }
  });

  const feedSubRows = Array.from(document.querySelectorAll('.section-row.sub-row'));

  function updateFeedSubUI(trimActive) {
    const disabled = !trimActive;
    ['feedWidth', 'feedFontSize', 'feedMediaHeight'].forEach(key => {
      if (dropdowns[key]?.element) dropdowns[key].element.disabled = disabled;
    });
    feedSubRows.forEach(row => row.classList.toggle('disabled', disabled));
  }
  updateFeedSubUI(Boolean(mergedSettings.trimMainFeed));

  // Listen for storage changes from Options page
  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area === 'local' && changes.settings) {
      const newSettings = changes.settings.newValue || {};
      if (typeof newSettings.enabled === 'boolean' && enableToggle) {
        enableToggle.checked = newSettings.enabled;
        updateMasterUI(newSettings.enabled);
      }
      for (const key of sectionKeys) {
        if (typeof newSettings[key] === 'boolean' && sectionToggles[key]) {
          sectionToggles[key].checked = newSettings[key];
        }
      }
      if (typeof newSettings.trimMainFeed === 'boolean') updateFeedSubUI(newSettings.trimMainFeed);
      dropdownKeys.forEach(key => {
        if (newSettings[key] !== undefined) {
          dropdowns[key]?.update(newSettings[key]);
        }
      });
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
