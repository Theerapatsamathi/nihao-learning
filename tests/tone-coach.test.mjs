import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TONE_COACH_PACKS,
  normalizePitchSamples,
  analyzePitchAgainstTones,
  buildDetailedPronunciationReport
} from '../src/features/month1/tone-coach-logic.js';

test('TONE_COACH_PACKS provides curated drills with hanzi, pinyin, and Thai', () => {
  assert.ok(TONE_COACH_PACKS.length >= 3);
  for (const p of TONE_COACH_PACKS) {
    assert.ok(p.items.length >= 5);
    for (const it of p.items) {
      assert.ok(it.hz && it.py && it.th);
    }
  }
});

test('normalizePitchSamples maps Hz samples into 1..5 scale cleanly', () => {
  const res = normalizePitchSamples([120, 150, 180, 210, 240], 10);
  assert.equal(res.length, 10);
  assert.ok(res[0] >= 1 && res[0] <= 2);
  assert.ok(res[res.length - 1] >= 4 && res[res.length - 1] <= 5);
});

test('analyzePitchAgainstTones scores rising pitch well for tone 2 and flags flat pitch', () => {
  const risingHz = Array.from({ length: 20 }, (_, i) => 130 + i * 7);
  const good = analyzePitchAgainstTones(risingHz, [2]);
  assert.ok(good.contourScore >= 70);

  const fallingHz = Array.from({ length: 20 }, (_, i) => 260 - i * 7);
  const bad = analyzePitchAgainstTones(fallingHz, [2]);
  assert.ok(bad.toneFeedback.some(m => m.includes('เสียง 2')));
});

test('buildDetailedPronunciationReport detects 3+3 sandhi and articulation tips', () => {
  const report = buildDetailedPronunciationReport({
    targetHz: '你好',
    targetPy: 'nǐ hǎo',
    heardHz: '你好',
    rawHzList: [150, 170, 200, 180, 130, 110, 140]
  });
  assert.ok(report.overallScore > 0);
  assert.ok(report.tips.some(t => t.type === 'sandhi'));

  const trapReport = buildDetailedPronunciationReport({
    targetHz: '吃饭',
    targetPy: 'chī fàn',
    heardHz: '吃',
    rawHzList: [220, 220, 215, 200, 160, 120]
  });
  assert.ok(trapReport.tips.some(t => t.type === 'articulation' && t.title.includes('ch')));
});
