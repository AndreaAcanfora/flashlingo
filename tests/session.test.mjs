import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { resetStorage, seedRandom } from './env.mjs';
const { createSession } = await import('../js/engine/session.js');
const { loadStats, saveStats, getMeta, freshStat } = await import('../js/store/stats.js');

beforeEach(() => {
  resetStorage();
  seedRandom(42);
});

const makeDeck = (n, extra = () => ({})) => ({
  meta: { id: 'test' },
  cards: Array.from({ length: n }, (_, i) => ({ _id: `c${i}`, front: `f${i}`, back: [`b${i}`], ...extra(i) })),
});
const noFilters = { levels: null, groups: null, topics: null };

test('learn: a missed card comes back until it is answered correctly', () => {
  const s = createSession(makeDeck(10), { filters: noFilters, length: 6, learn: true });
  assert.equal(s.total, 6);
  const missed = s.next();
  s.grade(missed, false);
  const seen = [];
  for (let c = s.next(); c; c = s.next()) {
    seen.push(c._id);
    s.grade(c, true);
  }
  assert.equal(seen.length, 6, 'five new cards plus the missed one once more');
  assert.equal(seen.indexOf(missed._id), 4, 'returns four cards later');
  assert.equal(s.remaining, 0);
  const r = s.results()[missed._id];
  assert.deepEqual([r.firstCorrect, r.attempts, r.wrong, r.correct], [false, 2, 1, true]);
  assert.deepEqual(s.missed(makeDeck(10).cards).map((c) => c._id), [missed._id]);
});

test('quick: one pass over exactly `length` cards, misses do not return', () => {
  const s = createSession(makeDeck(10), { filters: noFilters, length: 4, learn: false });
  let n = 0;
  for (let c = s.next(); c; c = s.next()) {
    s.grade(c, false);
    n++;
  }
  assert.equal(n, 4);
});

test('length 0 takes the whole filtered deck', () => {
  const deck = makeDeck(9, (i) => ({ group: i % 3 === 0 ? 'Europe' : 'Asia' }));
  const s = createSession(deck, { filters: { ...noFilters, groups: new Set(['Europe']) }, length: 0, learn: true });
  assert.equal(s.total, 3);
});

test('grades are saved as Leitner stats and the session is counted once', () => {
  const s = createSession(makeDeck(3), { filters: noFilters, length: 0, learn: true });
  const c = s.next();
  s.next();
  s.grade(c, true);
  assert.equal(loadStats('test')[c._id].box, 2);
  assert.equal(getMeta('test').sessionCount, 1);
});

test('selection: at most half the session is due reviews, the rest new cards', () => {
  const stats = {};
  for (let i = 0; i < 10; i++) stats[`c${i}`] = { ...freshStat(), seen: 1, box: 1, lastSession: 0 };
  saveStats('test', stats);
  const s = createSession(makeDeck(30), { filters: noFilters, length: 8, learn: false });
  const ids = [];
  for (let c = s.next(); c; c = s.next()) { ids.push(c._id); s.grade(c, true); }
  const reviews = ids.filter((id) => Number(id.slice(1)) < 10);
  assert.equal(ids.length, 8);
  assert.equal(reviews.length, 4);
});

test('adaptive: stops once `length` cards are learned and tracks the level', () => {
  const deck = makeDeck(60, (i) => ({ level: ['A1', 'A2', 'B1'][i % 3] }));
  const s = createSession(deck, { filters: { ...noFilters, adaptive: true, startLevel: 'A1' }, length: 7, learn: true });
  assert.equal(s.adaptive, true);
  const levels = [];
  for (let c = s.next(); c; c = s.next()) {
    levels.push(c.level);
    s.grade(c, true);
  }
  assert.equal(s.position, 7);
  assert.equal(levels[0], 'A1');
  assert.equal(s.currentLevel, 'A2', 'six right answers in a row move up a level');
  assert.deepEqual(s.trajectory, ['A1', 'A2']);
});
