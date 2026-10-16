/**
 * FB Layout Tweaks - Shared Toolbar Badge State
 * Pure badge decision shared by the background service worker (via importScripts)
 * and unit tests (via require). DOM-free and chrome-free.
 */

// Master switch off: gray lowercase "off" (off wins over every other state).
const BADGE_OFF_TEXT = 'off';
const BADGE_OFF_COLOR = '#6b7280';
// Content health check failure: red "!".
const BADGE_ALERT_TEXT = '!';
const BADGE_ALERT_COLOR = '#d93025';
// Health reports older than this are treated as stale (e.g. user away from Facebook).
const HEALTH_MAX_AGE_MS = 30 * 60 * 1000;

function decideBadgeState({ enabled, healthOk, healthTs, now } = {}) {
  if (enabled === false) {
    return { text: BADGE_OFF_TEXT, backgroundColor: BADGE_OFF_COLOR };
  }
  if (healthOk === false
    && typeof healthTs === 'number'
    && typeof now === 'number'
    && now - healthTs <= HEALTH_MAX_AGE_MS) {
    return { text: BADGE_ALERT_TEXT, backgroundColor: BADGE_ALERT_COLOR };
  }
  return null;
}

if (typeof self !== 'undefined') {
  self.BADGE_OFF_TEXT = BADGE_OFF_TEXT;
  self.BADGE_OFF_COLOR = BADGE_OFF_COLOR;
  self.BADGE_ALERT_TEXT = BADGE_ALERT_TEXT;
  self.BADGE_ALERT_COLOR = BADGE_ALERT_COLOR;
  self.HEALTH_MAX_AGE_MS = HEALTH_MAX_AGE_MS;
  self.decideBadgeState = decideBadgeState;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    BADGE_OFF_TEXT,
    BADGE_OFF_COLOR,
    BADGE_ALERT_TEXT,
    BADGE_ALERT_COLOR,
    HEALTH_MAX_AGE_MS,
    decideBadgeState
  };
}
