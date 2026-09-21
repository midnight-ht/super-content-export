const test = require('node:test');
const assert = require('node:assert/strict');

const { copyText } = require('../src/content/clipboard-utils.js');

test('falls back to a textarea when the async clipboard API rejects', async () => {
  let copiedValue = '';
  const textarea = {
    value: '',
    style: {},
    focus() {},
    select() {},
    remove() {},
  };
  const documentApi = {
    createElement() { return textarea; },
    body: {
      appendChild() {},
    },
    execCommand(command) {
      assert.equal(command, 'copy');
      copiedValue = textarea.value;
      return true;
    },
  };

  await copyText('## selected content', {
    navigator: { clipboard: { writeText: async () => { throw new Error('NotAllowedError'); } } },
    document: documentApi,
  });

  assert.equal(copiedValue, '## selected content');
});
