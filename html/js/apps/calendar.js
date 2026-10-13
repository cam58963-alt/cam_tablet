/* カレンダー */
(() => {
    'use strict';

    const T = window.Tablet;
    const { h, state } = T;

    const save = T.debounce(() => T.nui('saveEvents', { events: state.events }), 500);
    const COLORS = ['#ff453a', '#ff9f0a', '#30d158', '#0a84ff', '#bf5af2'];

    T.registerApp('calendar', {
        mount(root, ctx) {
            ctx.on('visibility', (visible) => { if (!visible) save.flush(); });
            root.classList.add('app-calendar');
            const limits = state.config.limits || { events: 200, eventText: 100 };
            const today = new Date();
            let view = new Date(today.getFullYear(), today.getMonth(), 1);
            let selected = T.dateKey(today);

            const grid = h('div', { class: 'cal-grid' });
            const title = h('h1', { class: 'cal-title' });
            const side = h('aside', { class: 'cal-side' });

            T.append(root, h('div', { class: 'cal-wrap' },
                h('main', { class: 'cal-main' },
                    h('div', { class: 'cal-head' },
                        title,
                        h('div', { class: 'cal-nav' },
                            h('button', { class: 'icon-btn', onClick: () => { view = new Date(view.getFullYear(), view.getMonth() - 1, 1); render(); } }, T.icon('fa-solid fa-chevron-left')),
                            h('button', { class: 'btn btn-sm', onClick: () => { view = new Date(today.getFullYear(), today.getMonth(), 1); selected = T.dateKey(today); render(); } }, '今日'),
                            h('button', { class: 'icon-btn', onClick: () => { view = new Date(view.getFullYear(), view.getMonth() + 1, 1); render(); } }, T.icon('fa-solid fa-chevron-right')))),
                    h('div', { class: 'cal-week' }, T.WEEK.map((w, i) => h('span', { class: i === 0 ? 'sun' : i === 6 ? 'sat' : '' }, w))),
                    grid),
                side));

            const eventsOn = (key) => state.events.filter((e) => e.date === key).sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));

            function renderGrid() {
                title.textContent = `${view.getFullYear()}年 ${view.getMonth() + 1}月`;
                T.clear(grid);
                const start = new Date(view);
                start.setDate(1 - view.getDay());
                const todayKey = T.dateKey(today);
                for (let i = 0; i < 42; i++) {
                    const d = new Date(start);
                    d.setDate(start.getDate() + i);
                    const key = T.dateKey(d);
                    const evs = eventsOn(key);
                    T.append(grid, h('button', {
                        class: [
                            'cal-day',
                            d.getMonth() !== view.getMonth() ? 'other' : '',
                            key === todayKey ? 'today' : '',
                            key === selected ? 'selected' : '',
                            d.getDay() === 0 ? 'sun' : d.getDay() === 6 ? 'sat' : '',
                        ].join(' '),
                        onClick: () => { selected = key; if (d.getMonth() !== view.getMonth()) view = new Date(d.getFullYear(), d.getMonth(), 1); render(); },
                    },
                    h('span', { class: 'cal-num' }, d.getDate()),
                    h('div', { class: 'cal-evs' }, evs.slice(0, 3).map((e) => h('div', { class: 'cal-ev', style: { '--c': e.color || 'var(--accent)' } }, e.text)),
                        evs.length > 3 ? h('div', { class: 'cal-more' }, `+${evs.length - 3}`) : null)));
                }
            }

            function renderSide() {
                T.clear(side);
                const [y, m, d] = selected.split('-').map(Number);
                const date = new Date(y, m - 1, d);
                const evs = eventsOn(selected);
                let color = COLORS[3];

                const text = h('input', { class: 'input', placeholder: '予定を追加', maxLength: limits.eventText });
                const time = h('input', { class: 'input time', type: 'time' });
                const colorRow = h('div', { class: 'cal-colors' });
                const drawColors = () => {
                    T.append(T.clear(colorRow), COLORS.map((c) => h('button', {
                        class: `swatch sm${c === color ? ' active' : ''}`, style: { background: c },
                        onClick: () => { color = c; drawColors(); },
                    })));
                };
                drawColors();
                const add = () => {
                    const v = text.value.trim();
                    if (!v) return;
                    if (state.events.length >= limits.events) {
                        T.toast({ title: 'カレンダー', message: `予定は最大${limits.events}件までです`, icon: 'fa-solid fa-triangle-exclamation', color: '#ff453a' });
                        return;
                    }
                    state.events.push({ id: T.uid(), date: selected, time: time.value || '', text: v, color });
                    save();
                    render();
                };
                text.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });

                T.append(side, 
                    h('div', { class: 'cal-side-date' },
                        h('div', { class: 'cal-side-day' }, date.getDate()),
                        h('div', null, h('b', null, `${m}月 ${T.WEEK[date.getDay()]}曜日`), h('small', null, `${y}年`))),
                    h('div', { class: 'cal-list' },
                        evs.length ? evs.map((e) => h('div', { class: 'cal-item', style: { '--c': e.color || 'var(--accent)' } },
                            h('div', { class: 'cal-item-time' }, e.time || '終日'),
                            h('div', { class: 'cal-item-text' }, e.text),
                            h('button', {
                                class: 'icon-btn sm', title: '削除',
                                onClick: () => { state.events = state.events.filter((x) => x.id !== e.id); save(); render(); },
                            }, T.icon('fa-solid fa-xmark'))))
                            : h('div', { class: 'cal-none' }, T.icon('fa-regular fa-calendar'), h('p', null, '予定はありません'))),
                    h('div', { class: 'cal-add' },
                        text,
                        h('div', { class: 'cal-add-row' }, time, colorRow),
                        h('button', { class: 'btn btn-primary', onClick: add }, T.icon('fa-solid fa-plus'), h('span', null, '追加'))));
            }

            function render() {
                renderGrid();
                renderSide();
            }

            render();
        },
        unmount() {
            save.flush();
            T.renderHome();
        },
    });
})();
