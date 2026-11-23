// Pure, testable logic for lesson-path (no DOM or window dependencies)

/**
 * Deterministic 32-bit FNV-1a hash from string.
 * @param {string} str
 * @returns {number}
 */
export function hashString(str) {
  let h = 2166136261 >>> 0;
  const s = String(str ?? '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/**
 * Seeded PRNG (Mulberry32).
 * @param {number} seed
 * @returns {() => number}
 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministic Fisher-Yates shuffle.
 * @template T
 * @param {readonly T[]} arr
 * @param {string|number} seed
 * @returns {T[]}
 */
export function seededShuffle(arr, seed) {
  const out = Array.from(arr);
  const rng = mulberry32(typeof seed === 'number' ? seed : hashString(seed));
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

/**
 * Deterministically pick n items from array.
 * @template T
 * @param {readonly T[]} arr
 * @param {number} n
 * @param {string|number} seed
 * @returns {T[]}
 */
export function seededPick(arr, n, seed) {
  return seededShuffle(arr, seed).slice(0, Math.max(0, n));
}

// --- Pinyin normalization & dictation grading ---

const TONE_VOWEL_MAP = {
  a: ['a', 'ā', 'á', 'ǎ', 'à', 'a'],
  e: ['e', 'ē', 'é', 'ě', 'è', 'e'],
  i: ['i', 'ī', 'í', 'ǐ', 'ì', 'i'],
  o: ['o', 'ō', 'ó', 'ǒ', 'ò', 'o'],
  u: ['u', 'ū', 'ú', 'ǔ', 'ù', 'u'],
  ü: ['ü', 'ǖ', 'ǘ', 'ǚ', 'ǜ', 'ü']
};

const MARKED_TO_PLAIN = {
  ā: 'a', á: 'a', ǎ: 'a', à: 'a',
  ē: 'e', é: 'e', ě: 'e', è: 'e',
  ī: 'i', í: 'i', ǐ: 'i', ì: 'i',
  ō: 'o', ó: 'o', ǒ: 'o', ò: 'o',
  ū: 'u', ú: 'u', ǔ: 'u', ù: 'u',
  ǖ: 'v', ǘ: 'v', ǚ: 'v', ǜ: 'v', ü: 'v'
};

const MARKED_TO_TONE = {
  ā: 1, á: 2, ǎ: 3, à: 4,
  ē: 1, é: 2, ě: 3, è: 4,
  ī: 1, í: 2, ǐ: 3, ì: 4,
  ō: 1, ó: 2, ǒ: 3, ò: 4,
  ū: 1, ú: 2, ǔ: 3, ù: 4,
  ǖ: 1, ǘ: 2, ǚ: 3, ǜ: 4
};

/**
 * Strip tone marks and convert ü -> v for toneless comparison.
 * @param {string} py
 * @returns {string}
 */
export function stripPinyinTones(py) {
  return String(py || '')
    .toLowerCase()
    .replace(/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü]/g, ch => MARKED_TO_PLAIN[ch] || ch)
    .replace(/u:/g, 'v')
    .replace(/[1-5]/g, '')
    .replace(/[^a-z]/g, '');
}

/**
 * Apply tone number (1-5) to a single pinyin syllable.
 * @param {string} syllable
 * @param {number} tone
 * @returns {string}
 */
export function applyToneToSyllable(syllable, tone) {
  const s = syllable.toLowerCase().replace(/u:/g, 'ü').replace(/v/g, 'ü');
  if (!tone || tone === 5 || tone < 1 || tone > 4) return s;
  if (s.includes('a')) return s.replace('a', TONE_VOWEL_MAP.a[tone]);
  if (s.includes('e')) return s.replace('e', TONE_VOWEL_MAP.e[tone]);
  if (s.includes('ou')) return s.replace('o', TONE_VOWEL_MAP.o[tone]);
  // Otherwise mark the last vowel (handles iu -> iū, ui -> uī, etc.)
  for (let i = s.length - 1; i >= 0; i--) {
    const ch = s[i];
    if (TONE_VOWEL_MAP[ch]) {
      return s.slice(0, i) + TONE_VOWEL_MAP[ch][tone] + s.slice(i + 1);
    }
  }
  return s;
}

/**
 * Convert numbered pinyin like "ni3hao3" or "ni3 hao3" to tone-marked "nǐ hǎo".
 * @param {string} input
 * @returns {string}
 */
export function numberedToTonePinyin(input) {
  const str = String(input || '').trim();
  if (!str) return '';
  return str.replace(/([a-zA-ZüÜ:]+)([1-5])/g, (_, syl, num) => {
    return applyToneToSyllable(syl, Number(num));
  });
}

/**
 * Normalize tone-marked or numbered pinyin into a canonical comparable string
 * (lowercase, tone-marked, punctuation & spaces removed, ü unified).
 * @param {string} py
 * @returns {string}
 */
export function normalizePinyin(py) {
  const converted = numberedToTonePinyin(String(py || '').toLowerCase());
  return converted
    .replace(/u:/g, 'ü')
    .replace(/v/g, 'ü')
    .replace(/[^a-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü]/g, '');
}

/**
 * Normalize Chinese hanzi by stripping punctuation and whitespace.
 * @param {string} hz
 * @returns {string}
 */
export function normalizeHanzi(hz) {
  return String(hz || '')
    .replace(/[\s，。！？、；：“”‘’（）().,!?;:'"~—\-…·]/g, '')
    .trim();
}

/**
 * Check if a string contains any Chinese hanzi characters.
 * @param {string} s
 * @returns {boolean}
 */
export function hasHanzi(s) {
  return /[\u4e00-\u9fff]/.test(String(s || ''));
}

/**
 * Check if a pinyin string contains explicit tone marks or tone numbers.
 * @param {string} s
 * @returns {boolean}
 */
export function hasToneInfo(s) {
  return /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]|[a-zA-Z][1-5]/.test(String(s || ''));
}

/**
 * Grade a dictation or type-pinyin answer.
 * Accepts:
 *  - Exact hanzi match -> { status: 'exact', score: 1, mode: 'hanzi' }
 *  - Exact tone-marked or numbered pinyin match -> { status: 'exact', score: 1, mode: 'pinyin' }
 *  - Toneless pinyin match (no tones typed or wrong tones) -> { status: 'partial', score: 0.7, mode: 'pinyin-toneless' }
 *  - Otherwise -> { status: 'wrong', score: 0, mode: 'none' }
 *
 * @param {string} userInput
 * @param {{ hz: string, py: string }} target
 * @returns {{ status: 'exact'|'partial'|'wrong', score: number, mode: string }}
 */
export function gradeDictationAnswer(userInput, target) {
  const raw = String(userInput || '').trim();
  if (!raw || !target) return { status: 'wrong', score: 0, mode: 'none' };

  if (hasHanzi(raw)) {
    const uHz = normalizeHanzi(raw);
    const tHz = normalizeHanzi(target.hz);
    if (uHz && uHz === tHz) {
      return { status: 'exact', score: 1, mode: 'hanzi' };
    }
    return { status: 'wrong', score: 0, mode: 'hanzi' };
  }

  const uNorm = normalizePinyin(raw);
  const tNorm = normalizePinyin(target.py);
  if (uNorm && uNorm === tNorm) {
    return { status: 'exact', score: 1, mode: 'pinyin' };
  }

  const uPlain = stripPinyinTones(raw);
  const tPlain = stripPinyinTones(target.py);
  if (uPlain && uPlain === tPlain) {
    return {
      status: 'partial',
      score: 0.7,
      mode: hasToneInfo(raw) ? 'pinyin-wrong-tone' : 'pinyin-toneless'
    };
  }

  return { status: 'wrong', score: 0, mode: 'pinyin' };
}

// --- Stars & XP ---

/**
 * Calculate 0-3 stars from accuracy ratio (0..1).
 * @param {number} accuracy
 * @returns {0|1|2|3}
 */
export function calcStars(accuracy) {
  if (accuracy >= 0.9) return 3;
  if (accuracy >= 0.75) return 2;
  if (accuracy >= 0.5) return 1;
  return 0;
}

/**
 * Calculate modest XP (10..50) for a completed lesson or checkpoint.
 * @param {number} accuracy
 * @param {boolean} isCheckpoint
 * @returns {number}
 */
export function calcLessonXp(accuracy, isCheckpoint = false) {
  const base = isCheckpoint ? 30 : 15;
  const bonus = Math.round(Math.max(0, Math.min(1, accuracy)) * (isCheckpoint ? 20 : 15));
  return Math.max(10, Math.min(50, base + bonus));
}

// --- Goal ordering & unlocking ---

export const GOAL_UNIT_PRIORITY = {
  travel: ['u1-greetings', 'u4-food', 'u7-transport', 'u6-shopping', 'u2-numbers', 'u5-time', 'u9-weather', 'u3-family', 'u8-hobbies', 'u10-work'],
  work: ['u1-greetings', 'u10-work', 'u5-time', 'u2-numbers', 'u7-transport', 'u6-shopping', 'u4-food', 'u3-family', 'u8-hobbies', 'u9-weather'],
  hsk: ['u1-greetings', 'u2-numbers', 'u3-family', 'u4-food', 'u5-time', 'u6-shopping', 'u7-transport', 'u8-hobbies', 'u9-weather', 'u10-work'],
  culture: ['u1-greetings', 'u3-family', 'u4-food', 'u8-hobbies', 'u9-weather', 'u5-time', 'u2-numbers', 'u6-shopping', 'u7-transport', 'u10-work'],
  family: ['u1-greetings', 'u3-family', 'u2-numbers', 'u4-food', 'u8-hobbies', 'u5-time', 'u9-weather', 'u6-shopping', 'u7-transport', 'u10-work']
};

/**
 * Check whether unit at index `unitIdx` is unlocked.
 * Unit 0 is always unlocked. Higher units unlock when:
 *  - placement unlockedUpTo >= unitIdx
 *  - OR previous unit's checkpoint was passed
 *  - OR all lessons in previous unit have >= 1 star
 * @param {number} unitIdx
 * @param {Array<{id: string, lessons: Array<{id: string}>}>} units
 * @param {object} progress
 * @returns {boolean}
 */
export function isUnitUnlocked(unitIdx, units, progress = {}) {
  if (unitIdx <= 0) return true;
  const unlockedUpTo = Number(progress?.unlockedUpTo || 0);
  if (unitIdx <= unlockedUpTo) return true;

  const prev = units[unitIdx - 1];
  if (!prev) return false;
  if (progress?.checkpoints?.[prev.id]?.passed) return true;

  const lessonStars = progress?.lessonStars || {};
  return prev.lessons.length > 0 && prev.lessons.every(l => (lessonStars[l.id] || 0) >= 1);
}

/**
 * Recommend the next lesson or unit based on user's goal and current progress.
 * @param {Array<{id: string, lessons: Array<{id: string}>}>} units
 * @param {object} progress
 * @param {string} goal
 * @returns {{ unitId: string, lessonId: string|null, isCheckpoint: boolean }}
 */
export function getNextRecommendation(units, progress = {}, goal = 'hsk') {
  const priority = GOAL_UNIT_PRIORITY[goal] || GOAL_UNIT_PRIORITY.hsk;
  const byId = new Map(units.map((u, idx) => [u.id, { unit: u, idx }]));
  const lessonStars = progress?.lessonStars || {};

  // First look among unlocked units in goal-priority order for an uncompleted lesson
  for (const uid of priority) {
    const entry = byId.get(uid);
    if (!entry) continue;
    if (!isUnitUnlocked(entry.idx, units, progress)) continue;
    const nextLesson = entry.unit.lessons.find(l => (lessonStars[l.id] || 0) === 0);
    if (nextLesson) {
      return { unitId: uid, lessonId: nextLesson.id, isCheckpoint: false };
    }
    if (!progress?.checkpoints?.[uid]?.passed) {
      return { unitId: uid, lessonId: null, isCheckpoint: true };
    }
  }

  // Fallback: first lesson of unit 0
  return {
    unitId: units[0]?.id || 'u1-greetings',
    lessonId: units[0]?.lessons?.[0]?.id || null,
    isCheckpoint: false
  };
}

// --- Adaptive Placement Test ---

/**
 * Create initial adaptive placement state.
 * @param {number} totalQuestions
 */
export function createPlacementState(totalQuestions = 10) {
  return {
    difficulty: 2, // 1..5
    step: 0,
    totalQuestions,
    askedIds: [],
    history: [] // { id, difficulty, correct }
  };
}

/**
 * Pick next question matching current difficulty (or nearest available).
 * @param {object} pState
 * @param {Array<{id: string, difficulty: number}>} bank
 */
export function pickNextPlacementQuestion(pState, bank) {
  const asked = new Set(pState.askedIds);
  const remaining = bank.filter(q => !asked.has(q.id));
  if (!remaining.length) return null;

  // Sort by distance from target difficulty, deterministic tie-break by id
  remaining.sort((a, b) => {
    const da = Math.abs(a.difficulty - pState.difficulty);
    const db = Math.abs(b.difficulty - pState.difficulty);
    if (da !== db) return da - db;
    return a.id.localeCompare(b.id);
  });
  return remaining[0];
}

/**
 * Record an answer and adapt difficulty up/down.
 * @param {object} pState
 * @param {{id: string, difficulty: number}} question
 * @param {boolean} correct
 */
export function submitPlacementAnswer(pState, question, correct) {
  const nextDiff = correct
    ? Math.min(5, pState.difficulty + 1)
    : Math.max(1, pState.difficulty - 1);

  return {
    ...pState,
    difficulty: nextDiff,
    step: pState.step + 1,
    askedIds: [...pState.askedIds, question.id],
    history: [...pState.history, { id: question.id, difficulty: question.difficulty, correct }]
  };
}

/**
 * Compute recommended starting unit index (0..unitCount-1) and CEFR/HSK label.
 * @param {object} pState
 * @param {number} unitCount
 */
export function computePlacementResult(pState, unitCount = 10) {
  const hist = pState.history || [];
  if (!hist.length) {
    return { recommendedUnitIdx: 0, scorePct: 0, levelLabel: 'HSK 1 เริ่มต้น', weightedScore: 0 };
  }
  const correctCount = hist.filter(h => h.correct).length;
  const scorePct = Math.round((correctCount / hist.length) * 100);

  // Weighted mastery: higher difficulty correct answers contribute more
  let earned = 0;
  let maxPossible = 0;
  for (const h of hist) {
    maxPossible += h.difficulty;
    if (h.correct) earned += h.difficulty;
  }
  const weightedRatio = maxPossible > 0 ? earned / maxPossible : 0;
  const finalAbility = (weightedRatio * 0.65) + ((pState.difficulty - 1) / 4) * 0.35;

  // Map ability 0..1 to unit index 0..(unitCount - 2) so user still has units to learn
  const maxStart = Math.max(0, unitCount - 2);
  let recommendedUnitIdx = Math.floor(finalAbility * (maxStart + 1));
  if (scorePct < 30) recommendedUnitIdx = 0;
  recommendedUnitIdx = Math.max(0, Math.min(maxStart, recommendedUnitIdx));

  let levelLabel = 'HSK 1 เริ่มต้น';
  if (recommendedUnitIdx >= 7) levelLabel = 'HSK 2 ตอนปลาย';
  else if (recommendedUnitIdx >= 5) levelLabel = 'HSK 2 ตอนต้น';
  else if (recommendedUnitIdx >= 3) levelLabel = 'HSK 1 ตอนปลาย';
  else if (recommendedUnitIdx >= 1) levelLabel = 'HSK 1 พื้นฐาน';

  return {
    recommendedUnitIdx,
    scorePct,
    levelLabel,
    weightedScore: Math.round(finalAbility * 100)
  };
}
