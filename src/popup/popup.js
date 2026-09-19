document.addEventListener('DOMContentLoaded', async () => {
  const openBtn = document.getElementById('openSettingsBtn');
  const enableToggle = document.getElementById('enableToggle');

  // Load initial enabled status
  const { settings } = await chrome.storage.local.get('settings');
  if (enableToggle) {
    enableToggle.checked = settings?.enabled !== false;

    enableToggle.addEventListener('change', async () => {
      const data = await chrome.storage.local.get('settings');
      const current = data.settings || {};
      const updated = { ...current, enabled: enableToggle.checked };
      await chrome.storage.local.set({ settings: updated });
    });
  }

  // Listen for storage changes from Options page
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.settings && enableToggle) {
      const newSettings = changes.settings.newValue;
      if (newSettings && typeof newSettings.enabled === 'boolean') {
        enableToggle.checked = newSettings.enabled;
      }
    }
  });

  if (openBtn) {
    openBtn.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
  }
});
