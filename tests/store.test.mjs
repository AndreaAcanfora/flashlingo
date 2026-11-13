import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { resetStorage } from './env.mjs';
const storage = await import('../js/store/storage.js');
const { exportProgress, importProgress } = await import('../js/store/io.js');
const { resolveDeck, toShippedShape } = await import('../js/store/overlay.js');

beforeEach(resetStorage);

test('storage: values are namespaced JSON, corrupt entries fall back', () => {
  storage.set('a', { x: 1 });
  assert.equal(localStorage.getItem('lt:a'), '{"x":1}');
  assert.deepEqual(storage.get('a'), { x: 1 });
  localStorage.setItem('lt:bad', '{not json');
  assert.equal(storage.get('bad', 'fallback'), 'fallback');
  localStorage.setItem('other-app', '1');
  assert.deepEqual(storage.keys(), ['a', 'bad']);
});

test('storage: the app keeps working when localStorage throws', () => {
  const real = globalThis.localStorage;
  const warn = console.warn;
  console.warn = () => {};
  globalThis.localStorage = { setItem() { throw new Error('denied'); }, getItem() { throw new Error('denied'); }, removeItem() {}, key() {}, length: 0 };
  try {
    assert.equal(storage.set('a', 1), false);
    assert.equal(storage.get('a', 'fb'), 'fb');
    assert.deepEqual(storage.keys(), []);
  } finally {
    globalThis.localStorage = real;
    console.warn = warn;
  }
});

test('export / import round trip', () => {
  storage.set('stats:english-3000', { hello: { box: 3 } });
  storage.set('settings', { theme: 'dark' });
  const bundle = JSON.parse(JSON.stringify(exportProgress()));
  assert.equal(bundle.kind, 'lt-progress');
  resetStorage();
  assert.equal(importProgress(bundle), 2);
  assert.deepEqual(storage.get('stats:english-3000'), { hello: { box: 3 } });
  assert.throws(() => importProgress({ kind: 'something-else' }), /Not a flashlingo progress file/);
});

test('overlay: edits, additions and removals on top of the shipped deck', () => {
  const shipped = [{ _id: 'a', front: 'a', back: ['x'] }, { _id: 'b', front: 'b', back: ['y'] }];
  const resolved = resolveDeck(shipped, {
    edited: { a: { back: ['z'] } },
    added: [{ _id: 'new~1', front: 'c', back: ['w'], synonyms: [] }],
    removed: { b: true },
  });
  assert.deepEqual(resolved.map((c) => [c._id, c._status ?? 'shipped']), [['a', 'edited'], ['b', 'removed'], ['new~1', 'added']]);
  assert.deepEqual(toShippedShape(resolved), [{ front: 'a', back: ['z'] }, { front: 'c', back: ['w'] }]);
});
