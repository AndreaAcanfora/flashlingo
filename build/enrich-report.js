// Prints a readable review of an enriched deck and flags suspicious rows so you
// can spot-check the AI output before promoting it.
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { readJSON } from './lib/io.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

const args = process.argv.slice(2);
const i = args.indexOf('--deck');
const path = i >= 0 && args[i + 1] ? args[i + 1] : join(DATA_DIR, 'english-3000.enriched.json');

if (!existsSync(path)) {
  console.error(`Not found: ${path}\nRun "npm run enrich" first (it writes a .enriched.json sidecar).`);
  process.exit(1);
}

const cards = readJSON(path);
let enriched = 0;
const flags = [];

for (const c of cards) {
  const has = (c.meanings?.length || 0) > 0 && !!c.example;
  if (has) enriched++;
  if (!has) continue;
  if (c.example && !c.example.toLowerCase().includes(c.front.split(' ')[0].toLowerCase())) flags.push([c.front, 'example missing headword']);
  if (c.example && c.example.split(/\s+/).length > 14) flags.push([c.front, 'example > 14 words']);
  if (c.synonyms?.some((s) => s.toLowerCase() === c.front.toLowerCase())) flags.push([c.front, 'synonym equals front']);
  if (!c.meanings?.length) flags.push([c.front, 'no meanings']);
}

console.log(`Enriched ${enriched}/${cards.length} cards in ${path}\n`);
console.log('Sample (first 10 enriched):');
for (const c of cards.filter((c) => c.meanings?.length && c.example).slice(0, 10)) {
  console.log(`  ${c.front}`);
  console.log(`    meanings:  ${c.meanings.join(', ')}`);
  console.log(`    synonyms:  ${(c.synonyms || []).join(', ') || '—'}`);
  console.log(`    example:   ${c.example}`);
}

if (flags.length) {
  console.log(`\n${flags.length} rows flagged for review:`);
  for (const [front, why] of flags.slice(0, 40)) console.log(`  ! ${front}: ${why}`);
} else {
  console.log('\nNo rows flagged.');
}
