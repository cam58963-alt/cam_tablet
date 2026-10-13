/* cam_tablet - ui: ホーム画面・アプリウィンドウ・ロック画面・通知など */
(() => {
    'use strict';

    const T = window.Tablet;
    const { h, $, state } = T;

    const els = {};
    const BASE_W = 1280 + 56;
    const BASE_H = 820 + 56;

    T.ui = {};

    function cacheEls() {
        ['root', 'tablet', 'screen', 'wallpaper', 'wallpaper-dim', 'statusbar', 'sb-time', 'sb-date', 'sb-right', 'home', 'widgets',
            'app-grid', 'dock', 'edit-done', 'app-layer', 'lockscreen', 'control-center', 'context-menu', 'modal-layer', 'toasts', 'homebar', 'brightness']
            .forEach((id) => { els[id] = document.getElementById(id); });
        T.els = els;
    }

    /* ================= Settings / Scale ================= */

    T.wallpaperStyle = function wallpaperStyle(value) {
        const cfg = state.config.wallpapers || [];
        if (typeof value === 'string' && value.startsWith('url:')) {
            return { backgroundImage: `url("${value.slice(4)}")`, background: '' };
        }
        const id = typeof value === 'string' && value.startsWith('preset:') ? value.slice(7) : state.config.defaultWallpaper;
        const wp = cfg.find((w) => w.id === id) || cfg[0];
        if (!wp) return { background: 'linear-gradient(160deg, #1d2b64, #f8cdda)' };
        if (wp.src) return { background: '', backgroundImage: `url("${wp.src}")` };
        return { backgroundImage: '', background: wp.css };
    };

    T.applyWallpaper = function applyWallpaper(node, value) {
        const style = T.wallpaperStyle(value);
        node.style.background = '';
        node.style.backgroundImage = '';
        if (style.background) node.style.background = style.background;
        if (style.backgroundImage) node.style.backgroundImage = style.backgroundImage;
        node.style.backgroundSize = 'cover';
        node.style.backgroundPosition = 'center';
    };

    T.applySettings = function applySettings() {
        const s = state.settings;
        const root = els.root;
        root.dataset.theme = s.theme;
        root.dataset.iconSize = s.iconSize;
        root.classList.toggle('no-labels', !s.labels);
        root.classList.toggle('no-widgets', !s.widgets);
        root.style.setProperty('--accent', s.accent);
        root.style.setProperty('--accent-soft', `${s.accent}33`);
        T.applyWallpaper(els.wallpaper, s.wallpaper);
        els['wallpaper-dim'].style.opacity = String((s.wallpaperDim || 0) / 100);
        els.brightness.style.opacity = String((100 - s.brightness) / 100 * 0.85);
        updateScale();
        updateClock();
        T.emit('settings', s);
    };

    function updateScale() {
        const s = state.settings;
        const fit = Math.min(window.innerWidth / BASE_W, window.innerHeight / BASE_H);
        els.tablet.style.setProperty('--scale', String(fit * (s.scale / 100)));
    }

    /* ================= Clock / Statusbar ================= */

    function updateClock() {
        const d = T.now();
        els['sb-time'].textContent = T.formatTime(d);
        els['sb-date'].textContent = T.formatDate(d);
        const w = $('#w-clock-time');
        if (w) {
            w.textContent = T.formatTime(d);
            $('#w-clock-date').textContent = T.formatDate(d, true);
        }
        const lt = $('#lock-time');
        if (lt) {
            lt.textContent = T.formatTime(d);
            $('#lock-date').textContent = T.formatDate(d);
        }
        T.emit('tick', d);
    }
    T.updateClock = updateClock;

    /* ================= Home ================= */

    const DOCK_MAX = 6;

    function dockIds() {
        const list = Array.isArray(state.settings.dock) ? state.settings.dock : (state.config.dockApps || []);
        return list.filter((id) => T.isInstalled(id)).slice(0, DOCK_MAX);
    }
    T.dockIds = dockIds;

    let editing = false;
    let suppressClick = false;

    function iconTile(app, opts = {}) {
        const badge = state.badges[app.id];
        const progress = state.downloads[app.id];
        const tile = h('div', {
            class: `home-app${progress != null ? ' downloading' : ''}`,
            dataset: { app: app.id },
            onClick: (e) => {
                if (suppressClick) { suppressClick = false; return; }
                if (editing || state.downloads[app.id] != null) return;
                T.openApp(app.id, e.currentTarget.querySelector('.app-icon'));
            },
            onContextmenu: (e) => {
                e.preventDefault();
                if (!editing && state.downloads[app.id] == null) showContextMenu(app, e);
            },
            onPointerdown: (e) => onTilePointerDown(e, app, tile),
        },
        h('div', { class: 'icon-wrap' },
            T.appIcon(app),
            badge ? h('span', { class: 'badge' }, badge > 99 ? '99+' : badge) : null,
            progress != null ? h('div', { class: 'dl-ring', style: { '--p': progress } }) : null,
            T.isRemovable(app) && progress == null ? h('button', {
                class: 'del-badge',
                title: '削除',
                onPointerdown: (e) => e.stopPropagation(),
                onClick: (e) => { e.stopPropagation(); T.uninstallApp(app.id); },
            }, T.icon('fa-solid fa-minus')) : null),
        opts.label === false ? null : h('span', { class: 'home-label' }, app.label));
        return tile;
    }

    /* ================= Edit mode (並べ替え) ================= */

    T.enterEditMode = function enterEditMode() {
        if (editing || state.standalone) return;
        editing = true;
        hideContextMenu();
        els.root.classList.add('editing');
        T.sound('tap');
    };

    T.exitEditMode = function exitEditMode() {
        if (!editing) return false;
        editing = false;
        els.root.classList.remove('editing');
        return true;
    };

    function screenScale() {
        const sr = els.screen.getBoundingClientRect();
        return { sr, scale: sr.width / els.screen.offsetWidth };
    }

    function onTilePointerDown(e, app, tile) {
        if (e.button !== 0 || state.downloads[app.id] != null) return;
        if (editing) {
            startDrag(e, tile);
            return;
        }
        // 長押しで編集モード
        const sx = e.clientX;
        const sy = e.clientY;
        const timer = setTimeout(() => {
            cleanup();
            suppressClick = true;
            T.enterEditMode();
        }, 550);
        const onMove = (ev) => { if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > 8) cleanup(); };
        function cleanup() {
            clearTimeout(timer);
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', cleanup);
        }
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', cleanup);
    }

    function startDrag(e, tile) {
        e.preventDefault();
        const { sr, scale } = screenScale();
        const r = tile.getBoundingClientRect();
        const offX = (e.clientX - r.left) / scale;
        const offY = (e.clientY - r.top) / scale;
        const sx = e.clientX;
        const sy = e.clientY;
        let ghost = null;

        const onMove = (ev) => {
            if (!ghost) {
                if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return;
                ghost = tile.cloneNode(true);
                ghost.classList.add('drag-ghost');
                ghost.style.width = `${r.width / scale}px`;
                els.screen.append(ghost);
                tile.classList.add('drag-placeholder');
            }
            ghost.style.left = `${(ev.clientX - sr.left) / scale - offX}px`;
            ghost.style.top = `${(ev.clientY - sr.top) / scale - offY}px`;

            const under = document.elementFromPoint(ev.clientX, ev.clientY);
            if (!under) return;
            const container = under.closest('#app-grid, #dock');
            if (!container) return;
            if (container === els.dock && tile.parentElement !== els.dock && els.dock.querySelectorAll('.home-app').length >= DOCK_MAX) return;
            const target = under.closest('.home-app');
            if (target && target !== tile && target.parentElement === container) {
                const tr = target.getBoundingClientRect();
                const before = ev.clientX < tr.left + tr.width / 2;
                container.insertBefore(tile, before ? target : target.nextSibling);
            } else if (!target && tile.parentElement !== container) {
                container.append(tile);
            }
        };

        const onUp = () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            if (!ghost) return;
            ghost.remove();
            tile.classList.remove('drag-placeholder');
            suppressClick = true;
            setTimeout(() => { suppressClick = false; }, 0);
            commitLayout();
        };

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
    }

    function commitLayout() {
        const ids = (root) => [...root.querySelectorAll('.home-app')].map((n) => n.dataset.app).filter((id) => T.isInstalled(id));
        const dock = ids(els.dock);
        const grid = ids(els['app-grid']);
        const rest = state.installed.filter((id) => !dock.includes(id) && !grid.includes(id));
        state.installed = [...dock, ...grid, ...rest];
        T.updateSettings({ dock });
        T.nui('reorder', { order: state.installed });
        T.renderHome();
    }

    T.renderHome = function renderHome() {
        const dock = dockIds();
        const grid = T.clear(els['app-grid']);
        const ids = state.installed.filter((id) => !dock.includes(id));
        Object.keys(state.downloads).forEach((id) => { if (!ids.includes(id) && !dock.includes(id)) ids.push(id); });

        ids.forEach((id) => {
            const app = T.getApp(id);
            if (app) T.append(grid, iconTile(app));
        });

        if (!ids.length) {
            T.append(grid, h('div', { class: 'grid-empty' },
                T.icon('fa-solid fa-bag-shopping'),
                h('p', null, 'App Store からアプリをダウンロードしましょう')));
        }

        const dockEl = T.clear(els.dock);
        dock.forEach((id) => {
            const app = T.getApp(id);
            if (app) T.append(dockEl, iconTile(app, { label: false }));
        });
        dockEl.classList.toggle('hidden', dock.length === 0);

        renderWidgets();
    };

    function renderWidgets() {
        const w = T.clear(els.widgets);
        const d = T.now();
        const p = state.profile || {};

        T.append(w, h('div', { class: 'widget widget-clock' },
            h('div', { class: 'w-clock-time', id: 'w-clock-time' }, T.formatTime(d)),
            h('div', { class: 'w-clock-date', id: 'w-clock-date' }, T.formatDate(d, true)),
            h('div', { class: 'w-sub' }, T.icon('fa-solid fa-earth-asia'), ` ゲーム内 ${T.pad(state.gameTime.h)}:${T.pad(state.gameTime.m)}`)));

        if (p.name && p.name.trim()) {
            T.append(w, h('div', {
                class: 'widget widget-profile',
                onClick: () => T.isInstalled('profile') && T.openApp('profile'),
            },
            h('div', { class: 'w-avatar' }, (p.firstname || p.name || '?').trim().charAt(0)),
            h('div', { class: 'w-profile-text' },
                h('div', { class: 'w-name' }, p.name),
                h('div', { class: 'w-sub' }, [p.job, p.grade].filter(Boolean).join(' / ') || '無職')),
            h('div', { class: 'w-money' },
                h('div', null, T.icon('fa-solid fa-money-bill-wave'), ' ', T.money(p.cash)),
                h('div', null, T.icon('fa-solid fa-building-columns'), ' ', T.money(p.bank)))));
        }

        const notes = [...state.notes].sort((a, b) => (b.pinned - a.pinned) || (b.updated - a.updated));
        if (T.isInstalled('notes')) {
            T.append(w, h('div', { class: 'widget widget-notes', onClick: () => T.openApp('notes') },
                h('div', { class: 'w-title' }, T.icon('fa-solid fa-note-sticky'), ' メモ'),
                notes.length
                    ? h('ul', null, notes.slice(0, 3).map((n) => h('li', null, n.title || (n.body || '').split('\n')[0] || '新規メモ')))
                    : h('div', { class: 'w-sub' }, 'メモはありません')));
        }

        const today = T.dateKey(new Date());
        const upcoming = (state.events || []).filter((e) => e.date >= today).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
        if (T.isInstalled('calendar')) {
            T.append(w, h('div', { class: 'widget widget-events', onClick: () => T.openApp('calendar') },
                h('div', { class: 'w-title' }, T.icon('fa-solid fa-calendar-days'), ' 予定'),
                upcoming.length
                    ? h('ul', null, upcoming.slice(0, 3).map((e) => h('li', null,
                        h('span', { class: 'w-ev-date' }, `${Number(e.date.slice(5, 7))}/${Number(e.date.slice(8, 10))}`), ' ', e.text)))
                    : h('div', { class: 'w-sub' }, '今後の予定はありません')));
        }
    }

    /* ================= Context menu ================= */

    function hideContextMenu() {
        els['context-menu'].classList.add('hidden');
    }
    T.hideContextMenu = hideContextMenu;

    function showContextMenu(app, e) {
        const menu = T.clear(els['context-menu']);
        const screenRect = els.screen.getBoundingClientRect();
        const scale = screenRect.width / els.screen.offsetWidth;
        const x = (e.clientX - screenRect.left) / scale;
        const y = (e.clientY - screenRect.top) / scale;

        T.append(menu, 
            h('div', { class: 'cm-head' }, T.appIcon(app, 'small'), h('span', null, app.label)),
            h('button', { onClick: () => { hideContextMenu(); T.openApp(app.id); } }, T.icon('fa-solid fa-arrow-up-right-from-square'), ' 開く'),
            h('button', { onClick: () => { hideContextMenu(); T.enterEditMode(); } }, T.icon('fa-solid fa-table-cells'), ' ホーム画面を編集'),
            !T.isRemovable(app) ? null : h('button', { class: 'danger', onClick: () => { hideContextMenu(); T.uninstallApp(app.id); } },
                T.icon('fa-solid fa-trash'), ' アプリを削除'),
        );
        menu.classList.remove('hidden');
        const mw = menu.offsetWidth;
        const mh = menu.offsetHeight;
        menu.style.left = `${Math.min(x, els.screen.offsetWidth - mw - 12)}px`;
        menu.style.top = `${Math.min(y, els.screen.offsetHeight - mh - 12)}px`;
    }

    /* ================= App windows ================= */

    function closeCurrent(animate = true) {
        const cur = state.current;
        if (!cur) return;
        state.current = null;
        try { cur.mod && cur.mod.unmount && cur.mod.unmount(); } catch (e) { console.error(e); }
        cur.offs.forEach((off) => off());
        if (cur.iframe) T.nui('appClosed', { app: cur.id });
        els.root.classList.remove('in-app', 'app-dark');
        if (animate) {
            cur.win.classList.add('closing');
            setTimeout(() => cur.win.remove(), 260);
        } else {
            cur.win.remove();
        }
    }

    T.openApp = function openApp(id, originEl) {
        const app = T.getApp(id);
        if (!app) return T.toast({ title: 'エラー', message: 'アプリが見つかりません', icon: 'fa-solid fa-triangle-exclamation', color: '#ff453a' });
        if (state.locked) { state.pendingApp = id; return null; }
        // アプリ専用端末モードでは対象アプリ以外は開けない
        if (state.standalone && id !== state.standaloneApp) return null;
        // 通常モードではインストール済みのアプリしか開けない (OpenApp export などでストアを迂回させない)
        if (!state.standalone && !T.isInstalled(id) && id !== state.deviceApp) {
            T.toast({ title: app.label, message: 'このアプリはインストールされていません', icon: 'fa-solid fa-bag-shopping', color: '#0a84ff' });
            return null;
        }
        // 職業変更などで利用条件を満たさなくなったアプリは開けない (専用端末アイテムで開いた場合はサーバーが locked=false にする)
        if (app.locked) {
            T.toast({ title: app.label, message: 'このアプリを利用する権限がありません', icon: 'fa-solid fa-lock', color: '#ff453a' });
            return null;
        }
        T.exitEditMode();
        hideContextMenu();
        T.closeControlCenter();
        if (state.current && state.current.id === id) return state.current;
        closeCurrent(false);

        const win = h('div', { class: 'app-window opening', dataset: { app: id } });
        if (originEl && originEl.getBoundingClientRect) {
            const r = originEl.getBoundingClientRect();
            const sr = els.screen.getBoundingClientRect();
            const ox = ((r.left + r.width / 2 - sr.left) / sr.width) * 100;
            const oy = ((r.top + r.height / 2 - sr.top) / sr.height) * 100;
            win.style.transformOrigin = `${ox}% ${oy}%`;
        }
        T.append(els['app-layer'], win);
        requestAnimationFrame(() => requestAnimationFrame(() => win.classList.remove('opening')));

        const cur = { id, app, win, mod: null, iframe: null, offs: [] };
        state.current = cur;
        els.root.classList.add('in-app');
        els.root.classList.toggle('app-dark', !!(T.apps[id] && T.apps[id].dark));
        delete state.badges[id];
        T.renderHome();

        if (app.url) {
            win.classList.add('iframe-app');
            const iframe = h('iframe', { src: app.url, allow: 'autoplay; clipboard-write', class: 'app-iframe' });
            iframe.addEventListener('load', () => postToIframe(cur, {
                type: 'init', app: id, resource: app.resource, settings: publicSettings(), profile: state.profile, visible: state.open,
            }));
            cur.iframe = iframe;
            T.append(win, iframe);
            T.nui('appOpened', { app: id });
        } else if (T.apps[id]) {
            cur.mod = T.apps[id];
            const ctx = {
                app,
                on: (evt, fn) => { const off = T.on(evt, fn); cur.offs.push(off); return off; },
            };
            try {
                cur.mod.mount(win, ctx);
            } catch (e) {
                console.error(e);
                T.append(win, h('div', { class: 'app-error' }, T.icon('fa-solid fa-bug'), h('p', null, 'アプリの起動に失敗しました')));
            }
        } else {
            T.append(win, h('div', { class: 'app-error' }, T.icon('fa-solid fa-circle-question'),
                h('p', null, 'このアプリは利用できません'),
                h('small', null, `id: ${id}`)));
        }
        return cur;
    };

    T.goHome = function goHome() {
        hideContextMenu();
        if (T.closeControlCenter()) return;
        if (T.exitEditMode()) return;
        if (state.standalone) {
            // ホームには戻らず、アプリをトップ画面から開き直す (config: Config.AppItemHome)
            if ((state.config.appItemHome || 'restart') === 'close') {
                T.requestClose();
            } else {
                T.restartApp();
            }
            return;
        }
        closeCurrent(true);
    };

    T.closeApp = (animate) => closeCurrent(animate);

    // 今開いているアプリがもう使えないか (カタログから消えた / ロックされた / アンインストールされた)
    T.currentAppUnavailable = function currentAppUnavailable() {
        const cur = state.current && T.getApp(state.current.id);
        if (!state.current) return false;
        if (!cur) return true;
        if (state.standalone) return cur.id !== state.standaloneApp;
        if (cur.id === state.deviceApp) return false;
        return !!cur.locked || (!T.isInstalled(cur.id) && !cur.system);
    };

    T.restartApp = function restartApp() {
        const cur = state.current;
        const id = cur ? cur.id : state.standaloneApp;
        if (!id) return;
        closeCurrent(false);
        T.openApp(id);
    };

    function publicSettings() {
        const s = state.settings;
        return { theme: s.theme, accent: s.accent, clock24: s.clock24 };
    }

    function postToIframe(cur, msg) {
        if (cur && cur.iframe && cur.iframe.contentWindow) {
            cur.iframe.contentWindow.postMessage({ camTablet: true, ...msg }, '*');
        }
    }

    T.sendToApp = function sendToApp(appId, data) {
        const cur = state.current;
        if (cur && cur.id === appId) postToIframe(cur, { type: 'message', data });
    };

    T.on('settings', () => {
        const cur = state.current;
        if (cur && cur.iframe) postToIframe(cur, { type: 'settings', settings: publicSettings() });
    });
    T.on('visibility', (visible) => postToIframe(state.current, { type: 'visibility', visible }));
    // 開き直した時、開いたままの iframe アプリに最新のプロフィールを送る
    T.on('open', () => postToIframe(state.current, { type: 'profile', profile: state.profile }));
    T.on('profile', () => postToIframe(state.current, { type: 'profile', profile: state.profile }));

    // iframe アプリからのメッセージ
    T.handleIframeMessage = function handleIframeMessage(e) {
        const cur = state.current;
        if (!cur || !cur.iframe || e.source !== cur.iframe.contentWindow) return false;
        const d = e.data || {};
        switch (d.action) {
            case 'notify':
                T.notify({ title: d.title || cur.app.label, message: d.message, icon: d.icon || cur.app.icon, color: d.color || cur.app.color, app: cur.id });
                break;
            case 'toast':
                T.toast({ title: d.title || cur.app.label, message: d.message, icon: d.icon || cur.app.icon, color: d.color || cur.app.color });
                break;
            case 'confirm':
                T.confirm({ title: String(d.title || ''), message: d.message ? String(d.message) : '', okLabel: d.okLabel || 'OK', danger: !!d.danger })
                    .then((ok) => postToIframe(cur, { type: 'reply', id: d.id, result: ok }));
                break;
            case 'prompt':
                T.prompt({ title: String(d.title || ''), message: d.message ? String(d.message) : '', value: d.value || '', placeholder: d.placeholder || '', maxLength: Number(d.maxLength) || 200 })
                    .then((v) => postToIframe(cur, { type: 'reply', id: d.id, result: v }));
                break;
            case 'home':
                T.goHome();
                break;
            case 'close':
                T.requestClose();
                break;
            case 'event':
                T.nui('appEvent', { app: cur.id, event: String(d.event || ''), data: d.data });
                break;
            default:
                break;
        }
        return true;
    };

    /* ================= Install / Uninstall ================= */

    // ログアウトなどでセッションが変わったら進行中のダウンロードを無効にする
    let downloadGen = 0;
    T.cancelDownloads = function cancelDownloads() {
        downloadGen += 1;
        state.downloads = {};
    };

    T.downloadApp = function downloadApp(id) {
        const gen = downloadGen;
        const app = T.getApp(id);
        if (!app || T.isInstalled(id) || state.downloads[id] != null) return;
        const cfg = state.config.download || { msPerMB: 60, min: 1200, max: 8000 };
        const duration = Math.max(cfg.min, Math.min(cfg.max, (app.size || 10) * cfg.msPerMB));
        const started = performance.now();
        state.downloads[id] = 0;
        T.renderHome();
        T.emit('downloads');

        const step = () => {
            if (gen !== downloadGen) return; // 取り消された (別キャラクターに入らないように)
            const p = Math.min(1, (performance.now() - started) / duration);
            state.downloads[id] = p;
            document.querySelectorAll(`[data-app="${CSS.escape(id)}"] .dl-ring`).forEach((r) => r.style.setProperty('--p', p));
            T.emit('downloadProgress', { id, p });
            if (p < 1) {
                setTimeout(step, 80);
                return;
            }
            T.nui('install', { id }).then((res) => {
                if (gen !== downloadGen) return;
                delete state.downloads[id];
                if (res && res.ok) {
                    state.installed = res.installed || [...state.installed, id];
                    T.notify({ title: 'App Store', message: `「${app.label}」をインストールしました`, icon: app.icon, color: app.color, app: id, silentBadge: true });
                    T.sound('done');
                } else {
                    T.toast({ title: 'インストール失敗', message: (res && res.message) || '通信エラー', icon: 'fa-solid fa-triangle-exclamation', color: '#ff453a' });
                    T.sound('error');
                }
                T.renderHome();
                T.emit('downloads');
                T.emit('installed');
            });
        };
        step();
    };

    T.uninstallApp = async function uninstallApp(id) {
        const app = T.getApp(id);
        if (!T.isRemovable(app)) return false;
        const ok = await T.confirm({
            title: `「${app.label}」を削除しますか？`,
            message: 'このアプリは App Store から再ダウンロードできます。',
            okLabel: '削除',
            danger: true,
        });
        if (!ok) return false;
        const gen = state.sessionGen;
        const res = await T.nui('uninstall', { id });
        if (gen !== state.sessionGen) return false; // ログアウトをまたいだ古い応答は捨てる
        if (res && res.ok) {
            state.installed = res.installed || state.installed.filter((a) => a !== id);
            if (state.current && state.current.id === id) closeCurrent(true);
            T.renderHome();
            T.emit('installed');
            return true;
        }
        T.toast({ title: '削除できません', message: (res && res.message) || '通信エラー', icon: 'fa-solid fa-triangle-exclamation', color: '#ff453a' });
        return false;
    };

    /* ================= Notifications ================= */

    T.toast = function toast(n) {
        if (!state.open || !state.settings.toasts) return;
        const node = h('div', { class: 'toast', onClick: () => { if (n.app && T.isInstalled(n.app)) T.openApp(n.app); dismiss(); } },
            h('div', { class: 'toast-icon', style: { background: n.color || 'var(--accent)' } }, T.icon(n.icon || 'fa-solid fa-bell')),
            h('div', { class: 'toast-body' },
                h('div', { class: 'toast-title' }, n.title || '通知'),
                n.message ? h('div', { class: 'toast-msg' }, n.message) : null));
        T.append(els.toasts, node);
        function dismiss() {
            node.classList.add('out');
            setTimeout(() => node.remove(), 300);
        }
        setTimeout(dismiss, n.duration || 4200);
        while (els.toasts.children.length > 3) els.toasts.firstChild.remove();
    };

    T.notify = function notify(input) {
        const n = {
            id: T.uid(),
            title: String(input.title || '通知'),
            message: input.message != null ? String(input.message) : '',
            icon: input.icon || 'fa-solid fa-bell',
            color: input.color || null,
            app: input.app || null,
            time: Date.now(),
        };
        state.notifications.unshift(n);
        state.notifications.length = Math.min(state.notifications.length, 50);
        if (n.app && !input.silentBadge && !(state.current && state.current.id === n.app)) {
            state.badges[n.app] = (state.badges[n.app] || 0) + 1;
        }
        if (state.open) {
            if (state.locked) renderLockNotifications();
            else T.toast(n);
            if (!input.silentBadge) T.sound('notify');
        }
        T.renderHome();
        if (!els['control-center'].classList.contains('hidden')) renderControlCenter();
        T.emit('notification', n);
        return n;
    };

    function timeAgo(t) {
        const s = Math.floor((Date.now() - t) / 1000);
        if (s < 60) return 'たった今';
        if (s < 3600) return `${Math.floor(s / 60)}分前`;
        if (s < 86400) return `${Math.floor(s / 3600)}時間前`;
        return `${Math.floor(s / 86400)}日前`;
    }

    function notifItem(n, compact) {
        return h('div', { class: `notif${compact ? ' compact' : ''}`, onClick: () => { if (!state.locked && n.app && T.isInstalled(n.app)) T.openApp(n.app); } },
            h('div', { class: 'toast-icon', style: { background: n.color || 'var(--accent)' } }, T.icon(n.icon)),
            h('div', { class: 'toast-body' },
                h('div', { class: 'toast-title' }, n.title, h('span', { class: 'notif-time' }, timeAgo(n.time))),
                n.message ? h('div', { class: 'toast-msg' }, n.message) : null));
    }

    /* ================= Control center ================= */

    function renderControlCenter() {
        const cc = T.clear(els['control-center']);
        const s = state.settings;
        const tile = (icon, label, active, onClick) =>
            h('button', { class: `cc-tile${active ? ' active' : ''}`, onClick }, T.icon(icon), h('span', null, label));

        T.append(cc, 
            h('div', { class: 'cc-grid' },
                tile(s.theme === 'dark' ? 'fa-solid fa-moon' : 'fa-solid fa-sun', s.theme === 'dark' ? 'ダーク' : 'ライト', s.theme === 'dark',
                    () => { T.updateSettings({ theme: s.theme === 'dark' ? 'light' : 'dark' }); renderControlCenter(); }),
                tile(s.sounds ? 'fa-solid fa-bell' : 'fa-solid fa-bell-slash', 'サウンド', s.sounds,
                    () => { T.updateSettings({ sounds: !s.sounds }); renderControlCenter(); }),
                tile('fa-solid fa-lock', 'ロック', false, () => { T.closeControlCenter(); T.lock(true); }),
                tile('fa-solid fa-gear', '設定', false, () => { T.closeControlCenter(); T.openApp('settings'); })),
            h('div', { class: 'cc-slider' },
                T.icon('fa-solid fa-sun'),
                h('input', {
                    type: 'range', min: 30, max: 100, value: s.brightness,
                    onInput: (e) => T.updateSettings({ brightness: Number(e.target.value) }),
                })),
            h('div', { class: 'cc-notif-head' },
                h('span', null, '通知'),
                state.notifications.length ? h('button', {
                    onClick: () => { state.notifications = []; state.badges = {}; T.renderHome(); renderControlCenter(); },
                }, 'すべて消去') : null),
            h('div', { class: 'cc-notifs' },
                state.notifications.length
                    ? state.notifications.map((n) => notifItem(n))
                    : h('div', { class: 'cc-empty' }, T.icon('fa-regular fa-bell'), h('p', null, '新しい通知はありません'))),
        );
    }

    T.toggleControlCenter = function toggleControlCenter() {
        if (state.standalone) return;
        const cc = els['control-center'];
        if (cc.classList.contains('hidden')) {
            renderControlCenter();
            cc.classList.remove('hidden');
        } else {
            T.closeControlCenter();
        }
    };

    T.closeControlCenter = function closeControlCenter() {
        const cc = els['control-center'];
        if (cc.classList.contains('hidden')) return false;
        cc.classList.add('hidden');
        return true;
    };

    /* ================= Lock screen ================= */

    let passInput = '';

    function renderLockNotifications() {
        const list = $('#lock-notifs');
        if (!list) return;
        T.clear(list);
        state.notifications.slice(0, 4).forEach((n) => T.append(list, notifItem(n, true)));
    }

    function renderLock(showPad) {
        const ls = T.clear(els.lockscreen);
        const d = T.now();
        const hasPass = !!state.settings.passcode;
        ls.classList.toggle('pad', !!showPad);

        T.append(ls, 
            h('div', { class: 'lock-top' },
                h('div', { class: 'lock-icon' }, T.icon('fa-solid fa-lock')),
                h('div', { class: 'lock-date', id: 'lock-date' }, T.formatDate(d)),
                h('div', { class: 'lock-time', id: 'lock-time' }, T.formatTime(d))),
        );

        if (showPad && hasPass) {
            const dots = h('div', { class: 'pass-dots' }, [0, 1, 2, 3].map((i) => h('span', { class: i < passInput.length ? 'filled' : '' })));
            const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];
            T.append(ls, h('div', { class: 'passpad' },
                h('div', { class: 'pass-title' }, 'パスコードを入力'),
                dots,
                h('div', { class: 'pass-keys' }, keys.map((k) => (k === ''
                    ? h('span')
                    : h('button', { class: k === 'del' ? 'pass-del' : 'pass-key', onClick: (e) => { e.stopPropagation(); passKey(k); } },
                        k === 'del' ? T.icon('fa-solid fa-delete-left') : k)))),
                h('button', { class: 'pass-cancel', onClick: (e) => { e.stopPropagation(); passInput = ''; renderLock(false); } }, 'キャンセル')));
        } else {
            T.append(ls, 
                h('div', { class: 'lock-notifs', id: 'lock-notifs' }),
                h('div', { class: 'lock-hint' }, T.icon('fa-solid fa-chevron-up'), h('span', null, hasPass ? 'クリックしてパスコードを入力' : 'クリックしてロック解除')),
            );
            renderLockNotifications();
        }
    }

    function passKey(k) {
        if (k === 'del') passInput = passInput.slice(0, -1);
        else if (passInput.length < 4) passInput += k;
        T.sound('tap');
        renderLock(true);
        if (passInput.length === 4) {
            if (passInput === state.settings.passcode) {
                passInput = '';
                setTimeout(() => T.unlock(), 120);
            } else {
                passInput = '';
                const pad = $('.passpad', els.lockscreen);
                if (pad) pad.classList.add('shake');
                T.sound('error');
                setTimeout(() => renderLock(true), 450);
            }
        }
    }

    T.lockKeydown = function lockKeydown(e) {
        if (!state.locked || !els.lockscreen.classList.contains('pad')) return false;
        if (/^[0-9]$/.test(e.key)) { passKey(e.key); return true; }
        if (e.key === 'Backspace') { passKey('del'); return true; }
        return false;
    };

    T.lock = function lock(animate) {
        state.locked = true;
        passInput = '';
        T.closeControlCenter();
        hideContextMenu();
        renderLock(false);
        els.lockscreen.classList.remove('hidden', 'unlocking');
        if (animate) {
            els.lockscreen.classList.add('locking');
            setTimeout(() => els.lockscreen.classList.remove('locking'), 350);
        }
    };

    T.unlock = function unlock() {
        state.locked = false;
        T.sound('unlock');
        els.lockscreen.classList.add('unlocking');
        setTimeout(() => {
            els.lockscreen.classList.add('hidden');
            els.lockscreen.classList.remove('unlocking', 'pad');
        }, 380);
        if (state.pendingApp) {
            const id = state.pendingApp;
            state.pendingApp = null;
            T.openApp(id);
        }
    };

    function onLockClick() {
        if (!state.locked) return;
        if (state.settings.passcode) {
            if (!els.lockscreen.classList.contains('pad')) renderLock(true);
        } else {
            T.unlock();
        }
    }

    /* ================= Modal ================= */

    T.modal = function modal(build) {
        return new Promise((resolve) => {
            const layer = els['modal-layer'];
            const backdrop = h('div', { class: 'modal-backdrop' });
            const box = h('div', { class: 'modal' });
            let closed = false;
            const done = (value) => {
                if (closed) return;
                closed = true;
                backdrop.classList.add('out');
                setTimeout(() => backdrop.remove(), 200);
                resolve(value);
            };
            backdrop._close = () => done(null);
            backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) done(null); });
            build(box, done);
            T.append(backdrop, box);
            T.append(layer, backdrop);
            const input = box.querySelector('input, textarea');
            if (input) setTimeout(() => input.focus(), 50);
        });
    };

    T.closeTopModal = function closeTopModal() {
        // 閉じるアニメーション中 (.out) の物は除外。除外しないと同じモーダルを返し続けてループが終わらない
        const open = els['modal-layer'].querySelectorAll('.modal-backdrop:not(.out)');
        const top = open[open.length - 1];
        if (!top) return false;
        top._close();
        return true;
    };

    T.confirm = function confirm({ title, message, okLabel = 'OK', cancelLabel = 'キャンセル', danger = false }) {
        return T.modal((box, done) => {
            T.append(box, 
                h('div', { class: 'modal-title' }, title),
                message ? h('div', { class: 'modal-msg' }, message) : null,
                h('div', { class: 'modal-actions' },
                    h('button', { class: 'btn', onClick: () => done(false) }, cancelLabel),
                    h('button', { class: `btn ${danger ? 'btn-danger' : 'btn-primary'}`, onClick: () => done(true) }, okLabel)));
        }).then((v) => v === true);
    };

    T.prompt = function prompt({ title, message, value = '', placeholder = '', okLabel = 'OK', maxLength = 200, type = 'text', inputMode }) {
        return T.modal((box, done) => {
            const input = h('input', { class: 'input', value, placeholder, maxLength, type });
            if (inputMode) input.setAttribute('inputmode', inputMode);
            input.addEventListener('keydown', (e) => { if (e.key === 'Enter') done(input.value); });
            T.append(box, 
                h('div', { class: 'modal-title' }, title),
                message ? h('div', { class: 'modal-msg' }, message) : null,
                input,
                h('div', { class: 'modal-actions' },
                    h('button', { class: 'btn', onClick: () => done(null) }, 'キャンセル'),
                    h('button', { class: 'btn btn-primary', onClick: () => done(input.value) }, okLabel)));
        });
    };

    /* ================= Open / Close ================= */

    T.show = function show() {
        state.open = true;
        els.root.classList.remove('hidden', 'closing');
        els.root.classList.add('opening');
        requestAnimationFrame(() => requestAnimationFrame(() => els.root.classList.remove('opening')));
        updateScale();
        updateClock();
        T.emit('visibility', true);
    };

    T.hide = function hide() {
        if (!state.open) return;
        state.open = false;
        T.flushSettings();
        T.exitEditMode();
        hideContextMenu();
        T.closeControlCenter();
        while (T.closeTopModal()) { /* close all */ }
        els.root.classList.add('closing');
        T.emit('visibility', false);
        setTimeout(() => {
            if (!state.open) els.root.classList.add('hidden');
        }, 260);
    };

    T.requestClose = function requestClose() {
        T.hide();
        T.nui('close');
    };

    /* ================= Init ================= */

    T.initUi = function initUi() {
        cacheEls();
        window.addEventListener('resize', updateScale);
        setInterval(() => { if (state.open) updateClock(); }, 1000);

        els.homebar.addEventListener('click', () => T.goHome());
        els['sb-right'].addEventListener('click', (e) => { e.stopPropagation(); if (!state.locked) T.toggleControlCenter(); });
        els.lockscreen.addEventListener('click', onLockClick);
        els.screen.addEventListener('mousedown', (e) => {
            if (!els['context-menu'].contains(e.target)) hideContextMenu();
            const cc = els['control-center'];
            if (!cc.classList.contains('hidden') && !cc.contains(e.target) && !els['sb-right'].contains(e.target)) T.closeControlCenter();
        });
        els.home.addEventListener('contextmenu', (e) => e.preventDefault());
        els['edit-done'].addEventListener('click', () => T.exitEditMode());
        els.home.addEventListener('click', (e) => {
            if (editing && !e.target.closest('.home-app, .widget')) T.exitEditMode();
        });
    };
})();
