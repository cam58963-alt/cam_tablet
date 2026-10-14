/*
 * cam_tablet 外部アプリ SDK
 *
 * 外部リソースの iframe アプリから読み込んで使います:
 *   <link rel="stylesheet" href="nui://cam_tablet/html/sdk/cam-tablet.css">
 *   <script src="nui://cam_tablet/html/sdk/cam-tablet.js"></script>
 *
 * API:
 *   CamTablet.ready(fn)              初期化 (アプリ情報・設定・プロフィール受信) 後に fn(info) を呼ぶ
 *   CamTablet.notify(title, message) タブレットに通知 (通知センターに残る)
 *   CamTablet.toast(title, message)  一時的なバナーのみ
 *   CamTablet.confirm({title, message, okLabel, danger}) -> Promise<boolean>
 *   CamTablet.prompt({title, message, value, placeholder}) -> Promise<string|null>
 *   CamTablet.home()                 ホーム画面に戻る
 *   CamTablet.close()                タブレットを閉じる
 *   CamTablet.emit(event, data)      Lua の 'cam_tablet:client:appEvent' に送る
 *   CamTablet.post(name, data)       自分のリソースの RegisterNUICallback(name) を呼ぶ -> Promise
 *   CamTablet.on(type, fn)           'message' | 'settings' | 'visibility' | 'profile' | 'init'
 *   CamTablet.settings / .profile / .app / .resource
 */
(function () {
    'use strict';

    var listeners = {};
    var pending = {};
    var readyQueue = [];
    var seq = 0;

    function send(action, data) {
        var msg = { camTablet: true, action: action };
        for (var k in data || {}) msg[k] = data[k];
        window.parent.postMessage(msg, '*');
    }

    function request(action, data) {
        return new Promise(function (resolve) {
            var id = 'r' + (++seq);
            pending[id] = resolve;
            var payload = data || {};
            payload.id = id;
            send(action, payload);
        });
    }

    function fire(type, value) {
        (listeners[type] || []).forEach(function (fn) {
            try { fn(value); } catch (e) { console.error('[CamTablet]', e); }
        });
    }

    function applyTheme(settings) {
        var root = document.documentElement;
        root.dataset.theme = settings.theme || 'dark';
        if (settings.accent) root.style.setProperty('--ct-accent', settings.accent);
    }

    function resourceFromLocation() {
        var host = location.hostname || '';
        return host.indexOf('cfx-nui-') === 0 ? host.slice(8) : host;
    }

    var CamTablet = {
        app: null,
        resource: resourceFromLocation(),
        settings: { theme: 'dark', accent: '#0a84ff', clock24: true },
        profile: {},
        visible: true,
        isReady: false,

        ready: function (fn) {
            if (CamTablet.isReady) fn(CamTablet);
            else readyQueue.push(fn);
        },
        on: function (type, fn) {
            (listeners[type] = listeners[type] || []).push(fn);
            return function () {
                listeners[type] = (listeners[type] || []).filter(function (f) { return f !== fn; });
            };
        },
        notify: function (title, message, opts) {
            var o = opts || {};
            send('notify', { title: title, message: message, icon: o.icon, color: o.color });
        },
        toast: function (title, message, opts) {
            var o = opts || {};
            send('toast', { title: title, message: message, icon: o.icon, color: o.color });
        },
        confirm: function (opts) { return request('confirm', opts); },
        prompt: function (opts) { return request('prompt', opts); },
        home: function () { send('home'); },
        close: function () { send('close'); },
        emit: function (event, data) { send('event', { event: event, data: data }); },
        post: function (name, data) {
            return fetch('https://' + CamTablet.resource + '/' + name, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json; charset=UTF-8' },
                body: JSON.stringify(data || {}),
            }).then(function (r) { return r.json(); });
        },
    };

    window.addEventListener('message', function (e) {
        var d = e.data;
        if (!d || !d.camTablet || e.source !== window.parent) return;
        switch (d.type) {
            case 'init':
                CamTablet.app = d.app;
                if (d.resource) CamTablet.resource = d.resource;
                CamTablet.settings = d.settings || CamTablet.settings;
                CamTablet.profile = d.profile || {};
                CamTablet.visible = d.visible !== false;
                applyTheme(CamTablet.settings);
                CamTablet.isReady = true;
                fire('init', CamTablet);
                readyQueue.splice(0).forEach(function (fn) { fn(CamTablet); });
                break;
            case 'settings':
                CamTablet.settings = d.settings || CamTablet.settings;
                applyTheme(CamTablet.settings);
                fire('settings', CamTablet.settings);
                break;
            case 'profile':
                CamTablet.profile = d.profile || {};
                fire('profile', CamTablet.profile);
                break;
            case 'visibility':
                CamTablet.visible = !!d.visible;
                fire('visibility', CamTablet.visible);
                break;
            case 'message':
                fire('message', d.data);
                break;
            case 'reply':
                if (pending[d.id]) {
                    pending[d.id](d.result);
                    delete pending[d.id];
                }
                break;
            default:
                break;
        }
    });

    // ESC でタブレットを閉じられるようにする (iframe 内にフォーカスがある時)
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') send('close');
    });

    window.CamTablet = CamTablet;
})();
