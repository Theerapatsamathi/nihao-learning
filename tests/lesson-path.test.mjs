import test from 'node:test';
import assert from 'node:assert/strict';
import {
  seededShuffle,
  numberedToTonePinyin,
  normalizePinyin,
  gradeDictationAnswer,
  calcStars,
  calcLessonXp,
  isUnitUnlocked,
  getNextRecommendation,
  createPlacementState,
  pickNextPlacementQuestion,
  submitPlacementAnswer,
  computePlacementResult
} from '../src/features/lesson-path/logic.js';
import { UNITS, PLACEMENT_BANK } from '../src/features/lesson-path/curriculum-data.js';
import { GRAMMAR_CARDS } from '../src/features/lesson-path/grammar-data.js';
import { buildLessonExercises } from '../src/features/lesson-path/lesson-engine.js';

test('seededShuffle is deterministic for the same seed and differs for different seeds', () => {
  const input = [1, 2, 3, 4, 5, 6, 7, 8];
  const a1 = seededShuffle(input, 'lesson-u1-l1');
  const a2 = seededShuffle(input, 'lesson-u1-l1');
  const b = seededShuffle(input, 'lesson-u1-l2');
  assert.deepEqual(a1, a2);
  assert.notDeepEqual(a1, b);
  assert.deepEqual([...a1].sort((x, y) => x - y), input);
});

test('numberedToTonePinyin & normalizePinyin handle tones, ü, and spaces', () => {
  assert.equal(numberedToTonePinyin('ni3hao3'), 'nǐhǎo');
  assert.equal(numberedToTonePinyin('lv3you2'), 'lǚyóu');
  assert.equal(normalizePinyin('ni3 hao3'), normalizePinyin('nǐ hǎo'));
  assert.equal(normalizePinyin('Wo3 shi4 Tai4guo2ren2!'), normalizePinyin('Wǒ shì Tàiguórén.'));
});

test('gradeDictationAnswer grades hanzi, numbered pinyin, toneless partial credit, and wrong', () => {
  const target = { hz: '你好', py: 'nǐ hǎo' };
  assert.equal(gradeDictationAnswer('你好', target).status, 'exact');
  assert.equal(gradeDictationAnswer('ni3hao3', target).status, 'exact');
  assert.equal(gradeDictationAnswer('nǐ hǎo', target).status, 'exact');

  const partial = gradeDictationAnswer('ni hao', target);
  assert.equal(partial.status, 'partial');
  assert.equal(partial.score, 0.7);

  assert.equal(gradeDictationAnswer('xiexie', target).status, 'wrong');
  assert.equal(gradeDictationAnswer('谢谢', target).status, 'wrong');
});

test('calcStars & calcLessonXp return expected bounds', () => {
  assert.equal(calcStars(0.95), 3);
  assert.equal(calcStars(0.8), 2);
  assert.equal(calcStars(0.5), 1);
  assert.equal(calcStars(0.49), 0);

  assert.ok(calcLessonXp(1, false) <= 50 && calcLessonXp(1, false) >= 10);
  assert.ok(calcLessonXp(1, true) <= 50 && calcLessonXp(1, true) > calcLessonXp(1, false));
});

test('isUnitUnlocked & getNextRecommendation respect checkpoints, placement, and goal', () => {
  assert.equal(isUnitUnlocked(0, UNITS, {}), true);
  assert.equal(isUnitUnlocked(1, UNITS, {}), false);
  assert.equal(isUnitUnlocked(1, UNITS, { checkpoints: { 'u1-greetings': { passed: true } } }), true);
  assert.equal(isUnitUnlocked(3, UNITS, { unlockedUpTo: 3 }), true);

  // When units 0..3 are unlocked and goal is travel, food (u4-food, idx 3) is prioritized over numbers (idx 1)
  const recTravel = getNextRecommendation(UNITS, {
    unlockedUpTo: 3,
    lessonStars: { 'u1-l1': 3, 'u1-l2': 3, 'u1-l3': 3, 'u1-l4': 3 },
    checkpoints: { 'u1-greetings': { passed: true } }
  }, 'travel');
  assert.equal(recTravel.unitId, 'u4-food');
});

test('Adaptive placement test steps difficulty up/down and computes valid unit index', () => {
  let st = createPlacementState(10);
  for (let i = 0; i < 10; i++) {
    const q = pickNextPlacementQuestion(st, PLACEMENT_BANK);
    assert.ok(q, `question ${i} should exist`);
    st = submitPlacementAnswer(st, q, true);
  }
  assert.equal(st.difficulty, 5);
  const highRes = computePlacementResult(st, UNITS.length);
  assert.ok(highRes.recommendedUnitIdx >= 6);
  assert.equal(highRes.scorePct, 100);

  let lowSt = createPlacementState(10);
  for (let i = 0; i < 10; i++) {
    const q = pickNextPlacementQuestion(lowSt, PLACEMENT_BANK);
    lowSt = submitPlacementAnswer(lowSt, q, false);
  }
  assert.equal(lowSt.difficulty, 1);
  const lowRes = computePlacementResult(lowSt, UNITS.length);
  assert.equal(lowRes.recommendedUnitIdx, 0);
});

test('Curriculum, grammar cards, and deterministic lesson generation meet requirements', () => {
  assert.ok(UNITS.length >= 8, 'at least 8 units');
  for (const u of UNITS) {
    assert.ok(u.lessons.length >= 4, `${u.id} has at least 4 lessons`);
    assert.ok(u.words.length >= 10, `${u.id} has words`);
    assert.ok(u.sentences.length >= 4, `${u.id} has sentences`);
  }

  assert.ok(GRAMMAR_CARDS.length >= 20, 'at least 20 grammar cards');
  for (const g of GRAMMAR_CARDS) {
    assert.equal(g.examples.length, 3, `${g.id} has 3 examples`);
    assert.equal(g.quiz.length, 3, `${g.id} has 3 quiz questions`);
  }

  const ex1 = buildLessonExercises(UNITS[0], UNITS[0].lessons[0], UNITS, false);
  const ex2 = buildLessonExercises(UNITS[0], UNITS[0].lessons[0], UNITS, false);
  assert.ok(ex1.length >= 10 && ex1.length <= 12, `lesson has 10-12 items (got ${ex1.length})`);
  assert.deepEqual(ex1, ex2, 'lesson generation is deterministic');
});
