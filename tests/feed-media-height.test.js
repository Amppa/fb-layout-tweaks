// tests/feed-media-height.test.js
// Automated verification for Facebook feed media height scaling (25%, 50%, 75%, px400, px300, px200)
// Validates proportional aspect-ratio scaling, video isolation, and style restoration.

const test = require('node:test');
const assert = require('node:assert');

// Mock a lightweight DOM environment for Node.js
function createMockDom() {
  class MockElement {
    constructor(tagName, id = '') {
      this.tagName = tagName.toUpperCase();
      this.id = id;
      this.classList = new Set();
      this.children = [];
      this.parentElement = null;
      this.dataset = {};
      this._styles = {};
      this.attributes = {};
      this.clientWidth = 680;
      this.clientHeight = 680;
      this.naturalWidth = 680;
      this.naturalHeight = 680;
    }

    setAttribute(name, val) {
      this.attributes[name] = String(val);
      if (name === 'style') {
        this._parseInlineStyle(val);
      }
    }

    getAttribute(name) {
      return this.attributes[name] || null;
    }

    removeAttribute(name) {
      delete this.attributes[name];
      if (name === 'style') this._styles = {};
    }

    _parseInlineStyle(styleStr) {
      this._styles = {};
      if (!styleStr) return;
      styleStr.split(';').forEach(rule => {
        const [prop, val] = rule.split(':').map(s => s && s.trim());
        if (prop && val) {
          this._styles[prop.toLowerCase()] = val.replace(/!important/g, '').trim();
        }
      });
    }

    get style() {
      const self = this;
      return {
        setProperty: (prop, val) => {
          self._styles[prop] = val;
          const inline = Object.entries(self._styles).map(([p, v]) => `${p}: ${v}`).join('; ');
          self.attributes.style = inline;
        },
        getPropertyValue: (prop) => self._styles[prop] || '',
        removeProperty: (prop) => {
          delete self._styles[prop];
          const inline = Object.entries(self._styles).map(([p, v]) => `${p}: ${v}`).join('; ');
          self.attributes.style = inline;
        }
      };
    }

    appendChild(child) {
      child.parentElement = this;
      this.children.push(child);
      return child;
    }

    matches(selector) {
      if (selector.includes('.post-card') && this.classList.has('post-card')) return true;
      if (selector.includes('[role="article"]') && this.getAttribute('role') === 'article') return true;
      if (selector.includes('[role="main"]') && this.getAttribute('role') === 'main') return true;
      return false;
    }

    closest(selector) {
      let curr = this;
      while (curr) {
        if (curr.matches(selector)) return curr;
        curr = curr.parentElement;
      }
      return null;
    }

    querySelectorAll(selector) {
      const results = [];
      function traverse(node) {
        for (const child of node.children) {
          if (selector.includes('img') && child.tagName === 'IMG') {
            results.push(child);
          } else if (selector.includes('video') && child.tagName === 'VIDEO') {
            results.push(child);
          } else if (selector.includes('[data-fb-lt-orig-style]') && child.dataset.fbLtOrigStyle) {
            results.push(child);
          } else if (selector.includes('[data-fb-lt-scaled-mode]') && child.dataset.fbLtScaledMode) {
            results.push(child);
          }
          traverse(child);
        }
      }
      traverse(this);
      return results;
    }
  }

  const document = {
    body: new MockElement('BODY'),
    documentElement: new MockElement('HTML'),
    addEventListener: () => {},
    removeEventListener: () => {},
    querySelectorAll: (selector) => document.body.querySelectorAll(selector)
  };

  const window = {
    location: { pathname: '/' },
    getComputedStyle: (el) => {
      return {
        paddingTop: el._styles['padding-top'] || '0px',
        width: el._styles['width'] || '680px',
        height: el._styles['height'] || '680px'
      };
    }
  };

  return { document, window, MockElement };
}

test('scanAndScaleFeedMedia correctly scales images for 75%, 50%, 25%, px400, px300, px200 and restores', () => {
  const { document, window, MockElement } = createMockDom();
  globalThis.document = document;
  globalThis.window = window;

  const { scanAndScaleFeedMedia, restoreFeedMedia } = require('../src/content/content.js');

  // Build simulated Facebook Feed DOM
  // Feed -> Article (Post) -> AspectWrapper (padding-top: 600px; width: 600px) -> Img
  const feed = new MockElement('DIV', 'feed');
  feed.setAttribute('role', 'feed');
  document.body.appendChild(feed);

  const post = new MockElement('DIV', 'post-1');
  post.setAttribute('role', 'article');
  post.classList.add('post-card');
  feed.appendChild(post);

  const wrapper = new MockElement('DIV', 'wrapper-1');
  wrapper.setAttribute('style', 'padding-top: 600px; width: 600px; position: relative;');
  post.appendChild(wrapper);

  const img = new MockElement('IMG', 'photo-1');
  img.setAttribute('style', 'object-fit: cover; width: 100%; height: 100%;');
  img.clientWidth = 600;
  img.clientHeight = 600;
  wrapper.appendChild(img);

  // Also add a video post to ensure video is untouched
  const videoPost = new MockElement('DIV', 'post-video');
  videoPost.setAttribute('role', 'article');
  feed.appendChild(videoPost);

  const video = new MockElement('VIDEO', 'video-1');
  video.setAttribute('style', 'width: 600px; height: 500px;');
  video.clientWidth = 600;
  video.clientHeight = 500;
  videoPost.appendChild(video);

  // 1. Test 50%
  scanAndScaleFeedMedia('h50');
  assert.strictEqual(wrapper._styles['padding-top'], '300px', '50% height should scale padding-top from 600px to 300px');
  assert.strictEqual(wrapper._styles['width'], '300px', '50% width should scale from 600px to 300px');
  assert.strictEqual(wrapper._styles['margin-inline'], 'auto', 'Wrapper must be centered with margin-inline: auto');
  assert.strictEqual(img._styles['object-fit'], 'contain', 'Image object-fit must be contain');
  assert.strictEqual(video._styles['height'], '500px', 'Video height must remain untouched');
  assert.strictEqual(video.dataset.fbLtOrigStyle, undefined, 'Video must not have dataset tags');

  // 2. Test 25%
  scanAndScaleFeedMedia('h25');
  assert.strictEqual(wrapper._styles['padding-top'], '150px', '25% height should scale padding-top from 600px to 150px');
  assert.strictEqual(wrapper._styles['width'], '150px', '25% width should scale from 600px to 150px');

  // 3. Test 75%
  scanAndScaleFeedMedia('h75');
  assert.strictEqual(wrapper._styles['padding-top'], '450px', '75% height should scale padding-top from 600px to 450px');
  assert.strictEqual(wrapper._styles['width'], '450px', '75% width should scale from 600px to 450px');

  // 4. Test Fixed 400px (px400)
  scanAndScaleFeedMedia('px400');
  assert.strictEqual(wrapper._styles['padding-top'], '400px', 'px400 should cap height to 400px');
  assert.strictEqual(wrapper._styles['width'], '400px', 'px400 should scale width proportionally to 400px');

  // 5. Test Fixed 300px (px300)
  scanAndScaleFeedMedia('px300');
  assert.strictEqual(wrapper._styles['padding-top'], '300px', 'px300 should cap height to 300px');
  assert.strictEqual(wrapper._styles['width'], '300px', 'px300 should scale width proportionally to 300px');

  // 6. Test Fixed 200px (px200)
  scanAndScaleFeedMedia('px200');
  assert.strictEqual(wrapper._styles['padding-top'], '200px', 'px200 should cap height to 200px');
  assert.strictEqual(wrapper._styles['width'], '200px', 'px200 should scale width proportionally to 200px');

  // 7. Test Restore to default
  scanAndScaleFeedMedia('default');
  assert.strictEqual(wrapper._styles['padding-top'], '600px', 'Restoring to default must restore original padding-top');
  assert.strictEqual(wrapper._styles['width'], '600px', 'Restoring to default must restore original width');
  assert.strictEqual(img._styles['object-fit'], 'cover', 'Restoring must restore original object-fit');
  assert.strictEqual(video._styles['height'], '500px', 'Video still untouched');
});

test('scanAndScaleFeedMedia uses incremental data-fb-lt-scaled-mode stamp to skip already-scaled images', () => {
  const { document, window, MockElement } = createMockDom();
  globalThis.document = document;
  globalThis.window = window;

  const { scanAndScaleFeedMedia } = require('../src/content/content.js');

  const feed = new MockElement('DIV', 'feed-2');
  feed.setAttribute('role', 'feed');
  document.body.appendChild(feed);

  const post = new MockElement('DIV', 'post-2');
  post.setAttribute('role', 'article');
  post.classList.add('post-card');
  feed.appendChild(post);

  const wrapper = new MockElement('DIV', 'wrapper-2');
  wrapper.setAttribute('style', 'padding-top: 600px; width: 600px; position: relative;');
  post.appendChild(wrapper);

  const img = new MockElement('IMG', 'photo-2');
  img.setAttribute('style', 'object-fit: cover; width: 100%; height: 100%;');
  img.clientWidth = 600;
  img.clientHeight = 600;
  wrapper.appendChild(img);

  scanAndScaleFeedMedia('h50');
  assert.strictEqual(img.dataset.fbLtScaledMode, 'h50');
  assert.strictEqual(wrapper._styles['padding-top'], '300px');

  // Modify wrapper style artificially to verify a second call to scanAndScaleFeedMedia('h50') does not re-process
  wrapper._styles['padding-top'] = 'custom-untouched';
  scanAndScaleFeedMedia('h50');
  assert.strictEqual(wrapper._styles['padding-top'], 'custom-untouched', 'Should skip already stamped image');

  // When mode changes to 'h25', it should re-process
  scanAndScaleFeedMedia('h25');
  assert.strictEqual(img.dataset.fbLtScaledMode, 'h25');
  assert.strictEqual(wrapper._styles['padding-top'], '150px', 'Should re-process when mode changes');

  // Restoring should clean up stamp
  scanAndScaleFeedMedia('default');
  assert.strictEqual(img.dataset.fbLtScaledMode, undefined);
});

