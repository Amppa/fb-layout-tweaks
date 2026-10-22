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

  // Right sidebar mode dropdown
  const VALID_RIGHT_RAIL_MODES = new Set(['hidden', 'hover', 'visible']);
  const trimRightRailSelect = document.getElementById('trimRightRail');

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
      const data = await chrome.storage.local.get('settings');
      const current = data.settings || {};
      const updated = { ...current, enabled: enableToggle.checked };
      updateMasterUI(enableToggle.checked);
      await chrome.storage.local.set({ settings: updated });
    });
  }

  // Handle section toggles
  for (const key of sectionKeys) {
    const toggle = sectionToggles[key];
    if (toggle) {
      toggle.checked = Boolean(mergedSettings[key]);
      toggle.addEventListener('change', async () => {
        const data = await chrome.storage.local.get('settings');
        const current = data.settings || {};
        const updated = { ...current, [key]: toggle.checked };
        await chrome.storage.local.set({ settings: updated });
        if (key === 'trimMainFeed') updateFeedSubUI(toggle.checked);
      });
    }
  }

  // Right sidebar select handler
  if (trimRightRailSelect) {
    const rawVal = mergedSettings.trimRightRail;
    const init = rawVal === true ? 'hover' : (rawVal === false ? 'visible' : rawVal);
    trimRightRailSelect.value = VALID_RIGHT_RAIL_MODES.has(init) ? init : (DEFAULT_SETTINGS.trimRightRail || 'hidden');
    trimRightRailSelect.addEventListener('change', async () => {
      const val = VALID_RIGHT_RAIL_MODES.has(trimRightRailSelect.value) ? trimRightRailSelect.value : (DEFAULT_SETTINGS.trimRightRail || 'hidden');
      const { settings: current } = await chrome.storage.local.get('settings');
      await chrome.storage.local.set({ settings: { ...current, trimRightRail: val } });
    });
  }

  // Feed sub-options (same enum values as options page, no subtitles)
  const VALID_FEED_WIDTHS = new Set(['default', 'w50', 'w75', 'w100']);
  const VALID_FEED_FONT_SIZES = new Set(['default', 'f150', 'f200', 'f300']);
  const VALID_FEED_MEDIA_HEIGHTS = new Set(['default', 'h75', 'h50', 'h25']);
  const feedWidthSelect = document.getElementById('feedWidth');
  const feedFontSizeSelect = document.getElementById('feedFontSize');
  const feedMediaHeightSelect = document.getElementById('feedMediaHeight');
  const feedSubRows = Array.from(document.querySelectorAll('.section-row.sub-row'));

  function updateFeedSubUI(trimActive) {
    const disabled = !trimActive;
    for (const select of [feedWidthSelect, feedFontSizeSelect, feedMediaHeightSelect]) {
      if (select) select.disabled = disabled;
    }
    feedSubRows.forEach(row => row.classList.toggle('disabled', disabled));
  }

  if (feedWidthSelect) {
    const init = mergedSettings.feedWidth !== undefined ? mergedSettings.feedWidth : DEFAULT_SETTINGS.feedWidth;
    feedWidthSelect.value = VALID_FEED_WIDTHS.has(init) ? init : (DEFAULT_SETTINGS.feedWidth || 'default');
    feedWidthSelect.addEventListener('change', async () => {
      const val = VALID_FEED_WIDTHS.has(feedWidthSelect.value) ? feedWidthSelect.value : (DEFAULT_SETTINGS.feedWidth || 'default');
      const { settings: current } = await chrome.storage.local.get('settings');
      await chrome.storage.local.set({ settings: { ...current, feedWidth: val } });
    });
  }
  if (feedFontSizeSelect) {
    const init = mergedSettings.feedFontSize !== undefined ? mergedSettings.feedFontSize : DEFAULT_SETTINGS.feedFontSize;
    feedFontSizeSelect.value = VALID_FEED_FONT_SIZES.has(init) ? init : (DEFAULT_SETTINGS.feedFontSize || 'default');
    feedFontSizeSelect.addEventListener('change', async () => {
      const val = VALID_FEED_FONT_SIZES.has(feedFontSizeSelect.value) ? feedFontSizeSelect.value : (DEFAULT_SETTINGS.feedFontSize || 'default');
      const { settings: current } = await chrome.storage.local.get('settings');
      await chrome.storage.local.set({ settings: { ...current, feedFontSize: val } });
    });
  }
  if (feedMediaHeightSelect) {
    const init = mergedSettings.feedMediaHeight !== undefined ? mergedSettings.feedMediaHeight : DEFAULT_SETTINGS.feedMediaHeight;
    feedMediaHeightSelect.value = VALID_FEED_MEDIA_HEIGHTS.has(init) ? init : (DEFAULT_SETTINGS.feedMediaHeight || 'default');
    feedMediaHeightSelect.addEventListener('change', async () => {
      const val = VALID_FEED_MEDIA_HEIGHTS.has(feedMediaHeightSelect.value) ? feedMediaHeightSelect.value : (DEFAULT_SETTINGS.feedMediaHeight || 'default');
      const { settings: current } = await chrome.storage.local.get('settings');
      await chrome.storage.local.set({ settings: { ...current, feedMediaHeight: val } });
    });
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
      if (trimRightRailSelect && newSettings.trimRightRail !== undefined) {
        const raw = newSettings.trimRightRail;
        const norm = raw === true ? 'hover' : (raw === false ? 'visible' : raw);
        trimRightRailSelect.value = VALID_RIGHT_RAIL_MODES.has(norm) ? norm : (DEFAULT_SETTINGS.trimRightRail || 'hidden');
      }
      if (typeof newSettings.feedWidth === 'string' && feedWidthSelect) {
        feedWidthSelect.value = VALID_FEED_WIDTHS.has(newSettings.feedWidth) ? newSettings.feedWidth : (DEFAULT_SETTINGS.feedWidth || 'default');
      }
      if (typeof newSettings.feedFontSize === 'string' && feedFontSizeSelect) {
        feedFontSizeSelect.value = VALID_FEED_FONT_SIZES.has(newSettings.feedFontSize) ? newSettings.feedFontSize : (DEFAULT_SETTINGS.feedFontSize || 'default');
      }
      if (typeof newSettings.feedMediaHeight === 'string' && feedMediaHeightSelect) {
        feedMediaHeightSelect.value = VALID_FEED_MEDIA_HEIGHTS.has(newSettings.feedMediaHeight) ? newSettings.feedMediaHeight : (DEFAULT_SETTINGS.feedMediaHeight || 'default');
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
