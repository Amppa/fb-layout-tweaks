document.addEventListener('DOMContentLoaded', async () => {
  const openBtn = document.getElementById('openSettingsBtn');
  const statusText = document.getElementById('statusText');
  const statusDot = document.getElementById('statusDot');

  const { settings } = await chrome.storage.local.get('settings');
  const isEnabled = settings?.enabled !== false;

  if (statusText && statusDot) {
    if (isEnabled) {
      statusText.textContent = 'Active';
      statusText.className = 'status-text';
      statusDot.className = 'status-indicator';
    } else {
      statusText.textContent = 'Disabled';
      statusText.className = 'status-text disabled';
      statusDot.className = 'status-indicator disabled';
    }
  }

  if (openBtn) {
    openBtn.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
  }
});
