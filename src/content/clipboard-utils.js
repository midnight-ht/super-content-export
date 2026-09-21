(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SuperContentExportClipboard = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  async function copyText(text, environment = {}) {
    const navigatorApi = environment.navigator
      || (typeof navigator !== 'undefined' ? navigator : null);
    const documentApi = environment.document
      || (typeof document !== 'undefined' ? document : null);

    try {
      if (navigatorApi?.clipboard?.writeText) {
        await navigatorApi.clipboard.writeText(text);
        return;
      }
    } catch {
      // Fall through to the textarea copy path when page permissions reject it.
    }

    if (!documentApi?.createElement || !documentApi.body?.appendChild) {
      throw new Error('Clipboard unavailable');
    }
    const textarea = documentApi.createElement('textarea');
    textarea.value = text;
    textarea.style.cssText = 'position:fixed;left:-9999px;top:0';
    documentApi.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const copied = documentApi.execCommand?.('copy');
    textarea.remove();
    if (!copied) throw new Error('Clipboard unavailable');
  }

  return { copyText };
});
