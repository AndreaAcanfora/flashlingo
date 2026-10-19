// Card helpers: stable per-deck ids (to survive editing and rare duplicate
// fronts), answer normalization, and the typing-check matcher.

function slug(s) {
  return String(s)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'card';
}

// Assign a deterministic _id to each card (mutates). Duplicates get ~2, ~3, …
export function assignIds(cards) {
  const seen = new Map();
  for (const c of cards) {
    const base = slug(c.front);
    const n = (seen.get(base) || 0) + 1;
    seen.set(base, n);
    c._id = n === 1 ? base : `${base}~${n}`;
  }
  return cards;
}

export function newId(counter) {
  return `new~${counter}`;
}

// Normalize a string for answer comparison: lowercase, accent-insensitive,
// strip leading articles and surrounding punctuation.
const ARTICLES = new Set([
  'the', 'a', 'an', 'to',
  'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', "un'", 'una',
  'el', 'los', 'las', 'un', 'una',
]);

export function normalize(s) {
  let t = String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[.,;:!?¿¡"'`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const parts = t.split(' ');
  if (parts.length > 1 && ARTICLES.has(parts[0])) parts.shift();
  return parts.join(' ');
}

// The full accepted-answer set for a card in typing mode: every `back` entry and
// synonym, plus — for comma-joined verb forms — each individual form.
export function acceptedAnswers(card) {
  const set = new Set();
  const add = (v) => {
    const n = normalize(v);
    if (n) set.add(n);
  };
  for (const b of card.back || []) {
    add(b);
    if (b.includes(',')) for (const form of b.split(',')) add(form);
  }
  for (const s of card.synonyms || []) add(s);
  return set;
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) => i);
  for (let j = 1; j <= n; j++) {
    let prev = dp[0];
    dp[0] = j;
    for (let i = 1; i <= m; i++) {
      const tmp = dp[i];
      dp[i] = Math.min(dp[i] + 1, dp[i - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[m];
}

// Grade a typed answer. Returns { correct, near } where `near` flags a close
// miss (small typo) the user can choose to accept.
export function checkTyped(input, card, { nearMiss = true } = {}) {
  const n = normalize(input);
  if (!n) return { correct: false, near: false };
  const accepted = acceptedAnswers(card);
  if (accepted.has(n)) return { correct: true, near: false };
  if (nearMiss) {
    for (const a of accepted) {
      const d = levenshtein(n, a);
      if (d > 0 && d <= 2 && Math.max(a.length, n.length) >= 4) return { correct: false, near: true };
    }
  }
  return { correct: false, near: false };
}

export { slug };
