// Pure logic for Speak Studio:
// - Per-syllable pronunciation scoring (#11)
// - Offline roleplay branching + goal matching (#1, #6)
// - Offline feedback report (#3)
// - Offline Thai->Chinese lookup (#5)
// - YIN pitch detection & ideal Mandarin tone contours (#12)
// - Smart Review spaced-repetition queue (#7)

const TONE_CHAR_MAP = {
  ā: ['a', 1], á: ['a', 2], ǎ: ['a', 3], à: ['a', 4],
  ē: ['e', 1], é: ['e', 2], ě: ['e', 3], è: ['e', 4],
  ī: ['i', 1], í: ['i', 2], ǐ: ['i', 3], ì: ['i', 4],
  ō: ['o', 1], ó: ['o', 2], ǒ: ['o', 3], ò: ['o', 4],
  ū: ['u', 1], ú: ['u', 2], ǔ: ['u', 3], ù: ['u', 4],
  ǖ: ['v', 1], ǘ: ['v', 2], ǚ: ['v', 3], ǜ: ['v', 4], ü: ['v', 5]
};

export function normalizeChinese(str) {
  return String(str || '').replace(/[^\u4e00-\u9fff]/g, '');
}

export function stripToneAndNumber(syllable) {
  let tone = 5;
  let base = '';
  for (const ch of String(syllable || '').toLowerCase()) {
    if (TONE_CHAR_MAP[ch]) {
      base += TONE_CHAR_MAP[ch][0];
      if (TONE_CHAR_MAP[ch][1] !== 5) tone = TONE_CHAR_MAP[ch][1];
    } else if (/[a-z]/.test(ch)) {
      base += ch;
    } else if (/[1-5]/.test(ch)) {
      tone = Number(ch);
    }
  }
  return { base, tone };
}

export function extractToneNumber(syllable) {
  return stripToneAndNumber(syllable).tone;
}

/**
 * Split tone-marked pinyin string into rough per-character syllables.
 * Handles spaces, punctuation, and compound words (e.g. "Zhōngguó" -> ["Zhōng", "guó"]).
 */
export function splitPinyinSyllables(py) {
  const cleaned = String(py || '')
    .replace(/[.,!?;:'"()，。！？；：“”（）\-…]/g, ' ')
    .trim();
  if (!cleaned) return [];
  const rawTokens = cleaned.split(/\s+/).filter(Boolean);
  const syllables = [];
  // Regex for Mandarin pinyin syllable (with tone marks)
  const sylRe = /(?:zh|ch|sh|[bpmfdtnlgkhjqxzcsrwy])?(?:[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüaeiou]+)(?:ng|n|r)?/gi;

  for (const tok of rawTokens) {
    if (/^[a-zA-Z0-9-]+$/.test(tok) && !/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü]/.test(tok) && tok.toLowerCase() === 'wi-fi') {
      continue;
    }
    const matches = tok.match(sylRe);
    if (matches && matches.length) {
      syllables.push(...matches);
    }
  }
  return syllables;
}

const CONFUSABLE_INITIALS = [
  ['zh', 'z'], ['ch', 'c'], ['sh', 's'], ['n', 'l'], ['r', 'l'], ['j', 'z'], ['q', 'c'], ['x', 's']
];

function isSimilarBase(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  for (const [x, y] of CONFUSABLE_INITIALS) {
    if ((a.startsWith(x) && b.startsWith(y) && a.slice(x.length) === b.slice(y.length)) ||
        (a.startsWith(y) && b.startsWith(x) && a.slice(y.length) === b.slice(x.length))) {
      return true;
    }
  }
  // Same final (last 2+ chars)
  if (a.length >= 2 && b.length >= 2 && a.slice(-2) === b.slice(-2)) return true;
  return false;
}

/**
 * Build a Map<hanziChar, pinyinSyllable> from lexicon array (optional).
 */
export function buildCharPinyinMap(lexicon) {
  const map = new Map();
  if (!Array.isArray(lexicon)) return map;
  for (const entry of lexicon) {
    const hz = normalizeChinese(entry?.hz || entry?.hanzi || entry?.w || '');
    const py = String(entry?.py || entry?.pinyin || '').trim();
    if (!hz || !py) continue;
    if (hz.length === 1 && !map.has(hz)) {
      map.set(hz, py.split(/\s+/)[0]);
    } else if (hz.length > 1) {
      const parts = splitPinyinSyllables(py);
      if (parts.length === hz.length) {
        for (let i = 0; i < hz.length; i++) {
          if (!map.has(hz[i])) map.set(hz[i], parts[i]);
        }
      }
    }
  }
  return map;
}

/**
 * Per-syllable pronunciation scoring (#11)
 * Aligns target Chinese chars with heard Chinese chars via DP (Levenshtein alignment),
 * then classifies each target char as 'green' | 'yellow' | 'red'.
 */
export function scorePronunciation(targetHz, targetPy, heardHz, charPinyinMap = null) {
  const tChars = [...normalizeChinese(targetHz)];
  const hChars = [...normalizeChinese(heardHz)];
  const tSyllables = splitPinyinSyllables(targetPy);

  if (tChars.length === 0) {
    return { score: 0, syllables: [], summary: 'ไม่มีข้อความเป้าหมาย' };
  }

  const m = tChars.length;
  const n = hChars.length;

  // DP edit distance matrix for alignment
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = tChars[i - 1] === hChars[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,       // deletion (missed char)
        dp[i][j - 1] + 1,       // insertion (extra heard char)
        dp[i - 1][j - 1] + cost // match / substitution
      );
    }
  }

  // Backtrack to pair each target char with a heard char (or '')
  const aligned = new Array(m).fill('');
  let i = m;
  let j = n;
  while (i > 0) {
    if (j > 0 && dp[i][j] === dp[i - 1][j - 1] + (tChars[i - 1] === hChars[j - 1] ? 0 : 1)) {
      aligned[i - 1] = hChars[j - 1];
      i--;
      j--;
    } else if (dp[i][j] === dp[i - 1][j] + 1) {
      aligned[i - 1] = '';
      i--;
    } else {
      j--;
    }
  }

  let totalPoints = 0;
  const syllables = tChars.map((ch, idx) => {
    const heardChar = aligned[idx];
    const expectedPy = tSyllables[idx] || (charPinyinMap?.get(ch) || '');
    const heardPy = heardChar ? (charPinyinMap?.get(heardChar) || '') : '';

    if (heardChar === ch) {
      totalPoints += 1;
      return { char: ch, expectedPy, heardChar, heardPy: expectedPy, status: 'green', reason: 'ตรงเป๊ะ' };
    }

    if (!heardChar) {
      return { char: ch, expectedPy, heardChar: '', heardPy: '', status: 'red', reason: 'ตกหล่น/ไม่ได้ยิน' };
    }

    // Compare pinyin if available
    if (expectedPy && heardPy) {
      const exp = stripToneAndNumber(expectedPy);
      const hrd = stripToneAndNumber(heardPy);
      if (exp.base && exp.base === hrd.base && exp.tone === hrd.tone) {
        totalPoints += 1;
        return { char: ch, expectedPy, heardChar, heardPy, status: 'green', reason: 'เสียงพ้องตรงกัน' };
      }
      if (exp.base && exp.base === hrd.base && exp.tone !== hrd.tone) {
        totalPoints += 0.6;
        return {
          char: ch,
          expectedPy,
          heardChar,
          heardPy,
          status: 'yellow',
          reason: `วรรณยุกต์คลาดเคลื่อน (ควรเป็นเสียง ${exp.tone} แต่ได้ยินเสียง ${hrd.tone})`
        };
      }
      if (isSimilarBase(exp.base, hrd.base)) {
        totalPoints += 0.5;
        return {
          char: ch,
          expectedPy,
          heardChar,
          heardPy,
          status: 'yellow',
          reason: `พยัญชนะ/สระใกล้เคียง (${expectedPy} vs ${heardPy})`
        };
      }
    }

    return {
      char: ch,
      expectedPy,
      heardChar,
      heardPy,
      status: 'red',
      reason: heardChar ? `ได้ยินเป็น "${heardChar}"` : 'ไม่ชัดเจน'
    };
  });

  const score = Math.round((totalPoints / m) * 100);
  let summary = 'ลองฟังช้าๆ แล้วพูดซ้ำอีกครั้งนะ';
  if (score >= 90) summary = 'ยอดเยี่ยมมาก! ออกเสียงชัดเจนเกือบสมบูรณ์';
  else if (score >= 75) summary = 'ดีมาก! เก็บรายละเอียดคำสีเหลือง/แดงอีกนิด';
  else if (score >= 50) summary = 'พอใช้ได้ ลองฝึกคำสีแดงและฟังความเร็ว 0.6x';

  return { score, syllables, summary };
}

/**
 * Offline Roleplay Engine (#1, #6)
 */
export function matchOfflineRoleplay(scenario, userText, currentGoals = [], turnIdx = 0) {
  const lower = String(userText || '').toLowerCase();
  const completedSet = new Set(Array.isArray(currentGoals) ? currentGoals : []);

  if (Array.isArray(scenario?.goals)) {
    scenario.goals.forEach((g, idx) => {
      if (completedSet.has(idx)) return;
      const kws = Array.isArray(g.keywords) ? g.keywords : [];
      if (kws.some((kw) => lower.includes(String(kw).toLowerCase()))) {
        completedSet.add(idx);
      }
    });
  }

  const turns = Array.isArray(scenario?.offlineTurns) ? scenario.offlineTurns : [];
  const safeIdx = Math.min(turnIdx, Math.max(0, turns.length - 1));
  const nextTurn = turns[safeIdx] || {
    hz: '好的，明白了！谢谢你的配合。',
    py: 'Hǎo de, míngbai le! Xièxie nǐ de pèihé.',
    th: 'ได้เลย เข้าใจแล้ว! ขอบคุณที่ร่วมสนทนานะ',
    hint: { keywords: '谢谢 (xièxie)', py: 'Xièxie, zàijiàn!', hz: '谢谢，再见！' }
  };

  const goalsCompleted = [...completedSet].sort((a, b) => a - b);
  const correction = normalizeChinese(userText).length === 0
    ? 'ลองตอบเป็นภาษาจีน (หรือพินอิน) เพื่อให้ฝึกพูดได้เต็มที่นะ'
    : '';

  return {
    hz: nextTurn.hz,
    py: nextTurn.py,
    th: nextTurn.th,
    goalsCompleted,
    hint: nextTurn.hint || { keywords: '谢谢 (xièxie)', py: 'Xièxie!', hz: '谢谢！' },
    correction
  };
}

/**
 * Offline Post-Conversation Feedback Report (#3)
 */
export function buildOfflineFeedback(scenario, transcript = [], completedGoals = []) {
  const userTurns = transcript.filter((t) => t && t.role === 'user' && String(t.text || '').trim());
  const totalGoals = Array.isArray(scenario?.goals) ? scenario.goals.length : 0;
  const goalRatio = totalGoals > 0 ? Math.min(1, completedGoals.length / totalGoals) : 0.7;

  const avgLen = userTurns.length
    ? userTurns.reduce((acc, t) => acc + normalizeChinese(t.text).length, 0) / userTurns.length
    : 0;

  const fluency = Math.min(98, Math.max(45, Math.round(55 + userTurns.length * 8 + avgLen * 2)));
  const accuracy = Math.min(96, Math.max(50, Math.round(58 + goalRatio * 34)));
  const vocab = Math.min(95, Math.max(48, Math.round(52 + avgLen * 4 + completedGoals.length * 6)));

  const keyPhrases = Array.isArray(scenario?.keyPhrases) ? scenario.keyPhrases : [];
  const items = userTurns.slice(0, 6).map((t, i) => {
    const kp = keyPhrases[i % Math.max(1, keyPhrases.length)];
    const hasZh = normalizeChinese(t.text).length > 0;
    return {
      said: t.text,
      corrected: hasZh ? t.text : (kp?.hz || '你好，谢谢！'),
      py: kp?.py || '',
      th: kp?.th || 'ประโยคสนทนาพื้นฐาน',
      betterChoice: kp ? `${kp.hz} (${kp.py})` : 'ลองเพิ่มคำสุภาพ เช่น 请问 หรือ 谢谢',
      note: hasZh
        ? 'สื่อสารได้ชัดเจน! ลองเทียบกับประโยคแนะนำเพื่อความเป็นธรรมชาติมากขึ้น'
        : 'แนะนำให้ลองพูดเป็นภาษาจีนโดยตรงเพื่อฝึกความคล่อง'
    };
  });

  const summary = totalGoals > 0 && completedGoals.length >= totalGoals
    ? `เยี่ยมมาก! คุณทำภารกิจครบทั้ง ${totalGoals} ข้อในสถานการณ์ "${scenario?.title || 'สนทนา'}" (วิเคราะห์แบบออฟไลน์)`
    : `เริ่มต้นได้ดี! คุณตอบโต้ไป ${userTurns.length} รอบ ลองกดเพิ่มประโยคแนะนำเข้าคิวทบทวนเพื่อฝึกพูดซ้ำนะ`;

  return { fluency, accuracy, vocab, summary, items };
}

/**
 * Offline "Ask the teacher" Thai -> Chinese search (#5)
 */
export function searchOfflineTranslate(thaiText, lexicon = [], extraPhrases = []) {
  const q = String(thaiText || '').trim().toLowerCase();
  if (!q) return null;

  const tokens = q.split(/\s+/).filter((t) => t.length >= 2);
  const candidates = [];

  for (const p of extraPhrases) {
    const th = String(p.th || p.meaning || '').toLowerCase();
    if (!th) continue;
    let score = 0;
    if (th.includes(q)) score += 10;
    for (const tk of tokens) {
      if (th.includes(tk)) score += 3;
    }
    if (score > 0) {
      candidates.push({
        score,
        hz: p.hz || p.hanzi,
        py: p.py || p.pinyin,
        th: p.th || p.meaning,
        note: 'ค้นพบจากคลังประโยคออฟไลน์ — ลองกดฟังแล้วพูดตามได้เลย'
      });
    }
  }

  if (Array.isArray(lexicon)) {
    for (let i = 0; i < lexicon.length; i++) {
      const w = lexicon[i];
      const th = String(w?.th || w?.meaning || w?.m || '').toLowerCase();
      if (!th) continue;
      let score = 0;
      if (th === q) score += 12;
      else if (th.includes(q)) score += 7;
      else {
        for (const tk of tokens) {
          if (th.includes(tk)) score += 2;
        }
      }
      if (score > 0) {
        candidates.push({
          score,
          hz: w.hz || w.hanzi || w.w,
          py: w.py || w.pinyin || w.p || '',
          th: w.th || w.meaning || w.m,
          note: 'คำศัพท์จากพจนานุกรมออฟไลน์ — เชื่อมต่ออินเทอร์เน็ตและเข้าสู่ระบบเพื่อให้ครู AI แต่งประโยคเต็มให้'
        });
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0] || null;
}

/**
 * YIN Pitch Detection (#12) — returns fundamental frequency in Hz, or 0 if unvoiced/quiet.
 */
export function detectPitchYIN(buffer, sampleRate = 44100, threshold = 0.15) {
  if (!buffer || buffer.length < 256) return 0;

  // Check RMS energy to ignore silence
  let rms = 0;
  for (let i = 0; i < buffer.length; i++) rms += buffer[i] * buffer[i];
  rms = Math.sqrt(rms / buffer.length);
  if (rms < 0.012) return 0;

  const halfLen = Math.floor(buffer.length / 2);
  const minTau = Math.max(2, Math.floor(sampleRate / 520)); // max ~520 Hz
  const maxTau = Math.min(halfLen - 1, Math.floor(sampleRate / 70)); // min ~70 Hz
  if (maxTau <= minTau) return 0;

  const diff = new Float32Array(maxTau + 1);
  for (let tau = 1; tau <= maxTau; tau++) {
    let sum = 0;
    for (let i = 0; i < halfLen; i++) {
      const d = buffer[i] - buffer[i + tau];
      sum += d * d;
    }
    diff[tau] = sum;
  }

  // Cumulative mean normalized difference function (CMNDF)
  const cmndf = new Float32Array(maxTau + 1);
  cmndf[0] = 1;
  let runningSum = 0;
  for (let tau = 1; tau <= maxTau; tau++) {
    runningSum += diff[tau];
    cmndf[tau] = runningSum > 0 ? (diff[tau] * tau) / runningSum : 1;
  }

  let tauEstimate = -1;
  for (let tau = minTau; tau <= maxTau; tau++) {
    if (cmndf[tau] < threshold) {
      while (tau + 1 <= maxTau && cmndf[tau + 1] < cmndf[tau]) tau++;
      tauEstimate = tau;
      break;
    }
  }

  if (tauEstimate === -1) return 0;

  // Parabolic interpolation for sub-sample precision
  let betterTau = tauEstimate;
  if (tauEstimate > 1 && tauEstimate < maxTau) {
    const s0 = cmndf[tauEstimate - 1];
    const s1 = cmndf[tauEstimate];
    const s2 = cmndf[tauEstimate + 1];
    const denom = 2 * (2 * s1 - s2 - s0);
    if (Math.abs(denom) > 1e-6) {
      betterTau = tauEstimate + (s2 - s0) / denom;
    }
  }

  const freq = sampleRate / betterTau;
  return freq >= 70 && freq <= 520 ? freq : 0;
}

/**
 * Generate ideal normalized pitch contour (0..1) for Mandarin tones [1..5].
 * 1: high flat (55 -> 0.85)
 * 2: rising (35 -> 0.45 -> 0.88)
 * 3: dipping (214 -> 0.38 -> 0.14 -> 0.52)
 * 4: falling (51 -> 0.90 -> 0.16)
 * 5: neutral (mid-low flat -> 0.45)
 */
export function idealToneContour(tones = [1], pointsPerTone = 24) {
  const list = Array.isArray(tones) && tones.length ? tones : [1];
  const out = [];
  for (const t of list) {
    for (let i = 0; i < pointsPerTone; i++) {
      const u = i / Math.max(1, pointsPerTone - 1);
      let y = 0.5;
      if (t === 1) {
        y = 0.85;
      } else if (t === 2) {
        y = 0.42 + 0.46 * Math.pow(u, 1.15);
      } else if (t === 3) {
        // Dip to 0.14 at u=0.55 then rise to 0.52
        y = u < 0.55
          ? 0.38 - 0.24 * Math.sin((u / 0.55) * (Math.PI / 2))
          : 0.14 + 0.38 * Math.pow((u - 0.55) / 0.45, 1.2);
      } else if (t === 4) {
        y = 0.90 - 0.74 * Math.pow(u, 0.95);
      } else {
        y = 0.44 - 0.06 * u;
      }
      out.push(Number(y.toFixed(3)));
    }
  }
  return out;
}

/**
 * Smart Review queue helpers (#7)
 */
export function getDueReviewItems(reviewQueue = [], todayStr) {
  if (!Array.isArray(reviewQueue)) return [];
  return reviewQueue.filter((item) => !item.dueDate || item.dueDate <= todayStr);
}

export function updateReviewItem(item, passed, nextDayStr, todayStr) {
  const streak = passed ? (item.streak || 0) + 1 : 0;
  return {
    ...item,
    streak,
    lastPracticed: todayStr,
    dueDate: passed ? nextDayStr : todayStr
  };
}
