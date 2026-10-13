/* App Store */
(() => {
    'use strict';

    const T = window.Tablet;
    const { h, state } = T;

    const CATEGORY_ICONS = {
        システム: 'fa-solid fa-microchip',
        仕事効率化: 'fa-solid fa-briefcase',
        ユーティリティ: 'fa-solid fa-screwdriver-wrench',
        ライフスタイル: 'fa-solid fa-mug-hot',
        情報: 'fa-solid fa-circle-info',
        業務: 'fa-solid fa-building-shield',
        ゲーム: 'fa-solid fa-gamepad',
        開発者: 'fa-solid fa-code',
        その他: 'fa-solid fa-shapes',
    };

    function actionButton(app, opts = {}) {
        const progress = state.downloads[app.id];
        if (progress != null) {
            return h('button', { class: 'store-btn downloading', dataset: { dlBtn: app.id }, style: { '--p': progress }, onClick: (e) => e.stopPropagation() },
                h('span', { class: 'store-ring' }));
        }
        if (app.locked) {
            return h('button', { class: 'store-btn', disabled: true }, T.icon('fa-solid fa-lock'));
        }
        if (T.isInstalled(app.id)) {
            return h('button', { class: 'store-btn', onClick: (e) => { e.stopPropagation(); T.openApp(app.id); } }, '開く');
        }
        if (app.item && !app.hasItem) {
            return h('button', { class: 'store-btn', disabled: true, title: `${app.itemLabel || app.item} が必要です` }, '入手');
        }
        return h('button', {
            class: `store-btn primary${opts.big ? ' big' : ''}`,
            onClick: (e) => { e.stopPropagation(); T.downloadApp(app.id); },
        }, '入手');
    }

    function sizeText(mb) {
        return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`;
    }

    T.registerApp('store', {
        mount(root, ctx) {
            const st = { tab: 'discover', query: '', detail: null };
            root.classList.add('app-store');

            const sidebar = h('aside', { class: 'sidebar' });
            const main = h('main', { class: 'store-main' });
            T.append(root, h('div', { class: 'split' }, sidebar, main));

            const categories = () => [...new Set(state.catalog.map((a) => a.category))];

            function navItem(id, icon, label, count) {
                return h('button', {
                    class: `side-item${st.tab === id && !st.query ? ' active' : ''}`,
                    onClick: () => { st.tab = id; st.query = ''; st.detail = null; render(); },
                }, T.icon(icon), h('span', null, label), count != null ? h('span', { class: 'side-count' }, count) : null);
            }

            function renderSidebar() {
                T.clear(sidebar);
                const search = h('input', {
                    class: 'input search', placeholder: 'アプリを検索', value: st.query,
                    onInput: (e) => { st.query = e.target.value; st.detail = null; renderMain(); renderNav(); },
                });
                const nav = h('nav', { class: 'side-nav' });
                function renderNav() {
                    T.clear(nav);
                    T.append(nav, 
                        navItem('discover', 'fa-solid fa-star', '見つける'),
                        navItem('installed', 'fa-solid fa-circle-down', 'インストール済み', state.installed.length),
                        h('div', { class: 'side-label' }, 'カテゴリ'),
                        categories().map((c) => navItem(`cat:${c}`, CATEGORY_ICONS[c] || 'fa-solid fa-shapes', c)),
                    );
                }
                renderNav();
                T.append(sidebar, 
                    h('div', { class: 'side-title' }, 'App Store'),
                    h('div', { class: 'search-wrap' }, T.icon('fa-solid fa-magnifying-glass'), search),
                    nav,
                    h('div', { class: 'side-footer' },
                        h('div', { class: 'storage-mini' },
                            h('div', null, 'ストレージ'),
                            h('div', { class: 'bar' }, h('span', { style: { width: `${Math.min(100, (T.storageUsed() / (state.config.storageMB || 32768)) * 100)}%` } })),
                            h('small', null, `${sizeText(T.storageUsed())} / ${sizeText(state.config.storageMB || 32768)}`))),
                );
            }

            function card(app) {
                return h('div', { class: 'store-card', onClick: () => { st.detail = app.id; renderMain(); } },
                    T.appIcon(app, 'medium'),
                    h('div', { class: 'store-card-text' },
                        h('div', { class: 'store-card-title' }, app.label),
                        h('div', { class: 'store-card-sub' }, app.description || app.category),
                        app.item && !T.isInstalled(app.id)
                            ? h('div', { class: `store-req${app.hasItem ? ' ok' : ''}` }, T.icon('fa-solid fa-box'), ` ${app.itemLabel || app.item}${app.consumeItem ? ' (消費)' : ''}`)
                            : null,
                        app.locked ? h('div', { class: 'store-req' }, T.icon('fa-solid fa-lock'), ' 利用条件あり') : null),
                    actionButton(app));
            }

            function banner(app) {
                return h('div', {
                    class: 'store-banner',
                    style: { background: `linear-gradient(120deg, ${T.shade(app.color, -25)}, ${app.color} 55%, ${T.shade(app.color, 25)})` },
                    onClick: () => { st.detail = app.id; renderMain(); },
                },
                h('div', { class: 'banner-text' },
                    h('div', { class: 'banner-eyebrow' }, 'おすすめ'),
                    h('div', { class: 'banner-title' }, app.label),
                    h('div', { class: 'banner-desc' }, app.description),
                    actionButton(app)),
                T.appIcon(app, 'large'));
            }

            function list(apps, emptyText) {
                if (!apps.length) return h('div', { class: 'store-empty' }, T.icon('fa-solid fa-box-open'), h('p', null, emptyText));
                return h('div', { class: 'store-grid' }, apps.map(card));
            }

            function renderDetail(app) {
                const rows = [
                    ['カテゴリ', app.category],
                    ['開発元', app.developer],
                    ['サイズ', sizeText(app.size)],
                    ['種類', app.url ? '外部アプリ' : '組み込みアプリ'],
                    app.item ? ['必要なアイテム', `${app.itemLabel || app.item}${app.consumeItem ? '（インストール時に消費）' : ''}`] : null,
                    app.groups ? ['対象', app.groups.join(', ')] : null,
                ].filter(Boolean);

                T.append(main, h('div', { class: 'store-detail' },
                    h('button', { class: 'back-btn', onClick: () => { st.detail = null; renderMain(); } }, T.icon('fa-solid fa-chevron-left'), ' 戻る'),
                    h('div', { class: 'detail-head' },
                        T.appIcon(app, 'xl'),
                        h('div', { class: 'detail-head-text' },
                            h('h1', null, app.label),
                            h('div', { class: 'detail-dev' }, app.developer),
                            h('div', { class: 'detail-actions' },
                                actionButton(app, { big: true }),
                                T.isInstalled(app.id) && !app.system
                                    ? h('button', { class: 'store-btn danger', onClick: () => T.uninstallApp(app.id) }, T.icon('fa-solid fa-trash'))
                                    : null))),
                    h('div', { class: 'detail-stats' },
                        h('div', null, h('small', null, 'カテゴリ'), h('b', null, T.icon(CATEGORY_ICONS[app.category] || 'fa-solid fa-shapes')), h('span', null, app.category)),
                        h('div', null, h('small', null, 'サイズ'), h('b', null, app.size), h('span', null, 'MB')),
                        h('div', null, h('small', null, '評価'), h('b', null, '4.8'), h('span', null, '★★★★★')),
                        h('div', null, h('small', null, '年齢'), h('b', null, '4+'), h('span', null, '歳'))),
                    h('h2', null, '説明'),
                    h('p', { class: 'detail-desc' }, app.description || '説明はありません。'),
                    app.locked ? h('div', { class: 'notice warn' }, T.icon('fa-solid fa-lock'), ' このアプリはあなたの職業では利用できません。') : null,
                    app.item && !app.hasItem && !T.isInstalled(app.id)
                        ? h('div', { class: 'notice warn' }, T.icon('fa-solid fa-box'), ` インストールには「${app.itemLabel || app.item}」が必要です。`)
                        : null,
                    app.system ? h('div', { class: 'notice' }, T.icon('fa-solid fa-shield'), ' システムアプリのため削除できません。') : null,
                    h('h2', null, '情報'),
                    h('div', { class: 'info-table' }, rows.map(([k, v]) => h('div', { class: 'info-row' }, h('span', null, k), h('span', null, v))))));
            }

            function renderMain() {
                T.clear(main);
                const detailApp = st.detail && T.getApp(st.detail);
                if (detailApp) {
                    renderDetail(detailApp);
                    return;
                }

                const q = st.query.trim().toLowerCase();
                if (q) {
                    const hits = state.catalog.filter((a) => `${a.label} ${a.description} ${a.category} ${a.developer}`.toLowerCase().includes(q));
                    T.append(main, h('h1', { class: 'page-title' }, `「${st.query}」の検索結果`), list(hits, '見つかりませんでした'));
                    return;
                }

                if (st.tab === 'discover') {
                    const featured = state.catalog.filter((a) => a.featured);
                    const fresh = state.catalog.filter((a) => !T.isInstalled(a.id) && !a.system);
                    T.append(main, 
                        h('h1', { class: 'page-title' }, '見つける'),
                        h('div', { class: 'page-sub' }, T.formatDate(new Date())),
                        featured.length ? h('div', { class: 'banner-row' }, featured.slice(0, 3).map(banner)) : null,
                        h('h2', { class: 'section-title' }, '未インストールのアプリ'),
                        list(fresh, 'すべてのアプリをインストール済みです'),
                        h('h2', { class: 'section-title' }, 'すべてのアプリ'),
                        list(state.catalog, 'アプリがありません'),
                    );
                } else if (st.tab === 'installed') {
                    const apps = state.installed.map(T.getApp).filter(Boolean);
                    T.append(main, h('h1', { class: 'page-title' }, 'インストール済み'),
                        h('div', { class: 'page-sub' }, `${apps.length} 個のアプリ ・ ${sizeText(T.storageUsed())}`),
                        list(apps, 'インストール済みのアプリはありません'));
                } else if (st.tab.startsWith('cat:')) {
                    const cat = st.tab.slice(4);
                    T.append(main, h('h1', { class: 'page-title' }, T.icon(CATEGORY_ICONS[cat] || 'fa-solid fa-shapes'), ` ${cat}`),
                        list(state.catalog.filter((a) => a.category === cat), 'アプリがありません'));
                }
            }

            function render() {
                const scroll = main.scrollTop;
                renderSidebar();
                renderMain();
                main.scrollTop = scroll;
            }

            ctx.on('installed', render);
            ctx.on('downloads', render);
            ctx.on('catalog', render);
            ctx.on('downloadProgress', ({ id, p }) => {
                root.querySelectorAll(`[data-dl-btn="${CSS.escape(id)}"]`).forEach((b) => b.style.setProperty('--p', p));
            });

            render();
        },
    });
})();
