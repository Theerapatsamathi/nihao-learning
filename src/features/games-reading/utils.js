// Pure helpers and state utilities for games-reading feature group

export const EXT_NS = 'games-reading';

/**
 * Deterministic index for a given date key (YYYY-MM-DD) into an array of length `len`.
 */
export function getDailyIndex(dateKey, len) {
  if (!len || len <= 0) return 0;
  const str = String(dateKey || '2026-01-01');
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % len;
}

/**
 * Compute proportional word-level highlight timings (ms) for a sentence's tokens.
 * Punctuation gets minimal weight; Chinese characters get weight proportional to length.
 */
export function computeTokenTimings(tokens, totalDurationMs) {
  if (!Array.isArray(tokens) || tokens.length === 0) return [];
  const total = Math.max(400, Number(totalDurationMs) || 2000);
  const weights = tokens.map((t) => {
    const zh = String(t.zh || '');
    if (t.punct || /^[，。！？、；：“”‘’（）《》…—\s,.!?]+$/.test(zh)) return 0.25;
    return Math.max(1, zh.length);
  });
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  let cursor = 0;
  return tokens.map((t, idx) => {
    const dur = Math.round((weights[idx] / sum) * total);
    const start = cursor;
    cursor += dur;
    return { index: idx, start, end: cursor, duration: dur };
  });
}

/**
 * Estimate TTS duration in ms for a Chinese sentence given speech rate.
 */
export function estimateSentenceDurationMs(zhText, rate = 1.0) {
  const clean = String(zhText || '').replace(/[，。！？、；：“”‘’（）《》…—\s,.!?]/g, '');
  const chars = Math.max(1, clean.length);
  const safeRate = Math.max(0.4, Math.min(2.0, Number(rate) || 1.0));
  return Math.round((chars * 310 + 450) / safeRate);
}

/**
 * Generate a Word Sprint round (true or false hanzi-meaning pair).
 * `pool` is an array of { zh, py, th }.
 */
export function buildSprintQuestion(pool, rng = Math.random) {
  if (!Array.isArray(pool) || pool.length < 2) return null;
  const idx = Math.floor(rng() * pool.length);
  const item = pool[idx];
  const isMatch = rng() < 0.5;
  if (isMatch) {
    return {
      zh: item.zh,
      py: item.py || '',
      shownTh: item.th,
      actualTh: item.th,
      isMatch: true
    };
  }
  let wrongIdx = Math.floor(rng() * (pool.length - 1));
  if (wrongIdx >= idx) wrongIdx += 1;
  const wrong = pool[wrongIdx];
  return {
    zh: item.zh,
    py: item.py || '',
    shownTh: wrong.th,
    actualTh: item.th,
    isMatch: false
  };
}

/**
 * Compute character-level similarity (0..1) between spoken transcript and target Chinese.
 */
export function scoreChineseSpeech(spoken, target) {
  const norm = (s) =>
    String(s || '')
      .replace(/[，。！？、；：“”‘’（）《》…—\s,.!?a-zA-Z0-9]/g, '')
      .trim();
  const a = norm(spoken);
  const b = norm(target);
  if (!b) return 1;
  if (!a) return 0;
  let matched = 0;
  const bChars = [...b];
  const aChars = [...a];
  const used = new Array(aChars.length).fill(false);
  for (const ch of bChars) {
    const idx = aChars.findIndex((c, i) => !used[i] && c === ch);
    if (idx !== -1) {
      used[idx] = true;
      matched += 1;
    }
  }
  return matched / bChars.length;
}

/**
 * Safe ext getter/setter wrappers around window.NihaoCore.
 */
export function getGrExt(core) {
  const raw = core?.getExt?.(EXT_NS) || {};
  return {
    bestScores: raw.bestScores && typeof raw.bestScores === 'object' ? raw.bestScores : {},
    storiesDone: raw.storiesDone && typeof raw.storiesDone === 'object' ? raw.storiesDone : {},
    scenesDone: raw.scenesDone && typeof raw.scenesDone === 'object' ? raw.scenesDone : {},
    podcastsDone: raw.podcastsDone && typeof raw.podcastsDone === 'object' ? raw.podcastsDone : {},
    cultureSeen: Array.isArray(raw.cultureSeen) ? raw.cultureSeen : [],
    cultureXpDate: raw.cultureXpDate || ''
  };
}

export function saveBestScore(core, gameId, score) {
  const ext = getGrExt(core);
  const prev = Number(ext.bestScores[gameId] || 0);
  const isNewBest = score > prev;
  if (isNewBest) {
    core?.setExt?.(
      EXT_NS,
      (cur) => ({
        ...cur,
        bestScores: { ...(cur.bestScores || {}), [gameId]: score }
      }),
      { save: true, reason: `gr-best-${gameId}` }
    );
  }
  return { prevBest: prev, best: Math.max(prev, score), isNewBest };
}

/**
 * Star / unstar a Chinese word in core.state.progress.vocabStarred.
 */
export function isWordStarred(core, zh) {
  const list = core?.state?.progress?.vocabStarred;
  return Array.isArray(list) && list.includes(zh);
}

export function toggleStarWord(core, zh) {
  if (!core?.state?.progress || !zh) return false;
  if (!Array.isArray(core.state.progress.vocabStarred)) {
    core.state.progress.vocabStarred = [];
  }
  const list = core.state.progress.vocabStarred;
  const idx = list.indexOf(zh);
  let starred;
  if (idx >= 0) {
    list.splice(idx, 1);
    starred = false;
  } else {
    list.push(zh);
    starred = true;
  }
  core.saveProgress?.('gr-star-word');
  return starred;
}

export function esc(core, s) {
  if (core?.escapeHtml) return core.escapeHtml(String(s ?? ''));
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
