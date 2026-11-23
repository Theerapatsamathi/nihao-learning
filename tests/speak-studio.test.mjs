import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROLEPLAY_SCENARIOS,
  SHADOWING_SETS,
  TONE_DRILLS
} from '../src/features/speak-studio/data.js';
import {
  scorePronunciation,
  buildCharPinyinMap,
  matchOfflineRoleplay,
  buildOfflineFeedback,
  searchOfflineTranslate,
  detectPitchYIN,
  idealToneContour,
  getDueReviewItems,
  updateReviewItem
} from '../src/features/speak-studio/scoring.js';

test('data packs meet minimum counts and structure', () => {
  assert.ok(ROLEPLAY_SCENARIOS.length >= 10, 'at least 10 roleplay scenarios');
  for (const sc of ROLEPLAY_SCENARIOS) {
    assert.equal(sc.goals.length, 3, `scenario ${sc.id} has 3 goals`);
    assert.ok(sc.offlineTurns.length >= 4, `scenario ${sc.id} has >=4 offline turns`);
  }
  assert.ok(SHADOWING_SETS.length >= 40, 'at least 40 shadowing sentences');
  assert.ok(TONE_DRILLS.length >= 10, 'tone drills available');
});

test('scorePronunciation scores exact, tone-mismatch (yellow), and missing (red)', () => {
  const map = buildCharPinyinMap([
    { hz: '妈', py: 'mā' },
    { hz: '马', py: 'mǎ' },
    { hz: '好', py: 'hǎo' },
    { hz: '你', py: 'nǐ' }
  ]);

  const exact = scorePronunciation('你好', 'Nǐ hǎo', '你好', map);
  assert.equal(exact.score, 100);
  assert.deepEqual(exact.syllables.map((s) => s.status), ['green', 'green']);

  const toneErr = scorePronunciation('妈好', 'mā hǎo', '马好', map);
  assert.equal(toneErr.syllables[0].status, 'yellow');
  assert.equal(toneErr.syllables[1].status, 'green');
  assert.ok(toneErr.score >= 70 && toneErr.score < 100);

  const missed = scorePronunciation('你好', 'Nǐ hǎo', '你', map);
  assert.equal(missed.syllables[0].status, 'green');
  assert.equal(missed.syllables[1].status, 'red');
  assert.equal(missed.score, 50);
});

test('matchOfflineRoleplay ticks goals by keywords and returns hints', () => {
  const bubbleTea = ROLEPLAY_SCENARIOS[0];
  const r1 = matchOfflineRoleplay(bubbleTea, '我要一杯珍珠奶茶，半糖少冰', [], 0);
  assert.deepEqual(r1.goalsCompleted, [0, 1]);
  assert.ok(r1.hint && r1.hint.hz && r1.hint.py && r1.hint.keywords);

  const r2 = matchOfflineRoleplay(bubbleTea, '一共多少钱？', r1.goalsCompleted, 1);
  assert.deepEqual(r2.goalsCompleted, [0, 1, 2]);
});

test('buildOfflineFeedback returns scores and items', () => {
  const sc = ROLEPLAY_SCENARIOS[0];
  const transcript = [
    { role: 'model', text: sc.opening.hz },
    { role: 'user', text: '我要一杯珍珠奶茶' },
    { role: 'user', text: '半糖少冰，多少钱？' }
  ];
  const fb = buildOfflineFeedback(sc, transcript, [0, 1, 2]);
  assert.ok(fb.fluency >= 45 && fb.accuracy >= 50 && fb.vocab >= 48);
  assert.equal(fb.items.length, 2);
});

test('searchOfflineTranslate finds Thai meaning from phrases and lexicon', () => {
  const res = searchOfflineTranslate('ไม่กินเผ็ด', [], SHADOWING_SETS);
  assert.ok(res && res.hz.includes('辣'));
});

test('detectPitchYIN detects pure sine wave frequency accurately', () => {
  const sampleRate = 16000;
  const targetHz = 220; // A3
  const buf = new Float32Array(2048);
  for (let i = 0; i < buf.length; i++) {
    buf[i] = 0.5 * Math.sin((2 * Math.PI * targetHz * i) / sampleRate);
  }
  const detected = detectPitchYIN(buf, sampleRate);
  assert.ok(Math.abs(detected - targetHz) < 3, `expected ~220Hz, got ${detected}`);

  // Silence returns 0
  assert.equal(detectPitchYIN(new Float32Array(2048), sampleRate), 0);
});

test('idealToneContour shapes tones 1-4 and 2-syllable words', () => {
  const t1 = idealToneContour([1], 10);
  assert.equal(t1[0], t1[t1.length - 1]); // flat
  const t2 = idealToneContour([2], 10);
  assert.ok(t2[t2.length - 1] > t2[0]); // rising
  const t4 = idealToneContour([4], 10);
  assert.ok(t4[0] > t4[t4.length - 1]); // falling
  const twoSyl = idealToneContour([1, 2], 12);
  assert.equal(twoSyl.length, 24);
});

test('Smart Review due filtering and streak update', () => {
  const queue = [
    { id: '1', hz: '你好', dueDate: '2026-11-22', streak: 0 },
    { id: '2', hz: '谢谢', dueDate: '2026-11-25', streak: 1 }
  ];
  const due = getDueReviewItems(queue, '2026-11-23');
  assert.equal(due.length, 1);
  assert.equal(due[0].id, '1');

  const updated = updateReviewItem(due[0], true, '2026-11-24', '2026-11-23');
  assert.equal(updated.streak, 1);
  assert.equal(updated.dueDate, '2026-11-24');
});
