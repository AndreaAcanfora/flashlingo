import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAdaptive } from '../js/engine/adaptive.js';

const deck = (counts) =>
  Object.entries(counts).flatMap(([level, n]) => Array.from({ length: n }, (_, i) => ({ _id: `${level}-${i}`, level })));

test('moves up after 6 answers averaging ≥ 70%, and down at ≤ 40%', () => {
  const a = createAdaptive('B1', deck({ A1: 9, A2: 9, B1: 9, B2: 9, C1: 9, C2: 9 }));
  for (let i = 0; i < 5; i++) a.record(true);
  assert.equal(a.level, 'B1', 'not before 6 samples');
  a.record(true);
  assert.equal(a.level, 'B2');
  for (let i = 0; i < 6; i++) a.record(false);
  assert.equal(a.level, 'B1');
  assert.deepEqual(a.trajectory, ['B1', 'B2', 'B1']);
});

test('stays put between the thresholds', () => {
  const a = createAdaptive('B1', deck({ B1: 9, B2: 9, A2: 9 }));
  for (const r of [1, 0, 1, 0, 1, 0, 1, 0, 1, 0]) a.record(!!r);
  assert.equal(a.level, 'B1');
});

test('never goes past C2 or below A1', () => {
  const top = createAdaptive('C2', deck({ C1: 9, C2: 9 }));
  for (let i = 0; i < 12; i++) top.record(true);
  assert.equal(top.level, 'C2');
  const bottom = createAdaptive('A1', deck({ A1: 9, A2: 9 }));
  for (let i = 0; i < 12; i++) bottom.record(false);
  assert.equal(bottom.level, 'A1');
});

test('unknown or empty start level falls back to the first level with cards', () => {
  assert.equal(createAdaptive('C2', deck({ A2: 3, B1: 3 })).level, 'A2');
  assert.equal(createAdaptive('nope', deck({ B2: 3 })).level, 'B2');
});

test('pool: learned cards leave, thin levels widen to the neighbours', () => {
  const a = createAdaptive('C2', deck({ B2: 10, C1: 3, C2: 2 }));
  const learned = new Set(['C2-0']);
  const pool = a.pool(learned);
  assert.ok(!pool.some((c) => c._id === 'C2-0'));
  assert.ok(pool.length >= 5, `widened to ${pool.length}`);
  assert.ok(pool.some((c) => c.level === 'C1'));
  assert.equal(pool.filter((c) => c.level === 'C2').length, 1);
});
