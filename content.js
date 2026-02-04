(() => {
    const EXT_KEY_STATE = "CGJP";              // 面板位置/最小化/隐藏
    const EXT_KEY_SETTINGS = "CGJP_SETTINGS";  // options 设置
    const HOST_ID = "__cgjp_host__";
    const ROOT_ID = "__cgjp_root__";

    const DEFAULT_STATE = { left: null, top: 80, minimized: false, hidden: false };

    const DEFAULT_SETTINGS = {
        requireSrOnly: true,
        userColor: "#f59e0b",
        assistantColor: "#3b82f6",
        parityReverse: false,
        defaultHidden: false,
        useCustomSelector: false,
        customSelector: ".text-token-text-primary",
        roleMode: "parity" // "parity" | "none"
    };

    const isOnChatGPT = () =>
        location.hostname === "chatgpt.com" || location.hostname === "chat.openai.com";

    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
    const PANEL_BOUNDARY_PADDING = 10;

    const storageGet = (key) =>
        new Promise((resolve) => chrome.storage.local.get([key], (r) => resolve(r[key])));

    const storageSet = (obj) =>
        new Promise((resolve) => chrome.storage.local.set(obj, () => resolve()));

    const debounce = (fn, delay = 200) => {
        let t = null;
        return (...args) => {
            clearTimeout(t);
            t = setTimeout(() => fn(...args), delay);
        };
    };

    const getScroller = () =>
        Array.from(document.querySelectorAll('div[data-scroll-root]'))
            .find(el => el.scrollHeight > el.clientHeight) ||
        document.scrollingElement ||
        document.documentElement;

    const offsetTopIn = (target, container) => {
        const tr = target.getBoundingClientRect();
        const cr = container.getBoundingClientRect?.() ?? { top: 0 };
        return (tr.top - cr.top) + (container.scrollTop ?? 0);
    };

    // Shadow host
    const ensureHost = () => {
        let host = document.getElementById(HOST_ID);
        if (!host) {
            host = document.createElement("div");
            host.id = HOST_ID;
            // pointer-events: none 让它不挡网页，面板本身会开启 pointer-events
            host.style.cssText = "all: initial; position: fixed; inset: 0; z-index: 2147483647; pointer-events: none;";
            document.documentElement.appendChild(host);
        }

        let root = host.querySelector(`#${ROOT_ID}`);
        if (!root) {
            root = document.createElement("div");
            root.id = ROOT_ID;
            root.style.cssText = "position: fixed; top: 0; left: 0; pointer-events: none;";
            host.appendChild(root);
        }

        const shadow = root.shadowRoot || root.attachShadow({ mode: "open" });
        return { host, root, shadow };
    };

    // 收集消息：根据 settings.selector / roleMode / parityReverse
    const collectItems = (settings) => {
        const selector = settings.useCustomSelector
            ? (settings.customSelector || DEFAULT_SETTINGS.customSelector)
            : DEFAULT_SETTINGS.customSelector;

        let els;
        try {
            els = Array.from(document.querySelectorAll(selector));
        } catch {
            return [];
        }

        const out = [];
        let n = 0; // 有效元素计数（从 0 开始）

        for (const el of els) {
            // 你的“有效”定义：必须有 :scope > .sr-only 且 text 非空
            let srText = "";
            if (settings.requireSrOnly) {
                const sr = el.querySelector?.(":scope > .sr-only");
                srText = (sr?.textContent || "").trim();
                if (!srText) continue; // requireSrOnly=true 时，没 sr-only / 空 => 无效
            }

            // clone 去掉 sr-only 后取正文
            const clone = el.cloneNode(true);
            clone.querySelector?.(".sr-only")?.remove();
            const text = (clone.innerText || clone.textContent || "").trim();
            if (!text) continue;

            let role = "none";
            if (settings.roleMode === "parity") {
                // n%2==0 => user，否则 assistant；parityReverse 则反转
                const isUser = (n % 2 === 0);
                const finalIsUser = settings.parityReverse ? !isUser : isUser;
                role = finalIsUser ? "user" : "assistant";
            } else {
                role = "none";
            }

            n++;
            out.push({ el, role, text });
        }

        return out;
    };

    const buildUI = async () => {
        if (!isOnChatGPT()) return;

        // 防止重复注入（只允许一次）
        if (window.__CGJP_BOOTSTRAPPED__) return;
        window.__CGJP_BOOTSTRAPPED__ = true;

        const { shadow } = ensureHost();

        // 读取 state & settings
        const savedState = (await storageGet(EXT_KEY_STATE)) || {};
        const savedSettings = (await storageGet(EXT_KEY_SETTINGS)) || {};

        const state = { ...DEFAULT_STATE, ...savedState };
        const settings = { ...DEFAULT_SETTINGS, ...savedSettings };
        if (settings.useCustomSelector && savedSettings.requireSrOnly == null) {
            settings.requireSrOnly = false;
        }
        // 首次注入时，如果用户设置 defaultHidden，则默认隐藏
        // （但如果 state.hidden 之前已保存，就尊重它）
        if (savedState.hidden == null && settings.defaultHidden) {
            state.hidden = true;
            await storageSet({ [EXT_KEY_STATE]: state });
        }

        // UI 样式 & DOM
        shadow.innerHTML = "";

        const style = document.createElement("style");
        style.textContent = `
      :host, * { box-sizing: border-box; }
      button {
        cursor: pointer;
        border: 1px solid rgba(255,255,255,0.18);
        background: rgba(255,255,255,0.08);
        color: #eee;
        border-radius: 8px;
        padding: 4px 6px;
        font-size: 12px;
        line-height: 1;
      }
      button:hover { background: rgba(255,255,255,0.14); }
      .panel {
        position: fixed;
        width: 280px;
        background: rgba(16,16,16,0.90);
        color: #eee;
        font: 12px/1.3 system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Noto Sans";
        border-radius: 12px;
        box-shadow: 0 10px 28px rgba(0,0,0,0.45);
        backdrop-filter: blur(8px);
        overflow: hidden;
        pointer-events: auto;
      }
      .dragbar {
        height: 18px;
        cursor: move;
        background: rgba(128, 128, 128, 0.57);
      }
      .header {
        display:flex;
        align-items:center;
        justify-content:space-between;
        padding: 8px 8px 6px 8px;
        gap: 8px;
        user-select: none;
      }
      .title {
        font-weight: 700;
        display:flex;
        align-items:center;
        gap: 8px;
      }
      .count {
        opacity: .7;
        font-weight: 400;
      }
      .btnrow { display:flex; gap:6px; align-items:center; }
      .content {
        padding: 0 8px 8px 8px;
        max-height: 70vh;
        overflow: auto;
        scrollbar-width: thin;
        scrollbar-color: #3f3f3f transparent;
        user-select: none;
      }
      .content::-webkit-scrollbar { width: 6px; height: 6px; }
      .content::-webkit-scrollbar-track { background: transparent; }
      .content::-webkit-scrollbar-thumb { background-color: #3f3f3f; border-radius: 999px; }
      .content::-webkit-scrollbar-thumb:hover { background-color: #5a5a5a; }

      .item {
        position: relative;
        cursor: pointer;
        padding: 7px 8px 7px 10px;
        border-radius: 10px;
        margin-bottom: 5px;
        transition: background 0.12s;
        background: transparent;
      }
      .item:hover { background: rgba(255,255,255,0.10); }
      .bar {
        position:absolute;
        left: 4px;
        top: 8px;
        bottom: 8px;
        width: 3px;
        border-radius: 999px;
        opacity: 0.95;
      }
      .label { padding-left: 6px; }
      .empty { opacity:.7; padding: 8px 2px; }
      .subhint { opacity:.55; font-size: 11px; padding: 0 8px 8px 8px; }
    `;
        shadow.appendChild(style);

        const panel = document.createElement("div");
        panel.className = "panel";
        panel.style.top = (state.top ?? 80) + "px";
        if (state.left == null) {
            panel.style.right = "12px";
        } else {
            panel.style.left = state.left + "px";
            panel.style.right = "auto";
        }
        panel.style.display = state.hidden ? "none" : "block";

        const dragBar = document.createElement("div");
        dragBar.className = "dragbar";

        const header = document.createElement("div");
        header.className = "header";

        const title = document.createElement("div");
        title.className = "title";
        title.innerHTML = `💬 对话跳转 <span class="count" id="count">0</span>`;

        const btnRow = document.createElement("div");
        btnRow.className = "btnrow";

        const refreshBtn = document.createElement("button");
        refreshBtn.textContent = "↻";
        refreshBtn.title = "刷新列表";

        const toggleMinBtn = document.createElement("button");
        toggleMinBtn.textContent = state.minimized ? "▢" : "—";
        toggleMinBtn.title = state.minimized ? "还原" : "最小化";
        // if (!state.hidden) ensurePanelInViewport();

        btnRow.appendChild(refreshBtn);
        btnRow.appendChild(toggleMinBtn);

        header.appendChild(title);
        header.appendChild(btnRow);

        const content = document.createElement("div");
        content.className = "content";
        content.style.display = state.minimized ? "none" : "block";

        const subhint = document.createElement("div");
        subhint.className = "subhint";

        panel.appendChild(dragBar);
        panel.appendChild(header);
        panel.appendChild(content);
        panel.appendChild(subhint);

        // root 接收 pointer-events: none，这里要放在 shadow 里直接 append
        shadow.appendChild(panel);

        const persistState = debounce(async () => {
            await storageSet({ [EXT_KEY_STATE]: state });
        }, 120);

        const ensurePanelInViewport = () => {
            const rect = panel.getBoundingClientRect();
            // display:none 时宽高为 0，此时不调整避免覆盖已有坐标
            if (!rect.width && !rect.height) return;

            const maxLeft = window.innerWidth - rect.width - PANEL_BOUNDARY_PADDING;
            const maxTop = window.innerHeight - rect.height - PANEL_BOUNDARY_PADDING;

            const nextLeft = clamp(rect.left, PANEL_BOUNDARY_PADDING, maxLeft);
            const nextTop = clamp(rect.top, PANEL_BOUNDARY_PADDING, maxTop);

            panel.style.left = nextLeft + "px";
            panel.style.top = nextTop + "px";
            panel.style.right = "auto";

            state.left = nextLeft;
            state.top = nextTop;
            persistState();
        };

        const scheduleEnsurePanel = debounce(ensurePanelInViewport, 120);

        // 渲染
        const render = () => {
            const scroller = getScroller();
            const items = collectItems(settings);

            shadow.getElementById("count").textContent = String(items.length);

            // 展示一下当前 selector / roleMode 状态，便于你 debug（可删）
            const selectorUsed = settings.useCustomSelector
                ? (settings.customSelector || DEFAULT_SETTINGS.customSelector)
                : DEFAULT_SETTINGS.customSelector;
            subhint.textContent = `selector: ${selectorUsed} · role: ${settings.roleMode}${settings.roleMode === "parity" ? (settings.parityReverse ? " (reversed)" : "") : ""}`;

            content.innerHTML = "";
            if (state.minimized) {
                content.style.display = "none";
                return;
            }
            content.style.display = "block";

            if (!items.length) {
                const empty = document.createElement("div");
                empty.className = "empty";
                empty.textContent = "未找到有效消息（需存在非空 :scope > .sr-only 且正文非空）";
                content.appendChild(empty);
                return;
            }

            items.forEach(({ el, role, text }, i) => {
                let accent = "#6b7280"; // none: gray
                if (role === "user") accent = settings.userColor || DEFAULT_SETTINGS.userColor;
                else if (role === "assistant") accent = settings.assistantColor || DEFAULT_SETTINGS.assistantColor;

                const item = document.createElement("div");
                item.className = "item";

                const bar = document.createElement("div");
                bar.className = "bar";
                bar.style.background = accent;

                const label = document.createElement("div");
                label.className = "label";
                label.textContent = `${i + 1}. ${text.replace(/\s+/g, " ").slice(0, 52)}`;

                item.appendChild(bar);
                item.appendChild(label);

                item.addEventListener("click", () => {
                    const top = offsetTopIn(el, scroller);
                    scroller.scrollTo({ top: Math.max(top - 80, 0), behavior: "smooth" });

                    el.style.outline = `2px solid ${accent}`;
                    el.style.outlineOffset = "2px";
                    setTimeout(() => {
                        el.style.outline = "";
                        el.style.outlineOffset = "";
                    }, 1200);
                });

                content.appendChild(item);
            });
        };

        const scheduleRender = debounce(render, 200);

        // 按钮
        refreshBtn.addEventListener("click", render);

        toggleMinBtn.addEventListener("click", () => {
            state.minimized = !state.minimized;
            toggleMinBtn.textContent = state.minimized ? "▢" : "—";
            toggleMinBtn.title = state.minimized ? "还原" : "最小化";
            persistState();
            render();
        });

        // 拖拽
        (() => {
            let dragging = false;
            let startX = 0, startY = 0;
            let startLeft = 0, startTop = 0;

            const onMove = (e) => {
                if (!dragging) return;
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;

                let newLeft = startLeft + dx;
                let newTop = startTop + dy;

                const rect = panel.getBoundingClientRect();
                const maxLeft = window.innerWidth - rect.width - PANEL_BOUNDARY_PADDING;
                const maxTop = window.innerHeight - rect.height - PANEL_BOUNDARY_PADDING;

                newLeft = clamp(newLeft, PANEL_BOUNDARY_PADDING, maxLeft);
                newTop = clamp(newTop, PANEL_BOUNDARY_PADDING, maxTop);

                panel.style.left = newLeft + "px";
                panel.style.top = newTop + "px";
                panel.style.right = "auto";

                state.left = newLeft;
                state.top = newTop;
                persistState();
            };

            const onUp = () => {
                dragging = false;
                window.removeEventListener("mousemove", onMove, true);
                window.removeEventListener("mouseup", onUp, true);
            };

            dragBar.addEventListener("mousedown", (e) => {
                dragging = true;
                const rect = panel.getBoundingClientRect();
                startX = e.clientX;
                startY = e.clientY;
                startLeft = rect.left;
                startTop = rect.top;

                window.addEventListener("mousemove", onMove, true);
                window.addEventListener("mouseup", onUp, true);

                e.preventDefault();
                e.stopPropagation();
            });
        })();

        // keep panel within viewport with a 10px inset when the window resizes
        window.addEventListener("resize", scheduleEnsurePanel);

        // 监听 DOM 变化（新消息/路由切换）
        const observer = new MutationObserver(() => scheduleRender());
        observer.observe(document.body, { childList: true, subtree: true });

        // 监听 storage：你改 options 后，开着的 ChatGPT 页面能自动更新
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area !== "local") return;

            if (changes[EXT_KEY_SETTINGS]?.newValue) {
                const nv = changes[EXT_KEY_SETTINGS].newValue;
                Object.assign(settings, DEFAULT_SETTINGS, nv);
                scheduleRender();
            }

            if (changes[EXT_KEY_STATE]?.newValue) {
                const nv = changes[EXT_KEY_STATE].newValue;
                Object.assign(state, DEFAULT_STATE, nv);
                // 同步可见性
                panel.style.display = state.hidden ? "none" : "block";
                // 同步最小化显示
                toggleMinBtn.textContent = state.minimized ? "▢" : "—";
                toggleMinBtn.title = state.minimized ? "还原" : "最小化";
                if (!state.hidden) ensurePanelInViewport();
            }
        });

        // 监听扩展消息：图标/快捷键切换显示
        chrome.runtime.onMessage.addListener((msg) => {
            if (msg?.type === "CGJP_TOGGLE_PANEL") {
                state.hidden = !state.hidden;
                panel.style.display = state.hidden ? "none" : "block";
                persistState();
                if (!state.hidden) { render(); ensurePanelInViewport(); }
            }
        });

        // 首次渲染
        render();
        ensurePanelInViewport();
    };

    // 启动
    buildUI();
})();
