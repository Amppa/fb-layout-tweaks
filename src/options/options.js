/**
 * FB Trim - Options Page Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  const masterToggle = document.getElementById('enabled');
  const masterStatus = document.getElementById('masterStatus');
  const uiCleanList = document.getElementById('uiCleanList');

  const btnReset = document.getElementById('btnReset');
  const btnHideAll = document.getElementById('btnHideAll');
  const btnShowAll = document.getElementById('btnShowAll');

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
    hideTopMarketplace: false,
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
      masterStatus.style.color = isEnabled ? 'var(--accent-color)' : 'var(--text-secondary)';
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

  // Quick Action: Restore Recommended Defaults
  if (btnReset) {
    btnReset.addEventListener('click', async () => {
      const { settings: current } = await chrome.storage.local.get('settings');
      const updated = { ...current, ...DEFAULTS, enabled: masterToggle ? masterToggle.checked : true };
      for (const [key, checkbox] of Object.entries(switches)) {
        if (checkbox) checkbox.checked = Boolean(DEFAULTS[key]);
      }
      await chrome.storage.local.set({ settings: updated });
    });
  }

  // Quick Action: Hide All
  if (btnHideAll) {
    btnHideAll.addEventListener('click', async () => {
      const { settings: current } = await chrome.storage.local.get('settings');
      const updated = { ...current };
      for (const [key, checkbox] of Object.entries(switches)) {
        if (checkbox) {
          checkbox.checked = true;
          updated[key] = true;
        }
      }
      await chrome.storage.local.set({ settings: updated });
    });
  }

  // Quick Action: Show All
  if (btnShowAll) {
    btnShowAll.addEventListener('click', async () => {
      const { settings: current } = await chrome.storage.local.get('settings');
      const updated = { ...current };
      for (const [key, checkbox] of Object.entries(switches)) {
        if (checkbox) {
          checkbox.checked = false;
          updated[key] = false;
        }
      }
      await chrome.storage.local.set({ settings: updated });
    });
  }
});
