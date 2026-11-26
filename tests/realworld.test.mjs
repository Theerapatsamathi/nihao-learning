import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SITUATIONS,
  PATTERNS,
  STREET_LEVELS,
  buildUnscriptedSession,
  gradeSituationAnswer,
  evaluateUnscriptedSession,
  buildStreetListeningSet,
  evaluateStreetSet,
  buildPatternDrill,
  gradePatternAnswer,
  evaluatePatternDrill,
  buildBlindDictationSet,
  judgeBlindResult,
  recordRealWorldResult,
  realWorldProgress
} from '../src/features/month1/realworld-logic.js';
import { mergeCloudProgressData } from '../src/modules/progress-merge.js';

test('Unscripted speaking: keyword groups graded from hanzi or typed pinyin', () => {
  const milk = SITUATIONS.find(s => s.id === 'milktea');
  const full = gradeSituationAnswer(milk, '我要一杯奶茶，少冰，半糖。');
  assert.equal(full.hits, 4);
  assert.equal(full.points, 2);
  assert.equal(full.passedItem, true);

  const typed = gradeSituationAnswer(milk, 'wo yao yi bei nai cha shao bing ban tang');
  assert.equal(typed.passedItem, true);

  const partial = gradeSituationAnswer(milk, '我要奶茶');
  assert.equal(partial.passedItem, false);
  assert.ok(partial.missing.length >= 2);

  const none = gradeSituationAnswer(milk, '你好');
  assert.equal(none.points, 0);

  assert.equal(evaluateUnscriptedSession([2, 2, 2, 2, 1.5]).passed, true);
  assert.equal(evaluateUnscriptedSession([2, 2, 2, 1.5, 1.5]).passed, false);

  const session = buildUnscriptedSession(1, 5, 11);
  assert.equal(session.length, 5);
  assert.ok(session.every(s => s.groups.length >= 2 && s.model.hz));
});

test('Street listening: 3 realism levels build 10 valid questions with noise config', () => {
  assert.equal(STREET_LEVELS.fast.rate, 1.2);
  assert.equal(STREET_LEVELS.noisy.noise, 'auto');
  const set = buildStreetListeningSet('noisy', 5, 10, 5);
  assert.equal(set.questions.length, 10);
  assert.ok(['cafe', 'subway'].includes(set.noiseKind));
  for (const q of set.questions) {
    assert.equal(q.options.length, 4);
    assert.equal(q.options[q.answer], q.th);
  }
  assert.equal(buildStreetListeningSet('normal', 1, 10, 5).noiseKind, null);
  assert.equal(evaluateStreetSet(9, 10, 90).passed, true);
  assert.equal(evaluateStreetSet(8, 10, 90).passed, false);
});

test('Pattern workshop: all patterns have valid 5 items and require 5/5', () => {
  for (const p of PATTERNS) {
    assert.ok(p.items.length >= 5, p.id);
    const d = buildPatternDrill(p.id, 3);
    assert.equal(d.items.length, 5);
    for (const it of d.items) {
      assert.equal(it.tiles.length >= 2, true);
      assert.equal(it.expectedPy.split(' ').length >= it.tiles.length, true);
    }
  }
  const d = buildPatternDrill('shi', 7);
  const first = d.items[0];
  const exp = [...first.tiles].sort((a, b) => first.expectedHz.indexOf(a.hz) - first.expectedHz.indexOf(b.hz)).map(t => t.hz);
  assert.equal(gradePatternAnswer(first, exp), true);
  assert.equal(gradePatternAnswer(first, [...exp].reverse()), false);
  assert.equal(evaluatePatternDrill(5, 5).passed, true);
  assert.equal(evaluatePatternDrill(4, 5).passed, false);
});

test('Blind dictation: no-hint rule allows at most 1 mistake; progress & merge persist', () => {
  const set = buildBlindDictationSet(4, 5, 9);
  assert.equal(set.length, 5);
  assert.ok(set.every(s => s.hz && s.th));
  assert.equal(judgeBlindResult(0).passed, true);
  assert.equal(judgeBlindResult(1).passed, true);
  assert.equal(judgeBlindResult(2).passed, false);

  let rw = recordRealWorldResult({}, 'street', 'fast', { pct: 90, passed: true }, '2026-11-26');
  rw = recordRealWorldResult(rw, 'street', 'fast', { pct: 70, passed: false }, '2026-11-27');
  assert.equal(rw.street.fast.bestPct, 90);
  assert.equal(rw.street.fast.passed, true);
  assert.equal(rw.street.fast.attempts, 2);
  assert.equal(realWorldProgress(rw).street, 1);

  const merged = mergeCloudProgressData(
    { ext: { month1: { realWorld: { blindChars: ['人'], street: { fast: { bestPct: 90, passed: true, updatedAt: 1 } } } } } },
    { ext: { month1: { realWorld: { blindChars: ['口'], street: { noisy: { bestPct: 100, passed: true, updatedAt: 2 } } } } } }
  );
  const mrw = merged.ext.month1.realWorld;
  assert.deepEqual(mrw.blindChars.sort(), ['人', '口']);
  assert.equal(mrw.street.fast.passed, true);
  assert.equal(mrw.street.noisy.passed, true);
});
