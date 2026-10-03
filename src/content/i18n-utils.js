(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SuperContentExportI18n = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const BUILT_IN_MESSAGES = {
    zh_CN: {
      regionPrompt: '拖动鼠标框选区域 · 松开后复制 MD、导出 MD 或 PNG · Esc 取消',
      regionRetry: '重新框选',
      markdownEmpty: '没有可导出的网页内容',
      exportToolbarTitle: '已选择元素',
      exportCopyMarkdown: '复制 Markdown',
      exportDownloadMarkdown: '下载 Markdown',
      exportPng: '导出 PNG',
      exportCancel: '取消',
      exportCopySuccess: 'Markdown 已复制',
      exportDownloadSuccess: 'Markdown 文件已下载',
      exportPngSuccess: 'PNG 图片已下载',
      exportPngLoading: '正在生成 PNG，请稍候…',
      exportEmpty: '选中的元素没有可导出的内容',
      exportFailed: '导出失败，请重试',
      selectionFocused: '已定位到当前容器',
      selectionNotFound: '当前页面找不到该容器',
      pickPrompt: '请点击目标元素  ·  滚轮扩大选区  ·  Esc 取消',
      pickCancel: '已取消',
    },
    en: {
      regionPrompt: 'Drag to select · Release to copy MD or export MD / PNG · Esc to cancel',
      regionRetry: 'Select again',
      markdownEmpty: 'No webpage content to export',
      exportToolbarTitle: 'Element selected',
      exportCopyMarkdown: 'Copy Markdown',
      exportDownloadMarkdown: 'Download Markdown',
      exportPng: 'Export PNG',
      exportCancel: 'Cancel',
      exportCopySuccess: 'Markdown copied',
      exportDownloadSuccess: 'Markdown downloaded',
      exportPngSuccess: 'PNG downloaded',
      exportPngLoading: 'Generating PNG, please wait…',
      exportEmpty: 'The selected element has no exportable content',
      exportFailed: 'Export failed. Please try again.',
      selectionFocused: 'Located the selected container',
      selectionNotFound: 'The selected container was not found on this page',
      pickPrompt: 'Click target  ·  Scroll to expand  ·  Esc to cancel',
      pickCancel: 'Cancelled',
    },
  };

  function substitute(value, substitution) {
    return substitution === undefined
      ? value
      : value.replace(/\$[A-Z_]+\$/g, String(substitution));
  }

  function resolveMessage(key, substitution, chromeApi, messages, locale) {
    const explicitMessage = messages?.[key]?.message;
    if (explicitMessage) return substitute(explicitMessage, substitution);

    const builtInLocale = String(locale || '').toLowerCase().startsWith('zh') ? 'zh_CN' : 'en';
    const builtInMessage = BUILT_IN_MESSAGES[builtInLocale][key];
    if (builtInMessage) return substitute(builtInMessage, substitution);

    try {
      const nativeMessage = chromeApi?.i18n?.getMessage?.(
        key,
        substitution === undefined ? undefined : substitution,
      );
      if (nativeMessage) return nativeMessage;
    } catch {
      // Fall through to the explicitly loaded locale file.
    }

    return substitute(key, substitution);
  }

  return { resolveMessage };
});
