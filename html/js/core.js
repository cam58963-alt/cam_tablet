/* cam_tablet - core: 共有状態・ヘルパー・NUI通信 */
(() => {
    'use strict';

    const IS_FIVEM = typeof window.GetParentResourceName === 'function';
    const RESOURCE = IS_FIVEM ? window.GetParentResourceName() : 'cam_tablet';

    const DEFAULT_SETTINGS = {
        theme: 'dark',
        accent: '#0a84ff',
        wallpaper: '',
        wallpaperDim: 10,
        brightness: 100,
        scale: 90,
        clock24: true,
        timeSource: 'real',
        sounds: true,
        toasts: true,
        lockScreen: true,
        passcode: '',
        widgets: true,
        labels: true,
        iconSize: 'medium',
        deviceName: 'CamTab Pro',
        dock: false, // false = config の DockApps を使う
    };

    const listeners = {};

    const T = {
        IS_FIVEM,
        RESOURCE,
        DEFAULT_SETTINGS,
        apps: {}, // 組み込みアプリ (id -> module)

        state: {
            open: false,
            ready: false,
            catalog: [],
            catalogMap: {},
            installed: [],
            settings: { ...DEFAULT_SETTINGS },
            notes: [],
            events: [],
            profile: {},
            config: {},
            standalone: false,
            standaloneApp: null,
            locked: false,
            pendingApp: null,
            current: null, // { id, win, mod, iframe, offs }
            notifications: [],
            badges: {},
            downloads: {}, // id -> progress (0..1)
            gameTime: { h: 12, m: 0 },
        },

        registerApp(id, mod) {
            this.apps[id] = mod;
        },

        on(evt, fn) {
            (listeners[evt] = listeners[evt] || new Set()).add(fn);
            return () => listeners[evt] && listeners[evt].delete(fn);
        },

        emit(evt, data) {
            (listeners[evt] || []).forEach((fn) => {
                try { fn(data); } catch (e) { console.error(`[cam_tablet] listener ${evt}`, e); }
            });
        },

        async nui(name, data = {}) {
            if (!IS_FIVEM) return T.mock ? T.mock.handle(name, data) : null;
            try {
                const res = await fetch(`https://${RESOURCE}/${name}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
                    body: JSON.stringify(data),
                });
                return await res.json();
            } catch (e) {
                console.error(`[cam_tablet] nui ${name}`, e);
                return null;
            }
        },
    };

    /* ---------- DOM ---------- */

    const PROPS = new Set(['value', 'checked', 'disabled', 'selected', 'readOnly', 'placeholder', 'type', 'min', 'max', 'step', 'maxLength', 'tabIndex', 'src', 'title', 'htmlFor']);

    T.h = function h(tag, props, ...children) {
        const node = document.createElement(tag);
        if (props) {
            for (const [k, v] of Object.entries(props)) {
                if (v == null || v === false) continue;
                if (k === 'class') node.className = v;
                else if (k === 'style' && typeof v === 'object') {
                    for (const [sk, sv] of Object.entries(v)) {
                        if (sk.startsWith('--')) node.style.setProperty(sk, sv);
                        else node.style[sk] = sv;
                    }
                }
                else if (k === 'dataset') Object.assign(node.dataset, v);
                else if (k === 'ref') v(node);
                else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
                else if (PROPS.has(k)) node[k] = v;
                else node.setAttribute(k, v === true ? '' : v);
            }
        }
        T.append(node, children);
        return node;
    };

    // 配列・null を含む子要素を安全に追加する (ネイティブ append は配列や null を文字列化してしまう)
    T.append = function append(node, ...children) {
        for (const c of [children].flat(Infinity)) {
            if (c == null || c === false || c === true) continue;
            node.append(c instanceof Node ? c : document.createTextNode(String(c)));
        }
        return node;
    };

    T.clear = (node) => { while (node.firstChild) node.firstChild.remove(); return node; };

    T.$ = (sel, root = document) => root.querySelector(sel);

    T.icon = (cls, extra = '') => T.h('i', { class: `${cls} ${extra}`.trim() });

    /* ---------- Colors ---------- */

    T.shade = function shade(hex, percent) {
        const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
        if (!m) return hex;
        const num = parseInt(m[1], 16);
        const amt = Math.round(2.55 * percent);
        const clamp = (v) => Math.max(0, Math.min(255, v));
        const r = clamp((num >> 16) + amt);
        const g = clamp(((num >> 8) & 0xff) + amt);
        const b = clamp((num & 0xff) + amt);
        return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
    };

    T.isImageIcon = (icon) => typeof icon === 'string' && /^(https?:|nui:|\.{0,2}\/|data:image)|\.(png|jpe?g|svg|webp|gif)$/i.test(icon);

    T.appIcon = function appIcon(app, extraClass = '') {
        const color = app.color || '#5e5ce6';
        const node = T.h('div', {
            class: `app-icon ${extraClass}`.trim(),
            style: { background: `linear-gradient(145deg, ${T.shade(color, 18)}, ${color} 60%, ${T.shade(color, -12)})` },
        });
        if (T.isImageIcon(app.icon)) {
            node.classList.add('has-image');
            node.append(T.h('img', { src: app.icon, alt: '', draggable: 'false' }));
        } else {
            node.append(T.icon(app.icon || 'fa-solid fa-cube'));
        }
        return node;
    };

    /* ---------- Time ---------- */

    const WEEK = ['日', '月', '火', '水', '木', '金', '土'];
    T.WEEK = WEEK;

    T.now = function now() {
        const d = new Date();
        if (T.state.settings.timeSource === 'game' && T.state.gameTime) {
            d.setHours(T.state.gameTime.h, T.state.gameTime.m, 0, 0);
        }
        return d;
    };

    T.pad = (n, l = 2) => String(n).padStart(l, '0');

    T.formatTime = function formatTime(d, seconds = false) {
        const s = T.state.settings;
        let h = d.getHours();
        let suffix = '';
        if (!s.clock24) {
            suffix = h < 12 ? ' AM' : ' PM';
            h = h % 12 || 12;
        }
        const base = `${s.clock24 ? T.pad(h) : h}:${T.pad(d.getMinutes())}${seconds ? `:${T.pad(d.getSeconds())}` : ''}`;
        return base + suffix;
    };

    T.formatDate = (d, withYear = false) =>
        `${withYear ? `${d.getFullYear()}年` : ''}${d.getMonth() + 1}月${d.getDate()}日 (${WEEK[d.getDay()]})`;

    T.dateKey = (d) => `${d.getFullYear()}-${T.pad(d.getMonth() + 1)}-${T.pad(d.getDate())}`;

    T.money = (n) => `$${Number(n || 0).toLocaleString('en-US')}`;

    T.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

    T.debounce = function debounce(fn, ms) {
        let t = null;
        const wrapped = (...args) => {
            clearTimeout(t);
            t = setTimeout(() => { t = null; fn(...args); }, ms);
        };
        // 保留中の呼び出しがあれば即実行
        wrapped.flush = (...args) => {
            if (t === null) return;
            clearTimeout(t);
            t = null;
            fn(...args);
        };
        return wrapped;
    };

    /* ---------- Sound ---------- */

    let audioCtx;
    T.sound = function sound(type = 'notify') {
        if (!T.state.settings.sounds) return;
        try {
            audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
            const notes = {
                notify: [[880, 0], [1320, 0.09]],
                unlock: [[660, 0], [990, 0.06]],
                tap: [[520, 0]],
                error: [[300, 0], [220, 0.1]],
                done: [[784, 0], [988, 0.1], [1318, 0.2]],
                alarm: [[988, 0], [988, 0.2], [988, 0.4], [1318, 0.6]],
            }[type] || [[880, 0]];
            const t0 = audioCtx.currentTime;
            notes.forEach(([freq, at]) => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'sine';
                osc.frequency.value = freq;
                gain.gain.setValueAtTime(0.0001, t0 + at);
                gain.gain.exponentialRampToValueAtTime(0.12, t0 + at + 0.015);
                gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 0.18);
                osc.connect(gain).connect(audioCtx.destination);
                osc.start(t0 + at);
                osc.stop(t0 + at + 0.2);
            });
        } catch (e) { /* ignore */ }
    };

    /* ---------- Catalog helpers ---------- */

    T.getApp = (id) => T.state.catalogMap[id];
    T.isInstalled = (id) => T.state.installed.includes(id);

    T.setCatalog = function setCatalog(catalog, installed) {
        T.state.catalog = Array.isArray(catalog) ? catalog : [];
        T.state.catalogMap = Object.fromEntries(T.state.catalog.map((a) => [a.id, a]));
        if (installed) T.state.installed = (Array.isArray(installed) ? installed : []).filter((id) => T.state.catalogMap[id]);
        T.emit('catalog');
    };

    // 手動でアンインストールできるか (system / autoInstall は不可)
    T.isRemovable = (app) => !!app && !app.system && !app.autoInstall;

    T.storageUsed = () => T.state.installed.reduce((sum, id) => sum + ((T.getApp(id) || {}).size || 0), 0);

    /* ---------- Settings ---------- */

    const pushSettings = T.debounce(async () => {
        const result = await T.nui('saveSettings', { settings: T.state.settings });
        if (result && typeof result === 'object' && !Array.isArray(result)) {
            T.state.settings = { ...DEFAULT_SETTINGS, ...result };
            T.applySettings();
        }
    }, 400);

    T.updateSettings = function updateSettings(patch) {
        Object.assign(T.state.settings, patch);
        T.applySettings();
        pushSettings();
    };

    T.loadSettings = function loadSettings(raw) {
        const s = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
        T.state.settings = { ...DEFAULT_SETTINGS, ...s };
        if (!T.state.settings.wallpaper) {
            T.state.settings.wallpaper = `preset:${T.state.config.defaultWallpaper || 'aurora'}`;
        }
    };

    window.Tablet = T;
})();
