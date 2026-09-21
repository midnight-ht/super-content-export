chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "SCE_CAPTURE_VISIBLE_TAB") return;
  const windowId = sender.tab?.windowId;
  if (windowId === undefined || !chrome.tabs?.captureVisibleTab) {
    sendResponse({ ok: false, error: "Visible capture unavailable" });
    return;
  }

  chrome.tabs.captureVisibleTab(windowId, { format: "png" }, (dataUrl) => {
    const error = chrome.runtime.lastError;
    if (error || !dataUrl) {
      sendResponse({ ok: false, error: error?.message || "Visible capture failed" });
      return;
    }
    sendResponse({ ok: true, dataUrl });
  });
  return true;
});
