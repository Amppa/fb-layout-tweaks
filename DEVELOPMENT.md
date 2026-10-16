# DEVELOPMENT.md — Engineering Logics, Workflows & Runbook

This document defines core engineering logics, workflows, command runbooks, and project tracking (TODOs & Known Issues).

---

## 1. Quick Runbook (Commands & Effects)

### 1.1 Performance Debugging & Benchmarking (`scripts/perf-debug.js`)

High-fidelity performance measurement suite using Puppeteer. Launches Chrome with unpacked extension loaded and tracks CDP trace, FPS, long tasks, throttled scanner overhead, and layout shifts.

```bash
# 1. Automated Sidebar Benchmark (Mock Facebook, repeatable & offline)
# Opens visible Chrome, tests left & right sidebars expand/collapse for N cycles, outputs metrics:
node scripts/perf-debug.js --mock --sidebars 5

# 2. Automated Sidebar Benchmark (Live Facebook, preserves login state in ~/.fb-layout-tweaks-profile)
node scripts/perf-debug.js --sidebars 5

# 3. Dynamic Feed Mutation & Scanner Stress Test
# Simulates auto-scrolling on feed for 10 seconds, collects scanner latencies, then exits:
node scripts/perf-debug.js --mock --scroll --duration 10

# 4. In-Page Live Performance HUD
# Injects floating diagnostic HUD at bottom-left corner showing real-time FPS, mutations/s, scan ms:
node scripts/perf-debug.js --mock --hud

# 5. Chrome CDP Trace Recording
# Captures full DevTools timeline trace and exports to release/perf-trace.json:
node scripts/perf-debug.js --mock --trace --duration 5

# 6. Headless Execution (CI / headless environment)
node scripts/perf-debug.js --mock --sidebars 3 --headless
```

#### CLI Options & Effects
| Option | Argument | Description & Effect |
| :--- | :--- | :--- |
| `--mock` | None | Boots built-in offline mock Facebook server (`127.0.0.1:<port>`) for repeatable benchmarks. |
| `--sidebars` | `[cycles]` | Runs automated sidebar benchmark (default: 5 cycles). Measures expand/collapse latency, hover handler execution, feed layout shift, and FPS. |
| `--scroll` | None | Enables automatic smooth feed scrolling loop (600px every 1.2s) to stress mutation scanner. |
| `--duration` | `<seconds>` | Automatically finalizes session after N seconds, writes reports, and exits. |
| `--hud` | None | Injects a floating in-page HUD displaying real-time FPS, Long Tasks, and scan timing. |
| `--trace` | None | Records Chrome Performance CDP Trace and saves to `release/perf-trace.json`. |
| `--headless` | None | Runs in headless mode (default: `false`, opens visible window for visual inspection). |
| `--url` | `<url>` | Custom target URL (default: `https://www.facebook.com/`). |
| `--user-data-dir` | `<dir>` | Dedicated Chrome user profile directory (default: `~/.fb-layout-tweaks-profile`). |

All benchmark runs export results to:
- `release/perf-summary.md` (Human-readable Markdown executive report)
- `release/perf-summary.json` (Structured JSON telemetry)

---

### 1.2 Media Height Inspection (`scripts/inspect-media.js`)

Inspects real Facebook DOM structures for feed photos, video reels, multi-image collages, and aspect-ratio wrappers.

```bash
# Launch interactive browser session with media inspector loaded:
node scripts/inspect-media.js

# Target specific profile or custom test URL:
node scripts/inspect-media.js --user-data-dir ~/.fb-layout-tweaks-profile
```

---

### 1.3 Unit Testing (`tests/`)

```bash
# 1. Zero-dependency Windows PowerShell Suite (Recommended for quick checks)
# Runs all 7 structural, i18n symmetry, ARIA, and pure function tests:
powershell -ExecutionPolicy Bypass -File tests/test.ps1

# 2. Node.js Built-in Test Runner (Node 18+)
# Runs full test suite:
node --test tests/*.test.js

# 3. Individual Test Suites
node tests/pure-functions.test.js      # Key-to-class mapping, inverted logic, isFeedPage
node tests/feed-media-height.test.js   # Feed media scaling ratios & limits
node tests/defaults.test.js            # Default settings integrity & schema
node tests/tokens.test.js              # Design tokens CSS consistency
node tests/i18n-usage.test.js          # Symmetrical i18n keys between en and zh_TW
```

---

### 1.4 Extension Packaging & Distribution (`scripts/package.js` / `scripts/package.ps1`)

Generates clean production `.zip` bundles with exclusion of tests, scripts, `.git`, and release artifacts.

```bash
# Node.js packager:
node scripts/package.js --target all       # Builds both Chrome and Firefox zips
node scripts/package.js --target chrome    # Builds release/fb-layout-tweaks-v<version>.zip
node scripts/package.js --target firefox   # Builds release/fb-layout-tweaks-firefox-v<version>.zip

# Or PowerShell packager:
powershell -ExecutionPolicy Bypass -File scripts/package.ps1 -Target all
```

---

### 1.5 Release Flow (GitHub Release)

```bash
# Cut a release (version tag must match manifest.json)
git tag -a v1.4.2 -m "Release v1.4.2"
git push origin v1.4.2
# → .github/workflows/release.yml triggers tests, generates zip archives,
#   and publishes GitHub Release with attached assets.
```
> [!NOTE]
> `release/` is git-ignored: never commit production zips directly to git. CI builds them automatically from tag commits.

---

### 1.6 Local Unpacked Extension Loading

1. In Chrome, navigate to `chrome://extensions/` and enable **Developer mode**.
2. Click **Load unpacked** and select the repository root directory (`fb-layout-tweaks`).
3. Reload extension after code changes:
   - **Popup / Options**: Reopen popup or refresh options tab.
   - **Background Service Worker**: Click the reload icon on extension card.
   - **Content Scripts & CSS**: Click reload icon on extension card, then refresh Facebook tab (`F5`).

---

## 2. Core Engineering Logics & Patterns

### State & Storage Logic
- **Single Source of Truth**: All default states live in `src/shared/defaults.js` (`DEFAULT_SETTINGS`).
- **Storage Scope**: All settings are persisted under the `settings` key in `chrome.storage.local`.
- **Safe Read**: Always provide fallbacks: `chrome.storage.local.get({ settings: DEFAULT_SETTINGS }, callback)`.
- **Granular Write**: Write merged updates directly to the `settings` object in `chrome.storage.local`.
- **Live Sync**: Rely on `chrome.storage.onChanged` across options, popup, and content scripts instead of point-to-point runtime messaging.
- **Key-to-Class Mapping**: Per-item settings keys use `show*` convention (e.g. `showLeftGaming`, `showTopReels`). Section masters use `trim*` convention (`trimTopNav`, `trimLeftItems`, `trimRightRail`, `trimMainFeed`); a trimmed-off section restores native items regardless of granular settings. Content script maps `false` values to `fb-layout-tweaks-hide-*` root classes via `getUiCleanClassName(key)`:
  - `showLeftMetaAI` -> `fb-layout-tweaks-hide-left-metaai`
  - General pattern: `show*` -> `hide*` -> kebab-case (`showLeftGaming` -> `fb-layout-tweaks-hide-left-gaming`).

### Performance & Timing Logics
- **Zero-FOUC Execution**: Content scripts run at `document_start` to apply root CSS tokens before first paint.
- **DOM Observers & Throttled Scans**: `content.js` wraps dynamic element scanning in `requestAnimationFrame` (`triggerThrottledScan`) triggered by a `MutationObserver` on `document.documentElement` to prevent layout thrashing during DOM mutations.

### Selector Resilience & Scoped Rules
- **No Transient Hashed Classes**: Never bind hide rules to transient hashed CSS classes (e.g. `.x193iq5w`).
- **Semantic Anchors**: Match semantic URLs (`href*="/friends/"`), stable ARIA attributes (`aria-label`), SVG icons, or dynamic text detection.
- **Strictly Scoped**: All hiding rules in `src/content/content.css` must be scoped under root classes (e.g., `html.fb-layout-tweaks-hide-left-gaming div[role="navigation"] ...`) to avoid unintended side effects.

### UI & Design Tokens
- **No Magic Numbers**: Colors, dimensions, and theme variables belong in CSS custom properties (`:root`).
- **Shared Design Tokens**: Extension page theming lives in `src/shared/tokens.css`, linked before the page stylesheet in `src/popup/popup.html` and `src/options/options.html`. Never duplicate tokens into page stylesheets. Content styles (`src/content/content.css`) must NOT use these tokens — injected page CSS uses Facebook's own variables.
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
2. [ ] **Content CSS** (`src/content/content.css`): Add scoped hiding rule under `html.fb-layout-tweaks-hide-<name>`.
3. [ ] **Options UI** (`src/options/options.html` + `src/options/options.js`):
   - Add pill `<label class="pill">` with `<input type="checkbox" id="show..." aria-label="...">` and `data-i18n`.
   - *Top Nav boundary*: If adding a **Top Navigation** item, also register the key in the `topKeys` array in `src/options/options.js` so section quick actions (`Recommended`, `Hide All`, `Show All`) include it.
   - *Dropdown/Enum boundary*: If adding a `<select>` enum (e.g. `sidebarScope`, `feedWidth`, `feedFontSize`), bind init + `change` persistence like `sidebarScope`, whitelist stored values with fallback to the default, and mirror the value in the `chrome.storage.onChanged` live-sync handler.
4. [ ] **Localization** (`_locales/en/messages.json` & `_locales/zh_TW/messages.json`): Add bilingual translations for the item label.
5. [ ] **Class Mapping** (`src/content/content.js`): If the key name requires special hyphenation, verify `getUiCleanClassName(key)` resolves to the expected CSS class. Non-`show*` keys (booleans like `centerMainFeed`, enums like `feedWidth`/`feedFontSize`) toggle explicit `fb-layout-tweaks-*` tokens gated by `isSidebarActive`.
6. [ ] **Tests** (`tests/defaults.test.js` / `tests/test.ps1`): Run unit tests to confirm defaults, options HTML IDs, aria-labels, and i18n keys are 100% synchronized.

---

## 4. TODOs & Known Issues

### Planned Tasks (TODO)
- [ ] *(None currently - core features and options synchronized)*

### Known Issues & Quirks
- **Facebook DOM Obfuscation**: Facebook periodically restructures its navigation DOM. If items fail to hide, check for changes in URL patterns or ARIA labels.
- **Lazy "See More" Items**: Items nested deep in the left sidebar (such as Ads Manager) require the dynamic scanner pass triggered after user expansion.
