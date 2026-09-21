let pickMode = false;
let pickHighlight = null;
let pickChain = [];
let pickIndex = 0;
let exportTarget = null;
let exportTargetUrl = "";
let exportToolbar = null;
let exportLoading = null;
let exportBusy = false;
let lastVisibleCaptureAt = 0;
let restoreViewportOverlays = null;
let uiMessages = {};
let uiLang = "en";
let observedPageUrl = "";

const VISIBLE_CAPTURE_INTERVAL_MS = 550;
const PICK_HIGHLIGHT_ID = "__SuperContentExport_pick_highlight__";
const EXPORT_TOOLBAR_ID = "__SuperContentExport_exporttoolbar__";
const EXPORT_LOADING_ID = "__SuperContentExport_exportloading__";

function msg(key, substitution) {
  return window.SuperContentExportI18n?.resolveMessage(key, substitution, chrome, uiMessages, uiLang)
    || uiMessages[key]?.message
    || key;
}

async function loadUIMessages() {
  try {
    uiLang = chrome.i18n?.getUILanguage?.() || navigator.language || "en";
    const locale = String(uiLang).toLowerCase().startsWith("zh") ? "zh_CN" : "en";
    const url = chrome.runtime.getURL(`_locales/${locale}/messages.json`);
    if (!url || /^chrome-extension:\/\/invalid(?:\/|$)/.test(url)) return;
    const response = await fetch(url);
    if (response.ok) uiMessages = await response.json();
  } catch {
    uiMessages = {};
  }
}

function showPageToast(text) {
  document.getElementById("__SuperContentExport_toast__")?.remove();
  const toast = document.createElement("div");
  toast.id = "__SuperContentExport_toast__";
  toast.textContent = text;
  toast.style.cssText = [
    "position:fixed", "left:50%", "bottom:24px", "transform:translateX(-50%)",
    "z-index:2147483647", "padding:10px 16px", "border-radius:8px",
    "background:#111827", "color:#fff", "font:13px/1.4 system-ui,sans-serif",
    "box-shadow:0 8px 24px rgba(0,0,0,.28)", "pointer-events:none",
  ].join(";");
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2400);
}

function exportFileBaseName() {
  const base = String(document.title || "super-content-export")
    .trim()
    .replace(/[^\p{L}\p{N}_-]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return base || "super-content-export";
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function copyText(text) {
  return window.SuperContentExportClipboard.copyText(text);
}

async function ensureExportTarget() {
  if (exportTarget && document.contains(exportTarget) && exportTargetUrl === location.href) return true;
  if (exportTarget && exportTargetUrl !== location.href) cleanupPicker();
  const result = await chrome.storage.local.get("exportSelection");
  const selection = result.exportSelection;
  if (!window.SuperContentExport?.isSelectionForUrl?.(selection, location.href)) {
    if (selection) await chrome.storage.local.remove("exportSelection");
    exportTarget = null;
    return false;
  }
  const selector = selection.selector;
  if (!selector) return false;
  try {
    exportTarget = document.querySelector(selector);
  } catch {
    exportTarget = null;
  }
  return Boolean(exportTarget);
}

function selectedMarkdown() {
  return window.SuperContentExport?.elementToMarkdown(exportTarget) || "";
}

function positionExportToolbar() {
  if (!exportToolbar || !exportTarget) return;
  const position = window.SuperContentExport?.getExportToolbarPosition?.(
    exportTarget.getBoundingClientRect(),
    { width: exportToolbar.offsetWidth, height: exportToolbar.offsetHeight },
    { width: window.innerWidth, height: window.innerHeight },
  );
  if (!position) return;
  exportToolbar.style.left = `${position.left}px`;
  exportToolbar.style.top = `${position.top}px`;
  exportToolbar.style.transform = "none";
}

function onExportViewportChange() {
  positionExportToolbar();
}

function selectorFor(element) {
  if (!element || element.nodeType !== 1) return "";
  if (element.id) return `#${CSS.escape(element.id)}`;
  const parts = [];
  let current = element;
  while (current && current.nodeType === 1 && current !== document.body && parts.length < 5) {
    let part = current.tagName.toLowerCase();
    if (current.classList?.length) part += `.${Array.from(current.classList).slice(0, 2).map(CSS.escape).join(".")}`;
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter((child) => child.tagName === current.tagName);
      if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
    }
    parts.unshift(part);
    current = parent;
  }
  return parts.join(" > ");
}

function setExportBusy(busy) {
  exportBusy = busy;
  exportToolbar?.querySelectorAll("button").forEach((button) => {
    button.disabled = busy;
    button.style.opacity = busy ? "0.55" : "1";
    button.style.cursor = busy ? "wait" : "pointer";
  });
}

function showExportLoading() {
  if (exportLoading) return;
  exportLoading = document.createElement("div");
  exportLoading.id = EXPORT_LOADING_ID;
  exportLoading.setAttribute("role", "status");
  exportLoading.setAttribute("aria-live", "polite");
  exportLoading.style.cssText = [
    "position:fixed", "inset:0", "z-index:2147483646", "display:flex",
    "align-items:center", "justify-content:center", "background:rgba(17,24,39,.48)",
    "cursor:wait", "font:14px/1.4 system-ui,sans-serif",
  ].join(";");
  const panel = document.createElement("div");
  panel.style.cssText = [
    "display:flex", "align-items:center", "gap:12px", "padding:16px 20px",
    "border-radius:12px", "background:#111827", "color:#fff",
    "box-shadow:0 12px 40px rgba(0,0,0,.35)",
  ].join(";");
  const spinner = document.createElement("span");
  spinner.textContent = "⏳";
  spinner.setAttribute("aria-hidden", "true");
  spinner.style.cssText = "font-size:22px;line-height:1";
  const label = document.createElement("span");
  label.textContent = msg("exportPngLoading");
  label.style.whiteSpace = "nowrap";
  panel.append(spinner, label);
  exportLoading.appendChild(panel);
  document.body.appendChild(exportLoading);
}

function hideExportLoading() {
  exportLoading?.remove();
  exportLoading = null;
}

function waitForPaint(frames = 1) {
  if (frames <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    const next = () => {
      if (frames <= 1) return resolve();
      frames -= 1;
      if (typeof requestAnimationFrame === "function") requestAnimationFrame(next);
      else setTimeout(next, 16);
    };
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(next);
    else setTimeout(next, 16);
  });
}

function waitForCaptureSlot() {
  const delay = window.SuperContentExport?.getVisibleCaptureDelay(
    lastVisibleCaptureAt,
    Date.now(),
    VISIBLE_CAPTURE_INTERVAL_MS,
  ) ?? VISIBLE_CAPTURE_INTERVAL_MS;
  return delay > 0 ? new Promise((resolve) => setTimeout(resolve, delay)) : Promise.resolve();
}

function isCaptureRateLimitError(error) {
  return /MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND|too often|rate limit/i.test(
    String(error?.message || error || ""),
  );
}

function requestVisibleTabCapture() {
  lastVisibleCaptureAt = Date.now();
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: "SCE_CAPTURE_VISIBLE_TAB" }, (response) => {
      const error = chrome.runtime.lastError;
      if (error) return reject(new Error(error.message));
      if (!response?.ok || !response.dataUrl) {
        return reject(new Error(response?.error || "Visible capture failed"));
      }
      resolve(response.dataUrl);
    });
  });
}

function beginViewportCaptureSession() {
  if (restoreViewportOverlays) return;
  const hidden = [];
  document.querySelectorAll("*").forEach((node) => {
    if (!node || node.nodeType !== 1) return;
    if (node.id === EXPORT_TOOLBAR_ID || node.id === EXPORT_LOADING_ID) return;
    if (exportTarget && !window.SuperContentExport?.shouldHideViewportOverlay?.(node, exportTarget)) return;
    const position = getComputedStyle(node).position;
    if (position !== "fixed" && position !== "sticky") return;
    hidden.push({ node, style: node.getAttribute("style") });
    node.style.setProperty("visibility", "hidden", "important");
  });
  restoreViewportOverlays = () => {
    hidden.forEach(({ node, style }) => {
      if (style === null) node.removeAttribute("style");
      else node.setAttribute("style", style);
    });
    restoreViewportOverlays = null;
  };
}

function endViewportCaptureSession() {
  restoreViewportOverlays?.();
}

async function captureVisibleTabForExport() {
  await waitForCaptureSlot();
  beginViewportCaptureSession();
  const restoreLoading = !!exportLoading;
  const toolbarDisplay = exportToolbar?.style.display;
  const toolbarVisibility = exportToolbar?.style.visibility;
  if (exportToolbar) {
    exportToolbar.style.setProperty("display", "none", "important");
    exportToolbar.style.visibility = "hidden";
  }
  if (restoreLoading) hideExportLoading();
  await waitForPaint(2);
  try {
    try {
      return await requestVisibleTabCapture();
    } catch (error) {
      if (!isCaptureRateLimitError(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, VISIBLE_CAPTURE_INTERVAL_MS));
      await waitForPaint(2);
      return requestVisibleTabCapture();
    }
  } finally {
    if (exportToolbar) {
      if (toolbarDisplay) exportToolbar.style.display = toolbarDisplay;
      else exportToolbar.style.removeProperty("display");
      exportToolbar.style.visibility = toolbarVisibility || "";
    }
    if (restoreLoading) {
      showExportLoading();
      await waitForPaint();
    }
  }
}

async function runExportAction(action) {
  if (!(await ensureExportTarget())) return showPageToast(msg("exportEmpty"));
  if (exportBusy) return;
  let loadingStarted = false;
  try {
    if (action === "copy") {
      const markdown = selectedMarkdown();
      if (!markdown) return showPageToast(msg("exportEmpty"));
      await copyText(markdown);
      cleanupAfterSuccessfulExport(action);
      return showPageToast(msg("exportCopySuccess"));
    }
    if (action === "markdown") {
      const markdown = selectedMarkdown();
      if (!markdown) return showPageToast(msg("exportEmpty"));
      downloadBlob(new Blob([`${markdown}\n`], { type: "text/markdown;charset=utf-8" }), `${exportFileBaseName()}.md`);
      cleanupAfterSuccessfulExport(action);
      return showPageToast(msg("exportDownloadSuccess"));
    }
    if (action !== "png") return;
    setExportBusy(true);
    loadingStarted = true;
    showExportLoading();
    await waitForPaint();
    const png = await window.SuperContentExport?.renderElementToPng(exportTarget, {
      captureVisibleTab: captureVisibleTabForExport,
    });
    if (!png) throw new Error("PNG renderer unavailable");
    downloadBlob(png, `${exportFileBaseName()}.png`);
    cleanupAfterSuccessfulExport(action);
    showPageToast(msg("exportPngSuccess"));
  } catch (error) {
    console.error(`[SuperContentExport] ${action} export failed`, error);
    showPageToast(msg("exportFailed"));
  } finally {
    if (loadingStarted) {
      endViewportCaptureSession();
      hideExportLoading();
      setExportBusy(false);
    }
  }
}

function buttonStyle(background) {
  return [
    "border:0", "border-radius:7px", "padding:7px 10px", "color:#fff",
    `background:${background}`, "font:600 12px/1.2 system-ui,sans-serif",
    "cursor:pointer", "white-space:nowrap",
  ].join(";");
}

function showExportToolbar(element) {
  cleanupPicker();
  exportTarget = element;
  exportTargetUrl = location.href;
  chrome.storage.local.set({
    exportSelection: {
      selector: selectorFor(element),
      text: (element.innerText || element.textContent || "").trim().slice(0, 160),
      url: location.href,
    },
  }).catch(() => {});

  exportToolbar = document.createElement("div");
  exportToolbar.id = EXPORT_TOOLBAR_ID;
  exportToolbar.style.cssText = [
    "position:fixed", "top:0", "left:0", "transform:none",
    "z-index:2147483647", "display:flex", "gap:6px", "align-items:center",
    "background:#111827", "color:#fff", "padding:8px 10px", "border-radius:10px",
    "font:13px/1 system-ui,sans-serif", "box-shadow:0 6px 24px rgba(0,0,0,.35)",
    "max-width:calc(100vw - 24px)", "overflow:auto",
  ].join(";");
  const title = document.createElement("span");
  title.textContent = msg("exportToolbarTitle");
  title.style.cssText = "margin:0 4px 0 2px;white-space:nowrap;font-weight:600";
  exportToolbar.appendChild(title);
  const addButton = (action, label, color) => {
    const button = document.createElement("button");
    button.textContent = msg(label);
    button.style.cssText = buttonStyle(color);
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      runExportAction(action);
    });
    exportToolbar.appendChild(button);
  };
  addButton("copy", "exportCopyMarkdown", "#2563eb");
  addButton("markdown", "exportDownloadMarkdown", "#0891b2");
  addButton("png", "exportPng", "#7c3aed");
  const cancel = document.createElement("button");
  cancel.textContent = msg("exportCancel");
  cancel.style.cssText = buttonStyle("#4b5563");
  cancel.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    cleanupPicker();
    chrome.storage.local.remove("exportSelection").catch(() => {});
    showPageToast(msg("pickCancel"));
  });
  exportToolbar.appendChild(cancel);
  document.body.appendChild(exportToolbar);
  positionExportToolbar();
  window.addEventListener("resize", onExportViewportChange);
}

function clearPickerInteraction() {
  pickMode = false;
  pickChain = [];
  pickIndex = 0;
  document.body.style.cursor = "";
  pickHighlight?.remove();
  pickHighlight = null;
  document.removeEventListener("mousemove", onPickMouseMove, true);
  document.removeEventListener("wheel", onPickWheel, true);
  document.removeEventListener("click", onPickClick, true);
  document.removeEventListener("keydown", onPickKeyDown, true);
}

function cleanupAfterSuccessfulExport(action) {
  const cleanup = window.SuperContentExport?.getSuccessfulExportCleanup?.(action, true);
  if (cleanup?.removeToolbar) cleanupPicker();
}

function cleanupPicker() {
  clearPickerInteraction();
  exportToolbar?.remove();
  exportToolbar = null;
  exportTarget = null;
  exportTargetUrl = "";
  window.removeEventListener("resize", onExportViewportChange);
  endViewportCaptureSession();
  hideExportLoading();
  exportBusy = false;
}

function brieflyHighlightTarget(element) {
  const originalOutline = element.style.outline;
  const originalOutlineOffset = element.style.outlineOffset;
  element.style.setProperty("outline", "3px solid #2563eb", "important");
  element.style.setProperty("outline-offset", "3px", "important");
  setTimeout(() => {
    element.style.outline = originalOutline;
    element.style.outlineOffset = originalOutlineOffset;
  }, 1800);
}

async function focusStoredSelection() {
  if (!(await ensureExportTarget())) {
    showPageToast(msg("selectionNotFound"));
    return { ok: false, error: "Selection not found" };
  }
  exportTarget.scrollIntoView?.({ behavior: "smooth", block: "center", inline: "nearest" });
  brieflyHighlightTarget(exportTarget);
  showPageToast(msg("selectionFocused"));
  return { ok: true };
}

function currentPickElement() {
  return pickChain[pickIndex] || null;
}

function ensurePickHighlight() {
  if (pickHighlight) return pickHighlight;
  pickHighlight = document.createElement("div");
  pickHighlight.id = PICK_HIGHLIGHT_ID;
  pickHighlight.style.cssText = "position:fixed;pointer-events:none;z-index:2147483645;border:2px solid #2563eb;background:rgba(37,99,235,.08);border-radius:3px";
  document.body.appendChild(pickHighlight);
  return pickHighlight;
}

function updatePickHighlight(element) {
  if (!element) return;
  const rect = element.getBoundingClientRect();
  Object.assign(ensurePickHighlight().style, {
    left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`,
  });
}

function shiftCurrentPick(delta) {
  pickIndex = window.SuperContentExport?.shiftPickIndex?.(pickIndex, delta, pickChain.length) ?? pickIndex;
  updatePickHighlight(currentPickElement());
}

function onPickMouseMove(event) {
  if (!pickMode || event.target === pickHighlight || event.target.closest?.(`#${EXPORT_TOOLBAR_ID}`)) return;
  if (window.SuperContentExport?.shouldKeepExpandedPick?.(event.target, currentPickElement())) {
    updatePickHighlight(currentPickElement());
    return;
  }
  pickChain = window.SuperContentExport?.getPickChain?.(event.target, document.body) || [event.target];
  pickIndex = 0;
  updatePickHighlight(currentPickElement());
}

function onPickWheel(event) {
  if (!pickMode || !pickChain.length) return;
  event.preventDefault();
  event.stopPropagation();
  const delta = window.SuperContentExport?.pickIndexDeltaFromWheel?.(event.deltaY) || 0;
  if (delta) shiftCurrentPick(delta);
}

function onPickClick(event) {
  if (!pickMode || event.button !== 0) return;
  if (event.target.closest?.(`#${EXPORT_TOOLBAR_ID}`)) return;
  event.preventDefault();
  event.stopPropagation();
  showExportToolbar(currentPickElement() || event.target);
}

function onPickKeyDown(event) {
  if (event.key === "ArrowUp") {
    event.preventDefault();
    shiftCurrentPick(1);
    return;
  }
  if (event.key === "ArrowDown") {
    event.preventDefault();
    shiftCurrentPick(-1);
    return;
  }
  if (event.key !== "Escape") return;
  cleanupPicker();
  chrome.storage.local.remove("exportSelection").catch(() => {});
  showPageToast(msg("pickCancel"));
}

function startPicker() {
  cleanupPicker();
  pickMode = true;
  pickChain = [];
  pickIndex = 0;
  document.body.style.cursor = "crosshair";
  document.addEventListener("mousemove", onPickMouseMove, true);
  document.addEventListener("wheel", onPickWheel, { capture: true, passive: false });
  document.addEventListener("click", onPickClick, true);
  document.addEventListener("keydown", onPickKeyDown, true);
  showPageToast(msg("pickPrompt"));
}

async function clearSelectionIfPageChanged() {
  const currentUrl = location.href;
  if (currentUrl === observedPageUrl) return;
  observedPageUrl = currentUrl;
  cleanupPicker();
  const result = await chrome.storage.local.get("exportSelection");
  const selection = result.exportSelection;
  if (selection && !window.SuperContentExport?.isSelectionForUrl?.(selection, currentUrl)) {
    await chrome.storage.local.remove("exportSelection");
  }
}

function watchPageUrlChanges() {
  for (const method of ["pushState", "replaceState"]) {
    const original = window.history[method];
    if (typeof original !== "function") continue;
    window.history[method] = function (...args) {
      const result = original.apply(this, args);
      clearSelectionIfPageChanged().catch(() => {});
      return result;
    };
  }
  window.addEventListener("popstate", () => clearSelectionIfPageChanged().catch(() => {}));
  window.addEventListener("hashchange", () => clearSelectionIfPageChanged().catch(() => {}));
}

window.__SuperContentExportMessageHandler = async (message) => {
  if (message?.type === "SCE_PICK_START") {
    startPicker();
    return { ok: true };
  }
  if (message?.type === "SCE_EXPORT_ACTION") {
    await runExportAction(message.action);
    return { ok: true };
  }
  if (message?.type === "SCE_FOCUS_SELECTION") return focusStoredSelection();
  return { ok: false };
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  Promise.resolve(window.__SuperContentExportMessageHandler(message))
    .then((response) => sendResponse(response || { ok: true }))
    .catch((error) => sendResponse({ ok: false, error: error.message || "Request failed" }));
  return true;
});

loadUIMessages();
clearSelectionIfPageChanged().catch(() => {});
watchPageUrlChanges();
