// Results screen: session summary with accuracy, hardest cards, and (for
// adaptive sessions) the level trajectory.
import { h, mount, button, levelPill, flag, progressBar } from './components.js';
import { t } from './i18n.js';
import { navigate, routes } from '../router.js';
import { appState, setSession } from '../state.js';
import { createSession } from '../engine/session.js';

export function renderResults(container, { id }) {
  const s = appState.summary;
  if (!s || s.deckId !== id) {
    navigate(routes.setup(id));
    return;
  }
  const acc = s.seen ? Math.round((s.correct / s.seen) * 100) : 0;

  const stat = (label, value) =>
    h('div', { class: 'rounded-xl border border-slate-200 bg-white p-4 text-center dark:border-slate-800 dark:bg-slate-900' },
      h('div', { class: 'text-3xl font-bold', text: String(value) }),
      h('div', { class: 'text-xs uppercase tracking-wide text-slate-400', text: label }));

  const blocks = [
    h('div', { class: 'mb-6 text-center' },
      h('h2', { class: 'text-2xl font-bold', text: t('sessionDone') }),
      h('p', { class: 'text-slate-500', text: s.title })),
    h('div', { class: 'mb-6 grid grid-cols-3 gap-3' },
      stat(t('accuracy'), acc + '%'),
      stat(t('correct'), s.correct),
      stat(t('seen'), s.seen)),
  ];

  if (s.adaptive && s.trajectory?.length) {
    blocks.push(h('div', { class: 'mb-6' },
      h('h3', { class: 'mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500', text: t('levelPath') }),
      h('div', { class: 'flex flex-wrap items-center gap-2' },
        ...s.trajectory.flatMap((l, i) => i ? [h('span', { class: 'text-slate-400', text: '→' }), levelPill(l)] : [levelPill(l)]))));
  }

  if (s.missed?.length) {
    const rows = s.missed.slice(0, 12).map((c) =>
      h('li', { class: 'flex items-center justify-between gap-3 border-b border-slate-100 py-2 text-sm dark:border-slate-800' },
        h('span', { class: 'flex items-center gap-2' }, c.cc ? flag(c.cc, { size: 16 }) : null, h('span', { class: 'font-medium', text: c.front })),
        h('span', { class: 'text-slate-500', text: c.back.join(', ') })));
    blocks.push(h('div', { class: 'mb-6' },
      h('h3', { class: 'mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500', text: t('hardest') }),
      h('ul', {}, ...rows)));
  }

  function restart(onlyMissed) {
    const deck = appState.deck;
    const cfg = appState.config;
    if (!deck || !cfg) { navigate(routes.setup(id)); return; }
    if (onlyMissed) {
      const missedIds = new Set(s.missed.map((c) => c._id));
      const subset = { ...deck, cards: deck.cards.filter((c) => missedIds.has(c._id)) };
      const session = createSession(subset, { mode: deck.meta.mode, gradeMode: cfg.gradeMode, learn: true, filters: { levels: new Set(), groups: new Set(), topics: new Set(), adaptive: false }, length: 0 });
      setSession(deck, session, cfg);
    } else {
      const session = createSession(deck, { mode: deck.meta.mode, gradeMode: cfg.gradeMode, learn: cfg.learn, filters: { levels: cfg.levels, groups: cfg.groups, topics: cfg.topics || new Set(), adaptive: cfg.adaptive, startLevel: cfg.startLevel }, length: cfg.length });
      setSession(deck, session, cfg);
    }
    navigate(routes.study(id));
  }

  blocks.push(h('div', { class: 'flex flex-wrap justify-center gap-3' },
    s.missed?.length ? button(t('retryMissed'), { variant: 'outline', onClick: () => restart(true) }) : null,
    button(t('newSession'), { variant: 'primary', onClick: () => restart(false) }),
    button(t('home'), { variant: 'ghost', onClick: () => navigate(routes.home()) })));

  mount(container, ...blocks);
}
