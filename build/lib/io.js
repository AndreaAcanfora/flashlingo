// Small filesystem helpers: atomic writes and diff-friendly, deterministic JSON.
import { writeFileSync, renameSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export function readJSON(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

// Deterministic stringify: object keys follow `order` first, then the rest
// alphabetically. Keeps git diffs minimal and output byte-stable across runs.
export function stableStringify(value, order = []) {
  const seen = new WeakSet();
  const rank = new Map(order.map((k, i) => [k, i]));
  function sortKeys(obj) {
    if (Array.isArray(obj)) return obj.map(sortKeys);
    if (obj && typeof obj === 'object') {
      if (seen.has(obj)) throw new Error('circular reference');
      seen.add(obj);
      const out = {};
      const keys = Object.keys(obj).sort((a, b) => {
        const ra = rank.has(a) ? rank.get(a) : Infinity;
        const rb = rank.has(b) ? rank.get(b) : Infinity;
        return ra !== rb ? ra - rb : a < b ? -1 : a > b ? 1 : 0;
      });
      for (const k of keys) out[k] = sortKeys(obj[k]);
      return out;
    }
    return obj;
  }
  return JSON.stringify(sortKeys(value), null, 2) + '\n';
}

// Atomic write: write to a temp sibling then rename, so a crash never leaves a
// half-written file. `order` controls per-object key ordering (see above).
export function writeJSONAtomic(path, value, order = []) {
  const tmp = join(dirname(path), `.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`);
  writeFileSync(tmp, stableStringify(value, order));
  renameSync(tmp, path);
}
