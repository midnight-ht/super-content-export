const test = require('node:test');
const assert = require('node:assert/strict');
const { cloneMarkdownContent } = require('../src/content/region-utils.js');
const { elementToMarkdown } = require('../src/content/export-utils.js');

const box = (left, top, width = 10, height = 10) => ({ left, top, right: left + width, bottom: top + height, width, height });
function node(tag, children = [], attrs = {}, rect = box(0, 0)) {
  const result = { nodeType: 1, tagName: tag.toUpperCase(), childNodes: children, attrs: { ...attrs }, rect,
    getAttribute(key) { return this.attrs[key] ?? null; },
    setAttribute(key, value) { this.attrs[key] = value; },
    getClientRects() { return [this.rect]; },
    getBoundingClientRect() { return this.rect; },
    cloneNode() { return node(tag, [], this.attrs, this.rect); },
    appendChild(child) { this.childNodes.push(child); child.parentElement = this; },
    get textContent() { return this.childNodes.map(child => child.textContent).join(''); },
  };
  children.forEach(child => { child.parentElement = result; });
  return result;
}
function text(value, left = 0, top = 0) {
  return { nodeType: 3, nodeValue: value, textContent: value, left, top };
}
const documentStub = {
  baseURI: 'https://example.com/articles/page',
  createTextNode: value => text(value),
  createRange() {
    let current, start, end;
    return { selectNodeContents(value) { current = value; start = 0; end = value.nodeValue.length; },
      setStart(value, index) { current = value; start = index; }, setEnd(value, index) { end = index; },
      getClientRects() { return [box(current.left + start * 10, current.top, (end - start) * 10)]; } };
  },
};
const options = { document: documentStub, styleResolver: value => value.attrs?.hidden ? { display: 'none' } : {} };

test('region Markdown retains structure without including other content in the same parent', () => {
  const root = node('main', [node('h2', [text('Title')]), node('p', [text('Outside', 0, 80)]),
    node('p', [node('strong', [text('Bold', 0, 20)]), node('a', [text('Link', 50, 20)], { href: '/guide' })])]);
  const clone = cloneMarkdownContent(root, { ...options, rect: box(0, 0, 100, 40) });
  assert.equal(elementToMarkdown(clone), '## Title\n\n**Bold**[Link](https://example.com/guide)');
  assert.equal(root.childNodes[1].textContent, 'Outside');
});
test('region Markdown clips partial text at character boundaries', () => {
  const root = node('p', [text('ABCDE')]);
  assert.equal(elementToMarkdown(cloneMarkdownContent(root, { ...options, rect: box(10, 0, 20, 10) })), 'BC');
});
test('full page Markdown includes offscreen content and skips hidden, scripts and extension overlays', () => {
  const root = node('body', [node('h1', [text('Page')]), node('p', [text('Below', 0, 2000)]),
    node('p', [text('Secret')], { hidden: 'hidden' }), node('script', [text('code')]),
    node('div', [text('Extension UI')], { id: '__SuperContentExport_overlay_root__' }),
    node('img', [], { src: '../photo.png', alt: 'Photo' })]);
  const result = elementToMarkdown(cloneMarkdownContent(root, options));
  assert.equal(result, '# Page\n\nBelow\n\n![Photo](https://example.com/photo.png)');
});
test('an empty region returns no content instead of exporting a whole ancestor', () => {
  assert.equal(cloneMarkdownContent(node('p', [text('Outside', 0, 80)]), { ...options, rect: box(0, 0, 100, 10) }), null);
});

test('region Markdown keeps explicit line breaks', () => {
  const root = node('p', [text('One'), node('br', [], {}, box(30, 0, 0, 10)), text('Two', 0, 15)]);
  assert.equal(elementToMarkdown(cloneMarkdownContent(root, { ...options, rect: box(0, 0, 80, 30) })), 'One\nTwo');
});

test('partial tables keep selected content in its original column', () => {
  const root = node('table', [node('tr', [node('td', [text('Left')]), node('td', [text('Right', 100)])])]);
  assert.equal(elementToMarkdown(cloneMarkdownContent(root, { ...options, rect: box(100, 0, 60, 10) })), '|  | Right |\n| --- | --- |');
});

test('region Markdown excludes text clipped by an internal scroll container', () => {
  const root = node('div', [text('Shown'), text('Clipped', 0, 40)], {}, box(0, 0, 100, 20));
  const clone = cloneMarkdownContent(root, { ...options, rect: box(0, 0, 100, 100),
    styleResolver: () => ({ overflowY: 'auto' }) });
  assert.equal(elementToMarkdown(clone), 'Shown');
});

test('Markdown reads assigned slot content once inside open shadow roots', () => {
  const light = text('Slotted');
  const slot = node('slot');
  slot.assignedNodes = () => [light];
  const root = node('custom-panel', [light]);
  root.shadowRoot = { childNodes: [slot] };
  assert.equal(elementToMarkdown(cloneMarkdownContent(root, options)), 'Slotted');
});
