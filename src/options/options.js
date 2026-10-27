/**
 * FB Layout Tweaks - Options Page
 * Pill grid semantics: checked = visible (show* keys, true = visible).
 * Right sidebar hide switches are inverted: checked = hidden, stored value negated.
 * Shared i18n helpers come from src/shared/i18n.js; default settings come from
 * src/shared/defaults.js (both are loaded by options.html).
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Sync fast-path: hydrate with system locale messages immediately to prevent FOUC
  applyI18n();

  const masterToggle = document.getElementById('enabled');
  const masterStatus = document.getElementById('masterStatus');
  const uiCleanList = document.getElementById('uiCleanList');
  const versionEl = document.getElementById('optionsVersion');
  if (versionEl) versionEl.textContent = chrome.runtime.getManifest().version;

  const btnGlobalReset = document.getElementById('btnGlobalReset');
  const btnLeftHideAll = document.getElementById('btnLeftHideAll');
  const btnLeftShowAll = document.getElementById('btnLeftShowAll');

  // Curated clean defaults — single source of truth in src/shared/defaults.js
  const DEFAULTS = DEFAULT_SETTINGS;

  const switches = {};
  document.querySelectorAll('#uiCleanList input[type="checkbox"]').forEach(input => {
    if (input.id) switches[input.id] = input;
  });

  // Hide switches (right sidebar): checkbox checked = hidden, stored show* value negated.
  const INVERTED_KEYS = (typeof self !== 'undefined' && self.INVERTED_KEYS) || new Set(['showRightSponsored', 'showRightBirthdays', 'showRightMetaAI', 'showLeftShortcuts']);
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

  // Load language preference (auto, en, zh_TW)
  const { settings: initialSettings } = await chrome.storage.local.get('settings');
  const prefLocale = sanitizeSettingValue('locale', initialSettings?.locale);
  const localeSelect = document.getElementById('locale');

  async function updateLocale(locale, persist = false) {
    const validLocale = sanitizeSettingValue('locale', locale);
    await loadLocaleMessages(validLocale);
    document.documentElement.lang = currentLocale === 'zh_TW' ? 'zh-TW' : 'en';
    applyI18n();
    if (localeSelect) {
      localeSelect.value = validLocale;
    }
    if (masterToggle) {
      updateMasterUI(masterToggle.checked);
    }
    if (persist) {
      await updateSettings({ locale: validLocale });
    }
  }

  await updateLocale(prefLocale, false);

  if (localeSelect) {
    localeSelect.addEventListener('change', async () => {
      await updateLocale(localeSelect.value, true);
    });
  }

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

  // Handle select dropdowns with unified binding and validation
  const dropdownKeys = ['sidebarScope', 'trimRightRail', 'feedWidth', 'feedFontSize', 'feedMediaHeight'];
  const dropdowns = {};
  dropdownKeys.forEach(key => {
    const el = document.getElementById(key);
    if (el) {
      dropdowns[key] = bindSelectDropdown(el, key, { initialValue: settings[key] });
    }
  });

  // Handle Master toggle
  if (masterToggle) {
    masterToggle.addEventListener('change', async () => {
      const active = masterToggle.checked;
      updateMasterUI(active);
      await updateSettings({ enabled: active });
    });
  }

  // Handle individual pills (checked = visible, except INVERTED_KEYS)
  for (const [key, checkbox] of Object.entries(switches)) {
    if (checkbox) {
      checkbox.addEventListener('change', async () => {
        await updateSettings({ [key]: toStoredValue(key, checkbox.checked) });
        sortAllPillGrids();
      });
    }
  }

  const leftKeys = Object.keys(switches).filter(k => k.startsWith('showLeft') && k !== 'showLeftShortcuts');

  // Section-Level Quick Actions (Left Sidebar)
  async function applySectionValues(keys, value) {
    const patch = {};
    keys.forEach(key => {
      if (switches[key]) switches[key].checked = value;
      patch[key] = value;
    });
    await updateSettings(patch);
    sortAllPillGrids();
  }

  // Left Sidebar Actions
  if (btnLeftHideAll) {
    btnLeftHideAll.addEventListener('click', () => applySectionValues(leftKeys, false));
  }

  if (btnLeftShowAll) {
    btnLeftShowAll.addEventListener('click', () => applySectionValues(leftKeys, true));
  }

  // Global Settings: Restore Recommended Defaults
  if (btnGlobalReset) {
    btnGlobalReset.addEventListener('click', async () => {
      const confirmMsg = getMsg('confirmResetAll') || 'Are you sure you want to restore all settings to recommended defaults?';
      if (!confirm(confirmMsg)) return;

      const { settings: cur } = await chrome.storage.local.get('settings');
      const preservedLocale = cur?.locale || 'en';

      const updated = {
        ...DEFAULTS,
        locale: preservedLocale
      };

      for (const [key, checkbox] of Object.entries(switches)) {
        if (checkbox) {
          const defVal = DEFAULTS[key] !== undefined ? DEFAULTS[key] : true;
          checkbox.checked = toUIChecked(key, defVal);
        }
      }

      dropdownKeys.forEach(key => {
        dropdowns[key]?.update(DEFAULTS[key]);
      });
      updateMasterUI(DEFAULTS.enabled !== false);

      await chrome.storage.local.set({ settings: updated });
      sortAllPillGrids();

      const originalText = getMsg('btnRecommended') || 'Recommended';
      const restoredText = getMsg('feedbackRestored') || 'Restored ✓';
      btnGlobalReset.textContent = restoredText;
      btnGlobalReset.disabled = true;
      setTimeout(() => {
        btnGlobalReset.textContent = originalText;
        btnGlobalReset.disabled = false;
      }, 1500);
    });
  }

  // Live sync states when popup (or another context) changes settings.
  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area !== 'local' || !changes.settings?.newValue) return;
    const next = changes.settings.newValue;
    if (typeof next.enabled === 'boolean') updateMasterUI(next.enabled);
    for (const [key, checkbox] of Object.entries(switches)) {
      if (checkbox && typeof next[key] === 'boolean') checkbox.checked = toUIChecked(key, next[key]);
    }
    dropdownKeys.forEach(key => {
      if (next[key] !== undefined) {
        dropdowns[key]?.update(next[key]);
      }
    });
    if (next.locale && localeSelect && next.locale !== localeSelect.value) {
      await updateLocale(next.locale, false);
    }
    sortAllPillGrids();
  });
});
