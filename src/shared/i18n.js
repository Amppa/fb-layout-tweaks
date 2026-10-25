/**
 * FB Layout Tweaks - Shared i18n Helpers
 * Single copy shared by popup and options pages (loaded via <script> tag).
 * Tracks currentLocale so callers can guard against redundant locale switches.
 */

let currentLocale = 'en';
let localeMessages = null;

function resolveEffectiveLocale(prefLocale) {
  if (prefLocale === 'zh_TW' || prefLocale === 'en') {
    return prefLocale;
  }
  const uiLang = (typeof chrome !== 'undefined' && chrome.i18n?.getUILanguage ? chrome.i18n.getUILanguage() : (typeof navigator !== 'undefined' ? navigator.language : '')) || '';
  if (uiLang.toLowerCase().startsWith('zh')) {
    return 'zh_TW';
  }
  return 'en';
}

async function loadLocaleMessages(locale) {
  const effectiveLocale = resolveEffectiveLocale(locale);
  try {
    const res = await fetch(chrome.runtime.getURL(`_locales/${effectiveLocale}/messages.json`));
    localeMessages = await res.json();
    currentLocale = effectiveLocale;
  } catch (e) {
    localeMessages = null;
  }
}

function getMsg(key) {
  if (localeMessages && localeMessages[key]?.message) {
    return localeMessages[key].message;
  }
  return (typeof chrome !== 'undefined' && chrome.i18n?.getMessage ? chrome.i18n.getMessage(key) : '') || '';
}

function applyI18n() {
  if (typeof document === 'undefined') return;
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
  if (document.documentElement) {
    document.documentElement.setAttribute('data-i18n-ready', 'true');
  }
}

// Safety timeout: ensure UI is never permanently hidden if script execution fails
if (typeof setTimeout !== 'undefined' && typeof document !== 'undefined') {
  setTimeout(() => {
    if (document.documentElement && !document.documentElement.hasAttribute('data-i18n-ready')) {
      document.documentElement.setAttribute('data-i18n-ready', 'true');
    }
  }, 2000);
}

if (typeof self !== 'undefined') {
  self.resolveEffectiveLocale = resolveEffectiveLocale;
  self.loadLocaleMessages = loadLocaleMessages;
  self.getMsg = getMsg;
  self.applyI18n = applyI18n;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    resolveEffectiveLocale,
    getMsg,
    loadLocaleMessages,
    applyI18n,
    setLocaleMessages: (msgs) => { localeMessages = msgs; },
    getLocaleMessages: () => localeMessages
  };
}