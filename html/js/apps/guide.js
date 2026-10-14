/* サーバーガイド (内容は config.lua の Config.Guide) */
(() => {
    'use strict';

    const T = window.Tablet;
    const { h, state } = T;

    T.registerApp('guide', {
        mount(root) {
            root.classList.add('app-guide');
            const g = state.config.guide || {};
            const sections = Array.isArray(g.sections) ? g.sections : [];
            T.append(root, h('div', { class: 'guide-wrap' },
                h('div', { class: 'guide-hero' },
                    h('div', { class: 'guide-hero-icon' }, T.icon('fa-solid fa-book-open')),
                    h('h1', null, g.title || 'ガイド'),
                    g.subtitle ? h('p', null, g.subtitle) : null),
                h('div', { class: 'guide-sections' }, sections.map((s) => h('div', { class: 'guide-card' },
                    h('div', { class: 'guide-card-head' }, T.icon(s.icon || 'fa-solid fa-circle-info'), h('h2', null, s.title)),
                    h('p', null, s.body))))));
        },
    });
})();
