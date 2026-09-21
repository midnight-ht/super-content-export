const $ = (id) => document.getElementById(id);
const popupUtils = window.SuperContentExportPopupUtils;
const selectionText = $("selectionText");
const pageHost = $("pageHost");
const locateBtn = $("locateBtn");
const exportButtons = [$("copyBtn"), $("markdownBtn"), $("pngBtn")];
const CONTENT_FILES = ["src/content/i18n-utils.js", "src/content/export-utils.js", "src/content/clipboard-utils.js", "src/content/content.js"];
let currentSelection = null;
let currentLocale = popupUtils?.normalizeLocale(chrome.i18n?.getUILanguage?.() || navigator.language) || "en";
let localeMessages = {};

function nativeMessage(key, fallback) {
  return chrome.i18n?.getMessage?.(key) || fallback;
}

function localMessage(key, fallback) {
  return popupUtils?.messageFromLocale(localeMessages, key, nativeMessage(key, fallback)) || fallback;
}

async function loadLocale(locale) {
  const normalized = popupUtils?.normalizeLocale(locale) || locale;
  try {
    const url = chrome.runtime.getURL(`_locales/${normalized}/messages.json`);
    const response = await fetch(url);
    if (response.ok) localeMessages = await response.json();
  } catch {
    localeMessages = {};
  }
  currentLocale = normalized;
}

function applyLocale() {
  document.documentElement.lang = currentLocale === "zh_CN" ? "zh-CN" : "en";
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = localMessage(node.dataset.i18n, node.textContent);
  });
  $("languageBtn").textContent = currentLocale === "zh_CN" ? "EN" : "中";
  $("languageBtn").title = localMessage("languageButton", "Language");
  $("languageBtn").setAttribute("aria-label", localMessage("languageButton", "Language"));
  $("helpBtn").title = localMessage("helpButton", "Help");
  $("helpBtn").setAttribute("aria-label", localMessage("helpButton", "Help"));
  $("githubLink").title = localMessage("githubLink", "GitHub");
  $("githubLink").setAttribute("aria-label", localMessage("githubLink", "GitHub"));
  setSelection(currentSelection);
}

function setSelection(selection) {
  currentSelection = selection || null;
  const available = popupUtils?.hasSelection(selection) || false;
  selectionText.textContent = available
    ? selection.text || selection.selector
    : localMessage("selectionEmpty", "尚未选择元素");
  selectionText.title = selection?.selector || "";
  [...exportButtons, locateBtn].forEach((button) => { button.disabled = !available; });
}

async function activeTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab?.id) throw new Error(localMessage("noPage", "无法获取当前页面"));
  return tab;
}

async function refreshPageStatus() {
  try {
    const tab = await activeTab();
    pageHost.textContent = new URL(tab.url || "").hostname || "—";
  } catch {
    pageHost.textContent = "—";
  }
}

async function sendToContent(message) {
  const tab = await activeTab();
  try {
    return await chrome.tabs.sendMessage(tab.id, message);
  } catch {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: CONTENT_FILES });
    return chrome.tabs.sendMessage(tab.id, message);
  }
}

async function startPicker() {
  try {
    await sendToContent({ type: "SCE_PICK_START" });
    window.close();
  } catch (error) {
    selectionText.textContent = error.message || localMessage("pickUnsupported", "当前页面不支持选择");
  }
}

async function runExport(action) {
  try {
    await sendToContent({ type: "SCE_EXPORT_ACTION", action });
    await refreshSelection();
  } catch (error) {
    selectionText.textContent = error.message || localMessage("exportFailed", "导出失败，请重试");
  }
}

async function locateSelection() {
  try {
    const result = await sendToContent({ type: "SCE_FOCUS_SELECTION" });
    if (!result?.ok) selectionText.textContent = localMessage("selectionNotFound", result?.error || "当前页面找不到该容器");
  } catch (error) {
    selectionText.textContent = error.message || localMessage("selectionNotFound", "当前页面找不到该容器");
  }
}

async function refreshSelection() {
  const [result, tab] = await Promise.all([
    chrome.storage.local.get("exportSelection"),
    activeTab().catch(() => null),
  ]);
  const selection = result.exportSelection;
  if (selection && !popupUtils?.selectionMatchesUrl?.(selection, tab?.url)) {
    await chrome.storage.local.remove("exportSelection");
    setSelection(null);
    return;
  }
  setSelection(selection);
}

async function switchLocale() {
  await loadLocale(popupUtils?.nextLocale(currentLocale) || "en");
  await chrome.storage.local.set({ popupLocale: currentLocale });
  applyLocale();
}

function toggleHelp() {
  const panel = $("helpPanel");
  const expanded = panel.hidden;
  panel.hidden = !expanded;
  $("helpBtn").setAttribute("aria-expanded", String(expanded));
}

async function initialize() {
  const result = await chrome.storage.local.get("popupLocale");
  await loadLocale(result.popupLocale || currentLocale);
  applyLocale();
  await Promise.all([refreshSelection(), refreshPageStatus()]);
}

$("pickBtn").addEventListener("click", startPicker);
$("copyBtn").addEventListener("click", () => runExport("copy"));
$("markdownBtn").addEventListener("click", () => runExport("markdown"));
$("pngBtn").addEventListener("click", () => runExport("png"));
locateBtn.addEventListener("click", locateSelection);
$("helpBtn").addEventListener("click", toggleHelp);
$("languageBtn").addEventListener("click", switchLocale);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.exportSelection) setSelection(changes.exportSelection.newValue);
});

initialize();
