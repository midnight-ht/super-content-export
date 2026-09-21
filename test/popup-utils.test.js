const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeLocale,
  nextLocale,
  messageFromLocale,
  hasSelection,
  selectionMatchesUrl,
} = require('../src/popup/popup-utils.js');

test('switches between Chinese and English popup locales', () => {
  assert.equal(normalizeLocale('zh-CN'), 'zh_CN');
  assert.equal(normalizeLocale('en-US'), 'en');
  assert.equal(nextLocale('zh_CN'), 'en');
  assert.equal(nextLocale('en'), 'zh_CN');
});

test('reads popup messages and recognizes stored selections', () => {
  assert.equal(messageFromLocale({ pickBtn: { message: '选择元素' } }, 'pickBtn', 'Select'), '选择元素');
  assert.equal(messageFromLocale({}, 'missing', 'Fallback'), 'Fallback');
  assert.equal(hasSelection({ selector: '#article' }), true);
  assert.equal(hasSelection({ text: 'Content' }), true);
  assert.equal(hasSelection({}), false);
});

test('recognizes when a popup selection belongs to the active page URL', () => {
  const selection = { selector: '#content', text: 'Content', url: 'https://example.com/docs' };

  assert.equal(selectionMatchesUrl(selection, 'https://example.com/docs'), true);
  assert.equal(selectionMatchesUrl(selection, 'https://example.com/other'), false);
  assert.equal(selectionMatchesUrl({ selector: '#content' }, 'https://example.com/docs'), false);
});
