// Converts the raw wordlists in build/raw/ into clean deck files in data/.
//  - normalizes text, strips stale success/error telemetry
//  - assigns CEFR `level` (English decks) and `cc` country code (capitals)
//  - de-duplicates within a deck (first wins)
//  - MERGES existing meanings/synonyms/example from data/ by front, so a
//    re-run never wipes AI enrichment or hand edits
//  - writes deterministic, diff-friendly JSON
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { DECKS } from './lib/mapping.js';
import { buildLevelMap, levelForFront } from './lib/cefr.js';
import { isoFor } from './lib/countries.js';
import { dedupeKey, clean } from './lib/normalize.js';

// Merge near-duplicate topic labels so the filter stays tidy.
const TOPIC_ALIASES = {
  'Work & study': 'Work & jobs',
  'School subjects': 'School & study',
  'Space & science': 'Science',
  'Advanced adjectives': 'Describing',
  'Advanced verbs': 'Common verbs',
  'Communication': 'Media & language',
  'Finance': 'Business & economy',
  'Appearance': 'Character',
};
function normTopic(topic) {
  if (!topic) return topic;
  const t = clean(topic);
  return TOPIC_ALIASES[t] || t;
}
import { writeJSONAtomic, readJSON } from './lib/io.js';
import { CARD_KEY_ORDER } from './lib/schema.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAW_DIR = join(__dirname, 'raw');
const SOURCES_DIR = join(__dirname, 'sources');
const DATA_DIR = join(__dirname, '..', 'data');

function loadRaw(deck) {
  const files = Array.isArray(deck.raw) ? deck.raw : [deck.raw];
  const out = [];
  for (const f of files) out.push(...JSON.parse(readFileSync(join(RAW_DIR, f), 'utf8')));
  return out; // all current raw files are JSON arrays
}

// Index existing enrichment (meanings/synonyms/example) by dedupe key of front.
function existingEnrichment(deckId) {
  const path = join(DATA_DIR, `${deckId}.json`);
  if (!existsSync(path)) return new Map();
  const idx = new Map();
  for (const c of readJSON(path)) {
    const e = {};
    if (c.meanings?.length) e.meanings = c.meanings;
    if (c.synonyms?.length) e.synonyms = c.synonyms;
    if (c.example) e.example = c.example;
    if (Object.keys(e).length) idx.set(dedupeKey(c.front), e);
  }
  return idx;
}

export function convert({ levelMap }) {
  const report = [];
  for (const deck of DECKS) {
    const prior = existingEnrichment(deck.id);
    const byKey = new Map();
    const cards = [];
    let dropped = 0;
    let merged = 0;
    const unmapped = [];

    for (const entry of loadRaw(deck)) {
      const card = deck.map(entry);
      if (!card.front || !card.back?.length) {
        dropped++;
        continue;
      }
      if (card.topic) card.topic = normTopic(card.topic);
      const key = dedupeKey(card.front);

      if (byKey.has(key)) {
        // Duplicate front: merge supplemental metadata (explicit level/topic,
        // and any extra accepted answers) into the card we already have, so a
        // thematic supplement can TAG or extend existing words, not just add new.
        const ex = byKey.get(key);
        if (card.level) ex.level = card.level; // explicit level wins over a derived one
        if (card.topic && !ex.topic) ex.topic = card.topic;
        for (const b of card.back) if (!ex.back.includes(b)) ex.back.push(b);
        merged++;
        continue;
      }

      // Explicit level on the card (supplement) wins; else derive from CEFR map.
      if (deck.levels && !card.level) card.level = levelForFront(card.front, levelMap);

      if (deck.meta.mode === 'capitals') {
        const cc = isoFor(card.front);
        if (cc) card.cc = cc;
        else unmapped.push(card.front);
      }

      const e = prior.get(key);
      if (e) Object.assign(card, e);

      byKey.set(key, card);
      cards.push(card);
    }
    void merged;

    // Hand-reviewed corrections: replace the Italian answers of listed words and
    // drop junk entries. Applied last, so they win over the raw data and merges.
    let corrected = 0;
    if (deck.corrections) {
      const corr = JSON.parse(readFileSync(join(RAW_DIR, deck.corrections), 'utf8'));
      for (const [from, to] of Object.entries(corr.rename || {})) {
        const c = byKey.get(dedupeKey(from));
        if (!c) { console.warn(`    ! rename for unknown word "${from}"`); continue; }
        byKey.delete(dedupeKey(from));
        c.front = clean(to);
        byKey.set(dedupeKey(to), c);
      }
      for (const [front, back] of Object.entries(corr.replace || {})) {
        const c = byKey.get(dedupeKey(front));
        if (c) { c.back = back.map(clean); corrected++; }
        else console.warn(`    ! correction for unknown word "${front}"`);
      }
      const drop = new Set((corr.remove || []).map(dedupeKey));
      for (let i = cards.length - 1; i >= 0; i--) if (drop.has(dedupeKey(cards[i].front))) cards.splice(i, 1);
    }

    writeJSONAtomic(join(DATA_DIR, `${deck.id}.json`), cards, CARD_KEY_ORDER);
    const leveled = deck.levels ? cards.filter((c) => c.level).length : 0;
    report.push({ id: deck.id, count: cards.length, dropped, leveled, unmapped, corrected });
  }
  return report;
}

function main() {
  const offline = process.argv.includes('--offline'); // levels still need the CSVs present
  void offline;
  const { map, rows } = buildLevelMap(SOURCES_DIR);
  console.log(`CEFR level map: ${map.size} headwords from ${rows} rows.`);
  const report = convert({ levelMap: map });
  console.log('\nDeck               cards  dropped  leveled');
  for (const r of report) {
    console.log(
      `  ${r.id.padEnd(16)} ${String(r.count).padStart(5)} ${String(r.dropped).padStart(8)} ${String(r.leveled || '-').padStart(8)}`
    );
    if (r.unmapped.length) {
      console.warn(`    ! ${r.id}: ${r.unmapped.length} countries without ISO code: ${r.unmapped.join(', ')}`);
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    main();
  } catch (e) {
    console.error('convert failed:', e.message);
    process.exit(1);
  }
}
