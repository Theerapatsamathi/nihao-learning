import test from 'node:test';
import assert from 'node:assert/strict';
import { PANDA_AVATARS, ARENA_TITLES, buildSeededDuelQuestions, calcDuelPoints } from '../src/features/arena/logic.js';

test('Arena datasets and seeded duel questions are deterministic', () => {
  assert.ok(PANDA_AVATARS.length >= 6);
  assert.ok(ARENA_TITLES.length >= 4);
  const q1 = buildSeededDuelQuestions('vocab', 4242, 10);
  const q2 = buildSeededDuelQuestions('vocab', 4242, 10);
  assert.equal(q1.length, 10);
  assert.deepEqual(q1, q2);
});

test('calcDuelPoints awards speed bonus only when correct', () => {
  assert.equal(calcDuelPoints(false, 1000), 0);
  assert.ok(calcDuelPoints(true, 1000) > calcDuelPoints(true, 7000));
  assert.equal(calcDuelPoints(true, 10000), 100);
});
