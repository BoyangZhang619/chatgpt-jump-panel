const STORAGE_KEY = "CGJP_SETTINGS";

const DEFAULTS = {
  userColor: "#f59e0b",
  assistantColor: "#3b82f6",
  parityReverse: false,
  defaultHidden: false,

  useCustomSelector: false,
  customSelector: ".text-token-text-primary",

  roleMode: "parity", // "parity" | "none"

  // ✅ 新增：是否要求 :scope > .sr-only 才算有效
  requireSrOnly: true
};

const $ = (id) => document.getElementById(id);

const els = {
  userColor: $("userColor"),
  userColorText: $("userColorText"),
  assistantColor: $("assistantColor"),
  assistantColorText: $("assistantColorText"),
  parityReverse: $("parityReverse"),
  defaultHidden: $("defaultHidden"),

  useCustomSelector: $("useCustomSelector"),
  customSelector: $("customSelector"),

  roleParity: $("roleParity"),
  roleNone: $("roleNone"),

  requireSrOnly: $("requireSrOnly"),

  testSelector: $("testSelector"),
  testResult: $("testResult"),

  status: $("status"),
  save: $("save"),
  reset: $("reset"),
};

function msg(key, ...subs) {
  try {
    const m = chrome.i18n.getMessage(key, subs);
    return m || "";
  } catch {
    return "";
  }
}

function applyI18n() {
  document.documentElement.lang = chrome.i18n.getUILanguage?.() || "en";

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    const text = msg(key);
    if (text) el.textContent = text;
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    const text = msg(key);
    if (text) el.setAttribute("placeholder", text);
  });

  // title
  const title = msg("optTitle");
  if (title) document.title = title;
}

function normalizeHex(hex) {
  if (!hex) return null;
  const h = hex.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(h)) return h.toLowerCase();
  return null;
}

function setStatus(msgText) {
  els.status.textContent = msgText || "";
  if (msgText) setTimeout(() => {
    if (els.status.textContent === msgText) els.status.textContent = "";
  }, 1600);
}

function getRoleModeFromUI() {
  return els.roleNone.checked ? "none" : "parity";
}

function setRoleModeToUI(roleMode) {
  if (roleMode === "none") els.roleNone.checked = true;
  else els.roleParity.checked = true;
}

function enableCustomSelectorUI(enabled) {
  els.customSelector.disabled = !enabled;
  els.testSelector.disabled = !enabled;
  if (!enabled) els.testResult.textContent = "";
}

// ✅ 你要求：启用自定义 selector 时默认不区分
function applyCustomSelectorRule(enabled) {
  if (enabled) {
    setRoleModeToUI("none");
    // 同时建议默认关闭 requireSrOnly（更兼容自定义 selector）
    els.requireSrOnly.checked = false;
  }
}

async function loadSettings() {
  const data = await chrome.storage.local.get([STORAGE_KEY]);
  const s = { ...DEFAULTS, ...(data[STORAGE_KEY] || {}) };

  els.userColor.value = s.userColor;
  els.userColorText.value = s.userColor;

  els.assistantColor.value = s.assistantColor;
  els.assistantColorText.value = s.assistantColor;

  els.parityReverse.checked = !!s.parityReverse;
  els.defaultHidden.checked = !!s.defaultHidden;

  els.useCustomSelector.checked = !!s.useCustomSelector;
  els.customSelector.value = s.customSelector || DEFAULTS.customSelector;

  els.requireSrOnly.checked = (s.requireSrOnly !== false); // 默认 true

  setRoleModeToUI(s.useCustomSelector ? "none" : (s.roleMode || "parity"));
  enableCustomSelectorUI(!!s.useCustomSelector);

  return s;
}

function gatherSettingsFromUI() {
  const userHex = normalizeHex(els.userColorText.value) || els.userColor.value || DEFAULTS.userColor;
  const assistantHex = normalizeHex(els.assistantColorText.value) || els.assistantColor.value || DEFAULTS.assistantColor;

  const useCustom = !!els.useCustomSelector.checked;
  const selector = (els.customSelector.value || "").trim() || DEFAULTS.customSelector;

  // ✅ 启用自定义时：强制 roleMode=none（你要求默认不区分）
  const roleMode = useCustom ? "none" : getRoleModeFromUI();

  return {
    userColor: userHex,
    assistantColor: assistantHex,
    parityReverse: !!els.parityReverse.checked,
    defaultHidden: !!els.defaultHidden.checked,

    useCustomSelector: useCustom,
    customSelector: selector,

    roleMode,

    requireSrOnly: !!els.requireSrOnly.checked
  };
}

async function saveSettings() {
  const s = gatherSettingsFromUI();
  await chrome.storage.local.set({ [STORAGE_KEY]: s });
  setStatus(msg("statusSaved") || "Saved ✅");
}

async function resetSettings() {
  await chrome.storage.local.set({ [STORAGE_KEY]: { ...DEFAULTS } });
  await loadSettings();
  setStatus(msg("statusReset") || "Reset ✅");
}

function wireColorPair(colorInput, textInput) {
  colorInput.addEventListener("input", () => {
    textInput.value = colorInput.value;
  });
  textInput.addEventListener("input", () => {
    const hex = normalizeHex(textInput.value);
    if (hex) colorInput.value = hex;
  });
}

async function testSelectorOnActiveTab() {
  const s = gatherSettingsFromUI();
  const selector = s.useCustomSelector ? s.customSelector : DEFAULTS.customSelector;

  els.testResult.textContent = msg("testRunning") || "Testing…";

  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab?.id) {
      els.testResult.textContent = msg("testNoTab") || "No active tab";
      return;
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (sel) => {
        try {
          return { ok: true, count: document.querySelectorAll(sel).length };
        } catch (e) {
          return { ok: false, error: String(e) };
        }
      },
      args: [selector]
    });

    const r = results?.[0]?.result;
    if (!r) {
      els.testResult.textContent = msg("testBadResult") || "Bad result";
      return;
    }
    if (!r.ok) {
      els.testResult.textContent = (msg("testSelectorError", r.error) || `Selector error: ${r.error}`);
      return;
    }

    els.testResult.textContent = (msg("testCount", String(r.count)) || `Matched: ${r.count}`);
  } catch (e) {
    els.testResult.textContent = (msg("testNeedChatGPT", String(e)) || `Cannot execute: ${String(e)}`);
  }
}

function bindEvents() {
  wireColorPair(els.userColor, els.userColorText);
  wireColorPair(els.assistantColor, els.assistantColorText);

  els.useCustomSelector.addEventListener("change", () => {
    const enabled = !!els.useCustomSelector.checked;
    enableCustomSelectorUI(enabled);
    applyCustomSelectorRule(enabled);
  });

  els.save.addEventListener("click", saveSettings);
  els.reset.addEventListener("click", resetSettings);
  els.testSelector.addEventListener("click", testSelectorOnActiveTab);
}

document.addEventListener("DOMContentLoaded", async () => {
  applyI18n();
  bindEvents();
  await loadSettings();
});
