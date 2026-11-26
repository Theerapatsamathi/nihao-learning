import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectPinyinTone,
  colorizePinyin,
  renderLiveScoreHud,
  renderMicWaveHtml
} from '../src/features/month1/ux-utils.js';

test('detectPinyinTone identifies tones 1-4 and neutral tone 0', () => {
  assert.equal(detectPinyinTone('mā'), 1);
  assert.equal(detectPinyinTone('má'), 2);
  assert.equal(detectPinyinTone('mǎ'), 3);
  assert.equal(detectPinyinTone('mà'), 4);
  assert.equal(detectPinyinTone('ma'), 0);
});

test('colorizePinyin wraps syllables in tone-specific spans', () => {
  const html = colorizePinyin('nǐ hǎo ma?');
  assert.ok(html.includes('ux-tone-3'));
  assert.ok(html.includes('ux-tone-0'));
  assert.ok(html.includes('nǐ'));
  assert.ok(html.includes('hǎo'));
});

test('renderLiveScoreHud switches to pass state at >=95%', () => {
  const failHud = renderLiveScoreHud({ earned: 18, total: 20, passPct: 95 });
  assert.ok(!failHud.includes('is-pass'));
  assert.ok(failHud.includes('90%'));

  const passHud = renderLiveScoreHud({ earned: 19, total: 20, passPct: 95 });
  assert.ok(passHud.includes('is-pass'));
  assert.ok(passHud.includes('95%'));
});

test('renderMicWaveHtml renders animated bars only when active', () => {
  assert.equal(renderMicWaveHtml(false), '');
  assert.ok(renderMicWaveHtml(true).includes('ux-mic-wave'));
});
