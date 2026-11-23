/**
 * Pure cloud progress merging utilities with per-item timestamp resolution.
 */

export function mergeTimestampedMap(localMap, cloudMap, fallbackScore) {
  const out = {};
  const keys = new Set([
    ...Object.keys(localMap || {}),
    ...Object.keys(cloudMap || {})
  ]);
  for (const k of keys) {
    const a = localMap ? localMap[k] : null;
    const b = cloudMap ? cloudMap[k] : null;
    if (!a) { out[k] = b; continue; }
    if (!b) { out[k] = a; continue; }
    const tsA = Number(a.updatedAt || 0);
    const tsB = Number(b.updatedAt || 0);
    if (tsA !== tsB) {
      out[k] = tsA > tsB ? a : b;
    } else {
      out[k] = fallbackScore(a) >= fallbackScore(b) ? a : b;
    }
  }
  return out;
}

export function mergeMaxNumMap(localMap, cloudMap) {
  const out = {};
  const keys = new Set([
    ...Object.keys(localMap || {}),
    ...Object.keys(cloudMap || {})
  ]);
  for (const k of keys) {
    out[k] = Math.max(Number(localMap?.[k] || 0), Number(cloudMap?.[k] || 0));
  }
  return out;
}

export function mergeCloudProgressData(localP, cloudP) {
  if (!cloudP || typeof cloudP !== 'object') return localP;
  const merged = { ...localP, ...cloudP };
  const uniqArr = (a, b) => [...new Set([...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])])];

  merged.initials = uniqArr(localP.initials, cloudP.initials);
  merged.finals = uniqArr(localP.finals, cloudP.finals);
  merged.writing = uniqArr(localP.writing, cloudP.writing);
  merged.vocabStarred = uniqArr(localP.vocabStarred, cloudP.vocabStarred);
  merged.ownedItems = uniqArr(localP.ownedItems, cloudP.ownedItems);
  merged.frozenDays = uniqArr(localP.frozenDays, cloudP.frozenDays);
  merged.streakFreezes = Math.max(localP.streakFreezes || 0, cloudP.streakFreezes || 0);

  // Keep earliest learned date per vocab ID
  const learnedOut = { ...(localP.vocabLearned || {}) };
  for (const [k, v] of Object.entries(cloudP.vocabLearned || {})) {
    if (!learnedOut[k] || (v && v < learnedOut[k])) learnedOut[k] = v;
  }
  merged.vocabLearned = learnedOut;

  // Pick newer SRS record per word based on updatedAt (fallback to review count)
  merged.vocabSrs = mergeTimestampedMap(
    localP.vocabSrs,
    cloudP.vocabSrs,
    (x) => (Number(x.reviews || 0) * 10) + Number(x.step || 0)
  );
  merged.srs = mergeTimestampedMap(
    localP.srs,
    cloudP.srs,
    (x) => (Number(x.reps || 0) * 10) + Number(x.interval || 0)
  );

  merged.vocabNotes = { ...(localP.vocabNotes || {}), ...(cloudP.vocabNotes || {}) };
  merged.dayScores = mergeMaxNumMap(localP.dayScores, cloudP.dayScores);
  merged.activity = mergeMaxNumMap(localP.activity, cloudP.activity);
  merged.bonusXp = Math.max(localP.bonusXp || 0, cloudP.bonusXp || 0);
  merged.drillCorrect = Math.max(localP.drillCorrect || 0, cloudP.drillCorrect || 0);
  merged.bestQuiz = Math.max(localP.bestQuiz || 0, cloudP.bestQuiz || 0) || null;
  merged.speedBest = Math.max(localP.speedBest || 0, cloudP.speedBest || 0);
  merged.rainBest = Math.max(localP.rainBest || 0, cloudP.rainBest || 0);
  merged.vocabMatchBest = Math.max(localP.vocabMatchBest || 0, cloudP.vocabMatchBest || 0);
  merged.vocabRainBest = Math.max(localP.vocabRainBest || 0, cloudP.vocabRainBest || 0);
  merged.vocabQuizCount = Math.max(localP.vocabQuizCount || 0, cloudP.vocabQuizCount || 0);

  return merged;
}
