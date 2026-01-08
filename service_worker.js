async function sendToggleMessageToActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id) return;

  try {
    await chrome.tabs.sendMessage(tab.id, { type: "CGJP_TOGGLE_PANEL" });
  } catch (e) {
    // content script 可能还没注入完成，尝试注入后再发
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"]
      });
      await chrome.tabs.sendMessage(tab.id, { type: "CGJP_TOGGLE_PANEL" });
    } catch (_) {}
  }
}

chrome.action.onClicked.addListener(() => {
  sendToggleMessageToActiveTab();
});

chrome.commands.onCommand.addListener((command) => {
  if (command === "toggle-panel") {
    sendToggleMessageToActiveTab();
  }
});
