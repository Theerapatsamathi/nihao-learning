// #39 Haptics + Celebratory SFX Packs (separate AudioContext, listens to `answer` events)

import { normalizeSfxPack } from './logic.js';

export const SFX_PACK_META = {
  classic: { id: 'classic', label: 'Classic (สดใส)', desc: 'เสียงดนตรีสั้นๆ สไตล์แอปเรียนภาษา' },
  soft: { id: 'soft', label: 'Soft (นุ่มนวล)', desc: 'โทนเสียงเบา นุ่มหู เหมาะสำหรับฝึกตอนกลางคืน' },
  off: { id: 'off', label: 'ปิดเสียงเสริม', desc: 'ใช้เฉพาะเสียงพื้นฐานของระบบ' }
};

export function initHapticsSfx(core) {
  let audioCtx = null;

  function getPrefs() {
    const ext = core.getExt('platform') || {};
    return {
      hapticsEnabled: ext.hapticsEnabled !== false,
      sfxPack: normalizeSfxPack(ext.sfxPack || 'classic')
    };
  }

  function ensureAudioCtx() {
    if (audioCtx) {
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }
      return audioCtx;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    try {
      audioCtx = new Ctx();
      return audioCtx;
    } catch {
      return null;
    }
  }

  function vibrate(pattern) {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(pattern);
      } catch {
        // ignore unsupported/blocked vibration
      }
    }
  }

  function playNotes(notes, type = 'sine', peakGain = 0.08) {
    const ctx = ensureAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    for (const n of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(n.freq, now + n.start);
      gain.gain.setValueAtTime(0.0001, now + n.start);
      gain.gain.exponentialRampToValueAtTime(peakGain, now + n.start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + n.start + n.dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + n.start);
      osc.stop(now + n.start + n.dur + 0.02);
    }
  }

  function playLayeredSfx(correct, packOverride) {
    const pack = normalizeSfxPack(packOverride || getPrefs().sfxPack);
    if (pack === 'off') return;
    if (pack === 'classic') {
      if (correct) {
        playNotes([
          { freq: 587.33, start: 0.0, dur: 0.09 },
          { freq: 880.0, start: 0.07, dur: 0.14 },
          { freq: 1174.66, start: 0.14, dur: 0.18 }
        ], 'triangle', 0.075);
      } else {
        playNotes([
          { freq: 246.94, start: 0.0, dur: 0.11 },
          { freq: 196.0, start: 0.09, dur: 0.16 }
        ], 'sawtooth', 0.045);
      }
    } else if (pack === 'soft') {
      if (correct) {
        playNotes([
          { freq: 523.25, start: 0.0, dur: 0.14 },
          { freq: 659.25, start: 0.09, dur: 0.22 }
        ], 'sine', 0.055);
      } else {
        playNotes([
          { freq: 293.66, start: 0.0, dur: 0.14 },
          { freq: 261.63, start: 0.1, dur: 0.18 }
        ], 'sine', 0.04);
      }
    }
  }

  function triggerAnswerFeedback(correct) {
    const prefs = getPrefs();
    if (prefs.hapticsEnabled) {
      vibrate(correct ? [18] : [35, 45, 35]);
    }
    playLayeredSfx(correct, prefs.sfxPack);
  }

  core.on('answer', (detail) => {
    triggerAnswerFeedback(Boolean(detail && detail.correct));
  });

  return {
    getPrefs,
    setHaptics(enabled) {
      core.setExt('platform', { hapticsEnabled: Boolean(enabled) }, { save: true, reason: 'haptics-pref' });
      if (enabled) vibrate([18]);
    },
    setSfxPack(pack) {
      const valid = normalizeSfxPack(pack);
      core.setExt('platform', { sfxPack: valid }, { save: true, reason: 'sfx-pack' });
      if (valid !== 'off') playLayeredSfx(true, valid);
    },
    testOk() {
      triggerAnswerFeedback(true);
    },
    testErr() {
      triggerAnswerFeedback(false);
    },
    testVibrate() {
      vibrate([25, 40, 25]);
    },
    supportsVibrate: typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
  };
}
