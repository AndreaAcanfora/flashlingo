// OPTIONAL AI enrichment. Fills `meanings`, `synonyms` and `example` for English
// decks using the Anthropic API. You run this yourself, with your own key — the
// app and the rest of the build never call any paid API.
//
//   cp .env.example .env   # then put your ANTHROPIC_API_KEY in it
//   npm run enrich:dry     # prints scope + cost estimate, no API calls
//   npm run enrich         # writes data/<deck>.enriched.json (a sidecar)
//
// Flags: --deck <path> (default data/english-3000.json), --in-place, --force,
//        --dry-run, --yes.
import 'dotenv/config';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, basename } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import pLimit from 'p-limit';
import { readJSON, writeJSONAtomic } from './lib/io.js';
import { CARD_KEY_ORDER } from './lib/schema.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};

const DRY = flag('--dry-run');
const IN_PLACE = flag('--in-place');
const FORCE = flag('--force');
const YES = flag('--yes');
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5';
const CONCURRENCY = Number(process.env.ENRICH_CONCURRENCY || 5);
const MAX_TOKENS = Number(process.env.ENRICH_MAX_TOKENS || 400);

const deckPath = opt('--deck', join(DATA_DIR, 'english-3000.json'));
const outPath = IN_PLACE ? deckPath : deckPath.replace(/\.json$/, '.enriched.json');

const TOOL = {
  name: 'provide_enrichment',
  description: 'Return enrichment for one English headword.',
  input_schema: {
    type: 'object',
    properties: {
      meanings: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 4,
        description: 'Main Italian senses of the English word, most common first.' },
      synonyms: { type: 'array', items: { type: 'string' }, maxItems: 5,
        description: 'Common ENGLISH synonyms of the headword. [] if none.' },
      example: { type: 'string',
        description: 'One natural ENGLISH sentence (<=14 words) that uses the headword.' },
    },
    required: ['meanings', 'synonyms', 'example'],
    additionalProperties: false,
  },
};

const SYSTEM = [
  {
    type: 'text',
    text: [
      'You are a bilingual Italian–English lexicographer helping build study flashcards.',
      'For each English headword you receive, call provide_enrichment with:',
      '- meanings: the main senses in ITALIAN, most common first (1–4 items).',
      '- synonyms: common ENGLISH synonyms of the headword (0–5). Never repeat the headword.',
      '- example: ONE natural ENGLISH sentence, at most 14 words, that uses the headword.',
      'No markdown, no extra commentary — only the tool call. Keep it accurate and concise.',
      '',
      'Example — input "accomplish" / known: realizzare:',
      '  meanings: ["realizzare","portare a termine","compiere"]',
      '  synonyms: ["achieve","complete","fulfill"]',
      '  example: "She worked hard to accomplish her goals this year."',
      '',
      'Example — input "fast" / known: veloce:',
      '  meanings: ["veloce","rapido","digiunare"]',
      '  synonyms: ["quick","rapid","swift"]',
      '  example: "The new train is remarkably fast and quiet."',
    ].join('\n'),
    cache_control: { type: 'ephemeral' },
  },
];

function isEnriched(card) {
  return (card.meanings?.length || 0) > 0 && !!card.example;
}

function userMessage(card) {
  return [
    `Word: ${card.front}`,
    `Known Italian meaning(s): ${(card.back || []).join(', ')}`,
    card.level ? `Level: ${card.level}` : null,
    'Call provide_enrichment for this word.',
  ].filter(Boolean).join('\n');
}

async function estimate(client, cards, todo) {
  // Rough token estimate: measure system + one sample user message.
  let sysTokens = 0, userTokens = 0;
  try {
    const sys = await client.messages.countTokens({ model: MODEL, system: SYSTEM, messages: [{ role: 'user', content: 'x' }] });
    sysTokens = sys.input_tokens;
    const u = await client.messages.countTokens({ model: MODEL, messages: [{ role: 'user', content: userMessage(cards[0]) }] });
    userTokens = Math.max(0, u.input_tokens - 4);
  } catch {
    sysTokens = 400; userTokens = 25; // fallback guesses
  }
  const n = todo.length;
  // First call writes the cache (~1.25x system), the rest read it (~0.1x).
  const inputTokens = Math.round(sysTokens * (1.25 + 0.1 * (n - 1)) + userTokens * n);
  const outputTokens = n * MAX_TOKENS;
  return { n, sysTokens, userTokens, inputTokens, outputTokens };
}

async function main() {
  if (!existsSync(deckPath)) throw new Error(`deck not found: ${deckPath}`);
  const cards = readJSON(deckPath);
  const base = existsSync(outPath) && !IN_PLACE ? readJSON(outPath) : cards.map((c) => ({ ...c }));
  // index base by front so we can resume
  const byFront = new Map(base.map((c) => [c.front, c]));
  const working = cards.map((c) => byFront.get(c.front) || { ...c });

  const todo = working.filter((c) => FORCE || !isEnriched(c));
  console.log(`Deck: ${basename(deckPath)} — ${working.length} cards, ${todo.length} to enrich${FORCE ? ' (--force)' : ''}.`);
  console.log(`Model: ${MODEL}  (VERIFY this id is current in the Anthropic console / claude-api skill before a real run.)`);

  if (!todo.length) {
    console.log('Nothing to do.');
    return;
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!DRY && !key) throw new Error('ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add your key.');

  const client = new Anthropic({ apiKey: key || 'dry-run' });

  const est = await estimate(client, working, todo).catch(() => null);
  if (est) {
    console.log(`\nEstimate for ${est.n} words:`);
    console.log(`  input ~${est.inputTokens.toLocaleString()} tok (system cached), output ~${est.outputTokens.toLocaleString()} tok`);
    console.log('  Cost depends on current pricing for this model — verify in the Anthropic console.');
  }

  if (DRY) {
    console.log('\n--dry-run: no API calls made. Sample prompt:\n');
    console.log('--- system (cached) ---\n' + SYSTEM[0].text.slice(0, 240) + '…');
    console.log('\n--- user ---\n' + userMessage(todo[0]));
    return;
  }

  if (!YES && process.stdout.isTTY) {
    process.stdout.write(`\nProceed with ${todo.length} API calls? [y/N] `);
    const ok = await new Promise((r) => process.stdin.once('data', (d) => r(/^y/i.test(d.toString().trim()))));
    if (!ok) { console.log('Aborted.'); return; }
  }

  const limit = pLimit(CONCURRENCY);
  const failures = [];
  let done = 0, sinceFlush = 0;
  const flush = () => { writeJSONAtomic(outPath, working, CARD_KEY_ORDER); sinceFlush = 0; };
  const onSig = () => { console.log('\nInterrupted — flushing progress…'); flush(); process.exit(1); };
  process.on('SIGINT', onSig);

  await Promise.all(todo.map((card) => limit(async () => {
    try {
      const res = await client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        temperature: 0,
        system: SYSTEM,
        tools: [TOOL],
        tool_choice: { type: 'tool', name: TOOL.name },
        messages: [{ role: 'user', content: userMessage(card) }],
      });
      const call = res.content.find((b) => b.type === 'tool_use');
      if (!call) throw new Error('no tool_use in response');
      const { meanings, synonyms, example } = call.input;
      if (Array.isArray(meanings) && meanings.length) card.meanings = meanings;
      if (Array.isArray(synonyms)) card.synonyms = synonyms.filter((s) => s && s.toLowerCase() !== card.front.toLowerCase());
      if (typeof example === 'string' && example.trim()) card.example = example.trim();
    } catch (e) {
      failures.push({ front: card.front, error: e.message });
    } finally {
      done++; sinceFlush++;
      if (sinceFlush >= 25) flush();
      if (done % 25 === 0 || done === todo.length) process.stdout.write(`\r  enriched ${done}/${todo.length}`);
    }
  })));

  flush();
  process.off('SIGINT', onSig);
  console.log(`\nWrote ${IN_PLACE ? 'deck' : basename(outPath)}.`);
  if (failures.length) {
    console.warn(`${failures.length} word(s) failed (left unenriched). Re-run to retry. First few:`);
    for (const f of failures.slice(0, 5)) console.warn(`  ${f.front}: ${f.error}`);
  }
  console.log('Next: review with "npm run enrich:report", then promote the sidecar over the deck and run "npm test".');
}

main().catch((e) => {
  console.error('enrich failed:', e.message);
  process.exit(1);
});
