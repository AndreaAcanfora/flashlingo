// The one place that knows how each raw wordlist maps to a deck.
// Each deck declares its manifest metadata plus a `map(rawEntry)` that returns
// a card { front, back, ... } (before CEFR level / country-code enrichment,
// which convert.js adds). `levels: true` means CEFR levels apply to this deck.
import { clean, toList } from './normalize.js';
import { continentOf } from './countries.js';

export const DECKS = [
  {
    id: 'english-3000',
    raw: '3000words.js',
    format: 'json',
    levels: true,
    meta: {
      title: 'English · 3000 common words',
      desc: 'The most common English words with their Italian meaning.',
      speakSide: 'front',
      speakLang: 'en-US',
      frontLabel: 'English',
      backLabel: 'Italiano',
      mode: 'flashcard',
      source: 'CEFR-J / Octanove levels',
    },
    map: (o) => ({ front: clean(joinEn(o.en)), back: toList(o.it) }),
  },
  {
    id: 'phrasal-verbs',
    raw: 'phrasal-verbs.js',
    format: 'json',
    levels: false,
    meta: {
      title: 'English · Phrasal verbs',
      desc: 'Common English phrasal verbs, with an example sentence.',
      speakSide: 'front',
      speakLang: 'en-US',
      frontLabel: 'English',
      backLabel: 'Italiano',
      mode: 'flashcard',
    },
    map: (o) => {
      const card = { front: clean(joinEn(o.en)), back: toList(o.it) };
      const ex = clean(o.example || '');
      if (ex) card.example = ex;
      return card;
    },
  },
  {
    id: 'english-vocab',
    raw: 'words-excel.txt',
    format: 'json',
    levels: true,
    meta: {
      title: 'English · Tricky vocabulary',
      desc: 'A hand-picked set of less common English words.',
      speakSide: 'front',
      speakLang: 'en-US',
      frontLabel: 'English',
      backLabel: 'Italiano',
      mode: 'flashcard',
      source: 'CEFR-J / Octanove levels',
    },
    map: (o) => ({ front: clean(joinEn(o.en)), back: toList(o.it) }),
  },
  {
    id: 'irregular-verbs',
    raw: 'verbs.txt',
    format: 'json',
    levels: false,
    meta: {
      title: 'English · Irregular verbs',
      desc: 'Italian meaning to the three English forms (base, past, participle).',
      speakSide: 'back',
      speakLang: 'en-US',
      frontLabel: 'Italiano',
      backLabel: 'English',
      mode: 'flashcard',
    },
    // back is a single "base, past, participle" string — keep it whole (no slash split).
    map: (o) => ({ front: clean(joinEn(o.it)), back: toList(o.en, { slash: false }) }),
  },
  {
    id: 'spanish-verbs',
    raw: 'spanish-words.txt',
    format: 'json',
    levels: false,
    meta: {
      title: 'Spanish · Core words',
      desc: 'Italian to Spanish: essential words and verbs.',
      speakSide: 'back',
      speakLang: 'es-ES',
      frontLabel: 'Italiano',
      backLabel: 'Español',
      mode: 'flashcard',
    },
    map: (o) => ({ front: clean(joinEn(o.it)), back: toList(o.es) }),
  },
  {
    id: 'world-capitals',
    raw: 'capitali.json',
    format: 'json',
    levels: false,
    meta: {
      title: 'Geography · World capitals',
      desc: 'Name the capital of each country. Filter by continent.',
      speakSide: 'back',
      speakLang: 'it-IT',
      frontLabel: 'Paese',
      backLabel: 'Capitale',
      mode: 'capitals',
    },
    map: (o) => ({
      front: clean(o.country),
      back: toList(o.capital),
      group: continentOf(o.zone),
    }),
  },
];

// Join a raw en/it array into a single front string ("/"-joined variants kept).
function joinEn(v) {
  return Array.isArray(v) ? v.join(' / ') : String(v);
}

export const DECK_BY_ID = Object.fromEntries(DECKS.map((d) => [d.id, d]));
