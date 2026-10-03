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
  getPickDepthAfterRebuild,
  getPickLabel,
  getPickBadgePosition,
  getPickEventTarget,
  isComposedAncestor,
  getOverlayCompensation,
  getCompensatedOverlayRect,
  getCompensatedOverlayPoint,
  getCompensatedOverlayScaleTransform,
  getExportRootResetStyle,
  toCssPropertyName,
  applyStyleProperties,
  selectorForElement,
  querySelectorDeep,
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

test('re-clamps a carried pick depth when the chain is rebuilt', () => {
  assert.equal(getPickDepthAfterRebuild(3, 5), 3);
  assert.equal(getPickDepthAfterRebuild(7, 5), 4);
  assert.equal(getPickDepthAfterRebuild(2, 0), 0);
  assert.equal(getPickDepthAfterRebuild(-1, 4), 0);
});

test('labels the hovered element together with its expansion depth', () => {
  const node = { nodeType: 1, tagName: 'DIV', classList: ['card'], getAttribute: () => null };

  assert.equal(getPickLabel(node, 0), 'div.card');
  assert.equal(getPickLabel(node, 2), 'div.card ↑2');
  assert.equal(getPickLabel(null, 0), '');
});

test('places the depth badge above the highlighted element', () => {
  assert.deepEqual(
    getPickBadgePosition(
      { left: 100, top: 300, bottom: 500 },
      { width: 120, height: 20 },
      { width: 1200, height: 900 },
    ),
    { left: 100, top: 274 },
  );
});

test('moves the badge below the element when there is no room above', () => {
  assert.deepEqual(
    getPickBadgePosition(
      { left: 1190, top: 0, bottom: 40 },
      { width: 120, height: 20 },
      { width: 1200, height: 900 },
    ),
    { left: 1072, top: 46 },
  );
});

test('walks up across a shadow boundary when building the pick chain', () => {
  const body = { nodeType: 1, tagName: 'BODY', parentElement: null };
  const host = { nodeType: 1, tagName: 'MY-CARD', parentElement: body, getRootNode: () => ({}) };
  const shadowRoot = { host };
  const inner = { nodeType: 1, tagName: 'DIV', parentElement: null, getRootNode: () => shadowRoot };
  const title = { nodeType: 1, tagName: 'H2', parentElement: inner, getRootNode: () => shadowRoot };

  assert.deepEqual(getPickChain(title, body), [title, inner, host]);
});

test('takes the deepest node from a composed event path', () => {
  const host = { nodeType: 1, tagName: 'MY-CARD' };
  const inner = { nodeType: 1, tagName: 'DIV' };
  const textNode = { nodeType: 3, parentElement: host };

  assert.equal(getPickEventTarget({ target: host, composedPath: () => [inner, host] }), inner);
  assert.equal(getPickEventTarget({ target: textNode, composedPath: () => [] }), host);
  assert.equal(getPickEventTarget({ target: host }), host);
});

test('detects shadow-host ancestors that contains() cannot see', () => {
  const wrapper = { nodeType: 1, tagName: 'SECTION' };
  const host = { nodeType: 1, tagName: 'MY-CARD', parentElement: wrapper, getRootNode: () => ({}) };
  const shadowRoot = { host };
  const inner = { nodeType: 1, tagName: 'DIV', parentElement: null, getRootNode: () => shadowRoot };

  assert.equal(isComposedAncestor(wrapper, inner), true);
  assert.equal(isComposedAncestor(inner, wrapper), false);
  assert.equal(shouldHideViewportOverlay(wrapper, inner), false);
});

test('measures the drift a transformed ancestor applies to fixed overlays', () => {
  assert.deepEqual(
    getOverlayCompensation({ left: 40, top: -20, width: 200, height: 100 }, 100),
    { left: 40, top: -20, scaleX: 2, scaleY: 1 },
  );
  assert.deepEqual(
    getOverlayCompensation({ left: 0, top: 0, width: 100, height: 100 }, 100),
    { left: 0, top: 0, scaleX: 1, scaleY: 1 },
  );
});

test('maps a viewport rect into a scaled overlay container', () => {
  const compensation = { left: 40, top: -20, scaleX: 2, scaleY: 2 };

  assert.deepEqual(
    getCompensatedOverlayRect({ left: 140, top: 80, width: 300, height: 200 }, compensation),
    { left: 50, top: 50, width: 150, height: 100 },
  );
  assert.deepEqual(getCompensatedOverlayPoint({ left: 140, top: 80 }, compensation), { left: 50, top: 50 });
});

test('keeps overlay text at its designed size inside a zoomed page', () => {
  assert.equal(getCompensatedOverlayScaleTransform({ scaleX: 1, scaleY: 1 }), '');
  assert.equal(getCompensatedOverlayScaleTransform({ scaleX: 2, scaleY: 0.5 }), 'scale(0.5, 2)');
});

test('resets positioning inherited from ancestors on the export clone root', () => {
  const style = getExportRootResetStyle();

  // Stays relative so absolutely positioned children keep their containing block.
  assert.equal(style.position, 'relative');
  assert.equal(style.transform, 'none');
  assert.equal(style.top, 'auto');
  assert.equal(style.left, 'auto');
  assert.equal(style.margin, '0');
  assert.equal(style.float, 'none');
});

test('converts camelCase style keys before calling setProperty', () => {
  assert.equal(toCssPropertyName('maxWidth'), 'max-width');
  assert.equal(toCssPropertyName('overflowX'), 'overflow-x');
  assert.equal(toCssPropertyName('position'), 'position');
});

test('writes expanded scroll styles onto a clone using valid css names', () => {
  const applied = [];
  const target = {
    style: {
      setProperty(property, value, priority) {
        applied.push({ property, value, priority });
      },
    },
  };

  applyStyleProperties(target, { maxWidth: 'none', overflowX: 'visible' }, 'important');

  assert.deepEqual(applied, [
    { property: 'max-width', value: 'none', priority: 'important' },
    { property: 'overflow-x', value: 'visible', priority: 'important' },
  ]);
});

test('builds a selector that steps into a shadow root', () => {
  const body = { nodeType: 1, tagName: 'BODY' };
  const host = {
    nodeType: 1, tagName: 'MY-CARD', classList: [], getAttribute: () => null, parentElement: body,
  };
  const shadowRoot = { host };
  const title = {
    nodeType: 1, tagName: 'H2', classList: ['title'], getAttribute: () => null,
    parentElement: null, getRootNode: () => shadowRoot,
  };

  assert.equal(selectorForElement(title), 'my-card >>> h2.title');
});

test('resolves a shadow-scoped selector step by step', () => {
  const inner = { id: 'inner' };
  const host = {
    id: 'host',
    shadowRoot: { querySelector: (scope) => (scope === 'div.card' ? inner : null) },
  };
  const root = { querySelector: (scope) => (scope === 'my-card' ? host : null) };

  assert.equal(querySelectorDeep('my-card >>> div.card', root), inner);
  assert.equal(querySelectorDeep('missing >>> div.card', root), null);
  assert.equal(querySelectorDeep('', root), null);
});
