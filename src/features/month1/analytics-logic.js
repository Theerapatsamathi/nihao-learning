// Pure logic for Mastery Analytics Hub:
// - 12-week Interactive Study Calendar + Hours Tracker
// - 4-Skill Strengths & Weaknesses Diagnosis + Top 5 Nemesis Words
// - HSK 1 / 2 / 3 Pace & ETA Predictor
// - Trophy Case (Medals & Milestones)

import { calc90DayStats, calcMonth1Stats, WEEKLY_BOSS_DAYS, isWeeklyBossPassed } from './logic.js';
import { realWorldProgress } from './realworld-logic.js';

function pad2(n) {
  return String(n).padStart(2, '0');
}

export function shiftDateKey(dateKey, deltaDays) {
  const parts = String(dateKey || '').split('-').map(Number);
  const d = parts.length === 3 && !parts.some(Number.isNaN)
    ? new Date(parts[0], parts[1] - 1, parts[2])
    : new Date();
  d.setDate(d.getDate() + deltaDays);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function buildStudyCalendar(progress = {}, ext = {}, todayKey = '2026-01-01', totalDays = 84) {
  const act = (progress && typeof progress.activity === 'object' && progress.activity) || {};
  const dm = (ext && typeof ext.dayMastery === 'object' && ext.dayMastery) || {};
  const studyLog = (ext && typeof ext.studyLog === 'object' && ext.studyLog) || {};

  // Index passed days by passedAt dateKey
  const passedByDate = new Map();
  for (const [dKey, rec] of Object.entries(dm)) {
    if (rec && rec.passed && rec.passedAt) {
      const k = String(rec.passedAt);
      if (!passedByDate.has(k)) passedByDate.set(k, []);
      passedByDate.get(k).push({ day: Number(dKey), pct: Number(rec.bestPct) || 95 });
    }
  }

  const cells = [];
  let todayMin = 0;
  let weekMin = 0;
  let monthMin = 0;
  let totalMin = 0;

  for (let offset = -(totalDays - 1); offset <= 0; offset++) {
    const dk = shiftDateKey(todayKey, offset);
    const actCount = Number(act[dk]) || 0;
    const logMin = Number(studyLog[dk]?.minutes) || 0;
    const passed = passedByDate.get(dk) || [];
    // Estimate minutes cleanly when explicit log isn't present: ~15m per passed day + ~4m per activity tick
    const minutes = logMin > 0 ? logMin : (passed.length * 15 + actCount * 4);
    const level = minutes === 0 ? 0 : minutes < 15 ? 1 : minutes < 35 ? 2 : minutes < 60 ? 3 : 4;

    if (offset === 0) todayMin = minutes;
    if (offset >= -6) weekMin += minutes;
    if (offset >= -29) monthMin += minutes;
    totalMin += minutes;

    cells.push({
      dateKey: dk,
      minutes,
      level,
      passedDays: passed,
      actCount
    });
  }

  return {
    cells,
    summary: {
      todayMin,
      weekHours: Number((weekMin / 60).toFixed(1)),
      monthHours: Number((monthMin / 60).toFixed(1)),
      totalHours: Number((totalMin / 60).toFixed(1)),
      activeDays: cells.filter(c => c.minutes > 0).length
    }
  };
}

export function computeSkillStrengthsWeaknesses(progress = {}, ext = {}) {
  const stats90 = calc90DayStats(progress, ext);
  const m1 = calcMonth1Stats(progress, ext);
  const rwp = realWorldProgress(ext.realWorld);
  const dm = Object.values((ext && ext.dayMastery) || {});
  const avgBest = dm.length
    ? Math.round(dm.reduce((s, r) => s + (Number(r.bestPct) || 0), 0) / dm.length)
    : 0;

  const listenScore = Math.min(100, Math.round(avgBest * 0.65 + (rwp.street / 3) * 35));
  const speakScore = Math.min(100, Math.round((m1.tonePairsDone / 20) * 45 + (rwp.unscripted ? 25 : 0) + avgBest * 0.3));
  const readScore = Math.min(100, Math.round((stats90.total90Done / 90) * 55 + avgBest * 0.45));
  const writeScore = Math.min(100, Math.round((m1.mnemonicsDone / 64) * 50 + Math.min(1, rwp.blindChars / 10) * 50));

  const skills = [
    { id: 'listen', label: '🎧 ทักษะการฟัง', score: listenScore, action: 'street', tip: 'ฝึกฟังความเร็ว 1.2x ในโหมดฟังคนจีนพูดจริง' },
    { id: 'speak', label: '🗣️ พูด & วรรณยุกต์', score: speakScore, action: 'tone-coach', tip: 'เข้าโค้ชตรวจการออกเสียง + โทรคุยสดครูจีน AI' },
    { id: 'read', label: '📖 อ่าน & ความจำ', score: readScore, action: 'fsrs', tip: 'เคลียร์ FSRS สม่ำเสมอและลองโหมดเข้มข้น 5x' },
    { id: 'write', label: '✍️ เขียน & จำตัวอักษร', score: writeScore, action: 'blind', tip: 'ฝึกเขียนไร้รอยประและคัดลายมือให้ครู AI ตรวจ' }
  ];

  const sorted = [...skills].sort((a, b) => b.score - a.score);
  const strength = sorted[0];
  const weakness = sorted[sorted.length - 1];

  const mistakes = Array.isArray(progress.mistakes) ? progress.mistakes : [];
  const nemesis = [...mistakes]
    .filter(m => m && m.hanzi)
    .sort((a, b) => (Number(b.misses) || 1) - (Number(a.misses) || 1))
    .slice(0, 5)
    .map(m => ({
      hz: m.hanzi,
      py: m.pinyin || '',
      th: m.meaning || m.answer || '',
      misses: Number(m.misses) || 1
    }));

  return { skills, strength, weakness, nemesis };
}

export function computeHskEtaForecast(progress = {}, ext = {}, todayKey = '2026-01-01') {
  const stats90 = calc90DayStats(progress, ext);
  const cal = buildStudyCalendar(progress, ext, todayKey, 28);
  const recentPassed = cal.cells.reduce((s, c) => s + c.passedDays.length, 0);
  // Days per week pace (default 5 days/week if just starting)
  const pacePerWeek = Math.max(1, recentPassed > 0 ? Number((recentPassed / 4).toFixed(1)) : 5);
  const pacePerDay = pacePerWeek / 7;

  const etaFor = (targetDay) => {
    const remaining = Math.max(0, targetDay - stats90.total90Done);
    if (remaining === 0) return { remaining: 0, etaDate: 'พิชิตแล้ว ✅', daysNeeded: 0 };
    const daysNeeded = Math.ceil(remaining / pacePerDay);
    return { remaining, daysNeeded, etaDate: shiftDateKey(todayKey, daysNeeded) };
  };

  return {
    pacePerWeek,
    hsk1: etaFor(30),
    hsk2: etaFor(60),
    hsk3: etaFor(90)
  };
}

export function computeTrophyCase(progress = {}, ext = {}, gameStats = {}) {
  const stats90 = calc90DayStats(progress, ext);
  const m1 = calcMonth1Stats(progress, ext);
  const rwp = realWorldProgress(ext.realWorld);
  const bossesCleared = WEEKLY_BOSS_DAYS.filter(cp => isWeeklyBossPassed(cp, ext)).length;
  const streak = Number(gameStats.streak) || 0;
  const intensity = Number(ext.intensity) || 1;

  return [
    { id: 'first95', icon: '🎯', title: 'ก้าวแรก ≥95%', desc: 'สอบผ่าน Day แรก ≥95%', unlocked: stats90.total90Done >= 1 },
    { id: 'streak7', icon: '🔥', title: 'ไฟลุก 7 วันติด', desc: 'เรียนต่อเนื่อง 7 วัน', unlocked: streak >= 7 },
    { id: 'tones20', icon: '🎵', title: 'หูเทพ 20 คู่เสียง', desc: 'ครบ 20 คู่วรรณยุกต์', unlocked: m1.tonePairsDone >= 20 },
    { id: 'boss1', icon: '🐉', title: 'นักล่าบอส', desc: `ปราบบอสสะสม (${bossesCleared}/12)`, unlocked: bossesCleared >= 1 },
    { id: 'hsk1', icon: '🌱', title: 'จบ HSK 1 (30 วัน)', desc: `${stats90.m1Done}/30 วัน`, unlocked: stats90.m1Done >= 30 },
    { id: 'hsk2', icon: '🚀', title: 'จบ HSK 2 (60 วัน)', desc: `${stats90.m2Done}/30 วัน`, unlocked: stats90.m2Done >= 30 },
    { id: 'hsk3', icon: '👑', title: 'พิชิต 90 วัน HSK 3', desc: `${stats90.m3Done}/30 วัน`, unlocked: stats90.m3Done >= 30 },
    { id: 'realworld', icon: '🏅', title: 'Real-World Certified', desc: 'ผ่านครบ 4 ด่านโลกจริง', unlocked: rwp.certified },
    { id: 'hardcore', icon: '💀', title: 'สายโหด 5x/10x', desc: 'เปิดโหมดเข้มข้น 5x หรือ 10x', unlocked: intensity >= 5 }
  ];
}
