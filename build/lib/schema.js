// JSON Schemas (ajv) for deck cards and the manifest. Single source of truth
// used by validate.js and re-exported for any future tooling.

export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

const nonEmptyString = { type: 'string', minLength: 1 };

export const cardSchema = {
  type: 'object',
  additionalProperties: false, // catches leaked telemetry (success/error) and typos
  required: ['front', 'back'],
  properties: {
    front: nonEmptyString,
    back: { type: 'array', minItems: 1, items: nonEmptyString },
    meanings: { type: 'array', items: nonEmptyString },
    synonyms: { type: 'array', items: nonEmptyString },
    example: { type: 'string' },
    group: { type: 'string' },
    topic: { type: 'string' },
    level: { type: ['string', 'null'], enum: [...LEVELS, null] },
    cc: { type: 'string', pattern: '^[a-z]{2}$' },
  },
};

export const deckSchema = {
  type: 'array',
  items: cardSchema,
};

export const manifestEntrySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'title', 'desc', 'count', 'speakSide', 'speakLang', 'frontLabel', 'backLabel', 'mode'],
  properties: {
    id: { type: 'string', pattern: '^[a-z0-9-]+$' },
    title: nonEmptyString,
    desc: nonEmptyString,
    count: { type: 'integer', minimum: 0 },
    speakSide: { type: 'string', enum: ['front', 'back'] },
    speakLang: nonEmptyString, // BCP-47
    frontLabel: nonEmptyString,
    backLabel: nonEmptyString,
    mode: { type: 'string', enum: ['flashcard', 'capitals'] },
    source: { type: 'string' },
    enriched: { type: 'boolean' },
  },
};

export const manifestSchema = {
  type: 'array',
  items: manifestEntrySchema,
};

// Order used when serializing cards, for diff-friendly output.
export const CARD_KEY_ORDER = ['front', 'back', 'meanings', 'synonyms', 'example', 'level', 'topic', 'group', 'cc'];
export const MANIFEST_KEY_ORDER = [
  'id', 'title', 'desc', 'count', 'speakSide', 'speakLang',
  'frontLabel', 'backLabel', 'mode', 'source', 'enriched',
];
