/**
 * FB Trim - Options Page Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
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
      masterStatus.textContent = isEnabled ? 'Active' : 'Disabled';
      masterStatus.style.color = 'var(--text-secondary)';
    }
    if (isEnabled) {
      if (uiCleanList) uiCleanList.classList.remove('disabled');
    } else {
      if (uiCleanList) uiCleanList.classList.add('disabled');
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
        if (switches[key]) switches[key].checked = defVal;
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
        if (switches[key]) switches[key].checked = true;
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
        if (switches[key]) switches[key].checked = false;
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
        if (switches[key]) switches[key].checked = defVal;
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
        if (switches[key]) switches[key].checked = true;
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
        if (switches[key]) switches[key].checked = false;
        updated[key] = false;
      });
      await chrome.storage.local.set({ settings: updated });
    });
  }
});
