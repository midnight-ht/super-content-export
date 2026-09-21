const test = require('node:test');
const assert = require('node:assert/strict');

const {
  elementToMarkdown,
  isSameOriginResource,
  getExportScale,
  getVisibleCaptureScale,
  getAlignedPixelRange,
  getCaptureDrawRects,
  getExportBackgroundColor,
  shouldRetryWithoutResources,
  getCaptureTilePositions,
  getVisibleCaptureDelay,
  getExportToolbarPosition,
  getSuccessfulExportCleanup,
  isSelectionForUrl,
  getScrollableExportStyle,
  getElementExportSize,
  getScrollableAncestors,
  getInternalScrollPosition,
  shouldHideViewportOverlay,
  decodePrivateUseText,
  matchInkToDigits,
  getPickChain,
  shiftPickIndex,
  shouldKeepExpandedPick,
  pickIndexDeltaFromWheel,
} = require('../src/content/export-utils.js');

function text(value) {
  return { nodeType: 3, nodeValue: value, textContent: value };
}

function el(tagName, children = [], attrs = {}) {
  const node = {
    nodeType: 1,
    tagName: tagName.toUpperCase(),
    childNodes: children,
    children: children.filter((child) => child.nodeType === 1),
    textContent: children.map((child) => child.textContent || '').join(''),
    getAttribute(name) {
      return attrs[name] ?? null;
    },
  };
  return node;
}

test('converts headings, paragraphs, emphasis, and links to markdown', () => {
  const root = el('article', [
    el('h2', [text('  Release notes  ')]),
    el('p', [text('A '), el('strong', [text('small')]), text(' update with '), el('a', [text('docs')], { href: 'https://example.com/docs' }), text('.')]),
  ]);

  assert.equal(
    elementToMarkdown(root),
    '## Release notes\n\nA **small** update with [docs](https://example.com/docs).',
  );
});

test('converts ordered and unordered lists with nested items', () => {
  const root = el('div', [
    el('ul', [
      el('li', [text('First')]),
      el('li', [text('Second'), el('ul', [el('li', [text('Nested')])])]),
    ]),
    el('ol', [el('li', [text('One')]), el('li', [text('Two')])]),
  ]);

  assert.equal(elementToMarkdown(root), '- First\n- Second\n  - Nested\n\n1. One\n2. Two');
});

test('converts code blocks and ignores non-content nodes', () => {
  const root = el('main', [
    el('script', [text('ignore me')]),
    el('pre', [el('code', [text('const value = 1;')])]),
    el('p', [text('Done')]),
  ]);

  assert.equal(elementToMarkdown(root), '```\nconst value = 1;\n```\n\nDone');
});

test('preserves block structure inside a custom container element', () => {
  const root = el('turbo-frame', [
    el('div', [el('h3', [text('Quick setup')]), el('p', [text('Intro')])]),
    el('div', [el('h3', [text('Command')]), el('pre', [text('git init')])]),
  ]);

  assert.equal(
    elementToMarkdown(root),
    '### Quick setup\n\nIntro\n\n### Command\n\n```\ngit init\n```',
  );
});

test('identifies external resources before image rendering', () => {
  assert.equal(isSameOriginResource('https://github.com/assets/icon.svg', 'https://github.com/org/repo'), true);
  assert.equal(isSameOriginResource('https://avatars.githubusercontent.com/u/1', 'https://github.com/org/repo'), false);
  assert.equal(isSameOriginResource('/assets/icon.svg', 'https://github.com/org/repo'), true);
});

test('reduces PNG scale when the selected area is large', () => {
  assert.equal(getExportScale(1000, 1000, 2), 2);
  assert.equal(getExportScale(4000, 4000, 2), 1);
  assert.equal(getExportScale(8000, 4000, 2), Math.sqrt(0.5));
});

test('keeps visible-tab PNG exports at device pixel ratio by default', () => {
  assert.equal(getVisibleCaptureScale(1000, 1000, 2), 2);
  assert.equal(getVisibleCaptureScale(800, 1200, 1.5), 1.5);
  assert.equal(getVisibleCaptureScale(1000, 1000, 2, 1), 1);
  assert.equal(getVisibleCaptureScale(2000, 2000, 2), 2);
  assert.ok(getVisibleCaptureScale(9000, 9000, 2) < 2);
});

test('aligns capture slices to whole pixels without leaving gaps', () => {
  const first = getAlignedPixelRange(0, 800, 1.25);
  const second = getAlignedPixelRange(800, 800, 1.25);
  const fractional = getAlignedPixelRange(0, 799.4, 2);
  const nextFractional = getAlignedPixelRange(799.4, 800, 2);

  assert.deepEqual(first, { start: 0, size: 1000 });
  assert.equal(second.start, first.start + first.size);
  assert.equal(fractional.start + fractional.size >= nextFractional.start, true);
  assert.equal(Number.isInteger(fractional.start), true);
  assert.equal(Number.isInteger(fractional.size), true);
});

test('draws visible captures on integer source and destination rects', () => {
  const rects = getCaptureDrawRects({
    visibleLeft: 12.4,
    visibleTop: 0.6,
    visibleWidth: 677.2,
    visibleHeight: 800.4,
    contentX: 0.2,
    contentY: 799.7,
    sourceScaleX: 2,
    sourceScaleY: 2,
    outputScale: 2,
  });

  for (const value of Object.values(rects)) {
    assert.equal(Number.isInteger(value), true);
  }
  assert.equal(rects.dy + rects.dh >= Math.ceil((799.7 + 800.4) * 2), true);
});

test('uses the first opaque page color as the PNG backdrop', () => {
  assert.equal(
    getExportBackgroundColor(['transparent', 'rgba(0, 0, 0, 0)', 'rgb(24, 24, 27)']),
    'rgb(24, 24, 27)',
  );
  assert.equal(getExportBackgroundColor(['transparent']), '#ffffff');
});

test('retries only when canvas export reports a tainted canvas', () => {
  assert.equal(
    shouldRetryWithoutResources(new DOMException('Tainted canvases may not be exported.', 'SecurityError')),
    true,
  );
  assert.equal(shouldRetryWithoutResources(new Error('SVG image failed')), false);
});

test('creates complete viewport tiles for large selections', () => {
  assert.deepEqual(getCaptureTilePositions(2100, 1300, 1000, 800), [
    { x: 0, y: 0 },
    { x: 1000, y: 0 },
    { x: 2000, y: 0 },
    { x: 0, y: 800 },
    { x: 1000, y: 800 },
    { x: 2000, y: 800 },
  ]);
});

test('spaces visible tab captures below Chrome rate limit', () => {
  assert.equal(getVisibleCaptureDelay(1000, 1000, 550), 550);
  assert.equal(getVisibleCaptureDelay(1000, 1200, 550), 350);
  assert.equal(getVisibleCaptureDelay(1000, 1600, 550), 0);
});

test('places the export toolbar at the top center of the page', () => {
  assert.deepEqual(
    getExportToolbarPosition(
      { left: 200, right: 800, top: 300, bottom: 700 },
      { width: 360, height: 42 },
      { width: 1200, height: 900 },
    ),
    { left: 420, top: 16 },
  );
});

test('keeps the centered toolbar inside a narrow viewport', () => {
  assert.deepEqual(
    getExportToolbarPosition(
      { left: 4, right: 260, top: 8, bottom: 80 },
      { width: 360, height: 42 },
      { width: 420, height: 160 },
    ),
    { left: 30, top: 16 },
  );
});

test('cleans the page toolbar after a successful export without clearing the stored selection', () => {
  assert.deepEqual(getSuccessfulExportCleanup('png', true), {
    removeToolbar: true,
    keepSelection: true,
  });
  assert.deepEqual(getSuccessfulExportCleanup('markdown', false), {
    removeToolbar: false,
    keepSelection: true,
  });
});

test('matches stored selections only to the page URL they came from', () => {
  const selection = { selector: '#content', text: 'Content', url: 'https://example.com/docs' };

  assert.equal(isSelectionForUrl(selection, 'https://example.com/docs'), true);
  assert.equal(isSelectionForUrl(selection, 'https://example.com/other'), false);
  assert.equal(isSelectionForUrl({ selector: '#content' }, 'https://example.com/docs'), false);
});

test('expands a scrollable element before rendering its export clone', () => {
  assert.deepEqual(
    getScrollableExportStyle(
      { scrollWidth: 1200, clientWidth: 600, scrollHeight: 1600, clientHeight: 400 },
      { overflowX: 'auto', overflowY: 'scroll' },
    ),
    {
      width: '1200px',
      maxWidth: 'none',
      overflowX: 'visible',
      height: '1600px',
      maxHeight: 'none',
      overflowY: 'visible',
      overflow: 'visible',
    },
  );
});

test('does not expand clipped content that is not a scroll container', () => {
  assert.deepEqual(
    getScrollableExportStyle(
      { scrollWidth: 1200, clientWidth: 600, scrollHeight: 1600, clientHeight: 400 },
      { overflowX: 'hidden', overflowY: 'hidden' },
    ),
    {},
  );
});

test('uses scroll dimensions as the export bounds for a scrollable element', () => {
  assert.deepEqual(
    getElementExportSize({
      scrollWidth: 1200,
      scrollHeight: 1600,
      getBoundingClientRect: () => ({ width: 600, height: 400 }),
    }, { overflowX: 'auto', overflowY: 'scroll' }),
    { width: 1200, height: 1600 },
  );
});

test('keeps the visible bounds for a clipped non-scrollable element', () => {
  assert.deepEqual(
    getElementExportSize({
      scrollWidth: 1200,
      scrollHeight: 1600,
      getBoundingClientRect: () => ({ width: 600, height: 400 }),
    }, { overflowX: 'hidden', overflowY: 'hidden' }),
    { width: 600, height: 400 },
  );
});

test('finds an internal scroll ancestor for viewport-capture fallback', () => {
  const scrollContainer = {
    tagName: 'DIV',
    scrollWidth: 1409,
    clientWidth: 1409,
    scrollHeight: 2717,
    clientHeight: 1103,
    parentElement: null,
  };
  const selectedContent = {
    tagName: 'DIV',
    scrollWidth: 1409,
    clientWidth: 1409,
    scrollHeight: 2536,
    clientHeight: 2536,
    parentElement: scrollContainer,
  };

  assert.deepEqual(
    getScrollableAncestors(selectedContent, (element) => (
      element === scrollContainer ? { overflowY: 'auto', overflowX: 'hidden' } : { overflow: 'visible' }
    )),
    [scrollContainer],
  );
});

test('calculates internal scroll positions without exceeding the container bounds', () => {
  const scrollContainer = { scrollWidth: 1409, clientWidth: 1409, scrollHeight: 2717, clientHeight: 1103 };
  const selectedContent = {};

  assert.deepEqual(
    getInternalScrollPosition(scrollContainer, selectedContent, { x: 1159, y: 1159 }, { left: 120, top: 80 }),
    { left: 0, top: 1239 },
  );
  assert.deepEqual(
    getInternalScrollPosition(scrollContainer, scrollContainer, { x: 1159, y: 1159 }, { left: 120, top: 80 }),
    { left: 0, top: 1159 },
  );
});

test('keeps the export target and its descendants visible during overlay hiding', () => {
  const page = { id: 'page' };
  const stickyPanel = { id: 'panel' };
  const header = { id: 'header' };
  const chat = { id: 'chat' };
  page.contains = (node) => node === stickyPanel || node === header || node === chat;
  stickyPanel.contains = (node) => node === header;
  header.contains = () => false;
  chat.contains = () => false;

  assert.equal(shouldHideViewportOverlay(chat, header), true);
  assert.equal(shouldHideViewportOverlay(header, header), false);
  assert.equal(shouldHideViewportOverlay(stickyPanel, header), false);
  assert.equal(shouldHideViewportOverlay(header, stickyPanel), false);
  assert.equal(shouldHideViewportOverlay(chat, page), false);
});

test('decodes private-use salary glyphs with a character recognizer', () => {
  const decoded = decodePrivateUseText('AI工程专家\uE034\uE031-\uE036\uE031K', (ch) => ({
    '\uE034': '3',
    '\uE031': '0',
    '\uE036': '5',
  }[ch]));

  assert.equal(decoded, 'AI工程专家30-50K');
});

test('leaves private-use characters unchanged when recognition fails', () => {
  assert.equal(decodePrivateUseText('A\uE034K', () => null), 'A\uE034K');
});

test('matches an ink bitmap to the closest unique digit', () => {
  const three = [1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1];
  const digits = {
    0: [1, 1, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1],
    3: [1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1],
    8: [1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1],
  };

  assert.equal(matchInkToDigits(three, digits), '3');
  assert.equal(matchInkToDigits([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], digits), null);
});

test('converts BOSS-style job headers to readable markdown', () => {
  const root = el('div', [
    el('h1', [text('AI工程专家\uE034\uE031-\uE036\uE031K')]),
    el('ul', [
      el('li', [el('a', [text('北京')], { href: '/c101010100/' })]),
      el('li', [text('5-10年')]),
      el('li', [text('本科')]),
    ]),
    el('p', [
      el('a', [text('收藏')], { href: 'javascript:;' }),
      el('a', [text('立即沟通')], { href: 'javascript:void(0)' }),
    ]),
    el('h3', [text('职位描述')]),
    el('p', [text('负责AI编码工具链的架构设计与优化。')]),
  ]);
  const map = { '\uE034': '3', '\uE031': '0', '\uE036': '5' };

  assert.equal(
    elementToMarkdown(root, { recognizePrivateUseChar: (ch) => map[ch] || ch }),
    [
      '# AI工程专家30-50K',
      '- [北京](/c101010100/)\n- 5-10年\n- 本科',
      '收藏立即沟通',
      '### 职位描述',
      '负责AI编码工具链的架构设计与优化。',
    ].join('\n\n'),
  );
});

test('builds a pick chain from the hovered node up to the page body', () => {
  const body = { nodeType: 1, tagName: 'BODY', parentElement: null };
  const panel = { nodeType: 1, tagName: 'DIV', parentElement: body };
  const header = { nodeType: 1, tagName: 'HEADER', parentElement: panel };
  const title = { nodeType: 1, tagName: 'H1', parentElement: header };

  assert.deepEqual(getPickChain(title, body), [title, header, panel]);
  assert.equal(shiftPickIndex(0, 1, 3), 1);
  assert.equal(shiftPickIndex(2, 1, 3), 2);
  assert.equal(shiftPickIndex(0, -1, 3), 0);
  assert.equal(pickIndexDeltaFromWheel(-120), 1);
  assert.equal(pickIndexDeltaFromWheel(80), -1);
});

test('keeps an expanded pick while the pointer stays inside it', () => {
  const panel = {
    contains(node) {
      return node === this.child;
    },
  };
  panel.child = { id: 'title' };

  assert.equal(shouldKeepExpandedPick(panel.child, panel), true);
  assert.equal(shouldKeepExpandedPick(panel, panel), false);
  assert.equal(shouldKeepExpandedPick({ id: 'outside' }, panel), false);
});
