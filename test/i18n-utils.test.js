const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveMessage } = require('../src/content/i18n-utils.js');

test('uses the extension i18n message when the locale fetch has no data', () => {
  const chromeApi = {
    i18n: {
      getMessage(key, substitutions) {
        assert.equal(key, 'exportPng');
        assert.deepEqual(substitutions, undefined);
        return 'Export PNG';
      },
    },
  };

  assert.equal(resolveMessage('exportPng', undefined, chromeApi, {}), 'Export PNG');
});

test('falls back to fetched messages and substitutions when native i18n is unavailable', () => {
  const messages = { exportFailed: { message: 'Failed: $DETAIL$' } };
  assert.equal(resolveMessage('exportFailed', 'network', {}, messages), 'Failed: network');
});

test('uses built-in Chinese content copy when extension resources are invalid', () => {
  assert.equal(resolveMessage('exportFailed', undefined, {}, {}, 'zh_CN'), '导出失败，请重试');
});
