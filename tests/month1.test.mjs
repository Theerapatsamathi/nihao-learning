import test from 'node:test';
import assert from 'node:assert/strict';
import { TONE_PAIRS, THAI_TRAPS, MONTH1_DAYS_15_30, HANZI_MNEMONICS, SURVIVAL_50 } from '../src/features/month1/data-month1.js';
import { stripTones, getTodayBlueprintDay, calcMonth1Stats, buildGuidedSession, searchDictionary } from '../src/features/month1/logic.js';

test('Month-1 datasets have expected complete counts', () => {
  assert.equal(TONE_PAIRS.length, 20);
  assert.ok(THAI_TRAPS.length >= 4);
  assert.equal(MONTH1_DAYS_15_30.length, 16);
  assert.equal(HANZI_MNEMONICS.length, 64);
  assert.equal(SURVIVAL_50.length, 50);
});

test('getTodayBlueprintDay advances from Day 1-14 into Day 15-30', () => {
  assert.equal(getTodayBlueprintDay({}, {}), 1);
  const scores14 = {};
  for (let d = 1; d <= 14; d++) scores14[d] = 9;
  assert.equal(getTodayBlueprintDay({ dayScores: scores14 }, {}), 15);
  assert.equal(getTodayBlueprintDay({ dayScores: scores14 }, { doneDays: [15, 16] }), 17);
});

test('buildGuidedSession produces 3 warmup, 4 tone pairs, and 5 speak items', () => {
  const s = buildGuidedSession(15, [{ hanzi: '谢谢', pinyin: 'xièxie', meaning: 'ขอบคุณ' }]);
  assert.equal(s.day, 15);
  assert.equal(s.warmup.length, 3);
  assert.equal(s.warmup[0].hz, '谢谢');
  assert.equal(s.toneFocus.length, 4);
  assert.equal(s.speakItems.length, 5);
});

test('searchDictionary matches Thai, toneless pinyin, and hanzi', () => {
  assert.equal(stripTones('nǐ hǎo'), 'ni hao');
  const byPy = searchDictionary('naicha', {});
  assert.ok(byPy.some(x => x.hz.includes('奶茶')));
  const byTh = searchDictionary('ชานม', {});
  assert.ok(byTh.some(x => x.hz.includes('奶茶')));
  const byHz = searchDictionary('休', {});
  assert.ok(byHz.some(x => x.hz === '休' && x.extra.includes('ต้นไม้')));
});

test('calcMonth1Stats computes progress percentage', () => {
  const st = calcMonth1Stats({ dayScores: { 1: 10, 2: 8 } }, { doneDays: [15], tonePairsDone: ['1-1', '1-2'] });
  assert.equal(st.totalDaysDone, 3);
  assert.equal(st.pct, 10);
  assert.equal(st.tonePairsDone, 2);
});

import { extractChineseChars } from '../src/features/month1/copybook.js';

test('extractChineseChars deduplicates and filters only Hanzi', () => {
  assert.deepEqual(extractChineseChars('你好! 你好 123 谢谢'), ['你', '好', '谢']);
});

import {
  DAILY_MASTERY_PASS_PCT,
  EXAM_TOTAL_POINTS,
  isDayMastered,
  buildDailyMasteryExam,
  gradeSpeakingExamItem,
  evaluateDailyMasteryAttempt
} from '../src/features/month1/logic.js';

test('Daily Mastery Gate: requires strict >= 95% to complete a day and unlock next day', () => {
  assert.equal(DAILY_MASTERY_PASS_PCT, 95);
  assert.equal(EXAM_TOTAL_POINTS, 20);

  // 18.5 / 20 = 92.5% -> MUST FAIL (not finished!)
  const failAttempt = evaluateDailyMasteryAttempt({ quizCorrect: 13, quizTotal: 14, speakingPoints: 5.5, speakingMax: 6 });
  assert.equal(failAttempt.pct, 92.5);
  assert.equal(failAttempt.passed, false);
  assert.equal(failAttempt.neededPoints, 0.5);

  // 19.0 / 20 = 95.0% -> PASS!
  const passAttempt = evaluateDailyMasteryAttempt({ quizCorrect: 13, quizTotal: 14, speakingPoints: 6, speakingMax: 6 });
  assert.equal(passAttempt.pct, 95);
  assert.equal(passAttempt.passed, true);
  assert.equal(passAttempt.neededPoints, 0);

  // Day 1 scored 90% -> still locked on Day 1!
  const extFail = {
    dayMastery: {
      1: { bestPct: 90, lastPct: 90, attempts: 2, passed: false }
    }
  };
  assert.equal(isDayMastered(1, {}, extFail), false);
  assert.equal(getTodayBlueprintDay({}, extFail), 1);

  // Once Day 1 scores 95% -> advances to Day 2!
  const extPass = {
    dayMastery: {
      1: { bestPct: 95, lastPct: 95, attempts: 3, passed: true }
    }
  };
  assert.equal(isDayMastered(1, {}, extPass), true);
  assert.equal(getTodayBlueprintDay({}, extPass), 2);
});

test('buildDailyMasteryExam & gradeSpeakingExamItem verify closed-book recall, order, and speech', () => {
  const examA = buildDailyMasteryExam(3, { seed: 101 });
  const examB = buildDailyMasteryExam(3, { seed: 202 });
  assert.equal(examA.questions.length, 14);
  assert.equal(examA.speakingPrompts.length, 3);
  assert.ok(examA.questions.some(q => q.kind === 'order' && Array.isArray(q.tiles) && q.tiles.length >= 2));
  assert.notDeepEqual(examA.questions.map(q => q.id), examB.questions.map(q => q.id));

  // Mic pronunciation grading
  const exactMic = gradeSpeakingExamItem({
    targetHz: '我是泰国人',
    targetPy: 'Wǒ shì Tàiguórén.',
    heardText: '我是泰国人'
  });
  assert.equal(exactMic.points, 2);
  assert.equal(exactMic.passedItem, true);

  const wrongMic = gradeSpeakingExamItem({
    targetHz: '我是泰国人',
    targetPy: 'Wǒ shì Tàiguórén.',
    heardText: '你好'
  });
  assert.equal(wrongMic.points, 0);
  assert.equal(wrongMic.passedItem, false);

  // Tone-numbered pinyin fallback grading (requires exact tones for full credit)
  const exactPy = gradeSpeakingExamItem({
    targetHz: '你好',
    targetPy: 'nǐ hǎo',
    typedPinyinFallback: 'ni3 hao3'
  });
  assert.equal(exactPy.points, 2);

  const tonelessPy = gradeSpeakingExamItem({
    targetHz: '你好',
    targetPy: 'nǐ hǎo',
    typedPinyinFallback: 'ni hao'
  });
  assert.equal(tonelessPy.points, 1);
  assert.equal(tonelessPy.passedItem, false);
});

import { getProgressivePinyin } from '../src/features/month1/logic.js';

test('Progressive Pinyin scaffolding: Day 1-14 keeps full pinyin, Day 15-30 fades basic chars gradually', () => {
  // Day 1-14: full pinyin always shown
  assert.equal(getProgressivePinyin('我是泰国人', 'Wǒ shì Tàiguórén', 1), 'Wǒ shì Tàiguórén');
  assert.equal(getProgressivePinyin('我是泰国人', 'Wǒ shì Tàiguórén', 14), 'Wǒ shì Tàiguórén');

  // Day 18 (15-22): masks Tier-1 basic chars (我, 人) while keeping harder syllables (shì, Tài, guó)
  const midPy = getProgressivePinyin('我是泰国人', 'Wǒ shì Tàiguórén', 18);
  assert.ok(midPy.includes('••'));
  assert.ok(midPy.includes('Tài'));

  // Day 26 (23-30): masks more core chars (我, 是, 国, 人) while still keeping unfamiliar Tài
  const latePy = getProgressivePinyin('我是泰国人', 'Wǒ shì Tàiguórén', 26);
  assert.ok(latePy.includes('Tài'));

  // Day 1 word-order tiles include pinyin for every tile
  const examDay1 = buildDailyMasteryExam(1, { seed: 42 });
  const orderQ = examDay1.questions.find(q => q.kind === 'order');
  assert.ok(orderQ);
  assert.equal(orderQ.tiles.length, orderQ.tilePinyins.length);
  assert.ok(orderQ.tilePinyins.every(p => p.length > 0));
});
