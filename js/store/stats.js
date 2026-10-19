// Per-card spaced-repetition stats (Leitner 5-box), one blob per deck keyed by
// the card's stable _id. Replaces the old server-side file overwrite.
import * as storage from './storage.js';

const MAX_BOX = 5;
// Box review interval measured in sessions-since-last-seen.
const BOX_INTERVAL = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 16 };

function statsKey(deckId) {
  return `stats:${deckId}`;
}
function metaKey(deckId) {
  return `deckMeta:${deckId}`;
}

export function freshStat() {
  return { box: 1, seen: 0, correct: 0, wrong: 0, streak: 0, lastSeen: null, lastSession: 0 };
}

export function loadStats(deckId) {
  return storage.get(statsKey(deckId), {}) || {};
}
export function saveStats(deckId, stats) {
  storage.set(statsKey(deckId), stats);
}

export function getMeta(deckId) {
  return storage.get(metaKey(deckId), { sessionCount: 0, lastStudied: null });
}
export function bumpSession(deckId) {
  const m = getMeta(deckId);
  m.sessionCount += 1;
  m.lastStudied = Date.now();
  storage.set(metaKey(deckId), m);
  return m.sessionCount;
}

export function errorRate(stat) {
  return stat.seen ? stat.wrong / stat.seen : 0;
}

export function isDue(stat, sessionCount) {
  if (!stat.seen) return true;
  const since = sessionCount - (stat.lastSession || 0);
  return since >= (BOX_INTERVAL[stat.box] || 1);
}

// Apply a grade to a card's stat (mutates & returns it). Leitner movement:
// correct -> box+1, miss -> box 1. `tier` optionally softens/skips.
export function applyGrade(stat, correct, { tier = null, sessionCount = 0 } = {}) {
  stat.seen += 1;
  stat.lastSeen = Date.now();
  stat.lastSession = sessionCount;
  if (correct) {
    stat.correct += 1;
    stat.streak = (stat.streak || 0) + 1;
    if (tier === 'easy') stat.box = Math.min(MAX_BOX, stat.box + 2);
    else stat.box = Math.min(MAX_BOX, stat.box + 1);
  } else {
    stat.wrong += 1;
    stat.streak = 0;
    stat.box = 1;
  }
  return stat;
}

// Mastery = fraction of seen cards sitting in box >= 4.
export function mastery(deckId, totalCards) {
  const stats = loadStats(deckId);
  const vals = Object.values(stats);
  if (!totalCards) return 0;
  const mastered = vals.filter((s) => s.box >= 4).length;
  return mastered / totalCards;
}

export { MAX_BOX, BOX_INTERVAL };
