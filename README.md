# ChatGPT Jump Panel

A lightweight browser extension that adds a draggable jump panel to ChatGPT, allowing you to quickly navigate long conversations.

Designed for power users who work with long prompts, code reviews, or research chats.

---

## ✨ Features

- 📌 **Jump to any message** in the current conversation
- 🎨 **Role-aware color indicators**
  - User / Assistant colors
  - Or unified style when role detection is disabled
- 🧭 **Parity-based role detection**
  - Determine user / assistant by message order
- 🧱 **Draggable & minimizable panel**
  - Drag to avoid blocking content
  - Minimize when not in use
- 🔄 **Auto-refresh**
  - Updates automatically as new messages appear
- 🎛 **Options page**
  - Customize colors
  - Reverse parity
  - Default show/hide
  - Custom message selector
  - Optional `sr-only` validity filter
- 🌍 **Internationalization (i18n)**
  - English & Simplified Chinese
- ⌨️ **Keyboard shortcut**
  - `Alt + J` to toggle panel
- 🔒 **Privacy-first**
  - No network requests
  - No data collection
  - All settings stored locally

---

## 📦 Installation

### Chrome / Edge (Unpacked)

1. Download or clone this repository
2. Open `chrome://extensions`
3. Enable **Developer mode**
4. Click **Load unpacked**
5. Select the project folder

The panel will automatically appear on `chatgpt.com`.

---

## ⚙️ Usage

- Click any item in the panel to scroll to that message
- Drag the top bar to reposition the panel
- Use the **↻** button to refresh manually
- Use the **— / ▢** button to minimize or restore
- Press **Alt + J** or click the extension icon to toggle visibility

---

## 🧩 Options

Open the extension options from:

- `chrome://extensions` → Extension details → Options

Available settings:

- User / Assistant colors
- Reverse parity (swap user / assistant order)
- Hide panel by default
- Custom message selector
- Role mode:
  - Parity-based
  - No role (single style)
- Require `:scope > .sr-only` for validity (optional)

> Tip: When using a custom selector, role mode defaults to **No role** for stability.

---

## 🛠 How It Works

- Injects a **content script** into ChatGPT pages
- Uses a **Shadow DOM** to isolate styles
- Observes DOM mutations to detect new messages
- Scrolls within ChatGPT’s internal scroll container
- Determines roles by **nth valid message order** when enabled

---

## 🔐 Privacy

This extension:

- Does **not** collect or transmit any user data
- Does **not** track usage or analytics
- Stores settings locally using `chrome.storage`

---

## 📜 License

MIT License

---

## 🙌 Contributing

Issues and pull requests are welcome!

If ChatGPT’s DOM changes and breaks selectors, feel free to open an issue with updated structure info.
