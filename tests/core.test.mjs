import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDaysToDateKey,
  computeNextSm2,
  computeSrsRetention,
  DEFAULT_EASE,
  MIN_EASE
} from '../src/modules/srs-sm2.js';
import {
  mergeCloudProgressData,
  mergeTimestampedMap,
  mergeMaxNumMap
} from '../src/modules/progress-merge.js';

test('SM-2: addDaysToDateKey handles month/year rollovers cleanly', () => {
  assert.equal(addDaysToDateKey('2026-11-30', 1), '2026-12-01');
  assert.equal(addDaysToDateKey('2026-12-30', 5), '2027-01-04');
});

test('SM-2: new word rated good progresses 1 -> 3 -> ~8 days and preserves ease', () => {
  const r1 = computeNextSm2(null, 'good', '2026-11-23', 1000);
  assert.equal(r1.interval, 1);
  assert.equal(r1.nextDue, '2026-11-24');
  assert.equal(r1.ease, DEFAULT_EASE);
  assert.equal(r1.reviews, 1);

  const r2 = computeNextSm2(r1, 'good', '2026-11-24', 2000);
  assert.equal(r2.interval, 3);
  assert.equal(r2.nextDue, '2026-11-27');

  const r3 = computeNextSm2(r2, 'good', '2026-11-27', 3000);
  assert.equal(r3.interval, 8); // round(3 * 2.5) = 8
  assert.equal(r3.nextDue, '2026-12-05');
});

test('SM-2: rating easy increases ease and skips ahead; again resets interval & increments lapses', () => {
  const easy = computeNextSm2(null, 'easy', '2026-11-23', 1000);
  assert.equal(easy.interval, 4);
  assert.ok(easy.ease > DEFAULT_EASE);

  const lapse = computeNextSm2(easy, 'again', '2026-11-27', 2000);
  assert.equal(lapse.interval, 0);
  assert.equal(lapse.lapses, 1);
  assert.equal(lapse.nextDue, '2026-11-27');
  assert.ok(lapse.ease < easy.ease);

  // Repeated lapses never drop below MIN_EASE
  let cur = lapse;
  for (let i = 0; i < 15; i++) {
    cur = computeNextSm2(cur, 'again', '2026-11-27', 3000 + i);
  }
  assert.equal(cur.ease, MIN_EASE);
});

test('SM-2: computeSrsRetention calculates retention % and mastered count accurately', () => {
  const stats = computeSrsRetention({
    '1': { reviews: 10, lapses: 1, interval: 14, step: 3 },
    '2': { reviews: 10, lapses: 3, interval: 3, step: 1 }
  });
  assert.equal(stats.totalTracked, 2);
  assert.equal(stats.totalReviews, 20);
  assert.equal(stats.mastered, 1);
  assert.equal(stats.retentionPct, 80);
});

test('Progress Merge: picks newer per-item timestamp in vocabSrs across two devices', () => {
  const local = {
    vocabSrs: {
      '10': { step: 3, interval: 14, reviews: 5, updatedAt: 2000 },
      '20': { step: 1, interval: 3, reviews: 2, updatedAt: 1000 }
    },
    vocabLearned: { '10': '2026-11-20', '20': '2026-11-22' },
    activity: { '2026-11-23': 12 },
    dayScores: { '1': 8 },
    bonusXp: 100,
    streakFreezes: 1,
    frozenDays: ['2026-11-21']
  };
  const cloud = {
    vocabSrs: {
      '10': { step: 1, interval: 3, reviews: 2, updatedAt: 1000 },
      '20': { step: 4, interval: 30, reviews: 6, updatedAt: 3000 }
    },
    vocabLearned: { '10': '2026-11-22', '20': '2026-11-18' },
    activity: { '2026-11-23': 5, '2026-11-22': 9 },
    dayScores: { '1': 10, '2': 9 },
    bonusXp: 80,
    streakFreezes: 2,
    frozenDays: ['2026-11-19']
  };

  const merged = mergeCloudProgressData(local, cloud);
  assert.equal(merged.vocabSrs['10'].updatedAt, 2000); // local newer
  assert.equal(merged.vocabSrs['20'].updatedAt, 3000); // cloud newer
  assert.equal(merged.vocabLearned['10'], '2026-11-20'); // earliest date
  assert.equal(merged.vocabLearned['20'], '2026-11-18'); // earliest date
  assert.equal(merged.activity['2026-11-23'], 12);
  assert.equal(merged.activity['2026-11-22'], 9);
  assert.equal(merged.dayScores['1'], 10);
  assert.equal(merged.bonusXp, 100);
  assert.equal(merged.streakFreezes, 2);
  assert.deepEqual(merged.frozenDays.sort(), ['2026-11-19', '2026-11-21']);
});

test('Progress Merge: mergeTimestampedMap falls back to score when updatedAt is missing', () => {
  const res = mergeTimestampedMap(
    { w1: { reviews: 4, step: 2 } },
    { w1: { reviews: 1, step: 0 } },
    (x) => (x.reviews || 0) * 10 + (x.step || 0)
  );
  assert.equal(res.w1.reviews, 4);
  assert.deepEqual(mergeMaxNumMap({ a: 3 }, { a: 7, b: 2 }), { a: 7, b: 2 });
});

test('Progress Merge: merges dayChecks union, spentCoins max, and mistakes', () => {
  const local = {
    dayChecks: { '1': ['intro', 'drill'], '2': ['intro'] },
    spentCoins: 120,
    vocabGoal: 100,
    mistakes: [{ id: 'm1', misses: 2 }],
    daily: { date: '2026-11-26', drills: 5, writes: 2, srs: 3, claimed: ['drill'] }
  };
  const cloud = {
    dayChecks: { '1': ['drill', 'write'], '2': ['drill'], '3': ['intro'] },
    spentCoins: 200,
    vocabGoal: 150,
    mistakes: [{ id: 'm1', misses: 4 }, { id: 'm2', misses: 1 }],
    daily: { date: '2026-11-26', drills: 2, writes: 4, srs: 5, claimed: ['write'] }
  };
  const merged = mergeCloudProgressData(local, cloud);
  assert.deepEqual(merged.dayChecks['1'].sort(), ['drill', 'intro', 'write']);
  assert.deepEqual(merged.dayChecks['2'].sort(), ['drill', 'intro']);
  assert.deepEqual(merged.dayChecks['3'], ['intro']);
  assert.equal(merged.spentCoins, 200);
  assert.equal(merged.vocabGoal, 150);
  const m1 = merged.mistakes.find(m => m.id === 'm1');
  assert.equal(m1.misses, 4);
  assert.equal(merged.daily.drills, 5);
  assert.equal(merged.daily.writes, 4);
  assert.equal(merged.daily.srs, 5);
  assert.deepEqual(merged.daily.claimed.sort(), ['drill', 'write']);
});
