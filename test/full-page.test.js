const test = require('node:test');
const assert = require('node:assert/strict');
const { renderElementFromVisibleCaptures } = require('../src/content/export-utils.js');

test('full page captures the document bounds and restores scroll on success and failure', async () => {
  const names = ['window', 'document', 'Image', 'requestAnimationFrame', 'getComputedStyle'];
  const previous = Object.fromEntries(names.map(name => [name, global[name]]));
  const draws = [];
  const context = { fillRect() {}, drawImage(...args) { draws.push(args.slice(1)); } };
  const canvas = { getContext: () => context, toBlob: callback => callback(new Blob(['png'])) };
  const root = { scrollWidth: 800, scrollHeight: 1300 };
  const body = { scrollWidth: 800, scrollHeight: 1300 };
  global.window = { innerWidth: 800, innerHeight: 600, devicePixelRatio: 1, scrollX: 0, scrollY: 200,
    scrollTo(x, y) { this.scrollX = Math.min(0, x); this.scrollY = Math.min(700, Math.max(0, y)); } };
  global.document = { documentElement: root, body, createElement: () => canvas };
  global.getComputedStyle = () => ({ backgroundColor: '#fff' });
  global.requestAnimationFrame = callback => callback();
  global.Image = class { naturalWidth = 800; naturalHeight = 600; set src(value) { this.onload(); } };
  try {
    let captures = 0;
    await renderElementFromVisibleCaptures(root, async () => { captures++; return 'data:image/png;base64,'; }, { fullPage: true, background: '#fff' });
    assert.equal(captures, 3);
    assert.equal(canvas.width, 800);
    assert.equal(canvas.height, 1300);
    assert.equal(draws.length, 3);
    assert.equal(global.window.scrollY, 200);
    assert.equal(Math.max(...draws.map(rect => rect[5] + rect[7])), 1300);
    await assert.rejects(renderElementFromVisibleCaptures(root, async () => { throw new Error('capture failure'); }, { fullPage: true, background: '#fff' }), /capture failure/);
    assert.equal(global.window.scrollY, 200);
  } finally {
    for (const name of names) {
      if (previous[name] === undefined) delete global[name];
      else global[name] = previous[name];
    }
  }
});
