/**
 * FB Trim - Shared i18n Helpers
 * Single copy shared by popup and options pages (loaded via <script> tag).
 * Tracks currentLocale so callers can guard against redundant locale switches.
 */

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