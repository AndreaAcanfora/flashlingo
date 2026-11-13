import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize, acceptedAnswers, checkTyped, assignIds, slug } from '../js/data/card.js';

test('normalize: case, accents, punctuation and a leading article', () => {
  assert.equal(normalize('  Perché?  '), 'perche');
  assert.equal(normalize('The House'), 'house');
  assert.equal(normalize('la città'), 'citta');
  assert.equal(normalize('to go'), 'go');
  assert.equal(normalize('the'), 'the', 'a lone article is the answer, not stripped');
  assert.equal(normalize('¿Dónde está?'), 'donde esta');
});

test('acceptedAnswers: every back entry, each comma-joined form and synonyms', () => {
  const card = { front: 'sorgere', back: ['arise, arose, arisen'], synonyms: ['Get up'] };
  assert.deepEqual([...acceptedAnswers(card)].sort(), ['arise', 'arise arose arisen', 'arisen', 'arose', 'get up']);
});

test('checkTyped: exact, synonym, near miss and wrong', () => {
  const card = { front: 'casa', back: ['house', 'home'], synonyms: ['dwelling'] };
  assert.deepEqual(checkTyped('House', card), { correct: true, near: false });
  assert.deepEqual(checkTyped('a home', card), { correct: true, near: false });
  assert.deepEqual(checkTyped('dwelling', card), { correct: true, near: false });
  assert.deepEqual(checkTyped('hosue', card), { correct: false, near: true }, 'two-letter swap is a near miss');
  assert.deepEqual(checkTyped('hosue', card, { nearMiss: false }), { correct: false, near: false });
  assert.deepEqual(checkTyped('garden', card), { correct: false, near: false });
  assert.deepEqual(checkTyped('   ', card), { correct: false, near: false });
});

test('checkTyped: short words get no typo forgiveness', () => {
  const card = { front: 'gatto', back: ['cat'] };
  assert.deepEqual(checkTyped('car', card), { correct: false, near: false });
});

test('checkTyped: irregular verb forms one by one or all together', () => {
  const card = { front: 'andare', back: ['go, went, gone'] };
  for (const a of ['go', 'went', 'gone', 'go, went, gone', 'go went gone']) {
    assert.equal(checkTyped(a, card).correct, true, a);
  }
});

test('assignIds: stable slugs, duplicates numbered', () => {
  const cards = assignIds([{ front: 'Città' }, { front: 'città' }, { front: 'Hello, world!' }, { front: '???' }]);
  assert.deepEqual(cards.map((c) => c._id), ['citta', 'citta~2', 'hello-world', 'card']);
  assert.equal(slug('x'.repeat(100)).length, 48);
});
