// Loads the deck manifest and individual decks over HTTP (relative paths so it
// works on a GitHub Pages project subpath), applies the editor overlay, and
// caches results in memory.
import { assignIds } from './card.js';
import { loadOverlay, resolveDeck } from '../store/overlay.js';

// Resolve data/ relative to this module, independent of the page URL / subpath.
const DATA_BASE = new URL('../../data/', import.meta.url);

let manifestCache = null;
const deckCache = new Map();

export async function loadManifest() {
  if (manifestCache) return manifestCache;
  const res = await fetch(new URL('decks.json', DATA_BASE));
  if (!res.ok) throw new Error(`Failed to load decks.json (HTTP ${res.status})`);
  manifestCache = await res.json();
  return manifestCache;
}

export async function getDeckMeta(deckId) {
  const manifest = await loadManifest();
  const meta = manifest.find((d) => d.id === deckId);
  if (!meta) throw new Error(`Unknown deck: ${deckId}`);
  return meta;
}

// Returns { meta, cards } with overlay applied and stable _id assigned.
export async function loadDeck(deckId) {
  if (deckCache.has(deckId)) return deckCache.get(deckId);
  const meta = await getDeckMeta(deckId);
  const res = await fetch(new URL(`${deckId}.json`, DATA_BASE));
  if (!res.ok) throw new Error(`Failed to load ${deckId}.json (HTTP ${res.status})`);
  const shipped = assignIds(await res.json());
  const overlay = loadOverlay(deckId);
  const cards = resolveDeck(shipped, overlay).filter((c) => c._status !== 'removed');
  const result = { meta, cards, shipped, overlay };
  deckCache.set(deckId, result);
  return result;
}

// Drop the in-memory cache for a deck (after the overlay changes in the editor).
export function invalidateDeck(deckId) {
  deckCache.delete(deckId);
}

// Distinct non-null levels present in a deck, in CEFR order.
export function levelsIn(cards) {
  const order = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const present = new Set(cards.map((c) => c.level).filter(Boolean));
  const out = order.filter((l) => present.has(l));
  if (cards.some((c) => !c.level)) out.push(null); // "Unleveled" bucket
  return out;
}

// Distinct groups (e.g. continents) present in a deck.
export function groupsIn(cards) {
  return [...new Set(cards.map((c) => c.group).filter(Boolean))].sort();
}

// Distinct topics present in a deck (for the optional topic filter).
export function topicsIn(cards) {
  return [...new Set(cards.map((c) => c.topic).filter(Boolean))].sort();
}
