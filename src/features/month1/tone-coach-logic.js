// Pure analysis & detailed Thai pronunciation coaching engine for Visual Tone Pitch Coach
import {
  splitPinyinSyllables,
  stripToneAndNumber,
  scorePronunciation,
  idealToneContour
} from '../speak-studio/scoring.js';

export const TONE_COACH_PACKS = [
  {
    id: 'basic4',
    title: '🎵 4 วรรณยุกต์พื้นฐาน',
    items: [
      { hz: '妈妈', py: 'mā ma', th: 'คุณแม่ (เสียง 1 สูงเรียบ + เสียงเบา)' },
      { hz: '中国', py: 'Zhōng guó', th: 'ประเทศจีน (เสียง 1 → เสียง 2)' },
      { hz: '你好', py: 'nǐ hǎo', th: 'สวัสดี (กฎผันเสียง 3+3 → 2+3)' },
      { hz: '谢谢', py: 'xiè xie', th: 'ขอบคุณ (เสียง 4 สับลงแรง + เสียงเบา)' },
      { hz: '学习', py: 'xué xí', th: 'เรียน (เสียง 2 + เสียง 2)' },
      { hz: '再见', py: 'zài jiàn', th: 'ลาก่อน (เสียง 4 + เสียง 4)' }
    ]
  },
  {
    id: 'traps',
    title: '🇹🇭 กับดักคนไทย (ม้วนลิ้น/พ่นลม/ü)',
    items: [
      { hz: '吃饭', py: 'chī fàn', th: 'กินข้าว (ch ม้วนลิ้น + พ่นลมแรง)' },
      { hz: '老师', py: 'lǎo shī', th: 'คุณครู (sh ม้วนลิ้น + เสียง 3 ลงลึก)' },
      { hz: '知道', py: 'zhī dào', th: 'รู้ (zh ม้วนลิ้น ไม่พ่นลม)' },
      { hz: '去旅游', py: 'qù lǚ yóu', th: 'ไปเที่ยว (q ยิ้มมุมปากพ่นลม + ü ห่อปาก)' },
      { hz: '谢谢你', py: 'xiè xie nǐ', th: 'ขอบคุณคุณ (x ฉีกยิ้ม เสียงเสียดแทรกเบา)' },
      { hz: '日本人', py: 'Rì běn rén', th: 'คนญี่ปุ่น (r ม้วนลิ้นสั่นในคอ ไม่ใช่ ร เรือ)' }
    ]
  },
  {
    id: 'daily',
    title: '🗣️ ประโยคพูดจริงชีวิตประจำวัน',
    items: [
      { hz: '请问洗手间在哪儿', py: 'qǐng wèn xǐ shǒu jiān zài nǎr', th: 'ขอโทษครับ ห้องน้ำอยู่ที่ไหน' },
      { hz: '这个多少钱', py: 'zhè ge duō shǎo qián', th: 'อันนี้ราคาเท่าไร' },
      { hz: '我要一杯冰美式', py: 'wǒ yào yī bēi bīng měi shì', th: 'ฉันเอาอเมริกาโน่เย็น 1 แก้ว' },
      { hz: '太贵了便宜一点儿', py: 'tài guì le pián yi yī diǎnr', th: 'แพงไป ลดหน่อยได้ไหม' },
      { hz: '我听不懂请慢一点', py: 'wǒ tīng bù dǒng qǐng màn yī diǎn', th: 'ฉันฟังไม่เข้าใจ ช่วยพูดช้าลงหน่อย' }
    ]
  }
];

const INITIAL_TIPS = [
  { re: /^zh/, label: 'zh (ม้วนลิ้น)', tip: 'กระดกปลายลิ้นขึ้นแตะเพดานแข็งด้านบน ออกเสียงคล้าย "จ" แบบหนา ไม่พ่นลม' },
  { re: /^ch/, label: 'ch (ม้วนลิ้น+พ่นลม)', tip: 'กระดกปลายลิ้นขึ้นเหมือน zh แต่พ่นลมออกมาแรงๆ (เอาฝ่ามืออังหน้าปากต้องรู้สึกมีลม)' },
  { re: /^sh/, label: 'sh (ม้วนลิ้น)', tip: 'กระดกปลายลิ้นขึ้นให้ลมลอดผ่าน เสียงจะทุ้มหนาคล้าย "ซ/ช" ผสมกัน' },
  { re: /^r/, label: 'r (ม้วนลิ้นสั่น)', tip: 'ม้วนลิ้นเหมือน sh แต่สั่นเส้นเสียงในลำคอ อย่ารัวลิ้นเหมือน ร เรือไทย' },
  { re: /^j/, label: 'j (หน้าลิ้น)', tip: 'ฉีกยิ้มเล็กน้อย ปลายลิ้นแตะหลังฟันล่าง ออกเสียง "จ" ใสๆ ไม่พ่นลม' },
  { re: /^q/, label: 'q (หน้าลิ้น+พ่นลม)', tip: 'วางลิ้นเหมือน j แล้วพ่นลมแรงๆ ออกเสียง "ช" แบบฉีกยิ้ม (ไม่ใช่ ช ปากจู๋)' },
  { re: /^x/, label: 'x (หน้าลิ้น)', tip: 'ฉีกยิ้มเล็กน้อย ลมลอดผ่านหน้าลิ้น ออกเสียง "ซ" ใสๆ เบาๆ' },
  { re: /^z/, label: 'z (ปลายลิ้นแตะฟัน)', tip: 'เหยียดลิ้นตรง แตะหลังฟันหน้า ห้ามม้วนลิ้น ออกเสียง "จ/ซ" ควบสั้นๆ' },
  { re: /^c/, label: 'c (ปลายลิ้น+พ่นลม)', tip: 'เหยียดลิ้นตรงแตะหลังฟันหน้า แล้วพ่นลมแรงคล้าย "ซ" พ่นลม' },
  { re: /^p/, label: 'p (พ่นลม)', tip: 'เม้มริมฝีปากแล้วระเบิดลมออกแรงๆ ให้ต่างจาก b ที่ไม่พ่นลม' },
  { re: /^t/, label: 't (พ่นลม)', tip: 'แตะปลายลิ้นที่ปุ่มเหงือกแล้วพ่นลมแรงๆ ให้ต่างจาก d' },
  { re: /^k/, label: 'k (พ่นลม)', tip: 'ยกโคนลิ้นแล้วพ่นลมแรงๆ จากลำคอ ให้ต่างจาก g' }
];

const TONE_GUIDE = {
  1: { name: 'เสียง 1 (สูงเรียบ 55)', fix: 'เกร็งระดับเสียงให้สูงและเรียบเท่ากันตลอดพยางค์ อย่าปล่อยเสียงตกตอนจบ' },
  2: { name: 'เสียง 2 (ไต่ขึ้น 35)', fix: 'เริ่มจากระดับกลางแล้วตวัดเสียงขึ้นสูงให้สุด เหมือนเวลาถามว่า "หา?"' },
  3: { name: 'เสียง 3 (ลงลึกแล้วขึ้น 214)', fix: 'กดเสียงลงต่ำสุดในลำคอให้ลึกก่อน (หัวใจของเสียง 3 คือความต่ำ) แล้วค่อยกระดกขึ้นเบาๆ' },
  4: { name: 'เสียง 4 (สับลงแรง 51)', fix: 'เริ่มจากระดับสูงสุดแล้วสับเสียงลงต่ำสุดอย่างรวดเร็วและสั้น เหมือนสั่งว่า "หยุด!"' },
  5: { name: 'เสียงเบา (Neutral)', fix: 'ออกเสียงสั้น เบา และปล่อยตามธรรมชาติ ไม่ต้องเน้นหนัก' }
};

/**
 * Normalizes raw Hz pitch array (filtering <= 0) into 1..5 Chao tone scale resampled to N points.
 */
export function normalizePitchSamples(rawHzList = [], targetLen = 40) {
  const valid = (Array.isArray(rawHzList) ? rawHzList : []).filter(v => Number.isFinite(v) && v >= 70 && v <= 550);
  if (valid.length < 3) return [];
  // Use log2 (semitones) so male & female voices normalize identically
  const logs = valid.map(v => Math.log2(v));
  const sorted = [...logs].sort((a, b) => a - b);
  const lo = sorted[Math.floor(sorted.length * 0.08)] ?? sorted[0];
  const hi = sorted[Math.floor(sorted.length * 0.92)] ?? sorted[sorted.length - 1];
  const span = Math.max(0.25, hi - lo); // at least ~3 semitones

  const norm = logs.map(v => {
    const t = (v - lo) / span;
    return Math.max(1, Math.min(5, 1 + t * 4));
  });

  const out = [];
  for (let i = 0; i < targetLen; i++) {
    const pos = (i / Math.max(1, targetLen - 1)) * (norm.length - 1);
    const idx = Math.floor(pos);
    const frac = pos - idx;
    const a = norm[idx];
    const b = norm[Math.min(norm.length - 1, idx + 1)];
    out.push(Number((a + (b - a) * frac).toFixed(2)));
  }
  return out;
}

/**
 * Compares user's normalized 1..5 pitch curve against idealToneContour(tones).
 * Returns { contourScore (0-100), idealCurve, userCurve, toneFeedback[] }.
 */
export function analyzePitchAgainstTones(rawHzList = [], tones = []) {
  const safeTones = (Array.isArray(tones) ? tones : []).filter(t => t >= 1 && t <= 5);
  const targetTones = safeTones.length ? safeTones : [1];
  const rawIdeal = idealToneContour(targetTones, 20);
  const maxIdeal = Math.max(...rawIdeal, 0);
  const idealCurve = maxIdeal <= 1.1 ? rawIdeal.map(v => Number((1 + v * 4).toFixed(2))) : rawIdeal;
  const userCurve = normalizePitchSamples(rawHzList, idealCurve.length);

  if (userCurve.length === 0) {
    return {
      contourScore: 0,
      idealCurve,
      userCurve: [],
      toneFeedback: ['ระบบยังไม่ได้รับสัญญาณเสียงชัดเจน ลองพูดใกล้ไมค์ขึ้นอีกนิดและพูดให้เต็มเสียงครับ']
    };
  }

  let mae = 0;
  for (let i = 0; i < idealCurve.length; i++) {
    mae += Math.abs(userCurve[i] - idealCurve[i]);
  }
  mae /= idealCurve.length;
  // MAE 0 -> 100%, MAE >= 2.2 -> 25%
  const contourScore = Math.max(20, Math.min(100, Math.round(100 - (mae / 2.2) * 75)));

  const toneFeedback = [];
  const segLen = Math.max(1, Math.floor(userCurve.length / targetTones.length));
  targetTones.forEach((t, idx) => {
    const seg = userCurve.slice(idx * segLen, (idx + 1) * segLen);
    if (seg.length < 3) return;
    const start = seg[0];
    const mid = seg[Math.floor(seg.length / 2)];
    const end = seg[seg.length - 1];
    const minV = Math.min(...seg);
    const maxV = Math.max(...seg);

    if (t === 1 && (maxV - minV > 1.6 || end < start - 0.9)) {
      toneFeedback.push(`พยางค์ที่ ${idx + 1} (เสียง 1): เสียงแกว่งหรือตกช่วงท้าย — ${TONE_GUIDE[1].fix}`);
    } else if (t === 2 && end - start < 0.7) {
      toneFeedback.push(`พยางค์ที่ ${idx + 1} (เสียง 2): เสียงยังไต่ขึ้นไม่ชัด — ${TONE_GUIDE[2].fix}`);
    } else if (t === 3 && minV > 2.3) {
      toneFeedback.push(`พยางค์ที่ ${idx + 1} (เสียง 3): กดเสียงลงยังไม่ลึกพอ — ${TONE_GUIDE[3].fix}`);
    } else if (t === 4 && start - end < 0.9) {
      toneFeedback.push(`พยางค์ที่ ${idx + 1} (เสียง 4): สับเสียงลงยังไม่แรงพอ — ${TONE_GUIDE[4].fix}`);
    }
  });

  if (toneFeedback.length === 0 && contourScore >= 80) {
    toneFeedback.push('เส้นระดับเสียงวรรณยุกต์ใกล้เคียงเจ้าของภาษามาก! คงจังหวะและน้ำหนักนี้ไว้เลยครับ');
  }

  return { contourScore, idealCurve, userCurve, toneFeedback };
}

/**
 * Generates rich, actionable Thai coaching tips covering:
 * - Syllable accuracy (from speech recognition)
 * - Pitch contour diagnosis (from YIN pitch tracking)
 * - Thai-speaker initial/final articulation tips
 * - Tone Sandhi rules (3+3, 不, 一)
 */
export function buildDetailedPronunciationReport({ targetHz, targetPy, heardHz = '', rawHzList = [], charPinyinMap = null }) {
  const syls = splitPinyinSyllables(targetPy);
  const parsed = syls.map(s => ({ raw: s, ...stripToneAndNumber(s) }));
  const tones = parsed.map(p => p.tone);

  const speechRes = heardHz
    ? scorePronunciation(targetHz, targetPy, heardHz, charPinyinMap)
    : { score: 0, syllables: [], summary: '' };
  const pitchRes = analyzePitchAgainstTones(rawHzList, tones);

  // Combine scores cleanly (if speech recognition unavailable or empty, rely on pitchRes)
  const overallScore = heardHz
    ? Math.round(speechRes.score * 0.6 + pitchRes.contourScore * 0.4)
    : pitchRes.contourScore;

  const tips = [];

  // 1. Tone Sandhi checks
  for (let i = 0; i < tones.length - 1; i++) {
    if (tones[i] === 3 && tones[i + 1] === 3) {
      tips.push({
        type: 'sandhi',
        title: `กฎผันเสียง 3 + 3 (${parsed[i].raw} + ${parsed[i + 1].raw})`,
        detail: `พยางค์หน้าต้องผันเป็น **เสียง 2** (ไต่ขึ้น) อัตโนมัติ อย่าออกเสียง 3 ต่ำทั้งคู่ติดกัน`
      });
      break;
    }
  }
  if (String(targetHz).includes('不')) {
    const idxBu = [...String(targetHz)].indexOf('不');
    if (idxBu >= 0 && tones[idxBu + 1] === 4) {
      tips.push({
        type: 'sandhi',
        title: 'กฎผันเสียง 不 (bù → bú)',
        detail: 'เมื่อ 不 อยู่หน้าเสียง 4 ให้ผันเป็นเสียง 2 (bú) เช่น 不是 (bú shì), 不对 (bú duì)'
      });
    }
  }

  // 2. Pitch contour feedback
  pitchRes.toneFeedback.forEach(msg => {
    tips.push({ type: 'pitch', title: '📈 วิเคราะห์กราฟวรรณยุกต์', detail: msg });
  });

  // 3. Per-syllable articulation coaching (prioritize missed/yellow syllables, then tricky initials/finals)
  const seenLabels = new Set();
  parsed.forEach((p, idx) => {
    const sylStatus = speechRes.syllables?.[idx]?.status;
    if (sylStatus === 'red' || sylStatus === 'yellow') {
      const tg = TONE_GUIDE[p.tone] || TONE_GUIDE[5];
      tips.push({
        type: 'syllable',
        title: `จุดที่ควรแก้: พยางค์ "${p.raw}" (${tg.name})`,
        detail: sylStatus === 'yellow'
          ? `เสียงพยัญชนะใกล้เคียงแล้ว แต่เพี้ยนวรรณยุกต์ — ${tg.fix}`
          : `ระบบยังจับคำนี้ไม่ได้ชัดเจน ลองเน้นพยัญชนะต้นให้ชัดและคุม ${tg.name}: ${tg.fix}`
      });
    }
    for (const rule of INITIAL_TIPS) {
      if (rule.re.test(p.base) && !seenLabels.has(rule.label)) {
        seenLabels.add(rule.label);
        tips.push({ type: 'articulation', title: `👄 เทคนิคปากและลิ้น: ${rule.label} (${p.raw})`, detail: rule.tip });
      }
    }
    if ((p.raw.includes('ü') || /[ǖǘǚǜ]/.test(p.raw) || /^[jqx]u/.test(p.base)) && !seenLabels.has('ü')) {
      seenLabels.add('ü');
      tips.push({
        type: 'articulation',
        title: `👄 เทคนิคสระ ü (${p.raw})`,
        detail: 'ทำปากจู๋กลมเหมือนจะเป่านกหวีด (รูปปาก "อู") แต่บังคับเสียงให้ออกเป็น "อี" จะได้เสียง ü ที่เป๊ะมาก'
      });
    }
  });

  const grade = overallScore >= 90 ? 'S' : overallScore >= 80 ? 'A' : overallScore >= 65 ? 'B' : 'C';
  return {
    overallScore,
    grade,
    speechScore: speechRes.score,
    contourScore: pitchRes.contourScore,
    syllables: speechRes.syllables || [],
    idealCurve: pitchRes.idealCurve,
    userCurve: pitchRes.userCurve,
    tips: tips.slice(0, 8)
  };
}
