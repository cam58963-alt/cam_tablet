/* cam_tablet - main: Lua からのメッセージ処理と起動 */
(() => {
    'use strict';

    const T = window.Tablet;
    const { state } = T;

    function open(data) {
        data = data || {};
        const wasStandalone = state.standalone;
        T.flushSettings();

        // 組み込みアプリはデータ (メモ・予定など) を差し替える前に一度閉じ、新しいデータで開き直す。
        // 開いたままだと古いオブジェクトを編集し続け、保存から漏れる。閉じる時に保留中の保存も送られる。
        let resumeId = null;
        if (state.current && state.current.mod) {
            if (!data.standalone && !wasStandalone && !data.openApp) resumeId = state.current.id;
            T.closeApp(false);
        }

        state.config = data.config || state.config || {};
        state.standalone = !!data.standalone && !!data.openApp;
        state.standaloneApp = state.standalone ? data.openApp : null;
        state.deviceApp = data.device && data.openApp ? data.openApp : null;
        state.profile = data.profile || {};
        state.notes = Array.isArray(data.notes) ? data.notes : [];
        state.events = Array.isArray(data.events) ? data.events : [];
        if (data.gameTime) state.gameTime = data.gameTime;
        T.setCatalog(data.catalog, data.installed);
        T.beginSettingsSession();
        T.loadSettings(data.settings);

        // 前回開いていたアプリが使えなくなっていれば閉じる
        if (state.current && (T.currentAppUnavailable() || state.standalone || wasStandalone || data.openApp)) {
            T.closeApp(false);
        }

        T.els.root.classList.toggle('kiosk', state.standalone);
        T.applySettings();
        T.renderHome();
        T.show();

        // 専用端末モード以外では、インストール済みのアプリだけを直接開ける (指定が無ければ前回開いていた組み込みアプリを再開)
        const requested = data.openApp || resumeId;
        const target = requested && T.getApp(requested) && (state.standalone || T.isInstalled(requested) || requested === state.deviceApp) ? requested : null;
        if (state.standalone && !target) {
            // 専用アプリが見つからない (登録元リソースが停止中など)
            T.requestClose();
            return;
        }
        if (state.standalone && target) {
            T.clearLock();
            T.openApp(target);
        } else if (state.settings.lockScreen) {
            state.pendingApp = target;
            T.lock(false);
        } else {
            T.clearLock();
            if (target) T.openApp(target);
        }

        T.emit('open');
        state.ready = true;
        notifyChanges(data);
    }

    // 職業変更などで自動インストール / アンインストールされたアプリを通知
    function notifyChanges({ added, removed } = {}) {
        if (Array.isArray(added) && added.length) {
            T.notify({ title: 'App Store', message: `アプリを追加しました: ${added.join('、')}`, icon: 'fa-solid fa-circle-down', color: '#0a84ff', silentBadge: true });
        }
        if (Array.isArray(removed) && removed.length) {
            T.notify({ title: 'App Store', message: `利用条件を満たさなくなったため削除しました: ${removed.join('、')}`, icon: 'fa-solid fa-trash', color: '#8e8e93', silentBadge: true });
        }
    }

    function reset() {
        T.closeApp(false);
        state.notifications = [];
        state.badges = {};
        T.cancelDownloads();
        T.flushSettings(); // 保存待ちの設定は前のキャラクターに保存する (開いた時のキャラクターIDが付く)
        T.beginSettingsSession(); // 送信中の設定の応答を新しいキャラクターに持ち込まない
        state.sessionGen += 1;
        T.emit('reset'); // タイマーなどキャラクター単位の状態を消す
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
                if (T.getApp(d.app) && T.isInstalled(d.app) && !state.standalone) {
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
                if (!d.data.device) state.deviceApp = null;
                // 職業/ギャング変更時は最新のプロフィールも反映
                if (d.data.profile) {
                    state.profile = d.data.profile;
                    T.emit('profile');
                }
                // 登録元リソースの停止などで専用端末のアプリが消えたらタブレットごと閉じる
                if (state.standalone && !T.getApp(state.standaloneApp)) {
                    T.requestClose();
                    break;
                }
                // 削除された / 利用条件を満たさなくなった (system + jobs のアプリは削除されずロックになる) アプリは閉じる
                if (!state.standalone && T.currentAppUnavailable()) T.closeApp(true);
                T.renderHome();
                T.emit('installed');
                notifyChanges(d.data);
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
