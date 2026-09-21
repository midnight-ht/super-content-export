(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SuperContentExportPopupUtils = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function normalizeLocale(locale) {
    return String(locale || '').toLowerCase().startsWith('zh') ? 'zh_CN' : 'en';
  }

  function nextLocale(locale) {
    return normalizeLocale(locale) === 'zh_CN' ? 'en' : 'zh_CN';
  }

  function messageFromLocale(messages, key, fallback) {
    const entry = messages?.[key];
    return entry?.message || entry || fallback;
  }

  function hasSelection(selection) {
    return Boolean(selection?.text || selection?.selector);
  }

  function selectionMatchesUrl(selection, currentUrl) {
    return Boolean(selection?.url && currentUrl && String(selection.url) === String(currentUrl));
  }

  return {
    normalizeLocale,
    nextLocale,
    messageFromLocale,
    hasSelection,
    selectionMatchesUrl,
  };
});
