// Ensures the CEFR source CSVs are present in build/sources/ and match the
// pinned SHA-256 in sources.lock.json. Downloads any that are missing.
// These files are gitignored and never redistributed (see NOTICE) — we only
// derive a single level label from them.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCES_DIR = join(__dirname, 'sources');
const LOCK = JSON.parse(readFileSync(join(__dirname, 'sources.lock.json'), 'utf8'));

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

async function ensure(src, { offline }) {
  const path = join(SOURCES_DIR, src.file);
  if (existsSync(path)) {
    const got = sha256(readFileSync(path));
    if (got === src.sha256) {
      console.log(`  ok    ${src.file} (sha256 verified)`);
      return;
    }
    throw new Error(`${src.file}: sha256 mismatch\n  expected ${src.sha256}\n  got      ${got}`);
  }
  if (offline) {
    throw new Error(
      `${src.file} missing and --offline set. Download it manually from:\n  ${src.url}\n  into ${SOURCES_DIR}/`
    );
  }
  console.log(`  fetch ${src.file} <- ${src.url}`);
  const res = await fetch(src.url);
  if (!res.ok) throw new Error(`${src.file}: HTTP ${res.status} fetching ${src.url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const got = sha256(buf);
  if (got !== src.sha256) {
    throw new Error(`${src.file}: downloaded sha256 mismatch\n  expected ${src.sha256}\n  got ${got}`);
  }
  writeFileSync(path, buf);
  console.log(`  saved ${src.file} (sha256 verified)`);
}

export async function fetchSources({ offline = false } = {}) {
  if (!existsSync(SOURCES_DIR)) mkdirSync(SOURCES_DIR, { recursive: true });
  console.log('Checking CEFR sources:');
  for (const src of LOCK.sources) await ensure(src, { offline });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const offline = process.argv.includes('--offline');
  fetchSources({ offline }).catch((e) => {
    console.error('fetch-sources failed:', e.message);
    process.exit(1);
  });
}
