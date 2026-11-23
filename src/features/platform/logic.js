// Pure logic helpers for the `platform` feature group (Node-testable, zero DOM deps)

export const DISPLAY_MODES = ['both', 'hanzi', 'pinyin', 'character'];
export const SFX_PACKS = ['classic', 'soft', 'off'];
export const DAILY_TTS_CAP = 150;

export const DATA_PACK_SIZES = [
  { name: 'level1-data.js', bytes: 84233, eager: true, label: 'Level 1 พินอิน & คำศัพท์' },
  { name: 'pinyin-chart-data.js', bytes: 28496, eager: true, label: 'ตารางพินอิน 405 พยางค์' },
  { name: 'writing-speaking-data.js', bytes: 12591, eager: true, label: 'ลำดับขีด & ฝึกพูด' },
  { name: 'daily-plan-data.js', bytes: 110910, eager: true, label: 'แผนเรียน 14 วัน & ควิซ 140 ข้อ' },
  { name: 'engagement-data.js', bytes: 4516, eager: true, label: 'บทสนทนา & กิจกรรม' },
  { name: 'level2-hsk1-data.js', bytes: 26862, eager: true, label: 'HSK 1 & ไวยากรณ์' },
  { name: 'pro-pack-data.js', bytes: 30947, eager: true, label: 'Pro Pack (เรื่องสั้น/รากศัพท์)' },
  { name: 'fun-pack-data.js', bytes: 7242, eager: true, label: 'Fun Pack (มินิเกม)' },
  { name: 'lexicon.js', bytes: 1106160, eager: false, label: 'พจนานุกรม HSK 1–7+ (10,969 คำ · Lazy)' }
];

export function normalizeDisplayMode(mode) {
  return DISPLAY_MODES.includes(mode) ? mode : 'both';
}

export function nextDisplayMode(current) {
  const idx = DISPLAY_MODES.indexOf(normalizeDisplayMode(current));
  return DISPLAY_MODES[(idx + 1) % DISPLAY_MODES.length];
}

export function normalizeSfxPack(pack) {
  return SFX_PACKS.includes(pack) ? pack : 'classic';
}

/**
 * Deterministic 32-bit FNV-1a hash for date strings like "2026-11-23".
 */
export function hashDateKey(dateKey) {
  const str = String(dateKey || '2026-01-01');
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Pick a deterministic Word of the Day from a list of vocab items.
 * Normalizes different vocab shapes ({zh/hanzi, py/pinyin, th/meaning, ex/example}).
 */
export function pickWordOfTheDay(words, dateKey) {
  if (!Array.isArray(words) || words.length === 0) return null;
  const idx = hashDateKey(dateKey) % words.length;
  const raw = words[idx];
  if (!raw) return null;
  const hanzi = raw.zh || raw.hanzi || raw.word || raw.char || '';
  const pinyin = raw.py || raw.pinyin || '';
  const thai = raw.th || raw.meaning || raw.thai || '';
  const exampleZh = raw.exZh || raw.exampleZh || (raw.example && raw.example.zh) || '';
  const examplePy = raw.exPy || raw.examplePy || (raw.example && raw.example.py) || '';
  const exampleTh = raw.exTh || raw.exampleTh || (raw.example && raw.example.th) || '';
  return {
    index: idx,
    dateKey: String(dateKey || ''),
    hanzi,
    pinyin,
    thai,
    level: raw.level || raw.hsk || 'HSK 1',
    exampleZh,
    examplePy,
    exampleTh
  };
}

/**
 * Parse "HH:MM" into { hours, minutes } or null if invalid.
 */
export function parseTimeSlot(slot) {
  if (typeof slot !== 'string') return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(slot.trim());
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return {
    hours,
    minutes,
    normalized: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
  };
}

/**
 * Compute milliseconds until the next scheduled reminder from `now`.
 * Returns { slot, delayMs, fireAt } or null if no valid slots.
 */
export function computeNextReminder(slots, now = new Date()) {
  if (!Array.isArray(slots) || slots.length === 0) return null;
  const nowMs = now.getTime();
  let best = null;
  for (const raw of slots) {
    const parsed = parseTimeSlot(raw);
    if (!parsed) continue;
    const candidate = new Date(nowMs);
    candidate.setHours(parsed.hours, parsed.minutes, 0, 0);
    if (candidate.getTime() <= nowMs + 1000) {
      candidate.setDate(candidate.getDate() + 1);
    }
    const delayMs = candidate.getTime() - nowMs;
    if (!best || delayMs < best.delayMs) {
      best = { slot: parsed.normalized, delayMs, fireAt: candidate };
    }
  }
  return best;
}

/**
 * Format bytes into human-readable string (B, KB, MB, GB).
 */
export function formatBytes(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return '0 B';
  if (n < 1024) return `${Math.round(n)} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Compute remaining daily TTS quota given stored { date, count }.
 */
export function getRemainingTtsQuota(usage, todayKey, cap = DAILY_TTS_CAP) {
  const used = usage && usage.date === todayKey ? Math.max(0, Number(usage.count) || 0) : 0;
  return {
    used,
    cap,
    remaining: Math.max(0, cap - used)
  };
}

/**
 * Build a deduplicated list of Chinese phrases from vocab items, capped at `limit`.
 */
export function buildAudioPackItems(words, limit = DAILY_TTS_CAP) {
  if (!Array.isArray(words)) return [];
  const seen = new Set();
  const out = [];
  for (const w of words) {
    const text = (typeof w === 'string' ? w : (w && (w.zh || w.hanzi || w.word))) || '';
    const trimmed = text.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
    if (out.length >= limit) break;
  }
  return out;
}
