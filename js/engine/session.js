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

function weight(card, stat, sessionCount) {
  if (!stat.seen) return 3.5 + Math.random() * 0.001; // unseen interleave mid-pack
  return (6 - stat.box) + 2 * errorRate(stat) + (isDue(stat, sessionCount) ? 1.5 : 0) + Math.random() * 0.001;
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
    const pool = applyFilters(deck.cards, filters);
    const sorted = [...pool].sort((a, b) => weight(b, statOf(b), sessionCount) - weight(a, statOf(a), sessionCount));
    poolSize = sorted.length;
    queue = learn ? sorted : sorted.slice(0, length > 0 ? length : sorted.length);
    if (!learn) poolSize = queue.length;
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
      return adaptive ? 0 : poolSize; // adaptive is open-ended
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
      results[card._id] = { correct };
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
        .filter(([, r]) => !r.correct)
        .map(([id]) => map.get(id))
        .filter(Boolean);
    },
  };
}

export { applyFilters };
