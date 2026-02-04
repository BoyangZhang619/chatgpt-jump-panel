# ChatGPT Jump Panel（通用版）开发者文档

## 目标与能力概览

本扩展在任意网页上提供一个悬浮面板，用于：
- 自动收集页面中“消息块”（Message）的列表并展示摘要；
- 点击列表项后，滚动到对应消息位置并短暂高亮；
- 支持按站点（hostname）保存不同的选择器配置；
- 支持多套主题（Theme）与基础行为选项；
- 默认不在所有网页常驻运行：只有当用户点击扩展图标或快捷键触发时才注入并显示（“默认关闭，点了才出来”）。

## 目录结构与模块职责

```
/
  manifest.json         # 扩展清单（MV3），权限、后台脚本、options 页面等
  service_worker.js     # 后台 service worker：负责注入 content.js / toggle 消息 / 打开 options
  content.js            # 内容脚本：面板 UI、消息收集、滚动跳转、存储状态同步
  options.html          # 设置页 UI：主题、颜色、默认隐藏、按站点选择器配置
  options.js            # 设置页逻辑：加载/保存 settings、内置预设、选择器测试
  options.css           # 设置页样式
  /icons                # 扩展图标
  /_locales             # i18n（本版本 options 文本未接入 i18n，可自行扩展）
```

---

## 注入与运行流程（重点）

### 1) 默认不注入：按需注入（On-demand Injection）

- 扩展不使用 `content_scripts` 自动注入。
- 用户点击扩展图标或按快捷键后，后台脚本注入 `content.js` 并发送切换消息。

相关代码位置：
- `manifest.json`
  - 未配置 `content_scripts` 与 `host_permissions`
  - `permissions` 含 `activeTab`、`scripting`、`tabs`
- `service_worker.js`
  - `sendToggleMessageToActiveTab()`：先 `tabs.sendMessage`，失败则 `scripting.executeScript({files:["content.js"]})` 后再发送 toggle 消息
  - `chrome.action.onClicked` 与 `chrome.commands.onCommand` 触发注入/切换

### 2) 内容脚本启动与防重复注入

- `content.js` 使用 IIFE 包裹，并通过 `window.__CGJP_BOOTSTRAPPED__` 防止同一页面重复构建 UI。

相关代码位置：
- `content.js`
  - `buildUI()` 开头检查并设置 `window.__CGJP_BOOTSTRAPPED__`

---

## 消息通信协议（Background ↔ Content）

消息类型：
- `CGJP_TOGGLE_PANEL`
  - 发送方：`service_worker.js`
  - 接收方：`content.js`
  - 功能：切换面板显示/隐藏（`state.hidden`）
- `CGJP_OPEN_OPTIONS`
  - 发送方：`content.js`（面板内“设置”按钮）
  - 接收方：`service_worker.js`
  - 功能：调用 `chrome.runtime.openOptionsPage()` 打开设置页

相关代码位置：
- `service_worker.js`
  - `chrome.runtime.onMessage` 监听 `CGJP_OPEN_OPTIONS`
- `content.js`
  - `chrome.runtime.onMessage` 监听 `CGJP_TOGGLE_PANEL`
  - `optBtn.addEventListener("click")` 发送 `CGJP_OPEN_OPTIONS`

---

## 存储结构与键（Storage）

本扩展使用 `chrome.storage.local` 保存两类数据：

### 1) 设置（Settings）

- Key：`CGJP_SETTINGS`
- 结构（v2）：

```js
{
  version: 2,
  global: {
    userColor: "#f59e0b",
    assistantColor: "#3b82f6",
    noneColor: "#6b7280",
    defaultHidden: true,
    theme: "dark",
    highlightMs: 1200
  },
  sites: {
    "example.com": {
      scrollSelector: "...",
      messageSelector: "...",
      roleSelector: "..." // 可为空字符串
    }
  }
}
```

相关代码位置：
- `content.js`
  - `EXT_KEY_SETTINGS = "CGJP_SETTINGS"`
  - `DEFAULT_SETTINGS`
  - `normalizeSettings(raw)`：负责 v1 → v2 迁移/归一化
  - `resolveSiteConfig(settings, hostname)`：根据当前站点与覆盖规则得到有效配置
- `options.js`
  - `STORAGE_KEY = "CGJP_SETTINGS"`
  - `DEFAULTS`
  - `normalizeSettings(raw)`：设置页侧同样做迁移/归一化

### 2) 面板状态（State，按站点保存）

- Key：`CGJP_STATE`
- 结构（当前实现为 sites map；`version` 字段主要用于结构识别）：

```js
{
  version: 1,
  sites: {
    "example.com": {
      left: null | number,
      top: number,
      minimized: boolean,
      hidden: boolean
    }
  }
}
```

相关代码位置：
- `content.js`
  - `EXT_KEY_STATE = "CGJP_STATE"`
  - `DEFAULT_STATE_PER_SITE`
  - `normalizeStateRoot(raw, hostname)`：兼容旧结构并迁移到按站点保存
  - `persistState()`：写回 `stateRoot.sites[hostname]`

### 存储更新监听（options 修改后即时生效）

- `content.js` 使用 `chrome.storage.onChanged` 监听：
  - settings 变化：更新 `settings`、重新应用主题、重新渲染
  - state 变化：同步面板显示/最小化等

相关代码位置：
- `content.js`
  - `chrome.storage.onChanged.addListener(...)`

---

## 站点预设（Built-in Presets）

为减少初次配置成本，代码内置若干站点预设。预设按 hostname 精确匹配（同时对 `www.` 做候选处理）。

内置预设定义：
- `content.js`：`BUILTIN_PRESETS`
- `options.js`：`BUILTIN_PRESETS`（用于设置页“使用内置预设”按钮）

当前内置项（可扩展）：
- ChatGPT
  - host：`chatgpt.com` / `chat.openai.com`
  - `messageSelector = ".text-token-text-primary"`
  - `scrollSelector = 'div[data-scroll-root="true"]'`
  - `roleSelector = ":scope > .sr-only"`（用于识别角色且作为有效性过滤）
- Gemini
  - host：`gemini.google.com`
  - `messageSelector = ".conversation-container"`
  - `scrollSelector = "#chat-history"`
  - `roleSelector = ""`（默认无角色判断）
- 豆包
  - host：`doubao.com` / `www.doubao.com`
  - `messageSelector = ".container-PvPoAn"`
  - `scrollSelector = ".scrollable-Se7zNt"`
  - `roleSelector = ""`

站点配置优先级（从低到高）：
1. 内置预设（Built-in）
2. 用户站点覆盖（`settings.sites[hostname]`）
3. 运行期 fallback（例如找不到滚动容器时使用自动探测）

相关代码位置：
- `content.js`
  - `resolveSiteConfig(settings, hostname)`：合并 preset 与用户覆盖，得到 `effective`
  - `hostCandidates(hostname)`：hostname 与去 `www.` 候选

---

## 选择器体系（三选择器）

扩展支持 3 个选择器，分别控制“滚动容器”、“消息块定位”、“角色判断”。

### 1) Scroll Container Selector（必填，但允许 fallback）

作用：
- 指定页面真正滚动的容器元素，用于 `scrollTo({top})` 精确跳转。
- 若配置为空或找不到，内容脚本会 fallback 到自动探测。

相关代码位置：
- `options.html`
  - `#scrollSelector`
- `options.js`
  - `gatherSiteFromUI()` 读取
  - `saveSettings()` 校验：为空会阻止保存（必填）
  - `testSelectorsOnActiveTab()` 测试该 selector 的匹配数与可滚动数
- `content.js`
  - `findScrollableBySelector(sel)`：优先找可滚动元素
  - `getScrollerFallback()`：fallback（包含 `div[data-scroll-root="true"]` 与 `document.scrollingElement` 等）
  - `render()`：构造 `scroller`

### 2) Message Selector（必填）

作用：
- `document.querySelectorAll(messageSelector)` 命中每条消息的“锚点元素”。
- 面板列表每一项对应一个锚点元素；点击后滚动到该元素。

相关代码位置：
- `options.html`
  - `#messageSelector`
- `options.js`
  - `saveSettings()` 校验：为空会阻止保存（必填）
  - `testSelectorsOnActiveTab()` 输出匹配数量
- `content.js`
  - `collectItems()` 使用 `safeQueryAll(messageSelector)` 获取消息集合

### 3) Role Selector（可选，可为空表示无判断）

作用：
- 对每个消息块 `msgEl`，在其内部使用 `msgEl.querySelector(roleSelector)` 找到用于判断“我/AI”的子节点。
- `roleSelector` 为空：
  - 不做角色判断，所有条目使用 `noneColor`（中性色）
  - 不基于 role 子节点过滤消息块
- `roleSelector` 非空：
  - 若某条消息块找不到 role 节点，当前实现会将其视为无效并过滤（ChatGPT 场景常用）
  - role 节点存在但文本不明时，角色为 `none`（使用中性色）

相关代码位置：
- `options.html`
  - `#roleSelector`
- `options.js`
  - `gatherSiteFromUI()`：允许保存为空
  - `testSelectorsOnActiveTab()`：在第一条 message 上测试 roleSelector 是否命中
- `content.js`
  - `collectItems()`：roleSelector 非空时会 `continue` 过滤 role 节点缺失/空文本的消息块
  - `parseRole(raw)`：将 role 文本归一化为 `user/assistant/none`

---

## 主题系统（Theme）

主题本质是一组 CSS 变量值，用于控制面板背景/边框/按钮/阴影等。

相关代码位置：
- `content.js`
  - `THEMES`：主题字典
  - `applyTheme()`：将主题变量写入 `panel.style.setProperty(...)`
- `options.html`
  - `#theme` 下拉框
- `options.js`
  - `gatherGlobalFromUI()` 与 `loadGlobalToUI()`

已内置主题：
- `dark`
- `light`
- `slate`
- `glass`

扩展主题的方法：
1. 在 `content.js` 的 `THEMES` 添加新键值（例如 `themeX`）
2. 在 `options.html` 的 `<select id="theme">` 添加对应 `<option>`
3. 可选：在 `options.js` 不需要额外逻辑（读取的是字符串）

---

## 面板 UI 与交互逻辑

### Shadow DOM 与宿主节点

目的：
- 避免与页面 CSS 冲突；
- 面板不阻挡页面交互：宿主层 `pointer-events: none`，面板 `pointer-events: auto`。

相关代码位置：
- `content.js`
  - `ensureHost()`：创建 `#__cgjp_host__` 与 `#__cgjp_root__`，并 `attachShadow({mode:"open"})`

### 面板按钮与行为

- 刷新（Refresh）
  - 触发 `render()` 重建列表
  - 位置：`refreshBtn.addEventListener("click", render)`
- 最小化（Minimize）
  - 切换 `state.minimized`，并写入存储
  - 位置：`toggleMinBtn.addEventListener("click", ...)`
- 设置（Options）
  - 发送 `CGJP_OPEN_OPTIONS`
  - 位置：`optBtn.addEventListener("click", ...)`
- 拖拽移动
  - 仅拖拽条（dragbar）响应
  - 写入 `state.left/top`
  - 位置：拖拽闭包段 `dragBar.addEventListener("mousedown", ...)`

### 列表项点击跳转

- `scrollToMessage(scroller, el, accent)`：
  - 计算 `offsetTopIn`，并 `scrollTo({top, behavior:"smooth"})`
  - 文档滚动与容器滚动分别处理
  - 高亮使用 `outline`，时长 `settings.global.highlightMs`

相关代码位置：
- `content.js`
  - `offsetTopIn(target, container)`
  - `scrollToMessage(...)`

---

## 自动更新机制（DOM 变化与节流）

- `MutationObserver` 监听 `document.body` 子树变化，并通过 `debounce` 合并频繁更新，最终触发 `render()`。

相关代码位置：
- `content.js`
  - `scheduleRender = debounce(render, 200)`
  - `startObserver()` 创建并 `observer.observe(document.body, {childList:true, subtree:true})`

设计说明：
- 适用于聊天类页面新增消息、路由切换、动态加载等场景。
- 若目标页面 DOM 变化极频繁，可进一步扩展为“仅面板显示时启用 observer”或提供开关（当前未提供 UI 开关）。

---

## Options 设置页：字段说明与代码映射

### Global 区域

| 选项 | 作用 | 存储位置 | 代码使用位置 |
|---|---|---|---|
| Theme | 控制面板主题变量 | `settings.global.theme` | `content.js`：`applyTheme()` 读取 `THEMES[theme]` |
| User color | 用户消息条颜色 | `settings.global.userColor` | `content.js`：`render()` 中 `role==="user"` 选择 accent |
| Assistant color | AI 消息条颜色 | `settings.global.assistantColor` | `content.js`：`render()` 中 `role==="assistant"` 选择 accent |
| Hide panel by default | 新站点首次注入时默认隐藏 | `settings.global.defaultHidden` | `content.js`：`buildUI()` 中对 `state.hidden` 初始化 |

说明：
- `noneColor` 与 `highlightMs` 当前不在 options UI 暴露，但已在默认 settings 中存在，方便后续扩展。

### Site selectors 区域

| 选项 | 作用 | 存储位置 | 代码使用位置 |
|---|---|---|---|
| Editing site | 选择要编辑的 hostname | UI 状态 | `options.js`：`populateSiteSelect()` + `loadSiteToUI()` |
| Use current tab | 自动取当前活动标签页 hostname 并切换编辑目标 | UI 操作 | `options.js`：`getActiveTabHost()` + `useCurrentTabHost()` |
| Scroll selector (required) | 指定滚动容器 | `settings.sites[host].scrollSelector` | `content.js`：`findScrollableBySelector()` / `render()` |
| Message selector (required) | 指定消息块集合 | `settings.sites[host].messageSelector` | `content.js`：`collectItems()` |
| Role selector (optional) | 指定角色子节点（可空） | `settings.sites[host].roleSelector` | `content.js`：`collectItems()` + `parseRole()` |
| Use built-in preset | 把内置预设填到输入框（需手动 Save 才写入覆盖） | 无（写入前） | `options.js`：`usePresetForCurrentHost()` |
| Delete site override | 删除该 host 的用户覆盖，回退到内置预设 | `settings.sites[host]` 删除 | `options.js`：`deleteSiteOverride()` |
| Test on active tab | 在当前标签页执行脚本测试三选择器 | 无（仅测试） | `options.js`：`testSelectorsOnActiveTab()` |

校验规则：
- Scroll selector 与 Message selector 必填，否则 `saveSettings()` 会阻止保存并提示。

---

## 扩展点与维护建议

### 1) 添加新站点预设
需要同时修改两处（保持 options 与 content 一致）：
- `content.js`：`BUILTIN_PRESETS`
- `options.js`：`BUILTIN_PRESETS`

建议字段：
- `label`：用于展示/调试
- `scrollSelector` / `messageSelector` / `roleSelector`

### 2) Role 过滤策略可配置化（常见需求）
当前策略：当 `roleSelector` 非空时，缺失 role 节点的消息块会被过滤。
如需更宽松策略，可扩展为：
- `requireRoleNode: boolean`（默认 true）
- 当 false 时：role 节点缺失也保留消息块，但角色为 `none`

代码落点：
- `content.js`：`collectItems()` 内 roleSelector 分支
- `options.html/options.js`：新增开关并保存到 `settings.sites[host]`

### 3) iframe 支持与 allFrames
当前注入仅针对顶层 frame。若聊天内容在 iframe 中，可能需要：
- `chrome.scripting.executeScript({ target: {tabId, allFrames: true}, files:[...] })`
并在 content 侧确保不会重复创建 UI（已通过 `__CGJP_BOOTSTRAPPED__` 限制每个 frame）。

### 4) 性能调优
- 仅在面板显示时启用 `MutationObserver`；
- 或提供一个 global 开关（例如 `settings.global.autoRefresh`）控制 observer 是否启用。

---

## 已知限制（浏览器层面）

即使使用按需注入，也存在 Chrome 的固有限制：
- 无法在 `chrome://`、扩展商店、部分系统页面注入脚本；
- 某些站点强 CSP 不影响内容脚本注入本身，但可能影响页面内资源加载方式（本扩展不依赖外部资源）。

---

## 调试建议

1. 打开任意站点，点击扩展图标，确认面板出现。
2. 若列表为空：
   - 打开 options，使用 “Use current tab” 切换到当前 hostname
   - 填写三选择器并 “Test on active tab”
   - 根据测试结果调整 selector
3. 若滚动不准确：
   - 优先修正 `scrollSelector`，确保命中真正滚动的容器（测试结果中 scrollableMatched > 0 更理想）
4. 若消息被过滤：
   - 检查 `roleSelector` 是否过于严格；空置可关闭角色判断与过滤

---
