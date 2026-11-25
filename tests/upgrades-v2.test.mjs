import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeNextFsrs,
  computeRetrievability,
  selectBedtimeDeck
} from '../src/modules/srs-sm2.js';
import {
  buildChineseLookupMap,
  segmentChineseText,
  buildDuelQuestionsFromTokens
} from '../src/features/games-reading/smart-importer.js';
import { evaluateLocalHandwriting } from '../src/features/month1/copybook.js';
import { suggestLocalHandwritingCandidates } from '../src/features/month1/quick-dict.js';
import {
  buildSeededDuelQuestions,
  calcRaidBossDamage
} from '../src/features/arena/logic.js';
import { verifyFirebaseIdToken } from '../gcp/gcp-services.mjs';

test('FSRS-4.5: schedules growing stability intervals and selects lowest-retrievability bedtime cards', () => {
  const c1 = computeNextFsrs(null, 'good', '2026-11-25', 1000);
  assert.ok(c1.interval >= 3);
  assert.ok(c1.stability >= 3);
  assert.equal(c1.reviews, 1);

  const c2 = computeNextFsrs(c1, 'good', '2026-11-28', 2000);
  assert.ok(c2.interval > c1.interval);
  assert.ok(c2.stability > c1.stability);

  // Overdue card has lower retrievability than freshly reviewed card
  const freshR = computeRetrievability(c2, '2026-11-28');
  const overdueR = computeRetrievability(c2, '2026-12-25');
  assert.ok(overdueR < freshR);

  const words = [
    { id: 1, hanzi: '你好' },
    { id: 2, hanzi: '奶茶' }
  ];
  const srs = {
    1: { ...c2, lastReview: '2026-11-25', stability: 30, lapses: 0, nextDue: '2026-12-25' },
    2: { ...c1, lastReview: '2026-11-01', stability: 2, lapses: 2, nextDue: '2026-11-03' }
  };
  const bedtime = selectBedtimeDeck(words, srs, '2026-11-25', 12);
  assert.equal(bedtime[0].hanzi, '奶茶');
});

test('Smart Importer: segments Chinese lyrics, attaches Pinyin/Thai, and generates 4-option Arena Duel questions', () => {
  const lookup = buildChineseLookupMap({
    allVocabWords: [
      { hanzi: '今天', pinyin: 'jīntiān', meaning: 'วันนี้' },
      { hanzi: '喝', pinyin: 'hē', meaning: 'ดื่ม' }
    ],
    lexicon: []
  });
  const lines = segmentChineseText('今天喝珍珠奶茶，少冰半糖！', lookup);
  assert.equal(lines.length, 1);
  const words = lines[0].tokens.filter(t => !t.punct).map(t => t.zh);
  assert.ok(words.includes('今天'));
  assert.ok(words.includes('奶茶'));

  const duelQs = buildDuelQuestionsFromTokens(lines);
  assert.ok(duelQs.length >= 4);
  assert.equal(duelQs[0].opts.length, 4);
  assert.ok(duelQs[0].opts.includes(duelQs[0].a));
});

test('Copybook Local Grader & Quick-Dict Handwriting Lookup: return valid grades and stroke candidates', () => {
  const report = evaluateLocalHandwriting([
    {
      char: '好',
      size: 168,
      strokes: [
        { pts: [{ x: 35, y: 40 }, { x: 130, y: 128 }] },
        { pts: [{ x: 84, y: 30 }, { x: 84, y: 135 }] }
      ]
    }
  ]);
  assert.ok(report);
  assert.ok(['S', 'A', 'B', 'C'].includes(report.overallGrade));
  assert.equal(report.items[0].char, '好');

  const cands = suggestLocalHandwritingCandidates(3);
  assert.ok(cands.length >= 5);
  assert.ok(cands.some(c => c.hz === '大' || c.hz === '口'));
});

test('Arena Raid & New Duel Modes: Tone Sniper, Hanzi Speed Draw, and Boss Raid combo damage', () => {
  const sniper = buildSeededDuelQuestions('tone-sniper', 99, 5);
  assert.equal(sniper.length, 5);
  assert.equal(sniper[0].mode, 'tone-sniper');
  assert.ok(sniper[0].audioText);

  const draw = buildSeededDuelQuestions('speed-draw', 99, 5);
  assert.equal(draw[0].mode, 'speed-draw');
  assert.ok(draw[0].char);

  assert.equal(calcRaidBossDamage(false, 5, 1000), 0);
  assert.ok(calcRaidBossDamage(true, 4, 2000) > calcRaidBossDamage(true, 1, 8000));
});

test('Backend Auth Verification: rejects malformed or unsigned Firebase JWT tokens safely', async () => {
  assert.equal(await verifyFirebaseIdToken(''), null);
  assert.equal(await verifyFirebaseIdToken('not.a.jwt'), null);
  const fakeUnsigned = `${Buffer.from('{"alg":"none"}').toString('base64url')}.${Buffer.from('{"sub":"123"}').toString('base64url')}.sig`;
  assert.equal(await verifyFirebaseIdToken(fakeUnsigned), null);
});
