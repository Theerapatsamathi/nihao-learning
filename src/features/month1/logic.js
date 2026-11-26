// Pure testable logic for Month-1 Starter Pack & 95% Daily Mastery Gate
import { TONE_PAIRS, MONTH1_DAYS_15_30, HANZI_MNEMONICS, SURVIVAL_50 } from './data-month1.js';
import { scorePronunciation, splitPinyinSyllables, stripToneAndNumber, normalizeChinese } from '../speak-studio/scoring.js';

export const DAILY_MASTERY_PASS_PCT = 95;
export const EXAM_QUIZ_COUNT = 14;
export const EXAM_SPEAK_COUNT = 3;
export const EXAM_SPEAK_MAX_PER_ITEM = 2;
export const EXAM_TOTAL_POINTS = EXAM_QUIZ_COUNT + EXAM_SPEAK_COUNT * EXAM_SPEAK_MAX_PER_ITEM; // 20 points (19/20 = 95%)

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
  for (let d = 1; d <= 30; d++) {
    if (!isDayMastered(d, progress, ext)) return d;
  }
  return 30;
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

export function buildGuidedSession(dayNum, mistakes = []) {
  const safeDay = Math.max(1, Math.min(30, Number(dayNum) || 1));
  // Step 1: 3 warm-up recall items (mistakes first, then previous-day survival/mnemonic items)
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

  // Step 2: 4 tone-pair focus items for today
  const pairStart = ((safeDay - 1) * 2) % TONE_PAIRS.length;
  const toneFocus = [];
  for (let i = 0; i < 4; i++) {
    toneFocus.push(TONE_PAIRS[(pairStart + i) % TONE_PAIRS.length]);
  }

  // Step 3: 5 survival sentences to shadow/speak
  const survStart = ((safeDay - 1) * 5) % SURVIVAL_50.length;
  const speakItems = [];
  for (let i = 0; i < 5; i++) {
    speakItems.push(SURVIVAL_50[(survStart + i) % SURVIVAL_50.length]);
  }

  // Mnemonic characters for today (2-3 chars per day across 64 chars)
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

/**
 * Splits a Chinese sentence into 3-6 meaningful tiles for sentence-order assembly questions.
 */
export function tokenizeSentenceForOrder(hzStr) {
  const clean = String(hzStr || '')
    .replace(/…/g, '')
    .replace(/\s*\/\s*.*/, '')
    .replace(/[。！？!?.,，\s]/g, '')
    .trim();
  const chars = [...clean];
  if (chars.length <= 4) return chars;
  // Group into chunks of 1-2 characters so total tiles stay between 4 and 6
  const tiles = [];
  let i = 0;
  while (i < chars.length) {
    if (chars.length - i > 4 && tiles.length < 4) {
      tiles.push(chars.slice(i, i + 2).join(''));
      i += 2;
    } else {
      tiles.push(chars[i]);
      i += 1;
    }
  }
  return tiles;
}

/**
 * Builds a complete, randomized 20-point Daily Mastery Exam for Day 1..30:
 * - 14 objective questions (1 pt each = 14 pts):
 *   * Active Recall of prior days / mistakes (3 Qs)
 *   * Listening & Tone-Pair Ear Check / Curated Day Plan Quiz (5 Qs)
 *   * Thai -> Chinese Closed-Book Recall (3 Qs)
 *   * Sentence Word-Order Tile Assembly (3 Qs)
 * - 3 real speaking prompts without Pinyin (2 pts each = 6 pts)
 * Passing requires >= 95% (>= 19.0 / 20 points).
 */
export function buildDailyMasteryExam(dayNum, { planDayObj = null, mistakes = [], seed = Date.now() } = {}) {
  const safeDay = Math.max(1, Math.min(30, Number(dayNum) || 1));
  const rng = seededRng(seed + safeDay * 97);
  const session = buildGuidedSession(safeDay, mistakes);
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

  // 1) 3 Active Recall questions (from mistakes + prior days)
  for (let i = 0; i < 3; i++) {
    const target = session.warmup[i % session.warmup.length];
    const distractors = pickDistractors(SURVIVAL_50, target.th, x => x.th, 3);
    const opts = shuffleWithRng([target.th, ...distractors.map(d => d.th)], rng);
    questions.push({
      id: `recall-${i}`,
      kind: 'choice',
      category: 'ทวนความจำสะสม',
      prompt: `คำว่า "${target.hz}" มีความหมายตรงกับข้อใด? (ห้ามดูพินอิน)`,
      audioHz: target.hz,
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
    // Pure audio comprehension (no Chinese text shown — ear test only!)
    for (let i = 0; i < 3; i++) {
      const target = session.speakItems[i % session.speakItems.length];
      const distractors = pickDistractors(SURVIVAL_50, target.th, x => x.th, 3);
      const opts = shuffleWithRng([target.th, ...distractors.map(d => d.th)], rng);
      questions.push({
        id: `listen-${i}`,
        kind: 'choice',
        category: 'สอบฟังเสียงล้วน',
        prompt: 'กดฟังเสียงพูดภาษาจีน แล้วเลือกความหมายที่ถูกต้อง (ซ่อนตัวอักษร)',
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

  // 3) 3 Closed-Book Thai -> Chinese Reading/Recall questions (2 sentences + 1 Hanzi mnemonic)
  for (let i = 0; i < 2; i++) {
    const target = session.speakItems[(i + 2) % session.speakItems.length];
    const distractors = pickDistractors(SURVIVAL_50, target.hz, x => x.hz, 3);
    const opts = shuffleWithRng([target.hz, ...distractors.map(d => d.hz)], rng);
    questions.push({
      id: `th2hz-${i}`,
      kind: 'choice',
      category: 'แปลไทยเป็นจีน',
      prompt: `ถ้าต้องการพูดว่า "${target.th}" ต้องใช้ประโยคใด?`,
      audioHz: '',
      hidePromptHz: false,
      options: opts,
      answer: opts.indexOf(target.hz),
      refItem: { hz: target.hz, py: target.py, th: target.th },
      explain: `"${target.th}" พูดเป็นภาษาจีนว่า ${target.hz} (${target.py})`
    });
  }

  const mnemTarget = session.mnemFocus[0];
  const mnemDistractors = pickDistractors(HANZI_MNEMONICS, mnemTarget.hz, x => x.hz, 3);
  const mnemOpts = shuffleWithRng([mnemTarget.hz, ...mnemDistractors.map(m => m.hz)], rng);
  questions.push({
    id: 'mnem-0',
    kind: 'choice',
    category: 'จำตัวอักษรจีน',
    prompt: `ตัวอักษรใดหมายถึง "${mnemTarget.th}" (${mnemTarget.parts})?`,
    audioHz: '',
    hidePromptHz: false,
    options: mnemOpts,
    answer: mnemOpts.indexOf(mnemTarget.hz),
    refItem: { hz: mnemTarget.hz, py: mnemTarget.py, th: mnemTarget.th },
    explain: `${mnemTarget.hz} (${mnemTarget.py}) แปลว่า "${mnemTarget.th}" — ${mnemTarget.story}`
  });

  // 4) 3 Sentence Word-Order Assembly questions
  const orderPool = session.speakItems.filter(s => normalizeChinese(s.hz).length >= 3);
  const pickedOrders = shuffleWithRng(orderPool.length >= 3 ? orderPool : SURVIVAL_50.filter(s => normalizeChinese(s.hz).length >= 3), rng).slice(0, 3);
  pickedOrders.forEach((s, i) => {
    const expectedTiles = tokenizeSentenceForOrder(s.hz);
    let scrambled = shuffleWithRng(expectedTiles, rng);
    if (scrambled.join('') === expectedTiles.join('') && scrambled.length > 1) {
      scrambled = [...scrambled.slice(1), scrambled[0]];
    }
    questions.push({
      id: `order-${i}`,
      kind: 'order',
      category: 'เรียงคำแต่งประโยค',
      prompt: `เรียงคำภาษาจีนให้เป็นประโยคที่หมายถึง: "${s.th}"`,
      expectedHz: expectedTiles.join(''),
      tiles: scrambled,
      refItem: { hz: s.hz, py: s.py, th: s.th },
      explain: `ลำดับที่ถูกต้องคือ ${s.hz} (${s.py})`
    });
  });

  // Ensure exact EXAM_QUIZ_COUNT (14) shuffled questions
  const finalQuestions = shuffleWithRng(questions.slice(0, EXAM_QUIZ_COUNT), rng);

  // 5) 3 Real Speaking Exam Items (Pinyin hidden!)
  const cleanSpeakCandidates = session.speakItems
    .map(s => ({
      hz: s.hz.replace(/…/g, '').replace(/\s*\/\s*.*/, '').trim(),
      py: s.py.replace(/…/g, '').replace(/\s*\/\s*.*/, '').trim(),
      th: s.th,
      tip: s.tip
    }))
    .filter(s => normalizeChinese(s.hz).length >= 2);

  const speakingPrompts = shuffleWithRng(cleanSpeakCandidates, rng).slice(0, EXAM_SPEAK_COUNT);

  return {
    day: safeDay,
    passPct: DAILY_MASTERY_PASS_PCT,
    totalPoints: EXAM_TOTAL_POINTS,
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
    let gradeLabel = 'ยังไม่ผ่าน — ออกเสียงใหม่อีกครั้ง';
    if (pronScore >= 90) {
      points = 2.0;
      gradeLabel = 'ยอดเยี่ยม! ออกเสียงชัดเป๊ะ (2/2 คะแนน)';
    } else if (pronScore >= 75) {
      points = 1.5;
      gradeLabel = 'ดีมาก! ใกล้เคียงต้นฉบับ (1.5/2 คะแนน)';
    } else if (pronScore >= 50) {
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
