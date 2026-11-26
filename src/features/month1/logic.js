// Pure testable logic for Month-1..3 (Day 1–90: 0 -> HSK 3) & 95% Daily Mastery Gate
import { TONE_PAIRS, MONTH1_DAYS_15_30, HANZI_MNEMONICS, SURVIVAL_50 } from './data-month1.js';
import { DAYS_31_90, getAdvancedDayData } from './data-months23.js';
import { scorePronunciation, splitPinyinSyllables, stripToneAndNumber, normalizeChinese } from '../speak-studio/scoring.js';

export const MAX_CURRICULUM_DAY = 90;
export const DAILY_MASTERY_PASS_PCT = 95;
export const EXAM_QUIZ_COUNT = 14;
export const EXAM_SPEAK_COUNT = 3;
export const EXAM_SPEAK_MAX_PER_ITEM = 2;
export const EXAM_TOTAL_POINTS = EXAM_QUIZ_COUNT + EXAM_SPEAK_COUNT * EXAM_SPEAK_MAX_PER_ITEM; // 20 points (19/20 = 95%)

export function normalizeIntensity(v) {
  const n = Number(v);
  if (n >= 10) return 10;
  if (n >= 5) return 5;
  return 1;
}

export function getIntensityConfig(intensity = 1) {
  const lv = normalizeIntensity(intensity);
  if (lv === 10) {
    return { level: 10, label: '💀 10x โหดจัด (Bootcamp)', speakCount: 30, toneCount: 12, extraQuiz: 30, speakExamCount: 10, hidePinyin: true, xpMult: 3 };
  }
  if (lv === 5) {
    return { level: 5, label: '🔥 5x เข้มข้น', speakCount: 18, toneCount: 8, extraQuiz: 16, speakExamCount: 6, hidePinyin: false, xpMult: 2 };
  }
  return { level: 1, label: '1x ปกติ', speakCount: 5, toneCount: 4, extraQuiz: 0, speakExamCount: 3, hidePinyin: false, xpMult: 1 };
}

export function stripTones(str) {
  return String(str || '')
    .replace(/[üǖǘǚǜ]/gi, 'v')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function seededRng(seed = 1) {
  let s = (Number(seed) || 1) >>> 0;
  if (s === 0) s = 123456789;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function shuffleWithRng(arr, rng) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Checks whether a specific day (1..30) has met the strict >= 95% Daily Mastery requirement.
 * When `ext.dayMastery` is initialized (live app), strictly requires `bestPct >= 95 && passed === true`.
 * Falls back to legacy `dayScores` / `doneDays` only when `ext.dayMastery` is undefined (legacy fixtures).
 */
export function isDayMastered(dayNum, progress = {}, ext = {}) {
  const d = Number(dayNum) || 1;
  if (ext && ext.dayMastery && typeof ext.dayMastery === 'object') {
    const rec = ext.dayMastery[d] || ext.dayMastery[String(d)];
    if (rec && Number(rec.bestPct || 0) >= DAILY_MASTERY_PASS_PCT && Boolean(rec.passed)) {
      return true;
    }
    return false;
  }
  // Legacy fallback when dayMastery namespace is not active
  if (d >= 1 && d <= 14) {
    return Number((progress.dayScores || {})[d] || 0) >= 8;
  }
  const done15_30 = Array.isArray(ext?.doneDays) ? ext.doneDays : [];
  return done15_30.includes(d);
}

export function getDayMasteryRecord(dayNum, ext = {}) {
  const map = ext?.dayMastery && typeof ext.dayMastery === 'object' ? ext.dayMastery : {};
  const rec = map[dayNum] || map[String(dayNum)] || null;
  if (!rec) {
    return { bestPct: 0, lastPct: null, attempts: 0, passed: false };
  }
  const bestPct = Number(rec.bestPct) || 0;
  return {
    bestPct,
    lastPct: rec.lastPct !== undefined && rec.lastPct !== null ? Number(rec.lastPct) : bestPct,
    attempts: Number(rec.attempts) || 0,
    passed: bestPct >= DAILY_MASTERY_PASS_PCT && Boolean(rec.passed),
    quizScore: rec.quizScore ?? null,
    speakScore: rec.speakScore ?? null,
    passedAt: rec.passedAt || null,
    updatedAt: rec.updatedAt || 0
  };
}

export function getTodayBlueprintDay(progress = {}, ext = {}) {
  const maxD = (ext && ext.dayMastery && typeof ext.dayMastery === 'object') ? MAX_CURRICULUM_DAY : 30;
  for (let d = 1; d <= maxD; d++) {
    if (!isDayMastered(d, progress, ext)) return d;
  }
  return maxD;
}

export function calc90DayStats(progress = {}, ext = {}) {
  let m1Done = 0;
  let m2Done = 0;
  let m3Done = 0;
  for (let d = 1; d <= 90; d++) {
    if (!isDayMastered(d, progress, ext)) continue;
    if (d <= 30) m1Done++;
    else if (d <= 60) m2Done++;
    else m3Done++;
  }
  const total90Done = m1Done + m2Done + m3Done;
  return {
    m1Done,
    m2Done,
    m3Done,
    total90Done,
    pct90: Math.min(100, Math.round((total90Done / 90) * 100))
  };
}

export function calcMonth1Stats(progress = {}, ext = {}) {
  let totalDaysDone = 0;
  for (let d = 1; d <= 30; d++) {
    if (isDayMastered(d, progress, ext)) totalDaysDone++;
  }
  const tonePairsDone = Array.isArray(ext.tonePairsDone) ? ext.tonePairsDone.length : 0;
  const mnemonicsDone = Array.isArray(ext.mnemonicsDone) ? ext.mnemonicsDone.length : 0;
  const survivalDone = Array.isArray(ext.survivalDone) ? ext.survivalDone.length : 0;
  const pct = Math.min(100, Math.round((totalDaysDone / 30) * 100));
  return {
    totalDaysDone,
    pct,
    tonePairsDone,
    tonePairsTotal: TONE_PAIRS.length,
    mnemonicsDone,
    mnemonicsTotal: HANZI_MNEMONICS.length,
    survivalDone,
    survivalTotal: SURVIVAL_50.length
  };
}

export function buildGuidedSession(dayNum, mistakes = [], { intensity = 1 } = {}) {
  const safeDay = Math.max(1, Math.min(MAX_CURRICULUM_DAY, Number(dayNum) || 1));
  const icfg = getIntensityConfig(intensity);
  const advDay = safeDay >= 31 ? getAdvancedDayData(safeDay) : null;
  const prevAdvDay = safeDay >= 32 ? getAdvancedDayData(safeDay - 1) : null;

  // Step 1: 3 warm-up recall items (mistakes first, then previous-day items)
  const warmup = [];
  const seenHz = new Set();
  for (const m of (Array.isArray(mistakes) ? mistakes : [])) {
    if (warmup.length >= 3) break;
    const hz = String(m?.hanzi || m?.hz || '').trim();
    const py = String(m?.pinyin || m?.py || '').trim();
    const th = String(m?.meaning || m?.th || '').trim();
    if (hz && th && !seenHz.has(hz)) {
      seenHz.add(hz);
      warmup.push({ hz, py, th });
    }
  }
  if (prevAdvDay && Array.isArray(prevAdvDay.sentences)) {
    for (const s of prevAdvDay.sentences) {
      if (warmup.length >= 3) break;
      if (!seenHz.has(s.hz)) {
        seenHz.add(s.hz);
        warmup.push({ hz: s.hz, py: s.py, th: s.th });
      }
    }
  }
  let idx = 0;
  while (warmup.length < 3) {
    const poolIdx = safeDay > 1
      ? ((safeDay - 2) * 5 + idx) % SURVIVAL_50.length
      : (safeDay * 3 + idx) % SURVIVAL_50.length;
    const s = SURVIVAL_50[poolIdx];
    if (!seenHz.has(s.hz)) {
      seenHz.add(s.hz);
      warmup.push({ hz: s.hz, py: s.py, th: s.th });
    }
    idx++;
    if (idx > 60) break;
  }

  if (advDay) {
    const nextAdv = getAdvancedDayData(safeDay < 90 ? safeDay + 1 : 31);
    const toneFocus = advDay.vocab.slice(0, 4).map((v, i) => ({
      id: `d${safeDay}-v${i}`,
      label: `${advDay.level} · คำสำคัญ`,
      hz: v.hz,
      py: v.py,
      th: v.th,
      tip: v.tip || advDay.focus
    }));
    const speakItems = advDay.sentences.slice(0, 5);
    const mnemFocus = [advDay.mnem, nextAdv ? nextAdv.mnem : HANZI_MNEMONICS[0]].filter(Boolean);
    const dayMeta = {
      day: safeDay,
      month: advDay.month,
      week: advDay.week,
      level: advDay.level,
      title: advDay.title,
      focus: advDay.focus
    };
    return { day: safeDay, meta: dayMeta, warmup, toneFocus, speakItems, mnemFocus };
  }

  // Step 2: Tone-pair focus items for today (Month 1, scaled by intensity)
  const pairStart = ((safeDay - 1) * 2) % TONE_PAIRS.length;
  const toneFocus = [];
  for (let i = 0; i < icfg.toneCount; i++) {
    toneFocus.push(TONE_PAIRS[(pairStart + i) % TONE_PAIRS.length]);
  }

  // Step 3: Survival sentences to shadow/speak (Month 1, scaled by intensity)
  const survStart = ((safeDay - 1) * 5) % SURVIVAL_50.length;
  const speakItems = [];
  for (let i = 0; i < icfg.speakCount; i++) {
    speakItems.push(SURVIVAL_50[(survStart + i) % SURVIVAL_50.length]);
  }

  // Mnemonic characters for today (2 chars per day across 64 chars)
  const mnemStart = ((safeDay - 1) * 2) % HANZI_MNEMONICS.length;
  const mnemFocus = [
    HANZI_MNEMONICS[mnemStart % HANZI_MNEMONICS.length],
    HANZI_MNEMONICS[(mnemStart + 1) % HANZI_MNEMONICS.length]
  ];

  const dayMeta = safeDay >= 15
    ? MONTH1_DAYS_15_30.find(d => d.day === safeDay) || MONTH1_DAYS_15_30[0]
    : { day: safeDay, week: safeDay <= 7 ? 1 : 2, title: `แผนพื้นฐาน Day ${safeDay}`, focus: 'พินอิน + วรรณยุกต์ + ฝึกพูดและสอบวัดผล ≥95%' };

  return { day: safeDay, meta: dayMeta, warmup, toneFocus, speakItems, mnemFocus };
}

// Core starter characters whose Pinyin gradually fades in the second half of Month 1 (Day 15–30)
const TIER1_BASIC_CHARS = new Set(['我', '你', '好', '人', '大', '小', '一', '不', '口', '水', '火', '山']);
const TIER2_CORE_CHARS = new Set([
  ...TIER1_BASIC_CHARS,
  '是', '的', '了', '吗', '什', '么', '谢', '再', '见', '吃', '喝', '茶', '米', '钱', '买', '去', '来', '回', '中', '国', '天', '上', '下'
]);

/**
 * Formats Pinyin scaffolding according to the day's difficulty tier:
 * - Day 1–14: Full Pinyin shown on all characters/words (HSK 1–2 beginner standard).
 * - Day 15–22: Masks Pinyin only on Tier-1 ultra-basic characters; keeps Pinyin on everything else.
 * - Day 23–30: Masks Pinyin on Tier-1 & Tier-2 core characters; keeps Pinyin on harder/new words.
 */
export function getProgressivePinyin(hzStr, pyStr, dayNum = 1) {
  const safeDay = Math.max(1, Math.min(MAX_CURRICULUM_DAY, Number(dayNum) || 1));
  const cleanPy = String(pyStr || '').trim();
  if (!cleanPy) return '';
  if (safeDay <= 14) return cleanPy;

  const maskSet = safeDay <= 22 ? TIER1_BASIC_CHARS : TIER2_CORE_CHARS;
  const chars = [...normalizeChinese(hzStr)];
  const syls = splitPinyinSyllables(cleanPy);
  if (!chars.length || chars.length !== syls.length) {
    // If all characters in a short word belong to maskSet, hide; otherwise keep full pinyin for clarity
    if (chars.length > 0 && chars.every(c => maskSet.has(c))) return '';
    return cleanPy;
  }
  const masked = syls.map((syl, i) => (maskSet.has(chars[i]) ? '••' : syl));
  if (masked.every(x => x === '••')) return '';
  return masked.join(' ');
}

export function formatHzWithProgressivePinyin(hzStr, pyStr, dayNum = 1) {
  const pyHint = getProgressivePinyin(hzStr, pyStr, dayNum);
  return pyHint ? `${hzStr} (${pyHint})` : hzStr;
}

/**
 * Splits a Chinese sentence into 3-6 meaningful tiles with progressive Pinyin hints for word-order questions.
 */
export function tokenizeSentenceForOrder(hzStr, pyStr = '', dayNum = 1) {
  const clean = String(hzStr || '')
    .replace(/…/g, '')
    .replace(/\s*\/\s*.*/, '')
    .replace(/[。！？!?.,，\s]/g, '')
    .trim();
  const chars = [...clean];
  const syls = splitPinyinSyllables(String(pyStr || '').replace(/\s*\/\s*.*/, ''));
  const hasExactSylMap = chars.length > 0 && syls.length === chars.length;

  const maskSet = dayNum <= 14 ? null : (dayNum <= 22 ? TIER1_BASIC_CHARS : TIER2_CORE_CHARS);
  const buildTileObj = (sliceChars, startIdx) => {
    const text = sliceChars.join('');
    if (!hasExactSylMap) return { hz: text, py: dayNum <= 14 ? pyStr : '' };
    const sliceSyls = syls.slice(startIdx, startIdx + sliceChars.length);
    if (!maskSet) {
      return { hz: text, py: sliceSyls.join('') };
    }
    if (sliceChars.every(c => maskSet.has(c))) {
      return { hz: text, py: '' };
    }
    return { hz: text, py: sliceSyls.join('') };
  };

  if (chars.length <= 4) {
    return chars.map((ch, idx) => buildTileObj([ch], idx));
  }
  const tiles = [];
  let i = 0;
  while (i < chars.length) {
    if (chars.length - i > 4 && tiles.length < 4) {
      tiles.push(buildTileObj(chars.slice(i, i + 2), i));
      i += 2;
    } else {
      tiles.push(buildTileObj([chars[i]], i));
      i += 1;
    }
  }
  return tiles;
}

/**
 * Builds a complete, randomized 20-point Daily Mastery Exam for Day 1..30:
 * - Progressive Pinyin scaffolding:
 *   * Day 1–14: Full Pinyin on reading, recall, and sentence-order tiles (HSK 1 standard).
 *   * Day 15–30: Gradually hides Pinyin only on basic mastered characters while keeping Pinyin on new/longer words.
 * - 14 objective questions (1 pt each = 14 pts)
 * - 3 real speaking prompts WITH Pinyin + 1 reference audio replay allowed per prompt (2 pts each = 6 pts)
 * Passing requires >= 95% (>= 19.0 / 20 points).
 */
export function buildDailyMasteryExam(dayNum, { planDayObj = null, mistakes = [], seed = Date.now(), intensity = 1 } = {}) {
  const safeDay = Math.max(1, Math.min(MAX_CURRICULUM_DAY, Number(dayNum) || 1));
  const icfg = getIntensityConfig(intensity);
  const rng = seededRng(seed + safeDay * 97 + icfg.level * 31);
  const session = buildGuidedSession(safeDay, mistakes, { intensity: icfg.level });
  const questions = [];

  const pickDistractors = (pool, excludeKey, getKey, count = 3) => {
    const candidates = pool.filter(x => getKey(x) !== excludeKey);
    const shuffled = shuffleWithRng(candidates, rng);
    const out = [];
    const used = new Set([excludeKey]);
    for (const item of shuffled) {
      const k = getKey(item);
      if (!k || used.has(k)) continue;
      used.add(k);
      out.push(item);
      if (out.length >= count) break;
    }
    return out;
  };

  // 1) 3 Active Recall questions (with progressive Pinyin + audio support)
  for (let i = 0; i < 3; i++) {
    const target = session.warmup[i % session.warmup.length];
    const distractors = pickDistractors(SURVIVAL_50, target.th, x => x.th, 3);
    const opts = shuffleWithRng([target.th, ...distractors.map(d => d.th)], rng);
    const displayTerm = formatHzWithProgressivePinyin(target.hz, target.py, safeDay);
    questions.push({
      id: `recall-${i}`,
      kind: 'choice',
      category: 'ทวนความจำสะสม',
      prompt: `ประโยค/คำว่า "${displayTerm}" มีความหมายตรงกับข้อใด?`,
      audioHz: target.hz.replace(/…/g, ''),
      hidePromptHz: false,
      options: opts,
      answer: opts.indexOf(target.th),
      refItem: { hz: target.hz, py: target.py, th: target.th },
      explain: `${target.hz} (${target.py}) แปลว่า "${target.th}"`
    });
  }

  // 2) 5 Listening & Tone / Plan Quiz questions
  if (planDayObj && Array.isArray(planDayObj.quiz) && planDayObj.quiz.length >= 3) {
    const pickedPlanQs = shuffleWithRng(planDayObj.quiz, rng).slice(0, 3);
    pickedPlanQs.forEach((pq, i) => {
      const correctText = pq.options[pq.answer];
      const shuffledOpts = shuffleWithRng(pq.options, rng);
      questions.push({
        id: `plan-${i}`,
        kind: 'choice',
        category: `สอบเจาะลึก Day ${safeDay}`,
        prompt: pq.q,
        audioHz: pq.type === 'audio' ? pq.audioChar : '',
        hidePromptHz: pq.type === 'audio',
        options: shuffledOpts,
        answer: shuffledOpts.indexOf(correctText),
        refItem: { hz: pq.audioChar || '', py: '', th: correctText },
        explain: pq.explain || `คำตอบที่ถูกคือ ${correctText}`
      });
    });
  } else {
    // Pure audio comprehension (ear test — listen to Chinese audio -> choose Thai meaning!)
    for (let i = 0; i < 3; i++) {
      const target = session.speakItems[i % session.speakItems.length];
      const distractors = pickDistractors(SURVIVAL_50, target.th, x => x.th, 3);
      const opts = shuffleWithRng([target.th, ...distractors.map(d => d.th)], rng);
      questions.push({
        id: `listen-${i}`,
        kind: 'choice',
        category: 'สอบฟังจับใจความ',
        prompt: 'กดฟังเสียงพูดภาษาจีน แล้วเลือกความหมายภาษาไทยที่ถูกต้อง',
        audioHz: target.hz.replace(/…/g, ''),
        hidePromptHz: true,
        options: opts,
        answer: opts.indexOf(target.th),
        refItem: { hz: target.hz, py: target.py, th: target.th },
        explain: `เสียงที่ได้ยินคือ ${target.hz} (${target.py}) = ${target.th}`
      });
    }
  }

  // Add 2 Tone-Pair Ear Check questions from today's 4 toneFocus items
  const toneTargets = shuffleWithRng(session.toneFocus, rng).slice(0, 2);
  toneTargets.forEach((tp, i) => {
    const distractors = pickDistractors(TONE_PAIRS, tp.id, x => x.id, 3);
    const formatOpt = (x) => `${x.py} (${x.label})`;
    const correctOpt = formatOpt(tp);
    const opts = shuffleWithRng([correctOpt, ...distractors.map(formatOpt)], rng);
    questions.push({
      id: `tone-${i}`,
      kind: 'choice',
      category: 'สอบแยกคู่วรรณยุกต์',
      prompt: `กดฟังเสียงคำว่า "${tp.th}" แล้วเลือกพินอินและคู่วรรณยุกต์ที่ได้ยิน`,
      audioHz: tp.hz,
      hidePromptHz: true,
      options: opts,
      answer: opts.indexOf(correctOpt),
      refItem: { hz: tp.hz, py: tp.py, th: tp.th },
      explain: `${tp.hz} อ่านว่า ${tp.py} (${tp.label}) แปลว่า "${tp.th}"`
    });
  });

  // 3) 3 Thai -> Chinese Expression & Visual Mnemonic questions (with progressive Pinyin!)
  for (let i = 0; i < 2; i++) {
    const target = session.speakItems[(i + 2) % session.speakItems.length];
    const distractors = pickDistractors(SURVIVAL_50, target.hz, x => x.hz, 3);
    const formatChoice = (item) => formatHzWithProgressivePinyin(item.hz, item.py, safeDay);
    const correctLabel = formatChoice(target);
    const opts = shuffleWithRng([correctLabel, ...distractors.map(formatChoice)], rng);
    questions.push({
      id: `th2hz-${i}`,
      kind: 'choice',
      category: 'เลือกประโยคภาษาจีน',
      prompt: `ถ้าต้องการพูดว่า "${target.th}" ต้องพูดว่าอย่างไร?`,
      audioHz: '',
      hidePromptHz: false,
      options: opts,
      answer: opts.indexOf(correctLabel),
      refItem: { hz: target.hz, py: target.py, th: target.th },
      explain: `"${target.th}" พูดว่า ${target.hz} (${target.py})`
    });
  }

  const mnemTarget = session.mnemFocus[0];
  const mnemDistractors = pickDistractors(HANZI_MNEMONICS, mnemTarget.hz, x => x.hz, 3);
  const formatMnemOpt = (m) => safeDay <= 14 ? `${m.hz} (${m.py})` : m.hz;
  const correctMnemOpt = formatMnemOpt(mnemTarget);
  const mnemOpts = shuffleWithRng([correctMnemOpt, ...mnemDistractors.map(formatMnemOpt)], rng);
  questions.push({
    id: 'mnem-0',
    kind: 'choice',
    category: 'ภาพจำตัวอักษรจีน',
    prompt: `จากภาพจำ "${mnemTarget.story}" — ตัวอักษรใดแปลว่า "${mnemTarget.th}"?`,
    audioHz: '',
    hidePromptHz: false,
    options: mnemOpts,
    answer: mnemOpts.indexOf(correctMnemOpt),
    refItem: { hz: mnemTarget.hz, py: mnemTarget.py, th: mnemTarget.th },
    explain: `${mnemTarget.hz} (${mnemTarget.py}) แปลว่า "${mnemTarget.th}" — ${mnemTarget.story}`
  });

  // 4) 3 Sentence Word-Order Assembly questions (tiles carry progressive Pinyin!)
  const orderPool = session.speakItems.filter(s => normalizeChinese(s.hz).length >= 3);
  const pickedOrders = shuffleWithRng(orderPool.length >= 3 ? orderPool : SURVIVAL_50.filter(s => normalizeChinese(s.hz).length >= 3), rng).slice(0, 3);
  pickedOrders.forEach((s, i) => {
    const expectedTileObjs = tokenizeSentenceForOrder(s.hz, s.py, safeDay);
    let scrambledObjs = shuffleWithRng(expectedTileObjs, rng);
    const expectedHz = expectedTileObjs.map(t => t.hz).join('');
    if (scrambledObjs.map(t => t.hz).join('') === expectedHz && scrambledObjs.length > 1) {
      scrambledObjs = [...scrambledObjs.slice(1), scrambledObjs[0]];
    }
    questions.push({
      id: `order-${i}`,
      kind: 'order',
      category: 'เรียงคำแต่งประโยค',
      prompt: `เรียงคำให้เป็นประโยคที่หมายถึง: "${s.th}"`,
      expectedHz,
      tiles: scrambledObjs.map(t => t.hz),
      tilePinyins: scrambledObjs.map(t => t.py || ''),
      refItem: { hz: s.hz, py: s.py, th: s.th },
      explain: `ลำดับที่ถูกต้องคือ ${s.hz} (${s.py})`
    });
  });

  // Hardcore 5x / 10x extra closed-book listening & recall questions
  if (icfg.extraQuiz > 0) {
    const extraPool = shuffleWithRng([...session.speakItems, ...SURVIVAL_50], rng);
    for (let i = 0; i < icfg.extraQuiz; i++) {
      const target = extraPool[i % extraPool.length];
      const distractors = pickDistractors(SURVIVAL_50, target.th, x => x.th, 3);
      const opts = shuffleWithRng([target.th, ...distractors.map(d => d.th)], rng);
      const isEar = i % 2 === 0;
      const displayTerm = icfg.hidePinyin ? target.hz : formatHzWithProgressivePinyin(target.hz, target.py, Math.max(safeDay, 23));
      questions.push({
        id: `hc-${icfg.level}x-${i}`,
        kind: 'choice',
        category: `${icfg.label} · ${isEar ? 'ฟังล้วน' : 'อ่านจีนจริง'}`,
        prompt: isEar ? 'กดฟังเสียงภาษาจีน แล้วเลือกความหมายที่ถูกต้อง' : `ประโยค "${displayTerm}" แปลว่าอะไร?`,
        audioHz: target.hz.replace(/…/g, ''),
        hidePromptHz: isEar,
        options: opts,
        answer: opts.indexOf(target.th),
        refItem: { hz: target.hz, py: target.py, th: target.th },
        explain: `${target.hz} (${target.py}) = ${target.th}`
      });
    }
  }

  const targetQuizCount = EXAM_QUIZ_COUNT + icfg.extraQuiz;
  const finalQuestions = shuffleWithRng(questions.slice(0, targetQuizCount), rng);

  // 5) Real Speaking Exam Items (scaled by intensity: 3 / 6 / 10)
  const cleanSpeakCandidates = session.speakItems
    .map(s => ({
      hz: s.hz.replace(/…/g, '').replace(/\s*\/\s*.*/, '').trim(),
      py: icfg.hidePinyin ? '' : s.py.replace(/…/g, '').replace(/\s*\/\s*.*/, '').trim(),
      th: s.th,
      tip: s.tip
    }))
    .filter(s => normalizeChinese(s.hz).length >= 2);

  const speakingPrompts = shuffleWithRng(cleanSpeakCandidates, rng).slice(0, icfg.speakExamCount);
  const totalPoints = finalQuestions.length + speakingPrompts.length * EXAM_SPEAK_MAX_PER_ITEM;

  return {
    day: safeDay,
    intensity: icfg.level,
    scaffoldingTier: icfg.hidePinyin ? 'no-pinyin-10x' : (safeDay <= 14 ? 'full-pinyin' : (safeDay <= 22 ? 'partial-fade' : 'core-fade')),
    passPct: DAILY_MASTERY_PASS_PCT,
    totalPoints,
    questions: finalQuestions,
    speakingPrompts
  };
}

/**
 * Grades a single Speaking Exam prompt (worth up to 2.0 points).
 * Supports real SpeechRecognition transcript (primary) or strict tone-numbered pinyin dictation fallback
 * ONLY when SpeechRecognition API is unavailable in the browser.
 */
export function gradeSpeakingExamItem({ targetHz, targetPy, heardText = '', typedPinyinFallback = '', charPinyinMap = null }) {
  if (heardText && String(heardText).trim()) {
    const result = scorePronunciation(targetHz, targetPy, heardText, charPinyinMap);
    const pronScore = result.score;
    let points = 0;
    let gradeLabel = 'ยังไม่ผ่าน — ลองออกเสียงชัดๆ อีกครั้งนะ';
    if (pronScore >= 85) {
      points = 2.0;
      gradeLabel = 'ยอดเยี่ยม! ออกเสียงและวรรณยุกต์ชัดเจน (2/2 คะแนน)';
    } else if (pronScore >= 70) {
      points = 1.5;
      gradeLabel = 'ดีมาก! ใกล้เคียงต้นฉบับ (1.5/2 คะแนน)';
    } else if (pronScore >= 45) {
      points = 0.5;
      gradeLabel = 'ได้ยินบางคำ แต่ยังไม่ชัดเจน (0.5/2 คะแนน)';
    }
    return {
      mode: 'mic',
      pronScore,
      points,
      maxPoints: EXAM_SPEAK_MAX_PER_ITEM,
      passedItem: points >= 1.5,
      gradeLabel,
      syllables: result.syllables
    };
  }

  // Strict Pinyin + Tone fallback for browsers without Web Speech Recognition
  const expSyls = splitPinyinSyllables(targetPy).map(s => stripToneAndNumber(s));
  const rawTokens = String(typedPinyinFallback || '').trim().toLowerCase().split(/[\s,.'"-]+/).filter(Boolean);
  const usrSyls = rawTokens.map(s => stripToneAndNumber(s));

  if (expSyls.length === 0 || usrSyls.length === 0) {
    return {
      mode: 'pinyin-fallback',
      pronScore: 0,
      points: 0,
      maxPoints: EXAM_SPEAK_MAX_PER_ITEM,
      passedItem: false,
      gradeLabel: 'ยังไม่ได้ระบุพินอิน',
      syllables: []
    };
  }

  let exactMatches = 0;
  let baseMatches = 0;
  for (let i = 0; i < expSyls.length; i++) {
    const exp = expSyls[i];
    const usr = usrSyls[i];
    if (!usr) continue;
    if (usr.base === exp.base) {
      baseMatches++;
      // Neutral tone (5) accepts omitted number or 5/0
      if (usr.tone === exp.tone || (exp.tone === 5 && (usr.tone === 5 || usr.tone === 0))) {
        exactMatches++;
      }
    }
  }

  const exactRatio = exactMatches / expSyls.length;
  const baseRatio = baseMatches / expSyls.length;
  let points = 0;
  let gradeLabel = 'พินอินหรือเลขวรรณยุกต์ยังไม่ถูกต้อง';
  if (exactRatio === 1 && usrSyls.length === expSyls.length) {
    points = 2.0;
    gradeLabel = 'พินอินและวรรณยุกต์ถูกต้องครบ 100% (2/2 คะแนน)';
  } else if (exactRatio >= 0.8) {
    points = 1.5;
    gradeLabel = 'พินอินและวรรณยุกต์ถูกเกือบครบ (1.5/2 คะแนน)';
  } else if (baseRatio === 1) {
    points = 1.0;
    gradeLabel = 'สะกดพินอินถูก แต่วรรณยุกต์ยังผิด (1/2 คะแนน — ต้องระบุเลขวรรณยุกต์ 1-4 ให้เป๊ะ)';
  }

  return {
    mode: 'pinyin-fallback',
    pronScore: Math.round(exactRatio * 100),
    points,
    maxPoints: EXAM_SPEAK_MAX_PER_ITEM,
    passedItem: points >= 1.5,
    gradeLabel,
    syllables: []
  };
}

/**
 * Computes final Daily Mastery Exam score and enforces the strict >= 95% pass gate.
 * Never rounds < 95% up to 95% (e.g., 18.5/20 = 92.5% -> FAIL; 19.0/20 = 95.0% -> PASS).
 */
export function evaluateDailyMasteryAttempt({
  quizCorrect = 0,
  quizTotal = EXAM_QUIZ_COUNT,
  speakingPoints = 0,
  speakingMax = EXAM_SPEAK_COUNT * EXAM_SPEAK_MAX_PER_ITEM
} = {}) {
  const safeQuiz = Math.max(0, Math.min(quizTotal, Number(quizCorrect) || 0));
  const safeSpeak = Math.max(0, Math.min(speakingMax, Number(speakingPoints) || 0));
  const totalPoints = Math.max(1, quizTotal + speakingMax);
  const earnedPoints = Math.round((safeQuiz + safeSpeak) * 100) / 100;
  const rawPct = (earnedPoints / totalPoints) * 100;
  const pct = Math.floor(rawPct * 10) / 10; // Never round up past threshold
  const passed = rawPct + 1e-9 >= DAILY_MASTERY_PASS_PCT;
  const quizPct = quizTotal > 0 ? Math.round((safeQuiz / quizTotal) * 100) : 0;
  const speakPct = speakingMax > 0 ? Math.round((safeSpeak / speakingMax) * 100) : 0;
  const neededPoints = passed ? 0 : Math.max(0.5, Math.ceil((DAILY_MASTERY_PASS_PCT / 100) * totalPoints * 2 - earnedPoints * 2) / 2);

  return {
    earnedPoints,
    totalPoints,
    pct,
    passed,
    passThresholdPct: DAILY_MASTERY_PASS_PCT,
    quizCorrect: safeQuiz,
    quizTotal,
    quizPct,
    speakingPoints: safeSpeak,
    speakingMax,
    speakPct,
    neededPoints
  };
}

export function searchDictionary(query, { vocabWords = [], lexicon = [] } = {}, limit = 24) {
  const raw = String(query || '').trim();
  if (!raw) return [];
  const qLower = raw.toLowerCase();
  const qNoTone = stripTones(raw);
  const seen = new Set();
  const out = [];

  const push = (entry) => {
    if (out.length >= limit) return;
    const key = `${entry.hz}|${entry.py}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(entry);
  };

  const matchItem = (hz, py, th) => {
    const h = String(hz || '');
    const p = String(py || '');
    const t = String(th || '');
    if (h.includes(raw)) return 3;
    const pPlain = stripTones(p);
    if (
      p.toLowerCase().includes(qLower) ||
      pPlain.includes(qNoTone) ||
      pPlain.replace(/v/g, 'u').includes(qNoTone.replace(/v/g, 'u'))
    ) return 2;
    if (t.toLowerCase().includes(qLower)) return 1;
    return 0;
  };

  const candidates = [];
  for (const m of HANZI_MNEMONICS) {
    const sc = matchItem(m.hz, m.py, m.th);
    if (sc) candidates.push({ sc: sc + 1, hz: m.hz, py: m.py, th: m.th, tag: 'อักษรเดือนแรก', extra: m.story });
  }
  for (const s of SURVIVAL_50) {
    const sc = matchItem(s.hz, s.py, s.th);
    if (sc) candidates.push({ sc, hz: s.hz, py: s.py, th: s.th, tag: '50 ประโยคเอาตัวรอด', extra: s.tip });
  }
  for (const w of vocabWords) {
    const hz = w.hanzi || w.hz || '';
    const py = w.pinyin || w.py || '';
    const th = w.meaning || w.th || '';
    const sc = matchItem(hz, py, th);
    if (sc) candidates.push({ sc, hz, py, th, tag: 'คำศัพท์พื้นฐาน', extra: '' });
  }
  for (const w of lexicon) {
    const hz = w.hanzi || w.hz || '';
    const py = w.pinyin || w.py || '';
    const th = w.meaning || w.th || '';
    const sc = matchItem(hz, py, th);
    if (sc) candidates.push({ sc: sc - 0.5, hz, py, th, tag: w.level ? String(w.level).toUpperCase() : 'คลังศัพท์', extra: '' });
  }

  candidates.sort((a, b) => b.sc - a.sc || a.hz.length - b.hz.length);
  for (const c of candidates) push(c);
  return out;
}


// ============================================================================
// MAXIMUM RETENTION SUITE:
// 1) Auto-Enrolled Quiz-Backed FSRS (`collectDayFsrsItems`, `getDueMonth1FsrsCards`, `gradeQuizFsrsResponse`)
// 2) Memory Decay & 7/21-Day Speed Re-Verify (`getDecayedDays`, `buildDecayPopQuiz`)
// 3) 4-Second Reflex Speaking Prompts (`buildReflexPrompts`)
// 4) Infinite Adaptive Weakness Grinder (`buildWeaknessQueue`)
// 5) Weekly Cumulative Boss Exam Day 7/14/21/30 (`WEEKLY_BOSS_DAYS`, `getPendingWeeklyBoss`, `buildWeeklyBossExam`)
// ============================================================================
import { diffDaysBetweenKeys, computeRetrievability } from '../../modules/srs-sm2.js';

export const WEEKLY_BOSS_DAYS = [7, 14, 21, 30, 37, 44, 52, 60, 67, 74, 82, 90];

/**
 * Extracts all core phrases, tone pairs, and mnemonics studied on `dayNum` for automatic FSRS enrollment.
 */
export function collectDayFsrsItems(dayNum) {
  const s = buildGuidedSession(dayNum, []);
  const items = [];
  const seen = new Set();
  const push = (hz, py, th, kind) => {
    const cleanHz = String(hz || '').replace(/…/g, '').replace(/\s*\/\s*.*/, '').trim();
    if (!cleanHz || seen.has(cleanHz)) return;
    seen.add(cleanHz);
    items.push({ id: cleanHz, hz: cleanHz, py: String(py || '').trim(), th: String(th || '').trim(), kind, sourceDay: s.day });
  };
  s.toneFocus.forEach(t => push(t.hz, t.py, t.th, 'tone'));
  s.mnemFocus.forEach(m => push(m.hz, m.py, m.th, 'mnem'));
  s.speakItems.forEach(sp => push(sp.hz, sp.py, sp.th, 'sentence'));
  return items;
}

/**
 * Returns due FSRS cards from `ext.month1.fsrsDeck` sorted by lowest retrievability first.
 */
export function getDueMonth1FsrsCards(fsrsDeck = {}, todayKey) {
  if (!fsrsDeck || typeof fsrsDeck !== 'object' || !todayKey) return [];
  const due = [];
  for (const card of Object.values(fsrsDeck)) {
    if (!card || !card.hz || !card.srs) continue;
    if (String(card.srs.nextDue || '') <= todayKey) {
      const r = computeRetrievability(card.srs, todayKey);
      due.push({ ...card, retrievability: r });
    }
  }
  due.sort((a, b) => a.retrievability - b.retrievability || (b.srs.lapses || 0) - (a.srs.lapses || 0));
  return due;
}

/**
 * Maps objective quiz accuracy + response speed into an objective FSRS rating ('again'|'hard'|'good'|'easy')
 * so learners cannot inflate self-reported flashcard ratings.
 */
export function gradeQuizFsrsResponse({ isCorrect, elapsedMs = 5000 }) {
  if (!isCorrect) return 'again';
  const ms = Math.max(0, Number(elapsedMs) || 5000);
  if (ms <= 3200) return 'easy';
  if (ms <= 7500) return 'good';
  return 'hard';
}

/**
 * Identifies previously passed days (1..30) whose memory verification has decayed:
 * - Tier 1 check due >= 7 days after passing
 * - Tier 2 check due >= 21 days after passing
 * - Ongoing check every 30 days after last verification
 */
export function getDecayedDays(ext = {}, todayKey) {
  const dm = ext?.dayMastery && typeof ext.dayMastery === 'object' ? ext.dayMastery : {};
  if (!todayKey) return [];
  const decayed = [];
  for (let d = 1; d <= MAX_CURRICULUM_DAY; d++) {
    const rec = dm[d] || dm[String(d)];
    if (!rec || !rec.passed || Number(rec.bestPct || 0) < DAILY_MASTERY_PASS_PCT) continue;
    const passedAt = rec.passedAt || '';
    if (!passedAt) continue;
    const lastVer = rec.lastVerifiedAt || passedAt;
    const tier = Number(rec.verifyTier) || 0;
    const daysSincePass = diffDaysBetweenKeys(passedAt, todayKey);
    const daysSinceVer = diffDaysBetweenKeys(lastVer, todayKey);

    let dueReason = '';
    if (tier === 0 && daysSincePass >= 7) {
      dueReason = `ผ่านครบ ${daysSincePass} วันแล้ว (รอบทวน 7 วัน)`;
    } else if (tier === 1 && daysSincePass >= 21 && daysSinceVer >= 7) {
      dueReason = `ผ่านครบ ${daysSincePass} วันแล้ว (รอบทวน 21 วัน)`;
    } else if (tier >= 2 && daysSinceVer >= 30) {
      dueReason = `ไม่ได้เช็กซ้ำมา ${daysSinceVer} วัน (รอบทวนรายเดือน)`;
    }
    if (dueReason) {
      decayed.push({ day: d, daysSincePass, daysSinceVer, verifyTier: tier, reason: dueReason, bestPct: rec.bestPct });
    }
  }
  return decayed;
}

/**
 * Builds a fast 5-item Re-Verify Pop-Quiz (4 closed-book/progressive questions + 1 mic speaking = 6 pts, >=95% = 6/6 required).
 */
export function buildDecayPopQuiz(dayNum, { seed = Date.now() } = {}) {
  const full = buildDailyMasteryExam(dayNum, { seed });
  return {
    day: full.day,
    passPct: DAILY_MASTERY_PASS_PCT,
    questions: full.questions.slice(0, 4),
    speakingPrompts: full.speakingPrompts.slice(0, 1),
    totalPoints: 6
  };
}

export function isWeeklyBossPassed(checkpointDay, ext = {}) {
  const wb = ext?.weeklyBoss && typeof ext.weeklyBoss === 'object' ? ext.weeklyBoss : {};
  const rec = wb[checkpointDay] || wb[String(checkpointDay)];
  return Boolean(rec && rec.passed && Number(rec.bestPct || 0) >= DAILY_MASTERY_PASS_PCT);
}

/**
 * Returns the Weekly Boss checkpoint day (7, 14, 21, or 30) if all days in that week (1..checkpointDay)
 * are mastered (>=95%), BEFORE allowing progression to the next week!
 */
export function getPendingWeeklyBoss(progress = {}, ext = {}) {
  if (!ext || !ext.dayMastery || typeof ext.dayMastery !== 'object') return null;
  for (const cp of WEEKLY_BOSS_DAYS) {
    let allUpToCpMastered = true;
    for (let d = 1; d <= cp; d++) {
      if (!isDayMastered(d, progress, ext)) {
        allUpToCpMastered = false;
        break;
      }
    }
    if (allUpToCpMastered && !isWeeklyBossPassed(cp, ext)) {
      return cp;
    }
  }
  return null;
}

/**
 * Builds a cumulative 20-point Weekly Boss Exam spanning ALL days from Day 1..checkpointDay!
 * Every question & speaking prompt carries `sourceDay` so a failed attempt pinpoints exact forgotten days.
 */
export function buildWeeklyBossExam(checkpointDay, { planArray = [], mistakes = [], seed = Date.now() } = {}) {
  const cp = WEEKLY_BOSS_DAYS.includes(Number(checkpointDay)) ? Number(checkpointDay) : 7;
  const rng = seededRng(seed + cp * 313);
  const startDay = cp <= 30 ? 1 : (cp <= 60 ? 31 : 61);
  const dayPool = [];
  for (let d = startDay; d <= cp; d++) dayPool.push(d);
  if (startDay > 1) {
    // Also mix in 2 anchor review days from the previous month to test long-term retention
    dayPool.push(Math.max(1, startDay - 7), Math.max(1, startDay - 1));
  }
  const shuffledDays = shuffleWithRng(dayPool, rng);

  const questions = [];
  const speakingPrompts = [];
  const usedPromptKeys = new Set();

  // Sample across all days 1..cp to reach 14 diverse cumulative questions + 3 cumulative speaking prompts
  let cursor = 0;
  while (questions.length < EXAM_QUIZ_COUNT && cursor < 60) {
    const d = shuffledDays[cursor % shuffledDays.length];
    const planObj = Array.isArray(planArray) ? planArray.find(x => Number(x.day) === d) : null;
    const subExam = buildDailyMasteryExam(d, { planDayObj: planObj, mistakes, seed: seed + cursor * 41 });
    for (const q of subExam.questions) {
      const key = `${q.kind}:${q.prompt}`;
      if (!usedPromptKeys.has(key)) {
        usedPromptKeys.add(key);
        questions.push({
          ...q,
          id: `boss-d${d}-${questions.length}`,
          sourceDay: d,
          category: `สะสม Day ${d} · ${q.category}`
        });
        break;
      }
    }
    cursor++;
  }

  const speakDays = shuffleWithRng(dayPool, rng);
  for (let i = 0; i < speakDays.length && speakingPrompts.length < EXAM_SPEAK_COUNT; i++) {
    const d = speakDays[i];
    const subExam = buildDailyMasteryExam(d, { seed: seed + i * 73 });
    const sp = subExam.speakingPrompts[0];
    if (sp && !speakingPrompts.some(x => x.hz === sp.hz)) {
      speakingPrompts.push({ ...sp, sourceDay: d });
    }
  }

  return {
    checkpointDay: cp,
    weekNumber: Math.ceil(cp / 7),
    passPct: DAILY_MASTERY_PASS_PCT,
    totalPoints: EXAM_TOTAL_POINTS,
    questions: shuffleWithRng(questions.slice(0, EXAM_QUIZ_COUNT), rng),
    speakingPrompts
  };
}

/**
 * Aggregates missed items from a Weekly Boss Exam by `sourceDay` so the learner knows exact days to restudy.
 */
export function diagnoseWeakDaysFromBoss(missedItems = []) {
  const counts = new Map();
  for (const m of missedItems) {
    const d = Number(m?.sourceDay) || 0;
    if (d >= 1 && d <= MAX_CURRICULUM_DAY) {
      counts.set(d, (counts.get(d) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([day, misses]) => ({ day, misses }))
    .sort((a, b) => b.misses - a.misses || a.day - b.day);
}

/**
 * Generates rapid-fire Q&A / situational prompts for the 4-Second Reflex Speaking Mode.
 */
export function buildReflexPrompts(maxDay = 1, count = 8, seed = Date.now()) {
  const rng = seededRng(seed);
  const safeMax = Math.max(1, Math.min(MAX_CURRICULUM_DAY, Number(maxDay) || 1));
  const pool = [];
  for (let d = 1; d <= safeMax; d++) {
    const s = buildGuidedSession(d, []);
    s.speakItems.forEach(item => {
      const cleanHz = item.hz.replace(/…/g, '').replace(/\s*\/\s*.*/, '').trim();
      const cleanPy = item.py.replace(/…/g, '').replace(/\s*\/\s*.*/, '').trim();
      if (normalizeChinese(cleanHz).length >= 2 && !pool.some(p => p.hz === cleanHz)) {
        pool.push({
          hz: cleanHz,
          py: cleanPy,
          th: item.th,
          cue: `สถานการณ์: พูดว่า "${item.th}" ทันที!`,
          sourceDay: d
        });
      }
    });
  }
  const base = pool.length >= count ? pool : [
    ...pool,
    ...SURVIVAL_50
      .map(s => ({
        hz: s.hz.replace(/…/g, '').replace(/\s*\/\s*.*/, '').trim(),
        py: s.py.replace(/…/g, '').replace(/\s*\/\s*.*/, '').trim(),
        th: s.th,
        cue: `สถานการณ์: พูดว่า "${s.th}" ทันที!`,
        sourceDay: 1
      }))
      .filter(s => normalizeChinese(s.hz).length >= 2 && !pool.some(p => p.hz === s.hz))
  ];
  return shuffleWithRng(base, rng).slice(0, count);
}

/**
 * Builds an interleaved multi-mode practice batch from the learner's weakest items (mistakes + fragile FSRS + tone traps).
 */
export function buildWeaknessQueue({ mistakes = [], fsrsDeck = {}, maxDay = 1, count = 8, seed = Date.now() } = {}) {
  const rng = seededRng(seed);
  const rawPool = [];
  const seen = new Set();
  const add = (hz, py, th, weight, tag) => {
    const cleanHz = String(hz || '').replace(/…/g, '').replace(/\s*\/\s*.*/, '').trim();
    if (!cleanHz || !th || seen.has(cleanHz)) return;
    seen.add(cleanHz);
    rawPool.push({ hz: cleanHz, py: String(py || '').trim(), th: String(th || '').trim(), weight, tag });
  };

  for (const m of (Array.isArray(mistakes) ? mistakes : [])) {
    add(m?.hanzi || m?.hz, m?.pinyin || m?.py, m?.meaning || m?.th, 100 + (m?.misses || 1) * 15, 'คำที่เคยตอบผิด');
  }
  for (const card of Object.values(fsrsDeck || {})) {
    if (card?.hz && card?.srs && ((card.srs.lapses || 0) > 0 || (card.srs.difficulty || 5) >= 6.5)) {
      add(card.hz, card.py, card.th, 80 + (card.srs.lapses || 0) * 12, 'คำเสี่ยงลืมใน FSRS');
    }
  }
  const s = buildGuidedSession(maxDay, []);
  s.toneFocus.forEach(t => add(t.hz, t.py, t.th, 40, `คู่เสียง ${t.label}`));
  s.speakItems.forEach(sp => add(sp.hz, sp.py, sp.th, 35, `ประโยค Day ${maxDay}`));
  TONE_PAIRS.forEach(t => add(t.hz, t.py, t.th, 20, `คู่เสียง ${t.label}`));

  rawPool.sort((a, b) => b.weight - a.weight);
  const topCandidates = shuffleWithRng(rawPool.slice(0, Math.max(count * 2, 12)), rng).slice(0, count);
  const modes = ['ear', 'pinyin', 'speak', 'meaning'];

  return topCandidates.map((item, idx) => {
    const mode = item.py ? modes[idx % modes.length] : 'meaning';
    const distractors = shuffleWithRng(SURVIVAL_50.filter(x => x.th !== item.th), rng).slice(0, 3).map(d => d.th);
    return {
      ...item,
      drillMode: mode,
      options: shuffleWithRng([item.th, ...distractors], rng)
    };
  });
}
