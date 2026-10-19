// Builds and drives a study session. Two non-adaptive shapes:
//   - "learn" (repeat until learned): the original behaviour the user liked —
//     cards you miss keep coming back until you get them right; the session ends
//     when every selected card has been answered correctly.
//   - "quick" (fixed length): a Leitner-weighted slice of N cards, one pass.
// Adaptive mode is always learned-aware (see adaptive.js).
import { loadStats, saveStats, freshStat, errorRate, isDue, applyGrade, bumpSession, getMeta } from '../store/stats.js';
import { createAdaptive } from './adaptive.js';

function applyFilters(cards, filters) {
  let out = cards;
  if (filters.levels && filters.levels.size) out = out.filter((c) => filters.levels.has(c.level ?? null));
  if (filters.groups && filters.groups.size) out = out.filter((c) => filters.groups.has(c.group));
  if (filters.topics && filters.topics.size) out = out.filter((c) => filters.topics.has(c.topic ?? null));
  return out;
}

// Priority used by adaptive mode: due reviews first, then new cards, and only
// then cards seen recently that aren't due yet (so you don't get the same
// words session after session).
function weight(card, stat, sessionCount) {
  if (!stat.seen) return 5;
  if (isDue(stat, sessionCount)) return 6 + (6 - stat.box) + 2 * errorRate(stat);
  return 1 + errorRate(stat);
}

// Pick `n` cards for a session: up to half are due reviews (hardest first),
// the rest are new cards chosen at random, then anything else. The final list
// is shuffled so the order is random too.
function selectCards(pool, n, statOf, sessionCount) {
  const due = [], fresh = [], later = [];
  for (const c of shuffle([...pool])) {
    const s = statOf(c);
    if (!s.seen) fresh.push(c);
    else if (isDue(s, sessionCount)) due.push(c);
    else later.push(c);
  }
  due.sort((a, b) => weight(b, statOf(b), sessionCount) - weight(a, statOf(a), sessionCount));
  if (!(n > 0)) n = pool.length;
  const reviews = due.slice(0, Math.ceil(n / 2));
  const picked = [...reviews, ...fresh.slice(0, n - reviews.length)];
  for (const c of [...due.slice(reviews.length), ...later]) {
    if (picked.length >= n) break;
    picked.push(c);
  }
  return shuffle(picked.slice(0, n));
}

// Fisher–Yates shuffle (in place).
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const REQUEUE_GAP = 4; // how many cards later a missed card returns (learn mode)

// filters = { levels:Set|null, groups:Set|null, topics:Set|null, adaptive, startLevel }
// learn = repeat-until-learned (ignores `length`); otherwise fixed `length`.
export function createSession(deck, { mode, gradeMode, filters, length, learn = true }) {
  const deckId = deck.meta.id;
  const sessionCount = getMeta(deckId).sessionCount + 1;
  const stats = loadStats(deckId);
  const statOf = (c) => stats[c._id] || (stats[c._id] = freshStat());

  const results = {}; // _id -> { correct }
  const learned = new Set(); // ids answered correctly this session
  let adaptive = null;
  let queue = []; // working queue of cards (learn & quick modes)
  let pos = 0; // pointer for quick mode
  let poolSize = 0;

  if (filters.adaptive) {
    adaptive = createAdaptive(filters.startLevel, deck.cards);
    poolSize = deck.cards.filter((c) => c.level).length;
  } else {
    // Both goals take only `length` cards (0 = all); "learn" then repeats
    // missed ones until every selected card is answered correctly.
    queue = selectCards(applyFilters(deck.cards, filters), length, statOf, sessionCount);
    poolSize = queue.length;
  }

  let started = false;
  function ensureStarted() {
    if (!started) { started = true; bumpSession(deckId); }
  }

  const recent = [];
  function pickAdaptive() {
    const pool = adaptive.pool(learned);
    if (!pool.length) return null;
    const avoid = new Set(recent.slice(-6));
    let cands = pool.filter((c) => !avoid.has(c._id));
    if (!cands.length) cands = pool;
    cands.sort((a, b) => weight(b, statOf(b), sessionCount) - weight(a, statOf(a), sessionCount));
    const top = cands.slice(0, Math.min(5, cands.length));
    return top[Math.floor(Math.random() * top.length)];
  }

  return {
    mode,
    gradeMode,
    adaptive: !!adaptive,
    learn,
    get total() {
      return adaptive ? 0 : poolSize; // adaptive shows the level instead
    },
    get position() {
      return learned.size; // cards learned so far (meaningful in both learn & adaptive)
    },
    get remaining() {
      return adaptive ? 0 : queue.length - learned.size;
    },
    get trajectory() {
      return adaptive ? adaptive.trajectory : null;
    },
    get currentLevel() {
      return adaptive ? adaptive.level : null;
    },
    isEmpty() {
      return adaptive ? !adaptive.pool(learned).length : queue.length === 0;
    },
    next() {
      ensureStarted();
      if (adaptive) {
        if (length > 0 && learned.size >= length) return null; // learned enough words
        const c = pickAdaptive();
        if (c) recent.push(c._id);
        return c;
      }
      if (learn) {
        // first card in the queue not yet learned
        while (pos < queue.length && learned.has(queue[pos]._id)) pos++;
        return pos < queue.length ? queue[pos] : null;
      }
      return pos < queue.length ? queue[pos] : null;
    },
    grade(card, correct) {
      // Keep every attempt: the summary must reflect mistakes even when a card
      // is eventually answered correctly (always the case in "learn" mode).
      const r = results[card._id] || (results[card._id] = { firstCorrect: correct, attempts: 0, wrong: 0 });
      r.attempts += 1;
      if (!correct) r.wrong += 1;
      r.correct = correct;
      applyGrade(statOf(card), correct, { sessionCount });
      saveStats(deckId, stats);
      if (adaptive) {
        adaptive.record(correct);
        if (correct) learned.add(card._id);
        return;
      }
      if (learn) {
        if (correct) {
          learned.add(card._id);
          pos++;
        } else {
          // move this card a few places later so it returns, but keep going
          const i = queue.findIndex((c) => c._id === card._id);
          if (i >= 0) {
            queue.splice(i, 1);
            queue.splice(Math.min(i + REQUEUE_GAP, queue.length), 0, card);
          }
          // pos stays; queue[pos] is now the next card
        }
        return;
      }
      pos++;
    },
    results() {
      return results;
    },
    missed(allCards) {
      const map = new Map(allCards.map((c) => [c._id, c]));
      return Object.entries(results)
        .filter(([, r]) => r.wrong > 0)
        .map(([id]) => map.get(id))
        .filter(Boolean);
    },
  };
}

export { applyFilters };
