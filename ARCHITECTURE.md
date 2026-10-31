# ARCHITECTURE.md — Feature & Directory Map

Quick-reference map to help developers and AI assistants navigate features to their corresponding directory boundaries and understand core data flows.

---

## 1. Feature to Directory Index

| Feature / Domain | Directory | Primary Responsibility & Context |
| :--- | :--- | :--- |
| **Host DOM & Injected UI** | `src/content/` | Injected into Facebook (`https://www.facebook.com/*`); Zero-FOUC root class injector (`content.js`) and scoped declarative CSS hiding rules (`content.css`); left/top per-item hides plus right-rail avatar collapse with dynamic text scanner for lazy sections. |
| **Background Service Worker** | `src/background/` | Manifest V3 service worker (`background.js`); installation lifecycle & `DEFAULT_SETTINGS` initialization in `chrome.storage.local`. |
| **Toolbar Quick Panel** | `src/popup/` | Ephemeral browser action panel (`popup.html` / `popup.js` / `popup.css`); master ON/OFF toggle, section quick toggles (`trimTopNav`, `trimLeftItems`, `trimRightRail`, `hoverExpandLeftRail`, `trimMainFeed`), jump to options. |
| **Extension Settings Page** | `src/options/` | Full-tab configuration center (`options.html` / `options.js` / `options.css`); four cards — Top pills, Left pills + minimize, Right minimize + per-section hide switches (checked = hidden), Main Feed master switch (`trimMainFeed`) + centering switch + feed width / font-size dropdowns; section master switches linked to popup (`trimTopNav`, `trimLeftItems`, `trimRightRail`, `trimMainFeed`), section actions (`Recommended`, `Hide All`, `Show All`) for Top/Left pills. |
| **Shared Foundations** | `src/shared/` | Cross-context utilities: state defaults (`defaults.js`, authored in top/left/right/main groups), i18n localization helper (`i18n.js`), design tokens (`tokens.css`, linked by popup/options pages). |
| **Localization Dictionaries** | `_locales/` | Native Chrome i18n dictionaries: English fallback (`_locales/en/messages.json`) and Traditional Chinese (`_locales/zh_TW/messages.json`). |
| **Icons & Brand Artwork** | `icons/`, `design/` | Production PNGs (`icons/`: 16, 32, 48, 128px) vs master SVG and design assets (`design/`). |
| **Release & Tooling** | `scripts/`, `tests/` | Packaging automation (`scripts/package.js`, `scripts/package.ps1`) and integrity unit tests (`tests/*.test.js`, `tests/test.ps1`). |

---

## 2. Context Boundaries & Storage Sync

All contexts communicate through `chrome.storage.local` with event-driven synchronization (`chrome.storage.onChanged`). No point-to-point messaging required for standard settings.

```mermaid
graph TD
    subgraph Storage [Chrome Storage Local]
        S[settings object]
    end

    subgraph Extension Components
        BG[Background Service Worker<br/>src/background/background.js]
        POP[Popup Interface<br/>src/popup/popup.js]
        OPT[Options Dashboard<br/>src/options/options.js]
        CS[Content Script<br/>src/content/content.js]
    end

    BG -->|Initialize & Migrate Defaults| S
    POP -->|Read / Toggle Master Switch| S
    OPT -->|Read / Update Granular Toggles| S
    S -.->|chrome.storage.onChanged| CS
    S -.->|chrome.storage.onChanged| POP
    S -.->|chrome.storage.onChanged| OPT
    CS -->|Inject class tokens on &lt;html&gt;| FB[Facebook DOM]
```

### Context Characteristics
- **Content (`src/content/`)**: Tied to web tab lifecycle (`https://www.facebook.com/*`). Executes at `document_start` before first paint. Injects CSS tokens onto `<html>` (`document.documentElement`) and monitors dynamic nodes via a debounced `MutationObserver`.
- **Popup (`src/popup/`)**: Ephemeral panel. Destroyed immediately when user clicks away. Changes are committed immediately to `chrome.storage.local`.
- **Options (`src/options/`)**: Dedicated browser tab. Full settings center for granular sidebar and navigation options.
- **Background (`src/background/`)**: Event-driven MV3 service worker. Ensures default values exist in `chrome.storage.local` on install or update.

---

## 3. Targeting & Injection Architecture

### Zero-FOUC Injection Strategy
1. Content script registered in `manifest.json` with `"run_at": "document_start"`.
2. Both `content.css` and `content.js` execute before DOM tree painting begins.
3. `content.js` queries `chrome.storage.local` immediately and applies CSS token classes directly to `document.documentElement` (`<html>`):
   ```javascript
   root.classList.toggle('fb-layout-tweaks-hide-left-gaming', isEnabled);
   ```
4. `content.css` suppresses elements purely through declarative descendant selectors:
   ```css
   html.fb-layout-tweaks-hide-left-gaming div[role="navigation"] a[href*="/gaming/"] {
     display: none !important;
   }
   ```
   This guarantees target elements are hidden prior to the browser's initial render frame.

### Dual-Layer Targeting: Static Selectors + Dynamic Scanner
Facebook uses compiled React components with dynamic, hashed classes (`.x193iq5w`).
- **Primary Layer (Attribute & URL Matching)**: Matches stable attributes such as `href*="/friends/"`, `href*="/marketplace/"`, SVG paths, or `aria-label`.
- **Secondary Layer (Dynamic Text Scanner)**: Lazy-loaded or dynamic items (e.g., **Ads Manager** nested under "See More") receive `.fb-layout-tweaks-hide-left-ads-manager-node` via a scanner triggered by `MutationObserver`. Scans are capped at one per 150ms, gated by sidebar scope and open dialogs, and reuse cached rail references with short miss cooldowns to avoid repeated document-wide queries.

### Main Feed Expansion & Font Scaling Mechanics
- **Parent Container Uncap**: Facebook imposes a `max-width: 1464px` clamp on the three-column wrapper. The extension uses `:has(> :is([role="main"], [data-pagelet="Feed"]))` to release the parent container to `100%`, allowing the feed to widen past 1464px on high-resolution displays.
- **5-Depth Column Release & Floating Anchor Protection**: Facebook locks the central feed column to 680px five `div` layers deep with no semantic hooks. The extension widens depths 1–5 (`[role="main"] > div ... > div`) uniformly with `max-width: var(--fb-lt-feed-width) !important;`. Floating pill anchors (`.xbudbmw`, e.g. "New posts" pill positioned at `left: 50%`) are explicitly excluded directly (`:not([class*="xbudbmw"])`) and clamped to 0-width to prevent +150% horizontal overflow, without using ancestor `:has()` exclusions that could collapse feed columns when new posts arrive.
- **Viewport Horizontal Containment**: Root `<html>` enforces `overflow-x: hidden !important;` in widened feed modes, guaranteeing zero horizontal scrollbars or dead whitespace on wide viewports. `<body>` is deliberately left unconstrained (`overflow: visible`) because setting `overflow-x: hidden` on `<body>` compels its `overflow-y` to compute to `auto` under CSS specifications, generating a duplicate vertical scrollbar.
- **Percentage Specificity**: Percentage modes (50%, 60%, 70%, 75%, 80%, 90%, 100%) size only the direct child (`[role="main"] > div`) to avoid compound shrinkage down the 5-depth chain. To prevent generic rules from overriding percentage widths, percentage rules match `:is(div[role="feed"], [data-pagelet="Feed"], [role="main"]) > div` to maintain equal `(0, 2, 3)` specificity.
- **Scoped Font Scaling**: Text sizing applies strictly to `div[dir="auto"]` body and comment text (`font-size: 1.5em`, `2em`, `3em`), leaving avatars, icons, and dialogs at native size and avoiding nested `span` compounding.

### Collateral Damage Prevention (LayoutGuard & Circuit Breaker)
To eliminate false-positive hides ("誤殺") in Facebook's dynamic, obfuscated DOM:
- **Negative Invariant Guard (`isSafeExclusiveContainer`)**: Before tagging any DOM container as `.fb-layout-tweaks-*-rail-parent`, the detector validates that the candidate does NOT enclose any critical layout landmark outside the target payload (e.g., `[role="main"]`, `[data-pagelet="Feed"]`, `header`, `[role="navigation"]`). Multi-column flex containers are strictly rejected.
- **Exclusivity Validation**: Candidate wrappers must not contain active layout sibling elements with non-zero dimensions or semantic roles.
- **Double-Bolt CSS Contract**: Destructive hide rules on rail parents enforce `:has(> :is(...):only-child)`. Even if dynamic tagging misidentifies a container, CSS refuses to collapse any wrapper that has sibling elements.
- **Layout Circuit Breaker & Fail-Safe Watchdog (`verifyLayoutHealth` & `tripLayoutCircuitBreaker`)**: Active monitoring runs at 1.5s, 4s, and 10s post-initialization. If `[role="main"]` is detected with zero dimensions or `display: none`, the circuit breaker trips, instantly strips destructive rail parent classes, restores the feed to safe mode, and reports a health failure to the extension badge.
