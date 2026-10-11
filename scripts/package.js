// scripts/package.js
// Packages the extension into clean release zips for Chrome and Firefox.
// Zero npm dependencies: uses built-in system tools (tar, PowerShell Compress-Archive, or zip).
//
// Usage:
//   node scripts/package.js [--target chrome|firefox|all]
//
// Outputs (version read from manifest.json):
//   chrome:  release/fb-layout-tweaks-v<version>.zip
//   firefox: release/fb-layout-tweaks-firefox-v<version>.zip
//
// The Firefox build stages the same files with a patched manifest that adds
// browser_specific_settings.gecko (MV3 service workers and :has() need
// Firefox 121+). Gecko ID defaults to FIREFOX_EXTENSION_ID env or a placeholder.
//
// Excludes scripts/, tests/, *.md, git data, and release archives.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(ROOT_DIR, 'manifest.json');
const RELEASE_DIR = path.join(ROOT_DIR, 'release');

// 1. Read extension metadata from manifest.json
if (!fs.existsSync(MANIFEST_PATH)) {
  console.error('Error: manifest.json not found in root directory.');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
const version = manifest.version || '1.0.0';
const slug = 'fb-layout-tweaks';

// 2. Parse --target flag (default: chrome, unchanged legacy behavior).
// Accepts both "--target firefox" and "--target=firefox" forms.
let target = 'chrome';
const flagIdx = process.argv.findIndex((a) => a === '--target' || a.startsWith('--target='));
if (flagIdx !== -1) {
  const flag = process.argv[flagIdx];
  target = flag.includes('=') ? flag.split('=')[1] : process.argv[flagIdx + 1];
}
if (!['chrome', 'firefox', 'all'].includes(target)) {
  console.error(`Error: unknown --target '${target}'. Use chrome|firefox|all.`);
  process.exit(1);
}

// 3. Entries to include in the package
const includeItems = ['manifest.json', 'icons', 'src', '_locales'];

// Validate that required items exist
for (const item of includeItems) {
  if (!fs.existsSync(path.join(ROOT_DIR, item))) {
    console.error(`Error: Required package item '${item}' does not exist.`);
    process.exit(1);
  }
}

// Ensure release directory exists
if (!fs.existsSync(RELEASE_DIR)) {
  fs.mkdirSync(RELEASE_DIR, { recursive: true });
}

function removeIfExists(p) {
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

// 4. Create ZIP archive using system utilities (cwd + relative items)
function createZip(cwd, items, outPath) {
  removeIfExists(outPath);
  // Try tar (supported on Windows 10/11 build 17063+ and modern macOS/Linux)
  try {
    execSync(`tar -a -cf "${outPath}" ${items.join(' ')}`, { cwd, stdio: 'pipe' });
    return true;
  } catch {
    // Fallback for Windows if tar is unavailable: use PowerShell Compress-Archive
    if (process.platform === 'win32') {
      try {
        const itemsList = items.map((i) => `'${i}'`).join(',');
        const psCmd = `powershell -NoProfile -Command "Compress-Archive -Path ${itemsList} -DestinationPath '${outPath}' -Force"`;
        execSync(psCmd, { cwd, stdio: 'pipe' });
        return true;
      } catch (psErr) {
        console.error('PowerShell fallback failed:', psErr.message);
        return false;
      }
    }
    // Fallback for Unix: use zip command
    try {
      execSync(`zip -r "${outPath}" ${items.join(' ')}`, { cwd, stdio: 'pipe' });
      return true;
    } catch (zipErr) {
      console.error('zip command fallback failed:', zipErr.message);
      return false;
    }
  }
}

function report(zipFilePath) {
  const stats = fs.statSync(zipFilePath);
  const sizeKb = (stats.size / 1024).toFixed(1);
  console.log(`✓ Package created successfully!`);
  console.log(`  File: release/${path.basename(zipFilePath)} (${sizeKb} KB)`);
  console.log(`  Included: ${includeItems.join(', ')}`);
  console.log(`  Excluded: scripts/, tests/, *.md, git data, etc.`);
}

// 5a. Chrome build (clean manifest, as-is)
function buildChrome() {
  console.log(`Packaging ${slug} v${version} for Chrome...`);
  const zipFilePath = path.join(RELEASE_DIR, `${slug}-v${version}.zip`);
  if (!createZip(ROOT_DIR, includeItems, zipFilePath) || !fs.existsSync(zipFilePath)) {
    console.error('Failed to create Chrome zip package.');
    process.exit(1);
  }
  report(zipFilePath);
}

// 5b. Firefox build (staged copy + gecko manifest patch)
function buildFirefox() {
  console.log(`Packaging ${slug} v${version} for Firefox...`);
  const stageDir = fs.mkdtempSync(path.join(os.tmpdir(), `${slug}-firefox-`));
  try {
    for (const item of includeItems) {
      fs.cpSync(path.join(ROOT_DIR, item), path.join(stageDir, item), { recursive: true });
    }
    const stagedManifestPath = path.join(stageDir, 'manifest.json');
    const staged = JSON.parse(fs.readFileSync(stagedManifestPath, 'utf8'));
    staged.browser_specific_settings = {
      gecko: {
        id: process.env.FIREFOX_EXTENSION_ID || 'fb-layout-tweaks@amppa.github.io',
        strict_min_version: '121.0',
      },
    };
    fs.writeFileSync(stagedManifestPath, `${JSON.stringify(staged, null, 2)}\n`);
    const zipFilePath = path.join(RELEASE_DIR, `${slug}-firefox-v${version}.zip`);
    if (!createZip(stageDir, includeItems, zipFilePath) || !fs.existsSync(zipFilePath)) {
      console.error('Failed to create Firefox zip package.');
      process.exit(1);
    }
    console.log(`  Gecko ID: ${staged.browser_specific_settings.gecko.id}`);
    report(zipFilePath);
  } finally {
    fs.rmSync(stageDir, { recursive: true, force: true });
  }
}

if (target === 'chrome' || target === 'all') buildChrome();
if (target === 'firefox' || target === 'all') buildFirefox();
