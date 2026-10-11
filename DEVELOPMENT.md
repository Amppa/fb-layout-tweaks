# DEVELOPMENT.md — Engineering Logics, Workflows & Runbook

This document defines core engineering logics, workflows, command runbooks, and project tracking (TODOs & Known Issues).

---

## 1. Quick Runbook (Commands)

```bash
# Run unit tests (Node.js 18+ built-in test runner)
node tests/defaults.test.js
# Or: node --test tests/defaults.test.js

# Or pure Windows PowerShell unit tests (Zero dependencies):
powershell -ExecutionPolicy Bypass -File tests/test.ps1

# Package clean release zip (outputs to release/fb-layout-tweaks-v<version>.zip)
node scripts/package.js
# Or Windows PowerShell:
powershell -ExecutionPolicy Bypass -File scripts/package.ps1
```

### Local Extension Loading
1. In Chrome, open `chrome://extensions/` and enable **Developer mode**.
2. Click **Load unpacked** and select the repository root directory (`fb-layout-tweaks`).
3. Reload extension card after code changes:
   - **Popup / Options**: Reopen the popup or reload the options tab.
   - **Background Service Worker**: Click the reload icon on the extension card in `chrome://extensions/`.
   - **Content Scripts & CSS**: Reload extension card, then refresh the Facebook tab (`https://www.facebook.com/*`).

---

## 2. Core Engineering Logics & Patterns

### State & Storage Logic
- **Single Source of Truth**: All default states live in `src/shared/defaults.js` (`DEFAULT_SETTINGS`).
- **Storage Scope**: All settings are persisted under the `settings` key in `chrome.storage.local`.
- **Safe Read**: Always provide fallbacks: `chrome.storage.local.get({ settings: DEFAULT_SETTINGS }, callback)`.
- **Granular Write**: Write merged updates directly to the `settings` object in `chrome.storage.local`.
- **Live Sync**: Rely on `chrome.storage.onChanged` across options, popup, and content scripts instead of point-to-point runtime messaging.
- **Key-to-Class Mapping**: Per-item settings keys use `show*` convention (e.g. `showLeftGaming`, `showTopReels`). Section masters use `trim*` convention (`trimTopNav`, `trimLeftItems`); a trimmed-off section restores native items regardless of pills. Content script maps `false` values to `fb-diet-hide-*` root classes via `getUiCleanClassName(key)`:
  - `showLeftMetaAI` -> `fb-diet-hide-left-metaai`
  - General pattern: `show*` -> `hide*` -> kebab-case (`showLeftGaming` -> `fb-diet-hide-left-gaming`).

### Performance & Timing Logics
- **Zero-FOUC Execution**: Content scripts run at `document_start` to apply root CSS tokens before first paint.
- **DOM Observers & Throttled Scans**: `content.js` wraps dynamic element scanning in `requestAnimationFrame` (`triggerThrottledScan`) triggered by a `MutationObserver` on `document.documentElement` to prevent layout thrashing during DOM mutations.

### Selector Resilience & Scoped Rules
- **No Transient Hashed Classes**: Never bind hide rules to transient hashed CSS classes (e.g. `.x193iq5w`).
- **Semantic Anchors**: Match semantic URLs (`href*="/friends/"`), stable ARIA attributes (`aria-label`), SVG icons, or dynamic text detection.
- **Strictly Scoped**: All hiding rules in `src/content/content.css` must be scoped under root classes (e.g., `html.fb-diet-hide-left-gaming div[role="navigation"] ...`) to avoid unintended side effects.

### UI & Design Tokens
- **No Magic Numbers**: Colors, dimensions, and theme variables belong in CSS custom properties (`:root`).
- **Synchronized Theme Variables**: Keep theme variables aligned between `src/popup/popup.css` and `src/options/options.css` (`--bg-primary`, `--bg-card`, `--text-primary`, `--divider`, `--accent-color`).
- **Reuse Existing Components**: Use existing classes (`.action-btn`, `.pill`, `.switch`, `.badge-fixed`) rather than inventing parallel styles.

### Internationalization (i18n) Logic
- Chrome's native internationalization API (`chrome.i18n`) with dictionaries in `_locales/en/` and `_locales/zh_TW/`.
- **Shared Helpers (`src/shared/i18n.js`)**:
  - `loadLocaleMessages(locale)`: Fetches dictionary JSON.
  - `getMsg(key)`: Looks up key with fallback to `chrome.i18n.getMessage(key)`.
  - `applyI18n()`: Hydrates elements with `[data-i18n]` and `[data-i18n-title]`.

### Accessibility (a11y)
- **Screen Reader Labels**: Every toggle and pill `<input type="checkbox">` must have an explicit `aria-label`.
- **Keyboard Navigation**: Interactive elements (`button`, `.switch input`, `.pill input`, `a`) must provide a clear `:focus-visible` outline.

### MV3 Security Guardrails
- **Zero dynamic `innerHTML`**: Strictly use `textContent` or `document.createElement`.
- **Zero inline handlers**: No `onclick="..."` in HTML. Use `addEventListener` in JS.
- **Zero remote scripts**: All scripts, stylesheets, and assets must be bundled locally inside the extension.

---

## 3. Feature Implementation Flow (Checklist)

When introducing a new setting or navigation item to hide, update in this order:

1. [ ] **Defaults** (`src/shared/defaults.js`): Register `show*` key & initial fallback boolean in `DEFAULT_SETTINGS`.
2. [ ] **Content CSS** (`src/content/content.css`): Add scoped hiding rule under `html.fb-diet-hide-<name>`.
3. [ ] **Options UI** (`src/options/options.html` + `src/options/options.js`):
   - Add pill `<label class="pill">` with `<input type="checkbox" id="show..." aria-label="...">` and `data-i18n`.
   - *Top Nav boundary*: If adding a **Top Navigation** item, also register the key in the `topKeys` array in `src/options/options.js` so section quick actions (`Recommended`, `Hide All`, `Show All`) include it.
4. [ ] **Localization** (`_locales/en/messages.json` & `_locales/zh_TW/messages.json`): Add bilingual translations for the item label.
5. [ ] **Class Mapping** (`src/content/content.js`): If the key name requires special hyphenation, verify `getUiCleanClassName(key)` resolves to the expected CSS class.
6. [ ] **Tests** (`tests/defaults.test.js` / `tests/test.ps1`): Run unit tests to confirm defaults, options HTML IDs, aria-labels, and i18n keys are 100% synchronized.

---

## 4. TODOs & Known Issues

### Planned Tasks (TODO)
- [ ] *(None currently - core features and options synchronized)*

### Known Issues & Quirks
- **Facebook DOM Obfuscation**: Facebook periodically restructures its navigation DOM. If items fail to hide, check for changes in URL patterns or ARIA labels.
- **Lazy "See More" Items**: Items nested deep in the left sidebar (such as Ads Manager) require the dynamic scanner pass triggered after user expansion.
