// scripts/package.js
// Packages the extension into clean release zips for Chrome and Firefox.
// Zero npm dependencies: uses built-in system tools (tar, PowerShell Compress-Archive, or zip).
//
// Usage:
//   node scripts/package.js [--target chrome|firefox|all]
//
// Outputs (version read from manifest.json):
//   chrome:  release/fb-layout-tweaks-chrome-v<version>.zip
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
// NOTE: `tar -a` only writes a real zip when tar is bsdtar/libarchive
// (Windows/macOS). GNU tar (Linux CI, git-bash) does not recognize the
// .zip suffix and silently writes a plain ustar tar with exit code 0,
// so tar must never be trusted blindly: every output is verified to
// start with the ZIP magic bytes ("PK") before being accepted.
function tarSupportsZip() {
  try {
    const out = execSync('tar --version', { stdio: 'pipe' }).toString();
    return /bsdtar|libarchive/i.test(out);
  } catch {
    return false;
  }
}

function isRealZip(p) {
  try {
    const fd = fs.openSync(p, 'r');
    const buf = Buffer.alloc(2);
    fs.readSync(fd, buf, 0, 2, 0);
    fs.closeSync(fd);
    return buf[0] === 0x50 && buf[1] === 0x4b; // "PK"
  } catch {
    return false;
  }
}

function tryStep(label, fn, outPath) {
  removeIfExists(outPath);
  try {
    fn();
  } catch (err) {
    console.error(`  (${label} unavailable: ${String(err.message).split('\n')[0]})`);
    return false;
  }
  if (fs.existsSync(outPath) && isRealZip(outPath)) return true;
  // GNU tar fallback artifact: a mislabeled ustar must not survive.
  removeIfExists(outPath);
  console.error(`  (${label} did not produce a valid zip, trying next method)`);
  return false;
}

function createZip(cwd, items, outPath) {
  // `zip` is the correct tool for the job and ships on ubuntu-latest CI.
  if (tryStep('zip', () => {
    execSync(`zip -r "${outPath}" ${items.join(' ')}`, { cwd, stdio: 'pipe' });
  }, outPath)) return true;
  // bsdtar (Windows 10/11 17063+, macOS) writes real zips via -a.
  if (tarSupportsZip() && tryStep('tar', () => {
    execSync(`tar -a -cf "${outPath}" ${items.join(' ')}`, { cwd, stdio: 'pipe' });
  }, outPath)) return true;
  // Last resort on Windows: PowerShell Compress-Archive.
  if (process.platform === 'win32' && tryStep('Compress-Archive', () => {
    const itemsList = items.map((i) => `'${i}'`).join(',');
    const psCmd = `powershell -NoProfile -Command "Compress-Archive -Path ${itemsList} -DestinationPath '${outPath}' -Force"`;
    execSync(psCmd, { cwd, stdio: 'pipe' });
  }, outPath)) return true;
  console.error(`Failed to create a valid zip package at ${outPath}.`);
  return false;
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
  const zipFilePath = path.join(RELEASE_DIR, `${slug}-chrome-v${version}.zip`);
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
        strict_min_version: '128.0',
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
