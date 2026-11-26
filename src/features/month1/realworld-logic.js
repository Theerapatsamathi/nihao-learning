// Pure testable logic for the 4 Real-World Challenge modes:
// 1) Unscripted Situation Speaking  2) Street Listening (speed + ambience)
// 3) Pattern Substitution Workshop   4) Blind Hanzi Dictation
import { SURVIVAL_50, HANZI_MNEMONICS } from './data-month1.js';
import { buildGuidedSession, stripTones } from './logic.js';
import { normalizeChinese } from '../speak-studio/scoring.js';

export const UNSCRIPTED_PASS_PCT = 95;
export const UNSCRIPTED_COUNT = 5;
export const STREET_COUNT = 10;
export const PATTERN_COUNT = 5;
export const BLIND_COUNT = 5;
export const BLIND_MAX_MISTAKES = 1;

function rngFrom(seed = 1) {
  let s = (Number(seed) || 1) >>> 0;
  if (s === 0) s = 987654321;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function shuffleSeeded(arr, rng) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ---------------------------------------------------------------------------
// 1) UNSCRIPTED SITUATION SPEAKING
// Each situation shows ONLY a Thai scenario. Required idea groups are matched
// against the speech transcript (hanzi) or typed fallback (hanzi / pinyin).
// ---------------------------------------------------------------------------
export const SITUATIONS = [
  {
    id: 'milktea', minDay: 1,
    cue: 'พนักงานร้านชานมถามว่า "要什么?" — สั่งชานม 1 แก้ว น้ำแข็งน้อย หวานครึ่งเดียว',
    groups: [
      { label: 'ขอ/เอา (我要)', hz: ['我要', '我想要', '来一', '要一'], py: ['woyao', 'wo yao', 'laiyi', 'yaoyi'] },
      { label: 'ชานม (奶茶)', hz: ['奶茶'], py: ['naicha'] },
      { label: 'น้ำแข็งน้อย (少冰)', hz: ['少冰'], py: ['shaobing'] },
      { label: 'หวานครึ่งเดียว (半糖)', hz: ['半糖'], py: ['bantang'] }
    ],
    model: { hz: '我要一杯奶茶，少冰，半糖。', py: 'Wǒ yào yì bēi nǎichá, shǎo bīng, bàn táng.' }
  },
  {
    id: 'price', minDay: 1,
    cue: 'คุณเห็นกระเป๋าใบหนึ่งในตลาด — ถามราคา แล้วบอกว่าแพงเกินไป',
    groups: [
      { label: 'ถามราคา (多少钱)', hz: ['多少钱', '几块'], py: ['duoshaoqian', 'jikuai'] },
      { label: 'แพงเกินไป (太贵了)', hz: ['太贵', '贵了', '很贵'], py: ['taigui', 'guile', 'hengui'] }
    ],
    model: { hz: '这个多少钱？太贵了！', py: 'Zhège duōshao qián? Tài guì le!' }
  },
  {
    id: 'intro', minDay: 1,
    cue: 'คุณพบเพื่อนใหม่ชาวจีน — บอกว่าชื่ออะไร เป็นคนไทย และยินดีที่ได้รู้จัก',
    groups: [
      { label: 'ฉันชื่อ… (我叫)', hz: ['我叫', '我是'], py: ['wojiao', 'woshi'] },
      { label: 'คนไทย (泰国人)', hz: ['泰国'], py: ['taiguo'] },
      { label: 'ยินดีที่ได้รู้จัก (高兴认识)', hz: ['高兴', '认识'], py: ['gaoxing', 'renshi'] }
    ],
    model: { hz: '我叫小明，我是泰国人，很高兴认识你。', py: 'Wǒ jiào Xiǎomíng, wǒ shì Tàiguórén, hěn gāoxìng rènshi nǐ.' }
  },
  {
    id: 'toilet', minDay: 1,
    cue: 'คุณอยู่ในห้างและต้องการห้องน้ำ — พูดสุภาพถามคนที่เดินผ่านว่าห้องน้ำอยู่ที่ไหน',
    groups: [
      { label: 'ขอโทษ/ขอถาม (请问)', hz: ['请问', '不好意思', '打扰'], py: ['qingwen', 'buhaoyisi', 'darao'] },
      { label: 'ห้องน้ำ (洗手间)', hz: ['洗手间', '厕所'], py: ['xishoujian', 'cesuo'] },
      { label: 'อยู่ที่ไหน (在哪里)', hz: ['在哪', '哪里', '哪儿'], py: ['zainali', 'zainar', 'nali', 'nar'] }
    ],
    model: { hz: '请问，洗手间在哪里？', py: 'Qǐngwèn, xǐshǒujiān zài nǎlǐ?' }
  },
  {
    id: 'taxi', minDay: 2,
    cue: 'คุณขึ้นแท็กซี่ในกรุงปักกิ่ง — บอกคนขับว่าจะไปสนามบิน',
    groups: [
      { label: 'ฉันจะไป (我要去)', hz: ['我要去', '去', '到'], py: ['woyaoqu', 'yaoqu'] },
      { label: 'สนามบิน (机场)', hz: ['机场'], py: ['jichang'] }
    ],
    model: { hz: '我要去机场。', py: 'Wǒ yào qù jīchǎng.' }
  },
  {
    id: 'noheard', minDay: 2,
    cue: 'คนจีนพูดเร็วจนคุณฟังไม่ทัน — บอกว่าฟังไม่เข้าใจ และขอให้พูดช้าลง',
    groups: [
      { label: 'ฟังไม่เข้าใจ (听不懂)', hz: ['听不懂', '不懂'], py: ['tingbudong', 'budong'] },
      { label: 'ขอพูดช้าลง (慢一点)', hz: ['慢一点', '说慢', '慢点', '再说'], py: ['manyidian', 'shuoman', 'mandian', 'zaishuo'] }
    ],
    model: { hz: '我听不懂，请说慢一点。', py: 'Wǒ tīng bù dǒng, qǐng shuō màn yìdiǎn.' }
  },
  {
    id: 'pay', minDay: 2,
    cue: 'กินข้าวเสร็จแล้ว — เรียกพนักงานและขอเช็คบิล',
    groups: [
      { label: 'เรียกพนักงาน (服务员)', hz: ['服务员', '老板', '你好', '请问'], py: ['fuwuyuan', 'laoban', 'nihao', 'qingwen'] },
      { label: 'เช็คบิล (买单)', hz: ['买单', '结账'], py: ['maidan', 'jiezhang'] }
    ],
    model: { hz: '服务员，买单！', py: 'Fúwùyuán, mǎidān!' }
  },
  {
    id: 'alipay', minDay: 3,
    cue: 'ที่ร้านสะดวกซื้อ — ถามว่าจ่ายด้วย Alipay ได้ไหม',
    groups: [
      { label: 'ได้ไหม (可以)', hz: ['可以', '能'], py: ['keyi', 'neng'] },
      { label: 'Alipay/WeChat (支付宝)', hz: ['支付宝', '微信'], py: ['zhifubao', 'weixin'] }
    ],
    model: { hz: '可以用支付宝吗？', py: 'Kěyǐ yòng Zhīfùbǎo ma?' }
  },
  {
    id: 'time', minDay: 3,
    cue: 'คุณไม่มีนาฬิกา — ถามคนข้างๆ ว่าตอนนี้กี่โมงแล้ว',
    groups: [
      { label: 'ตอนนี้ (现在)', hz: ['现在'], py: ['xianzai'] },
      { label: 'กี่โมง (几点)', hz: ['几点'], py: ['jidian'] }
    ],
    model: { hz: '现在几点了？', py: 'Xiànzài jǐ diǎn le?' }
  },
  {
    id: 'nospicy', minDay: 3,
    cue: 'สั่งข้าวสวย 1 ที่ และบอกพนักงานว่าไม่เอาเผ็ด',
    groups: [
      { label: 'ฉันเอา (我要)', hz: ['我要', '来一', '要一'], py: ['woyao', 'laiyi', 'yaoyi'] },
      { label: 'ข้าวสวย (米饭)', hz: ['米饭'], py: ['mifan'] },
      { label: 'ไม่เผ็ด (不要辣)', hz: ['不要辣', '不辣', '别放辣'], py: ['buyaola', 'bula', 'biefangla'] }
    ],
    model: { hz: '我要一份米饭，不要辣。', py: 'Wǒ yào yí fèn mǐfàn, bú yào là.' }
  },
  {
    id: 'thanks', minDay: 1,
    cue: 'พนักงานส่งชานมให้คุณ — กล่าวขอบคุณ แล้วบอกลา',
    groups: [
      { label: 'ขอบคุณ (谢谢)', hz: ['谢谢', '感谢'], py: ['xiexie', 'ganxie'] },
      { label: 'ลาก่อน (再见)', hz: ['再见'], py: ['zaijian'] }
    ],
    model: { hz: '谢谢！再见！', py: 'Xièxie! Zàijiàn!' }
  },
  {
    id: 'sorry', minDay: 1,
    cue: 'คุณเดินชนคนจีนโดยไม่ตั้งใจ — ขอโทษ และเมื่อเขาตอบว่าไม่เป็นไร ให้บอกขอบคุณ',
    groups: [
      { label: 'ขอโทษ (对不起)', hz: ['对不起', '不好意思'], py: ['duibuqi', 'buhaoyisi'] },
      { label: 'ขอบคุณ (谢谢)', hz: ['谢谢', '感谢'], py: ['xiexie', 'ganxie'] }
    ],
    model: { hz: '对不起！……谢谢！', py: 'Duìbuqǐ! …… Xièxie!' }
  }
];

export function normalizeSpoken(text) {
  const raw = String(text || '');
  const hz = normalizeChinese(raw);
  const py = stripTones(raw.replace(/[^a-zA-Zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü]/g, ''));
  return { hz, py };
}

export function gradeSituationAnswer(situation, text) {
  const groups = Array.isArray(situation?.groups) ? situation.groups : [];
  const norm = normalizeSpoken(text);
  const hitFlags = groups.map(g => {
    const byHz = (g.hz || []).some(k => norm.hz.includes(normalizeChinese(k)));
    const byPy = norm.py && (g.py || []).some(k => norm.py.includes(stripTones(k).replace(/\s+/g, '')));
    return Boolean(byHz || byPy);
  });
  const total = groups.length;
  const hits = hitFlags.filter(Boolean).length;
  const ratio = total > 0 ? hits / total : 0;
  const points = Math.round(2 * ratio * 2) / 2;
  const missing = groups.filter((_, i) => !hitFlags[i]).map(g => g.label);
  return { hits, total, ratio, points, passedItem: ratio >= 0.99, missing };
}

export function evaluateUnscriptedSession(pointsList = []) {
  const max = Math.max(1, pointsList.length * 2);
  const earned = pointsList.reduce((s, p) => s + (Number(p) || 0), 0);
  const pct = Math.floor((earned / max) * 1000) / 10;
  return { earned, max, pct, passed: (earned / max) * 100 + 1e-9 >= UNSCRIPTED_PASS_PCT };
}

export function buildUnscriptedSession(maxDay = 1, count = UNSCRIPTED_COUNT, seed = Date.now()) {
  const rng = rngFrom(seed);
  const eligible = SITUATIONS.filter(s => s.minDay <= Math.max(1, maxDay));
  const base = eligible.length >= count ? eligible : SITUATIONS.filter(s => s.minDay <= 3);
  return shuffleSeeded(base, rng).slice(0, count);
}

// ---------------------------------------------------------------------------
// 2) STREET LISTENING — 3 realism levels
// ---------------------------------------------------------------------------
export const STREET_LEVELS = {
  normal: { id: 'normal', label: '🎧 ปกติ (ความเร็วห้องเรียน)', rate: 0.85, noise: null, passPct: 90, replays: 3 },
  fast: { id: 'fast', label: '⚡ คนจีนคุยเร็ว (1.2x)', rate: 1.2, noise: null, passPct: 90, replays: 2 },
  noisy: { id: 'noisy', label: '🏙️ เสียงรบกวนคาเฟ่/รถไฟใต้ดิน (1.2x)', rate: 1.2, noise: 'auto', passPct: 90, replays: 1 }
};

function collectListeningPool(maxDay) {
  const seen = new Set();
  const pool = [];
  const add = (it) => {
    const hz = String(it.hz || '').replace(/…/g, '').replace(/\s*\/\s*.*/, '').trim();
    if (!hz || seen.has(hz) || normalizeChinese(hz).length < 2) return;
    seen.add(hz);
    pool.push({ hz, py: String(it.py || '').replace(/\s*\/\s*.*/, '').trim(), th: it.th });
  };
  for (let d = 1; d <= Math.max(1, Math.min(30, maxDay)); d++) {
    const s = buildGuidedSession(d, []);
    s.speakItems.forEach(add);
    s.warmup.forEach(add);
  }
  if (pool.length < STREET_COUNT + 4) SURVIVAL_50.forEach(add);
  return pool;
}

export function buildStreetListeningSet(levelId = 'normal', maxDay = 1, count = STREET_COUNT, seed = Date.now()) {
  const level = STREET_LEVELS[levelId] || STREET_LEVELS.normal;
  const rng = rngFrom(seed);
  const pool = collectListeningPool(maxDay);
  const picked = shuffleSeeded(pool, rng).slice(0, Math.min(count, pool.length));
  const allThai = [...new Set(SURVIVAL_50.map(s => s.th))];
  const noiseKind = level.noise === 'auto' ? (rng() < 0.5 ? 'cafe' : 'subway') : level.noise;
  const questions = picked.map((it, i) => {
    const distractors = shuffleSeeded(allThai.filter(t => t !== it.th), rng).slice(0, 3);
    const options = shuffleSeeded([it.th, ...distractors], rng);
    return { id: `st-${i}`, hz: it.hz, py: it.py, th: it.th, options, answer: options.indexOf(it.th) };
  });
  return { level, noiseKind, questions };
}

export function evaluateStreetSet(correct, total, passPct = 90) {
  const pct = total > 0 ? Math.floor((correct / total) * 1000) / 10 : 0;
  return { correct, total, pct, passed: total > 0 && (correct / total) * 100 + 1e-9 >= passPct, passPct };
}

// ---------------------------------------------------------------------------
// 3) PATTERN SUBSTITUTION WORKSHOP (举一反三)
// ---------------------------------------------------------------------------
export const PATTERNS = [
  {
    id: 'shi', title: 'โครงสร้าง 是 / 不是 (เป็น / ไม่ใช่)',
    rule: 'ประธาน + 是 + นาม · ปฏิเสธใส่ 不 หน้า 是 (不是 อ่านว่า búshì) · ถามต่อท้ายด้วย 吗',
    items: [
      { th: 'ฉันเป็นนักเรียน', tiles: [['我', 'wǒ'], ['是', 'shì'], ['学生', 'xuésheng']] },
      { th: 'เขาไม่ใช่ครู', tiles: [['他', 'tā'], ['不是', 'búshì'], ['老师', 'lǎoshī']] },
      { th: 'คุณเป็นคนไทยใช่ไหม', tiles: [['你', 'nǐ'], ['是', 'shì'], ['泰国人', 'Tàiguórén'], ['吗', 'ma']] },
      { th: 'เธอเป็นเพื่อนของฉัน', tiles: [['她', 'tā'], ['是', 'shì'], ['我的', 'wǒ de'], ['朋友', 'péngyou']] },
      { th: 'นี่ไม่ใช่หนังสือของฉัน', tiles: [['这', 'zhè'], ['不是', 'búshì'], ['我的', 'wǒ de'], ['书', 'shū']] }
    ]
  },
  {
    id: 'you', title: 'โครงสร้าง 有 / 没有 (มี / ไม่มี)',
    rule: 'ประธาน + 有 + สิ่งของ · ปฏิเสธใช้ 没有 (ห้ามใช้ 不有) · ถามต่อท้ายด้วย 吗',
    items: [
      { th: 'ฉันมีพี่ชายหนึ่งคน', tiles: [['我', 'wǒ'], ['有', 'yǒu'], ['一个', 'yí gè'], ['哥哥', 'gēge']] },
      { th: 'ฉันไม่มีเงิน', tiles: [['我', 'wǒ'], ['没有', 'méiyǒu'], ['钱', 'qián']] },
      { th: 'คุณมีมือถือไหม', tiles: [['你', 'nǐ'], ['有', 'yǒu'], ['手机', 'shǒujī'], ['吗', 'ma']] },
      { th: 'บ้านเขามีสามคน', tiles: [['他家', 'tā jiā'], ['有', 'yǒu'], ['三个人', 'sān gè rén']] },
      { th: 'ที่นี่ไม่มีน้ำ', tiles: [['这里', 'zhèlǐ'], ['没有', 'méiyǒu'], ['水', 'shuǐ']] }
    ]
  },
  {
    id: 'xiang', title: 'โครงสร้าง 想 / 要 / 会 (อยาก / ต้องการ / เป็น-ทำได้)',
    rule: 'ประธาน + 想/要/会 + กริยา · ปฏิเสธ 不想 · 会 = ทำได้เพราะเรียนมา',
    items: [
      { th: 'ฉันอยากดื่มชา', tiles: [['我', 'wǒ'], ['想', 'xiǎng'], ['喝茶', 'hē chá']] },
      { th: 'ฉันขอน้ำหนึ่งแก้ว', tiles: [['我', 'wǒ'], ['要', 'yào'], ['一杯水', 'yì bēi shuǐ']] },
      { th: 'คุณอยากกินอะไร', tiles: [['你', 'nǐ'], ['想', 'xiǎng'], ['吃', 'chī'], ['什么', 'shénme']] },
      { th: 'ฉันไม่อยากไป', tiles: [['我', 'wǒ'], ['不想', 'bù xiǎng'], ['去', 'qù']] },
      { th: 'เขาพูดภาษาจีนได้', tiles: [['他', 'tā'], ['会', 'huì'], ['说', 'shuō'], ['中文', 'Zhōngwén']] }
    ]
  },
  {
    id: 'zai', title: 'โครงสร้าง 在 (อยู่ที่…)',
    rule: 'ประธาน + 在 + สถานที่ · ปฏิเสธ 不在 · ถามหาที่อยู่ใช้ 在哪儿',
    items: [
      { th: 'ฉันอยู่บ้าน', tiles: [['我', 'wǒ'], ['在', 'zài'], ['家', 'jiā']] },
      { th: 'แม่อยู่ที่ไหน', tiles: [['妈妈', 'māma'], ['在', 'zài'], ['哪儿', 'nǎr']] },
      { th: 'เขาไม่อยู่ที่โรงเรียน', tiles: [['他', 'tā'], ['不在', 'búzài'], ['学校', 'xuéxiào']] },
      { th: 'คุณครูอยู่ที่นี่', tiles: [['老师', 'lǎoshī'], ['在', 'zài'], ['这里', 'zhèlǐ']] },
      { th: 'ห้องน้ำอยู่ที่ไหน', tiles: [['洗手间', 'xǐshǒujiān'], ['在', 'zài'], ['哪里', 'nǎlǐ']] }
    ]
  },
  {
    id: 'wh', title: 'โครงสร้างคำถาม 什么 / 几 / 多少',
    rule: 'คำถามเรียงเหมือนประโยคบอกเล่า แค่แทนที่ช่องคำตอบด้วยคำถาม (ไม่ต้องย้ายที่)',
    items: [
      { th: 'นี่คืออะไร', tiles: [['这', 'zhè'], ['是', 'shì'], ['什么', 'shénme']] },
      { th: 'คุณอายุเท่าไหร่', tiles: [['你', 'nǐ'], ['几岁', 'jǐ suì']] },
      { th: 'อันนี้ราคาเท่าไหร่', tiles: [['这个', 'zhège'], ['多少钱', 'duōshao qián']] },
      { th: 'คุณชื่ออะไร', tiles: [['你', 'nǐ'], ['叫', 'jiào'], ['什么', 'shénme'], ['名字', 'míngzi']] },
      { th: 'ตอนนี้กี่โมง', tiles: [['现在', 'xiànzài'], ['几点', 'jǐ diǎn']] }
    ]
  },
  {
    id: 'hen', title: 'โครงสร้าง 很 / 太…了 (มาก / เกินไป)',
    rule: 'ประธาน + 很 + คุณศัพท์ (ห้ามลืม 很) · 太 + คุณศัพท์ + 了 = เกินไปแล้ว',
    items: [
      { th: 'แพงเกินไปแล้ว', tiles: [['太', 'tài'], ['贵', 'guì'], ['了', 'le']] },
      { th: 'ฉันดีใจมาก', tiles: [['我', 'wǒ'], ['很', 'hěn'], ['高兴', 'gāoxìng']] },
      { th: 'อากาศร้อนมาก', tiles: [['天气', 'tiānqì'], ['很', 'hěn'], ['热', 'rè']] },
      { th: 'อันนี้ใหญ่เกินไป', tiles: [['这个', 'zhège'], ['太', 'tài'], ['大', 'dà'], ['了', 'le']] },
      { th: 'วันนี้หนาวมาก', tiles: [['今天', 'jīntiān'], ['很', 'hěn'], ['冷', 'lěng']] }
    ]
  }
];

export function buildPatternDrill(patternId = null, seed = Date.now()) {
  const rng = rngFrom(seed);
  const pattern = PATTERNS.find(p => p.id === patternId) || shuffleSeeded(PATTERNS, rng)[0];
  const items = shuffleSeeded(pattern.items, rng).slice(0, PATTERN_COUNT).map((it, i) => {
    const expected = it.tiles.map(t => t[0]);
    let tiles = shuffleSeeded(it.tiles, rng);
    if (tiles.length > 1 && tiles.map(t => t[0]).join('') === expected.join('')) {
      tiles = [...tiles.slice(1), tiles[0]];
    }
    return {
      id: `${pattern.id}-${i}`,
      th: it.th,
      expectedHz: expected.join(''),
      expectedPy: it.tiles.map(t => t[1]).join(' '),
      tiles: tiles.map(t => ({ hz: t[0], py: t[1] }))
    };
  });
  return { pattern: { id: pattern.id, title: pattern.title, rule: pattern.rule }, items };
}

export function gradePatternAnswer(item, chosenHz = []) {
  return chosenHz.join('') === item.expectedHz;
}

export function evaluatePatternDrill(correct, total) {
  const pct = total > 0 ? Math.floor((correct / total) * 1000) / 10 : 0;
  return { correct, total, pct, passed: total > 0 && correct === total };
}

// ---------------------------------------------------------------------------
// 4) BLIND HANZI DICTATION (听写 without outline)
// ---------------------------------------------------------------------------
export function buildBlindDictationSet(maxDay = 1, count = BLIND_COUNT, seed = Date.now()) {
  const rng = rngFrom(seed);
  const seen = new Set();
  const pool = [];
  const push = (m) => {
    if (!m || seen.has(m.hz)) return;
    seen.add(m.hz);
    pool.push({ hz: m.hz, py: m.py, th: m.th });
  };
  for (let d = 1; d <= Math.max(1, Math.min(30, maxDay)); d++) {
    buildGuidedSession(d, []).mnemFocus.forEach(push);
  }
  if (pool.length < count) HANZI_MNEMONICS.forEach(push);
  return shuffleSeeded(pool, rng).slice(0, count);
}

export function judgeBlindResult(totalMistakes = 0) {
  const m = Math.max(0, Number(totalMistakes) || 0);
  return { mistakes: m, passed: m <= BLIND_MAX_MISTAKES };
}

// ---------------------------------------------------------------------------
// Persistence helpers for ext.month1.realWorld
// ---------------------------------------------------------------------------
export function recordRealWorldResult(realWorld = {}, kind, key, payload, todayKey) {
  const rw = { ...(realWorld || {}) };
  const bucket = { ...(rw[kind] || {}) };
  const prev = bucket[key] || {};
  const bestPct = Math.max(Number(prev.bestPct) || 0, Number(payload.pct) || 0);
  const passed = Boolean(prev.passed) || Boolean(payload.passed);
  bucket[key] = {
    bestPct,
    lastPct: Number(payload.pct) || 0,
    attempts: (Number(prev.attempts) || 0) + 1,
    passed,
    passedAt: passed ? (prev.passedAt || todayKey) : null,
    updatedAt: Date.now()
  };
  rw[kind] = bucket;
  return rw;
}

export function realWorldProgress(realWorld = {}) {
  const rw = realWorld || {};
  const unscripted = Boolean(rw.unscripted?.session?.passed);
  const street = ['normal', 'fast', 'noisy'].filter(k => rw.street?.[k]?.passed).length;
  const patterns = PATTERNS.filter(p => rw.pattern?.[p.id]?.passed).length;
  const blindChars = Array.isArray(rw.blindChars) ? rw.blindChars.length : 0;
  const certified = unscripted && street === 3 && patterns >= 3 && blindChars >= 10;
  return { unscripted, street, patterns, patternTotal: PATTERNS.length, blindChars, certified };
}
