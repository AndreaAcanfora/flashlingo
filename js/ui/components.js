// Tiny DOM helpers and shared visual primitives. No framework.
// h(tag, attrs, ...children). Classes go in attrs.class (Tailwind class strings
// contain dots/brackets, so they are never encoded in the tag selector).

export function h(tag = 'div', attrs = {}, ...children) {
  const [name, id] = String(tag).split('#');
  const el = document.createElement(name || 'div');
  if (id) el.id = id;
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if ((k === 'value' || k === 'checked' || k === 'disabled' || k === 'type' || k === 'src' || k === 'width' || k === 'height') && k in el) {
      try { el[k] = v; } catch { el.setAttribute(k, v); }
    } else el.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

export function mount(node, ...children) {
  clear(node);
  for (const c of children.flat()) if (c != null && c !== false) node.append(c.nodeType ? c : document.createTextNode(String(c)));
  return node;
}

const FLAG_BASE = new URL('../../assets/flags/', import.meta.url);
export function flag(cc, { size = 20 } = {}) {
  if (!cc) return null;
  const w = Math.round(size * 1.33);
  return h('img', {
    class: 'flag',
    src: new URL(`${cc}.svg`, FLAG_BASE).href,
    alt: '',
    loading: 'lazy',
    style: `width:${w}px;height:${size}px`,
  });
}

const LEVEL_COLOR = {
  A1: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200',
  A2: 'bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-200',
  B1: 'bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200',
  B2: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-200',
  C1: 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/50 dark:text-fuchsia-200',
  C2: 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200',
};

export function levelPill(level) {
  const cls = LEVEL_COLOR[level] || 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300';
  return h('span', { class: `inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`, text: level || '—' });
}

export function chip(label, { active = false, onClick } = {}) {
  const base = 'cursor-pointer select-none rounded-full px-3 py-1 text-sm font-medium border transition';
  const on = 'bg-brand text-white border-brand';
  const off = 'bg-white text-slate-700 border-slate-300 hover:border-brand dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600';
  return h('button', { type: 'button', 'aria-pressed': String(active), class: `${base} ${active ? on : off}`, text: label, onClick });
}

export function button(label, { variant = 'primary', onClick, type = 'button', full = false, disabled = false, title } = {}) {
  const styles = {
    primary: 'bg-brand text-white hover:bg-indigo-600',
    ghost: 'bg-transparent text-slate-600 hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-slate-700/60',
    outline: 'border border-slate-300 text-slate-700 hover:border-brand dark:border-slate-600 dark:text-slate-200',
    danger: 'bg-rose-600 text-white hover:bg-rose-700',
  };
  return h('button', {
    type,
    title,
    disabled,
    class: `inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed ${full ? 'w-full ' : ''}${styles[variant]}`,
    text: label,
    onClick,
  });
}

export function progressBar(fraction, { className = '' } = {}) {
  const pct = Math.round(Math.max(0, Math.min(1, fraction)) * 100);
  return h('div', { class: `h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden ${className}` },
    h('div', { class: 'h-full rounded-full bg-brand transition-all', style: `width:${pct}%` }));
}

let toastTimer = null;
export function toast(message, { type = 'info', ms = 2600 } = {}) {
  const host = document.getElementById('toast-host');
  if (!host) return;
  const color = type === 'error' ? 'bg-rose-600' : type === 'success' ? 'bg-emerald-600' : 'bg-slate-800';
  const node = h('div', { class: `toast pointer-events-auto rounded-lg px-4 py-2 text-sm text-white shadow-lg ${color}`, role: 'status' }, message);
  host.append(node);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.remove(), ms);
}

// Simple modal. Returns { close, panel }. `content` is a node.
export function modal(content, { onClose } = {}) {
  const overlay = h('div', { class: 'fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4', role: 'dialog', 'aria-modal': 'true' });
  const panel = h('div', { class: 'w-full max-w-lg max-h-[90vh] overflow-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900' }, content);
  overlay.append(panel);
  function close() {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
    onClose?.();
  }
  function onKey(e) { if (e.key === 'Escape') close(); }
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', onKey);
  document.body.append(overlay);
  return { close, panel };
}

export function confirmDialog(message, { confirmLabel = 'Confirm', danger = true } = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (v) => { if (!settled) { settled = true; resolve(v); } };
    const body = h('div', {},
      h('p', { class: 'text-slate-700 dark:text-slate-200 mb-5', text: message }),
      h('div', { class: 'flex justify-end gap-2' },
        button('Cancel', { variant: 'ghost', onClick: () => { done(false); m.close(); } }),
        button(confirmLabel, { variant: danger ? 'danger' : 'primary', onClick: () => { done(true); m.close(); } }),
      ),
    );
    const m = modal(body, { onClose: () => done(false) });
  });
}
