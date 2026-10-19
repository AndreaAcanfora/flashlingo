// App bootstrap: init theme, render the shell, and route to screens.
import { renderShell, initTheme } from './ui/shell.js';
import { parseHash, onRoute } from './router.js';
import { renderHome } from './ui/home.js';
import { renderSetup } from './ui/setup.js';
import { renderStudy } from './ui/study.js';
import { renderResults } from './ui/results.js';
import { renderEditor } from './ui/editor.js';
import { renderSettings } from './ui/settings.js';
import { h, mount } from './ui/components.js';

const root = document.getElementById('app');
initTheme();
const content = renderShell(root);

let cleanup = null;

async function render() {
  if (cleanup) { try { cleanup(); } catch {} cleanup = null; }
  window.speechSynthesis?.cancel?.();
  const route = parseHash();
  try {
    switch (route.name) {
      case 'home': await renderHome(content); break;
      case 'setup': await renderSetup(content, route.params); break;
      case 'study': cleanup = renderStudy(content, route.params); break;
      case 'results': renderResults(content, route.params); break;
      case 'editor': await renderEditor(content, route.params); break;
      case 'settings': renderSettings(content); break;
      default: await renderHome(content);
    }
    content.scrollIntoView?.({ block: 'start' });
    window.scrollTo(0, 0);
  } catch (e) {
    console.error(e);
    mount(content, h('div', { class: 'rounded-xl border border-rose-300 bg-rose-50 p-6 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200' },
      h('h2', { class: 'mb-2 font-bold', text: 'Something went wrong' }),
      h('pre', { class: 'overflow-auto text-sm', text: String(e && e.stack || e) })));
  }
}

onRoute(render);
render();
