// Minimal hash router. Parses `#/deck/:id/study` style routes and notifies a
// listener on change. Hash routing needs no server rewrites (good for Pages).

export function parseHash() {
  const raw = (location.hash || '#/').replace(/^#/, '');
  const path = raw.split('?')[0];
  const parts = path.split('/').filter(Boolean); // ['deck','english-3000','study']
  if (parts.length === 0) return { name: 'home', params: {} };
  if (parts[0] === 'settings') return { name: 'settings', params: {} };
  if (parts[0] === 'deck' && parts[1]) {
    const id = decodeURIComponent(parts[1]);
    const sub = parts[2];
    if (sub === 'study') return { name: 'study', params: { id } };
    if (sub === 'results') return { name: 'results', params: { id } };
    if (sub === 'edit') return { name: 'editor', params: { id } };
    return { name: 'setup', params: { id } };
  }
  return { name: 'home', params: {} };
}

export function navigate(path) {
  if (location.hash === `#${path}`) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = path;
}

export function onRoute(handler) {
  window.addEventListener('hashchange', handler);
  return () => window.removeEventListener('hashchange', handler);
}

// Named route builders.
export const routes = {
  home: () => '/',
  setup: (id) => `/deck/${encodeURIComponent(id)}`,
  study: (id) => `/deck/${encodeURIComponent(id)}/study`,
  results: (id) => `/deck/${encodeURIComponent(id)}/results`,
  editor: (id) => `/deck/${encodeURIComponent(id)}/edit`,
  settings: () => '/settings',
};
