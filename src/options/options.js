/**
 * FB Layout Tweaks - Options Page
 * Pill grid semantics: checked = visible (show* keys, true = visible).
 * Shared i18n helpers come from src/shared/i18n.js; default settings come from
 * src/shared/defaults.js (both are loaded by options.html).
 */

document.addEventListener('DOMContentLoaded', async () => {
  const langSegments = document.querySelectorAll('.lang-segment');

  const masterToggle = document.getElementById('enabled');
  const masterStatus = document.getElementById('masterStatus');
  const uiCleanList = document.getElementById('uiCleanList');
  const versionEl = document.getElementById('optionsVersion');
  if (versionEl) versionEl.textContent = chrome.runtime.getManifest().version;

  const btnTopReset = document.getElementById('btnTopReset');
  const btnTopHideAll = document.getElementById('btnTopHideAll');
  const btnTopShowAll = document.getElementById('btnTopShowAll');

  const btnLeftReset = document.getElementById('btnLeftReset');
  const btnLeftHideAll = document.getElementById('btnLeftHideAll');
  const btnLeftShowAll = document.getElementById('btnLeftShowAll');

  // Curated clean defaults — single source of truth in src/shared/defaults.js
  const DEFAULTS = DEFAULT_SETTINGS;

  const switches = {};
  document.querySelectorAll('#uiCleanList input[type="checkbox"]').forEach(input => {
    if (input.id) switches[input.id] = input;
  });

  function updateMasterUI(isEnabled) {
    if (masterToggle) masterToggle.checked = isEnabled;
    if (masterStatus) {
      const activeText = getMsg('statusActive') || 'Active';
      const disabledText = getMsg('statusDisabled') || 'Disabled';
      masterStatus.textContent = isEnabled ? activeText : disabledText;
    }
    if (isEnabled) {
      if (uiCleanList) uiCleanList.classList.remove('disabled');
    } else {
      if (uiCleanList) uiCleanList.classList.add('disabled');
    }
  }

  // Load language preference: do not auto-detect system language, default to 'en'
  const { settings: initialSettings } = await chrome.storage.local.get('settings');
  const prefLocale = initialSettings?.locale || 'en';

  async function updateLocale(locale, persist = false) {
    await loadLocaleMessages(locale);
    document.documentElement.lang = locale === 'zh_TW' ? 'zh-TW' : 'en';
    applyI18n();
    langSegments.forEach(btn => {
      const active = btn.dataset.lang === locale;
      btn.classList.toggle('is-active', active);
      if (active) btn.setAttribute('aria-pressed', 'true');
      else btn.removeAttribute('aria-pressed');
    });
    if (masterToggle) {
      updateMasterUI(masterToggle.checked);
    }
    if (persist) {
      const { settings: cur } = await chrome.storage.local.get('settings');
      await chrome.storage.local.set({ settings: { ...(cur || {}), locale } });
    }
  }

  await updateLocale(prefLocale, false);

  langSegments.forEach(btn => {
    btn.addEventListener('click', async () => {
      const next = btn.dataset.lang;
      if (!next || next === currentLocale) return;
      await updateLocale(next, true);
    });
  });

  // Load initial settings (single-user: legacy hide* keys are ignored)
  const data = await chrome.storage.local.get('settings');
  const settings = data.settings || {};

  updateMasterUI(settings.enabled !== false);

  for (const [key, checkbox] of Object.entries(switches)) {
    if (checkbox) {
      const defaultValue = DEFAULTS[key] !== undefined ? DEFAULTS[key] : true;
      checkbox.checked = settings[key] !== undefined ? settings[key] : defaultValue;
    }
  }

  // Handle Master toggle
  if (masterToggle) {
    masterToggle.addEventListener('change', async () => {
      const active = masterToggle.checked;
      updateMasterUI(active);
      const { settings: current } = await chrome.storage.local.get('settings');
      const updated = { ...current, enabled: active };
      await chrome.storage.local.set({ settings: updated });
    });
  }

  // Handle individual pills (checked = visible)
  for (const [key, checkbox] of Object.entries(switches)) {
    if (checkbox) {
      checkbox.addEventListener('change', async () => {
        const { settings: current } = await chrome.storage.local.get('settings');
        const updated = { ...current, [key]: checkbox.checked };
        await chrome.storage.local.set({ settings: updated });
      });
    }
  }

  const topKeys = ['showTopReels', 'showTopMarketplace', 'showTopGroups', 'showTopGaming'];
  const leftKeys = Object.keys(switches).filter(k => k.startsWith('showLeft'));

  // Section-Level Quick Actions (Top Navigation & Left Sidebar)
  async function applySectionValues(keys, value) {
    const { settings: current } = await chrome.storage.local.get('settings');
    const updated = { ...current };
    keys.forEach(key => {
      if (switches[key]) switches[key].checked = value;
      updated[key] = value;
    });
    await chrome.storage.local.set({ settings: updated });
  }

  async function resetSection(keys, extraPatch = {}) {
    const { settings: current } = await chrome.storage.local.get('settings');
    const updated = { ...(current || {}), ...extraPatch };
    keys.forEach(key => {
      const defVal = DEFAULTS[key] !== undefined ? Boolean(DEFAULTS[key]) : true;
      if (switches[key]) switches[key].checked = defVal;
      updated[key] = defVal;
    });
    await chrome.storage.local.set({ settings: updated });
  }

  // Top Navigation Actions (Hide All = unchecked, Show All = checked)
  if (btnTopReset) {
    btnTopReset.addEventListener('click', () => resetSection(topKeys));
  }

  if (btnTopHideAll) {
    btnTopHideAll.addEventListener('click', () => applySectionValues(topKeys, false));
  }

  if (btnTopShowAll) {
    btnTopShowAll.addEventListener('click', () => applySectionValues(topKeys, true));
  }

  // Left Sidebar Actions

  if (btnLeftReset) {
    btnLeftReset.addEventListener('click', () => resetSection(leftKeys));
  }

  if (btnLeftHideAll) {
    btnLeftHideAll.addEventListener('click', () => applySectionValues(leftKeys, false));
  }

  if (btnLeftShowAll) {
    btnLeftShowAll.addEventListener('click', () => applySectionValues(leftKeys, true));
  }

  // Live sync states when popup (or another context) changes settings.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.settings?.newValue) return;
    const next = changes.settings.newValue;
    if (typeof next.enabled === 'boolean') updateMasterUI(next.enabled);
    for (const [key, checkbox] of Object.entries(switches)) {
      if (checkbox && typeof next[key] === 'boolean') checkbox.checked = next[key];
    }
  });
});
