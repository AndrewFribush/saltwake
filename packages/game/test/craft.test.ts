import test from 'node:test';
import assert from 'node:assert/strict';
import {createCraftPractice, restartCraftPractice, recordCraftInput, scoreCraft} from '../src/craft';

test('three accurate inputs score fine, including both target boundaries', () => {
  for (const times of [[5500, 5500, 5500], [5150, 5850, 5500]]) {
    assert.equal(scoreCraft(times), 'fine');
    assert.equal(scoreCraft([...times]), 'fine');
  }
});

test('one miss makes a completed batch normal, never a failed batch', () => {
  for (const times of [[5149, 5500, 5500], [5500, 5851, 5500], [5500, 5500, 7000], [0, 0, 0]]) {
    assert.equal(scoreCraft(times), 'normal');
  }
});

test('incomplete batches have no tier and malformed timing cannot score', () => {
  assert.equal(scoreCraft([]), null);
  assert.equal(scoreCraft([5500, 5500]), null);
  for (const times of [[NaN], [Infinity], [-1], [7001], [5500, 5500, 5500, 5500]]) {
    assert.throws(() => scoreCraft(times), RangeError);
  }
});

test('inputs are immutable, sequential, and accepted only once per step', () => {
  const initial = createCraftPractice();
  Object.freeze(initial.inputs);
  Object.freeze(initial);
  const first = recordCraftInput(initial, {attempt: 1, step: 0, elapsedMs: 5500});
  assert.deepEqual(initial.inputs, []);
  assert.deepEqual(first.inputs, [5500]);
  assert.equal(first.tier, null);
  assert.equal(recordCraftInput(first, {attempt: 1, step: 0, elapsedMs: 5500}), first);
  assert.equal(recordCraftInput(first, {attempt: 1, step: 2, elapsedMs: 5500}), first);
  const second = recordCraftInput(first, {attempt: 1, step: 1, elapsedMs: 5150});
  const third = recordCraftInput(second, {attempt: 1, step: 2, elapsedMs: 5850});
  assert.equal(third.tier, 'fine');
  assert.equal(recordCraftInput(third, {attempt: 1, step: 3, elapsedMs: 5500}), third);
});

test('restart creates fresh identity and rejects callbacks from the previous batch', () => {
  const first = recordCraftInput(createCraftPractice(), {attempt: 1, step: 0, elapsedMs: 5500});
  const next = restartCraftPractice(first);
  assert.equal(next.attempt, 2);
  assert.deepEqual(next.inputs, []);
  assert.equal(next.tier, null);
  assert.equal(recordCraftInput(next, {attempt: 1, step: 0, elapsedMs: 5500}), next);
  assert.equal(restartCraftPractice(next).attempt, 3);
  assert.deepEqual(first.inputs, [5500]);
});

test('late input is a normal miss; invalid input leaves the attempt unchanged', () => {
  let batch = createCraftPractice();
  for (const elapsedMs of [NaN, Infinity, -1]) {
    assert.equal(recordCraftInput(batch, {attempt: 1, step: 0, elapsedMs}), batch);
  }
  for (let step = 0; step < 3; step++) {
    batch = recordCraftInput(batch, {attempt: 1, step, elapsedMs: 10000});
  }
  assert.deepEqual(batch.inputs, [7000, 7000, 7000]);
  assert.equal(batch.tier, 'normal');
});
