// Pure logic helpers for the Motivation feature group (tested via tests/motivation.test.mjs)

export const LEAGUE_TIERS = [
  { id: 'bronze', name: 'Bronze', th: 'บรอนซ์', emoji: '🥉', color: '#cd7f32' },
  { id: 'silver', name: 'Silver', th: 'ซิลเวอร์', emoji: '🥈', color: '#8e8e93' },
  { id: 'gold', name: 'Gold', th: 'โกลด์', emoji: '🥇', color: '#ff9500' },
  { id: 'sapphire', name: 'Sapphire', th: 'แซฟไฟร์', emoji: '🔷', color: '#007aff' },
  { id: 'ruby', name: 'Ruby', th: 'รูบี้', emoji: '♦️', color: '#ff3b30' },
  { id: 'emerald', name: 'Emerald', th: 'เอเมอรัลด์', emoji: '💚', color: '#34c759' },
  { id: 'amethyst', name: 'Amethyst', th: 'อเมทิสต์', emoji: '🔮', color: '#af52de' },
  { id: 'pearl', name: 'Pearl', th: 'เพิร์ล', emoji: '🦪', color: '#5ac8fa' },
  { id: 'obsidian', name: 'Obsidian', th: 'ออบซิเดียน', emoji: '🖤', color: '#3a3a3c' },
  { id: 'diamond', name: 'Diamond', th: 'ไดมอนด์', emoji: '💎', color: '#5856d6' }
];

export const STREAK_REPAIR_COST_PER_DAY = 40;
export const MAX_HEARTS = 5;
export const HEART_REGEN_MS = 30 * 60 * 1000; // 30 minutes

export function getIsoWeekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export function getCoins(xp, spentCoins = 0) {
  return Math.max(0, Math.floor((Number(xp) || 0) / 5) + 50 - (Number(spentCoins) || 0));
}

// #23 Streak Repair: check if streak broke within last 2 days (yesterday or 2 days ago)
export function analyzeStreakRepair(activity = {}, frozenDays = [], todayKeyFn) {
  const act = activity || {};
  const frozen = Array.isArray(frozenDays) ? frozenDays : [];
  const hasDay = (k) => (act[k] || 0) > 0 || frozen.includes(k);

  const d1 = todayKeyFn(-1);
  const d2 = todayKeyFn(-2);
  const d3 = todayKeyFn(-3);

  const hasD1 = hasDay(d1);
  const hasD2 = hasDay(d2);
  const hasD3 = hasDay(d3);

  let missingDays = [];
  if (!hasD1 && hasD2) {
    missingDays = [d1];
  } else if (!hasD1 && !hasD2 && hasD3) {
    missingDays = [d2, d1];
  }

  if (!missingDays.length) {
    return { canRepair: false, missingDays: [], cost: 0, restoredStreak: 0 };
  }

  // Compute what the streak would be if missingDays were frozen
  const simulatedFrozen = new Set([...frozen, ...missingDays]);
  let restoredStreak = 0;
  for (let i = 0; i < 365; i++) {
    const k = todayKeyFn(-i);
    if ((act[k] || 0) > 0 || simulatedFrozen.has(k)) restoredStreak++;
    else if (i === 0) continue;
    else break;
  }

  return {
    canRepair: true,
    missingDays,
    cost: missingDays.length * STREAK_REPAIR_COST_PER_DAY,
    restoredStreak
  };
}

// #24 Deterministic offline league rivals
function hashStr(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const OFFLINE_NAMES = [
  'ต้นข้าว 🌾', 'มิ้นท์ 🍃', 'พีท 🚀', 'แพรวา 🌸', 'บีม ⚡',
  'น้ำฝน 🌧️', 'เจเจ 🐼', 'พลอย 💎', 'กานต์ 📚', 'ฟ้าใส ☁️',
  'นนท์ 🎯', 'ออมสิน 🪙', 'มายด์ ✨', 'ภูมิ 🏔️', 'ข้าวปุ้น 🍜',
  'เต้ 🔥', 'ใบเฟิร์น 🌿', 'ปันปัน 🎀', 'ซัน ☀️', 'โมจิ 🍡',
  'วิน 🏆', 'แนนนี่ 🌷', 'อาร์ม 🎸', 'เกรซ 🦋', 'โอ๊ต 🧋',
  'จูน 🌙', 'มิกซ์ 🎧', 'นิว 🌟', 'แบม 🎋'
];

export function generateOfflineLeague(weekKey, tierIdx = 0, userXp = 0, userName = 'คุณ') {
  const safeTier = Math.max(0, Math.min(LEAGUE_TIERS.length - 1, Number(tierIdx) || 0));
  const baseScale = 60 + safeTier * 55;
  const members = OFFLINE_NAMES.map((name, i) => {
    const seed = hashStr(`${weekKey}:${safeTier}:${i}`);
    const factor = ((seed % 1000) / 1000);
    // Curve: a few high scorers, most mid, some low
    const xp = Math.round(baseScale * (0.2 + Math.pow(factor, 1.4) * 2.6));
    return {
      userId: `bot-${i}`,
      displayName: name,
      xp,
      isMe: false
    };
  });

  members.push({
    userId: 'me',
    displayName: userName || 'คุณ',
    xp: Math.max(0, Math.floor(Number(userXp) || 0)),
    isMe: true
  });

  members.sort((a, b) => b.xp - a.xp || (a.isMe ? -1 : 1));
  return members.map((m, idx) => ({ ...m, rank: idx + 1 }));
}

// #25 Hearts regeneration calculation
export function computeHeartsState(heartsData = {}, nowMs = Date.now()) {
  const enabled = Boolean(heartsData.enabled);
  let count = Number.isInteger(heartsData.count) ? heartsData.count : MAX_HEARTS;
  count = Math.max(0, Math.min(MAX_HEARTS, count));
  let lastLostAt = Number(heartsData.lastLostAt) || 0;

  if (count < MAX_HEARTS && lastLostAt > 0 && nowMs > lastLostAt) {
    const elapsed = nowMs - lastLostAt;
    const gained = Math.floor(elapsed / HEART_REGEN_MS);
    if (gained > 0) {
      count = Math.min(MAX_HEARTS, count + gained);
      lastLostAt = count >= MAX_HEARTS ? 0 : lastLostAt + gained * HEART_REGEN_MS;
    }
  }

  const nextRegenMs = count < MAX_HEARTS && lastLostAt > 0
    ? Math.max(0, HEART_REGEN_MS - (nowMs - lastLostAt))
    : 0;

  return { enabled, count, max: MAX_HEARTS, lastLostAt, nextRegenMs };
}

// #26 Combo multiplier & bonus XP
export function computeComboBonus(combo) {
  const c = Math.max(0, Math.floor(Number(combo) || 0));
  if (c >= 10) return { multiplier: 3, bonusXp: 6, label: 'x3 ไฟลุก!' };
  if (c >= 5) return { multiplier: 2, bonusXp: 3, label: 'x2 คอมโบ!' };
  return { multiplier: 1, bonusXp: 0, label: '' };
}

// #17 Notebook CSV & Anki TSV export
function escapeCsvCell(val) {
  const s = String(val ?? '');
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function formatNotebookCsv(items = []) {
  const header = ['Hanzi', 'Pinyin', 'Thai', 'Note'];
  const rows = items.map((w) => [
    escapeCsvCell(w.zh || ''),
    escapeCsvCell(w.py || w.pinyin || ''),
    escapeCsvCell(w.th || ''),
    escapeCsvCell(w.note || '')
  ].join(','));
  return '\uFEFF' + [header.join(','), ...rows].join('\r\n');
}

export function formatNotebookAnkiTsv(items = []) {
  const clean = (s) => String(s ?? '').replace(/[\t\r\n]+/g, ' ').trim();
  return items.map((w) => {
    const front = `${clean(w.zh)} (${clean(w.py || w.pinyin)})`;
    const back = w.note ? `${clean(w.th)} — โน้ต: ${clean(w.note)}` : clean(w.th);
    return `${front}\t${back}\tnihao-notebook`;
  }).join('\n');
}

// #34 Pinyin tone & initial parser for Weakness Dashboard
const TONE_MAP = {
  'ā': 1, 'ē': 1, 'ī': 1, 'ō': 1, 'ū': 1, 'ǖ': 1,
  'á': 2, 'é': 2, 'í': 2, 'ó': 2, 'ú': 2, 'ǘ': 2,
  'ǎ': 3, 'ě': 3, 'ǐ': 3, 'ǒ': 3, 'ǔ': 3, 'ǚ': 3,
  'à': 4, 'è': 4, 'ì': 4, 'ò': 4, 'ù': 4, 'ǜ': 4
};

const INITIALS_LIST = [
  'zh', 'ch', 'sh',
  'b', 'p', 'm', 'f', 'd', 't', 'n', 'l',
  'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's', 'y', 'w'
];

export function parsePinyinSyllables(pinyin = '') {
  const raw = String(pinyin || '').toLowerCase().trim();
  if (!raw) return [];
  const tokens = raw.split(/[\s,'’\-·]+/).filter(Boolean);
  return tokens.map((tok) => {
    let tone = 5; // neutral
    for (const ch of tok) {
      if (TONE_MAP[ch]) {
        tone = TONE_MAP[ch];
        break;
      }
    }
    const clean = tok.replace(/[^a-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü]/g, '');
    let initial = '';
    for (const ini of INITIALS_LIST) {
      if (clean.startsWith(ini)) {
        initial = ini;
        break;
      }
    }
    return { syllable: tok, tone, initial };
  }).filter((s) => s.syllable);
}

export function analyzeWeaknesses(mistakes = []) {
  const toneCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const initialCounts = {};
  const tonePairs = {};

  for (const m of mistakes) {
    const weight = Math.max(1, Number(m.misses) || 1);
    const syls = parsePinyinSyllables(m.pinyin || m.py || '');
    for (let i = 0; i < syls.length; i++) {
      const s = syls[i];
      toneCounts[s.tone] = (toneCounts[s.tone] || 0) + weight;
      if (s.initial) {
        initialCounts[s.initial] = (initialCounts[s.initial] || 0) + weight;
      }
      if (i > 0) {
        const pairKey = `${syls[i - 1].tone}-${s.tone}`;
        tonePairs[pairKey] = (tonePairs[pairKey] || 0) + weight;
      }
    }
  }

  const topInitials = Object.entries(initialCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([initial, count]) => ({ initial, count }));

  const topTonePairs = Object.entries(tonePairs)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([pair, count]) => ({ pair, count }));

  return { toneCounts, topInitials, topTonePairs };
}

export function buildActivityHeatmap(activity = {}, frozenDays = [], todayKeyFn, weeks = 12) {
  const totalDays = weeks * 7;
  const frozenSet = new Set(Array.isArray(frozenDays) ? frozenDays : []);
  const cells = [];
  for (let i = totalDays - 1; i >= 0; i--) {
    const key = todayKeyFn(-i);
    const units = Number(activity[key]) || 0;
    const isFrozen = frozenSet.has(key);
    let level = 0;
    if (units >= 8) level = 4;
    else if (units >= 5) level = 3;
    else if (units >= 2) level = 2;
    else if (units >= 1) level = 1;
    cells.push({ key, units, isFrozen, level });
  }
  return cells;
}

// #33 Rule-based AI Study Plan
export function generateRuleBasedStudyPlan(progress = {}, stats = {}, todayStr = '') {
  const tasks = [];
  const mistakesCount = (progress.mistakes?.length || 0) + (progress.vocabMistakes?.length || 0);
  const srsObj = progress.vocabSrs || {};
  const dueSrs = Object.values(srsObj).filter((v) => v && v.due && v.due <= todayStr).length;

  if (mistakesCount > 0) {
    tasks.push({
      id: 'review-mistakes',
      title: `เคลียร์จุดพลาด ${Math.min(mistakesCount, 10)} ข้อในสมุดคำผิด`,
      minutes: 5,
      tab: 'motivation',
      reason: `คุณมีคำที่ตอบผิดสะสม ${mistakesCount} รายการ การทบทวนซ้ำจะช่วยจำแม่นขึ้น`
    });
  }

  if (dueSrs > 0) {
    tasks.push({
      id: 'srs-due',
      title: `ทบทวนคำศัพท์ SRS ที่ครบกำหนด (${dueSrs} คำ)`,
      minutes: 5,
      tab: 'vocab',
      reason: 'ทบทวนก่อนลืมตามหลัก Spaced Repetition'
    });
  }

  const skills = Array.isArray(stats.skills) ? [...stats.skills] : [];
  skills.sort((a, b) => (a.pct || 0) - (b.pct || 0));
  if (skills.length && (skills[0].pct || 0) < 100) {
    const weakest = skills[0];
    tasks.push({
      id: `skill-${weakest.id}`,
      title: `ฝึกทักษะที่ยังอ่อน: ${weakest.name} (${weakest.pct}%)`,
      minutes: 5,
      tab: weakest.tab || 'initials',
      reason: 'ยกระดับทักษะที่คะแนนต่ำสุดให้สมดุล'
    });
  }

  if (tasks.length < 3) {
    tasks.push({
      id: 'daily-vocab',
      title: 'เรียนรู้คำศัพท์ใหม่ 5 คำ พร้อมออกเสียงตาม',
      minutes: 5,
      tab: 'vocab',
      reason: 'สะสมคลังคำศัพท์ทุกวันอย่างสม่ำเสมอ'
    });
  }

  return tasks.slice(0, 4);
}

// #30 Monthly Recap ("Wrapped")
export function computeMonthlyRecap(progress = {}, stats = {}, vocabMap = new Map(), nowDate = new Date()) {
  const yyyy = nowDate.getFullYear();
  const mm = String(nowDate.getMonth() + 1).padStart(2, '0');
  const monthPrefix = `${yyyy}-${mm}`;

  const act = progress.activity || {};
  let monthUnits = 0;
  let activeDays = 0;
  for (const [k, v] of Object.entries(act)) {
    if (k.startsWith(monthPrefix) && Number(v) > 0) {
      monthUnits += Number(v);
      activeDays++;
    }
  }

  const learnedMap = progress.vocabLearned || {};
  let wordsThisMonth = 0;
  for (const dateVal of Object.values(learnedMap)) {
    if (typeof dateVal === 'string' && dateVal.startsWith(monthPrefix)) {
      wordsThisMonth++;
    }
  }

  const missed = [...(progress.mistakes || [])]
    .sort((a, b) => (b.misses || 1) - (a.misses || 1))
    .slice(0, 3)
    .map((m) => m.zh || m.q || m.id);

  const skills = Array.isArray(stats.skills) ? stats.skills : [];
  const favSkill = skills.length
    ? [...skills].sort((a, b) => (b.pct || 0) - (a.pct || 0))[0]?.name || 'คำศัพท์ & พินอิน'
    : 'คำศัพท์ & พินอิน';

  return {
    monthLabel: `${mm}/${yyyy}`,
    monthUnits,
    activeDays,
    estMinutes: monthUnits * 2,
    wordsThisMonth,
    totalWords: Object.keys(learnedMap).length,
    bestStreak: stats.streak || 0,
    mostMissed: missed,
    favoriteActivity: favSkill,
    level: stats.level || 1,
    xp: stats.xp || 0
  };
}

// #29 Milestone Certificates
export function evaluateMilestoneCertificates(progress = {}, stats = {}, extLessonPath = {}) {
  const totalWords = Object.keys(progress.vocabLearned || {}).length;
  const streak = stats.streak || 0;
  const hsk1Done = Boolean(
    extLessonPath?.hsk1Completed ||
    (stats.daysPassed >= 14 && stats.bossPassed)
  );

  return [
    {
      id: 'hsk1-path',
      title: 'สำเร็จเส้นทาง HSK 1',
      subtitle: 'HSK 1 Foundation Path',
      emoji: '🎓',
      unlocked: hsk1Done,
      progressText: hsk1Done ? 'ปลดล็อกแล้ว' : 'จบหลักสูตร 14 วัน + ผ่านบอส หรือจบเส้นทาง HSK 1',
      accent: ['#007aff', '#5856d6']
    },
    {
      id: 'streak-30',
      title: 'นักเรียนวินัยเหล็ก 30 วัน',
      subtitle: '30-Day Unbroken Streak',
      emoji: '🔥',
      unlocked: streak >= 30,
      progressText: `${Math.min(streak, 30)} / 30 วันต่อเนื่อง`,
      accent: ['#ff9500', '#ff3b30']
    },
    {
      id: 'words-1000',
      title: 'คลังคำศัพท์ 1,000 คำ',
      subtitle: '1,000 Mandarin Words Mastered',
      emoji: '📚',
      unlocked: totalWords >= 1000,
      progressText: `${Math.min(totalWords, 1000).toLocaleString()} / 1,000 คำ`,
      accent: ['#34c759', '#007aff']
    }
  ];
}
