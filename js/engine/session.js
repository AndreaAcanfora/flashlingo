// Builds and drives a study session: filters the deck, schedules cards with the
// Leitner-weighted ordering, and records grades back into stats.
import { loadStats, saveStats, freshStat, errorRate, isDue, applyGrade, bumpSession, getMeta } from '../store/stats.js';
import { createAdaptive } from './adaptive.js';

function applyFilters(cards, filters) {
  let out = cards;
  if (filters.levels && filters.levels.size) {
    out = out.filter((c) => filters.levels.has(c.level ?? null));
  }
  if (filters.groups && filters.groups.size) {
    out = out.filter((c) => filters.groups.has(c.group));
  }
  return out;
}

function weight(card, stat, sessionCount) {
  if (!stat.seen) return 3.5 + Math.random() * 0.001; // unseen interleave mid-pack
  return (6 - stat.box) + 2 * errorRate(stat) + (isDue(stat, sessionCount) ? 1.5 : 0) + Math.random() * 0.001;
}

// Create a session controller. `filters` = { levels:Set|null, groups:Set|null,
// adaptive:bool, startLevel }. `length` 0 = all.
export function createSession(deck, { mode, gradeMode, filters, length }) {
  const deckId = deck.meta.id;
  const sessionCount = getMeta(deckId).sessionCount + 1;
  const stats = loadStats(deckId);
  const statOf = (c) => stats[c._id] || (stats[c._id] = freshStat());

  const results = {}; // _id -> { correct, tier }
  let adaptive = null;
  let queue = [];
  let pos = 0;

  if (filters.adaptive) {
    adaptive = createAdaptive(filters.startLevel, deck.cards);
  } else {
    const pool = applyFilters(deck.cards, filters);
    const sorted = [...pool].sort((a, b) => weight(b, statOf(b), sessionCount) - weight(a, statOf(a), sessionCount));
    queue = length > 0 ? sorted.slice(0, length) : sorted;
  }

  let started = false;
  function ensureStarted() {
    if (!started) {
      started = true;
      bumpSession(deckId);
    }
  }

  const recentlyShown = [];
  function pickAdaptive() {
    const pool = adaptive.poolForNext();
    if (!pool.length) return null;
    const avoid = new Set(recentlyShown.slice(-8));
    let candidates = pool.filter((c) => !avoid.has(c._id));
    if (!candidates.length) candidates = pool;
    candidates.sort((a, b) => weight(b, statOf(b), sessionCount) - weight(a, statOf(a), sessionCount));
    // soft randomness among the top few so it doesn't feel deterministic
    const top = candidates.slice(0, Math.min(5, candidates.length));
    return top[Math.floor(Math.random() * top.length)];
  }

  return {
    mode,
    gradeMode,
    adaptive: !!adaptive,
    get total() {
      return adaptive ? 0 : queue.length; // 0 = open-ended
    },
    get position() {
      return pos;
    },
    get trajectory() {
      return adaptive ? adaptive.trajectory : null;
    },
    get currentLevel() {
      return adaptive ? adaptive.level : null;
    },
    isEmpty() {
      return adaptive ? !adaptive.poolForNext().length : queue.length === 0;
    },
    next() {
      ensureStarted();
      if (adaptive) {
        const c = pickAdaptive();
        if (c) recentlyShown.push(c._id);
        return c;
      }
      return pos < queue.length ? queue[pos] : null;
    },
    grade(card, correct, tier = null) {
      results[card._id] = { correct, tier };
      applyGrade(statOf(card), correct, { tier, sessionCount });
      saveStats(deckId, stats);
      if (adaptive) adaptive.record(correct);
      else pos += 1;
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
