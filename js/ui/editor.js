// Editor screen: non-destructive card CRUD via a localStorage overlay, plus
// export of a commit-ready deck JSON. Edits never touch the shipped files.
import { h, mount, clear as clearNode, button, levelPill, flag, toast, modal, confirmDialog } from './components.js';
import { t } from './i18n.js';
import { navigate, routes } from '../router.js';
import { loadDeck, invalidateDeck } from '../data/decks.js';
import { resolveDeck, toShippedShape, saveOverlay, clearOverlay } from '../store/overlay.js';
import { assignIds, newId } from '../data/card.js';
import { downloadJSON } from '../store/io.js';
import { LEVELS } from '../engine/adaptive.js';

export async function renderEditor(container, { id }) {
  mount(container, h('p', { class: 'text-slate-500', text: 'Loading…' }));
  let deck;
  try {
    deck = await loadDeck(id);
  } catch (e) {
    mount(container, h('p', { class: 'text-rose-600', text: e.message }));
    return;
  }
  const meta = deck.meta;
  const isCapitals = meta.mode === 'capitals';
  const overlay = deck.overlay;
  let addCounter = overlay.added.length + 1;
  let query = '';

  function resolved() {
    return resolveDeck(deck.shipped, overlay);
  }

  function persist() {
    saveOverlay(id, overlay);
    invalidateDeck(id);
    renderList();
  }

  const badge = (status) => {
    if (!status) return null;
    const colors = { added: 'bg-emerald-100 text-emerald-700', edited: 'bg-amber-100 text-amber-700', removed: 'bg-rose-100 text-rose-700 line-through' };
    return h('span', { class: `rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${colors[status] || ''}`, text: t(status) });
  };

  function openForm(card) {
    const isNew = !card;
    const data = card ? { ...card } : { front: '', back: [], meanings: [], synonyms: [], example: '', level: null, group: '', cc: '' };

    const field = (label, value, { textarea = false, placeholder = '' } = {}) => {
      const input = textarea
        ? h('textarea', { class: 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800', rows: 2, placeholder })
        : h('input', { type: 'text', class: 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800', placeholder });
      input.value = value || '';
      return { wrap: h('label', { class: 'block mb-3' }, h('span', { class: 'mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500', text: label }), input), input };
    };

    const front = field(t('front'), data.front);
    const back = field(t('answers'), (data.back || []).join('\n'), { textarea: true, placeholder: 'one per line' });
    const meanings = field(t('meanings'), (data.meanings || []).join('\n'), { textarea: true, placeholder: 'one per line' });
    const synonyms = field(t('synonyms'), (data.synonyms || []).join('\n'), { textarea: true, placeholder: 'one per line' });
    const example = field(t('example'), data.example || '');

    const levelSel = h('select', { class: 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800' },
      h('option', { value: '', text: t('unleveled') }), ...LEVELS.map((l) => { const o = h('option', { value: l, text: l }); if (data.level === l) o.selected = true; return o; }));

    const ccField = isCapitals ? field('Country code (cc)', data.cc || '', { placeholder: 'e.g. it' }) : null;
    const groupField = isCapitals ? field(t('group'), data.group || '') : null;

    const linesToArr = (v) => v.split('\n').map((x) => x.trim()).filter(Boolean);

    const body = h('div', {},
      h('h3', { class: 'mb-4 text-lg font-bold', text: isNew ? t('addCard') : t('edit') }),
      front.wrap, back.wrap, meanings.wrap, synonyms.wrap, example.wrap,
      isCapitals ? ccField.wrap : null, isCapitals ? groupField.wrap : null,
      !isCapitals ? h('label', { class: 'block mb-3' }, h('span', { class: 'mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500', text: t('level') }), levelSel) : null,
      h('div', { class: 'mt-5 flex justify-end gap-2' },
        button(t('cancel'), { variant: 'ghost', onClick: () => m.close() }),
        button(t('save'), { variant: 'primary', onClick: () => {
          const next = {
            front: front.input.value.trim(),
            back: linesToArr(back.input.value),
          };
          if (!next.front || !next.back.length) { toast('Front and at least one answer are required.', { type: 'error' }); return; }
          const meaningsArr = linesToArr(meanings.input.value);
          const synArr = linesToArr(synonyms.input.value);
          if (meaningsArr.length) next.meanings = meaningsArr;
          if (synArr.length) next.synonyms = synArr;
          if (example.input.value.trim()) next.example = example.input.value.trim();
          if (isCapitals) { if (ccField.input.value.trim()) next.cc = ccField.input.value.trim().toLowerCase(); if (groupField.input.value.trim()) next.group = groupField.input.value.trim(); }
          else { if (levelSel.value) next.level = levelSel.value; }

          if (isNew) {
            overlay.added.push({ _id: newId(addCounter++), ...next });
          } else if (card._status === 'added') {
            const i = overlay.added.findIndex((c) => c._id === card._id);
            if (i >= 0) overlay.added[i] = { _id: card._id, ...next };
          } else {
            overlay.edited[card._id] = next; // full field override for shipped cards
          }
          m.close();
          persist();
          toast(t('deckUpdated'), { type: 'success' });
        } }),
      ),
    );
    const m = modal(body);
    setTimeout(() => front.input.focus(), 30);
  }

  function removeCard(card) {
    if (card._status === 'added') {
      overlay.added = overlay.added.filter((c) => c._id !== card._id);
    } else {
      overlay.removed[card._id] = true;
      delete overlay.edited[card._id];
    }
    persist();
  }
  function restoreCard(card) {
    delete overlay.removed[card._id];
    persist();
  }
  function resetCard(card) {
    delete overlay.edited[card._id];
    persist();
  }

  // Stable chrome built once; only the list + count re-render on search/data change.
  const listHost = h('div', { class: 'divide-y divide-slate-100 dark:divide-slate-800' });
  const countHost = h('div', { class: 'mb-2 text-xs text-slate-400' });
  const searchInput = h('input', { type: 'search', placeholder: t('search'), class: 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800', oninput: (e) => { query = e.target.value; renderList(); } });

  function renderList() {
    const all = resolved();
    const q = query.toLowerCase();
    const filtered = q ? all.filter((c) => c.front.toLowerCase().includes(q) || c.back.join(' ').toLowerCase().includes(q)) : all;
    const shown = filtered.slice(0, 300);
    countHost.textContent = `${filtered.length} cards${filtered.length > shown.length ? ` (showing ${shown.length})` : ''}`;
    clearNode(listHost);
    for (const c of shown) {
      listHost.append(h('div', { class: 'flex items-center gap-3 py-2' },
        isCapitals && c.cc ? flag(c.cc, { size: 16 }) : null,
        h('div', { class: 'min-w-0 flex-1' },
          h('div', { class: 'flex items-center gap-2' }, h('span', { class: 'truncate font-medium', text: c.front }), c.level ? levelPill(c.level) : null, badge(c._status)),
          h('div', { class: 'truncate text-sm text-slate-500', text: c.back.join(', ') })),
        h('div', { class: 'flex items-center gap-1' },
          c._status === 'removed'
            ? button('↺', { variant: 'ghost', title: 'Restore', onClick: () => restoreCard(c) })
            : button('✎', { variant: 'ghost', title: t('edit'), onClick: () => openForm(c) }),
          c._status === 'edited' ? button('⟲', { variant: 'ghost', title: t('resetCard'), onClick: () => resetCard(c) }) : null,
          c._status !== 'removed' ? button('🗑', { variant: 'ghost', title: t('delete'), onClick: () => removeCard(c) }) : null,
        ),
      ));
    }
  }

  mount(container,
    h('div', { class: 'mb-4 flex items-center gap-3' },
      button('← ' + t('back'), { variant: 'ghost', onClick: () => navigate(routes.home()) }),
      h('div', {}, h('h2', { class: 'text-xl font-bold', text: t('editorTitle') }), h('p', { class: 'text-sm text-slate-500', text: meta.title }))),
    h('div', { class: 'mb-3 flex flex-wrap items-center gap-2' },
      button('+ ' + t('addCard'), { variant: 'primary', onClick: () => openForm(null) }),
      button(t('exportDeck'), { variant: 'outline', onClick: () => downloadJSON(`${id}.json`, toShippedShape(resolved())) }),
      button(t('clearOverlay'), { variant: 'ghost', onClick: async () => { if (await confirmDialog(t('clearOverlayConfirm'))) { clearOverlay(id); overlay.edited = {}; overlay.added = []; overlay.removed = {}; invalidateDeck(id); renderList(); toast('Edits cleared.'); } } })),
    h('p', { class: 'mb-3 text-xs text-slate-400', text: t('edlimitNote') }),
    h('div', { class: 'mb-3' }, searchInput),
    countHost,
    listHost,
  );
  renderList();
}
