import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { resetStorage } from './env.mjs';
const { freshStat, applyGrade, isDue, errorRate, progress, saveStats, bumpSession, getMeta } = await import('../js/store/stats.js');

beforeEach(resetStorage);

test('Leitner: a correct answer moves up one box, easy two, capped at 5', () => {
  const s = freshStat();
  applyGrade(s, true);
  assert.equal(s.box, 2);
  applyGrade(s, true, { tier: 'easy' });
  assert.equal(s.box, 4);
  applyGrade(s, true, { tier: 'easy' });
  assert.equal(s.box, 5);
  applyGrade(s, true);
  assert.equal(s.box, 5);
  assert.equal(s.streak, 4);
});

test('Leitner: a miss sends the card back to box 1 and resets the streak', () => {
  const s = freshStat();
  applyGrade(s, true);
  applyGrade(s, true);
  applyGrade(s, false, { sessionCount: 7 });
  assert.deepEqual([s.box, s.streak, s.seen, s.correct, s.wrong, s.lastSession], [1, 0, 3, 2, 1, 7]);
  assert.equal(errorRate(s), 1 / 3);
});

test('isDue: box N waits 1, 2, 4, 8, 16 sessions', () => {
  assert.equal(isDue(freshStat(), 1), true, 'never seen is due');
  for (const [box, gap] of [[1, 1], [2, 2], [3, 4], [4, 8], [5, 16]]) {
    const s = { ...freshStat(), seen: 1, box, lastSession: 10 };
    assert.equal(isDue(s, 10 + gap - 1), false, `box ${box} before ${gap}`);
    assert.equal(isDue(s, 10 + gap), true, `box ${box} at ${gap}`);
  }
});

test('progress: learned = box ≥ 2, mastered = box ≥ 4, capped at the deck size', () => {
  saveStats('d', {
    a: { ...freshStat(), seen: 1, box: 2 },
    b: { ...freshStat(), seen: 3, box: 4 },
    c: { ...freshStat(), seen: 1, box: 1 },
    gone: { ...freshStat(), seen: 9, box: 5 },
  });
  assert.deepEqual(progress('d', 10), { learned: 3, mastered: 2, total: 10 });
  assert.deepEqual(progress('d', 2), { learned: 2, mastered: 2, total: 2 });
});

test('bumpSession counts sessions per deck', () => {
  bumpSession('x');
  bumpSession('x');
  assert.equal(getMeta('x').sessionCount, 2);
  assert.equal(getMeta('y').sessionCount, 0);
});
