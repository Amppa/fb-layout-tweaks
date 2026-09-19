let localeMessages = null;

async function loadLocaleMessages(locale) {
  try {
    const res = await fetch(chrome.runtime.getURL(`_locales/${locale}/messages.json`));
    localeMessages = await res.json();
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
  const openBtn = document.getElementById('openSettingsBtn');
  const enableToggle = document.getElementById('enableToggle');

  // Load settings & locale: do not auto-detect system language, default to 'en'
  const { settings } = await chrome.storage.local.get('settings');
  const prefLocale = settings?.locale || 'en';
  await loadLocaleMessages(prefLocale);
  applyI18n();
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
  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area === 'local' && changes.settings) {
      const newSettings = changes.settings.newValue || {};
      if (typeof newSettings.enabled === 'boolean' && enableToggle) {
        enableToggle.checked = newSettings.enabled;
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
