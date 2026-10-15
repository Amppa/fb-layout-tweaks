// scripts/inspect-media.js
// Automated DOM Inspector & Live Verifier for Facebook Feed Media Height
// Discovers media containers (Image, Album, Video, Text Card), analyzes outer height wrappers,
// tests height-halving CSS/JS rules, and validates rendered bounding boxes + screenshots.

const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const DEFAULT_PROFILE_DIR = path.join(os.homedir(), '.fb-layout-tweaks-profile');
const SCREENSHOT_DIR = path.join(ROOT_DIR, 'release', 'media-debug');

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
    process.exit(1);
  }
}

const http = require('http');

const isVerifyExtension = process.argv.includes('--verify-extension');
const isMock = process.argv.includes('--mock') || isVerifyExtension;
const isHeadless = process.argv.includes('--headless') || isVerifyExtension;
const durationIdx = process.argv.indexOf('--duration');
const durationSec = durationIdx !== -1 ? parseInt(process.argv[durationIdx + 1], 10) : 0;

function createMockMediaServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Mock Facebook Media Height Test</title>
  <style>
    body { margin: 0; background: #f0f2f5; font-family: sans-serif; }
    .feed { max-width: 680px; margin: 20px auto; }
    .post-card { background: #fff; border-radius: 8px; margin-bottom: 24px; box-shadow: 0 1px 2px rgba(0,0,0,0.2); overflow: visible; }
    .post-header { padding: 12px 16px; font-weight: bold; border-bottom: 1px solid #eee; }
    .post-footer { padding: 12px 16px; color: #65676b; border-top: 1px solid #eee; }
  </style>
</head>
<body>
  <div class="feed" role="feed">
    <!-- 1. Single Image Post (aspect ratio padding-top wrapper) -->
    <div role="article" class="post-card" id="post-single-image">
      <div class="post-header" dir="auto">Post 1: Single Image with 133% Padding Aspect Box</div>
      <div style="position: relative; width: 100%;">
        <div class="fb-aspect-wrapper" style="padding-top: 133.333%; position: relative; width: 100%; box-sizing: border-box;">
          <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;">
            <img src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='680' height='906'><rect width='100%' height='100%' fill='%233b82f6'/><text x='50%' y='50%' fill='%23fff' font-size='32' text-anchor='middle'>Native 680x906 Photo</text></svg>"
                 style="width: 100%; height: 100%; object-fit: cover;" width="680" height="906" />
          </div>
        </div>
      </div>
      <div class="post-footer" dir="auto">128 Likes · 32 Comments</div>
    </div>

    <!-- 2. Album / Collage Post -->
    <div role="article" class="post-card" id="post-album">
      <div class="post-header" dir="auto">Post 2: 3-Photo Album Collage</div>
      <div class="x1s85apg" style="position: relative; width: 100%; height: 500px; box-sizing: border-box;">
        <div style="position: absolute; left: 0; top: 0; width: 50%; height: 100%;">
          <img src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='340' height='500'><rect width='100%' height='100%' fill='%2310b981'/><text x='50%' y='50%' fill='%23fff' font-size='24' text-anchor='middle'>Photo 1</text></svg>"
               style="width: 100%; height: 100%; object-fit: cover;" width="340" height="500" />
        </div>
        <div style="position: absolute; left: 50%; top: 0; width: 50%; height: 50%;">
          <img src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='340' height='250'><rect width='100%' height='100%' fill='%23f59e0b'/><text x='50%' y='50%' fill='%23fff' font-size='20' text-anchor='middle'>Photo 2</text></svg>"
               style="width: 100%; height: 100%; object-fit: cover;" width="340" height="250" />
        </div>
        <div style="position: absolute; left: 50%; top: 50%; width: 50%; height: 50%;">
          <img src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='340' height='250'><rect width='100%' height='100%' fill='%23ef4444'/><text x='50%' y='50%' fill='%23fff' font-size='20' text-anchor='middle'>Photo 3</text></svg>"
               style="width: 100%; height: 100%; object-fit: cover;" width="340" height="250" />
        </div>
      </div>
      <div class="post-footer" dir="auto">84 Likes · 15 Comments</div>
    </div>

    <!-- 3. Video Post -->
    <div role="article" class="post-card" id="post-video">
      <div class="post-header" dir="auto">Post 3: Video Reel Post</div>
      <div class="video-container" style="position: relative; width: 100%; height: 560px; background: #000; box-sizing: border-box;">
        <video style="width: 100%; height: 100%; object-fit: contain;"></video>
      </div>
      <div class="post-footer" dir="auto">2.1K Views · 45 Comments</div>
    </div>

    <!-- 4. Background Text Card Post -->
    <div role="article" class="post-card" id="post-text-card">
      <div class="post-header" dir="auto">Post 4: Background Color Text Card</div>
      <div class="card-bg" style="background-image: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 380px; display: flex; align-items: center; justify-content: center; padding: 32px; color: #fff; text-align: center; box-sizing: border-box;">
        <h2 style="margin: 0; font-size: 28px;">This is a big colorful Facebook text card!</h2>
      </div>
      <div class="post-footer" dir="auto">95 Likes · 12 Comments</div>
    </div>
  </div>
</body>
</html>`);
    });

    server.listen(0, '127.0.0.1', () => {
      resolve({ server, url: `http://127.0.0.1:${server.address().port}` });
    });
  });
}

const puppeteer = resolvePuppeteer();

async function main() {
  console.log('\x1b[36m========================================================================\x1b[0m');
  console.log('\x1b[1m  FB Layout Tweaks - Media Height Inspector & Live Verifier\x1b[0m');
  console.log('\x1b[36m========================================================================\x1b[0m');

  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  let mockServer = null;
  let targetUrl = 'https://www.facebook.com/';
  if (isMock) {
    const mock = await createMockMediaServer();
    mockServer = mock.server;
    targetUrl = mock.url;
    console.log(`* Running in \x1b[32mMock Mode\x1b[0m on: ${targetUrl}`);
  }

  let resolvedUserDataDir = DEFAULT_PROFILE_DIR;
  if (isMock || isVerifyExtension) {
    resolvedUserDataDir = path.join(os.tmpdir(), `fb-lt-mock-${Date.now()}`);
  }
  try {
    if (!fs.existsSync(resolvedUserDataDir)) fs.mkdirSync(resolvedUserDataDir, { recursive: true });
  } catch (_) {
    resolvedUserDataDir = path.join(ROOT_DIR, '.perf-profile');
    if (!fs.existsSync(resolvedUserDataDir)) fs.mkdirSync(resolvedUserDataDir, { recursive: true });
  }

  console.log('* Launching Chrome with profile:', resolvedUserDataDir);
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

  console.log(`* Navigating to ${targetUrl}...`);
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});

  if (isVerifyExtension) {
    console.log('\n\x1b[36m=== Testing Extension Real-Time Media Scaling ===\x1b[0m');
    // 1. Inject styles and content script
    await page.addStyleTag({ path: path.join(ROOT_DIR, 'src', 'content', 'content.css') });
    await page.evaluate(() => {
      window.__MOCK_SETTINGS__ = { enabled: true, trimMainFeed: true, feedMediaHeight: 'default' };
      window.chrome = {
        storage: {
          local: {
            get: (key, cb) => cb({ settings: window.__MOCK_SETTINGS__ }),
            set: () => {}
          },
          onChanged: {
            addListener: (fn) => { window.__STORAGE_CHANGE_LISTENER__ = fn; }
          }
        }
      };
    });
    await page.addScriptTag({ path: path.join(ROOT_DIR, 'src', 'shared', 'defaults.js') });
    await page.addScriptTag({ path: path.join(ROOT_DIR, 'src', 'content', 'content.js') });

    const getHeights = async () => page.evaluate(() => {
      const posts = ['post-single-image', 'post-album', 'post-text-card'];
      const videoEl = document.getElementById('post-video');
      const results = posts.map(id => {
        const el = document.getElementById(id);
        const img = el ? el.querySelector('img') : null;
        return {
          id,
          height: el ? Math.round(el.getBoundingClientRect().height) : 0,
          imgWidth: img ? Math.round(img.getBoundingClientRect().width) : 0,
          imgHeight: img ? Math.round(img.getBoundingClientRect().height) : 0
        };
      });
      return {
        posts: results,
        videoHeight: videoEl ? Math.round(videoEl.getBoundingClientRect().height) : 0
      };
    });

    const triggerSettingsChange = async (newSettings) => page.evaluate((s) => {
      if (window.__STORAGE_CHANGE_LISTENER__) {
        window.__STORAGE_CHANGE_LISTENER__({ settings: { newValue: s } }, 'local');
      }
    }, newSettings);

    // Initial 100%
    const h100 = await getHeights();
    console.log('\n1. State: 100% (Default Original)');
    h100.posts.forEach(p => console.log(`   ${p.id}: ${p.height}px (img: ${p.imgWidth}x${p.imgHeight})`));
    console.log(`   post-video: ${h100.videoHeight}px (should stay untouched)`);

    // Test modes sequentially
    const modesToTest = [
      { mode: 'h75', label: '75% Height' },
      { mode: 'h50', label: '50% Height' },
      { mode: 'h25', label: '25% Height' },
      { mode: 'px400', label: 'Fixed 400px' },
      { mode: 'px300', label: 'Fixed 300px' },
      { mode: 'px200', label: 'Fixed 200px' }
    ];

    let allReductionsPassed = true;
    let videoRemainedUntouched = true;

    for (const test of modesToTest) {
      await triggerSettingsChange({ enabled: true, trimMainFeed: true, feedMediaHeight: test.mode });
      await new Promise(r => setTimeout(r, 150));
      const res = await getHeights();
      console.log(`\nState: ${test.label} (${test.mode})`);
      res.posts.forEach((p, i) => {
        const diff = h100.posts[i].height - p.height;
        const pct = Math.round((diff / h100.posts[i].height) * 100);
        console.log(`   ${p.id}: ${p.height}px (reduced by ${diff}px / -${pct}%) [img: ${p.imgWidth}x${p.imgHeight}]`);
        if (p.height >= h100.posts[i].height) {
          allReductionsPassed = false;
        }
      });
      if (res.videoHeight !== h100.videoHeight) {
        videoRemainedUntouched = false;
        console.log(`   ❌ Video height changed from ${h100.videoHeight}px to ${res.videoHeight}px!`);
      } else {
        console.log(`   ✔ Video height untouched: ${res.videoHeight}px`);
      }
    }

    // Restore to 100%
    await triggerSettingsChange({ enabled: true, trimMainFeed: true, feedMediaHeight: 'default' });
    await new Promise(r => setTimeout(r, 150));
    const hRestored = await getHeights();
    console.log('\nState: Restored to Default (100%)');
    let allRestored = true;
    hRestored.posts.forEach((p, i) => {
      const diff = Math.abs(p.height - h100.posts[i].height);
      const ok = diff <= 2;
      if (!ok) allRestored = false;
      console.log(`   ${p.id}: ${p.height}px (restored match: ${ok ? 'YES ✔' : 'NO ❌'})`);
    });

    console.log('\n\x1b[36m=== Final Verification Result ===\x1b[0m');
    console.log(`  All Mode Reductions (75%, 50%, 25%, px400, px300, px200): ${allReductionsPassed ? '\x1b[32mPASS ✔\x1b[0m' : '\x1b[31mFAIL ❌\x1b[0m'}`);
    console.log(`  Video Untouched (Isolated for future commit):             ${videoRemainedUntouched ? '\x1b[32mPASS ✔\x1b[0m' : '\x1b[31mFAIL ❌\x1b[0m'}`);
    console.log(`  100% Default Revert Fidelity:                              ${allRestored ? '\x1b[32mPASS ✔\x1b[0m' : '\x1b[31mFAIL ❌\x1b[0m'}`);

    if (mockServer) mockServer.close();
    await browser.close().catch(() => {});
    process.exit((allReductionsPassed && videoRemainedUntouched && allRestored) ? 0 : 1);
  }

  console.log('\x1b[32mPage loaded.\x1b[0m Waiting for feed posts (scroll if needed)...');
  console.log('Will automatically inspect media posts every 4 seconds.');
  console.log('Press \x1b[1mCtrl+C\x1b[0m in terminal to finish.\n');

  // Inject in-page analyzer function
  await page.exposeFunction('logInspectionResult', (data) => {
    console.log(`\n\x1b[33m--- [Found ${data.type.toUpperCase()}] ---\x1b[0m`);
    console.log(`  Post Index:     ${data.postIndex}`);
    console.log(`  Media Element:  <${data.mediaTag}> (Original size: ${data.mediaRect.width} x ${data.mediaRect.height})`);
    console.log(`  Height Wrapper: <${data.wrapperTag}> (Wrapper size: ${data.wrapperRect.width} x ${data.wrapperRect.height})`);
    console.log(`  Wrapper Styles: padding-top: "${data.wrapperStyles.paddingTop}", height: "${data.wrapperStyles.height}", min-height: "${data.wrapperStyles.minHeight}"`);
    console.log(`  Article Height: ${data.articleHeight}px`);
    if (data.testedReduction) {
      console.log(`  \x1b[32m[Tested Halving Rule]:\x1b[0m`);
      console.log(`    Before: Wrapper = ${data.testedReduction.beforeHeight}px, Article = ${data.testedReduction.beforeArticleHeight}px`);
      console.log(`    After:  Wrapper = ${data.testedReduction.afterHeight}px, Article = ${data.testedReduction.afterArticleHeight}px`);
      console.log(`    Height Reduced: \x1b[1m${data.testedReduction.savedHeight}px\x1b[0m (Success: ${data.testedReduction.savedHeight > 30 ? 'YES ✔' : 'NO ❌'})`);
    }
  });

  // Periodic inspection loop
  let isRunning = true;
  const inspectLoop = async () => {
    while (isRunning) {
      try {
        await page.evaluate(() => {
          if (!window.__INSPECTED_NODES__) window.__INSPECTED_NODES__ = new WeakSet();

          const articles = document.querySelectorAll('div[role="feed"] [role="article"], [data-pagelet="Feed"] [role="article"], div[role="main"] [role="article"]');
          let postIndex = 0;

          for (const article of articles) {
            postIndex++;
            if (window.__INSPECTED_NODES__.has(article)) continue;

            // 1. Detect single image or album
            const imgs = article.querySelectorAll('img');
            let targetMedia = null;
            let mediaType = null;

            for (const img of imgs) {
              const r = img.getBoundingClientRect();
              if (r.width >= 200 && r.height >= 120) {
                targetMedia = img;
                mediaType = 'image';
                break;
              }
            }

            // 2. Detect video
            if (!targetMedia) {
              const video = article.querySelector('video');
              if (video) {
                const r = video.getBoundingClientRect();
                if (r.width >= 160 && r.height >= 100) {
                  targetMedia = video;
                  mediaType = 'video';
                }
              }
            }

            // 3. Detect background text card
            if (!targetMedia) {
              const bgCards = article.querySelectorAll('div[style*="background-image"], div[style*="background-size"]');
              for (const card of bgCards) {
                const r = card.getBoundingClientRect();
                if (r.width >= 300 && r.height >= 200) {
                  targetMedia = card;
                  mediaType = 'text-card';
                  break;
                }
              }
            }

            if (!targetMedia) continue;
            window.__INSPECTED_NODES__.add(article);

            // Find the height wrapper ancestor
            // Walk up from targetMedia to article, looking for the container that sets height/padding-top
            let curr = targetMedia.parentElement;
            let wrapper = null;
            while (curr && curr !== article) {
              const cs = window.getComputedStyle(curr);
              const inlineStyle = curr.getAttribute('style') || '';

              // An absolutely-positioned container does NOT establish document flow height!
              if (cs.position === 'absolute') {
                curr = curr.parentElement;
                continue;
              }

              const hasPaddingTop = inlineStyle.includes('padding-top') || inlineStyle.includes('--x-paddingTop') || parseFloat(cs.paddingTop) > 50;
              const hasExplicitPixelHeight = !inlineStyle.includes('height: 100%') && !inlineStyle.includes('height:100%') && (inlineStyle.includes('height:') || inlineStyle.includes('aspect-ratio'));
              const hasMinHeight = parseFloat(cs.minHeight) > 150;

              if (hasPaddingTop || hasExplicitPixelHeight || hasMinHeight || curr.classList.contains('x1s85apg')) {
                wrapper = curr;
                break;
              }
              curr = curr.parentElement;
            }

            if (!wrapper) wrapper = targetMedia.parentElement;

            const mRect = targetMedia.getBoundingClientRect();
            const wRect = wrapper.getBoundingClientRect();
            const aRect = article.getBoundingClientRect();
            const wcs = window.getComputedStyle(wrapper);

            // Test applying a halving rule
            let testedReduction = null;
            const beforeHeight = Math.round(wRect.height);
            const beforeArticleHeight = Math.round(aRect.height);

            if (beforeHeight > 100) {
              const halfHeight = Math.round(beforeHeight * 0.5);
              const origStyle = wrapper.getAttribute('style') || '';
              wrapper.dataset.origStyle = origStyle;

              // If wrapper uses padding-top for aspect ratio, max-height alone CANNOT shrink padding!
              // We must halve the padding-top or set height with padding-top: 0!
              if (origStyle.includes('padding-top') || origStyle.includes('--x-paddingTop') || parseFloat(wcs.paddingTop) > 50) {
                const currentPadding = parseFloat(wcs.paddingTop);
                wrapper.style.setProperty('padding-top', `${Math.round(currentPadding * 0.5)}px`, 'important');
              } else {
                wrapper.style.setProperty('max-height', `${halfHeight}px`, 'important');
              }
              wrapper.style.setProperty('overflow', 'hidden', 'important');

              if (targetMedia.tagName === 'IMG' || targetMedia.tagName === 'VIDEO') {
                targetMedia.style.setProperty('max-height', `${halfHeight}px`, 'important');
                targetMedia.style.setProperty('object-fit', 'cover', 'important');
              }

              // Also check parent wrapper if padding-top was on child or parent
              let parent = wrapper.parentElement;
              if (parent && parent !== article) {
                const pRect = parent.getBoundingClientRect();
                if (pRect.height > (halfHeight + 50)) {
                  parent.dataset.origStyle = parent.getAttribute('style') || '';
                  parent.style.setProperty('max-height', `${halfHeight}px`, 'important');
                  parent.style.setProperty('overflow', 'hidden', 'important');
                }
              }

              // Force reflow and measure after
              const afterWRect = wrapper.getBoundingClientRect();
              const afterARect = article.getBoundingClientRect();
              const afterHeight = Math.round(afterWRect.height);
              const afterArticleHeight = Math.round(afterARect.height);

              testedReduction = {
                beforeHeight,
                afterHeight,
                beforeArticleHeight,
                afterArticleHeight,
                savedHeight: beforeArticleHeight - afterArticleHeight
              };
            }

            window.logInspectionResult({
              postIndex,
              type: mediaType,
              mediaTag: targetMedia.tagName.toLowerCase(),
              mediaRect: { width: Math.round(mRect.width), height: Math.round(mRect.height) },
              wrapperTag: wrapper.tagName.toLowerCase(),
              wrapperRect: { width: Math.round(wRect.width), height: Math.round(wRect.height) },
              wrapperStyles: {
                paddingTop: wcs.paddingTop,
                height: wcs.height,
                minHeight: wcs.minHeight
              },
              articleHeight: Math.round(aRect.height),
              testedReduction
            });
          }
        });
      } catch (err) {
        if (isRunning) console.error('Inspection error:', err.message);
      }

      await new Promise(r => setTimeout(r, 2000));
    }
  };

  inspectLoop();

  await new Promise((resolve) => {
    process.on('SIGINT', () => {
      isRunning = false;
      resolve();
    });
    browser.on('disconnected', () => {
      isRunning = false;
      resolve();
    });
    if (durationSec > 0) {
      setTimeout(() => {
        isRunning = false;
        resolve();
      }, durationSec * 1000);
    }
  });

  if (mockServer) {
    mockServer.close();
  }

  console.log('\nClosing browser session...');
  await browser.close().catch(() => {});
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
