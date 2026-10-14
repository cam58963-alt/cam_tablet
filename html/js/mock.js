/* ブラウザで index.html を直接開いた時の開発用モック (FiveM 内では使われません) */
(() => {
    'use strict';

    const T = window.Tablet;
    if (T.IS_FIVEM) return;

    const catalog = [
        { id: 'store', label: 'App Store', icon: 'fa-solid fa-bag-shopping', color: '#0a84ff', category: 'システム', developer: 'CamTab', size: 48, system: true, description: 'アプリを探してダウンロードできます。' },
        { id: 'settings', label: '設定', icon: 'fa-solid fa-gear', color: '#8e8e93', category: 'システム', developer: 'CamTab', size: 36, system: true, description: '壁紙・テーマ・ロック画面などを変更できます。' },
        { id: 'notes', label: 'メモ', icon: 'fa-solid fa-note-sticky', color: '#ffcc00', category: '仕事効率化', developer: 'CamTab', size: 18, description: 'メモを作成して保存できます。' },
        { id: 'calculator', label: '電卓', icon: 'fa-solid fa-calculator', color: '#ff9f0a', category: 'ユーティリティ', developer: 'CamTab', size: 6, description: 'シンプルな電卓。' },
        { id: 'clock', label: '時計', icon: 'fa-solid fa-clock', color: '#1c1c1e', category: 'ユーティリティ', developer: 'CamTab', size: 12, description: '時計・ストップウォッチ・タイマー。' },
        { id: 'calendar', label: 'カレンダー', icon: 'fa-solid fa-calendar-days', color: '#ff3b30', category: '仕事効率化', developer: 'CamTab', size: 14, featured: true, description: '月表示のカレンダー。予定を日付ごとに書き込めます。' },
        { id: 'profile', label: 'マイ情報', icon: 'fa-solid fa-id-card', color: '#34c759', category: 'ライフスタイル', developer: 'CamTab', size: 10, featured: true, description: '自分の名前・職業・所持金などを確認できます。' },
        { id: 'guide', label: 'サーバーガイド', icon: 'fa-solid fa-book-open', color: '#5e5ce6', category: '情報', developer: 'Server Staff', size: 8, featured: true, description: 'サーバーのルールや案内を確認できます。' },
        { id: 'darknet', label: 'Darknet', icon: 'fa-solid fa-user-secret', color: '#2c2c2e', category: 'その他', developer: '???', size: 3, url: 'about:blank', item: 'usb_darknet', itemLabel: '怪しいUSB', hasItem: false, consumeItem: true, description: '???' },
    ];

    const db = {
        installed: ['store', 'settings', 'notes', 'calculator', 'clock'],
        settings: {},
        notes: [
            { id: 'n1', title: '買い物リスト', body: '・リペアキット\n・包帯 x5\n・ガソリン缶', pinned: true, updated: Date.now() - 3600e3 },
            { id: 'n2', title: '', body: '明日 20:00 に港で集合', pinned: false, updated: Date.now() - 86400e3 },
        ],
        events: [{ id: 'e1', date: T.dateKey(new Date(Date.now() + 86400e3)), time: '20:00', text: '港で集合', color: '#0a84ff' }],
    };

    const profile = {
        name: 'John Doe', firstname: 'John', lastname: 'Doe', citizenid: 'ABC12345', phone: '090-1234-5678', birthdate: '1995-04-01',
        gender: 0, nationality: 'Japan', job: 'LSPD', jobName: 'police', grade: '巡査', onduty: true, gang: null, cash: 1520, bank: 48200,
    };

    const config = {
        wallpapers: [
            { id: 'aurora', label: 'オーロラ', src: 'wallpapers/aurora.svg' },
            { id: 'dunes', label: '砂丘', src: 'wallpapers/dunes.svg' },
            { id: 'city', label: 'ナイトシティ', src: 'wallpapers/city.svg' },
            { id: 'waves', label: 'ウェーブ', src: 'wallpapers/waves.svg' },
            { id: 'sunset', label: 'サンセット', css: 'linear-gradient(160deg, #ff7e5f 0%, #feb47b 45%, #6a3093 100%)' },
            { id: 'ocean', label: 'オーシャン', css: 'linear-gradient(160deg, #00c6ff 0%, #0072ff 50%, #001a4d 100%)' },
            { id: 'forest', label: 'フォレスト', css: 'linear-gradient(160deg, #a8e063 0%, #2f7336 55%, #0b2e13 100%)' },
            { id: 'mono', label: 'グラファイト', css: 'linear-gradient(160deg, #434343 0%, #1a1a1a 100%)' },
        ],
        defaultWallpaper: 'aurora',
        allowCustomWallpaper: true,
        accentColors: ['#0a84ff', '#30d158', '#ff9f0a', '#ff375f', '#bf5af2', '#64d2ff', '#ffd60a', '#ff453a'],
        dockApps: ['store', 'notes', 'calculator', 'settings'],
        download: { msPerMB: 60, min: 1200, max: 8000 },
        storageMB: 32768,
        limits: { notes: 50, noteTitle: 60, noteBody: 4000, events: 200, eventText: 100 },
        guide: {
            title: 'ようこそ！',
            subtitle: 'サーバーの基本ルールと案内',
            sections: [
                { icon: 'fa-solid fa-scale-balanced', title: '基本ルール', body: '他のプレイヤーを尊重し、ロールプレイを楽しみましょう。\nRDM / VDM / メタゲームは禁止です。' },
                { icon: 'fa-solid fa-briefcase', title: '仕事', body: '市役所で職業を選択できます。\n警察・救急への応募は Discord から。' },
                { icon: 'fa-brands fa-discord', title: 'Discord', body: 'お問い合わせやお知らせは Discord をご確認ください。' },
            ],
        },
        serverName: 'Dev Server',
    };

    const params = new URLSearchParams(location.search);

    T.mock = {
        handle(name, data) {
            switch (name) {
                case 'install': {
                    const app = catalog.find((a) => a.id === data.id);
                    if (!app) return { ok: false, message: 'アプリが見つかりません' };
                    if (app.item && !app.hasItem) return { ok: false, message: `インストールには ${app.itemLabel} が必要です` };
                    if (!db.installed.includes(data.id)) db.installed.push(data.id);
                    return { ok: true, installed: [...db.installed] };
                }
                case 'uninstall':
                    db.installed = db.installed.filter((id) => id !== data.id);
                    return { ok: true, installed: [...db.installed] };
                case 'reorder':
                    db.installed = data.order;
                    return true;
                case 'saveSettings':
                    db.settings = { ...data.settings };
                    return db.settings;
                case 'resetSettings':
                    db.settings = {};
                    return {};
                case 'getProfile':
                    return profile;
                case 'close':
                    setTimeout(() => window.postMessage({ action: 'open', data: payload() }, '*'), 1500);
                    return true;
                default:
                    return true;
            }
        },
        boot(open) {
            const now = new Date();
            if (params.has('installAll')) db.installed = catalog.filter((a) => !a.url).map((a) => a.id);
            if (params.has('light')) db.settings.theme = 'light';
            const lock = params.has('lock');
            db.settings.lockScreen = lock;
            if (params.has('pass')) db.settings.passcode = '1234';
            open({ ...payload(), openApp: params.get('kiosk') || params.get('app') || null, standalone: params.has('kiosk'), gameTime: { h: (now.getHours() + 7) % 24, m: now.getMinutes() } });
            if (params.has('notify')) {
                setTimeout(() => T.notify({ title: 'LSPD', message: '本日 21:00 より定例会議を行います。', icon: 'fa-solid fa-shield-halved', color: '#0040dd' }), 600);
            }
        },
    };

    function payload() {
        return {
            catalog,
            installed: [...db.installed],
            settings: { ...db.settings },
            notes: db.notes,
            events: db.events,
            profile,
            config,
        };
    }

    // ブラウザ表示用の背景
    document.documentElement.style.background = 'radial-gradient(circle at 30% 20%, #56637a, #1d2230 70%)';
})();
