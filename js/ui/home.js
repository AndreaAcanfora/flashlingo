// Home screen: the deck grid.
import { h, mount, button, progressBar } from './components.js';
import { t } from './i18n.js';
import { navigate, routes } from '../router.js';
import { loadManifest } from '../data/decks.js';
import { mastery } from '../store/stats.js';

export async function renderHome(container) {
  mount(container, h('p', { class: 'text-slate-500 dark:text-slate-400', text: 'Loading…' }));
  let manifest;
  try {
    manifest = await loadManifest();
  } catch (e) {
    mount(container, h('p', { class: 'text-rose-600', text: `Could not load decks: ${e.message}` }));
    return;
  }

  const grid = h('div', { class: 'grid grid-cols-1 gap-4 sm:grid-cols-2' });
  for (const deck of manifest) {
    const m = mastery(deck.id, deck.count);
    grid.append(
      h('div', { class: 'flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900' },
        h('div', { class: 'flex-1' },
          h('h3', { class: 'text-lg font-semibold', text: deck.title }),
          h('p', { class: 'mt-1 text-sm text-slate-500 dark:text-slate-400', text: deck.desc }),
        ),
        h('div', { class: 'mt-4' },
          h('div', { class: 'mb-1 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400' },
            h('span', { text: `${deck.count} ${t('cards')}` }),
            h('span', { text: `${Math.round(m * 100)}% ${t('mastered')}` }),
          ),
          progressBar(m),
        ),
        h('div', { class: 'mt-4 flex gap-2' },
          h('div', { class: 'flex-1' }, button(t('study'), { variant: 'primary', full: true, onClick: () => navigate(routes.setup(deck.id)) })),
          button(t('edit'), { variant: 'outline', onClick: () => navigate(routes.editor(deck.id)) }),
        ),
      ),
    );
  }

  mount(container,
    h('div', { class: 'mb-5' },
      h('h2', { class: 'text-2xl font-bold', text: t('appName') }),
      h('p', { class: 'text-slate-500 dark:text-slate-400', text: t('home_subtitle') }),
    ),
    grid,
  );
}
