# FB Layout Tweaks

A lightweight Chrome extension (Manifest V3) that declutters Facebook desktop navigation with zero layout shift.

## Key Features

- **Declutter Navigation**: Hide unwanted items in both Top Navigation and Left Sidebar with instant zero-FOUC hiding.
- **Icon-Only Sidebar**: Shrink the left sidebar into an icon-only rail (72px) that smoothly expands on hover without shifting the main feed.
- **Instant Sync**: All settings update across open Facebook tabs in real time without reloading.

---

## How to Use

### 1. Toolbar Popup (Quick Controls)
Click the extension icon in your Chrome toolbar to:
- Turn the extension on or off with the master toggle.
- Quickly toggle **Top Navigation Items**, **Left Sidebar Items**, or **Left Sidebar Icon-only** mode.
- Click **Detailed Settings** to open the full options dashboard.

### 2. Options Page (Granular Settings)
Right-click the extension icon and select **Options** (or click **Detailed Settings** from the popup):
- **Top Navigation Items**: Show or hide individual items (Reels, Marketplace, Groups, Gaming).
- **Left Sidebar Items**: Fine-tune 20+ sidebar shortcuts. Use **Recommended**, **Hide All**, or **Show All** to quickly batch-configure.
- **Left Sidebar Behavior**: Toggle the icon-only hover expand mode.
- **Language Switch**: Switch between English and Traditional Chinese (繁體中文).

---

## Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/Amppa/fb-layout-tweaks.git
   ```
2. In Google Chrome, go to `chrome://extensions/`.
3. Enable **Developer mode** in the top-right corner.
4. Click **Load unpacked** and select the `fb-layout-tweaks` directory.
5. Open [Facebook](https://www.facebook.com) to enjoy your clean layout!

---

## Technical Documentation

- **[ARCHITECTURE.md](ARCHITECTURE.md)**: Feature and directory map, storage sync, and injection mechanism.
- **[DEVELOPMENT.md](DEVELOPMENT.md)**: Engineering runbook, coding standards, and implementation checklist.


