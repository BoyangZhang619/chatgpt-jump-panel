# ChatGPT Jump Panel

(中文版md见下面)

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

<br/><br/><br/><br/><br/>

# ChatGPT 跳转栏（ChatGPT Jump Panel）

一个轻量级浏览器扩展，为 ChatGPT 页面添加可拖拽的跳转栏，用于在**长对话中快速定位消息**。

非常适合经常进行长对话、写代码、做研究或反复追问的用户。

---

## ✨ 功能特性

- 📌 **快速跳转任意消息**
- 🎨 **角色提示色**
  - 用户 / ChatGPT 不同颜色
  - 或统一样式（关闭角色区分）
- 🧭 **基于顺序的角色判断**
  - 按第 n 个有效消息奇偶判断用户 / ChatGPT
- 🧱 **可拖拽 / 可最小化面板**
  - 拖动避免遮挡内容
- 🔄 **自动刷新**
  - 新消息出现时自动更新列表
- 🎛 **设置页（Options）**
  - 自定义颜色
  - 奇偶反转
  - 默认隐藏
  - 自定义消息选择器
  - 可选的 `sr-only` 有效性过滤
- 🌍 **国际化支持**
  - 简体中文 / English
- ⌨️ **快捷键**
  - `Alt + J` 显示 / 隐藏面板
- 🔒 **隐私友好**
  - 不联网
  - 不收集任何数据
  - 所有设置仅保存在本地

---

## 📦 安装方式

### Chrome / Edge（开发者模式）

1. 下载或克隆本仓库
2. 打开 `chrome://extensions`
3. 启用 **开发者模式**
4. 点击 **加载已解压的扩展程序**
5. 选择项目文件夹

打开 `chatgpt.com` 即可看到跳转栏。

---

## ⚙️ 使用说明

- 点击跳转栏中的条目可滚动到对应消息
- 拖动顶部空白区域可调整位置
- 点击 **↻** 手动刷新列表
- 点击 **— / ▢** 最小化或还原
- 使用 **Alt + J** 或点击扩展图标显示 / 隐藏

---

## 🧩 设置项（Options）

打开方式：

- `chrome://extensions` → 扩展详情 → 选项

可配置内容包括：

- 用户 / ChatGPT 提示色
- 奇偶反转（当角色顺序不对时）
- 默认隐藏面板
- 自定义消息选择器
- 角色模式：
  - 按顺序奇偶区分
  - 不区分角色（统一样式）
- 是否要求 `:scope > .sr-only` 作为有效消息

> 提示：启用自定义选择器时，角色模式默认切换为「不区分」，以保证稳定性。

---

## 🛠 实现原理

- 在 ChatGPT 页面注入内容脚本
- 使用 **Shadow DOM** 隔离样式，避免污染页面
- 通过 **MutationObserver** 监听新消息
- 在 ChatGPT 内部滚动容器中进行精准滚动
- 可选基于“第 n 个有效消息”的角色判断逻辑

---

## 🔐 隐私声明

本扩展：

- **不会** 收集、上传或分析任何用户数据
- **不会** 发起网络请求
- 仅使用 `chrome.storage` 在本地保存设置

---

## 📜 许可证

MIT License

---

## 🙌 贡献

欢迎提交 Issue 或 PR。

如果 ChatGPT 页面结构发生变化导致选择器失效，欢迎提供新的 DOM 结构信息。
