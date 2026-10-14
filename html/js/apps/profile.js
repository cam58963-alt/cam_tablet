/* マイ情報 */
(() => {
    'use strict';

    const T = window.Tablet;
    const { h, state } = T;

    T.registerApp('profile', {
        mount(root, ctx) {
            root.classList.add('app-profile');

            function render() {
                const p = state.profile || {};
                const gender = p.gender === 0 || p.gender === '0' ? '男性' : p.gender === 1 || p.gender === '1' ? '女性' : p.gender;
                const item = (icon, label, value) => h('div', { class: 'pf-item' },
                    h('div', { class: 'pf-ico' }, T.icon(icon)),
                    h('div', null, h('small', null, label), h('b', null, value == null || value === '' ? '—' : value)));

                T.append(T.clear(root), h('div', { class: 'pf-wrap' },
                    h('div', { class: 'pf-card' },
                        h('div', { class: 'pf-card-top' },
                            h('div', { class: 'pf-avatar' }, (p.firstname || p.name || '?').trim().charAt(0)),
                            h('div', null,
                                h('div', { class: 'pf-name' }, (p.name || '').trim() || '—'),
                                h('div', { class: 'pf-id' }, `CID: ${p.citizenid || '—'}`)),
                            h('button', {
                                class: 'icon-btn', title: '更新',
                                onClick: async (e) => {
                                    e.currentTarget.classList.add('spin');
                                    const res = await T.nui('getProfile');
                                    if (res) { state.profile = res; T.renderHome(); T.emit('profile'); }
                                },
                            }, T.icon('fa-solid fa-rotate'))),
                        h('div', { class: 'pf-money' },
                            h('div', null, h('small', null, T.icon('fa-solid fa-money-bill-wave'), ' 現金'), h('b', null, T.money(p.cash))),
                            h('div', null, h('small', null, T.icon('fa-solid fa-building-columns'), ' 銀行'), h('b', null, T.money(p.bank))))),
                    h('div', { class: 'pf-grid' },
                        item('fa-solid fa-briefcase', '職業', [p.job, p.grade].filter(Boolean).join(' / ')),
                        item('fa-solid fa-user-clock', '勤務状態', p.onduty == null ? null : p.onduty ? '勤務中' : '非番'),
                        item('fa-solid fa-people-group', 'ギャング', p.gang ? [p.gang, p.gangGrade].filter(Boolean).join(' / ') : 'なし'),
                        item('fa-solid fa-phone', '電話番号', p.phone),
                        item('fa-solid fa-cake-candles', '生年月日', p.birthdate),
                        item('fa-solid fa-venus-mars', '性別', gender),
                        item('fa-solid fa-flag', '国籍', p.nationality),
                        item('fa-solid fa-tablet-screen-button', 'デバイス', state.settings.deviceName))));
            }

            ctx.on('profile', render);
            render();
        },
    });
})();
