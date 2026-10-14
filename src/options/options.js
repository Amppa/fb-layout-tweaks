/**
 * FB Layout Tweaks - Options Page
 * Pill grid semantics: checked = visible (show* keys, true = visible).
 * Right sidebar hide switches are inverted: checked = hidden, stored value negated.
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

  // Hide switches (right sidebar): checkbox checked = hidden, stored show* value negated.
  const INVERTED_KEYS = (typeof self !== 'undefined' && self.INVERTED_KEYS) || new Set(['showRightSponsored', 'showRightBirthdays', 'showRightMetaAI']);
  const toUIChecked = (typeof self !== 'undefined' && self.toUIChecked) || ((key, storedValue) => INVERTED_KEYS.has(key) ? !storedValue : storedValue);
  const toStoredValue = (typeof self !== 'undefined' && self.toStoredValue) || ((key, uiChecked) => INVERTED_KEYS.has(key) ? !uiChecked : uiChecked);

  const pillGrids = Array.from(document.querySelectorAll('.pill-grid'));
  pillGrids.forEach(grid => {
    Array.from(grid.children).forEach((pill, index) => {
      pill.dataset.originalOrder = String(index);
    });
  });

  function isPillSelected(pill) {
    if (pill.classList.contains('pill-locked')) return true;
    const input = pill.querySelector('input[type="checkbox"]');
    return input ? input.checked : false;
  }

  function sortPillGrid(grid) {
    const pills = Array.from(grid.children);
    pills.sort((a, b) => {
      const selA = isPillSelected(a) ? 0 : 1;
      const selB = isPillSelected(b) ? 0 : 1;
      if (selA !== selB) return selA - selB;
      return Number(a.dataset.originalOrder || 0) - Number(b.dataset.originalOrder || 0);
    });
    pills.forEach(pill => grid.appendChild(pill));
  }

  function sortAllPillGrids() {
    pillGrids.forEach(sortPillGrid);
  }

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
      const stored = settings[key] !== undefined ? settings[key] : defaultValue;
      checkbox.checked = toUIChecked(key, stored);
    }
  }
  sortAllPillGrids();

  const sidebarScopeSelect = document.getElementById('sidebarScope');
  if (sidebarScopeSelect) {
    sidebarScopeSelect.value = settings.sidebarScope || DEFAULTS.sidebarScope || 'homeOnly';
    sidebarScopeSelect.addEventListener('change', async () => {
      const { settings: current } = await chrome.storage.local.get('settings');
      const updated = { ...current, sidebarScope: sidebarScopeSelect.value };
      await chrome.storage.local.set({ settings: updated });
    });
  }

  // Handle Feed Width select (enum with whitelist fallback)
  const VALID_FEED_WIDTHS = new Set(['default', 'w1000', 'w1600', 'w50', 'w75', 'w100']);
  const feedWidthSelect = document.getElementById('feedWidth');
  if (feedWidthSelect) {
    const initWidth = settings.feedWidth;
    feedWidthSelect.value = VALID_FEED_WIDTHS.has(initWidth) ? initWidth : 'default';
    feedWidthSelect.addEventListener('change', async () => {
      const val = VALID_FEED_WIDTHS.has(feedWidthSelect.value) ? feedWidthSelect.value : 'default';
      const { settings: current } = await chrome.storage.local.get('settings');
      await chrome.storage.local.set({ settings: { ...current, feedWidth: val } });
    });
  }

  // Handle Feed Font Size select (enum with whitelist fallback)
  const VALID_FEED_FONT_SIZES = new Set(['default', 'f150', 'f200', 'f300']);
  const feedFontSizeSelect = document.getElementById('feedFontSize');
  if (feedFontSizeSelect) {
    const initFontSize = settings.feedFontSize;
    feedFontSizeSelect.value = VALID_FEED_FONT_SIZES.has(initFontSize) ? initFontSize : 'default';
    feedFontSizeSelect.addEventListener('change', async () => {
      const val = VALID_FEED_FONT_SIZES.has(feedFontSizeSelect.value) ? feedFontSizeSelect.value : 'default';
      const { settings: current } = await chrome.storage.local.get('settings');
      await chrome.storage.local.set({ settings: { ...current, feedFontSize: val } });
    });
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

  // Handle individual pills (checked = visible, except INVERTED_KEYS)
  for (const [key, checkbox] of Object.entries(switches)) {
    if (checkbox) {
      checkbox.addEventListener('change', async () => {
        const { settings: current } = await chrome.storage.local.get('settings');
        const updated = { ...current, [key]: toStoredValue(key, checkbox.checked) };
        await chrome.storage.local.set({ settings: updated });
        sortAllPillGrids();
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
    sortAllPillGrids();
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
    sortAllPillGrids();
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
      if (checkbox && typeof next[key] === 'boolean') checkbox.checked = toUIChecked(key, next[key]);
    }
    if (sidebarScopeSelect && typeof next.sidebarScope === 'string') {
      sidebarScopeSelect.value = next.sidebarScope;
    }
    if (typeof feedWidthSelect !== 'undefined' && feedWidthSelect && next.feedWidth !== undefined) {
      feedWidthSelect.value = VALID_FEED_WIDTHS.has(next.feedWidth) ? next.feedWidth : 'default';
    }
    if (typeof feedFontSizeSelect !== 'undefined' && feedFontSizeSelect && next.feedFontSize !== undefined) {
      feedFontSizeSelect.value = VALID_FEED_FONT_SIZES.has(next.feedFontSize) ? next.feedFontSize : 'default';
    }
    sortAllPillGrids();
  });
});
