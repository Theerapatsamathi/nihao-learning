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

  merged.vocabNotes = { ...(localP.vocabNotes || {}) };
  for (const [k, v] of Object.entries(cloudP.vocabNotes || {})) {
    if (!merged.vocabNotes[k] || (v && String(v).trim().length > String(merged.vocabNotes[k]).trim().length)) {
      merged.vocabNotes[k] = v;
    }
  }

  // Merge completed day lesson blocks (dayChecks: { [day]: [blockIds] })
  const mergedDayChecks = { ...(localP.dayChecks || {}) };
  for (const [day, arr] of Object.entries(cloudP.dayChecks || {})) {
    const localArr = Array.isArray(mergedDayChecks[day]) ? mergedDayChecks[day] : [];
    const cloudArr = Array.isArray(arr) ? arr : [];
    mergedDayChecks[day] = uniqArr(localArr, cloudArr);
  }
  merged.dayChecks = mergedDayChecks;

  // Mistakes & Vocab Mistakes deduplication by item ID
  const mergeMistakes = (listA, listB) => {
    const map = new Map();
    for (const m of (Array.isArray(listA) ? listA : [])) {
      if (m?.id) map.set(m.id, { ...m });
    }
    for (const m of (Array.isArray(listB) ? listB : [])) {
      if (m?.id) {
        const prev = map.get(m.id);
        if (prev) {
          prev.misses = Math.max(prev.misses || 1, m.misses || 1);
        } else {
          map.set(m.id, { ...m });
        }
      }
    }
    return Array.from(map.values()).slice(-40);
  };
  merged.mistakes = mergeMistakes(localP.mistakes, cloudP.mistakes);
  merged.vocabMistakes = mergeMistakes(localP.vocabMistakes, cloudP.vocabMistakes);

  merged.spentCoins = Math.max(localP.spentCoins || 0, cloudP.spentCoins || 0);
  merged.vocabGoal = Math.max(localP.vocabGoal || 100, cloudP.vocabGoal || 100);
  merged.vocabMilestones = { ...(localP.vocabMilestones || {}), ...(cloudP.vocabMilestones || {}) };
  merged.equipped = { ...(localP.equipped || {}), ...(cloudP.equipped || {}) };

  // Daily quest state: keep highest counts if same day
  if (localP.daily && cloudP.daily && localP.daily.date === cloudP.daily.date) {
    merged.daily = {
      date: localP.daily.date,
      drills: Math.max(localP.daily.drills || 0, cloudP.daily.drills || 0),
      writes: Math.max(localP.daily.writes || 0, cloudP.daily.writes || 0),
      srs: Math.max(localP.daily.srs || 0, cloudP.daily.srs || 0),
      claimed: uniqArr(localP.daily.claimed, cloudP.daily.claimed)
    };
  } else {
    merged.daily = cloudP.daily || localP.daily || null;
  }

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

  // Feature plugin namespaces: newest namespace object wins (by updatedAt), with deep merge for month1 mastery
  merged.ext = mergeTimestampedMap(localP.ext || {}, cloudP.ext || {}, () => 0);
  if (localP.ext?.month1 || cloudP.ext?.month1) {
    const mLocal = localP.ext?.month1 || {};
    const mCloud = cloudP.ext?.month1 || {};
    const mergedM1 = { ...(merged.ext.month1 || {}) };
    mergedM1.doneDays = uniqArr(mLocal.doneDays, mCloud.doneDays);
    mergedM1.tonePairsDone = uniqArr(mLocal.tonePairsDone, mCloud.tonePairsDone);
    mergedM1.mnemonicsDone = uniqArr(mLocal.mnemonicsDone, mCloud.mnemonicsDone);
    mergedM1.survivalDone = uniqArr(mLocal.survivalDone, mCloud.survivalDone);
    if (mLocal.dayMastery || mCloud.dayMastery) {
      const dm = {};
      const allDays = new Set([
        ...Object.keys(mLocal.dayMastery || {}),
        ...Object.keys(mCloud.dayMastery || {})
      ]);
      for (const k of allDays) {
        const a = mLocal.dayMastery?.[k] || {};
        const b = mCloud.dayMastery?.[k] || {};
        const newer = (Number(b.updatedAt) || 0) >= (Number(a.updatedAt) || 0) ? b : a;
        const bestPct = Math.max(Number(a.bestPct) || 0, Number(b.bestPct) || 0);
        dm[k] = {
          ...a,
          ...b,
          ...newer,
          bestPct,
          attempts: Math.max(Number(a.attempts) || 0, Number(b.attempts) || 0),
          verifyTier: Math.max(Number(a.verifyTier) || 0, Number(b.verifyTier) || 0),
          passed: Boolean(a.passed || b.passed) && bestPct >= 95
        };
      }
      mergedM1.dayMastery = dm;
    }
    if (mLocal.weeklyBoss || mCloud.weeklyBoss) {
      const wb = {};
      const bossKeys = new Set([
        ...Object.keys(mLocal.weeklyBoss || {}),
        ...Object.keys(mCloud.weeklyBoss || {})
      ]);
      for (const k of bossKeys) {
        const a = mLocal.weeklyBoss?.[k] || {};
        const b = mCloud.weeklyBoss?.[k] || {};
        const bestPct = Math.max(Number(a.bestPct) || 0, Number(b.bestPct) || 0);
        wb[k] = {
          ...a,
          ...b,
          bestPct,
          attempts: Math.max(Number(a.attempts) || 0, Number(b.attempts) || 0),
          passed: Boolean(a.passed || b.passed) && bestPct >= 95
        };
      }
      mergedM1.weeklyBoss = wb;
    }
    if (mLocal.fsrsDeck || mCloud.fsrsDeck) {
      mergedM1.fsrsDeck = mergeTimestampedMap(
        mLocal.fsrsDeck || {},
        mCloud.fsrsDeck || {},
        (x) => (x?.srs?.reviews || 0) * 10 + (x?.srs?.step || 0)
      );
    }
    if (mLocal.realWorld || mCloud.realWorld) {
      const a = mLocal.realWorld || {};
      const b = mCloud.realWorld || {};
      const rw = { blindChars: uniqArr(a.blindChars, b.blindChars) };
      for (const kind of ['unscripted', 'street', 'pattern', 'blind']) {
        const ka = a[kind] || {};
        const kb = b[kind] || {};
        const out = {};
        for (const key of new Set([...Object.keys(ka), ...Object.keys(kb)])) {
          const ra = ka[key] || {};
          const rb = kb[key] || {};
          const newer = (Number(rb.updatedAt) || 0) >= (Number(ra.updatedAt) || 0) ? rb : ra;
          out[key] = {
            ...ra,
            ...rb,
            ...newer,
            bestPct: Math.max(Number(ra.bestPct) || 0, Number(rb.bestPct) || 0),
            attempts: Math.max(Number(ra.attempts) || 0, Number(rb.attempts) || 0),
            passed: Boolean(ra.passed || rb.passed)
          };
        }
        rw[kind] = out;
      }
      mergedM1.realWorld = rw;
    }
    merged.ext.month1 = mergedM1;
  }

  return merged;
}
