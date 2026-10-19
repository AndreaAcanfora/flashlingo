# flashlingo — data & build pipeline

Everything that produces `../data/*.json`. The app itself needs no build; this is
only for regenerating or extending the decks.

```bash
npm ci
npm run build      # fetch-sources → convert → gen-manifest → validate
npm test           # validate only (schema + semantic checks); the CI gate
```

## Pipeline

| Step | Script | What it does |
|------|--------|--------------|
| fetch | `fetch-sources.js` | downloads the CEFR CSVs into `sources/` (gitignored) and verifies their SHA-256 against `sources.lock.json` |
| convert | `convert.js` | `raw/*` → `../data/<deck>.json`: normalizes text, strips old telemetry, assigns CEFR `level` (English decks) and `cc` country code (capitals), de-dupes, and **merges** any existing `meanings`/`synonyms`/`example` so enrichment is never lost |
| manifest | `gen-manifest.js` | writes `../data/decks.json` from deck metadata in `lib/mapping.js`, recomputing `count` |
| validate | `validate.js` | ajv schema + semantic checks; non-zero exit on error |

Run all four with `npm run build`. Use `--offline` to skip fetching (requires the
CSVs already present in `sources/`).

## Raw → deck mapping

| raw file | deck id | direction |
|----------|---------|-----------|
| `3000words.js` | english-3000 | en → it |
| `phrasal-verbs.js` | phrasal-verbs | en → it (+ example) |
| `words-excel.txt` | english-vocab | en → it |
| `verbs.txt` | irregular-verbs | it → en forms |
| `spanish-words.txt` | spanish-verbs | it → es |
| `capitali.json` | world-capitals | country → capital (+ cc, continent) |

The mapping lives in `lib/mapping.js` (one entry per deck, with its manifest
metadata and a `map(rawEntry)` function).

> Note: `spanish-verbs` has one duplicate front (`pensare`) in the source, which the
> converter de-duplicates (50 cards, not 51). Older legacy lists on the original host
> (`words.txt`, `words2.txt`, `words-inverted.txt`) are intentionally not included.

## Data model

Card schema (`lib/schema.js` is the source of truth):

| field | type | required | meaning |
|-------|------|:--------:|---------|
| `front` | string | yes | prompt side |
| `back` | string[] | yes | **gradeable** accepted answers (≥1) |
| `meanings` | string[] | no | display-only senses (richer than `back`); UI falls back to `back` |
| `synonyms` | string[] | no | same-language synonyms of `front` |
| `example` | string | no | usage sentence in the `front` language |
| `group` | string | no | filter bucket (continent, capitals deck) |
| `level` | `A1`…`C2` \| null | no | CEFR level (English decks only) |
| `cc` | string | no | ISO 3166-1 alpha-2 (capitals deck, for the flag) |

Language convention for English decks: `front` = English; `back`/`meanings` =
Italian; `synonyms`/`example` = English.

## CEFR level derivation

`lib/cefr.js` builds a `headword → level` map from both CSVs. Conflict rule: the
**lowest** (earliest-learned) level wins. CEFR-J covers A1–B2; Octanove adds C1/C2.
Only the derived label is written into the deck files — the CSVs are never committed
(see `../NOTICE`).

## AI enrichment

See the "Optional: AI enrichment" section in the root `README.md`. `enrich.js` fills
`meanings`/`synonyms`/`example` using the Anthropic API with your own key; `.env`
holds the key and is gitignored. `enrich-report.js` prints a review with flags.
