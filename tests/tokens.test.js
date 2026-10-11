// tests/tokens.test.js
// Integrity tests for shared design tokens (src/shared/tokens.css).
// Run with: node --test tests/tokens.test.js

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT_DIR, rel), 'utf8');
}

test('Every var() used by page stylesheets is defined in tokens.css', () => {
  const tokens = read('src/shared/tokens.css');
  const defined = new Set([...tokens.matchAll(/--([\w-]+)\s*:/g)].map(m => m[1]));
  assert.ok(defined.size > 0, 'tokens.css must define variables');

  for (const file of ['src/options/options.css', 'src/popup/popup.css']) {
    const css = read(file);
    const used = new Set([...css.matchAll(/var\(--([\w-]+)/g)].map(m => m[1]));
    for (const name of used) {
      assert.ok(defined.has(name), `${file} uses --${name} missing in tokens.css`);
    }
  }
});

test('Page stylesheets carry no :root tokens and load tokens.css first', () => {
  for (const [htmlFile, cssFile] of [
    ['src/options/options.html', 'src/options/options.css'],
    ['src/popup/popup.html', 'src/popup/popup.css'],
  ]) {
    const css = read(cssFile);
    assert.ok(!css.includes(':root'), `${cssFile} must not define :root tokens`);
    const html = read(htmlFile);
    const tokensPos = html.indexOf('shared/tokens.css');
    const pagePos = html.indexOf(cssFile.split('/').pop());
    assert.ok(tokensPos !== -1 && tokensPos < pagePos,
      `${htmlFile} must load shared/tokens.css before ${cssFile}`);
  }
});
