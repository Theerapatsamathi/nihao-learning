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

import {
  collectDayFsrsItems,
  getDueMonth1FsrsCards,
  gradeQuizFsrsResponse,
  getDecayedDays,
  getPendingWeeklyBoss,
  buildWeeklyBossExam,
  diagnoseWeakDaysFromBoss,
  buildReflexPrompts,
  buildWeaknessQueue
} from '../src/features/month1/logic.js';

test('Full Mastery Suite: Quiz-FSRS grading, Memory Decay check, Weekly Boss Gate & Diagnosis, Reflex & Weakness', () => {
  // 1) Day FSRS auto-collection & objective speed-based FSRS grading
  const dayItems = collectDayFsrsItems(1);
  assert.ok(dayItems.length >= 8);
  assert.equal(gradeQuizFsrsResponse({ isCorrect: false, elapsedMs: 1200 }), 'again');
  assert.equal(gradeQuizFsrsResponse({ isCorrect: true, elapsedMs: 2100 }), 'easy');
  assert.equal(gradeQuizFsrsResponse({ isCorrect: true, elapsedMs: 5000 }), 'good');
  assert.equal(gradeQuizFsrsResponse({ isCorrect: true, elapsedMs: 9500 }), 'hard');

  const due = getDueMonth1FsrsCards({
    你好: { id: '你好', hz: '你好', py: 'nǐ hǎo', th: 'สวัสดี', srs: { nextDue: '2026-11-25', stability: 2, reviews: 1, lastReview: '2026-11-23' } },
    谢谢: { id: '谢谢', hz: '谢谢', py: 'xièxie', th: 'ขอบคุณ', srs: { nextDue: '2026-11-30', stability: 5, reviews: 2, lastReview: '2026-11-25' } }
  }, '2026-11-26');
  assert.equal(due.length, 1);
  assert.equal(due[0].hz, '你好');

  // 2) Memory Decay triggers at >= 7 days and >= 21 days
  const extDecay = {
    dayMastery: {
      1: { bestPct: 100, passed: true, passedAt: '2026-11-18', verifyTier: 0 },
      2: { bestPct: 95, passed: true, passedAt: '2026-11-24', verifyTier: 0 }
    }
  };
  const decayed = getDecayedDays(extDecay, '2026-11-26');
  assert.equal(decayed.length, 1);
  assert.equal(decayed[0].day, 1);

  // 3) Weekly Cumulative Boss Gate blocks advancing past Day 7 until Boss >= 95% is passed
  const dmWeek1 = {};
  for (let d = 1; d <= 7; d++) dmWeek1[d] = { bestPct: 95, passed: true, passedAt: '2026-11-26' };
  assert.equal(getPendingWeeklyBoss({}, { dayMastery: dmWeek1 }), 7);
  assert.equal(getPendingWeeklyBoss({}, { dayMastery: dmWeek1, weeklyBoss: { 7: { bestPct: 90, passed: false } } }), 7);
  assert.equal(getPendingWeeklyBoss({}, { dayMastery: dmWeek1, weeklyBoss: { 7: { bestPct: 95, passed: true } } }), null);

  const bossExam = buildWeeklyBossExam(7, { seed: 777 });
  assert.equal(bossExam.questions.length, 14);
  assert.equal(bossExam.speakingPrompts.length, 3);
  assert.ok(bossExam.questions.every(q => q.sourceDay >= 1 && q.sourceDay <= 7));

  const weakReport = diagnoseWeakDaysFromBoss([{ sourceDay: 2 }, { sourceDay: 5 }, { sourceDay: 2 }]);
  assert.deepEqual(weakReport, [{ day: 2, misses: 2 }, { day: 5, misses: 1 }]);

  // 4) Reflex & Weakness generators produce complete prompts
  const reflex = buildReflexPrompts(3, 6, 99);
  assert.equal(reflex.length, 6);
  const weakQueue = buildWeaknessQueue({ mistakes: [{ hanzi: '谢谢', pinyin: 'xièxie', meaning: 'ขอบคุณ', misses: 3 }], maxDay: 2, count: 6, seed: 88 });
  assert.equal(weakQueue.length, 6);
});

import { MONTH2_DAYS_31_60, MONTH3_DAYS_61_90 } from '../src/features/month1/data-months23.js';
import { calc90DayStats, WEEKLY_BOSS_DAYS } from '../src/features/month1/logic.js';

test('Month 2–3 Curriculum (Day 31–90 · HSK 2 -> HSK 3): complete datasets, 95% exam, and 90-day progression', () => {
  assert.equal(MONTH2_DAYS_31_60.length, 30);
  assert.equal(MONTH3_DAYS_61_90.length, 30);
  assert.equal(WEEKLY_BOSS_DAYS.length, 12);

  // Every day 31..90 has 4 vocab + 5 sentences + mnemonic
  for (const d of [...MONTH2_DAYS_31_60, ...MONTH3_DAYS_61_90]) {
    assert.ok(d.vocab.length >= 4, `Day ${d.day} vocab`);
    assert.equal(d.sentences.length, 5, `Day ${d.day} sentences`);
    assert.ok(d.mnem && d.mnem.hz, `Day ${d.day} mnem`);
  }

  // Guided session & Mastery Exam work seamlessly for Day 61 (HSK 3 把 sentence)
  const s61 = buildGuidedSession(61, []);
  assert.equal(s61.day, 61);
  assert.equal(s61.meta.level, 'HSK 3');
  assert.equal(s61.toneFocus.length, 4);
  assert.equal(s61.speakItems.length, 5);

  const exam61 = buildDailyMasteryExam(61, { seed: 6161 });
  assert.equal(exam61.questions.length, 14);
  assert.equal(exam61.speakingPrompts.length, 3);

  // Blueprint day advances from Day 30 -> Day 31 when all Month-1 days pass >=95%
  const dm30 = {};
  for (let d = 1; d <= 30; d++) dm30[d] = { bestPct: 95, passed: true, passedAt: '2026-11-26' };
  assert.equal(getTodayBlueprintDay({}, { dayMastery: dm30 }), 31);

  const st90 = calc90DayStats({}, { dayMastery: { ...dm30, 31: { bestPct: 100, passed: true }, 61: { bestPct: 95, passed: true } } });
  assert.equal(st90.m1Done, 30);
  assert.equal(st90.m2Done, 1);
  assert.equal(st90.m3Done, 1);
  assert.equal(st90.total90Done, 32);

  // Month 2 Boss Exam (Day 60) spans Day 31..60 + anchor days
  const boss60 = buildWeeklyBossExam(60, { seed: 6060 });
  assert.equal(boss60.questions.length, 14);
  assert.equal(boss60.speakingPrompts.length, 3);
});
