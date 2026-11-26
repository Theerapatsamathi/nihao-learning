// Pure testable logic for Month-1 Starter Pack
import { TONE_PAIRS, MONTH1_DAYS_15_30, HANZI_MNEMONICS, SURVIVAL_50 } from './data-month1.js';

export function stripTones(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[üv]/gi, 'u')
    .toLowerCase()
    .trim();
}

export function getTodayBlueprintDay(progress = {}, ext = {}) {
  const dayScores = progress.dayScores || {};
  for (let d = 1; d <= 14; d++) {
    if ((dayScores[d] || 0) < 8) return d;
  }
  const done15_30 = Array.isArray(ext.doneDays) ? ext.doneDays : [];
  for (let d = 15; d <= 30; d++) {
    if (!done15_30.includes(d)) return d;
  }
  return 30;
}

export function calcMonth1Stats(progress = {}, ext = {}) {
  const dayScores = progress.dayScores || {};
  let days1_14 = 0;
  for (let d = 1; d <= 14; d++) {
    if ((dayScores[d] || 0) >= 8) days1_14++;
  }
  const doneDays = Array.isArray(ext.doneDays) ? ext.doneDays.filter(d => d >= 15 && d <= 30) : [];
  const totalDaysDone = days1_14 + new Set(doneDays).size;
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
  // Step 1: 3 warm-up items (mistakes if any, else survival sentences)
  const warmup = [];
  for (const m of (Array.isArray(mistakes) ? mistakes : []).slice(0, 3)) {
    if (m && (m.hanzi || m.hz || m.pinyin)) {
      warmup.push({
        hz: m.hanzi || m.hz || m.pinyin,
        py: m.pinyin || m.py || '',
        th: m.meaning || m.th || 'ทบทวนคำที่เคยผิด'
      });
    }
  }
  let idx = 0;
  while (warmup.length < 3) {
    const s = SURVIVAL_50[(safeDay * 3 + idx) % SURVIVAL_50.length];
    warmup.push({ hz: s.hz, py: s.py, th: s.th });
    idx++;
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

  const dayMeta = safeDay >= 15
    ? MONTH1_DAYS_15_30.find(d => d.day === safeDay) || MONTH1_DAYS_15_30[0]
    : { day: safeDay, week: safeDay <= 7 ? 1 : 2, title: `แผนพื้นฐาน Day ${safeDay}`, focus: 'พินอิน + วรรณยุกต์ + ฝึกพูดตาม' };

  return { day: safeDay, meta: dayMeta, warmup, toneFocus, speakItems };
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
    if (p.toLowerCase().includes(qLower) || stripTones(p).includes(qNoTone)) return 2;
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
