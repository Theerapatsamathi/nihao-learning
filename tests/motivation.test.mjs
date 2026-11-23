import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getIsoWeekKey,
  getCoins,
  analyzeStreakRepair,
  generateOfflineLeague,
  computeHeartsState,
  computeComboBonus,
  formatNotebookCsv,
  formatNotebookAnkiTsv,
  parsePinyinSyllables,
  analyzeWeaknesses,
  buildActivityHeatmap,
  generateRuleBasedStudyPlan,
  computeMonthlyRecap,
  evaluateMilestoneCertificates,
  MAX_HEARTS,
  HEART_REGEN_MS
} from '../src/features/motivation/logic.js';

function makeTodayKeyFn(baseDateStr = '2026-11-23') {
  const base = new Date(`${baseDateStr}T12:00:00Z`);
  return (offset = 0) => {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() + offset);
    return d.toISOString().slice(0, 10);
  };
}

test('getIsoWeekKey formats ISO week consistently', () => {
  const wk = getIsoWeekKey(new Date('2026-11-23T00:00:00Z'));
  assert.match(wk, /^2026-W\d{2}$/);
});

test('getCoins matches core formula', () => {
  assert.equal(getCoins(0, 0), 50);
  assert.equal(getCoins(100, 20), 50);
  assert.equal(getCoins(100, 999), 0);
});

test('analyzeStreakRepair detects 1-day and 2-day gaps', () => {
  const todayKey = makeTodayKeyFn('2026-11-23');
  // Missed yesterday (22), active on 21 and 20
  const r1 = analyzeStreakRepair({ '2026-11-21': 2, '2026-11-20': 1 }, [], todayKey);
  assert.equal(r1.canRepair, true);
  assert.deepEqual(r1.missingDays, ['2026-11-22']);
  assert.equal(r1.cost, 40);
  assert.equal(r1.restoredStreak, 3);

  // Missed yesterday (22) and 2 days ago (21), active on 20
  const r2 = analyzeStreakRepair({ '2026-11-20': 3 }, [], todayKey);
  assert.equal(r2.canRepair, true);
  assert.deepEqual(r2.missingDays, ['2026-11-21', '2026-11-22']);
  assert.equal(r2.cost, 80);
  assert.equal(r2.restoredStreak, 3);

  // Active yesterday -> no repair needed
  const r3 = analyzeStreakRepair({ '2026-11-22': 1 }, [], todayKey);
  assert.equal(r3.canRepair, false);
});

test('generateOfflineLeague is deterministic and includes user ranked properly', () => {
  const a = generateOfflineLeague('2026-W48', 2, 250, 'Tester');
  const b = generateOfflineLeague('2026-W48', 2, 250, 'Tester');
  assert.equal(a.length, 30);
  assert.deepEqual(a, b);
  const me = a.find((m) => m.isMe);
  assert.ok(me);
  assert.equal(me.xp, 250);
  assert.equal(a[0].rank, 1);
  assert.ok(a[0].xp >= a[1].xp);
});

test('computeHeartsState regenerates 1 heart per 30 minutes', () => {
  const t0 = 1_700_000_000_000;
  const s1 = computeHeartsState({ enabled: true, count: 2, lastLostAt: t0 }, t0 + HEART_REGEN_MS * 2 + 5000);
  assert.equal(s1.count, 4);
  assert.ok(s1.nextRegenMs > 0 && s1.nextRegenMs <= HEART_REGEN_MS);

  const s2 = computeHeartsState({ enabled: true, count: 2, lastLostAt: t0 }, t0 + HEART_REGEN_MS * 5);
  assert.equal(s2.count, MAX_HEARTS);
  assert.equal(s2.nextRegenMs, 0);
});

test('computeComboBonus applies x2 at 5 and x3 at 10', () => {
  assert.equal(computeComboBonus(4).multiplier, 1);
  assert.equal(computeComboBonus(5).multiplier, 2);
  assert.equal(computeComboBonus(10).multiplier, 3);
});

test('formatNotebookCsv and formatNotebookAnkiTsv escape properly', () => {
  const items = [{ zh: '你好', py: 'nǐ hǎo', th: 'สวัสดี, ยินดี', note: 'คำทักทาย' }];
  const csv = formatNotebookCsv(items);
  assert.ok(csv.includes('"สวัสดี, ยินดี"'));
  const tsv = formatNotebookAnkiTsv(items);
  assert.ok(tsv.includes('你好 (nǐ hǎo)\tสวัสดี, ยินดี — โน้ต: คำทักทาย\tnihao-notebook'));
});

test('parsePinyinSyllables and analyzeWeaknesses extract tones and initials', () => {
  const syls = parsePinyinSyllables('zhōng guó');
  assert.equal(syls.length, 2);
  assert.equal(syls[0].initial, 'zh');
  assert.equal(syls[0].tone, 1);
  assert.equal(syls[1].initial, 'g');
  assert.equal(syls[1].tone, 2);

  const w = analyzeWeaknesses([{ pinyin: 'zhōng guó', misses: 2 }]);
  assert.equal(w.toneCounts[1], 2);
  assert.equal(w.toneCounts[2], 2);
  assert.equal(w.topTonePairs[0].pair, '1-2');
});

test('buildActivityHeatmap builds 84 days for 12 weeks', () => {
  const todayKey = makeTodayKeyFn('2026-11-23');
  const cells = buildActivityHeatmap({ '2026-11-23': 6 }, ['2026-11-22'], todayKey, 12);
  assert.equal(cells.length, 84);
  assert.equal(cells[cells.length - 1].level, 3);
  assert.equal(cells[cells.length - 2].isFrozen, true);
});

test('generateRuleBasedStudyPlan, computeMonthlyRecap, evaluateMilestoneCertificates work', () => {
  const progress = {
    mistakes: [{ id: 'm1', zh: '谢谢', misses: 3 }],
    vocabMistakes: [],
    vocabSrs: { w1: { due: '2026-11-20' } },
    activity: { '2026-11-23': 4 },
    vocabLearned: { w1: '2026-11-23' }
  };
  const stats = { streak: 30, level: 4, xp: 800, skills: [{ id: 'pron', name: 'พยัญชนะ', pct: 20, tab: 'initials' }] };

  const plan = generateRuleBasedStudyPlan(progress, stats, '2026-11-23');
  assert.ok(plan.length >= 3);

  const recap = computeMonthlyRecap(progress, stats, new Map(), new Date('2026-11-23T12:00:00Z'));
  assert.equal(recap.wordsThisMonth, 1);
  assert.equal(recap.activeDays, 1);

  const certs = evaluateMilestoneCertificates(progress, stats, {});
  assert.equal(certs.find((c) => c.id === 'streak-30').unlocked, true);
  assert.equal(certs.find((c) => c.id === 'words-1000').unlocked, false);
});
