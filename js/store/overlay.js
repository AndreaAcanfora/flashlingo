// Editor overlay: user edits layered on top of the shipped deck JSON, persisted
// in localStorage. Field-level overrides mean upstream data updates still flow
// through fields the user hasn't touched.
import * as storage from './storage.js';

function key(deckId) {
  return `overlay:${deckId}`;
}

export function loadOverlay(deckId) {
  return storage.get(key(deckId), null) || { edited: {}, added: [], removed: {} };
}
export function saveOverlay(deckId, overlay) {
  storage.set(deckId && key(deckId), overlay);
}
export function clearOverlay(deckId) {
  storage.remove(key(deckId));
}

export function hasOverlay(deckId) {
  const o = storage.get(key(deckId), null);
  return !!o && (Object.keys(o.edited).length || o.added.length || Object.keys(o.removed).length);
}

// Merge a shipped card list with an overlay. Returns resolved cards (with _id)
// plus a per-card status flag used by the editor UI.
export function resolveDeck(shipped, overlay) {
  const out = [];
  for (const c of shipped) {
    if (overlay.removed[c._id]) {
      out.push({ ...c, _status: 'removed' });
      continue;
    }
    const patch = overlay.edited[c._id];
    out.push(patch ? { ...c, ...patch, _status: 'edited' } : c);
  }
  for (const c of overlay.added) out.push({ ...c, _status: 'added' });
  return out;
}

// Produce a shipped-shaped array (no _id/_status/internal fields) for export.
export function toShippedShape(resolved) {
  const order = ['front', 'back', 'meanings', 'synonyms', 'example', 'level', 'group', 'cc'];
  return resolved
    .filter((c) => c._status !== 'removed')
    .map((c) => {
      const out = {};
      for (const k of order) if (c[k] !== undefined && !(Array.isArray(c[k]) && c[k].length === 0)) out[k] = c[k];
      return out;
    });
}
