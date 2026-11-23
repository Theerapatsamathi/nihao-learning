/**
 * Anki-style SM-2 spaced repetition scheduler (backwards-compatible with legacy step entries).
 */

export const LEGACY_STEP_INTERVALS = [1, 3, 7, 14, 30];
export const DEFAULT_EASE = 2.5;
export const MIN_EASE = 1.3;
export const MAX_INTERVAL_DAYS = 180;

export function addDaysToDateKey(dateStr, days) {
  const base = new Date(`${dateStr}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + Math.max(0, Math.round(days)));
  return base.toISOString().slice(0, 10);
}

/**
 * Normalizes a legacy or SM-2 SRS record into a consistent shape.
 */
export function normalizeSrsEntry(raw, todayKey) {
  const step = Number.isFinite(raw?.step) ? Math.max(0, Math.floor(raw.step)) : 0;
  const legacyInterval = LEGACY_STEP_INTERVALS[Math.min(LEGACY_STEP_INTERVALS.length - 1, step)] || 1;
  return {
    step,
    interval: Number.isFinite(raw?.interval) && raw.interval >= 0 ? raw.interval : (raw?.reviews ? legacyInterval : 0),
    ease: Number.isFinite(raw?.ease) ? Math.max(MIN_EASE, raw.ease) : DEFAULT_EASE,
    reviews: Number.isFinite(raw?.reviews) ? Math.max(0, Math.floor(raw.reviews)) : 0,
    lapses: Number.isFinite(raw?.lapses) ? Math.max(0, Math.floor(raw.lapses)) : 0,
    nextDue: typeof raw?.nextDue === 'string' ? raw.nextDue : todayKey,
    updatedAt: Number.isFinite(raw?.updatedAt) ? raw.updatedAt : 0
  };
}

/**
 * Pure SM-2 scheduling function.
 * @param {object} rawEntry - Existing SRS record (or null/undefined for new word)
 * @param {'again'|'hard'|'good'|'easy'} rate - Learner rating
 * @param {string} todayKey - YYYY-MM-DD
 * @param {number} [nowMs] - Timestamp in ms
 */
export function computeNextSm2(rawEntry, rate, todayKey, nowMs = Date.now()) {
  const cur = normalizeSrsEntry(rawEntry, todayKey);
  let { ease, interval, step, reviews, lapses } = cur;

  if (rate === 'again') {
    step = 0;
    interval = 0;
    lapses += 1;
    ease = Math.max(MIN_EASE, Number((ease - 0.2).toFixed(2)));
    return {
      step,
      interval,
      ease,
      reviews: reviews + 1,
      lapses,
      nextDue: todayKey,
      updatedAt: nowMs
    };
  }

  if (rate === 'hard') {
    interval = interval <= 1 ? 1 : Math.max(1, Math.round(interval * 1.2));
    ease = Math.max(MIN_EASE, Number((ease - 0.15).toFixed(2)));
    step = Math.max(0, Math.min(4, step));
  } else if (rate === 'good') {
    if (interval <= 0) interval = 1;
    else if (interval === 1) interval = 3;
    else interval = Math.min(MAX_INTERVAL_DAYS, Math.round(interval * ease));
    step = Math.min(4, step + 1);
  } else {
    // easy
    if (interval <= 0) interval = 4;
    else if (interval === 1) interval = 6;
    else interval = Math.min(MAX_INTERVAL_DAYS, Math.round(interval * ease * 1.3));
    ease = Number(Math.min(3.2, ease + 0.15).toFixed(2));
    step = Math.min(4, step + 2);
  }

  return {
    step,
    interval,
    ease,
    reviews: reviews + 1,
    lapses,
    nextDue: addDaysToDateKey(todayKey, interval),
    updatedAt: nowMs
  };
}

/**
 * Computes SRS retention rate (%) from vocabSrs map.
 */
export function computeSrsRetention(vocabSrs) {
  const entries = Object.values(vocabSrs || {}).filter((x) => x && typeof x === 'object');
  let totalReviews = 0;
  let totalLapses = 0;
  let mastered = 0;
  for (const e of entries) {
    const rev = Number(e.reviews || 0);
    const lap = Number(e.lapses || 0);
    totalReviews += rev;
    totalLapses += lap;
    if ((Number(e.interval || 0) >= 7) || Number(e.step || 0) >= 2) mastered++;
  }
  const retentionPct = totalReviews > 0
    ? Math.max(0, Math.min(100, Math.round(((totalReviews - totalLapses) / totalReviews) * 100)))
    : null;
  return { totalTracked: entries.length, totalReviews, mastered, retentionPct };
}
