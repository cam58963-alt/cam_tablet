/* 設定 */
(() => {
    'use strict';

    const T = window.Tablet;
    const { h, state } = T;

    function toggle(checked, onChange) {
        return h('label', { class: 'toggle' },
            h('input', { type: 'checkbox', checked, onChange: (e) => onChange(e.target.checked) }),
            h('span'));
    }

    function segmented(options, value, onChange) {
        return h('div', { class: 'segmented' }, options.map(([v, label]) =>
            h('button', { class: v === value ? 'active' : '', onClick: () => onChange(v) }, label)));
    }

    function row(icon, color, label, control, opts = {}) {
        return h('div', { class: `set-row${opts.onClick ? ' clickable' : ''}`, onClick: opts.onClick },
            icon ? h('div', { class: 'set-ico', style: { background: color } }, T.icon(icon)) : null,
            h('div', { class: 'set-label' }, label, opts.sub ? h('small', null, opts.sub) : null),
            h('div', { class: 'set-control' }, control));
    }

    function group(title, ...rows) {
        return h('div', { class: 'set-group' },
            title ? h('div', { class: 'set-group-title' }, title) : null,
            h('div', { class: 'set-card' }, rows));
    }

    function sizeText(mb) {
        return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`;
    }

    const SECTIONS = [
        { id: 'general', label: '一般', icon: 'fa-solid fa-gear', color: '#8e8e93' },
        { id: 'display', label: '画面表示', icon: 'fa-solid fa-sun', color: '#0a84ff' },
        { id: 'wallpaper', label: '壁紙', icon: 'fa-solid fa-image', color: '#32ade6' },
        { id: 'home', label: 'ホーム画面', icon: 'fa-solid fa-table-cells-large', color: '#5e5ce6' },
        { id: 'time', label: '日付と時刻', icon: 'fa-solid fa-clock', color: '#ff9f0a' },
        { id: 'lock', label: 'ロックとパスコード', icon: 'fa-solid fa-lock', color: '#ff375f' },
        { id: 'notify', label: '通知とサウンド', icon: 'fa-solid fa-bell', color: '#ff453a' },
        { id: 'apps', label: 'アプリ', icon: 'fa-solid fa-grip', color: '#30d158' },
    ];

    T.registerApp('settings', {
        mount(root, ctx) {
            let section = 'general';
            root.classList.add('app-settings');

            const sidebar = h('aside', { class: 'sidebar' });
            const main = h('main', { class: 'set-main' });
            T.append(root, h('div', { class: 'split' }, sidebar, main));

            const set = (patch) => { T.updateSettings(patch); renderMain(); };

            function renderSidebar() {
                T.clear(sidebar);
                const p = state.profile || {};
                T.append(sidebar, 
                    h('div', { class: 'side-title' }, '設定'),
                    h('div', { class: 'set-profile', onClick: () => T.isInstalled('profile') && T.openApp('profile') },
                        h('div', { class: 'w-avatar' }, (p.firstname || p.name || '?').trim().charAt(0) || '?'),
                        h('div', null,
                            h('div', { class: 'set-profile-name' }, (p.name || '').trim() || 'ゲスト'),
                            h('small', null, state.settings.deviceName))),
                    h('nav', { class: 'side-nav' }, SECTIONS.map((s) =>
                        h('button', { class: `side-item${section === s.id ? ' active' : ''}`, onClick: () => { section = s.id; render(); } },
                            h('span', { class: 'set-ico sm', style: { background: s.color } }, T.icon(s.icon)),
                            h('span', null, s.label)))),
                );
            }

            const views = {
                general() {
                    const used = T.storageUsed();
                    const cap = state.config.storageMB || 32768;
                    return [
                        group(null,
                            row(null, null, 'デバイス名', h('span', { class: 'set-value' }, state.settings.deviceName, ' ', T.icon('fa-solid fa-chevron-right')), {
                                onClick: async () => {
                                    const v = await T.prompt({ title: 'デバイス名', value: state.settings.deviceName, maxLength: 24 });
                                    if (v != null && v.trim()) set({ deviceName: v.trim().slice(0, 24) });
                                },
                            }),
                            row(null, null, 'モデル', h('span', { class: 'set-value' }, 'CamTab Pro 13"')),
                            row(null, null, 'ソフトウェア', h('span', { class: 'set-value' }, 'CamOS 1.0')),
                            row(null, null, 'インストール済みアプリ', h('span', { class: 'set-value' }, `${state.installed.length}`)),
                            state.config.serverName ? row(null, null, 'サーバー', h('span', { class: 'set-value' }, state.config.serverName)) : null),
                        group('ストレージ',
                            h('div', { class: 'storage' },
                                h('div', { class: 'storage-head' }, h('b', null, `${sizeText(used)} 使用済み`), h('span', null, `${sizeText(cap)} 中`)),
                                h('div', { class: 'storage-bar' },
                                    state.installed.map((id) => {
                                        const a = T.getApp(id);
                                        return a ? h('span', { style: { width: `${(a.size / cap) * 100}%`, background: a.color }, title: a.label }) : null;
                                    })))),
                        group(null,
                            row(null, null, h('span', { class: 'danger-text' }, '設定をリセット'), null, {
                                onClick: async () => {
                                    const ok = await T.confirm({ title: '設定をリセットしますか？', message: '壁紙・テーマ・パスコードなどが初期状態に戻ります。アプリとメモは削除されません。', okLabel: 'リセット', danger: true });
                                    if (!ok) return;
                                    await T.resetSettings();
                                    render();
                                },
                            })),
                    ];
                },

                display() {
                    const s = state.settings;
                    const colors = state.config.accentColors || [];
                    return [
                        group('外観',
                            h('div', { class: 'theme-pick' },
                                [['light', 'ライト'], ['dark', 'ダーク']].map(([v, label]) =>
                                    h('button', { class: `theme-opt${s.theme === v ? ' active' : ''}`, onClick: () => set({ theme: v }) },
                                        h('div', { class: `theme-preview ${v}` }, h('span'), h('span'), h('span')),
                                        h('div', null, label),
                                        h('div', { class: 'radio' }))))),
                        group('アクセントカラー',
                            h('div', { class: 'swatches' },
                                colors.map((c) => h('button', { class: `swatch${s.accent === c ? ' active' : ''}`, style: { background: c }, onClick: () => set({ accent: c }) })),
                                h('label', { class: 'swatch custom', title: 'カスタム' },
                                    T.icon('fa-solid fa-eye-dropper'),
                                    h('input', { type: 'color', value: s.accent, onChange: (e) => set({ accent: e.target.value }) })))),
                        group('明るさと表示',
                            row('fa-solid fa-sun', '#ff9f0a', '明るさ',
                                h('input', { type: 'range', min: 30, max: 100, value: s.brightness, class: 'set-range', onInput: (e) => T.updateSettings({ brightness: Number(e.target.value) }) })),
                            row('fa-solid fa-up-right-and-down-left-from-center', '#5e5ce6', '画面サイズ',
                                h('div', { class: 'range-wrap' },
                                    h('input', {
                                        type: 'range', min: 60, max: 120, step: 5, value: s.scale, class: 'set-range',
                                        onInput: (e) => { T.updateSettings({ scale: Number(e.target.value) }); e.target.nextSibling.textContent = `${e.target.value}%`; },
                                    }),
                                    h('span', { class: 'range-val' }, `${s.scale}%`)))),
                    ];
                },

                wallpaper() {
                    const s = state.settings;
                    const wps = state.config.wallpapers || [];
                    const preview = h('div', { class: 'wp-preview' });
                    T.applyWallpaper(preview, s.wallpaper);
                    T.append(preview, h('div', { class: 'wp-preview-time' }, T.formatTime(T.now())));
                    const isUrl = s.wallpaper.startsWith('url:');

                    const urlInput = h('input', { class: 'input', placeholder: 'https://example.com/image.jpg', value: isUrl ? s.wallpaper.slice(4) : '', maxLength: 512 });
                    return [
                        h('div', { class: 'wp-top' },
                            preview,
                            h('div', { class: 'wp-top-side' },
                                h('div', { class: 'set-group-title' }, '壁紙を暗くする'),
                                h('div', { class: 'range-wrap' },
                                    h('input', {
                                        type: 'range', min: 0, max: 80, value: s.wallpaperDim, class: 'set-range',
                                        onInput: (e) => { T.updateSettings({ wallpaperDim: Number(e.target.value) }); e.target.nextSibling.textContent = `${e.target.value}%`; },
                                    }),
                                    h('span', { class: 'range-val' }, `${s.wallpaperDim}%`)))),
                        group('プリセット',
                            h('div', { class: 'wp-grid' }, wps.map((wp) => {
                                const thumb = h('button', { class: `wp-thumb${s.wallpaper === `preset:${wp.id}` ? ' active' : ''}`, onClick: () => set({ wallpaper: `preset:${wp.id}` }) },
                                    h('span', null, wp.label));
                                T.applyWallpaper(thumb, `preset:${wp.id}`);
                                return thumb;
                            }))),
                        state.config.allowCustomWallpaper ? group('画像URLから設定',
                            h('div', { class: 'wp-url' },
                                urlInput,
                                h('button', {
                                    class: 'btn btn-primary',
                                    onClick: () => {
                                        const url = urlInput.value.trim();
                                        if (!/^https?:\/\/[^\s"'()\\<>]+$/.test(url) || url.length > 512) {
                                            T.toast({ title: '壁紙', message: '有効な画像URL (http/https) を入力してください', icon: 'fa-solid fa-triangle-exclamation', color: '#ff453a' });
                                            return;
                                        }
                                        set({ wallpaper: `url:${url}` });
                                    },
                                }, '適用')),
                            h('small', { class: 'set-hint' }, 'imgur などの画像直リンクに対応しています。')) : null,
                    ];
                },

                home() {
                    const s = state.settings;
                    return [
                        group('レイアウト',
                            row('fa-solid fa-table-columns', '#5e5ce6', 'ウィジェットを表示', toggle(s.widgets, (v) => set({ widgets: v }))),
                            row('fa-solid fa-font', '#0a84ff', 'アプリ名を表示', toggle(s.labels, (v) => set({ labels: v }))),
                            row('fa-solid fa-expand', '#30d158', 'アイコンサイズ',
                                segmented([['small', '小'], ['medium', '中'], ['large', '大']], s.iconSize, (v) => set({ iconSize: v })))),
                        group(null,
                            row('fa-solid fa-up-down-left-right', '#ff9f0a', 'ホーム画面を編集', T.icon('fa-solid fa-chevron-right'), {
                                sub: 'ドラッグで並べ替え・ドックへの出し入れができます',
                                onClick: () => { T.goHome(); T.enterEditMode(); },
                            }),
                            row('fa-solid fa-rotate-left', '#8e8e93', 'ドックを初期状態に戻す', T.icon('fa-solid fa-chevron-right'), {
                                onClick: () => { set({ dock: false }); T.renderHome(); },
                            })),
                        h('small', { class: 'set-hint' }, 'アイコンを長押し (または右クリック →「ホーム画面を編集」) で編集モードになります。ドックには最大6個まで置けます。'),
                    ];
                },

                time() {
                    const s = state.settings;
                    return [
                        group(null,
                            row('fa-solid fa-clock', '#ff9f0a', '24時間表示', toggle(s.clock24, (v) => set({ clock24: v }))),
                            row('fa-solid fa-earth-asia', '#30d158', '時刻の基準',
                                segmented([['real', '現実時間'], ['game', 'ゲーム内']], s.timeSource, (v) => set({ timeSource: v })),
                                { sub: 'ゲーム内時間を選ぶと、ステータスバーや時計にGTA内の時刻を表示します' })),
                        h('div', { class: 'time-preview' },
                            h('div', null, h('small', null, '現実時間'), h('b', null, T.formatTime(new Date()))),
                            h('div', null, h('small', null, 'ゲーム内'), h('b', null, `${T.pad(state.gameTime.h)}:${T.pad(state.gameTime.m)}`))),
                    ];
                },

                lock() {
                    const s = state.settings;
                    return [
                        group(null,
                            row('fa-solid fa-mobile-screen', '#ff375f', 'ロック画面を表示', toggle(s.lockScreen, (v) => set({ lockScreen: v })), { sub: '開いた時にロック画面を表示します' }),
                            row('fa-solid fa-key', '#ff9f0a', s.passcode ? 'パスコードを変更' : 'パスコードを設定', T.icon('fa-solid fa-chevron-right'), {
                                onClick: async () => {
                                    const code = await T.prompt({ title: '新しいパスコード', message: '4桁の数字を入力してください', type: 'password', maxLength: 4, inputMode: 'numeric' });
                                    if (code == null) return;
                                    if (!/^\d{4}$/.test(code)) {
                                        T.toast({ title: 'パスコード', message: '4桁の数字で入力してください', icon: 'fa-solid fa-triangle-exclamation', color: '#ff453a' });
                                        return;
                                    }
                                    const again = await T.prompt({ title: 'もう一度入力', message: '確認のため同じパスコードを入力してください', type: 'password', maxLength: 4, inputMode: 'numeric' });
                                    if (again !== code) {
                                        T.toast({ title: 'パスコード', message: 'パスコードが一致しません', icon: 'fa-solid fa-triangle-exclamation', color: '#ff453a' });
                                        return;
                                    }
                                    set({ passcode: code, lockScreen: true });
                                    T.toast({ title: 'パスコード', message: 'パスコードを設定しました', icon: 'fa-solid fa-lock', color: '#30d158' });
                                },
                            }),
                            s.passcode ? row('fa-solid fa-unlock', '#8e8e93', h('span', { class: 'danger-text' }, 'パスコードをオフにする'), null, {
                                onClick: async () => {
                                    const code = await T.prompt({ title: '現在のパスコード', type: 'password', maxLength: 4, inputMode: 'numeric' });
                                    if (code == null) return;
                                    if (code !== s.passcode) {
                                        T.toast({ title: 'パスコード', message: 'パスコードが違います', icon: 'fa-solid fa-triangle-exclamation', color: '#ff453a' });
                                        return;
                                    }
                                    set({ passcode: '' });
                                },
                            }) : null),
                        group(null, row('fa-solid fa-lock', '#0a84ff', '今すぐロック', T.icon('fa-solid fa-chevron-right'), { onClick: () => T.lock(true) })),
                    ];
                },

                notify() {
                    const s = state.settings;
                    return [
                        group(null,
                            row('fa-solid fa-volume-high', '#ff453a', 'サウンド', toggle(s.sounds, (v) => set({ sounds: v }))),
                            row('fa-solid fa-message', '#0a84ff', 'バナー通知を表示', toggle(s.toasts, (v) => set({ toasts: v })))),
                        group(null,
                            row('fa-solid fa-paper-plane', '#30d158', 'テスト通知を送信', T.icon('fa-solid fa-chevron-right'), {
                                onClick: () => T.notify({ title: '設定', message: 'これはテスト通知です', icon: 'fa-solid fa-gear', color: '#8e8e93', app: 'settings', silentBadge: true }),
                            }),
                            row('fa-solid fa-trash-can', '#8e8e93', '通知をすべて消去', h('span', { class: 'set-value' }, `${state.notifications.length}件`), {
                                onClick: () => { state.notifications = []; state.badges = {}; T.renderHome(); renderMain(); },
                            })),
                    ];
                },

                apps() {
                    const apps = state.installed.map(T.getApp).filter(Boolean);
                    return [
                        group(`インストール済み (${apps.length})`,
                            apps.map((a) => h('div', { class: 'set-row' },
                                T.appIcon(a, 'small'),
                                h('div', { class: 'set-label' }, a.label, h('small', null, `${a.category} ・ ${a.size} MB`)),
                                h('div', { class: 'set-control' },
                                    !T.isRemovable(a)
                                        ? h('span', { class: 'set-value' }, a.system ? 'システム' : '自動')
                                        : h('button', { class: 'btn btn-sm', onClick: () => T.uninstallApp(a.id) }, '削除'))))),
                        h('button', { class: 'btn btn-primary', onClick: () => T.openApp('store') }, T.icon('fa-solid fa-bag-shopping'), h('span', null, 'App Store を開く')),
                    ];
                },
            };

            function renderMain() {
                const scroll = main.scrollTop;
                T.clear(main);
                const sec = SECTIONS.find((s) => s.id === section);
                T.append(main, h('h1', { class: 'page-title' }, sec.label), h('div', { class: 'set-content' }, views[section]()));
                main.scrollTop = scroll;
            }

            function render() {
                renderSidebar();
                renderMain();
            }

            ctx.on('installed', () => { if (section === 'apps' || section === 'general') renderMain(); });
            ctx.on('profile', renderSidebar);
            render();
        },
    });
})();
