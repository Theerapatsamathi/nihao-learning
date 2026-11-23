import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DAILY_TTS_CAP,
  DATA_PACK_SIZES,
  buildAudioPackItems,
  computeNextReminder,
  formatBytes,
  getRemainingTtsQuota,
  hashDateKey,
  nextDisplayMode,
  normalizeDisplayMode,
  normalizeSfxPack,
  parseTimeSlot,
  pickWordOfTheDay
} from '../src/features/platform/logic.js';

test('display mode normalization and cycling', () => {
  assert.equal(normalizeDisplayMode('hanzi'), 'hanzi');
  assert.equal(normalizeDisplayMode('character'), 'character');
  assert.equal(normalizeDisplayMode('invalid'), 'both');
  assert.equal(nextDisplayMode('both'), 'hanzi');
  assert.equal(nextDisplayMode('hanzi'), 'pinyin');
  assert.equal(nextDisplayMode('pinyin'), 'character');
  assert.equal(nextDisplayMode('character'), 'both');
});

test('sfx pack normalization', () => {
  assert.equal(normalizeSfxPack('soft'), 'soft');
  assert.equal(normalizeSfxPack('off'), 'off');
  assert.equal(normalizeSfxPack('unknown'), 'classic');
});

test('Word of the Day is deterministic by date and normalizes fields', () => {
  const pool = [
    { zh: '你好', py: 'nǐ hǎo', th: 'สวัสดี' },
    { zh: '谢谢', py: 'xièxie', th: 'ขอบคุณ', exZh: '谢谢你！', exPy: 'Xièxie nǐ!', exTh: 'ขอบคุณนะ!' },
    { zh: '学习', py: 'xuéxí', th: 'เรียน' }
  ];
  const a = pickWordOfTheDay(pool, '2026-11-23');
  const b = pickWordOfTheDay(pool, '2026-11-23');
  assert.deepEqual(a, b);
  assert.equal(a.dateKey, '2026-11-23');
  assert.ok(a.hanzi && a.pinyin && a.thai);
  assert.notEqual(hashDateKey('2026-11-23'), hashDateKey('2026-11-24'));
  assert.equal(pickWordOfTheDay([], '2026-11-23'), null);
});

test('reminder time parsing and next-fire calculation', () => {
  assert.deepEqual(parseTimeSlot('9:05'), { hours: 9, minutes: 5, normalized: '09:05' });
  assert.equal(parseTimeSlot('25:00'), null);
  assert.equal(parseTimeSlot('bad'), null);

  const now = new Date(2026, 10, 23, 18, 0, 0, 0);
  const next = computeNextReminder(['08:00', '20:30'], now);
  assert.equal(next.slot, '20:30');
  assert.equal(next.delayMs, 2.5 * 60 * 60 * 1000);

  const lateNow = new Date(2026, 10, 23, 21, 0, 0, 0);
  const tomorrow = computeNextReminder(['20:30'], lateNow);
  assert.equal(tomorrow.slot, '20:30');
  assert.equal(tomorrow.fireAt.getDate(), 24);
});

test('audio pack item builder deduplicates and enforces cap', () => {
  const items = buildAudioPackItems([
    { zh: '你好' },
    { zh: '你好' },
    { hanzi: '谢谢' },
    { word: '再见' },
    { zh: '  ' }
  ], 2);
  assert.deepEqual(items, ['你好', '谢谢']);
});

test('TTS daily quota resets on a new day', () => {
  assert.deepEqual(getRemainingTtsQuota({ date: '2026-11-23', count: 40 }, '2026-11-23'), {
    used: 40,
    cap: DAILY_TTS_CAP,
    remaining: DAILY_TTS_CAP - 40
  });
  assert.deepEqual(getRemainingTtsQuota({ date: '2026-11-22', count: 150 }, '2026-11-23'), {
    used: 0,
    cap: DAILY_TTS_CAP,
    remaining: DAILY_TTS_CAP
  });
});

test('formatBytes and DATA_PACK_SIZES invariants', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(512), '512 B');
  assert.equal(formatBytes(2048), '2.0 KB');
  assert.equal(formatBytes(1048576), '1.00 MB');

  const lexicon = DATA_PACK_SIZES.find((d) => d.name === 'lexicon.js');
  assert.ok(lexicon);
  assert.equal(lexicon.eager, false);
});
