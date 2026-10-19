// Validates data/*.json + decks.json against the schemas and a set of semantic
// rules. Exits non-zero on any error (used as `npm test` and the CI gate).
import { readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import Ajv from 'ajv';
import { readJSON } from './lib/io.js';
import { dedupeKey } from './lib/normalize.js';
import { deckSchema, manifestSchema } from './lib/schema.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const FLAGS_DIR = join(__dirname, '..', 'assets', 'flags');

const ajv = new Ajv({ allErrors: true });
const validateDeck = ajv.compile(deckSchema);
const validateManifest = ajv.compile(manifestSchema);

const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

function isNFC(s) {
  return s.normalize('NFC') === s;
}

function main() {
  const manifest = readJSON(join(DATA_DIR, 'decks.json'));
  if (!validateManifest(manifest)) {
    for (const e of validateManifest.errors) err(`decks.json${e.instancePath} ${e.message}`);
  }

  const idsInManifest = new Set(manifest.map((d) => d.id));
  const deckFiles = readdirSync(DATA_DIR).filter((f) => f.endsWith('.json') && f !== 'decks.json');
  const idsOnDisk = new Set(deckFiles.map((f) => f.replace(/\.json$/, '')));

  for (const id of idsInManifest) if (!idsOnDisk.has(id)) err(`manifest lists "${id}" but data/${id}.json is missing`);
  for (const id of idsOnDisk) if (!idsInManifest.has(id)) err(`data/${id}.json has no manifest entry`);

  for (const entry of manifest) {
    const path = join(DATA_DIR, `${entry.id}.json`);
    if (!existsSync(path)) continue;
    const cards = readJSON(path);

    if (!validateDeck(cards)) {
      for (const e of validateDeck.errors.slice(0, 20)) err(`${entry.id}${e.instancePath} ${e.message}`);
    }

    if (cards.length !== entry.count) err(`${entry.id}: manifest count ${entry.count} != ${cards.length} cards`);

    const keys = new Set();
    for (const [i, c] of cards.entries()) {
      const where = `${entry.id}[${i}] (${c.front})`;
      const key = dedupeKey(c.front || '');
      if (keys.has(key)) err(`${where}: duplicate front "${c.front}"`);
      keys.add(key);

      for (const s of [c.front, ...(c.back || []), ...(c.meanings || []), ...(c.synonyms || [])]) {
        if (typeof s === 'string' && !isNFC(s)) warn(`${where}: non-NFC string "${s}"`);
      }

      if (entry.mode === 'capitals') {
        if (!c.group) err(`${where}: capitals card missing group`);
        if (!c.cc) err(`${where}: capitals card missing cc (country code)`);
        else if (!existsSync(join(FLAGS_DIR, `${c.cc}.svg`))) err(`${where}: no flag asset assets/flags/${c.cc}.svg`);
      }

      // Enrichment sanity (warnings only)
      if (entry.enriched && Array.isArray(c.synonyms)) {
        const f = (c.front || '').toLowerCase();
        if (c.synonyms.some((s) => s.toLowerCase() === f)) warn(`${where}: synonym equals front`);
      }
    }
  }

  for (const w of warnings) console.warn('warn:', w);
  if (errors.length) {
    for (const e of errors) console.error('ERROR:', e);
    console.error(`\nValidation FAILED: ${errors.length} error(s), ${warnings.length} warning(s).`);
    process.exit(1);
  }
  const total = manifest.reduce((s, d) => s + d.count, 0);
  console.log(`Validation OK: ${manifest.length} decks, ${total} cards, ${warnings.length} warning(s).`);
}

try {
  main();
} catch (e) {
  console.error('validate crashed:', e.message);
  process.exit(1);
}
