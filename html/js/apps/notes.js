/* メモ */
(() => {
    'use strict';

    const T = window.Tablet;
    const { h, state } = T;

    const save = T.debounce(() => T.nui('saveNotes', { notes: state.notes }), 700);

    function sorted() {
        return [...state.notes].sort((a, b) => (Number(!!b.pinned) - Number(!!a.pinned)) || (b.updated - a.updated));
    }

    function stamp(t) {
        const d = new Date(t);
        const today = new Date();
        if (d.toDateString() === today.toDateString()) return `${T.pad(d.getHours())}:${T.pad(d.getMinutes())}`;
        return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
    }

    T.registerApp('notes', {
        mount(root) {
            root.classList.add('app-notes');
            const limits = state.config.limits || { notes: 50, noteTitle: 60, noteBody: 4000 };
            let currentId = (sorted()[0] || {}).id || null;
            let query = '';

            const listEl = h('div', { class: 'notes-list' });
            const editor = h('main', { class: 'notes-editor' });
            const search = h('input', { class: 'input search', placeholder: '検索', onInput: (e) => { query = e.target.value; renderList(); } });

            T.append(root, h('div', { class: 'split' },
                h('aside', { class: 'sidebar notes-side' },
                    h('div', { class: 'notes-side-head' },
                        h('div', { class: 'side-title' }, 'メモ'),
                        h('button', { class: 'icon-btn', title: '新規メモ', onClick: create }, T.icon('fa-solid fa-pen-to-square'))),
                    h('div', { class: 'search-wrap' }, T.icon('fa-solid fa-magnifying-glass'), search),
                    listEl,
                    h('div', { class: 'notes-count' })),
                editor));

            function create() {
                if (state.notes.length >= limits.notes) {
                    T.toast({ title: 'メモ', message: `メモは最大${limits.notes}件までです`, icon: 'fa-solid fa-triangle-exclamation', color: '#ff453a' });
                    return;
                }
                const note = { id: T.uid(), title: '', body: '', pinned: false, updated: Date.now() };
                state.notes.unshift(note);
                currentId = note.id;
                save();
                renderList();
                renderEditor(true);
            }

            function renderList() {
                T.clear(listEl);
                const q = query.trim().toLowerCase();
                const notes = sorted().filter((n) => !q || `${n.title} ${n.body}`.toLowerCase().includes(q));
                if (!notes.length) {
                    T.append(listEl, h('div', { class: 'notes-empty' }, q ? '見つかりません' : 'メモはありません'));
                }
                notes.forEach((n) => {
                    const firstLine = (n.body || '').split('\n').find((l) => l.trim()) || '';
                    T.append(listEl, h('div', {
                        class: `note-item${n.id === currentId ? ' active' : ''}`,
                        onClick: () => { currentId = n.id; renderList(); renderEditor(); },
                    },
                    h('div', { class: 'note-item-title' }, n.pinned ? T.icon('fa-solid fa-thumbtack') : null, ' ', n.title || firstLine || '新規メモ'),
                    h('div', { class: 'note-item-sub' }, h('b', null, stamp(n.updated)), ' ', n.title ? firstLine : '')));
                });
                const count = root.querySelector('.notes-count');
                if (count) count.textContent = `${state.notes.length} / ${limits.notes} 件`;
            }

            function renderEditor(focus) {
                T.clear(editor);
                const note = state.notes.find((n) => n.id === currentId);
                if (!note) {
                    T.append(editor, h('div', { class: 'notes-placeholder' },
                        T.icon('fa-solid fa-note-sticky'),
                        h('p', null, 'メモを選択するか、新規作成してください'),
                        h('button', { class: 'btn btn-primary', onClick: create }, '新規メモ')));
                    return;
                }

                const touch = () => {
                    note.updated = Date.now();
                    save();
                    meta.textContent = `最終更新: ${new Date(note.updated).toLocaleString('ja-JP')}`;
                };
                const meta = h('div', { class: 'notes-meta' }, `最終更新: ${new Date(note.updated).toLocaleString('ja-JP')}`);
                const counter = h('span', { class: 'notes-counter' }, `${note.body.length} / ${limits.noteBody}`);

                const title = h('input', {
                    class: 'notes-title', placeholder: 'タイトル', value: note.title, maxLength: limits.noteTitle,
                    onInput: (e) => { note.title = e.target.value; touch(); renderList(); },
                });
                const body = h('textarea', {
                    class: 'notes-body', placeholder: 'ここに入力...', maxLength: limits.noteBody,
                    onInput: (e) => { note.body = e.target.value; counter.textContent = `${note.body.length} / ${limits.noteBody}`; touch(); renderList(); },
                });
                body.value = note.body;

                T.append(editor, 
                    h('div', { class: 'notes-toolbar' },
                        meta,
                        h('div', { class: 'notes-tools' },
                            counter,
                            h('button', {
                                class: `icon-btn${note.pinned ? ' active' : ''}`, title: 'ピン留め',
                                onClick: () => { note.pinned = !note.pinned; save(); renderList(); renderEditor(); },
                            }, T.icon('fa-solid fa-thumbtack')),
                            h('button', {
                                class: 'icon-btn danger', title: '削除',
                                onClick: async () => {
                                    const ok = await T.confirm({ title: 'メモを削除しますか？', message: 'この操作は取り消せません。', okLabel: '削除', danger: true });
                                    if (!ok) return;
                                    state.notes = state.notes.filter((n) => n.id !== note.id);
                                    currentId = (sorted()[0] || {}).id || null;
                                    save();
                                    renderList();
                                    renderEditor();
                                },
                            }, T.icon('fa-solid fa-trash')))),
                    title,
                    body,
                );
                if (focus) setTimeout(() => title.focus(), 50);
            }

            renderList();
            renderEditor();
        },
        unmount() {
            save.flush();
            T.renderHome();
        },
    });
})();
