/* 時計 (時計 / ストップウォッチ / タイマー) */
(() => {
    'use strict';

    const T = window.Tablet;
    const { h, state } = T;

    // アプリを閉じても動き続けるようにモジュールで保持
    const sw = { running: false, start: 0, elapsed: 0, laps: [] };
    const timer = { running: false, end: 0, remaining: 0, total: 0, set: 5 * 60 * 1000, handle: null };

    function swTime() {
        return sw.elapsed + (sw.running ? performance.now() - sw.start : 0);
    }

    function fmtMs(ms, centis = true) {
        const total = Math.max(0, ms);
        const m = Math.floor(total / 60000);
        const s = Math.floor((total % 60000) / 1000);
        const c = Math.floor((total % 1000) / 10);
        const hh = Math.floor(m / 60);
        const base = hh > 0 ? `${hh}:${T.pad(m % 60)}:${T.pad(s)}` : `${T.pad(m)}:${T.pad(s)}`;
        return centis ? `${base}.${T.pad(c)}` : base;
    }

    function timerRemaining() {
        return timer.running ? Math.max(0, timer.end - Date.now()) : timer.remaining;
    }

    function timerDone() {
        timer.running = false;
        timer.remaining = 0;
        clearInterval(timer.handle);
        timer.handle = null;
        T.sound('alarm');
        T.notify({ title: 'タイマー', message: 'タイマーが終了しました', icon: 'fa-solid fa-hourglass-end', color: '#ff9f0a', app: 'clock' });
        if (!state.open) T.nui('gameNotify', { title: 'タブレット', message: 'タイマーが終了しました' });
        T.emit('timer');
    }

    function timerStart() {
        if (timer.running) return;
        if (timer.remaining <= 0) {
            timer.remaining = timer.set;
            timer.total = timer.set;
        }
        if (timer.remaining <= 0) return;
        timer.running = true;
        timer.end = Date.now() + timer.remaining;
        clearInterval(timer.handle);
        timer.handle = setInterval(() => {
            if (timerRemaining() <= 0) timerDone();
        }, 250);
        T.emit('timer');
    }

    function timerPause() {
        if (!timer.running) return;
        timer.remaining = timerRemaining();
        timer.running = false;
        clearInterval(timer.handle);
        timer.handle = null;
        T.emit('timer');
    }

    function timerReset() {
        timerPause();
        timer.remaining = 0;
        timer.total = 0;
        T.emit('timer');
    }

    function analog(d, label) {
        const sec = d.getSeconds();
        const min = d.getMinutes() + sec / 60;
        const hr = (d.getHours() % 12) + min / 60;
        return h('div', { class: 'analog-wrap' },
            h('div', { class: 'analog' },
                Array.from({ length: 12 }, (_, i) => h('span', { class: 'tick', style: { transform: `rotate(${i * 30}deg)` } }, h('i'))),
                h('div', { class: 'hand hour', style: { transform: `rotate(${hr * 30}deg)` } }),
                h('div', { class: 'hand min', style: { transform: `rotate(${min * 6}deg)` } }),
                label === 'game' ? null : h('div', { class: 'hand sec', style: { transform: `rotate(${sec * 6}deg)` } }),
                h('div', { class: 'pin' })));
    }

    T.registerApp('clock', {
        mount(root, ctx) {
            root.classList.add('app-clock');
            let tab = timer.running || timer.remaining > 0 ? 'timer' : sw.running ? 'stopwatch' : 'clock';
            const body = h('div', { class: 'clock-body' });
            const tabs = h('div', { class: 'clock-tabs segmented' });
            T.append(root, h('div', { class: 'clock-head' }, tabs), body);
            let raf = null;

            function renderTabs() {
                T.clear(tabs);
                [['clock', 'fa-solid fa-clock', '時計'], ['stopwatch', 'fa-solid fa-stopwatch', 'ストップウォッチ'], ['timer', 'fa-solid fa-hourglass-half', 'タイマー']]
                    .forEach(([id, icon, label]) => T.append(tabs, h('button', { class: tab === id ? 'active' : '', onClick: () => { tab = id; render(); } }, T.icon(icon), ` ${label}`)));
            }

            function renderClock() {
                const real = new Date();
                const game = new Date();
                game.setHours(state.gameTime.h, state.gameTime.m, 0, 0);
                T.append(T.clear(body), h('div', { class: 'clock-faces' },
                    h('div', { class: 'clock-face-card' },
                        analog(real, 'real'),
                        h('div', { class: 'face-label' }, '現実時間'),
                        h('div', { class: 'face-time' }, T.formatTime(real, true)),
                        h('div', { class: 'face-sub' }, T.formatDate(real, true))),
                    h('div', { class: 'clock-face-card' },
                        analog(game, 'game'),
                        h('div', { class: 'face-label' }, 'ロスサントス (ゲーム内)'),
                        h('div', { class: 'face-time' }, T.formatTime(game)),
                        h('div', { class: 'face-sub' }, state.gameTime.h >= 6 && state.gameTime.h < 19 ? '☀ 昼' : '☾ 夜'))));
            }

            function renderStopwatch() {
                const display = h('div', { class: 'big-time mono' }, fmtMs(swTime()));
                const laps = h('div', { class: 'laps' });
                const drawLaps = () => {
                    T.clear(laps);
                    const diffs = sw.laps.map((t, i) => t - (sw.laps[i + 1] || 0));
                    const best = diffs.length > 1 ? Math.min(...diffs) : null;
                    const worst = diffs.length > 1 ? Math.max(...diffs) : null;
                    sw.laps.forEach((t, i) => T.append(laps, h('div', { class: `lap${diffs[i] === best ? ' best' : ''}${diffs[i] === worst ? ' worst' : ''}` },
                        h('span', null, `ラップ ${sw.laps.length - i}`), h('span', { class: 'mono' }, fmtMs(diffs[i])), h('span', { class: 'mono dim' }, fmtMs(t)))));
                };
                const btns = h('div', { class: 'clock-btns' });
                const drawBtns = () => {
                    T.append(T.clear(btns), 
                        h('button', {
                            class: 'round-btn',
                            disabled: !sw.running && swTime() === 0,
                            onClick: () => {
                                if (sw.running) sw.laps.unshift(swTime());
                                else { sw.elapsed = 0; sw.laps = []; display.textContent = fmtMs(0); }
                                drawBtns(); drawLaps();
                            },
                        }, sw.running ? 'ラップ' : 'リセット'),
                        h('button', {
                            class: `round-btn ${sw.running ? 'stop' : 'go'}`,
                            onClick: () => {
                                if (sw.running) { sw.elapsed = swTime(); sw.running = false; } else { sw.start = performance.now(); sw.running = true; }
                                drawBtns();
                            },
                        }, sw.running ? '停止' : '開始'));
                };
                drawBtns();
                drawLaps();
                T.append(T.clear(body), h('div', { class: 'sw-wrap' }, display, btns, laps));
                const loop = () => {
                    display.textContent = fmtMs(swTime());
                    raf = requestAnimationFrame(loop);
                };
                loop();
            }

            function renderTimer() {
                const rem = timerRemaining();
                const active = timer.running || rem > 0;
                const ring = h('div', { class: 'timer-ring', style: { '--p': active && timer.total ? rem / timer.total : 1 } },
                    h('div', { class: 'big-time mono' }, fmtMs(active ? rem : timer.set, false)));

                const presets = [1, 3, 5, 10, 15, 30];
                const setter = active ? null : h('div', { class: 'timer-set' },
                    h('div', { class: 'timer-presets' }, presets.map((m) => h('button', {
                        class: `chip${timer.set === m * 60000 ? ' active' : ''}`,
                        onClick: () => { timer.set = m * 60000; render(); },
                    }, `${m}分`))),
                    h('div', { class: 'timer-adjust' },
                        h('button', { class: 'chip', onClick: () => { timer.set = Math.max(10000, timer.set - 60000); render(); } }, '−1分'),
                        h('button', { class: 'chip', onClick: () => { timer.set = Math.max(10000, timer.set - 10000); render(); } }, '−10秒'),
                        h('button', { class: 'chip', onClick: () => { timer.set = Math.min(99 * 60000, timer.set + 10000); render(); } }, '+10秒'),
                        h('button', { class: 'chip', onClick: () => { timer.set = Math.min(99 * 60000, timer.set + 60000); render(); } }, '+1分')));

                T.append(T.clear(body), h('div', { class: 'timer-wrap' },
                    ring,
                    setter,
                    h('div', { class: 'clock-btns' },
                        h('button', { class: 'round-btn', disabled: !active, onClick: timerReset }, 'キャンセル'),
                        h('button', { class: `round-btn ${timer.running ? 'stop' : 'go'}`, onClick: () => (timer.running ? timerPause() : timerStart()) },
                            timer.running ? '一時停止' : rem > 0 ? '再開' : '開始'))));

                if (timer.running) {
                    const loop = () => {
                        const r = timerRemaining();
                        ring.style.setProperty('--p', timer.total ? r / timer.total : 0);
                        ring.firstChild.textContent = fmtMs(r, false);
                        raf = requestAnimationFrame(loop);
                    };
                    loop();
                }
            }

            function render() {
                cancelAnimationFrame(raf);
                renderTabs();
                if (tab === 'clock') renderClock();
                else if (tab === 'stopwatch') renderStopwatch();
                else renderTimer();
            }

            ctx.on('tick', () => { if (tab === 'clock') renderClock(); });
            ctx.on('timer', () => { if (tab === 'timer') render(); });
            this.stop = () => cancelAnimationFrame(raf);
            render();
        },
        unmount() {
            if (this.stop) this.stop();
        },
    });
})();
