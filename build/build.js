// Orchestrator: fetch sources (unless --offline) -> convert -> manifest -> validate.
// One command to regenerate everything deterministically.
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fetchSources } from './fetch-sources.js';
import { buildLevelMap } from './lib/cefr.js';
import { convert } from './convert.js';
import { genManifest } from './gen-manifest.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCES_DIR = join(__dirname, 'sources');

async function main() {
  const offline = process.argv.includes('--offline');

  console.log('== fetch-sources ==');
  await fetchSources({ offline });

  console.log('\n== convert ==');
  const { map, rows } = buildLevelMap(SOURCES_DIR);
  console.log(`CEFR level map: ${map.size} headwords from ${rows} rows.`);
  const report = convert({ levelMap: map });
  for (const r of report) {
    console.log(`  ${r.id.padEnd(16)} ${r.count} cards (dropped ${r.dropped}${r.leveled ? `, leveled ${r.leveled}` : ''}${r.corrected ? `, corrected ${r.corrected}` : ''})`);
    if (r.unmapped.length) console.warn(`    ! unmapped countries: ${r.unmapped.join(', ')}`);
  }

  console.log('\n== gen-manifest ==');
  const m = genManifest();
  console.log(`  ${m.length} decks, ${m.reduce((s, d) => s + d.count, 0)} cards`);

  console.log('\n== validate ==');
  execFileSync('node', [join(__dirname, 'validate.js')], { stdio: 'inherit' });

  console.log('\nBuild complete.');
}

main().catch((e) => {
  console.error('build failed:', e.message);
  process.exit(1);
});
