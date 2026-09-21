# FB Trim — Minimal Sidebar & Top Navigation

A sleek, ultra-lightweight Google Chrome extension (Manifest V3) that declutters Facebook by trimming unwanted navigation items, sidebar icons, and distraction tabs with zero layout shift.

Designed with a modern dark frosted aesthetic, FB Trim gives you complete granular control over your Facebook desktop workspace.

---

## Features

- **Instant Zero-FOUC Hiding**: Injected at `document_start` using HTML root CSS class tokens to ensure elements never flash or jump on page load.
- **Top Navigation Controls**:
  - **Home**: Always visible core navigation anchor.
  - **4 Granular Toggles**: Reels, Marketplace (default hidden), Groups, and Gaming (default hidden).
- **Left Sidebar Controls**:
  - **Essential Fixed Items**: Profile, Feeds, and Messenger remain permanently visible as core daily essentials.
  - **17 Granular Toggles**: Friends, Groups, Marketplace, Reels, Memories, Saved, Pages, Events, Gaming, Meta AI, Ads Manager, Recent Ad Activity, Professional Dashboard, Messenger Kids, Meta Quest, Fundraisers, and Orders & Payments.
- **Independent Section-Level Actions**: Each navigation section features its own dedicated `Recommended`, `Hide All`, and `Show All` action buttons directly aligned to section headers.
- **Sleek Minimal Popup**: A compact toolbar popup with a built-in master enable/disable switch and quick access to the Options page.
- **Multi-Language Support (i18n)**: Fully localized in English and Traditional Chinese, matching native Facebook terminology.
- **Real-Time Synchronization**: All toggle changes apply instantly across open Facebook tabs without requiring page reloads.

---

## Navigation & Defaults

| Section | Item | Status / Default |
| :--- | :--- | :--- |
| **Top Navigation** | Home | **Always Shown** (Fixed) |
| | Reels | Shown by default |
| | Marketplace | **Hidden by default** |
| | Groups | Shown by default |
| | Gaming | **Hidden by default** |
| **Left Sidebar** | Profile | **Always Shown** (Fixed) |
| | Feeds | **Always Shown** (Fixed) |
| | Messenger | **Always Shown** (Fixed) |
| | Friends, Groups, Reels, Memories, Saved, Pages, Events | Shown by default |
| | Gaming, Meta AI, Ads Manager, Recent Ad Activity, Professional Dashboard, Messenger Kids, Meta Quest, Fundraisers, Orders & Payments | **Hidden by default** |

---

## Installation

1. Clone or download this repository to your local computer.
2. Open Google Chrome and navigate to `chrome://extensions`.
3. Toggle on **Developer mode** in the upper right corner.
4. Click **Load unpacked** in the top left.
5. Select the project root folder (`fb-trim`).
6. Open or refresh Facebook to enjoy a decluttered, focused browsing experience!

---

## Documentation & Architecture

- **[DEVELOPMENT.md](DEVELOPMENT.md)**: Technical architecture, Manifest V3 design patterns, storage synchronization, and selector strategies.
- **[AGENTS.md](AGENTS.md)**: Engineering discipline, coding style, AI behavioral contract, and pre-flight checklist.

