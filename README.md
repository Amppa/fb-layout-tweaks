# FB Layout Tweaks — Minimal Sidebar & Top Navigation

A sleek, ultra-lightweight Google Chrome extension (Manifest V3) that declutters Facebook by hiding unwanted navigation items, sidebar icons, and distraction tabs with zero layout shift.

Designed with a modern dark frosted aesthetic, FB Layout Tweaks gives you complete granular control over your Facebook desktop workspace.

---

## Features

- **Instant Zero-FOUC Hiding**: Injected at `document_start` using HTML root CSS class tokens to ensure elements never flash or jump on page load.
- **Top Navigation Controls**:
  - **Home**: Always visible core navigation anchor.
  - **4 Granular Toggles**: Reels, Marketplace (default hidden), Groups, and Gaming (default hidden).
- **Left Sidebar Controls**:
  - **Essential Fixed Items**: Profile and Feeds remain permanently visible as core daily essentials.
  - **20 Granular Toggles**: Friends, Groups, Marketplace, Reels, Memories, Saved, Pages, Events, Birthdays, Gaming, Gaming Video, Meta AI, Messenger, Ads Manager, Recent Ad Activity, Professional Dashboard, Messenger Kids, Meta Quest, Fundraisers, and Orders & Payments.
  - **Icon-Only Sidebar**: Optional hover-to-expand rail mode.
- **Independent Section-Level Actions**: Each navigation section features its own dedicated `Recommended`, `Hide All`, and `Show All` action buttons directly aligned to section headers.
- **Sleek Minimal Popup**: A compact toolbar popup with a built-in master enable/disable switch and quick access to the Options page.
- **Multi-Language Support (i18n)**: Fully localized in English and Traditional Chinese, matching native Facebook terminology.
- **Real-Time Synchronization**: All toggle changes apply instantly across open Facebook tabs without requiring page reloads.

---

## Navigation & Defaults

| Section | Item | Status / Default |
| :--- | :--- | :--- |
| **Top Navigation** | Home | **Always Shown** (Fixed) |
| | Reels, Groups | Shown by default |
| | Marketplace, Gaming | **Hidden by default** |
| **Left Sidebar** | Profile, Feeds | **Always Shown** (Fixed) |
| | Friends, Groups | Shown by default |
| | Marketplace, Reels, Memories, Saved, Pages, Events, Birthdays, Gaming, Gaming Video, Meta AI, Messenger, Ads Manager, Recent Ad Activity, Professional Dashboard, Messenger Kids, Meta Quest, Fundraisers, Orders & Payments | **Hidden by default** |

---

## Installation

1. Clone or download this repository to your local computer.
2. Open Google Chrome and navigate to `chrome://extensions`.
3. Toggle on **Developer mode** in the upper right corner.
4. Click **Load unpacked** in the top left.
5. Select the project root folder (`fb-layout-tweaks`).
6. Open or refresh Facebook to enjoy a decluttered, focused browsing experience!

---

## Documentation & Architecture

- **[DEVELOPMENT.md](DEVELOPMENT.md)**: Engineering logics, command runbooks, feature implementation checklist, and TODOs.
- **[ARCHITECTURE.md](ARCHITECTURE.md)**: Feature and directory map, context boundaries, storage sync, and targeting mechanisms.
- **[AGENTS.md](AGENTS.md)**: AI behavioral contract, git workflow, and surgical discipline.


