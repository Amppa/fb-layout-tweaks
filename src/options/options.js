let currentLocale = 'en';
let localeMessages = null;

async function loadLocaleMessages(locale) {
  try {
    const res = await fetch(chrome.runtime.getURL(`_locales/${locale}/messages.json`));
    localeMessages = await res.json();
    currentLocale = locale;
  } catch (e) {
    localeMessages = null;
  }
}

function getMsg(key) {
  if (localeMessages && localeMessages[key]?.message) {
    return localeMessages[key].message;
  }
  return chrome.i18n.getMessage(key) || '';
}

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const msg = getMsg(key);
    if (msg) el.textContent = msg;
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    const msg = getMsg(key);
    if (msg) el.title = msg;
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  const langSegments = document.querySelectorAll('.lang-segment');

  const masterToggle = document.getElementById('enabled');
  const masterStatus = document.getElementById('masterStatus');
  const uiCleanList = document.getElementById('uiCleanList');

  const btnTopReset = document.getElementById('btnTopReset');
  const btnTopHideAll = document.getElementById('btnTopHideAll');
  const btnTopShowAll = document.getElementById('btnTopShowAll');

  const btnLeftReset = document.getElementById('btnLeftReset');
  const btnLeftHideAll = document.getElementById('btnLeftHideAll');
  const btnLeftShowAll = document.getElementById('btnLeftShowAll');

  // Curated clean defaults
  const DEFAULTS = {
    enabled: true,
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
    hideTopReels: false,
    hideTopMarketplace: true,
    hideTopGroups: false,
    hideTopGaming: true
  };

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
      masterStatus.style.color = 'var(--text-secondary)';
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

  function updateStatusIcon(checkbox) {
    if (!checkbox || !checkbox.id) return;
    const iconEl = document.getElementById(`status_${checkbox.id}`);
    if (iconEl) {
      iconEl.textContent = checkbox.checked ? '🙈' : '🐵';
      iconEl.title = checkbox.checked ? (getMsg('hintHidden') || '已隱藏') : (getMsg('hintVisible') || '正常顯示');
    }
  }

  // Load initial settings
  const data = await chrome.storage.local.get('settings');
  const settings = data.settings || {};

  updateMasterUI(settings.enabled !== false);

  for (const [key, checkbox] of Object.entries(switches)) {
    if (checkbox) {
      const defaultValue = DEFAULTS[key] !== undefined ? DEFAULTS[key] : false;
      checkbox.checked = settings[key] !== undefined ? settings[key] : defaultValue;
      updateStatusIcon(checkbox);
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

  // Handle individual switches
  for (const [key, checkbox] of Object.entries(switches)) {
    if (checkbox) {
      checkbox.addEventListener('change', async () => {
        updateStatusIcon(checkbox);
        const { settings: current } = await chrome.storage.local.get('settings');
        const updated = { ...current, [key]: checkbox.checked };
        await chrome.storage.local.set({ settings: updated });
      });
    }
  }

  const topKeys = ['hideTopReels', 'hideTopMarketplace', 'hideTopGroups', 'hideTopGaming'];
  const leftKeys = Object.keys(switches).filter(k => k.startsWith('hideLeft'));

  // Top Navigation Actions
  if (btnTopReset) {
    btnTopReset.addEventListener('click', async () => {
      const { settings: current } = await chrome.storage.local.get('settings');
      const updated = { ...current };
      topKeys.forEach(key => {
        const defVal = Boolean(DEFAULTS[key]);
        if (switches[key]) {
          switches[key].checked = defVal;
          updateStatusIcon(switches[key]);
        }
        updated[key] = defVal;
      });
      await chrome.storage.local.set({ settings: updated });
    });
  }

  if (btnTopHideAll) {
    btnTopHideAll.addEventListener('click', async () => {
      const { settings: current } = await chrome.storage.local.get('settings');
      const updated = { ...current };
      topKeys.forEach(key => {
        if (switches[key]) {
          switches[key].checked = true;
          updateStatusIcon(switches[key]);
        }
        updated[key] = true;
      });
      await chrome.storage.local.set({ settings: updated });
    });
  }

  if (btnTopShowAll) {
    btnTopShowAll.addEventListener('click', async () => {
      const { settings: current } = await chrome.storage.local.get('settings');
      const updated = { ...current };
      topKeys.forEach(key => {
        if (switches[key]) {
          switches[key].checked = false;
          updateStatusIcon(switches[key]);
        }
        updated[key] = false;
      });
      await chrome.storage.local.set({ settings: updated });
    });
  }

  // Left Sidebar Actions
  if (btnLeftReset) {
    btnLeftReset.addEventListener('click', async () => {
      const { settings: current } = await chrome.storage.local.get('settings');
      const updated = { ...current };
      leftKeys.forEach(key => {
        const defVal = Boolean(DEFAULTS[key]);
        if (switches[key]) {
          switches[key].checked = defVal;
          updateStatusIcon(switches[key]);
        }
        updated[key] = defVal;
      });
      await chrome.storage.local.set({ settings: updated });
    });
  }

  if (btnLeftHideAll) {
    btnLeftHideAll.addEventListener('click', async () => {
      const { settings: current } = await chrome.storage.local.get('settings');
      const updated = { ...current };
      leftKeys.forEach(key => {
        if (switches[key]) {
          switches[key].checked = true;
          updateStatusIcon(switches[key]);
        }
        updated[key] = true;
      });
      await chrome.storage.local.set({ settings: updated });
    });
  }

  if (btnLeftShowAll) {
    btnLeftShowAll.addEventListener('click', async () => {
      const { settings: current } = await chrome.storage.local.get('settings');
      const updated = { ...current };
      leftKeys.forEach(key => {
        if (switches[key]) {
          switches[key].checked = false;
          updateStatusIcon(switches[key]);
        }
        updated[key] = false;
      });
      await chrome.storage.local.set({ settings: updated });
    });
  }
});
