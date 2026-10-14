# FB Layout Tweaks

A lightweight Chrome extension (Manifest V3) that declutters Facebook desktop navigation with zero layout shift.

## Key Features

- **Declutter Navigation**: Hide unwanted items in Top Navigation, Left Sidebar, and Right Sidebar with instant zero-FOUC hiding.
- **Icon-Only Sidebars**: Shrink left and right sidebars into 72px icon rails that expand smoothly on hover as non-pushing overlays.
- **Customizable Main Feed**: Adjust feed post display width (1000px, 1600px, 50%, 75%, 100%), scale post body text size (150%, 200%, 300%), and maintain centered alignment.
- **Instant Sync**: All settings update across open Facebook tabs in real time without reloading.

---

## How to Use

### 1. Toolbar Popup (Quick Controls)
Click the extension icon in your Chrome toolbar to:
- Turn the extension on or off with the master toggle.
- Quickly toggle **Minimize Left Sidebar** (icon-only rail).
- Quickly toggle **Minimize Right Sidebar** (avatar rail).
- Quickly toggle **Enlarge Main Feed**.
- Click **Detailed Settings** to open the full options dashboard.

### 2. Options Page (Granular Settings)
Right-click the extension icon and select **Options** (or click **Detailed Settings** from the popup):
- **Top Navigation Items**: Show or hide individual items (Reels, Marketplace, Groups, Gaming).
- **Left Sidebar Items & Behavior**: Fine-tune 20+ sidebar shortcuts and toggle icon-only hover expand mode.
- **Right Sidebar Items & Behavior**: Hide Sponsored, Birthdays, Meta AI, and toggle avatar rail mode.
- **Main Feed**: Toggle feed enlargement, keep feed centered, choose feed width (Original 680px, 1000px, 1600px, 50%, 75%, 100%), and scale text size (up to 300%).
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


