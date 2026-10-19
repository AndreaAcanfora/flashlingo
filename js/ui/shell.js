// App shell: sticky header with title, theme toggle and settings link, plus a
// content region the screens render into.
import { h, mount } from './components.js';
import { t } from './i18n.js';
import { navigate, routes } from '../router.js';
import { getSettings, updateSettings } from '../store/settings.js';
import { setThemeRaw } from '../store/storage.js';

function applyTheme(theme) {
  const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  setThemeRaw(theme === 'system' ? null : theme);
}

export function initTheme() {
  applyTheme(getSettings().theme);
}

function cycleTheme() {
  const order = ['system', 'light', 'dark'];
  const cur = getSettings().theme;
  const nextTheme = order[(order.indexOf(cur) + 1) % order.length];
  updateSettings({ theme: nextTheme });
  applyTheme(nextTheme);
  return nextTheme;
}

const ICON = { system: '🖥️', light: '☀️', dark: '🌙' };

export function renderShell(root) {
  const content = h('main', { class: 'mx-auto w-full max-w-4xl flex-1 px-4 py-6' });

  const themeBtn = h('button', {
    type: 'button',
    class: 'rounded-lg px-3 py-2 text-lg hover:bg-slate-200/60 dark:hover:bg-slate-700/60',
    title: t('theme'),
    'aria-label': t('theme'),
    text: ICON[getSettings().theme],
    onClick: (e) => { e.currentTarget.textContent = ICON[cycleTheme()]; },
  });

  const header = h('header', { class: 'sticky top-0 z-30 border-b border-slate-200/70 bg-slate-50/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80' },
    h('div', { class: 'mx-auto flex w-full max-w-4xl items-center justify-between px-4 py-3' },
      h('button', {
        type: 'button',
        class: 'flex items-center gap-2 text-left',
        onClick: () => navigate(routes.home()),
      },
        h('span', { class: 'text-xl font-bold tracking-tight', text: t('appName') }),
        h('span', { class: 'hidden sm:block text-xs text-slate-500 dark:text-slate-400', text: t('tagline') }),
      ),
      h('div', { class: 'flex items-center gap-1' },
        themeBtn,
        h('button', {
          type: 'button',
          class: 'rounded-lg px-3 py-2 text-lg hover:bg-slate-200/60 dark:hover:bg-slate-700/60',
          title: t('settings'),
          'aria-label': t('settings'),
          text: '⚙️',
          onClick: () => navigate(routes.settings()),
        }),
      ),
    ),
  );

  mount(root, header, content);
  return content;
}
