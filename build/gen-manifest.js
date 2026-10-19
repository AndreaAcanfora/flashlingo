// Generates data/decks.json from the deck metadata in lib/mapping.js, with the
// `count` recomputed from each deck file. Hand-authored fields live in mapping.js;
// `count` is always build-generated and must never be edited by hand.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { DECKS } from './lib/mapping.js';
import { readJSON, writeJSONAtomic } from './lib/io.js';
import { MANIFEST_KEY_ORDER } from './lib/schema.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

export function genManifest() {
  const manifest = DECKS.map((deck) => {
    const path = join(DATA_DIR, `${deck.id}.json`);
    if (!existsSync(path)) throw new Error(`deck file missing for ${deck.id}: run convert first`);
    const cards = readJSON(path);
    const enriched =
      deck.levels && cards.some((c) => c.meanings?.length || c.synonyms?.length || c.example);
    const entry = { id: deck.id, ...deck.meta, count: cards.length };
    if (enriched) entry.enriched = true;
    return entry;
  });
  writeJSONAtomic(join(DATA_DIR, 'decks.json'), manifest, MANIFEST_KEY_ORDER);
  return manifest;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const m = genManifest();
    console.log(`Wrote data/decks.json (${m.length} decks, ${m.reduce((s, d) => s + d.count, 0)} cards).`);
  } catch (e) {
    console.error('gen-manifest failed:', e.message);
    process.exit(1);
  }
}
