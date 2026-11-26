import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildStudyCalendar,
  computeSkillStrengthsWeaknesses,
  computeHskEtaForecast,
  computeTrophyCase
} from '../src/features/month1/analytics-logic.js';

test('buildStudyCalendar builds 84-day grid and aggregates passed days & hours', () => {
  const cal = buildStudyCalendar(
    { activity: { '2026-11-26': 3 } },
    {
      dayMastery: { 1: { passed: true, bestPct: 95, passedAt: '2026-11-26' } },
      studyLog: { '2026-11-26': { minutes: 12 } }
    },
    '2026-11-26',
    84
  );
  assert.equal(cal.cells.length, 84);
  const today = cal.cells[cal.cells.length - 1];
  assert.equal(today.dateKey, '2026-11-26');
  assert.equal(today.passedDays.length, 1);
  assert.equal(today.minutes, 12);
  assert.equal(cal.summary.todayMin, 12);
});

test('computeSkillStrengthsWeaknesses returns 4 skills, strength, weakness, and nemesis words', () => {
  const res = computeSkillStrengthsWeaknesses(
    { mistakes: [{ hanzi: '吃饭', pinyin: 'chī fàn', meaning: 'กินข้าว', misses: 4 }] },
    { tonePairsDone: Array.from({ length: 10 }, (_, i) => i + 1), dayMastery: { 1: { passed: true, bestPct: 100 } } }
  );
  assert.equal(res.skills.length, 4);
  assert.ok(res.strength && res.weakness);
  assert.equal(res.nemesis[0].hz, '吃饭');
});

test('computeHskEtaForecast and computeTrophyCase return valid forecasts and medals', () => {
  const eta = computeHskEtaForecast({}, { dayMastery: { 1: { passed: true, bestPct: 100, passedAt: '2026-11-26' } } }, '2026-11-26');
  assert.ok(eta.hsk1.daysNeeded > 0);
  assert.ok(eta.hsk3.daysNeeded > eta.hsk1.daysNeeded);

  const trophies = computeTrophyCase({}, { intensity: 5, dayMastery: { 1: { passed: true, bestPct: 95 } } }, { streak: 7 });
  assert.ok(trophies.find(t => t.id === 'first95')?.unlocked);
  assert.ok(trophies.find(t => t.id === 'streak7')?.unlocked);
  assert.ok(trophies.find(t => t.id === 'hardcore')?.unlocked);
});
