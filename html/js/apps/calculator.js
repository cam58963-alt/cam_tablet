/* 電卓 */
(() => {
    'use strict';

    const T = window.Tablet;
    const { h } = T;

    const OPS = { '+': (a, b) => a + b, '-': (a, b) => a - b, '*': (a, b) => a * b, '/': (a, b) => (b === 0 ? NaN : a / b) };
    const OP_LABEL = { '+': '+', '-': '−', '*': '×', '/': '÷' };
    const history = []; // アプリを閉じても保持

    function fmt(n) {
        if (!Number.isFinite(n)) return 'エラー';
        const r = parseFloat(n.toPrecision(12));
        if (Math.abs(r) >= 1e15 || (Math.abs(r) < 1e-9 && r !== 0)) return r.toExponential(6);
        return r.toLocaleString('en-US', { maximumFractionDigits: 10 });
    }

    function fmtInput(s) {
        const neg = s.startsWith('-');
        const body = neg ? s.slice(1) : s;
        const [i, d] = body.split('.');
        const int = Number(i || 0).toLocaleString('en-US');
        return `${neg ? '-' : ''}${int}${d != null ? `.${d}` : ''}`;
    }

    T.registerApp('calculator', {
        dark: true,
        mount(root) {
            root.classList.add('app-calculator');
            let cur = '0';
            let acc = null;
            let op = null;
            let waiting = false;
            let expr = '';

            const display = h('div', { class: 'calc-display' });
            const exprEl = h('div', { class: 'calc-expr' });
            const histEl = h('div', { class: 'calc-history' });
            const clearBtn = h('button', { class: 'calc-key fn', onClick: () => press('clear') }, 'AC');

            function compute() {
                if (op == null || acc == null) return parseFloat(cur);
                return OPS[op](acc, parseFloat(cur));
            }

            function press(k) {
                if (/^[0-9]$/.test(k)) {
                    if (waiting || cur === '0' || cur === 'エラー') { cur = k; waiting = false; } else if (cur.replace(/[-.]/g, '').length < 15) cur += k;
                } else if (k === '.') {
                    if (waiting || cur === 'エラー') { cur = '0.'; waiting = false; } else if (!cur.includes('.')) cur += '.';
                } else if (k in OPS) {
                    if (cur === 'エラー') return;
                    if (op && !waiting) {
                        const r = compute();
                        if (!Number.isFinite(r)) return error();
                        acc = r;
                        cur = String(parseFloat(r.toPrecision(12)));
                    } else if (!op || acc == null) {
                        acc = parseFloat(cur);
                    }
                    op = k;
                    waiting = true;
                    expr = `${fmt(acc)} ${OP_LABEL[k]}`;
                } else if (k === '=') {
                    if (op == null || cur === 'エラー') return;
                    const b = parseFloat(cur);
                    const r = compute();
                    const line = `${fmt(acc)} ${OP_LABEL[op]} ${fmt(b)} =`;
                    if (!Number.isFinite(r)) return error();
                    history.unshift({ expr: line, result: fmt(r) });
                    history.length = Math.min(history.length, 30);
                    expr = line;
                    cur = String(parseFloat(r.toPrecision(12)));
                    acc = null;
                    op = null;
                    waiting = true;
                } else if (k === 'clear') {
                    if (cur !== '0' && !waiting) {
                        cur = '0';
                    } else {
                        cur = '0'; acc = null; op = null; expr = ''; waiting = false;
                    }
                } else if (k === 'neg') {
                    if (cur !== '0' && cur !== 'エラー') cur = cur.startsWith('-') ? cur.slice(1) : `-${cur}`;
                } else if (k === '%') {
                    if (cur !== 'エラー') cur = String(parseFloat((parseFloat(cur) / 100).toPrecision(12)));
                } else if (k === 'back') {
                    if (!waiting && cur !== 'エラー') cur = cur.length > 1 && cur !== '-0' ? cur.slice(0, -1) : '0';
                    if (cur === '-') cur = '0';
                }
                render();
            }

            function error() {
                cur = 'エラー'; acc = null; op = null; waiting = true; expr = '';
                render();
            }

            function render() {
                const text = cur === 'エラー' ? cur : (waiting && /e/.test(cur) ? fmt(parseFloat(cur)) : fmtInput(cur));
                display.textContent = text;
                display.style.fontSize = text.length > 13 ? '52px' : text.length > 9 ? '68px' : '88px';
                exprEl.textContent = expr;
                clearBtn.textContent = cur !== '0' && !waiting ? 'C' : 'AC';
                root.querySelectorAll('.calc-key.op').forEach((b) => b.classList.toggle('active', waiting && b.dataset.op === op));
                T.clear(histEl);
                if (!history.length) T.append(histEl, h('div', { class: 'calc-hist-empty' }, '履歴はありません'));
                history.forEach((it) => T.append(histEl, h('div', {
                    class: 'calc-hist-item',
                    onClick: () => { cur = it.result.replace(/,/g, ''); waiting = false; render(); },
                }, h('small', null, it.expr), h('b', null, it.result))));
            }

            const key = (label, k, cls = '') => h('button', { class: `calc-key ${cls}`, dataset: cls === 'op' ? { op: k } : null, onClick: () => press(k) }, label);

            T.append(root, h('div', { class: 'calc-wrap' },
                h('div', { class: 'calc-main' },
                    h('div', { class: 'calc-screen' }, exprEl, display),
                    h('div', { class: 'calc-keys' },
                        clearBtn, key(T.icon('fa-solid fa-plus-minus'), 'neg', 'fn'), key('%', '%', 'fn'), key('÷', '/', 'op'),
                        key('7', '7'), key('8', '8'), key('9', '9'), key('×', '*', 'op'),
                        key('4', '4'), key('5', '5'), key('6', '6'), key('−', '-', 'op'),
                        key('1', '1'), key('2', '2'), key('3', '3'), key('+', '+', 'op'),
                        key('0', '0', 'zero'), key('.', '.'), key('=', '=', 'op eq'))),
                h('aside', { class: 'calc-side' },
                    h('div', { class: 'calc-side-head' },
                        h('span', null, '履歴'),
                        h('button', { class: 'btn-ghost btn btn-sm', onClick: () => { history.length = 0; render(); } }, '消去')),
                    histEl)));

            this.onKey = (e) => {
                if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
                const map = { Enter: '=', '=': '=', Backspace: 'back', Delete: 'clear', c: 'clear', Escape: null, ',': '.' };
                const k = e.key in map ? map[e.key] : e.key;
                if (k == null) return;
                if (/^[0-9.+\-*/%=]$/.test(k) || k === 'back' || k === 'clear') {
                    e.preventDefault();
                    press(k);
                }
            };
            document.addEventListener('keydown', this.onKey);
            render();
        },
        unmount() {
            document.removeEventListener('keydown', this.onKey);
        },
    });
})();
