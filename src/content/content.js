let pickMode = false;
let pickHighlight = null;
let pickBadge = null;
let pickChain = [];
let pickIndex = 0;
let pickAnchor = null;
let overlayRoot = null;
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
let regionSession = null;

function clearRegion() {
  if (!regionSession) return;
  regionSession.controller.abort();
  regionSession.surface.remove();
  regionSession.toolbar?.remove();
  regionSession = null;
}

function startRegionPicker() {
  if (exportBusy) return;
  cleanupPicker();
  const controller = new AbortController();
  const surface = document.createElement('div');
  surface.style.cssText = 'position:fixed;inset:0;pointer-events:auto;cursor:crosshair;touch-action:none;';
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;pointer-events:none;border:2px solid #2563eb;box-shadow:0 0 0 100vmax rgba(15,23,42,.35);';
  box.style.display = 'none';
  const dimensions = document.createElement('span');
  dimensions.style.cssText = 'position:absolute;left:0;top:0;padding:4px 6px;background:#111827;color:white;font:12px system-ui;white-space:nowrap;';
  box.appendChild(dimensions);
  surface.appendChild(box);
  appendOverlay(surface);
  placeOverlayOverRect(surface, { left: 0, top: 0, width: innerWidth, height: innerHeight });
  const session = regionSession = { controller, surface, box, rect: null, start: null, toolbar: null };
  const options = { signal: controller.signal };
  surface.addEventListener('pointerdown', event => {
    if (event.button !== 0 || session.toolbar) return;
    event.preventDefault();
    session.start = { x: event.clientX, y: event.clientY };
    surface.setPointerCapture(event.pointerId);
  }, options);
  const update = event => {
    if (!session.start || session.toolbar) return;
    invalidateOverlayCompensation();
    session.rect = window.SuperContentExportRegion.selectionRect(session.start,
      { x: event.clientX, y: event.clientY }, { width: innerWidth, height: innerHeight });
    box.style.display = session.rect ? 'block' : 'none';
    if (session.rect) {
      placeOverlayOverRect(box, session.rect);
      dimensions.textContent = `${Math.round(session.rect.width)} × ${Math.round(session.rect.height)}`;
    }
  };
  surface.addEventListener('pointermove', update, options);
  surface.addEventListener('pointerup', event => {
    if (!session.start || session.toolbar) return;
    update(event);
    session.start = null;
    if (!session.rect) return;
    const toolbar = session.toolbar = document.createElement('div');
    toolbar.style.cssText = 'position:fixed;display:flex;gap:6px;align-items:center;padding:8px;background:#111827;color:white;border-radius:10px;font:13px system-ui;pointer-events:auto;max-width:calc(100vw - 16px);overflow:auto;';
    const label = document.createElement('span');
    label.textContent = `${Math.round(session.rect.width)} × ${Math.round(session.rect.height)}`;
    toolbar.appendChild(label);
    for (const [key, callback] of [
      ['exportCopyMarkdown', () => exportRegionMarkdown(session, 'copy')],
      ['exportDownloadMarkdown', () => exportRegionMarkdown(session, 'markdown')],
      ['exportPng', () => exportRegion(session)],
      ['regionRetry', startRegionPicker], ['exportCancel', () => cleanupPicker()],
    ]) {
      const button = document.createElement('button');
      button.textContent = msg(key);
      button.style.cssText = buttonStyle(key === 'exportPng' ? '#7c3aed' : key.includes('Markdown') ? '#0f766e' : '#4b5563');
      button.addEventListener('click', callback);
      toolbar.appendChild(button);
    }
    appendOverlay(toolbar);
    placeOverlayAtViewport(toolbar, Math.max(8, Math.min(session.rect.left, innerWidth - toolbar.offsetWidth - 8)),
      Math.max(8, Math.min(session.rect.top + session.rect.height + 8, innerHeight - toolbar.offsetHeight - 8)));
  }, options);
  surface.addEventListener('pointercancel', () => { session.start = null; session.rect = null; box.style.display = 'none'; }, options);
  surface.addEventListener('wheel', event => event.preventDefault(), { ...options, passive: false });
  document.addEventListener('keydown', event => {
    if (exportBusy) { event.preventDefault(); return; }
    if (event.key === 'Escape') { event.preventDefault(); cleanupPicker(); }
    else if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) event.preventDefault();
  }, { ...options, capture: true });
  window.addEventListener('resize', () => { if (!exportBusy) cleanupPicker(); }, options);
  window.addEventListener('scroll', () => { if (!exportBusy) cleanupPicker(); }, { ...options, capture: true });
  showPageToast(msg('regionPrompt'));
}

async function exportRegion(session) {
  if (exportBusy || session !== regionSession) return;
  setExportBusy(true);
  session.toolbar.querySelectorAll('button').forEach(button => { button.disabled = true; });
  const viewport = { width: innerWidth, height: innerHeight };
  const host = overlayRoot.host;
  const visibility = host.style.getPropertyValue('visibility');
  const priority = host.style.getPropertyPriority('visibility');
  try {
    await waitForCaptureSlot();
    host.style.setProperty('visibility', 'hidden', 'important');
    await waitForPaint(2);
    const dataUrl = await requestVisibleTabCapture();
    if (viewport.width !== innerWidth || viewport.height !== innerHeight || session !== regionSession) throw new Error('Viewport changed');
    const png = await window.SuperContentExportRegion.cropPng(dataUrl, session.rect, viewport);
    downloadBlob(png, `${exportFileBaseName()}-region.png`);
    cleanupPicker();
    showPageToast(msg('exportPngSuccess'));
  } catch (error) {
    console.error('[SuperContentExport] region export failed', error);
    showPageToast(msg('exportFailed'));
  } finally {
    if (visibility) host.style.setProperty('visibility', visibility, priority);
    else host.style.removeProperty('visibility');
    setExportBusy(false);
    session.toolbar?.querySelectorAll('button').forEach(button => { button.disabled = false; });
  }
}

async function exportFullPage() {
  if (exportBusy) return;
  cleanupPicker();
  setExportBusy(true);
  showExportLoading();
  const root = document.documentElement;
  const previousBehavior = root.style.getPropertyValue('scroll-behavior');
  const previousPriority = root.style.getPropertyPriority('scroll-behavior');
  try {
    root.style.setProperty('scroll-behavior', 'auto', 'important');
    const png = await window.SuperContentExport.renderElementFromVisibleCaptures(root, captureVisibleTabForExport, { fullPage: true });
    downloadBlob(png, `${exportFileBaseName()}-page.png`);
    showPageToast(msg('exportPngSuccess'));
  } catch (error) {
    console.error('[SuperContentExport] full page export failed', error);
    showPageToast(msg('exportFailed'));
  } finally {
    endViewportCaptureSession();
    hideExportLoading();
    if (previousBehavior) root.style.setProperty('scroll-behavior', previousBehavior, previousPriority);
    else root.style.removeProperty('scroll-behavior');
    setExportBusy(false);
  }
}

function pageMarkdown(rect) {
  const clone = window.SuperContentExportRegion.cloneMarkdownContent(document.body, { rect });
  return window.SuperContentExport.elementToMarkdown(clone);
}

async function saveMarkdown(markdown, suffix, action) {
  if (!markdown.trim()) {
    showPageToast(msg('markdownEmpty'));
    return false;
  }
  if (action === 'copy') await copyText(markdown);
  else downloadBlob(new Blob([`${markdown}\n`], { type: 'text/markdown;charset=utf-8' }), `${exportFileBaseName()}-${suffix}.md`);
  showPageToast(msg(action === 'copy' ? 'exportCopySuccess' : 'exportDownloadSuccess'));
  return true;
}

async function exportRegionMarkdown(session, action) {
  if (exportBusy || session !== regionSession) return;
  setExportBusy(true);
  session.toolbar.querySelectorAll('button').forEach(button => { button.disabled = true; });
  try {
    const saved = await saveMarkdown(pageMarkdown(session.rect), 'region', action);
    if (saved) cleanupPicker();
  } catch (error) {
    console.error('[SuperContentExport] region Markdown export failed', error);
    showPageToast(msg('exportFailed'));
  } finally {
    setExportBusy(false);
    session.toolbar?.querySelectorAll('button').forEach(button => { button.disabled = false; });
  }
}

async function exportFullPageMarkdown() {
  if (exportBusy) return;
  cleanupPicker();
  setExportBusy(true);
  try {
    await saveMarkdown(pageMarkdown(), 'page', 'markdown');
  } catch (error) {
    console.error('[SuperContentExport] full page Markdown export failed', error);
    showPageToast(msg('exportFailed'));
  } finally {
    setExportBusy(false);
  }
}

const VISIBLE_CAPTURE_INTERVAL_MS = 550;
const OVERLAY_ROOT_ID = "__SuperContentExport_overlay_root__";
const PICK_HIGHLIGHT_ID = "__SuperContentExport_pick_highlight__";
const PICK_BADGE_ID = "__SuperContentExport_pick_badge__";
const EXPORT_TOOLBAR_ID = "__SuperContentExport_exporttoolbar__";
const EXPORT_LOADING_ID = "__SuperContentExport_exportloading__";
const TOAST_ID = "__SuperContentExport_toast__";
const OVERLAY_PROBE_SIZE = 100;
const NEUTRAL_COMPENSATION = { left: 0, top: 0, scaleX: 1, scaleY: 1 };

// All extension overlays live in one closed shadow root hanging off
// documentElement, so page CSS and ancestor transform/filter/zoom containers
// can no longer shift, restyle, or clip them.
function ensureOverlayRoot() {
  if (overlayRoot?.host?.isConnected) return overlayRoot;
  overlayRoot = null;
  const host = document.createElement("div");
  host.id = OVERLAY_ROOT_ID;
  host.style.cssText = [
    "all:initial", "display:block", "position:fixed", "top:0", "left:0",
    "right:0", "bottom:0", "width:auto", "height:auto",
    "z-index:2147483647", "pointer-events:none",
    "contain:none", "transform:none", "filter:none", "zoom:1",
  ].join(";");
  const container = typeof host.attachShadow === "function"
    ? host.attachShadow({ mode: "closed" })
    : host;
  if (container !== host) {
    // The host's all:initial already blocks inheritance from the page, so the
    // overlay elements only need predictable box sizing. Their own inline styles
    // always win over this rule.
    const style = document.createElement("style");
    style.textContent = ":host{all:initial}*{box-sizing:border-box}";
    container.appendChild(style);
  }
  const probe = document.createElement("div");
  probe.style.cssText = [
    "position:fixed", "top:0", "left:0", `width:${OVERLAY_PROBE_SIZE}px`,
    `height:${OVERLAY_PROBE_SIZE}px`, "visibility:hidden", "pointer-events:none",
  ].join(";");
  container.appendChild(probe);
  (document.documentElement || document.body).appendChild(host);
  overlayRoot = { host, container, probe };
  return overlayRoot;
}

// A fixed element inside a transformed ancestor is offset and scaled by it.
// The probe measures exactly that drift so overlay coordinates can be mapped
// back into real viewport space. The result only changes when an ancestor's
// transform changes, so it is cached and invalidated on layout-affecting events.
let cachedCompensation = null;

function measureOverlayCompensation() {
  if (cachedCompensation) return cachedCompensation;
  const root = ensureOverlayRoot();
  if (!root) return { ...NEUTRAL_COMPENSATION };
  try {
    const rect = root.probe.getBoundingClientRect();
    cachedCompensation = window.SuperContentExport?.getOverlayCompensation?.(rect, OVERLAY_PROBE_SIZE)
      || { ...NEUTRAL_COMPENSATION };
  } catch {
    cachedCompensation = { ...NEUTRAL_COMPENSATION };
  }
  return cachedCompensation;
}

// The cache is scoped to a single event: one layout read per event instead of one
// per overlay, while still tracking a page whose transform changes over time.
function invalidateOverlayCompensation() {
  cachedCompensation = null;
}

function overlayPoint(left, top, compensation) {
  return window.SuperContentExport?.getCompensatedOverlayPoint?.({ left, top }, compensation)
    || { left, top };
}

function overlayRect(rect, compensation) {
  return window.SuperContentExport?.getCompensatedOverlayRect?.(rect, compensation) || {
    left: Number(rect?.left) || 0,
    top: Number(rect?.top) || 0,
    width: Number(rect?.width) || 0,
    height: Number(rect?.height) || 0,
  };
}

function overlayScaleTransform(compensation) {
  return window.SuperContentExport?.getCompensatedOverlayScaleTransform?.(compensation) || "";
}

function appendOverlay(node) {
  const root = ensureOverlayRoot();
  root?.container.appendChild(node);
  return node;
}

// Places an auto-sized overlay (toolbar, toast) at a viewport position while
// keeping its designed on-screen size inside a scaled ancestor.
function placeOverlayAtViewport(node, left, top) {
  const compensation = measureOverlayCompensation();
  const point = overlayPoint(left, top, compensation);
  node.style.transformOrigin = "0 0";
  node.style.transform = overlayScaleTransform(compensation);
  node.style.left = `${point.left}px`;
  node.style.top = `${point.top}px`;
}

// Places an explicitly sized overlay (highlight) over a viewport rect.
function placeOverlayOverRect(node, rect) {
  const compensation = measureOverlayCompensation();
  const mapped = overlayRect(rect, compensation);
  node.style.transform = "none";
  node.style.left = `${mapped.left}px`;
  node.style.top = `${mapped.top}px`;
  node.style.width = `${mapped.width}px`;
  node.style.height = `${mapped.height}px`;
}

function isOwnOverlay(node) {
  if (!node) return false;
  if (node.id === OVERLAY_ROOT_ID) return true;
  // closest() cannot leave a shadow tree, so the host has to be found by
  // walking the composed parents.
  return Boolean(
    overlayRoot?.host
    && window.SuperContentExport?.isComposedAncestor?.(overlayRoot.host, node),
  );
}

// Setting cursor on <body> only affects inheritance, so any page rule such as
// `a { cursor: pointer }` still wins. A scoped !important rule is the only way to
// show the crosshair reliably while picking.
const PICK_CURSOR_STYLE_ID = "__SuperContentExport_pick_cursor__";

function applyPickCursor() {
  if (document.getElementById(PICK_CURSOR_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = PICK_CURSOR_STYLE_ID;
  style.textContent = "*,*::before,*::after{cursor:crosshair!important}";
  (document.head || document.documentElement).appendChild(style);
}

function removePickCursor() {
  document.getElementById(PICK_CURSOR_STYLE_ID)?.remove();
}

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
  const root = ensureOverlayRoot();
  root?.container.querySelector?.(`#${TOAST_ID}`)?.remove();
  const toast = document.createElement("div");
  toast.id = TOAST_ID;
  toast.textContent = text;
  toast.style.cssText = [
    "position:fixed", "top:0", "left:0", "z-index:2147483647",
    "padding:10px 16px", "border-radius:8px", "box-sizing:border-box",
    "background:#111827", "color:#fff", "font:13px/1.4 system-ui,sans-serif",
    "box-shadow:0 8px 24px rgba(0,0,0,.28)", "pointer-events:none",
    "max-width:80vw", "text-align:center",
  ].join(";");
  appendOverlay(toast);
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  placeOverlayAtViewport(
    toast,
    Math.max(0, (viewportWidth - toast.offsetWidth) / 2),
    Math.max(0, viewportHeight - toast.offsetHeight - 24),
  );
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
  const stillAttached = exportTarget && (exportTarget.isConnected ?? document.contains(exportTarget));
  if (stillAttached && exportTargetUrl === location.href) return true;
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
  exportTarget = window.SuperContentExport?.querySelectorDeep?.(selector, document) || null;
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
  placeOverlayAtViewport(exportToolbar, position.left, position.top);
}

function onExportViewportChange() {
  invalidateOverlayCompensation();
  positionExportToolbar();
  positionExportLoading();
}

function selectorFor(element) {
  return window.SuperContentExport?.selectorForElement?.(element) || "";
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
    "position:fixed", "top:0", "left:0", "z-index:2147483646", "display:flex",
    "align-items:center", "justify-content:center", "background:rgba(17,24,39,.48)",
    "cursor:wait", "font:14px/1.4 system-ui,sans-serif", "pointer-events:auto",
    "box-sizing:border-box",
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
  appendOverlay(exportLoading);
  positionExportLoading();
}

function positionExportLoading() {
  if (!exportLoading) return;
  const width = window.innerWidth || document.documentElement.clientWidth || 0;
  const height = window.innerHeight || document.documentElement.clientHeight || 0;
  placeOverlayOverRect(exportLoading, { left: 0, top: 0, width, height });
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
    if (isOwnOverlay(node)) return;
    if (exportTarget && !window.SuperContentExport?.shouldHideViewportOverlay?.(node, exportTarget)) return;
    const position = getComputedStyle(node).position;
    if (position !== "fixed" && position !== "sticky") return;
    hidden.push({ node, style: node.getAttribute("style") });
    node.style.setProperty("visibility", "hidden", "important");
  });
  // Extension overlays live in the shadow root, which querySelectorAll cannot
  // reach, so the host itself is hidden for the capture instead.
  if (overlayRoot?.host) {
    const hostStyle = overlayRoot.host.getAttribute("style");
    hidden.push({ node: overlayRoot.host, style: hostStyle });
    overlayRoot.host.style.setProperty("visibility", "hidden", "important");
  }
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
    "position:fixed", "top:0", "left:0", "transform:none", "box-sizing:border-box",
    "z-index:2147483647", "display:flex", "gap:6px", "align-items:center",
    "background:#111827", "color:#fff", "padding:8px 10px", "border-radius:10px",
    "font:13px/1 system-ui,sans-serif", "box-shadow:0 6px 24px rgba(0,0,0,.35)",
    "max-width:calc(100vw - 24px)", "overflow:auto", "pointer-events:auto",
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
  appendOverlay(exportToolbar);
  positionExportToolbar();
  window.addEventListener("resize", onExportViewportChange);
}

function clearPickerInteraction() {
  pickMode = false;
  pickChain = [];
  pickIndex = 0;
  pickAnchor = null;
  removePickCursor();
  pickHighlight?.remove();
  pickHighlight = null;
  pickBadge?.remove();
  pickBadge = null;
  document.removeEventListener("mousemove", onPickMouseMove, true);
  document.removeEventListener("wheel", onPickWheel, true);
  document.removeEventListener("click", onPickClick, true);
  document.removeEventListener("keydown", onPickKeyDown, true);
  window.removeEventListener("scroll", onPickScroll, true);
}

function cleanupAfterSuccessfulExport(action) {
  const cleanup = window.SuperContentExport?.getSuccessfulExportCleanup?.(action, true);
  if (cleanup?.removeToolbar) cleanupPicker();
}

function cleanupPicker() {
  clearRegion();
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
  if (pickHighlight?.isConnected) return pickHighlight;
  pickHighlight = document.createElement("div");
  pickHighlight.id = PICK_HIGHLIGHT_ID;
  pickHighlight.style.cssText = [
    "position:fixed", "top:0", "left:0", "box-sizing:border-box",
    "pointer-events:none", "z-index:2147483645", "border:2px solid #2563eb",
    "background:rgba(37,99,235,.08)", "border-radius:3px",
  ].join(";");
  appendOverlay(pickHighlight);
  return pickHighlight;
}

function ensurePickBadge() {
  if (pickBadge?.isConnected) return pickBadge;
  pickBadge = document.createElement("div");
  pickBadge.id = PICK_BADGE_ID;
  pickBadge.style.cssText = [
    "position:fixed", "top:0", "left:0", "box-sizing:border-box",
    "pointer-events:none", "z-index:2147483646", "max-width:60vw",
    "padding:3px 7px", "border-radius:5px", "background:#111827", "color:#fff",
    "font:11px/1.3 ui-monospace,SFMono-Regular,Menlo,monospace",
    "white-space:nowrap", "overflow:hidden", "text-overflow:ellipsis",
  ].join(";");
  appendOverlay(pickBadge);
  return pickBadge;
}

function updatePickHighlight(element) {
  if (!element || typeof element.getBoundingClientRect !== "function") {
    pickHighlight?.remove();
    pickHighlight = null;
    pickBadge?.remove();
    pickBadge = null;
    return;
  }
  const rect = element.getBoundingClientRect();
  placeOverlayOverRect(ensurePickHighlight(), rect);

  const label = window.SuperContentExport?.getPickLabel?.(element, pickIndex);
  if (label) {
    const badge = ensurePickBadge();
    badge.textContent = label;
    const position = window.SuperContentExport?.getPickBadgePosition?.(
      rect,
      { width: badge.offsetWidth, height: badge.offsetHeight },
      { width: window.innerWidth, height: window.innerHeight },
    );
    if (position) placeOverlayAtViewport(badge, position.left, position.top);
  }
}

// The chain is rebuilt from the element actually under the pointer on every move.
// The previous implementation returned early once the selection had been
// expanded, which froze the chain on a stale ancestor path: the highlight stuck
// to the parent, no child could be reached again, and the wheel could only keep
// growing the selection all the way up to the whole page.
//
// The expansion depth is anchored to the innermost hovered element. Keeping it
// only while that exact element stays under the pointer is what makes it
// impossible to remain locked on an ancestor — as soon as the pointer rests on a
// different node, the depth resets to that node.
function rebuildPickChain(event) {
  const hovered = window.SuperContentExport?.getPickEventTarget?.(event) || event?.target || null;
  if (!hovered || hovered.nodeType !== 1) return;
  if (isOwnOverlay(hovered)) return;
  const chain = window.SuperContentExport?.getPickChain?.(hovered, document.body) || [hovered];
  if (!chain.length) return;
  const sameAnchor = pickAnchor === chain[0];
  const carriedDepth = sameAnchor
    ? window.SuperContentExport?.getPickDepthAfterRebuild?.(pickIndex, chain.length) ?? 0
    : 0;
  pickChain = chain;
  pickAnchor = chain[0];
  pickIndex = carriedDepth;
  updatePickHighlight(currentPickElement());
}

function shiftCurrentPick(delta) {
  pickIndex = window.SuperContentExport?.shiftPickIndex?.(pickIndex, delta, pickChain.length) ?? pickIndex;
  updatePickHighlight(currentPickElement());
}

function onPickMouseMove(event) {
  if (!pickMode) return;
  invalidateOverlayCompensation();
  rebuildPickChain(event);
}

// The highlight is positioned in viewport coordinates, so any scroll — page or
// inner container — has to repaint it, otherwise it drifts off the element.
function onPickScroll() {
  if (!pickMode || !pickChain.length) return;
  invalidateOverlayCompensation();
  updatePickHighlight(currentPickElement());
}

function onPickWheel(event) {
  if (!pickMode) return;
  invalidateOverlayCompensation();
  // Rebuild first so the wheel acts on the element currently under the pointer,
  // then move within that freshly built chain.
  rebuildPickChain(event);
  if (!pickChain.length) return;
  event.preventDefault();
  event.stopPropagation();
  const delta = window.SuperContentExport?.pickIndexDeltaFromWheel?.(event.deltaY) || 0;
  if (delta) shiftCurrentPick(delta);
}

function onPickClick(event) {
  if (!pickMode || event.button !== 0) return;
  const hovered = window.SuperContentExport?.getPickEventTarget?.(event) || event.target;
  if (isOwnOverlay(hovered)) return;
  event.preventDefault();
  event.stopPropagation();
  showExportToolbar(currentPickElement() || hovered);
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
  if (exportBusy) return;
  cleanupPicker();
  pickMode = true;
  pickChain = [];
  pickIndex = 0;
  pickAnchor = null;
  applyPickCursor();
  document.addEventListener("mousemove", onPickMouseMove, true);
  document.addEventListener("wheel", onPickWheel, { capture: true, passive: false });
  document.addEventListener("click", onPickClick, true);
  document.addEventListener("keydown", onPickKeyDown, true);
  // Capture phase so inner scrollable containers also repaint the highlight.
  window.addEventListener("scroll", onPickScroll, true);
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
  if (message?.type === 'SCE_FULL_PAGE_MARKDOWN') {
    await exportFullPageMarkdown();
    return { ok: true };
  }
  if (message?.type === 'SCE_REGION_START') {
    startRegionPicker();
    return { ok: true };
  }
  if (message?.type === 'SCE_FULL_PAGE_EXPORT') {
    exportFullPage();
    return { ok: true };
  }
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
