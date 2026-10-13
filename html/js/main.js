/* cam_tablet - main: Lua からのメッセージ処理と起動 */
(() => {
    'use strict';

    const T = window.Tablet;
    const { state } = T;

    function open(data) {
        data = data || {};
        const wasStandalone = state.standalone;
        state.config = data.config || state.config || {};
        state.standalone = !!data.standalone && !!data.openApp;
        state.standaloneApp = state.standalone ? data.openApp : null;
        state.profile = data.profile || {};
        state.notes = Array.isArray(data.notes) ? data.notes : [];
        state.events = Array.isArray(data.events) ? data.events : [];
        if (data.gameTime) state.gameTime = data.gameTime;
        T.setCatalog(data.catalog, data.installed);
        T.loadSettings(data.settings);

        // 前回開いていたアプリが使えなくなっていれば閉じる
        if (state.current && (!T.getApp(state.current.id) || state.standalone || wasStandalone || data.openApp)) {
            T.closeApp(false);
        }

        T.els.root.classList.toggle('kiosk', state.standalone);
        T.applySettings();
        T.renderHome();
        T.show();

        const target = data.openApp && T.getApp(data.openApp) ? data.openApp : null;
        if (state.standalone && !target) {
            // 専用アプリが見つからない (登録元リソースが停止中など)
            T.requestClose();
            return;
        }
        if (state.standalone && target) {
            state.locked = false;
            T.els.lockscreen.classList.add('hidden');
            T.openApp(target);
        } else if (state.settings.lockScreen) {
            state.pendingApp = target;
            T.lock(false);
        } else {
            state.locked = false;
            T.els.lockscreen.classList.add('hidden');
            if (target) T.openApp(target);
        }

        T.emit('open');
        state.ready = true;
    }

    function reset() {
        T.closeApp(false);
        state.notifications = [];
        state.badges = {};
        state.downloads = {};
        state.ready = false;
    }

    window.addEventListener('message', (e) => {
        const d = e.data;
        if (!d || typeof d !== 'object') return;
        if (d.camTablet) {
            T.handleIframeMessage(e);
            return;
        }

        switch (d.action) {
            case 'open':
                open(d.data);
                break;
            case 'close':
                T.hide();
                break;
            case 'reset':
                reset();
                break;
            case 'openApp':
                if (T.getApp(d.app) && !state.standalone) {
                    if (state.locked) state.pendingApp = d.app;
                    else T.openApp(d.app);
                }
                break;
            case 'notify':
                if (d.data) T.notify(d.data);
                break;
            case 'gameTime':
                state.gameTime = d.data;
                if (state.settings.timeSource === 'game') T.updateClock();
                break;
            case 'catalog':
                T.setCatalog(d.data.catalog, d.data.installed);
                T.renderHome();
                T.emit('installed');
                break;
            case 'appMessage':
                T.sendToApp(d.app, d.data);
                break;
            default:
                break;
        }
    });

    document.addEventListener('keydown', (e) => {
        if (!state.open) return;
        if (T.lockKeydown(e)) return;
        if (e.key === 'Escape') {
            e.preventDefault();
            if (T.closeTopModal()) return;
            if (T.closeControlCenter()) return;
            if (T.exitEditMode()) return;
            T.hideContextMenu();
            T.requestClose();
        }
    });

    T.refresh = async function refresh() {
        const data = await T.nui('refresh');
        if (!data) return;
        T.setCatalog(data.catalog, data.installed);
        if (data.profile) state.profile = data.profile;
        T.renderHome();
        T.emit('installed');
        T.emit('profile');
    };

    document.addEventListener('DOMContentLoaded', () => {
        T.initUi();
        if (!T.IS_FIVEM && T.mock) T.mock.boot(open);
    });
})();
