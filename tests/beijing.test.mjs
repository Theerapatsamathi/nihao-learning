import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BEIJING_QUESTS,
  getDaysUntilBeijing,
  calcBeijingReadiness,
  buildBeijingQuestExam,
  buildPreFlightBoardingExam
} from '../src/features/month1/beijing-data.js';

test('BEIJING_QUESTS has 6 quests with 8 phrases each (48 total)', () => {
  assert.equal(BEIJING_QUESTS.length, 6);
  const total = BEIJING_QUESTS.reduce((s, q) => s + q.phrases.length, 0);
  assert.equal(total, 48);
});

test('getDaysUntilBeijing calculates exact countdown to Jan 25, 2027', () => {
  assert.equal(getDaysUntilBeijing('2026-11-26', '2027-01-25'), 60);
  assert.equal(getDaysUntilBeijing('2027-01-25', '2027-01-25'), 0);
});

test('calcBeijingReadiness and exam builders enforce >=95% pass gate', () => {
  const r0 = calcBeijingReadiness({});
  assert.equal(r0.pct, 0);
  const rFull = calcBeijingReadiness({
    quests: Object.fromEntries(BEIJING_QUESTS.map(q => [q.id, { passed: true, bestPct: 100 }])),
    boardingExam: { passed: true, bestPct: 96 }
  });
  assert.equal(rFull.pct, 100);

  const qExam = buildBeijingQuestExam('airport', 42);
  assert.equal(qExam.questions.length, 8);
  assert.equal(qExam.speaking.length, 2);
  assert.equal(qExam.passPct, 95);

  const bExam = buildPreFlightBoardingExam(42);
  assert.equal(bExam.questions.length, 16);
  assert.equal(bExam.speaking.length, 4);
  assert.equal(bExam.passPct, 95);
});
