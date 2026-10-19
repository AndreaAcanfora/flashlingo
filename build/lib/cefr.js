// Builds an English headword -> CEFR level map from the two source CSVs.
// Conflict rule: the LOWEST (earliest-learned) level wins, so a word known at
// A1 is tagged A1 even if it also appears at a higher level for another sense.
import { readFileSync, existsSync } from 'node:fs';
import { parse } from 'csv-parse/sync';
import { clean } from './normalize.js';

const LEVEL_RANK = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6 };

function keyOf(headword) {
  return clean(headword).toLowerCase();
}

export function buildLevelMap(sourcesDir) {
  const files = ['cefrj.csv', 'octanove.csv'];
  const map = new Map();
  let rows = 0;
  for (const file of files) {
    const path = `${sourcesDir}/${file}`;
    if (!existsSync(path)) {
      throw new Error(`CEFR source missing: ${path} — run "npm run fetch-sources" first.`);
    }
    const records = parse(readFileSync(path, 'utf8'), { columns: true, skip_empty_lines: true });
    for (const r of records) {
      const hw = r.headword || r.Headword || '';
      const lv = (r.CEFR || r.cefr || '').trim().toUpperCase();
      if (!LEVEL_RANK[lv]) continue;
      // Headwords sometimes pack variants: "a.m./A.M./am/AM" or "x, y".
      for (const part of String(hw).split(/[/,]/)) {
        const k = keyOf(part);
        if (!k) continue;
        const cur = map.get(k);
        if (!cur || LEVEL_RANK[lv] < LEVEL_RANK[cur]) map.set(k, lv);
        rows++;
      }
    }
  }
  return { map, rows };
}

// Look up a card's level by trying its "/"-separated variants, then the first word.
export function levelForFront(front, map) {
  const lower = clean(front).toLowerCase();
  for (const cand of lower.split('/')) {
    const k = cand.trim();
    if (map.has(k)) return map.get(k);
  }
  const first = (lower.match(/[a-z']+/) || [''])[0];
  return map.get(first) || null;
}
