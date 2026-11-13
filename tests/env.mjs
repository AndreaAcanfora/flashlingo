// Browser shims for running the app modules under `node --test`:
// an in-memory localStorage and a fetch that reads file: URLs from disk.
import { readFile } from 'node:fs/promises';

class MemoryStorage {
  #m = new Map();
  get length() { return this.#m.size; }
  key(i) { return [...this.#m.keys()][i] ?? null; }
  getItem(k) { return this.#m.has(k) ? this.#m.get(k) : null; }
  setItem(k, v) { this.#m.set(k, String(v)); }
  removeItem(k) { this.#m.delete(k); }
  clear() { this.#m.clear(); }
}

Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true, writable: true });

globalThis.fetch = async (url) => {
  const u = new URL(url);
  if (u.protocol !== 'file:') throw new Error(`unexpected fetch: ${url}`);
  try {
    const body = await readFile(u, 'utf8');
    return { ok: true, status: 200, json: async () => JSON.parse(body) };
  } catch {
    return { ok: false, status: 404, json: async () => null };
  }
};

export function resetStorage() {
  localStorage.clear();
}

// Deterministic Math.random for tests that look at selection order.
export function seedRandom(seed = 1) {
  let s = seed >>> 0;
  Math.random = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}
