import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getDailyIndex,
  computeTokenTimings,
  estimateSentenceDurationMs,
  buildSprintQuestion,
  scoreChineseSpeech
} from '../src/features/games-reading/utils.js';
import { RADICAL_ITEMS, MEASURE_ITEMS, TONE_BUBBLE_SETS } from '../src/features/games-reading/data-games.js';
import { GRADED_STORIES } from '../src/features/games-reading/data-stories.js';
import { IMMERSIVE_SCENES } from '../src/features/games-reading/data-scenes.js';
import { PODCAST_EPISODES } from '../src/features/games-reading/data-podcast.js';
import { CULTURE_CARDS } from '../src/features/games-reading/data-culture.js';

test('datasets meet minimum counts and required fields', () => {
  assert.ok(RADICAL_ITEMS.length >= 30, `Expected >=30 radicals, got ${RADICAL_ITEMS.length}`);
  for (const r of RADICAL_ITEMS) {
    assert.ok(r.char && r.left && r.right && r.py && r.th);
  }

  assert.ok(MEASURE_ITEMS.length >= 40, `Expected >=40 measure items, got ${MEASURE_ITEMS.length}`);
  for (const m of MEASURE_ITEMS) {
    assert.ok(m.noun && m.py && m.th && m.mw);
  }

  assert.ok(TONE_BUBBLE_SETS.length >= 8);
  for (const s of TONE_BUBBLE_SETS) {
    assert.equal(s.tones.length, 4);
  }

  const hsk1 = GRADED_STORIES.filter((s) => s.level === 'HSK1');
  const hsk2 = GRADED_STORIES.filter((s) => s.level === 'HSK2');
  assert.ok(hsk1.length >= 4, 'Need >=4 HSK1 stories');
  assert.ok(hsk2.length >= 4, 'Need >=4 HSK2 stories');
  for (const st of GRADED_STORIES) {
    assert.ok(st.sentences.length >= 6 && st.sentences.length <= 12);
    assert.ok(st.quiz.length >= 2);
    for (const sent of st.sentences) {
      assert.ok(Array.isArray(sent.tokens) && sent.tokens.length > 0);
      assert.equal(sent.tokens.map((x) => x.zh).join(''), sent.zh);
    }
  }

  assert.ok(IMMERSIVE_SCENES.length >= 6, 'Need >=6 immersive scenes');
  assert.ok(PODCAST_EPISODES.length >= 4, 'Need >=4 podcast episodes');
  assert.ok(CULTURE_CARDS.length >= 30, 'Need >=30 daily culture cards');
});

test('getDailyIndex is deterministic and within bounds', () => {
  const a = getDailyIndex('2026-11-23', CULTURE_CARDS.length);
  const b = getDailyIndex('2026-11-23', CULTURE_CARDS.length);
  assert.equal(a, b);
  assert.ok(a >= 0 && a < CULTURE_CARDS.length);
});

test('computeTokenTimings distributes duration proportionally', () => {
  const tokens = [
    { zh: '今天', py: 'jīntiān', th: 'วันนี้' },
    { zh: '好', py: 'hǎo', th: 'ดี' },
    { zh: '。', punct: true }
  ];
  const timings = computeTokenTimings(tokens, 2000);
  assert.equal(timings.length, 3);
  assert.equal(timings[0].start, 0);
  assert.ok(timings[0].duration > timings[1].duration);
  assert.ok(timings[1].duration > timings[2].duration);
  assert.ok(estimateSentenceDurationMs('今天天气很好。', 0.5) > estimateSentenceDurationMs('今天天气很好。', 1.2));
});

test('buildSprintQuestion generates valid true and false pairs', () => {
  const pool = [
    { zh: '你好', py: 'nǐ hǎo', th: 'สวัสดี' },
    { zh: '谢谢', py: 'xièxie', th: 'ขอบคุณ' },
    { zh: '再见', py: 'zàijiàn', th: 'ลาก่อน' }
  ];
  const qTrue = buildSprintQuestion(pool, () => 0.1);
  assert.equal(qTrue.isMatch, true);
  assert.equal(qTrue.shownTh, qTrue.actualTh);

  const qFalse = buildSprintQuestion(pool, () => 0.8);
  assert.equal(qFalse.isMatch, false);
  assert.notEqual(qFalse.shownTh, qFalse.actualTh);
});

test('scoreChineseSpeech measures character overlap ignoring punctuation', () => {
  assert.equal(scoreChineseSpeech('我要一杯冰美式', '我要一杯冰美式。'), 1);
  assert.equal(scoreChineseSpeech('', '你好'), 0);
  assert.ok(scoreChineseSpeech('我要咖啡', '我要一杯咖啡') >= 0.6);
});
