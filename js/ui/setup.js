// Setup screen: choose mode, goal, filters (level/adaptive, topic, continent)
// and length for a deck, then start a session.
import { h, mount, chip, button } from './components.js';
import { t } from './i18n.js';
import { navigate, routes } from '../router.js';
import { loadDeck, levelsIn, groupsIn, topicsIn } from '../data/decks.js';
import { getSettings } from '../store/settings.js';
import { createSession, applyFilters } from '../engine/session.js';
import { setSession } from '../state.js';
import { LEVELS } from '../engine/adaptive.js';

export async function renderSetup(container, { id }) {
  mount(container, h('p', { class: 'text-slate-500', text: 'Loading…' }));
  let deck;
  try {
    deck = await loadDeck(id);
  } catch (e) {
    mount(container, h('p', { class: 'text-rose-600', text: e.message }));
    return;
  }

  const settings = getSettings();
  const availableLevels = levelsIn(deck.cards);
  const hasLevels = deck.meta.id === 'english-3000' || deck.meta.id === 'english-vocab';
  const groups = groupsIn(deck.cards);
  const topics = topicsIn(deck.cards);

  const state = {
    gradeMode: settings.defaultGradeMode,
    learn: true, // repeat until learned (the default the user prefers)
    levels: new Set(),
    groups: new Set(),
    topics: new Set(),
    adaptive: false,
    startLevel: 'A1',
    length: settings.sessionLength,
  };

  const section = (title, node, hint) =>
    h('div', { class: 'mb-6' },
      h('h3', { class: 'mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400', text: title }),
      hint ? h('p', { class: 'mb-2 -mt-1 text-xs text-slate-400', text: hint }) : null,
      node);

  function countMatching() {
    if (state.adaptive) return deck.cards.filter((c) => c.level).length;
    return applyFilters(deck.cards, { levels: state.levels, groups: state.groups, topics: state.topics }).length;
  }

  let startBtn, countLabel, lengthBlock;
  function refresh() {
    const n = countMatching();
    countLabel.textContent = n ? `${n} ${t('cards')}` : t('emptyFilter');
    startBtn.disabled = n === 0;
    if (lengthBlock) lengthBlock.style.display = state.learn ? 'none' : '';
  }

  // Mode (self-grade / typing)
  const modeRow = h('div', { class: 'flex gap-2' });
  function renderMode() {
    mount(modeRow,
      chip(t('selfgrade'), { active: state.gradeMode === 'selfgrade', onClick: () => { state.gradeMode = 'selfgrade'; renderMode(); } }),
      chip(t('typing'), { active: state.gradeMode === 'typing', onClick: () => { state.gradeMode = 'typing'; renderMode(); } }));
  }
  renderMode();

  // Goal (repeat until learned / quick fixed-length)
  const goalRow = h('div', { class: 'flex gap-2' });
  function renderGoal() {
    mount(goalRow,
      chip(t('goalLearn'), { active: state.learn, onClick: () => { state.learn = true; renderGoal(); refresh(); } }),
      chip(t('goalQuick'), { active: !state.learn, onClick: () => { state.learn = false; renderGoal(); refresh(); } }));
  }
  renderGoal();

  const blocks = [
    section(t('mode'), modeRow),
    section(t('goal'), goalRow, t('goalHint')),
  ];

  // Levels (leveled decks)
  if (hasLevels) {
    const adaptiveRow = h('label', { class: 'flex items-center gap-2 mb-3 cursor-pointer' },
      h('input', { type: 'checkbox', class: 'h-4 w-4 accent-indigo-600', onChange: (e) => { state.adaptive = e.target.checked; renderLevels(); refresh(); } }),
      h('span', { class: 'text-sm font-medium', text: t('adaptive') }),
      h('span', { class: 'text-xs text-slate-500', text: t('adaptiveHint') }));
    const levelArea = h('div', {});
    function renderLevels() {
      if (state.adaptive) {
        mount(levelArea, h('div', { class: 'flex flex-wrap items-center gap-2' },
          h('span', { class: 'text-sm text-slate-500', text: t('startLevel') }),
          ...LEVELS.map((l) => chip(l, { active: state.startLevel === l, onClick: () => { state.startLevel = l; renderLevels(); } }))));
      } else {
        mount(levelArea, h('div', { class: 'flex flex-wrap gap-2' },
          ...availableLevels.map((l) => chip(l === null ? t('unleveled') : l, {
            active: state.levels.has(l),
            onClick: () => { state.levels.has(l) ? state.levels.delete(l) : state.levels.add(l); renderLevels(); refresh(); },
          }))));
      }
    }
    renderLevels();
    blocks.push(section(t('levels'), h('div', {}, adaptiveRow, levelArea)));
  }

  // Topics (optional)
  if (topics.length) {
    const area = h('div', { class: 'flex flex-wrap gap-2' });
    function renderTopics() {
      mount(area, ...topics.map((tp) => chip(tp, {
        active: state.topics.has(tp),
        onClick: () => { state.topics.has(tp) ? state.topics.delete(tp) : state.topics.add(tp); renderTopics(); refresh(); },
      })));
    }
    renderTopics();
    blocks.push(section(t('topics'), area, t('topicsHint')));
  }

  // Continents (capitals)
  if (groups.length) {
    const area = h('div', { class: 'flex flex-wrap gap-2' });
    function renderGroups() {
      mount(area, ...groups.map((g) => chip(g, {
        active: state.groups.has(g),
        onClick: () => { state.groups.has(g) ? state.groups.delete(g) : state.groups.add(g); renderGroups(); refresh(); },
      })));
    }
    renderGroups();
    blocks.push(section(t('continents'), area));
  }

  // Length (only for quick mode)
  const lengthRow = h('div', { class: 'flex flex-wrap gap-2' });
  function renderLength() {
    const opts = [10, 20, 30, 50, 0];
    mount(lengthRow, ...opts.map((n) => chip(n === 0 ? t('all') : String(n), {
      active: state.length === n,
      onClick: () => { state.length = n; renderLength(); },
    })));
  }
  renderLength();
  lengthBlock = section(t('length'), lengthRow);
  blocks.push(lengthBlock);

  countLabel = h('span', { class: 'text-sm text-slate-500 dark:text-slate-400' });
  startBtn = button(t('start'), {
    variant: 'primary',
    onClick: () => {
      const session = createSession(deck, {
        mode: deck.meta.mode,
        gradeMode: state.gradeMode,
        learn: state.learn,
        filters: { levels: state.levels, groups: state.groups, topics: state.topics, adaptive: state.adaptive, startLevel: state.startLevel },
        length: state.length,
      });
      setSession(deck, session, { ...state, levels: new Set(state.levels), groups: new Set(state.groups), topics: new Set(state.topics) });
      navigate(routes.study(id));
    },
  });

  mount(container,
    h('div', { class: 'mb-5 flex items-center gap-3' },
      button('← ' + t('back'), { variant: 'ghost', onClick: () => navigate(routes.home()) }),
      h('div', {}, h('h2', { class: 'text-xl font-bold', text: deck.meta.title }), h('p', { class: 'text-sm text-slate-500', text: deck.meta.desc }))),
    ...blocks,
    h('div', { class: 'flex items-center gap-4 border-t border-slate-200 pt-4 dark:border-slate-800' }, startBtn, countLabel));
  refresh();
}
