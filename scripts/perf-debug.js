// scripts/perf-debug.js
// High-fidelity performance debugging suite for FB Layout Tweaks Chrome Extension using Puppeteer.
//
// Usage:
//   node scripts/perf-debug.js [options]
//
// Options:
//   --url <url>              Target URL to profile (default: https://www.facebook.com/)
//   --user-data-dir <dir>    Chrome profile directory to preserve login (default: ~/.fb-layout-tweaks-profile)
//   --scroll                 Automate feed scrolling to benchmark dynamic mutations and scans
//   --duration <seconds>     Auto-exit after N seconds and print summary report (default: interactive)
//   --trace                  Record Chrome CDP Trace and save to release/perf-trace.json
//   --hud                    Inject in-page floating performance HUD on Facebook
//   --headless               Run in headless mode (default: false, headed for interactive login)
//   --help                   Show help message

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const DEFAULT_PROFILE_DIR = path.join(os.homedir(), '.fb-layout-tweaks-profile');

function createMockFbServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      const bookmarks = Array.from({ length: 40 }, (_, i) => `<li><a href="/bookmark/${i}"><span>Bookmark Item ${i}</span></a></li>`).join('');
      const cards = Array.from({ length: 25 }, (_, i) => `
        <div class="feed-card" role="article">
          <div dir="auto"><strong>User ${i}</strong></div>
          <div dir="auto"><span>This is feed post #${i} testing DOM mutation rates and content script scanner performance.</span></div>
          <div><span>${'Random span text content '.repeat(8)}</span></div>
        </div>
      `).join('');

      res.end(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Mock Facebook Performance Environment</title>
  <style>
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f0f2f5; }
    .layout { display: flex; justify-content: space-between; height: 100vh; }
    .left-rail { width: 360px; padding: 16px; background: #fff; overflow-y: auto; border-right: 1px solid #ddd; }
    .feed { flex: 1; max-width: 680px; margin: 0 auto; padding: 16px; }
    .feed-card { background: #fff; border-radius: 8px; padding: 16px; margin-bottom: 16px; box-shadow: 0 1px 2px rgba(0,0,0,0.1); }
    .right-rail { width: 360px; padding: 16px; background: #fff; overflow-y: auto; border-left: 1px solid #ddd; }
    .chat-bubble { position: fixed; bottom: 20px; right: 20px; width: 48px; height: 48px; border-radius: 50%; background: #0866ff; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 20px; cursor: pointer; }
  </style>
</head>
<body>
  <div class="layout">
    <div role="navigation" data-pagelet="LeftRail" class="left-rail">
      <h2>Left Navigation</h2>
      <ul>
        <li><a href="/friends/"><span>Friends</span></a></li>
        <li><a href="/saved/"><span>Saved</span></a></li>
        <li><a href="/groups/"><span>Groups</span></a></li>
        <li><a href="/marketplace/"><span>Marketplace</span></a></li>
        <li><a href="/adsmanager/"><span>Ads Manager</span></a></li>
        <li><div><span>廣告管理員</span></div></li>
        ${bookmarks}
      </ul>
    </div>

    <div role="main" data-pagelet="Feed" class="feed">
      <h1>News Feed</h1>
      <div id="posts-container">
        ${cards}
      </div>
    </div>

    <div role="complementary" data-pagelet="RightRail" id="right_rail_container" class="right-rail">
      <div class="sponsored-section">
        <h3>Sponsored</h3>
        <p>Sponsored Ad Content</p>
      </div>
      <div class="birthdays-section">
        <h3>Birthdays</h3>
        <a href="/events/birthdays/">Birthdays list</a>
      </div>
      <div class="contacts-section">
        <h3>Contacts</h3>
        <ul>
          <li><span>Friend Alpha</span></li>
          <li><span>Friend Beta</span></li>
          <li><span>Meta AI</span></li>
        </ul>
      </div>
    </div>
  </div>

  <div role="button" aria-label="Open chat with Friend Alpha" class="chat-bubble">💬</div>

  <script>
    let postIdx = 25;
    setInterval(() => {
      const container = document.getElementById('posts-container');
      if (!container) return;
      for (let j = 0; j < 3; j++) {
        postIdx++;
        const card = document.createElement('div');
        card.className = 'feed-card';
        card.setAttribute('role', 'article');
        card.innerHTML = '<div dir="auto"><strong>Dynamic Post #' + postIdx + '</strong></div>' +
          '<div dir="auto"><span>Continuous feed post mutation ' + postIdx + '</span></div>' +
          '<div>' + Array.from({length: 8}, (_, k) => '<span>Span item ' + k + '</span>').join(' ') + '</div>';
        container.appendChild(card);
      }
    }, 300);
  </script>
</body>
</html>`);
    });

    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve({ server, url: `http://127.0.0.1:${port}` });
    });
  });
}

// 1. Resolve Puppeteer (supports local node_modules and global npm installs)
function resolvePuppeteer() {
  try {
    return require('puppeteer');
  } catch (err) {
    const candidates = [
      path.join(process.env.APPDATA || '', 'npm', 'node_modules', 'puppeteer'),
      '/usr/local/lib/node_modules/puppeteer',
      '/usr/lib/node_modules/puppeteer',
      path.join(os.homedir(), 'AppData', 'Roaming', 'npm', 'node_modules', 'puppeteer')
    ];
    for (const cand of candidates) {
      if (fs.existsSync(cand)) {
        try {
          return require(cand);
        } catch (_) {}
      }
    }
    console.error('\x1b[31m[Error]\x1b[0m Puppeteer is not installed.');
    console.error('Please run: npm install -g puppeteer');
    process.exit(1);
  }
}

// 2. Parse CLI Arguments
const args = process.argv.slice(2);
function getArgValue(name, defaultValue) {
  const idx = args.findIndex(a => a === name || a.startsWith(name + '='));
  if (idx === -1) return defaultValue;
  const arg = args[idx];
  return arg.includes('=') ? arg.split('=')[1] : args[idx + 1] || defaultValue;
}

const hasFlag = (name) => args.includes(name);

if (hasFlag('--help') || hasFlag('-h')) {
  console.log(`
FB Layout Tweaks - Puppeteer Performance Debugger

Usage:
  node scripts/perf-debug.js [options]

Options:
  --url <url>            Target URL (default: https://www.facebook.com/)
  --mock                 Run with built-in mock Facebook DOM server (offline, repeatable benchmark)
  --user-data-dir <dir>  Chrome user data dir (default: ~/.fb-layout-tweaks-profile)
  --scroll               Simulate infinite scrolling on feed
  --duration <sec>       Run for N seconds, print report, and exit
  --trace                Save Chrome trace to release/perf-trace.json
  --hud                  Inject in-page performance HUD
  --headless             Run in headless mode (default: false)
  --help                 Show this help message
`);
  process.exit(0);
}

const isMock = hasFlag('--mock');
let targetUrl = getArgValue('--url', isMock ? '' : 'https://www.facebook.com/');
const userDataDir = path.resolve(getArgValue('--user-data-dir', DEFAULT_PROFILE_DIR));
const autoScroll = hasFlag('--scroll');
const durationSec = parseInt(getArgValue('--duration', '0'), 10);
const enableTrace = hasFlag('--trace');
const enableHud = hasFlag('--hud');
const isHeadless = hasFlag('--headless');

const puppeteer = resolvePuppeteer();

async function main() {
  console.log('\x1b[36m========================================================================\x1b[0m');
  console.log('\x1b[1m  FB Layout Tweaks - Puppeteer Performance Debugger\x1b[0m');
  console.log('\x1b[36m========================================================================\x1b[0m');
  console.log(`* Extension Path: \x1b[33m${ROOT_DIR}\x1b[0m`);
  console.log(`* User Profile:   \x1b[33m${userDataDir}\x1b[0m`);
  console.log(`* Target URL:     \x1b[33m${targetUrl}\x1b[0m`);
  console.log(`* Auto Scroll:    ${autoScroll ? '\x1b[32mEnabled\x1b[0m' : 'Disabled'}`);
  console.log(`* Trace Recording:${enableTrace ? '\x1b[32mEnabled (release/perf-trace.json)\x1b[0m' : 'Disabled'}`);
  console.log(`* In-Page HUD:    ${enableHud ? '\x1b[32mEnabled\x1b[0m' : 'Disabled'}`);
  console.log('------------------------------------------------------------------------');
  console.log('Starting Chrome with unpacked extension loaded...');

  let resolvedUserDataDir = userDataDir;
  try {
    if (!fs.existsSync(resolvedUserDataDir)) {
      fs.mkdirSync(resolvedUserDataDir, { recursive: true });
    }
  } catch (err) {
    // If homedir is restricted (e.g. sandbox or permission), fallback to local .perf-profile
    resolvedUserDataDir = path.join(ROOT_DIR, '.perf-profile');
    if (!fs.existsSync(resolvedUserDataDir)) {
      fs.mkdirSync(resolvedUserDataDir, { recursive: true });
    }
  }

  const browser = await puppeteer.launch({
    headless: isHeadless ? 'new' : false,
    userDataDir: resolvedUserDataDir,
    defaultViewport: null,
    args: [
      `--disable-extensions-except=${ROOT_DIR}`,
      `--load-extension=${ROOT_DIR}`,
      '--start-maximized',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled'
    ],
    ignoreDefaultArgs: ['--disable-extensions', '--enable-automation']
  });

  const pages = await browser.pages();
  const page = pages.length > 0 ? pages[0] : await browser.newPage();

  // 3. Inject Performance Telemetry Probe before any script runs
  await page.evaluateOnNewDocument((hudEnabled) => {
    window.__FB_LT_DEBUG__ = true;

    const setDebugDataset = () => {
      try {
        if (document.documentElement) {
          document.documentElement.dataset.fbLtDebug = 'true';
        }
      } catch (_) {}
    };

    setDebugDataset();
    if (typeof document !== 'undefined') {
      document.addEventListener('readystatechange', setDebugDataset);
      document.addEventListener('DOMContentLoaded', setDebugDataset);
    }

    window.__FB_LT_PERF__ = {
      startTime: Date.now(),
      scans: [],
      hovers: [],
      longTasks: [],
      mutationCount: 0,
      mutationsPerSec: 0,
      fpsHistory: [],
      currentFps: 60
    };

    // Listen to custom timing events from content.js
    document.addEventListener('__fb_lt_perf__', (e) => {
      if (!e.detail) return;
      const data = window.__FB_LT_PERF__;
      if (e.detail.type === 'scan') {
        data.scans.push(e.detail);
        if (data.scans.length > 300) data.scans.shift();
      } else if (e.detail.type === 'hover') {
        data.hovers.push(e.detail);
        if (data.hovers.length > 300) data.hovers.shift();
      }
    });

    // Monitor Long Tasks (> 50ms)
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          window.__FB_LT_PERF__.longTasks.push({
            duration: entry.duration,
            startTime: entry.startTime,
            name: entry.name
          });
        }
      });
      observer.observe({ entryTypes: ['longtask'] });
    } catch (_) {}

    // Monitor raw DOM Mutations rate
    try {
      let mutCounter = 0;
      const mutObserver = new MutationObserver((mutations) => {
        mutCounter += mutations.length;
        window.__FB_LT_PERF__.mutationCount += mutations.length;
      });
      mutObserver.observe(document.documentElement, { childList: true, subtree: true });

      setInterval(() => {
        window.__FB_LT_PERF__.mutationsPerSec = mutCounter;
        mutCounter = 0;
      }, 1000);
    } catch (_) {}

    // FPS Counter (rolling 1000ms window)
    let frames = 0;
    let lastTime = performance.now();
    function countFps(now) {
      frames++;
      if (now - lastTime >= 1000) {
        const fps = Math.round((frames * 1000) / (now - lastTime));
        window.__FB_LT_PERF__.currentFps = fps;
        window.__FB_LT_PERF__.fpsHistory.push(fps);
        if (window.__FB_LT_PERF__.fpsHistory.length > 60) window.__FB_LT_PERF__.fpsHistory.shift();
        frames = 0;
        lastTime = now;
      }
      requestAnimationFrame(countFps);
    }
    requestAnimationFrame(countFps);

    // Optional In-Page Floating HUD
    if (hudEnabled) {
      window.addEventListener('DOMContentLoaded', () => {
        const hud = document.createElement('div');
        hud.id = 'fb-lt-perf-hud';
        Object.assign(hud.style, {
          position: 'fixed',
          bottom: '16px',
          left: '16px',
          zIndex: '9999999',
          background: 'rgba(15, 23, 42, 0.88)',
          color: '#f8fafc',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '8px',
          padding: '10px 14px',
          fontFamily: 'Consolas, monospace',
          fontSize: '12px',
          lineHeight: '1.4',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          pointerEvents: 'none',
          userSelect: 'none'
        });
        document.body.appendChild(hud);

        setInterval(() => {
          const perf = window.__FB_LT_PERF__;
          const lastScan = perf.scans[perf.scans.length - 1];
          const fpsColor = perf.currentFps >= 50 ? '#4ade80' : perf.currentFps >= 30 ? '#facc15' : '#f87171';
          hud.innerHTML = `
            <div style="font-weight:bold;margin-bottom:4px;color:#38bdf8;">FB Layout Tweaks Profiler</div>
            <div>FPS: <span style="color:\${fpsColor};font-weight:bold;">\${perf.currentFps}</span> | Long Tasks: \${perf.longTasks.length}</div>
            <div>Mutations: \${perf.mutationsPerSec}/s</div>
            <div>Last Scan: \${lastScan ? lastScan.totalMs.toFixed(2) + 'ms' : 'none'}</div>
            <div>Spans Scanned: \${lastScan ? lastScan.leftRailSpans : 0}</div>
            <div>Chat Rect Reads: \${lastScan ? lastScan.dockRectCalls : 0}</div>
          `;
        }, 500);
      });
    }
  }, enableHud);

  // 4. Start CDP Session for tracing & low-level metrics
  const cdp = await page.createCDPSession();
  await cdp.send('Performance.enable');

  if (enableTrace) {
    const traceDir = path.join(ROOT_DIR, 'release');
    if (!fs.existsSync(traceDir)) fs.mkdirSync(traceDir, { recursive: true });
    await cdp.send('Tracing.start', {
      categories: ['devtools.timeline', 'v8', 'blink.user_timing'],
      options: 'sampling-frequency=10000'
    });
  }

  let mockServerInstance = null;
  if (isMock) {
    const mock = await createMockFbServer();
    mockServerInstance = mock.server;
    targetUrl = mock.url;
    console.log(`* Mock FB Server: \x1b[32m${targetUrl}\x1b[0m`);
  }

  console.log(`Navigating to ${targetUrl}...`);
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(err => {
    console.warn('Navigation warning:', err.message);
  });

  const currentNavUrl = page.url();
  if (!currentNavUrl.includes('facebook.com')) {
    // Non-facebook page: mock chrome.storage.local and inject extension scripts
    await page.evaluate(() => {
      window.chrome = window.chrome || {};
      window.chrome.storage = window.chrome.storage || {
        local: {
          get: (keys, cb) => cb({ settings: window.DEFAULT_SETTINGS || {} }),
          onChanged: { addListener: () => {} }
        }
      };
    });

    const defaultsJs = fs.readFileSync(path.join(ROOT_DIR, 'src', 'shared', 'defaults.js'), 'utf8');
    const contentCss = fs.readFileSync(path.join(ROOT_DIR, 'src', 'content', 'content.css'), 'utf8');
    const contentJs = fs.readFileSync(path.join(ROOT_DIR, 'src', 'content', 'content.js'), 'utf8');
    await page.addStyleTag({ content: contentCss });
    await page.addScriptTag({ content: defaultsJs });
    await page.addScriptTag({ content: contentJs });
  }

  console.log('\x1b[32mPage loaded.\x1b[0m Profiling is active. Interact with Facebook or scroll the feed.');
  console.log('Press \x1b[1mCtrl+C\x1b[0m at any time to finish and print the diagnostic summary.\n');

  // 5. Automated Scrolling Loop (if --scroll is set)
  let scrollInterval = null;
  if (autoScroll) {
    scrollInterval = setInterval(async () => {
      try {
        await page.evaluate(() => {
          window.scrollBy({ top: 600, behavior: 'smooth' });
        });
      } catch (_) {}
    }, 1200);
  }

  // 6. Live Dashboard Printer Loop
  const startTime = Date.now();
  let latestSummary = null;
  const dashboardInterval = setInterval(async () => {
    try {
      const summary = await page.evaluate(() => {
        const perf = window.__FB_LT_PERF__;
        if (!perf) return null;
        const scans = perf.scans || [];
        const hovers = perf.hovers || [];

        const avg = (arr, fn) => arr.length ? arr.reduce((acc, x) => acc + fn(x), 0) / arr.length : 0;
        const max = (arr, fn) => arr.length ? Math.max(...arr.map(fn)) : 0;
        const percentile = (arr, fn, p) => {
          if (!arr.length) return 0;
          const sorted = arr.map(fn).sort((a, b) => a - b);
          const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
          return sorted[idx];
        };

        return {
          currentFps: perf.currentFps,
          mutationsPerSec: perf.mutationsPerSec,
          totalMutations: perf.mutationCount,
          longTasksCount: perf.longTasks.length,
          longTasksTotalMs: perf.longTasks.reduce((acc, t) => acc + t.duration, 0),
          longTaskMaxMs: max(perf.longTasks, t => t.duration),
          scansCount: scans.length,
          scanLastMs: scans.length ? scans[scans.length - 1].totalMs : 0,
          scanAvgMs: avg(scans, s => s.totalMs),
          scanP50Ms: percentile(scans, s => s.totalMs, 50),
          scanP95Ms: percentile(scans, s => s.totalMs, 95),
          scanMaxMs: max(scans, s => s.totalMs),
          tagRailAvgMs: avg(scans, s => s.tagRailMs),
          tagRailMaxMs: max(scans, s => s.tagRailMs),
          leftRailAvgMs: avg(scans, s => s.leftRailMs),
          leftRailMaxMs: max(scans, s => s.leftRailMs),
          leftRailAvgSpans: avg(scans, s => s.leftRailSpans),
          rightRailAvgMs: avg(scans, s => s.rightRailMs),
          rightRailMaxMs: max(scans, s => s.rightRailMs),
          dockAvgMs: avg(scans, s => s.dockMs),
          dockMaxMs: max(scans, s => s.dockMs),
          dockAvgRectCalls: avg(scans, s => s.dockRectCalls),
          dockMaxRectCalls: max(scans, s => s.dockRectCalls),
          hoverCount: hovers.length,
          hoverAvgMs: avg(hovers, h => h.durationMs),
          hoverMaxMs: max(hovers, h => h.durationMs)
        };
      });

      const cdpMetrics = await cdp.send('Performance.getMetrics').catch(() => ({ metrics: [] }));
      const getCdpMetric = (name) => {
        const m = cdpMetrics.metrics.find(x => x.name === name);
        return m ? m.value : 0;
      };

      const jsHeapMB = (getCdpMetric('JSHeapUsedSize') / (1024 * 1024)).toFixed(1);
      const totalHeapMB = (getCdpMetric('JSHeapTotalSize') / (1024 * 1024)).toFixed(1);
      const domNodes = getCdpMetric('Nodes');

      if (!summary) return;

      const elapsedSec = Math.round((Date.now() - startTime) / 1000);
      latestSummary = {
        ...summary,
        jsHeapMB,
        totalHeapMB,
        domNodes,
        elapsedSec,
        durationSec: elapsedSec,
        totalScans: summary.scansCount,
        avgFps: summary.currentFps,
        totalMutations: summary.totalMutations,
        totalLongTasks: summary.longTasksCount
      };

      const fpsColor = summary.currentFps >= 50 ? '\x1b[32m' : summary.currentFps >= 30 ? '\x1b[33m' : '\x1b[31m';

      console.clear();
      console.log('\x1b[36m========================================================================\x1b[0m');
      console.log(`\x1b[1m FB Layout Tweaks - Live Performance Monitor\x1b[0m  (Elapsed: \x1b[33m${elapsedSec}s\x1b[0m)`);
      console.log('\x1b[36m========================================================================\x1b[0m');
      console.log(` FPS: ${fpsColor}${summary.currentFps} FPS\x1b[0m | Long Tasks (>50ms): \x1b[33m${summary.longTasksCount}\x1b[0m (Max: ${summary.longTaskMaxMs.toFixed(1)}ms, Total: ${summary.longTasksTotalMs.toFixed(1)}ms)`);
      console.log(` JS Heap: \x1b[35m${jsHeapMB} MB\x1b[0m / ${totalHeapMB} MB | DOM Nodes: \x1b[35m${domNodes}\x1b[0m | Mutation Rate: \x1b[33m${summary.mutationsPerSec}/s\x1b[0m`);
      console.log('------------------------------------------------------------------------');
      console.log('\x1b[1mContent Script Scan Performance (triggerThrottledScan):\x1b[0m');
      console.log(` Total Scans: \x1b[32m${summary.scansCount}\x1b[0m | Last: \x1b[33m${summary.scanLastMs.toFixed(2)}ms\x1b[0m | Avg: \x1b[33m${summary.scanAvgMs.toFixed(2)}ms\x1b[0m | Max: \x1b[31m${summary.scanMaxMs.toFixed(2)}ms\x1b[0m`);
      console.log('');
      console.log(' Sub-Task Timing Breakdown (Avg / Max):');
      console.log(`   - tagRailContainers:        ${summary.tagRailAvgMs.toFixed(2).padStart(5)}ms / ${summary.tagRailMaxMs.toFixed(2).padStart(5)}ms`);
      console.log(`   - scanLeftRailDynamic:      ${summary.leftRailAvgMs.toFixed(2).padStart(5)}ms / ${summary.leftRailMaxMs.toFixed(2).padStart(5)}ms  \x1b[90m(Avg spans: ${Math.round(summary.leftRailAvgSpans)})\x1b[0m`);
      console.log(`   - scanRightRailDynamic:     ${summary.rightRailAvgMs.toFixed(2).padStart(5)}ms / ${summary.rightRailMaxMs.toFixed(2).padStart(5)}ms`);
      console.log(`   - updateChatDockState:      ${summary.dockAvgMs.toFixed(2).padStart(5)}ms / ${summary.dockMaxMs.toFixed(2).padStart(5)}ms  \x1b[90m(Rect calls: ${summary.dockAvgRectCalls.toFixed(1)})\x1b[0m`);
      console.log(`   - Hover Handlers:           ${summary.hoverAvgMs.toFixed(2).padStart(5)}ms / ${summary.hoverMaxMs.toFixed(2).padStart(5)}ms  \x1b[90m(Events: ${summary.hoverCount})\x1b[0m`);
      console.log('------------------------------------------------------------------------');
      console.log('\x1b[1mReal-Time Performance Warnings & Bottlenecks:\x1b[0m');

      let warnings = 0;
      if (summary.leftRailAvgSpans > 500) {
        warnings++;
        console.log(` \x1b[33m[BOTTLENECK]\x1b[0m \x1b[1mquerySelectorAll('span')\x1b[0m scans \x1b[31m${Math.round(summary.leftRailAvgSpans)}\x1b[0m spans across the full document.`);
        console.log('              Recommendation: Scope scan to left rail container instead of document-wide search.');
      }
      if (summary.dockAvgRectCalls > 5) {
        warnings++;
        console.log(` \x1b[33m[LAYOUT THRASHING]\x1b[0m updateChatDockState calls \x1b[31m${summary.dockAvgRectCalls.toFixed(0)}\x1b[0m getBoundingClientRect per scan.`);
      }
      if (summary.mutationsPerSec > 100) {
        warnings++;
        console.log(` \x1b[33m[MUTATION STORM]\x1b[0m High DOM mutation rate: \x1b[31m${summary.mutationsPerSec} mutations/sec\x1b[0m.`);
      }
      if (warnings === 0) {
        console.log(' \x1b[32m✔ No critical bottlenecks detected under current load.\x1b[0m');
      }
      console.log('\x1b[36m========================================================================\x1b[0m');
      console.log('Press \x1b[1mCtrl+C\x1b[0m to finish session and save report.');
    } catch (_) {}
  }, 2000);

  // 7. Cleanup & Final Report Generator
  let isClosing = false;
  async function finalizeSession() {
    if (isClosing) return;
    isClosing = true;

    clearInterval(dashboardInterval);
    if (scrollInterval) clearInterval(scrollInterval);

    console.log('\n\x1b[36m[Finalizing Session] Collecting final performance diagnostics...\x1b[0m');

    let traceFile = null;
    if (enableTrace) {
      try {
        const traceChunks = [];
        cdp.on('Tracing.dataCollected', (data) => traceChunks.push(...data.value));
        const tracingComplete = new Promise((resolve) => cdp.once('Tracing.tracingComplete', resolve));
        await cdp.send('Tracing.end');
        await tracingComplete;
        traceFile = path.join(ROOT_DIR, 'release', 'perf-trace.json');
        if (!fs.existsSync(path.dirname(traceFile))) fs.mkdirSync(path.dirname(traceFile), { recursive: true });
        fs.writeFileSync(traceFile, JSON.stringify(traceChunks));
        console.log(`\x1b[32m✔ Chrome Trace saved to:\x1b[0m ${traceFile}`);
      } catch (e) {
        console.warn('Trace save error:', e.message);
      }
    }

    let finalReport = null;
    try {
      finalReport = await page.evaluate(() => {
        const perf = window.__FB_LT_PERF__;
        if (!perf) return null;
        const scans = perf.scans || [];
        const hovers = perf.hovers || [];

        const avg = (arr, fn) => arr.length ? arr.reduce((acc, x) => acc + fn(x), 0) / arr.length : 0;
        const max = (arr, fn) => arr.length ? Math.max(...arr.map(fn)) : 0;
        const percentile = (arr, fn, p) => {
          if (!arr.length) return 0;
          const sorted = arr.map(fn).sort((a, b) => a - b);
          const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
          return sorted[idx];
        };

        return {
          durationSec: Math.round((Date.now() - perf.startTime) / 1000),
          totalScans: scans.length,
          scanAvgMs: avg(scans, s => s.totalMs),
          scanP50Ms: percentile(scans, s => s.totalMs, 50),
          scanP95Ms: percentile(scans, s => s.totalMs, 95),
          scanMaxMs: max(scans, s => s.totalMs),
          tagRailAvgMs: avg(scans, s => s.tagRailMs),
          tagRailMaxMs: max(scans, s => s.tagRailMs),
          leftRailAvgMs: avg(scans, s => s.leftRailMs),
          leftRailMaxMs: max(scans, s => s.leftRailMs),
          leftRailAvgSpans: avg(scans, s => s.leftRailSpans),
          rightRailAvgMs: avg(scans, s => s.rightRailMs),
          rightRailMaxMs: max(scans, s => s.rightRailMs),
          dockAvgMs: avg(scans, s => s.dockMs),
          dockMaxMs: max(scans, s => s.dockMs),
          totalMutations: perf.mutationCount,
          totalLongTasks: perf.longTasks.length,
          longTasksTotalMs: perf.longTasks.reduce((acc, t) => acc + t.duration, 0),
          avgFps: avg(perf.fpsHistory, x => x)
        };
      });
    } catch (_) {
      // If page was closed/detached, fallback to the latest cached summary
      if (latestSummary) {
        finalReport = latestSummary;
      }
    }

    if (!finalReport && latestSummary) {
      finalReport = latestSummary;
    }

    if (finalReport) {
      const releaseDir = path.join(ROOT_DIR, 'release');
      if (!fs.existsSync(releaseDir)) fs.mkdirSync(releaseDir, { recursive: true });

      // Save JSON report
      const jsonReportPath = path.join(releaseDir, 'perf-summary.json');
      fs.writeFileSync(jsonReportPath, JSON.stringify(finalReport, null, 2), 'utf8');

      // Save Markdown report
      const mdReportPath = path.join(releaseDir, 'perf-summary.md');
      const mdContent = `# FB Layout Tweaks — Performance Summary Report

- **Date**: ${new Date().toISOString()}
- **Duration**: ${finalReport.durationSec || 0} seconds
- **Framerate**: ${(finalReport.avgFps || 60).toFixed(1)} FPS
- **Total DOM Mutations**: ${finalReport.totalMutations || 0}
- **Long Tasks (>50ms)**: ${finalReport.totalLongTasks || 0} (Total Blocking Time: ${(finalReport.longTasksTotalMs || 0).toFixed(1)}ms)

---

## Content Script Scan Latency (\`triggerThrottledScan\`)
- **Total Scans Executed**: ${finalReport.totalScans || 0}
- **Scan Duration (Avg)**: ${(finalReport.scanAvgMs || 0).toFixed(2)} ms
- **Scan Duration (P50)**: ${(finalReport.scanP50Ms || 0).toFixed(2)} ms
- **Scan Duration (P95)**: ${(finalReport.scanP95Ms || 0).toFixed(2)} ms
- **Scan Duration (Max)**: ${(finalReport.scanMaxMs || 0).toFixed(2)} ms

### Sub-Task Latency Breakdown (Avg / Max)
| Sub-Task | Avg (ms) | Max (ms) | Notes |
| :--- | :--- | :--- | :--- |
| \`tagRailContainers\` | ${(finalReport.tagRailAvgMs || 0).toFixed(2)} | ${(finalReport.tagRailMaxMs || 0).toFixed(2)} | Container classification |
| \`scanLeftRailDynamic\` | ${(finalReport.leftRailAvgMs || 0).toFixed(2)} | ${(finalReport.leftRailMaxMs || 0).toFixed(2)} | Avg spans: ${Math.round(finalReport.leftRailAvgSpans || 0)} |
| \`scanRightRailDynamic\`| ${(finalReport.rightRailAvgMs || 0).toFixed(2)} | ${(finalReport.rightRailMaxMs || 0).toFixed(2)} | Sponsored / Birthdays |
| \`updateChatDockState\` | ${(finalReport.dockAvgMs || 0).toFixed(2)} | ${(finalReport.dockMaxMs || 0).toFixed(2)} | Chat bubbles docking |

---

## Performance Insights & Actionable Suggestions
${(finalReport.leftRailAvgSpans || 0) > 500 ? `- ⚠️ **querySelectorAll('span') Over-Scanning**: Scans ${Math.round(finalReport.leftRailAvgSpans)} spans across the entire document. Scope this query to the Left Rail container to avoid O(N) page-wide traversals.\n` : ''}
${(finalReport.dockAvgMs || 0) > 5 ? `- ⚠️ **Layout Thrashing in updateChatDockState**: Layout reads take ${(finalReport.dockAvgMs || 0).toFixed(2)}ms. Avoid reading getBoundingClientRect immediately after DOM writes.\n` : ''}
- ✔ Session captured cleanly.
`;
      fs.writeFileSync(mdReportPath, mdContent, 'utf8');

      console.log('\n\x1b[32m========================================================================\x1b[0m');
      console.log('\x1b[1m                 EXECUTIVE PERFORMANCE SUMMARY REPORT                   \x1b[0m');
      console.log('\x1b[32m========================================================================\x1b[0m');
      console.log(`  Profiling Duration:     \x1b[1m${finalReport.durationSec || 0} seconds\x1b[0m`);
      console.log(`  Average Framerate:      \x1b[1m${(finalReport.avgFps || 60).toFixed(1)} FPS\x1b[0m`);
      console.log(`  Total DOM Mutations:    \x1b[1m${finalReport.totalMutations || 0}\x1b[0m`);
      console.log(`  Long Tasks (>50ms):     \x1b[1m${finalReport.totalLongTasks || 0}\x1b[0m (Total Blocking Time: ${(finalReport.longTasksTotalMs || 0).toFixed(1)}ms)`);
      console.log('------------------------------------------------------------------------');
      console.log('\x1b[1m  Content Script Scan Latency Breakdown:\x1b[0m');
      console.log(`    Total Scans Executed: \x1b[33m${finalReport.totalScans || 0}\x1b[0m`);
      console.log(`    Scan Duration (Avg):  \x1b[33m${(finalReport.scanAvgMs || 0).toFixed(2)} ms\x1b[0m`);
      console.log(`    Scan Duration (P50):  \x1b[33m${(finalReport.scanP50Ms || 0).toFixed(2)} ms\x1b[0m`);
      console.log(`    Scan Duration (P95):  \x1b[33m${(finalReport.scanP95Ms || 0).toFixed(2)} ms\x1b[0m`);
      console.log(`    Scan Duration (Max):  \x1b[31m${(finalReport.scanMaxMs || 0).toFixed(2)} ms\x1b[0m`);
      console.log('------------------------------------------------------------------------');
      console.log('\x1b[1m  Component Latencies (Avg / Max):\x1b[0m');
      console.log(`    - tagRailContainers:      ${(finalReport.tagRailAvgMs || 0).toFixed(2)}ms / ${(finalReport.tagRailMaxMs || 0).toFixed(2)}ms`);
      console.log(`    - scanLeftRailDynamic:    ${(finalReport.leftRailAvgMs || 0).toFixed(2)}ms / ${(finalReport.leftRailMaxMs || 0).toFixed(2)}ms  (Spans/scan: ${Math.round(finalReport.leftRailAvgSpans || 0)})`);
      console.log(`    - scanRightRailDynamic:   ${(finalReport.rightRailAvgMs || 0).toFixed(2)}ms / ${(finalReport.rightRailMaxMs || 0).toFixed(2)}ms`);
      console.log(`    - updateChatDockState:    ${(finalReport.dockAvgMs || 0).toFixed(2)}ms / ${(finalReport.dockMaxMs || 0).toFixed(2)}ms`);
      console.log('------------------------------------------------------------------------');
      console.log(`  \x1b[32m✔ Markdown Report saved to:\x1b[0m ${mdReportPath}`);
      console.log(`  \x1b[32m✔ JSON Data saved to:     \x1b[0m ${jsonReportPath}`);
      console.log('========================================================================\n');
    }

    if (mockServerInstance) {
      mockServerInstance.close();
    }

    await browser.close().catch(() => {});
    process.exit(0);
  }

  process.on('SIGINT', finalizeSession);
  process.on('SIGTERM', finalizeSession);

  if (durationSec > 0) {
    setTimeout(finalizeSession, durationSec * 1000);
  }

  browser.on('disconnected', () => {
    if (!isClosing) finalizeSession();
  });
}

main().catch(err => {
  console.error('\x1b[31m[Fatal Error]\x1b[0m', err);
  process.exit(1);
});
