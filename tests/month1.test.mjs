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
