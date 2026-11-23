import * as NetlifyAuthMod from '@netlify/identity';
import { computeNextSm2, computeSrsRetention } from './modules/srs-sm2.js';
import { mergeCloudProgressData } from './modules/progress-merge.js';
if (typeof window !== 'undefined') {
  window.NetlifyAuth = NetlifyAuthMod;
}

(() => {
  const DATA = window.LEVEL1_DATA;
  const CHART = window.PINYIN_CHART_DATA;
  const WS = window.WRITING_SPEAKING_DATA;
  const PLAN = window.DAILY_PLAN_DATA;
  const ENG = window.ENGAGEMENT_DATA;
  const L2 = window.LEVEL2_DATA;
  const PRO = window.PRO_PACK_DATA;
  const FUN = window.FUN_PACK_DATA;
  let LEXICON = Array.isArray(window.LEXICON) ? window.LEXICON : [];
  let lexiconLoadPromise = null;
  function ensureLexiconLoaded() {
    if (LEXICON.length > 0) return Promise.resolve(LEXICON);
    if (lexiconLoadPromise) return lexiconLoadPromise;
    lexiconLoadPromise = new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = '/data/lexicon.js';
      s.async = true;
      s.onload = () => {
        LEXICON = Array.isArray(window.LEXICON) ? window.LEXICON : [];
        vocabIndexCache = null;
        resolve(LEXICON);
      };
      s.onerror = () => {
        lexiconLoadPromise = null;
        resolve([]);
      };
      document.head.appendChild(s);
    });
    return lexiconLoadPromise;
  }
  const STORAGE_KEY = 'nihao-level1-v2';

  const DAILY_PASS_SCORE = 8;

  function todayKey(offsetDays = 0) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().slice(0, 10);
  }

  // ---- Web Audio Micro-Chimes & Floating XP Toast ----
  let sfxEnabled = (() => {
    try { return localStorage.getItem('nihao-sfx') !== 'off'; } catch { return true; }
  })();
  let audioCtx = null;

  // ---- Feature plugin event bus (used by src/features/*) ----
  const coreBus = new EventTarget();
  function emitCore(name, detail = {}) {
    try { coreBus.dispatchEvent(new CustomEvent(name, { detail })); } catch { /* ignore */ }
  }

  function playChime(type, noEvent = false) {
    if (!noEvent && type === 'ok') emitCore('answer', { correct: true });
    else if (!noEvent && type === 'err') emitCore('answer', { correct: false });
    if (!sfxEnabled) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!audioCtx) audioCtx = new Ctx();
      if (audioCtx.state === 'suspended') audioCtx.resume();

      const now = audioCtx.currentTime;
      const playTone = (freq, start, dur, vol = 0.06) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(vol, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(start);
        osc.stop(start + dur + 0.02);
      };

      if (type === 'ok') {
        playTone(587.33, now, 0.12, 0.055);
        playTone(880, now + 0.07, 0.18, 0.06);
      } else if (type === 'err') {
        playTone(260, now, 0.16, 0.05);
        if (typeof pandaReact === 'function') pandaReact('encourage');
      } else if (type === 'levelup') {
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => playTone(f, now + i * 0.08, 0.24, 0.07));
      }
    } catch {
      // Ignore audio errors
    }
  }

  function showToast(text, ptsText = '', isLevelUp = false) {
    const host = document.getElementById('toast-container');
    if (!host) return;
    const el = document.createElement('div');
    el.className = 'xp-toast' + (isLevelUp ? ' levelup' : '');
    el.innerHTML = `${ptsText ? `<span class="xp-toast-pts">${escapeHtml(ptsText)}</span>` : ''}<span>${escapeHtml(text)}</span>`;
    host.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }

  // ---- State ----
  const initialProgress = loadProgress();
  const firstUnpassedDay = (PLAN.find(d => (initialProgress.dayScores[d.day] || 0) < DAILY_PASS_SCORE) || PLAN[0]).day;

  const state = {
    rate: 0.85,
    activeTab: 'plan',
    selectedDay: firstUnpassedDay,
    dailyQuiz: { idx: 0, score: 0, answered: false, started: false },
    selectedInitial: 'b',
    finalsFilter: 'all',
    selectedToneSet: 0,
    chartFilter: 'all',
    selectedChartKey: 'b|a',
    combiner: { initial: 'b', final: 'a', tone: 1 },
    writingIdx: 0,
    writingMode: 'quiz',
    writingOutline: true,
    drillMode: 'tones',
    pairFilter: 'all',
    drillStreak: 0,
    currentDrill: null,
    speakingIdx: 0,
    isListening: false,
    quizIndex: 0,
    quizScore: 0,
    quizAnswered: false,
    selectedVocabPack: 0,
    vocabMode: 'bank',
    vocabLevel: 'all',
    vocabTopic: 'all',
    vocabSet: 1,
    vocabSprint: { seconds: 15 * 60, running: false, timerId: null },
    confusableQuiz: { active: false, idx: 0, score: 0, answered: false, picked: -1, questions: [] },
    vocabStatusFilter: 'all',
    vocabQuery: '',
    vocabViewMode: 'grid',
    vocabHideMeaning: false,
    vocabHidePinyin: false,
    vocabAutoPlay: false,
    vocabAutoPlayPos: -1,
    vocabAutoPlayTimer: null,
    vocabQuiz: {
      source: 'today',
      count: 20,
      qType: 'zh2th',
      showPinyin: true,
      active: false,
      finished: false,
      questions: [],
      idx: 0,
      score: 0,
      streak: 0,
      bestStreak: 0,
      answered: false,
      pickedIdx: -1,
      wrongItems: [],
      listening: false,
      spokenText: '',
      speakHint: false,
      typedInput: ''
    },
    vocabPodcast: {
      source: 'today',
      playing: false,
      idx: 0,
      readThai: true,
      repeatZh: true,
      loop: true,
      timerId: null,
      items: []
    },
    vocabSrsSession: { queue: [], idx: 0, flipped: false, doneCount: 0, earlyMode: false },
    vocabGame: {
      mode: 'match',
      source: 'today',
      active: false,
      finished: false,
      score: 0,
      combo: 0,
      bestCombo: 0,
      timeLeft: 60,
      lives: 3,
      timerId: null,
      pool: [],
      // Speed Match state
      pairs: [],
      leftOrder: [],
      rightOrder: [],
      selLeft: null,
      selRight: null,
      matchedIds: [],
      clearedCount: 0,
      // Hanzi Rain state
      rainWord: null,
      rainChoices: [],
      rainY: 0,
      rainSpeed: 1.35,
      rainCaught: 0
    },
    vocabStory: {
      source: 'today',
      busy: false,
      words: [],
      story: null,
      showPy: true,
      showTh: true,
      playingAll: false
    },
    srsSubMode: 'flashcard',
    srsFlipped: false,
    selectedDialogue: 0,
    dialogueShowPinyin: true,
    dialogueShowThai: true,
    l2SubMode: 'builder',
    builderIdx: 0,
    builderPicked: [],
    builderShowPy: true,
    builderChecked: false,
    hskCat: 'all',
    hskQuery: '',
    selectedReader: 0,
    readerShowPy: false,
    readerInsp: null,
    readerAnswers: {},
    typingIdx: 0,
    gameSubMode: 'speed',
    podcastDeck: 'level1',
    podcastIdx: 0,
    podcastPlaying: false,
    podcastTimer: null,
    aiStatus: { configured: false, model: 'gemini-4-hydrogen' },
    tutorInteractionId: null,
    tutorBusy: false,
    storyBusy: false,
    tutorLog: [
      {
        from: 'bot',
        hz: '你好！我是你的中文老师。你叫什么名字？',
        py: 'Nǐ hǎo! Wǒ shì nǐ de Zhōngwén lǎoshī. Nǐ jiào shénme míngzi?',
        th: 'สวัสดี! ฉันคือครูสอนภาษาจีนของคุณ คุณชื่ออะไรเหรอ?',
        tip: 'ลองตอบด้วยประโยค "我叫... (ฉันชื่อ...)" หรือกดปุ่มคำตอบด่วนด้านล่างได้เลย!'
      }
    ],
    syncId: (() => { try { return localStorage.getItem('nihao-sync-id') || ''; } catch { return ''; } })(),
    progress: initialProgress
  };

  function ensureTodayDaily(p) {
    const tk = todayKey();
    if (!p.daily || p.daily.date !== tk) {
      p.daily = { date: tk, drills: 0, writes: 0, srs: 0, claimed: [] };
    }
    return p.daily;
  }

  function loadProgress() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || localStorage.getItem('nihao-level1-v1') || '{}');
      const p = {
        initials: Array.isArray(raw.initials) ? raw.initials : [],
        finals: Array.isArray(raw.finals) ? raw.finals : [],
        writing: Array.isArray(raw.writing) ? raw.writing : [],
        dayScores: raw.dayScores && typeof raw.dayScores === 'object' ? raw.dayScores : {},
        dayChecks: raw.dayChecks && typeof raw.dayChecks === 'object' ? raw.dayChecks : {},
        drillCorrect: Number.isInteger(raw.drillCorrect) ? raw.drillCorrect : 0,
        bestQuiz: Number.isInteger(raw.bestQuiz) ? raw.bestQuiz : null,
        activity: raw.activity && typeof raw.activity === 'object' ? raw.activity : {},
        daily: raw.daily && typeof raw.daily === 'object' ? raw.daily : null,
        bonusXp: Number.isInteger(raw.bonusXp) ? raw.bonusXp : 0,
        mistakes: Array.isArray(raw.mistakes) ? raw.mistakes : [],
        srs: raw.srs && typeof raw.srs === 'object' ? raw.srs : {},
        speedBest: Number.isInteger(raw.speedBest) ? raw.speedBest : 0,
        rainBest: Number.isInteger(raw.rainBest) ? raw.rainBest : 0,
        ownedItems: Array.isArray(raw.ownedItems) ? raw.ownedItems : [],
        equipped: raw.equipped && typeof raw.equipped === 'object' ? raw.equipped : {},
        spentCoins: Number.isInteger(raw.spentCoins) ? raw.spentCoins : 0,
        vocabLearned: raw.vocabLearned && typeof raw.vocabLearned === 'object' ? raw.vocabLearned : {},
        vocabGoal: Number.isInteger(raw.vocabGoal) && raw.vocabGoal >= 10 ? raw.vocabGoal : 100,
        vocabMilestones: raw.vocabMilestones && typeof raw.vocabMilestones === 'object' ? raw.vocabMilestones : {},
        vocabMistakes: Array.isArray(raw.vocabMistakes) ? raw.vocabMistakes : [],
        vocabQuizCount: Number.isInteger(raw.vocabQuizCount) ? raw.vocabQuizCount : 0,
        vocabSrs: raw.vocabSrs && typeof raw.vocabSrs === 'object' ? raw.vocabSrs : {},
        vocabMatchBest: Number.isInteger(raw.vocabMatchBest) ? raw.vocabMatchBest : 0,
        vocabRainBest: Number.isInteger(raw.vocabRainBest) ? raw.vocabRainBest : 0,
        vocabStarred: Array.isArray(raw.vocabStarred) ? raw.vocabStarred : [],
        vocabNotes: raw.vocabNotes && typeof raw.vocabNotes === 'object' ? raw.vocabNotes : {},
        streakFreezes: Number.isInteger(raw.streakFreezes) && raw.streakFreezes >= 0 ? raw.streakFreezes : 0,
        frozenDays: Array.isArray(raw.frozenDays) ? raw.frozenDays : [],
        ext: raw.ext && typeof raw.ext === 'object' && !Array.isArray(raw.ext) ? raw.ext : {}
      };
      ensureTodayDaily(p);
      return p;
    } catch {
      const p = { initials: [], finals: [], writing: [], dayScores: {}, dayChecks: {}, drillCorrect: 0, bestQuiz: null, activity: {}, daily: null, bonusXp: 0, mistakes: [], srs: {}, speedBest: 0, rainBest: 0, ownedItems: [], equipped: {}, spentCoins: 0, vocabLearned: {}, vocabGoal: 100, vocabMilestones: {}, vocabMistakes: [], vocabQuizCount: 0, vocabSrs: {}, vocabMatchBest: 0, vocabRainBest: 0, vocabStarred: [], vocabNotes: {}, streakFreezes: 0, frozenDays: [], ext: {} };
      ensureTodayDaily(p);
      return p;
    }
  }

  let lastKnownXp = null;
  let lastKnownLevel = null;

  function logActivity(units = 1) {
    const tk = todayKey();
    state.progress.activity[tk] = (state.progress.activity[tk] || 0) + units;
  }

  function recordMistake(item) {
    const list = state.progress.mistakes;
    const existing = list.find(m => m.id === item.id);
    if (existing) {
      existing.misses = (existing.misses || 1) + 1;
      existing.streakOk = 0;
    } else {
      list.push({ ...item, misses: 1, streakOk: 0 });
    }
    if (list.length > 30) list.shift();
  }

  function saveProgress(reason = '') {
    logActivity(1);
    const stats = computeGameStats();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
    } catch {
      // Ignore storage quota errors
    }
    emitCore('progress', { reason, xp: stats.xp, xpGained: lastKnownXp !== null ? Math.max(0, stats.xp - lastKnownXp) : 0, level: stats.level });
    if (lastKnownXp !== null && stats.xp > lastKnownXp) {
      const diff = stats.xp - lastKnownXp;
      if (lastKnownLevel !== null && stats.level > lastKnownLevel) {
        playChime('levelup');
        showToast(`LEVEL UP! ขึ้นเลเวล ${stats.level} (${stats.rank.th})`, `+${diff} XP`, true);
        if (typeof pandaReact === 'function') pandaReact('levelup', stats.level);
      } else {
        playChime('ok', true);
        showToast(reason || 'บันทึกความคืบหน้าแล้ว', `+${diff} XP`, false);
        if (typeof pandaReact === 'function') pandaReact('happy', stats.level);
      }
    }
    lastKnownXp = stats.xp;
    lastKnownLevel = stats.level;
    updateDashboard();
    scheduleCloudSync();
  }

  // ---- Speech Synthesis Engine (/api/tts primary + Web Speech fallback) ----
  let zhVoice = null;
  let thVoice = null;
  let currentAudio = null;
  let speakSeq = 0;
  const ttsBlobCache = new Map();

  function pickZhVoice() {
    if (!('speechSynthesis' in window)) return;
    const voices = speechSynthesis.getVoices();
    zhVoice =
      voices.find(v => v.lang === 'zh-CN' && /Google|Microsoft|Xiaoxiao|Tingting/i.test(v.name)) ||
      voices.find(v => v.lang === 'zh-CN') ||
      voices.find(v => v.lang && v.lang.toLowerCase().startsWith('zh')) ||
      null;
    thVoice =
      voices.find(v => v.lang === 'th-TH' && /Google|Microsoft|Premwadee|Niwat/i.test(v.name)) ||
      voices.find(v => v.lang && v.lang.toLowerCase().startsWith('th')) ||
      null;
  }

  if ('speechSynthesis' in window) {
    pickZhVoice();
    speechSynthesis.onvoiceschanged = pickZhVoice;
  }

  function showAudioNotice(msg) {
    const banner = document.getElementById('audio-banner');
    if (!banner) return;
    banner.textContent = msg;
    banner.classList.add('show');
  }

  function hideAudioNotice() {
    const banner = document.getElementById('audio-banner');
    if (banner) banner.classList.remove('show');
  }

  function stopSpeech() {
    speakSeq++;
    if (currentAudio) {
      try {
        currentAudio.onplaying = null;
        currentAudio.onended = null;
        currentAudio.onerror = null;
        currentAudio.pause();
        currentAudio.currentTime = 0;
      } catch {
        // Ignore cleanup errors
      }
      currentAudio = null;
    }
    if ('speechSynthesis' in window) {
      try { speechSynthesis.cancel(); } catch { /* ignore */ }
    }
  }

  let serverTtsDisabled = false;

  async function getTtsBlobUrl(text, lang) {
    if (serverTtsDisabled) throw new Error('Server TTS disabled');
    const key = `${lang}::${text}`;
    if (ttsBlobCache.has(key)) return ttsBlobCache.get(key);
    const url = `/api/tts?lang=${encodeURIComponent(lang)}&text=${encodeURIComponent(text)}`;
    const res = await fetch(url, { credentials: 'same-origin' });
    if (res.status === 501) {
      serverTtsDisabled = true;
      throw new Error('TTS provider not configured');
    }
    if (!res.ok) throw new Error(`TTS HTTP ${res.status}`);
    const blob = await res.blob();
    if (!blob || blob.size < 200) throw new Error('Empty TTS audio');
    const objUrl = URL.createObjectURL(blob);
    if (ttsBlobCache.size >= 200) {
      const oldestKey = ttsBlobCache.keys().next().value;
      const oldUrl = ttsBlobCache.get(oldestKey);
      ttsBlobCache.delete(oldestKey);
      try { URL.revokeObjectURL(oldUrl); } catch { /* ignore */ }
    }
    ttsBlobCache.set(key, objUrl);
    return objUrl;
  }

  function playServerTts(text, lang, rate, seq, onEnd, onFail) {
    if (window.location.protocol === 'file:') {
      if (onFail) onFail();
      return;
    }
    getTtsBlobUrl(text, lang)
      .then((blobUrl) => {
        if (seq !== speakSeq) return;
        const audio = new Audio(blobUrl);
        audio.volume = 1;
        audio.playbackRate = Math.min(2, Math.max(0.5, Number(rate) || 1));
        currentAudio = audio;

        let settled = false;
        const finishOk = () => {
          if (settled) return;
          settled = true;
          if (currentAudio === audio) currentAudio = null;
          if (seq === speakSeq && onEnd) onEnd();
        };
        const finishFail = () => {
          if (settled) return;
          settled = true;
          if (currentAudio === audio) currentAudio = null;
          if (seq === speakSeq && onFail) onFail();
        };

        audio.onplaying = () => {
          if (seq === speakSeq) hideAudioNotice();
        };
        audio.onended = finishOk;
        audio.onerror = finishFail;

        const p = audio.play();
        if (p && typeof p.catch === 'function') {
          p.catch(finishFail);
        }
      })
      .catch(() => {
        if (seq === speakSeq && onFail) onFail();
      });
  }

  const IS_IOS_DEVICE = /iPad|iPhone|iPod/.test(navigator.userAgent || '') || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  function speakViaWebSpeech(text, lang, rate, voice, seq, onEnd, onFail, immediate = false) {
    if (!('speechSynthesis' in window)) {
      if (onFail) onFail();
      return;
    }
    const run = () => {
      if (seq !== speakSeq) return;
      try { speechSynthesis.resume(); } catch { /* ignore */ }
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      u.rate = rate;
      if (voice) u.voice = voice;
      u.onstart = () => {
        if (seq === speakSeq) hideAudioNotice();
      };
      u.onend = () => {
        if (seq === speakSeq && onEnd) onEnd();
      };
      u.onerror = (e) => {
        if (seq !== speakSeq) return;
        if (e && (e.error === 'canceled' || e.error === 'interrupted')) return;
        if (onFail) onFail();
      };
      speechSynthesis.speak(u);
    };
    if (immediate) run();
    else setTimeout(run, 30);
  }

  function speak(text, onEnd) {
    const clean = String(text || '').trim();
    if (!clean) {
      if (onEnd) onEnd();
      return;
    }
    stopSpeech();
    const seq = speakSeq;
    if (!zhVoice) pickZhVoice();

    // iOS/iPadOS Safari requires synchronous Web Speech inside user tap gesture
    if (IS_IOS_DEVICE) {
      speakViaWebSpeech(clean, 'zh-CN', state.rate, zhVoice, seq, onEnd, () => {
        if (onEnd) onEnd();
      }, true);
      return;
    }

    // Primary on local Node server: /api/tts MP3
    // Fallback: Web Speech API if offline or opened via file://
    playServerTts(clean, 'zh-CN', state.rate, seq, onEnd, () => {
      if ('speechSynthesis' in window) {
        speakViaWebSpeech(clean, 'zh-CN', state.rate, zhVoice, seq, onEnd, () => {
          showAudioNotice('ไม่สามารถเล่นเสียงภาษาจีนได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต หรือติดตั้งเสียงภาษาจีน (zh-CN) บนอุปกรณ์');
          if (onEnd) onEnd();
        });
      } else {
        showAudioNotice('ไม่สามารถเล่นเสียงภาษาจีนได้ กรุณาเปิดผ่าน http://127.0.0.1:5173 และตรวจสอบการเชื่อมต่ออินเทอร์เน็ต');
        if (onEnd) onEnd();
      }
    });
  }

  // ---- Helpers ----
  const allInitials = DATA.initialGroups.flatMap(g => g.items.map(it => ({ ...it, groupId: g.id })));
  const allFinals = DATA.finalGroups.flatMap(g => g.items);

  function getInitialById(id) {
    return allInitials.find(x => x.id === id) || allInitials[0];
  }

  const TONE_MARKS = {
    a: ['ā', 'á', 'ǎ', 'à'],
    o: ['ō', 'ó', 'ǒ', 'ò'],
    e: ['ē', 'é', 'ě', 'è'],
    i: ['ī', 'í', 'ǐ', 'ì'],
    u: ['ū', 'ú', 'ǔ', 'ù'],
    'ü': ['ǖ', 'ǘ', 'ǚ', 'ǜ']
  };

  function applyToneMark(syllable, tone) {
    if (tone < 1 || tone > 4) return syllable;
    const idx = tone - 1;
    if (syllable.includes('iu')) return syllable.replace('u', TONE_MARKS.u[idx]);
    if (syllable.includes('ui')) return syllable.replace('i', TONE_MARKS.i[idx]);
    for (const v of ['a', 'o', 'e', 'i', 'u', 'ü']) {
      if (syllable.includes(v)) return syllable.replace(v, TONE_MARKS[v][idx]);
    }
    return syllable;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ---- XP, Level, Rank & Skill Engine (Game System) ----
  const RANKS = [
    { minLv: 1, zh: '新手', th: 'ผู้เริ่มต้น' },
    { minLv: 3, zh: '学徒', th: 'ศิษย์พินอิน' },
    { minLv: 5, zh: '声韵行者', th: 'นักแยกเสียง' },
    { minLv: 8, zh: '拼读达人', th: 'จอมผสมคำ' },
    { minLv: 11, zh: '汉字匠人', th: 'นักเขียนอักษร' },
    { minLv: 15, zh: '初级宗师', th: 'ปรมาจารย์เวล 1' }
  ];

  function computeGameStats() {
    const p = state.progress;
    const daysPassed = getPassedDaysCount();
    const totalBlocksDone = Object.values(p.dayChecks).reduce((s, arr) => s + (Array.isArray(arr) ? arr.length : 0), 0);
    const totalDayQuizCorrect = Object.values(p.dayScores).reduce((s, sc) => s + (Number.isInteger(sc) ? sc : 0), 0);
    const bossPassed = p.bestQuiz !== null && p.bestQuiz >= 8;

    const xp =
      p.initials.length * 20 +
      p.finals.length * 15 +
      p.writing.length * 30 +
      totalBlocksDone * 15 +
      daysPassed * 120 +
      totalDayQuizCorrect * 10 +
      p.drillCorrect * 10 +
      (p.bonusXp || 0) +
      (bossPassed ? 500 : (p.bestQuiz || 0) * 20);

    // Auto-apply Streak Freeze if user missed yesterday but had an active streak before
    if (!Array.isArray(p.frozenDays)) p.frozenDays = [];
    const yesterday = todayKey(-1);
    const twoDaysAgo = todayKey(-2);
    const hadYesterday = (p.activity[yesterday] || 0) > 0 || p.frozenDays.includes(yesterday);
    const hadBefore = (p.activity[twoDaysAgo] || 0) > 0 || p.frozenDays.includes(twoDaysAgo);
    if (!hadYesterday && hadBefore && (p.streakFreezes || 0) > 0) {
      p.streakFreezes -= 1;
      p.frozenDays.push(yesterday);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch { /* ignore */ }
    }

    // Compute consecutive daily streak (counting frozen days)
    let streak = 0;
    for (let i = 0; i < 365; i++) {
      const k = todayKey(-i);
      if ((p.activity[k] || 0) > 0 || p.frozenDays.includes(k)) streak++;
      else if (i === 0) continue; // Allow streak to persist if haven't studied yet today
      else break;
    }

    // Smooth RPG curve: Lv 1 starts at 0, Lv 2 at 80, Lv 3 at 320, Lv 4 at 720 ...
    const level = Math.floor(Math.sqrt(xp / 80)) + 1;
    const curLvFloor = 80 * (level - 1) * (level - 1);
    const nextLvCeil = 80 * level * level;
    const xpInLevel = xp - curLvFloor;
    const xpSpan = Math.max(1, nextLvCeil - curLvFloor);
    const lvPct = Math.min(100, Math.round((xpInLevel / xpSpan) * 100));
    const xpToNext = Math.max(0, nextLvCeil - xp);

    let rank = RANKS[0];
    for (const r of RANKS) {
      if (level >= r.minLv) rank = r;
    }

    // 5 Core Skills (0 - 100)
    const skills = [
      {
        id: 'pronunciation',
        name: 'พยัญชนะ & ลิ้น',
        short: 'พยัญชนะ',
        pct: Math.round((p.initials.length / allInitials.length) * 100),
        detail: `${p.initials.length}/${allInitials.length} ตัว`,
        tab: 'initials'
      },
      {
        id: 'pinyin',
        name: 'สระ & วรรณยุกต์',
        short: 'สระ/เสียง',
        pct: Math.round((p.finals.length / allFinals.length) * 100),
        detail: `${p.finals.length}/${allFinals.length} เสียง`,
        tab: 'finals'
      },
      {
        id: 'listening',
        name: 'ฟัง & พูดแยกเสียง',
        short: 'ฟัง-พูด',
        pct: Math.min(100, Math.round(((p.drillCorrect + totalDayQuizCorrect * 0.5) / 30) * 100)),
        detail: `${p.drillCorrect} ข้อฝึก`,
        tab: 'practice'
      },
      {
        id: 'writing',
        name: 'ลำดับขีดอักษรจีน',
        short: 'เขียนจีน',
        pct: Math.round((p.writing.length / WS.writingChars.length) * 100),
        detail: `${p.writing.length}/${WS.writingChars.length} ตัว`,
        tab: 'writing'
      },
      {
        id: 'consistency',
        name: 'วินัยแผน 14 วัน',
        short: 'แผน 14 วัน',
        pct: Math.round(((daysPassed * 5 + totalBlocksDone) / (PLAN.length * 10)) * 100),
        detail: `${daysPassed}/${PLAN.length} วัน`,
        tab: 'plan'
      }
    ];

    const badges = [
      { id: 'first', icon: '拼', title: 'ก้าวแรกพินอิน', desc: 'จำพยัญชนะหรือสระครบ 5 ตัว', unlocked: (p.initials.length + p.finals.length) >= 5 },
      { id: 'asp', icon: '气', title: 'เซียนแยกพ่นลม', desc: 'จำกลุ่ม b,p,d,t,g,k ครบทั้ง 6 ตัว', unlocked: ['b','p','d','t','g','k'].every(x => p.initials.includes(x)) },
      { id: 'retro', icon: '卷', title: 'ปราบม้วนลิ้น', desc: 'จำกลุ่ม zh, ch, sh, r ครบทั้ง 4 ตัว', unlocked: ['zh','ch','sh','r'].every(x => p.initials.includes(x)) },
      { id: 'writer', icon: '笔', title: 'นักคัดอักษร', desc: 'เขียนผ่านลำดับขีดอย่างน้อย 10 ตัว', unlocked: p.writing.length >= 10 },
      { id: 'ear', icon: '耳', title: 'หูทิพย์พินอิน', desc: 'ฝึกฟัง-พูดถูกสะสม 20 ข้อขึ้นไป', unlocked: p.drillCorrect >= 20 },
      { id: 'week1', icon: '七', title: 'พิชิตสัปดาห์ที่ 1', desc: 'สอบผ่าน Day 1 – Day 7 ครบ', unlocked: [1,2,3,4,5,6,7].every(d => (p.dayScores[d] || 0) >= DAILY_PASS_SCORE) },
      { id: 'boot', icon: '满', title: 'แชมป์คอร์ส 14 วัน', desc: 'สอบผ่านครบทั้ง 14 วัน', unlocked: daysPassed === PLAN.length },
      { id: 'boss', icon: '王', title: 'พิชิตบอส Level 1', desc: 'สอบใหญ่จบ Level 1 ได้ ≥ 8/10', unlocked: bossPassed }
    ];

    return { xp, level, rank, lvPct, xpInLevel, xpSpan, xpToNext, skills, badges, daysPassed, bossPassed, streak };
  }

  // ---- Dashboard Progress ----
  function getPassedDaysCount() {
    return PLAN.filter(d => (state.progress.dayScores[d.day] || 0) >= DAILY_PASS_SCORE).length;
  }

  function updateDashboard() {
    const p = state.progress;
    const g = computeGameStats();

    document.getElementById('header-lv').textContent = `LV.${g.level}`;
    document.getElementById('header-xp').textContent = `${g.xp.toLocaleString()} XP`;
    const navLv = document.getElementById('nav-lv-badge');
    if (navLv) navLv.textContent = `LV.${g.level}`;

    const sbRank = document.getElementById('sidebar-rank');
    if (sbRank) sbRank.textContent = `LV.${g.level} · ${g.rank.th}`;
    document.getElementById('overall-pct').textContent = `${g.xp.toLocaleString()} XP`;
    document.getElementById('overall-bar').style.width = g.lvPct + '%';
    const sbNext = document.getElementById('sidebar-xp-next');
    if (sbNext) sbNext.textContent = `อีก ${g.xpToNext.toLocaleString()} XP ขึ้น LV.${g.level + 1}`;

    document.getElementById('stat-days').textContent = `${g.daysPassed} / ${PLAN.length} วัน`;
    const navBadge = document.getElementById('nav-days-badge');
    if (navBadge) navBadge.textContent = `${g.daysPassed}/${PLAN.length}`;
    document.getElementById('stat-pinyin').textContent = `${p.initials.length}/${allInitials.length} · ${p.finals.length}/${allFinals.length}`;
    document.getElementById('stat-writing').textContent = `${p.writing.length} / ${WS.writingChars.length} ตัว`;
    document.getElementById('stat-quiz').textContent =
      p.bestQuiz === null ? 'ยังไม่สอบ' : `${p.bestQuiz} / 10${p.bestQuiz >= 8 ? ' ✓' : ''}`;

    const navSrs = document.getElementById('nav-srs-badge');
    if (navSrs) {
      const due = getDueSrsWords().length;
      navSrs.textContent = due > 0 ? String(due) : '✓';
    }

    const navVocab = document.getElementById('nav-vocab-badge');
    if (navVocab) {
      const todayCount = getVocabTodayCount();
      const goal = state.progress.vocabGoal || 100;
      navVocab.textContent = todayCount >= goal ? `${todayCount} ✓` : `${todayCount}/${goal}`;
    }

    if (state.activeTab === 'profile') {
      renderProfilePage();
    }
  }

  // ---- Tab Switching ----
  function closeMobileSidebar() {
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('sidebar-backdrop')?.classList.remove('open');
  }

  function switchTab(tabId) {
    if (state.activeTab === 'vocab' && tabId !== 'vocab') {
      stopVocabAutoPlay();
      stopVocabGameTimers();
      stopVocabPodcast();
    }
    state.activeTab = tabId;
    document.querySelectorAll('.nav-link').forEach(btn => {
      const active = btn.dataset.tab === tabId;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', String(active));
    });
    document.querySelectorAll('.tab-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === 'tab-' + tabId);
    });
    closeMobileSidebar();
    document.querySelector('.main-content')?.scrollTo({ top: 0, behavior: 'smooth' });
    if (tabId === 'writing') {
      loadWritingCharacter();
    } else if (tabId === 'profile') {
      renderProfilePage();
    } else if (tabId === 'srs') {
      renderSrsPage();
    } else if (tabId === 'speed') {
      renderSpeedGame();
    } else if (tabId === 'level2') {
      renderLevel2Page();
    } else if (tabId === 'tutor') {
      renderTutorPage();
    } else if (tabId === 'mock') {
      renderMockExamPage();
    } else if (tabId === 'vocab') {
      renderVocab();
    } else if (featureTabs.has(tabId)) {
      try { featureTabs.get(tabId).render(document.getElementById('feature-host-' + tabId)); } catch (err) { console.error('[feature]', tabId, err); }
    }
    emitCore('tab', { tabId });
  }

  // Registry for plugin tabs (populated via NihaoCore.registerTab)
  const featureTabs = new Map();

  // ---- ARTICULATION ANATOMY SVG (Phase 1) ----
  function renderArticulationSVG(groupId, aspirated) {
    // Stylized sagittal mouth cross-section (facing left: lips at left x=35, throat at right x=255)
    const configs = {
      labial: {
        label: 'จุดกำเนิดเสียง: ริมฝีปาก (双唇 / 唇齿)',
        tongue: 'M 245 128 Q 180 96 125 98 Q 86 100 68 104 Q 88 122 145 128 Z',
        spot: { cx: 38, cy: 78, text: 'เม้มริมฝีปาก' }
      },
      alveolar: {
        label: 'จุดกำเนิดเสียง: ปุ่มเหงือกบน (舌尖中音)',
        tongue: 'M 245 128 Q 180 96 128 84 Q 95 72 80 54 Q 96 98 145 128 Z',
        spot: { cx: 80, cy: 52, text: 'ปลายลิ้นแตะปุ่มเหงือก' }
      },
      velar: {
        label: 'จุดกำเนิดเสียง: โคนลิ้นแตะเพดานอ่อน (舌根音)',
        tongue: 'M 245 128 Q 198 56 155 62 Q 112 90 78 102 Q 110 122 155 128 Z',
        spot: { cx: 184, cy: 58, text: 'ยกโคนลิ้นขึ้น' }
      },
      palatal: {
        label: 'จุดกำเนิดเสียง: หน้าลิ้นแนบเพดานแข็ง + ยิ้ม (舌面音)',
        tongue: 'M 245 128 Q 185 88 135 56 Q 100 66 72 95 Q 102 118 145 128 Z',
        spot: { cx: 128, cy: 52, text: 'หน้าลิ้นยก + ปลายลิ้นลง' }
      },
      retroflex: {
        label: 'จุดกำเนิดเสียง: ม้วนปลายลิ้นแตะเพดานแข็ง (翘舌音)',
        tongue: 'M 245 128 Q 180 96 132 82 Q 100 74 114 48 Q 88 76 112 108 Q 140 124 175 128 Z',
        spot: { cx: 114, cy: 48, text: 'กระดกปลายลิ้นม้วนขึ้น!' }
      },
      dental: {
        label: 'จุดกำเนิดเสียง: ลิ้นแบนแตะหลังฟันหน้า (平舌音)',
        tongue: 'M 245 128 Q 180 96 125 88 Q 84 82 62 72 Q 86 106 145 128 Z',
        spot: { cx: 63, cy: 71, text: 'ลิ้นแบนแตะหลังฟัน' }
      },
      semivowel: {
        label: 'จุดกำเนิดเสียง: กึ่งสระ ช่องปากเปิด (半元音)',
        tongue: 'M 245 128 Q 180 86 128 86 Q 90 92 72 100 Q 98 122 145 128 Z',
        spot: { cx: 132, cy: 76, text: 'เปิดช่องลมลื่นไหล' }
      }
    };

    const cfg = configs[groupId] || configs.labial;
    const airSvg = aspirated
      ? `<g stroke="#c84b31" stroke-width="2.4" stroke-linecap="round" fill="none">
           <path d="M 32 76 L 10 70"/><path d="M 16 66 L 9 70 L 15 76"/>
           <path d="M 32 84 L 12 86"/><path d="M 18 81 L 11 86 L 18 90"/>
         </g>`
      : `<g stroke="#1d6b5c" stroke-width="1.6" stroke-dasharray="3 3" fill="none" opacity="0.55">
           <path d="M 34 80 L 18 80"/>
         </g>`;

    return `
      <div class="anatomy-card">
        <div class="anatomy-head">
          <span>${escapeHtml(cfg.label)}</span>
          <span class="air-tag ${aspirated ? 'asp' : 'unasp'}">${aspirated ? '💨 พ่นลมแรง (Aspirated)' : 'ไม่พ่นลม (Unaspirated)'}</span>
        </div>
        <svg class="anatomy-svg" viewBox="0 0 280 140" role="img" aria-label="${escapeHtml(cfg.label)}">
          <!-- Roof of mouth: upper lip, teeth, alveolar ridge, hard palate, soft palate -->
          <path d="M 36 68 Q 48 64 56 64 L 58 76 L 64 76 L 65 56 Q 78 44 106 42 Q 148 38 188 52 Q 214 62 224 88"
                fill="none" stroke="#15473e" stroke-width="3" stroke-linecap="round"/>
          <!-- Upper teeth fill -->
          <rect x="56" y="64" width="8" height="12" rx="2" fill="#ffffff" stroke="#15473e" stroke-width="1.8"/>
          <!-- Lower lip & lower teeth -->
          <path d="M 38 92 Q 52 94 60 98 L 62 114" fill="none" stroke="#15473e" stroke-width="3" stroke-linecap="round"/>
          <rect x="56" y="88" width="7" height="10" rx="2" fill="#ffffff" stroke="#15473e" stroke-width="1.6"/>
          <!-- Tongue shape -->
          <path d="${cfg.tongue}" fill="#f3a698" stroke="#c84b31" stroke-width="2.2" stroke-linejoin="round"/>
          <!-- Contact highlight pulse -->
          <circle cx="${cfg.spot.cx}" cy="${cfg.spot.cy}" r="9" fill="#c84b31" opacity="0.22"/>
          <circle cx="${cfg.spot.cx}" cy="${cfg.spot.cy}" r="4.5" fill="#c84b31"/>
          <!-- Airflow arrows -->
          ${airSvg}
          <!-- Reference labels -->
          <text x="100" y="24" font-size="10.5" fill="#5f7078" font-weight="600">เพดานแข็ง</text>
          <text x="184" y="34" font-size="10.5" fill="#5f7078" font-weight="600">เพดานอ่อน</text>
          <text x="148" y="114" font-size="11" fill="#7c2d1d" font-weight="700">ลิ้น</text>
          <rect x="64" y="116" width="142" height="20" rx="10" fill="#15473e"/>
          <text x="135" y="130" text-anchor="middle" font-size="10.5" fill="#d8ef9f" font-weight="700">${escapeHtml(cfg.spot.text)}</text>
        </svg>
      </div>
    `;
  }

  // ---- MODULE 1: Initials ----
  function renderInitials() {
    const container = document.getElementById('initials-groups');
    container.innerHTML = DATA.initialGroups.map(group => `
      <div class="group-block">
        <div class="group-title">
          <h3>${escapeHtml(group.name)}</h3>
        </div>
        <p class="group-desc">${escapeHtml(group.desc)}</p>
        <div class="pinyin-grid">
          ${group.items.map(item => {
            const selected = state.selectedInitial === item.id;
            const mastered = state.progress.initials.includes(item.id);
            return `
              <button type="button" class="pinyin-tile ${selected ? 'selected' : ''} ${mastered ? 'mastered' : ''}" data-initial="${item.id}">
                <span class="sym">${item.symbol}</span>
                <span class="sub">${item.thaiApprox.split(' ')[0]}</span>
                ${item.aspirated ? '<span class="aspirated-dot">พ่นลม</span>' : ''}
              </button>
            `;
          }).join('')}
        </div>
      </div>
    `).join('');

    container.querySelectorAll('.pinyin-tile').forEach(btn => {
      btn.addEventListener('click', () => {
        state.selectedInitial = btn.dataset.initial;
        const item = getInitialById(state.selectedInitial);
        renderInitials();
        renderInitialInspector();
        speak(item.ttsChar);
      });
    });

    renderInitialInspector();
  }

  function renderInitialInspector() {
    const item = getInitialById(state.selectedInitial);
    const mastered = state.progress.initials.includes(item.id);
    const inspector = document.getElementById('initial-inspector');

    const compareHtml = item.confuseWith.length
      ? `
        <div style="margin-bottom:6px;font-size:13px;font-weight:700;color:var(--jade)">🎧 กดฟังเทียบกับตัวที่มักสับสน:</div>
        <div class="compare-row">
          <button type="button" class="compare-chip" data-speak="${item.ttsChar}">🔊 ${item.symbol} (${item.readPinyin})</button>
          ${item.confuseWith.map(cid => {
            const other = getInitialById(cid);
            return `<button type="button" class="compare-chip" data-speak="${other.ttsChar}">🔊 ${other.symbol} (${other.readPinyin})</button>`;
          }).join('')}
        </div>
      `
      : '';

    inspector.innerHTML = `
      <div class="inspector-hero">
        <div>
          <div class="inspector-symbol">${item.symbol}</div>
          <div class="inspector-reading">เสียงอ่านมาตรฐาน: <b>${item.readPinyin}</b> (${item.ttsChar}) · เทียบไทย: <b>${escapeHtml(item.thaiApprox)}</b></div>
        </div>
        <button type="button" class="btn-speak" id="insp-speak">🔊 ฟังเสียง</button>
      </div>

      ${renderArticulationSVG(item.groupId, item.aspirated)}

      <div class="info-box">
        <strong>วิธีวางลิ้นและริมฝีปาก</strong>
        ${escapeHtml(item.mouthTip)}
      </div>

      <div class="warning-box">
        <strong>จุดระวังสำหรับคนไทย:</strong> ${escapeHtml(item.warning)}
      </div>

      ${compareHtml}

      <div style="margin-bottom:8px;font-size:13px;font-weight:700;color:var(--jade)">ตัวอย่างคำศัพท์ (กดฟังได้ทุกคำ)</div>
      <div class="example-list">
        ${item.examples.map(ex => `
          <button type="button" class="example-item" data-speak="${ex.hanzi}">
            <div class="example-left">
              <span class="example-hanzi hanzi-font">${ex.hanzi}</span>
              <span class="example-pinyin">${ex.pinyin}</span>
            </div>
            <span class="example-meaning">${escapeHtml(ex.meaning)} 🔊</span>
          </button>
        `).join('')}
      </div>

      <button type="button" class="btn-master ${mastered ? 'done' : ''}" id="toggle-master-initial">
        ${mastered ? '✓ จำพยัญชนะตัวนี้ได้แล้ว (กดเพื่อยกเลิก)' : 'ทำเครื่องหมายว่าเข้าใจตัวนี้แล้ว ✓'}
      </button>
    `;

    document.getElementById('insp-speak').addEventListener('click', () => speak(item.ttsChar));
    inspector.querySelectorAll('[data-speak]').forEach(btn => {
      btn.addEventListener('click', () => speak(btn.dataset.speak));
    });
    document.getElementById('toggle-master-initial').addEventListener('click', () => {
      const idx = state.progress.initials.indexOf(item.id);
      if (idx === -1) state.progress.initials.push(item.id);
      else state.progress.initials.splice(idx, 1);
      saveProgress();
      renderInitials();
    });
  }

  // ---- MODULE 2: Finals ----
  function renderFinals() {
    const filterEl = document.getElementById('finals-filter');
    const filters = [
      { id: 'all', label: 'ทั้งหมด (36)' },
      { id: 'simple', label: 'สระเดี่ยว (6)' },
      { id: 'compound', label: 'สระประสม (13)' },
      { id: 'nasal_front', label: 'นาสิกหน้า -n (8)' },
      { id: 'nasal_back', label: 'นาสิกหลัง -ng & er (9)' }
    ];

    filterEl.innerHTML = filters.map(f => `
      <button type="button" class="filter-pill ${state.finalsFilter === f.id ? 'active' : ''}" data-filter="${f.id}">
        ${f.label}
      </button>
    `).join('');

    filterEl.querySelectorAll('.filter-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        state.finalsFilter = btn.dataset.filter;
        renderFinals();
      });
    });

    const groups = state.finalsFilter === 'all'
      ? DATA.finalGroups
      : DATA.finalGroups.filter(g => g.id === state.finalsFilter);

    const contentEl = document.getElementById('finals-content');
    contentEl.innerHTML = groups.map(group => `
      <div style="margin-bottom: 26px;">
        <h3 style="margin:0 0 4px;color:var(--jade)">${escapeHtml(group.name)}</h3>
        <p style="margin:0 0 14px;font-size:14px;color:var(--muted)">${escapeHtml(group.desc)}</p>
        <div class="finals-cards">
          ${group.items.map(f => {
            const mastered = state.progress.finals.includes(f.symbol);
            return `
              <div class="final-card ${mastered ? 'mastered' : ''}">
                <div class="final-card-top">
                  <span class="final-symbol">${escapeHtml(f.symbol)}</span>
                  <span class="final-thai">${escapeHtml(f.thai)}</span>
                </div>
                <p class="final-tip">${escapeHtml(f.tip)}</p>
                <div style="font-size:12.5px;color:var(--jade);font-weight:600">ตัวอย่าง: ${escapeHtml(f.example)}</div>
                <div class="final-footer">
                  <button type="button" class="btn-speak-sm" data-speak="${f.ttsChar}">🔊 ฟังเสียง</button>
                  <button type="button" class="btn-speak-sm" data-master-final="${escapeHtml(f.symbol)}">
                    ${mastered ? '✓ จำได้แล้ว' : 'ทำเครื่องหมาย ✓'}
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `).join('');

    contentEl.querySelectorAll('[data-speak]').forEach(btn => {
      btn.addEventListener('click', () => speak(btn.dataset.speak));
    });

    contentEl.querySelectorAll('[data-master-final]').forEach(btn => {
      btn.addEventListener('click', () => {
        const sym = btn.dataset.masterFinal;
        const idx = state.progress.finals.indexOf(sym);
        if (idx === -1) state.progress.finals.push(sym);
        else state.progress.finals.splice(idx, 1);
        saveProgress();
        renderFinals();
      });
    });
  }

  // ---- MODULE 3: Tones & Rules ----
  function renderTones() {
    const grid = document.getElementById('tones-grid');
    grid.innerHTML = DATA.tones.map(t => `
      <div class="tone-card">
        <svg class="tone-svg" viewBox="0 0 120 100" aria-hidden="true">
          <line x1="12" y1="20" x2="108" y2="20" stroke="#e5ece9" stroke-dasharray="3 3"/>
          <line x1="12" y1="50" x2="108" y2="50" stroke="#e5ece9" stroke-dasharray="3 3"/>
          <line x1="12" y1="80" x2="108" y2="80" stroke="#e5ece9" stroke-dasharray="3 3"/>
          <path d="${t.path}" fill="${t.num === 0 ? t.color : 'none'}" stroke="${t.color}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <div class="tone-head">
          <strong>${escapeHtml(t.name)}</strong>
          <span class="pitch-tag">${escapeHtml(t.pitch)}</span>
        </div>
        <div class="tone-feel">${escapeHtml(t.thaiFeel)}</div>
        <p class="tone-desc">${escapeHtml(t.desc)}</p>
        <button type="button" class="tone-example-btn" data-speak="${t.example.hanzi}">
          <span><span class="hanzi-font" style="font-size:20px">${t.example.hanzi}</span> ${t.example.pinyin} (${t.example.meaning})</span>
          <span>🔊</span>
        </button>
      </div>
    `).join('');

    grid.querySelectorAll('[data-speak]').forEach(btn => {
      btn.addEventListener('click', () => speak(btn.dataset.speak));
    });

    renderToneSets();

    const rulesEl = document.getElementById('tone-rules-grid');
    rulesEl.innerHTML = DATA.toneRules.map(r => `
      <div class="rule-card">
        <h4>${escapeHtml(r.title)}</h4>
        <div class="rule-formula">${escapeHtml(r.formula)}</div>
        <p>${escapeHtml(r.detail)}</p>
        <div class="rule-example">
          <span>
            <b class="hanzi-font" style="font-size:18px">${r.exampleHanzi}</b>
            · เขียน <code>${r.exampleWritten}</code> → อ่าน <b>${r.exampleSpoken}</b> (${r.meaning})
          </span>
          <button type="button" class="btn-speak-sm" data-speak="${r.exampleHanzi.split(' ')[0]}">🔊</button>
        </div>
      </div>
    `).join('');

    rulesEl.querySelectorAll('[data-speak]').forEach(btn => {
      btn.addEventListener('click', () => speak(btn.dataset.speak));
    });
  }

  function renderToneSets() {
    const tabsEl = document.getElementById('tone-set-tabs');
    tabsEl.innerHTML = DATA.toneSets.map((s, idx) => `
      <button type="button" class="filter-pill ${state.selectedToneSet === idx ? 'active' : ''}" data-set="${idx}">
        ${escapeHtml(s.label)}
      </button>
    `).join('');

    tabsEl.querySelectorAll('[data-set]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.selectedToneSet = Number(btn.dataset.set);
        renderToneSets();
      });
    });

    const currentSet = DATA.toneSets[state.selectedToneSet];
    const pairGrid = document.getElementById('tone-pair-grid');
    pairGrid.innerHTML = currentSet.items.map(item => `
      <button type="button" class="tone-pair-btn" data-speak="${item.hanzi}">
        <span style="font-size:12px;color:var(--muted)">เสียงที่ ${item.tone}</span>
        <span class="hanzi hanzi-font">${item.hanzi}</span>
        <span class="py">${item.pinyin}</span>
        <span class="th">${escapeHtml(item.meaning)}</span>
      </button>
    `).join('');

    pairGrid.querySelectorAll('[data-speak]').forEach(btn => {
      btn.addEventListener('click', () => speak(btn.dataset.speak));
    });
  }

  document.getElementById('play-tone-sequence').addEventListener('click', () => {
    const items = DATA.toneSets[state.selectedToneSet].items;
    let i = 0;
    function next() {
      if (i >= items.length) return;
      speak(items[i].hanzi, () => {
        i++;
        setTimeout(next, 280);
      });
    }
    next();
  });

  // ---- MODULE 4: Complete Pinyin Chart (400+ Syllables) ----
  function renderPinyinChart() {
    const filterEl = document.getElementById('chart-filter');
    const filters = [
      { id: 'all', label: 'ทั้งหมด (24 แถว)' },
      { id: 'retroflex', label: 'ม้วนลิ้น (zh/ch/sh/r)' },
      { id: 'dental', label: 'ลิ้นแบน (z/c/s)' },
      { id: 'palatal', label: 'กลุ่มยิ้ม (j/q/x)' },
      { id: 'labial_alv', label: 'พื้นฐาน (b-l)' }
    ];

    filterEl.innerHTML = filters.map(f => `
      <button type="button" class="filter-pill ${state.chartFilter === f.id ? 'active' : ''}" data-cfilter="${f.id}">
        ${f.label}
      </button>
    `).join('');

    filterEl.querySelectorAll('[data-cfilter]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.chartFilter = btn.dataset.cfilter;
        renderPinyinChart();
      });
    });

    const rows = CHART.initials.filter(row => {
      if (state.chartFilter === 'all') return true;
      if (state.chartFilter === 'labial_alv') return row.group === 'labial' || row.group === 'alveolar';
      return row.group === state.chartFilter;
    });

    const matrixEl = document.getElementById('pinyin-matrix');
    const headHtml = `<thead><tr><th>พยัญชนะ \\ สระ</th>${CHART.finals.map(f => `<th>${f}</th>`).join('')}</tr></thead>`;
    const bodyHtml = rows.map(row => {
      const cells = CHART.finals.map(fin => {
        const key = `${row.id}|${fin}`;
        const entry = CHART.syllables[key];
        if (!entry) return `<td><span class="py-cell-empty">·</span></td>`;
        const isActive = state.selectedChartKey === key;
        const ruleCls = entry.rule ? `rule-${entry.rule}` : '';
        return `<td><button type="button" class="py-cell-btn ${ruleCls} ${isActive ? 'active' : ''}" data-ckey="${key}">${entry.py}</button></td>`;
      }).join('');
      return `<tr><th>${row.label}</th>${cells}</tr>`;
    }).join('');

    matrixEl.innerHTML = `<table class="py-matrix">${headHtml}<tbody>${bodyHtml}</tbody></table>`;

    matrixEl.querySelectorAll('.py-cell-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state.selectedChartKey = btn.dataset.ckey;
        const entry = CHART.syllables[state.selectedChartKey];
        const firstChar = entry.chars.find(Boolean);
        if (firstChar) speak(firstChar);
        renderChartInspector();
        matrixEl.querySelectorAll('.py-cell-btn').forEach(b => b.classList.toggle('active', b === btn));
      });
    });

    renderChartInspector();
  }

  function renderChartInspector() {
    const entry = CHART.syllables[state.selectedChartKey] || CHART.syllables['b|a'];
    const [ini, fin] = state.selectedChartKey.split('|');
    const ruleText = entry.rule === 'u_dots'
      ? ' · ⚠️ กฎตัดจุด ü (เขียน u แต่ออกเสียง ü)'
      : entry.rule === 'apical_i'
        ? ' · ⚠️ สระ i หลังตัวนี้ออกเสียง "อือ"'
        : '';

    const inspEl = document.getElementById('chart-inspector');
    inspEl.innerHTML = `
      <div class="chart-insp-left">
        <strong>พยางค์: ${entry.py}</strong>
        <span>โครงสร้าง: ${ini || '∅ (ไม่มีพยัญชนะต้น)'} + ${fin}${ruleText}</span>
      </div>
      <div class="chart-tone-btns">
        ${[1, 2, 3, 4].map((t, i) => {
          const ch = entry.chars[i];
          const marked = applyToneMark(entry.py, t);
          return `
            <button type="button" class="chart-tone-btn" ${ch ? `data-speak="${ch}"` : 'disabled'}>
              <span class="hz hanzi-font">${ch || '—'}</span>
              <span class="py">${marked}</span>
              <span style="font-size:11px;color:var(--muted)">เสียง ${t}</span>
            </button>
          `;
        }).join('')}
      </div>
    `;

    inspEl.querySelectorAll('[data-speak]').forEach(btn => {
      btn.addEventListener('click', () => speak(btn.dataset.speak));
    });
  }

  // ---- MODULE 5: Pinyin Combiner Lab ----
  function renderCombiner() {
    const initEl = document.getElementById('combiner-initials');
    const finEl = document.getElementById('combiner-finals');
    const toneEl = document.getElementById('combiner-tones');

    initEl.innerHTML = DATA.combinerInitials.map(ini => `
      <button type="button" class="chip-btn ${state.combiner.initial === ini ? 'active' : ''}" data-ci="${ini}">${ini}</button>
    `).join('');

    finEl.innerHTML = DATA.combinerFinals.map(fin => `
      <button type="button" class="chip-btn ${state.combiner.final === fin ? 'active' : ''}" data-cf="${fin}">${fin}</button>
    `).join('');

    toneEl.innerHTML = [1, 2, 3, 4].map(t => `
      <button type="button" class="chip-btn ${state.combiner.tone === t ? 'active' : ''}" data-ct="${t}">เสียง ${t}</button>
    `).join('');

    initEl.querySelectorAll('[data-ci]').forEach(btn => {
      btn.addEventListener('click', () => { state.combiner.initial = btn.dataset.ci; renderCombiner(); });
    });
    finEl.querySelectorAll('[data-cf]').forEach(btn => {
      btn.addEventListener('click', () => { state.combiner.final = btn.dataset.cf; renderCombiner(); });
    });
    toneEl.querySelectorAll('[data-ct]').forEach(btn => {
      btn.addEventListener('click', () => { state.combiner.tone = Number(btn.dataset.ct); renderCombiner(); });
    });

    const { initial, final, tone } = state.combiner;
    let spelledFinal = final;
    let ruleNote = '';

    if (['j', 'q', 'x', 'y'].includes(initial) && final === 'ü') {
      spelledFinal = 'u';
      ruleNote = `กฎตัดจุด ü: เมื่อ ${initial} ผสมกับ ü จะเขียนเป็น ${initial}u แต่ยังคงออกเสียงสระ ü (อวี) เหมือนเดิม!`;
    } else if (['z', 'c', 's', 'zh', 'ch', 'sh', 'r'].includes(initial) && final === 'i') {
      ruleNote = `กฎพิเศษของสระ i: หลัง ${initial} จะออกเสียงเป็น "อือ" ไม่ใช่ "อี"`;
    } else if (final === 'iu' || final === 'ui') {
      ruleNote = `กฎวางวรรณยุกต์คู่ ${final}: วางเครื่องหมายบนตัวอักษรหลังเสมอ`;
    }

    const rawKey = initial + spelledFinal + tone;
    const match = DATA.combinerDict[rawKey];
    const markedPinyin = applyToneMark(initial + spelledFinal, tone);
    const resultEl = document.getElementById('combiner-result');

    if (match) {
      const [hanzi, meaning] = match;
      resultEl.innerHTML = `
        <div class="combiner-formula">${initial} + ${final} + เสียง ${tone} = ${markedPinyin}</div>
        <div class="combiner-hanzi hanzi-font">${hanzi}</div>
        <div class="combiner-pinyin">${markedPinyin}</div>
        <div class="combiner-meaning">${escapeHtml(meaning)}</div>
        <button type="button" class="btn-speak" id="combiner-speak">🔊 ฟังเสียง ${markedPinyin}</button>
        ${ruleNote ? `<div class="combiner-note">💡 ${escapeHtml(ruleNote)}</div>` : ''}
      `;
      document.getElementById('combiner-speak').addEventListener('click', () => speak(hanzi));
    } else {
      let reason = `ในภาษาจีนกลางไม่มีการผสมพยางค์ "${initial} + ${final}" (เสียง ${tone}) ในคำพื้นฐาน`;
      if (['j', 'q', 'x'].includes(initial) && !['i', 'ü', 'iu', 'ie'].includes(final)) {
        reason = `พยัญชนะกลุ่มหน้าลิ้น (j, q, x) ผสมได้เฉพาะสระที่ขึ้นต้นด้วย i หรือ ü เท่านั้น (ลองเปลี่ยนสระเป็น i, ü, iu, ie ดูสิ!)`;
      } else if (['b', 'p', 'm', 'f'].includes(initial) && final === 'ü') {
        reason = `พยัญชนะกลุ่มริมฝีปาก (b, p, m, f) ไม่ผสมกับสระ ü (ลองใช้ n หรือ l ผสมกับ ü แทน เช่น nǚ, lǜ)`;
      }
      resultEl.innerHTML = `
        <div class="combiner-formula">${initial} + ${final} + เสียง ${tone}</div>
        <div style="font-size:48px;margin:16px 0;opacity:0.45">—</div>
        <div style="font-size:18px;font-weight:700;color:var(--vermilion);margin-bottom:8px">ไม่มีพยางค์นี้ในชุดคำพื้นฐาน</div>
        <div class="combiner-note">💡 ${escapeHtml(reason)}</div>
      `;
    }
  }

  // ---- MODULE 6: Interactive Hanzi Writing Studio (Phase 1) ----
  let writerInstance = null;
  let freehandSetupDone = false;

  function renderWritingStatic() {
    // 8 Basic Strokes
    document.getElementById('strokes-grid').innerHTML = WS.basicStrokes.map(st => `
      <div class="stroke-card">
        <svg class="stroke-svg" viewBox="0 0 100 100" aria-hidden="true">
          <line x1="50" y1="4" x2="50" y2="96" stroke="#f0d9c8" stroke-dasharray="3 3"/>
          <line x1="4" y1="50" x2="96" y2="50" stroke="#f0d9c8" stroke-dasharray="3 3"/>
          <path d="${st.path}" fill="none" stroke="#15473e" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="${st.start[0]}" cy="${st.start[1]}" r="5" fill="#c84b31"/>
          <path d="${st.arrow}" fill="none" stroke="#c84b31" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <strong>${escapeHtml(st.name)}</strong>
        <span class="st-th">${escapeHtml(st.thai)}</span>
        <p>${escapeHtml(st.dir)}<br><b>ตัวอย่าง:</b> <span class="hanzi-font">${st.example}</span></p>
      </div>
    `).join('');

    // 4 Golden Stroke-Order Rules
    document.getElementById('stroke-rules-grid').innerHTML = WS.strokeRules.map(r => `
      <div class="rule-card">
        <h4>กฎที่ ${r.num}: ${escapeHtml(r.title)}</h4>
        <p style="margin:0">${escapeHtml(r.example)}</p>
      </div>
    `).join('');

    // Mode switch buttons
    document.querySelectorAll('[data-wmode]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.writingMode = btn.dataset.wmode;
        document.querySelectorAll('[data-wmode]').forEach(b => b.classList.toggle('active', b === btn));
        loadWritingCharacter();
      });
    });

    document.getElementById('wr-speak').addEventListener('click', () => {
      speak(WS.writingChars[state.writingIdx].char);
    });

    document.getElementById('wr-animate').addEventListener('click', () => {
      if (state.writingMode === 'quiz' && writerInstance) {
        writerInstance.animateCharacter();
      } else {
        document.getElementById('wr-status').textContent = 'สลับเป็นโหมด "ฝึกเขียนตรวจขีด" เพื่อดูแอนิเมชันลำดับขีด';
      }
    });

    document.getElementById('wr-outline').addEventListener('click', () => {
      state.writingOutline = !state.writingOutline;
      if (state.writingMode === 'quiz' && writerInstance) {
        if (state.writingOutline) writerInstance.showOutline();
        else writerInstance.hideOutline();
      } else {
        drawFreehandBackground();
      }
    });

    document.getElementById('wr-reset').addEventListener('click', () => {
      loadWritingCharacter();
    });

    setupFreehandCanvas();
    renderWritingPicker();
  }

  function renderWritingPicker() {
    document.getElementById('wr-count-badge').textContent = `${state.progress.writing.length} / ${WS.writingChars.length}`;
    const grid = document.getElementById('wr-char-grid');
    grid.innerHTML = WS.writingChars.map((item, idx) => {
      const active = state.writingIdx === idx;
      const mastered = state.progress.writing.includes(item.char);
      return `
        <button type="button" class="char-pick-btn ${active ? 'active' : ''} ${mastered ? 'mastered' : ''}" data-widx="${idx}">
          <span class="hz hanzi-font">${item.char}</span>
          <span class="py">${item.pinyin}</span>
        </button>
      `;
    }).join('');

    grid.querySelectorAll('[data-widx]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.writingIdx = Number(btn.dataset.widx);
        renderWritingPicker();
        loadWritingCharacter();
        speak(WS.writingChars[state.writingIdx].char);
      });
    });
  }

  function loadWritingCharacter() {
    const item = WS.writingChars[state.writingIdx];
    document.getElementById('wr-pinyin').textContent = `${item.char} · ${item.pinyin}`;
    document.getElementById('wr-meaning').textContent = `${item.meaning} (${item.strokes} ขีด)`;
    document.getElementById('wr-tip').textContent = `💡 ${item.tip}`;

    const targetEl = document.getElementById('hanzi-writer-target');
    const canvasEl = document.getElementById('freehand-canvas');
    const statusEl = document.getElementById('wr-status');

    const hasHanziWriter = typeof window.HanziWriter !== 'undefined';

    if (state.writingMode === 'quiz' && hasHanziWriter) {
      targetEl.hidden = false;
      canvasEl.hidden = true;
      targetEl.innerHTML = '';
      statusEl.textContent = `ลองลากขีดที่ 1 จากทั้งหมด ${item.strokes} ขีด (หากติดขัดระบบจะใบ้ขีดถัดไปให้)`;

      const isDark = document.documentElement.classList.contains('theme-dark');
      writerInstance = window.HanziWriter.create('hanzi-writer-target', item.char, {
        width: 260,
        height: 260,
        padding: 18,
        showCharacter: false,
        showOutline: state.writingOutline,
        strokeColor: isDark ? '#f5f5f7' : '#1d1d1f',
        outlineColor: isDark ? '#3a3a3c' : '#d2d2d7',
        drawingColor: isDark ? '#0a84ff' : '#007aff',
        drawingWidth: 16,
        highlightColor: '#ff3b30',
        showHintAfterMisses: 2
      });

      writerInstance.quiz({
        onCorrectStroke(data) {
          statusEl.textContent = `เยี่ยม! ขีดที่ ${data.strokeNum + 1} ถูกต้อง (เหลืออีก ${data.strokesRemaining} ขีด)`;
        },
        onMistake() {
          statusEl.textContent = 'ทิศทางหรือลำดับขีดยังไม่ตรง ลองลากใหม่อีกครั้งนะ!';
        },
        onComplete(summary) {
          statusEl.textContent = `🎉 ยอดเยี่ยม! เขียน "${item.char}" (${item.pinyin}) ครบสมบูรณ์ (พลาด ${summary.totalMistakes} ครั้ง)`;
          ensureTodayDaily(state.progress).writes++;
          if (!state.progress.writing.includes(item.char)) {
            state.progress.writing.push(item.char);
          }
          saveProgress(`เขียนผ่าน "${item.char}"`);
          renderWritingPicker();
          speak(item.char);
        }
      });
    } else {
      // Freehand Canvas mode (or graceful offline fallback)
      targetEl.hidden = true;
      canvasEl.hidden = false;
      writerInstance = null;
      drawFreehandBackground();
      statusEl.textContent = hasHanziWriter
        ? 'โหมดเขียนอิสระ: ลากเส้นฝึกเขียนด้วยเมาส์หรือนิ้วบนช่อง米字格ได้เลย'
        : 'โหมดเขียนอิสระ (ออฟไลน์): ลากเส้นตามเส้นร่างตัวอักษรได้เลย';
    }
  }

  function drawFreehandBackground() {
    const canvas = document.getElementById('freehand-canvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (state.writingOutline) {
      const ch = WS.writingChars[state.writingIdx].char;
      ctx.save();
      ctx.font = '200px "Noto Sans SC", "Microsoft YaHei", sans-serif';
      ctx.fillStyle = 'rgba(21, 71, 62, 0.12)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ch, 130, 138);
      ctx.restore();
    }
  }

  function setupFreehandCanvas() {
    if (freehandSetupDone) return;
    freehandSetupDone = true;
    const canvas = document.getElementById('freehand-canvas');
    const ctx = canvas.getContext('2d');
    let drawing = false;

    function getPos(e) {
      const rect = canvas.getBoundingClientRect();
      const pt = e.touches ? e.touches[0] : e;
      return {
        x: (pt.clientX - rect.left) * (canvas.width / rect.width),
        y: (pt.clientY - rect.top) * (canvas.height / rect.height)
      };
    }

    function start(e) {
      e.preventDefault();
      drawing = true;
      const p = getPos(e);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineWidth = 12;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#15473e';
    }

    function move(e) {
      if (!drawing) return;
      e.preventDefault();
      const p = getPos(e);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }

    function end() {
      drawing = false;
    }

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', end);
  }

  // ---- MODULE 7: Practice, Speaking Lab & Level 1 Exam ----
  function initPracticeSelectors() {
    document.querySelectorAll('.drill-mode-card').forEach(btn => {
      btn.addEventListener('click', () => {
        state.drillMode = btn.dataset.mode;
        document.querySelectorAll('.drill-mode-card').forEach(b => b.classList.toggle('active', b === btn));
        state.drillStreak = 0;
        if (state.drillMode === 'mastery') {
          state.quizIndex = 0;
          state.quizScore = 0;
          state.quizAnswered = false;
        }
        nextDrillQuestion();
      });
    });
  }

  function nextDrillQuestion() {
    if (state.drillMode === 'tones') {
      const set = DATA.toneSets[Math.floor(Math.random() * DATA.toneSets.length)];
      const target = set.items[Math.floor(Math.random() * set.items.length)];
      state.currentDrill = { set, target, answered: false };
      renderToneDrill();
    } else if (state.drillMode === 'pairs') {
      const pool = DATA.confusingPairs.filter(p => {
        if (state.pairFilter === 'all') return true;
        if (state.pairFilter === 'asp') return p.group === 'asp';
        if (state.pairFilter === 'week1') return p.week === 1;
        if (state.pairFilter === 'week2') return p.week === 2;
        return true;
      });
      const activePool = pool.length ? pool : DATA.confusingPairs;
      const pair = activePool[Math.floor(Math.random() * activePool.length)];
      const target = pair.options[Math.floor(Math.random() * pair.options.length)];
      state.currentDrill = { pair, target, answered: false };
      renderPairDrill();
    } else if (state.drillMode === 'speaking') {
      renderSpeakingDrill();
    } else if (state.drillMode === 'weakspot') {
      renderWeakSpotDrill();
    } else if (state.drillMode === 'typing') {
      renderTypingDrill();
    } else {
      renderMasteryQuiz();
    }
  }

  function renderToneDrill() {
    const { set, target } = state.currentDrill;
    const stage = document.getElementById('drill-stage');
    stage.innerHTML = `
      <div class="drill-topbar">
        <span>โหมด: ฟังแยกวรรณยุกต์ (ชุด ${set.base})</span>
        <span class="streak-badge">🔥 ถูกติดกัน ${state.drillStreak}</span>
      </div>
      <div class="drill-prompt">
        <h3>กดฟังเสียงแล้วเลือกพินอินที่มีวรรณยุกต์ตรงกับที่ได้ยิน</h3>
        <button type="button" class="drill-audio-btn" id="drill-play">🔊 กดเพื่อฟังเสียง</button>
      </div>
      <div class="drill-options">
        ${set.items.map(item => `
          <button type="button" class="drill-opt" data-tone="${item.tone}">
            <div style="font-size:22px">${item.pinyin}</div>
            <div style="font-size:13px;color:var(--muted);font-weight:500">เสียงที่ ${item.tone}</div>
          </button>
        `).join('')}
      </div>
      <div class="drill-feedback" id="drill-fb"></div>
      <div style="text-align:right">
        <button type="button" class="btn-primary" id="drill-next" style="display:none">ข้อถัดไป →</button>
      </div>
    `;

    stage.querySelectorAll('[data-pfilter]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.pairFilter = btn.dataset.pfilter;
        nextDrillQuestion();
      });
    });

    document.getElementById('drill-play').addEventListener('click', () => speak(target.hanzi));

    stage.querySelectorAll('.drill-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        if (state.currentDrill.answered) return;
        state.currentDrill.answered = true;
        const chosen = Number(btn.dataset.tone);
        const fb = document.getElementById('drill-fb');
        stage.querySelectorAll('.drill-opt').forEach(b => {
          b.disabled = true;
          if (Number(b.dataset.tone) === target.tone) b.classList.add('correct');
        });
        if (chosen === target.tone) {
          state.drillStreak++;
          state.progress.drillCorrect++;
          ensureTodayDaily(state.progress).drills++;
          saveProgress('ฟังแยกวรรณยุกต์ถูก');
          fb.className = 'drill-feedback show ok';
          fb.innerHTML = `<b>ถูกต้อง! ✓</b> คำที่ได้ยินคือ <b class="hanzi-font">${target.hanzi}</b> (${target.pinyin} · เสียงที่ ${target.tone}) แปลว่า "${target.meaning}"`;
        } else {
          state.drillStreak = 0;
          playChime('err');
          recordMistake({
            id: `tone_${target.hanzi}`,
            q: `ฟังเสียงชุด ${set.base} แล้วเลือกวรรณยุกต์ที่ได้ยิน`,
            audioChar: target.hanzi,
            options: set.items.map(it => `${it.pinyin} (เสียง ${it.tone})`),
            answer: set.items.findIndex(it => it.tone === target.tone),
            explain: `${target.hanzi} (${target.pinyin}) เสียงที่ ${target.tone} แปลว่า "${target.meaning}"`
          });
          saveProgress();
          btn.classList.add('wrong');
          fb.className = 'drill-feedback show err';
          fb.innerHTML = `<b>เกือบถูกแล้ว!</b> คำที่ได้ยินคือ <b class="hanzi-font">${target.hanzi}</b> (${target.pinyin} · เสียงที่ ${target.tone}) แปลว่า "${target.meaning}" — เก็บเข้าโหมดซ่อมจุดอ่อนให้แล้ว`;
        }
        document.getElementById('drill-next').style.display = 'inline-block';
      });
    });

    document.getElementById('drill-next').addEventListener('click', nextDrillQuestion);
  }

  function renderPairDrill() {
    const { pair, target } = state.currentDrill;
    const stage = document.getElementById('drill-stage');
    const pFilters = [
      { id: 'all', label: 'ทั้งหมด' },
      { id: 'asp', label: 'พ่นลม (b/p, d/t, g/k)' },
      { id: 'week1', label: 'สัปดาห์ที่ 1 (ไม่ปนม้วนลิ้น)' },
      { id: 'week2', label: 'สัปดาห์ที่ 2 (ม้วนลิ้น & -n/-ng)' }
    ];
    stage.innerHTML = `
      <div class="finals-filter" style="margin-bottom:12px">
        ${pFilters.map(f => `<button type="button" class="filter-pill ${state.pairFilter === f.id ? 'active' : ''}" data-pfilter="${f.id}">${f.label}</button>`).join('')}
      </div>
      <div class="drill-topbar">
        <span>หัวข้อ: ${escapeHtml(pair.category)}</span>
        <span class="streak-badge">ถูกติดกัน ${state.drillStreak}</span>
      </div>
      <div class="drill-prompt">
        <h3>${escapeHtml(pair.prompt)}</h3>
        <button type="button" class="drill-audio-btn" id="drill-play">🔊 กดเพื่อฟังเสียง</button>
      </div>
      <div class="drill-options" style="grid-template-columns: repeat(${pair.options.length}, 1fr)">
        ${pair.options.map(opt => `
          <button type="button" class="drill-opt" data-py="${opt.pinyin}">
            <div style="font-size:24px">${opt.pinyin}</div>
          </button>
        `).join('')}
      </div>
      <div class="drill-feedback" id="drill-fb"></div>
      <div style="text-align:right">
        <button type="button" class="btn-primary" id="drill-next" style="display:none">ข้อถัดไป →</button>
      </div>
    `;

    stage.querySelectorAll('[data-pfilter]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.pairFilter = btn.dataset.pfilter;
        nextDrillQuestion();
      });
    });

    document.getElementById('drill-play').addEventListener('click', () => speak(target.hanzi));

    stage.querySelectorAll('.drill-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        if (state.currentDrill.answered) return;
        state.currentDrill.answered = true;
        const chosen = btn.dataset.py;
        const fb = document.getElementById('drill-fb');
        stage.querySelectorAll('.drill-opt').forEach(b => {
          b.disabled = true;
          if (b.dataset.py === target.pinyin) b.classList.add('correct');
        });
        if (chosen === target.pinyin) {
          state.drillStreak++;
          state.progress.drillCorrect++;
          ensureTodayDaily(state.progress).drills++;
          saveProgress('แยกคู่เสียงสับสนถูก');
          fb.className = 'drill-feedback show ok';
          fb.innerHTML = `<b>เป๊ะมาก! ✓</b> <b class="hanzi-font">${target.hanzi}</b> (${target.pinyin} = ${target.meaning})<br>💡 เคล็ดลับ: ${escapeHtml(pair.tip)}`;
        } else {
          state.drillStreak = 0;
          playChime('err');
          recordMistake({
            id: `pair_${target.hanzi}`,
            q: pair.prompt,
            audioChar: target.hanzi,
            options: pair.options.map(o => o.pinyin),
            answer: pair.options.findIndex(o => o.pinyin === target.pinyin),
            explain: `${target.hanzi} (${target.pinyin} = ${target.meaning}) · ${pair.tip}`
          });
          saveProgress();
          btn.classList.add('wrong');
          fb.className = 'drill-feedback show err';
          fb.innerHTML = `<b>ยังไม่ตรง!</b> คำที่ถูกต้องคือ <b class="hanzi-font">${target.hanzi}</b> (${target.pinyin} = ${target.meaning})<br>💡 เคล็ดลับ: ${escapeHtml(pair.tip)}`;
        }
        document.getElementById('drill-next').style.display = 'inline-block';
      });
    });

    document.getElementById('drill-next').addEventListener('click', nextDrillQuestion);
  }

  // ---- Speaking Lab (Web Speech Recognition + Shadowing Voice Recorder) ----
  let mediaRec = null;
  let recChunks = [];
  let lastRecordingUrl = null;
  let isRecordingVoice = false;

  function renderSpeakingDrill() {
    const item = WS.speakingChallenges[state.speakingIdx % WS.speakingChallenges.length];
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    const stage = document.getElementById('drill-stage');

    stage.innerHTML = `
      <div class="drill-topbar">
        <span>ฝึกพูด & Shadowing · คำที่ ${(state.speakingIdx % WS.speakingChallenges.length) + 1} / ${WS.speakingChallenges.length}</span>
        <span class="streak-badge">พูดผ่านติดกัน ${state.drillStreak}</span>
      </div>
      <div class="speaking-card">
        <div class="speaking-target-hanzi hanzi-font">${item.hanzi}</div>
        <div class="speaking-target-py">${item.pinyin}</div>
        <div style="font-size:16px;color:var(--sys-label-2)">${escapeHtml(item.meaning)}</div>
        <div class="speaking-focus">โฟกัส: ${escapeHtml(item.focus)}</div>

        <div class="mic-actions">
          <button type="button" class="btn-speak" id="sp-listen">ฟังต้นฉบับ</button>
          <button type="button" class="mic-btn" id="sp-mic">พูดเช็คสำเนียง (AI ฟัง)</button>
        </div>

        <div class="transcript-box" id="sp-transcript">
          ${SpeechRec ? 'กดปุ่มสีแดงแล้วลองออกเสียงภาษาจีนให้ชัดเจน' : 'เบราว์เซอร์นี้ยังไม่รองรับ Speech Recognition (แนะนำใช้ Chrome / Edge)'}
        </div>
        <div class="drill-feedback" id="sp-fb"></div>

        <!-- Shadowing Voice Recorder Compare -->
        <div class="shadow-box">
          <div class="shadow-box-title">โหมด Shadowing · อัดเสียงตัวเองเพื่อฟังเทียบกับต้นฉบับ</div>
          <div class="shadow-actions">
            <button type="button" class="rec-btn ${isRecordingVoice ? 'recording' : ''}" id="sh-rec">
              ${isRecordingVoice ? '■ หยุดอัด' : '● อัดเสียงเรา'}
            </button>
            <button type="button" class="btn-secondary" id="sh-play-mine" ${lastRecordingUrl ? '' : 'disabled'}>▶ ฟังเสียงเรา</button>
            <button type="button" class="btn-primary" id="sh-compare" ${lastRecordingUrl ? '' : 'disabled'}>🔁 เทียบ ต้นฉบับ → เสียงเรา</button>
          </div>
        </div>

        <div style="display:flex;justify-content:center;gap:10px;margin-top:14px">
          <button type="button" class="btn-secondary" id="sp-prev">← คำก่อนหน้า</button>
          <button type="button" class="btn-primary" id="sp-next">คำถัดไป →</button>
        </div>
      </div>
    `;

    document.getElementById('sp-listen').addEventListener('click', () => speak(item.hanzi));
    document.getElementById('sp-prev').addEventListener('click', () => {
      state.speakingIdx = (state.speakingIdx - 1 + WS.speakingChallenges.length) % WS.speakingChallenges.length;
      renderSpeakingDrill();
    });
    document.getElementById('sp-next').addEventListener('click', () => {
      state.speakingIdx = (state.speakingIdx + 1) % WS.speakingChallenges.length;
      renderSpeakingDrill();
    });

    // Shadowing Recorder Wiring
    document.getElementById('sh-rec').addEventListener('click', async () => {
      if (isRecordingVoice && mediaRec) {
        mediaRec.stop();
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        showToast('เบราว์เซอร์นี้ไม่รองรับการอัดเสียง (MediaRecorder)', 'INFO');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        recChunks = [];
        mediaRec = new MediaRecorder(stream);
        mediaRec.ondataavailable = (e) => { if (e.data.size > 0) recChunks.push(e.data); };
        mediaRec.onstop = () => {
          stream.getTracks().forEach(t => t.stop());
          if (lastRecordingUrl) URL.revokeObjectURL(lastRecordingUrl);
          lastRecordingUrl = URL.createObjectURL(new Blob(recChunks, { type: 'audio/webm' }));
          isRecordingVoice = false;
          playChime('ok');
          renderSpeakingDrill();
        };
        mediaRec.start();
        isRecordingVoice = true;
        renderSpeakingDrill();
      } catch {
        showToast('กรุณาอนุญาตการใช้ไมโครโฟนเพื่ออัดเสียงเทียบ', 'MIC');
      }
    });

    document.getElementById('sh-play-mine')?.addEventListener('click', () => {
      if (!lastRecordingUrl) return;
      new Audio(lastRecordingUrl).play().catch(() => {});
    });

    document.getElementById('sh-compare')?.addEventListener('click', () => {
      if (!lastRecordingUrl) return;
      speak(item.hanzi, () => {
        setTimeout(() => { new Audio(lastRecordingUrl).play().catch(() => {}); }, 350);
      });
    });

    const micBtn = document.getElementById('sp-mic');
    if (!SpeechRec) {
      micBtn.disabled = true;
      micBtn.style.opacity = '0.5';
      return;
    }

    micBtn.addEventListener('click', () => {
      if (state.isListening) return;
      const rec = new SpeechRec();
      rec.lang = 'zh-CN';
      rec.interimResults = false;
      rec.maxAlternatives = 3;

      state.isListening = true;
      micBtn.classList.add('listening');
      micBtn.textContent = '🔴 กำลังฟังเสียงคุณ... พูดเลย!';
      const trBox = document.getElementById('sp-transcript');
      const fb = document.getElementById('sp-fb');
      trBox.textContent = 'กำลังรับฟังเสียงภาษาจีน...';
      fb.className = 'drill-feedback';

      rec.onresult = (event) => {
        const alts = Array.from(event.results[0]).map(r => r.transcript.replace(/[。，！？\s]/g, ''));
        const heard = alts[0] || '';
        trBox.innerHTML = `ระบบได้ยินว่า: <b class="hanzi-font" style="font-size:20px">${escapeHtml(heard)}</b>`;

        const matched = alts.some(txt => item.accept.some(acc => txt.includes(acc)));
        if (matched) {
          state.drillStreak++;
          state.progress.drillCorrect++;
          saveProgress();
          fb.className = 'drill-feedback show ok';
          fb.innerHTML = `<b>ยอดเยี่ยม! สำเนียงชัดเจนมาก ✓</b> ระบบจับคำว่า <b class="hanzi-font">${item.hanzi}</b> (${item.pinyin}) ได้ตรงเป๊ะ! <div style="margin-top:8px"><button type="button" class="btn-secondary" id="sp-ai-coach-btn" style="font-size:12px;padding:4px 10px">🎙️ ให้ครู AI แนะนำวิธีออกเสียงให้เป๊ะขึ้น</button></div><div id="sp-ai-coach-box"></div>`;
        } else {
          state.drillStreak = 0;
          fb.className = 'drill-feedback show err';
          fb.innerHTML = `<b>ยังคลาดเคลื่อนเล็กน้อย</b> ระบบได้ยิน "${escapeHtml(heard)}" — ลองกดฟังต้นฉบับแล้วเน้น "${escapeHtml(item.focus)}" อีกครั้งนะ <div style="margin-top:8px"><button type="button" class="btn-primary" id="sp-ai-coach-btn" style="font-size:12px;padding:4px 10px">🎙️ ให้ครู AI วิเคราะห์จุดเพี้ยน & วิธีวางลิ้น</button></div><div id="sp-ai-coach-box"></div>`;
        }

        document.getElementById('sp-ai-coach-btn')?.addEventListener('click', async () => {
          const btn = document.getElementById('sp-ai-coach-btn');
          const box = document.getElementById('sp-ai-coach-box');
          if (!authState.user) {
            showToast('กรุณาเข้าสู่ระบบก่อนใช้ครู AI วิเคราะห์การออกเสียง', 'LOGIN');
            openAuthModal();
            return;
          }
          if (btn) { btn.disabled = true; btn.textContent = 'กำลังวิเคราะห์สำเนียง...'; }
          try {
            const res = await fetch('/api/ai/tutor', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'same-origin',
              body: JSON.stringify({
                mode: 'pronunciation',
                targetHz: item.hanzi,
                targetPy: item.pinyin,
                heardHz: heard
              })
            });
            const data = await res.json().catch(() => ({}));
            if (data.usage) state.aiUsage = data.usage;
            if (!res.ok || !data.coaching) throw new Error(data.error || 'ไม่สามารถวิเคราะห์เสียงได้ชั่วคราว');
            const c = data.coaching;
            if (box) {
              box.innerHTML = `
                <div style="margin-top:10px;padding:10px 12px;border-radius:10px;background:var(--sys-fill-2);text-align:left;font-size:13px;line-height:1.55">
                  <div><b>🎯 คะแนนความชัด: ${Number(c.score || 0)}/100</b> · ${escapeHtml(c.summary)}</div>
                  <div style="margin-top:4px"><b>👅 วิธีวางลิ้น/วรรณยุกต์:</b> ${escapeHtml(c.mouthTip)}</div>
                  ${c.drill ? `<div style="margin-top:4px;color:var(--sys-accent-text)"><b>🗣️ ซ้อมตามนี้:</b> ${escapeHtml(c.drill)}</div>` : ''}
                </div>
              `;
            }
            if (btn) btn.remove();
          } catch (err) {
            if (btn) { btn.disabled = false; btn.textContent = '🎙️ ลองวิเคราะห์อีกครั้ง'; }
            showToast(err.message || 'ครู AI ไม่พร้อมใช้งานชั่วคราว', 'AI');
          }
        });
      };

      rec.onerror = (ev) => {
        const msg = ev.error === 'not-allowed'
          ? 'กรุณาอนุญาตการใช้ไมโครโฟนในเบราว์เซอร์ก่อนฝึกพูด'
          : ev.error === 'no-speech'
            ? 'ไม่ได้ยินเสียงพูด ลองกดปุ่มแล้วพูดใกล้ไมโครโฟนมากขึ้น'
            : `เกิดข้อผิดพลาดจากไมโครโฟน (${ev.error})`;
        trBox.textContent = msg;
      };

      rec.onend = () => {
        state.isListening = false;
        micBtn.classList.remove('listening');
        micBtn.textContent = '🎤 กดเพื่อพูดใส่ไมค์';
      };

      rec.start();
    });
  }

  function renderMasteryQuiz() {
    const stage = document.getElementById('drill-stage');
    const total = DATA.masteryQuiz.length;

    if (state.quizIndex >= total) {
      const passed = state.quizScore >= 8;
      if (state.progress.bestQuiz === null || state.quizScore > state.progress.bestQuiz) {
        state.progress.bestQuiz = state.quizScore;
        saveProgress();
      }
      stage.innerHTML = `
        <div style="text-align:center;padding:24px 10px">
          <div style="font-size:52px;margin-bottom:8px">${passed ? '🏆' : '💪'}</div>
          <h3 style="margin:0 0 8px;font-size:24px;color:var(--jade)">
            ${passed ? 'ยินดีด้วย! คุณผ่านพื้นฐาน Level 1 แล้ว' : 'อีกนิดเดียว! ลองทบทวนแล้วสอบใหม่นะ'}
          </h3>
          <p style="font-size:18px;margin:0 0 20px">คะแนนของคุณ: <b>${state.quizScore} / ${total}</b> (เกณฑ์ผ่าน 8/10)</p>
          <button type="button" class="btn-primary" id="quiz-retry">ทำแบบทดสอบอีกครั้ง</button>
        </div>
      `;
      document.getElementById('quiz-retry').addEventListener('click', () => {
        state.quizIndex = 0;
        state.quizScore = 0;
        state.quizAnswered = false;
        renderMasteryQuiz();
      });
      return;
    }

    const qObj = DATA.masteryQuiz[state.quizIndex];
    stage.innerHTML = `
      <div class="drill-topbar">
        <span>ข้อสอบวัดระดับ Level 1 · ข้อที่ ${state.quizIndex + 1} / ${total}</span>
        <span class="streak-badge">คะแนนสะสม: ${state.quizScore}</span>
      </div>
      <h3 style="margin:0 0 18px;font-size:19px">${escapeHtml(qObj.q)}</h3>
      <div class="drill-options" style="grid-template-columns:1fr">
        ${qObj.options.map((opt, idx) => `
          <button type="button" class="drill-opt" style="text-align:left" data-idx="${idx}">
            ${idx + 1}. ${escapeHtml(opt)}
          </button>
        `).join('')}
      </div>
      <div class="drill-feedback" id="quiz-fb"></div>
      <div style="text-align:right">
        <button type="button" class="btn-primary" id="quiz-next" style="display:none">
          ${state.quizIndex + 1 === total ? 'ดูผลคะแนน' : 'ข้อถัดไป →'}
        </button>
      </div>
    `;

    stage.querySelectorAll('.drill-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        if (state.quizAnswered) return;
        state.quizAnswered = true;
        const chosen = Number(btn.dataset.idx);
        const fb = document.getElementById('quiz-fb');
        stage.querySelectorAll('.drill-opt').forEach(b => {
          b.disabled = true;
          if (Number(b.dataset.idx) === qObj.answer) b.classList.add('correct');
        });
        if (chosen === qObj.answer) {
          state.quizScore++;
          fb.className = 'drill-feedback show ok';
          fb.innerHTML = `<b>ถูกต้อง! ✓</b> ${escapeHtml(qObj.explain)}`;
        } else {
          btn.classList.add('wrong');
          fb.className = 'drill-feedback show err';
          fb.innerHTML = `<b>ยังไม่ถูกต้อง</b> · ${escapeHtml(qObj.explain)}`;
        }
        document.getElementById('quiz-next').style.display = 'inline-block';
      });
    });

    document.getElementById('quiz-next').addEventListener('click', () => {
      state.quizIndex++;
      state.quizAnswered = false;
      renderMasteryQuiz();
    });
  }

  // ---- MODULE 8: Core Vocabulary & Daily 100-Word Collector ----
  let vocabIndexCache = null;

  function stripToneMarks(str) {
    return String(str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  function getVocabIndex() {
    if (vocabIndexCache) return vocabIndexCache;
    vocabIndexCache = LEXICON.map((row, idx) => ({
      id: idx,
      hanzi: row[0] || '',
      pinyin: row[1] || '',
      pinyinPlain: stripToneMarks(row[1] || ''),
      meaning: row[2] || '',
      meaningLow: String(row[2] || '').toLowerCase(),
      level: Number(row[3]) || 1
    }));
    return vocabIndexCache;
  }

  function getVocabTodayCount() {
    const tk = todayKey();
    const map = state.progress.vocabLearned || {};
    let n = 0;
    for (const k in map) {
      if (map[k] === tk) n++;
    }
    return n;
  }

  function getVocabTotalLearned() {
    return Object.keys(state.progress.vocabLearned || {}).length;
  }

  function getVocabCompletedDays() {
    const map = state.progress.vocabLearned || {};
    const goal = state.progress.vocabGoal || 100;
    const byDate = {};
    for (const k in map) {
      const d = map[k];
      byDate[d] = (byDate[d] || 0) + 1;
    }
    let days = 0;
    for (const d in byDate) {
      if (byDate[d] >= goal) days++;
    }
    return days;
  }

  function checkVocabMilestones(todayCount) {
    const tk = todayKey();
    const goal = state.progress.vocabGoal || 100;
    if (!state.progress.vocabMilestones) state.progress.vocabMilestones = {};
    const claimed = Array.isArray(state.progress.vocabMilestones[tk]) ? state.progress.vocabMilestones[tk] : [];
    const tiers = [
      { pct: 25, xp: 20, label: `สะสมครบ ${Math.round(goal * 0.25)} คำวันนี้!` },
      { pct: 50, xp: 35, label: `ครึ่งทางแล้ว! สะสมครบ ${Math.round(goal * 0.5)} คำวันนี้` },
      { pct: 75, xp: 45, label: `อีกนิดเดียว! สะสมครบ ${Math.round(goal * 0.75)} คำวันนี้` },
      { pct: 100, xp: 100, label: `พิชิตเป้า ${goal} คำวันนี้สำเร็จ!` }
    ];
    let hitFull = false;
    let gainedLabel = '';
    for (const t of tiers) {
      const threshold = Math.max(1, Math.round((goal * t.pct) / 100));
      if (todayCount >= threshold && !claimed.includes(t.pct)) {
        claimed.push(t.pct);
        state.progress.bonusXp = (state.progress.bonusXp || 0) + t.xp;
        gainedLabel = t.label;
        if (t.pct === 100) hitFull = true;
      }
    }
    state.progress.vocabMilestones[tk] = claimed;
    if (hitFull) {
      spawnConfetti(36);
      if (typeof pandaReact === 'function') pandaReact('levelup');
    }
    return gainedLabel;
  }

  function stopVocabAutoPlay() {
    state.vocabAutoPlay = false;
    state.vocabAutoPlayPos = -1;
    if (state.vocabAutoPlayTimer) {
      clearTimeout(state.vocabAutoPlayTimer);
      state.vocabAutoPlayTimer = null;
    }
    stopSpeech();
    const btn = document.getElementById('vb-autoplay-btn');
    if (btn) {
      btn.textContent = '🔊 ฟังต่อเนื่อง';
      btn.classList.remove('active');
    }
    document.querySelectorAll('.vb-item.is-playing').forEach(el => el.classList.remove('is-playing'));
  }

  function startVocabAutoPlay(items) {
    if (!items.length) return;
    stopVocabAutoPlay();
    state.vocabAutoPlay = true;
    state.vocabAutoPlayPos = 0;
    const btn = document.getElementById('vb-autoplay-btn');
    if (btn) {
      btn.textContent = '⏹ หยุดฟัง';
      btn.classList.add('active');
    }

    const playNext = () => {
      if (!state.vocabAutoPlay) return;
      if (state.vocabAutoPlayPos >= items.length) {
        stopVocabAutoPlay();
        showToast('เล่นเสียงครบชุดนี้แล้ว!', '', false);
        return;
      }
      const item = items[state.vocabAutoPlayPos];
      document.querySelectorAll('.vb-item.is-playing').forEach(el => el.classList.remove('is-playing'));
      const card = document.querySelector(`.vb-item[data-vid="${item.id}"]`);
      if (card) {
        card.classList.add('is-playing');
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      speak(item.hanzi, () => {
        if (!state.vocabAutoPlay) return;
        state.vocabAutoPlayPos++;
        state.vocabAutoPlayTimer = setTimeout(playNext, 550);
      });
    };
    playNext();
  }

  const VOCAB_TOPICS = [
    { key: 'all', label: 'ทุกหมวดหมู่', re: null },
    { key: 'food', label: '🍜 อาหาร & เครื่องดื่ม', re: /กิน|ดื่ม|ข้าว|น้ำ|ชา|กาแฟ|ผลไม้|ผัก|เนื้อ|ไข่|ขนม|บะหมี่|ซาลาเปา|อร่อย|หิว|อิ่ม|อาหาร|ร้านอาหาร|เมนู|ผล|นม|ซุป|เกลือ|น้ำตาล|เปรี้ยว|หวาน|เผ็ด/ },
    { key: 'family', label: '👨‍👩‍👧 ครอบครัว & คน', re: /พ่อ|แม่|พี่|น้อง|ลูก|ปู่|ย่า|ตา|ยาย|เพื่อน|แฟน|ครู|อาจารย์|นักเรียน|นักศึกษา|หมอ|คน|ผู้ชาย|ผู้หญิง|เด็ก|สามี|ภรรยา|ครอบครัว|ญาติ|ลูกค้า/ },
    { key: 'time', label: '⏰ เวลา & วัน', re: /วัน|เดือน|ปี|ชั่วโมง|นาที|เช้า|เที่ยง|บ่าย|เย็น|กลางคืน|พรุ่งนี้|เมื่อวาน|วันนี้|สัปดาห์|เวลา|ตอน|เร็ว|ช้า|ฤดู|ตรุษ|ชั่วครู่|ทันที|บ่อย/ },
    { key: 'travel', label: '✈️ เดินทาง & สถานที่', re: /รถ|เครื่องบิน|เรือ|สถานี|สนามบิน|ตั๋ว|ถนน|ทาง|ไป|มา|กลับ|ทิศ|เหนือ|ใต้|ออก|ตก|ประเทศ|จีน|ปักกิ่ง|โรงเรียน|โรงพยาบาล|ห้าง|ร้าน|ห้องสมุด|สวน|ทะเล|ภูเขา|สถานที่/ },
    { key: 'work', label: '💼 งาน & การเรียน', re: /งาน|ทำงาน|บริษัท|สำนักงาน|ประชุม|เรียน|ศึกษา|สอบ|หนังสือ|สมุด|ปากกา|วิชา|บทเรียน|คะแนน|ความรู้|ภาษา|อักษร|อ่าน|เขียน|ฟัง|พูด|คอมพิวเตอร์|อินเทอร์เน็ต|โทรศัพท์/ },
    { key: 'emotion', label: '😊 อารมณ์ & นิสัย', re: /รัก|ชอบ|ดีใจ|โกรธ|เหนื่อย|เสียใจ|กลัว|อาย|เกรงใจ|สนุก|ตั้งใจ|ใจเย็น|เป็นห่วง|ขอบคุณ|ขอโทษ|ยินดี|รู้สึก|คิดถึง|หัวเราะ|ยิ้ม|ร้องไห้|สงบ|ซาบซึ้ง/ },
    { key: 'money', label: '💰 ตัวเลข & เงิน', re: /หนึ่ง|สอง|สาม|สี่|ห้า|หก|เจ็ด|แปด|เก้า|สิบ|ร้อย|พัน|หมื่น|ศูนย์|เงิน|หยวน|แพง|ถูก|ซื้อ|ขาย|จ่าย|ราคา|กระเป๋าสตางค์|เท่าไร|กี่|ครึ่ง|มาก|น้อย/ },
    { key: 'home', label: '🏠 บ้าน & ของใช้', re: /บ้าน|ห้อง|เตียง|โต๊ะ|เก้าอี้|ประตู|หน้าต่าง|เสื้อ|ผ้า|รองเท้า|แก้ว|ถ้วย|กระเป๋า|โคมไฟ|ทีวี|โทรทัศน์|มือถือ|สะอาด|เปิด|ปิด|ล้าง|ซัก|นอน|ตื่น/ }
  ];

  function getVocabLevelPool(levelKey) {
    const all = getVocabIndex();
    let pool = levelKey === 'all' ? all : all.filter(w => w.level === Number(levelKey));
    if (state.vocabTopic && state.vocabTopic !== 'all') {
      const tp = VOCAB_TOPICS.find(t => t.key === state.vocabTopic);
      if (tp && tp.re) {
        pool = pool.filter(w => tp.re.test(w.meaning));
      }
    }
    return pool;
  }

  function getVocabVisibleItems() {
    const pool = getVocabLevelPool(state.vocabLevel);
    const learnedMap = state.progress.vocabLearned || {};
    const tk = todayKey();
    const q = state.vocabQuery.trim().toLowerCase();
    const qPlain = stripToneMarks(q);
    const goal = state.progress.vocabGoal || 100;

    let filtered = pool;
    if (q) {
      filtered = pool.filter(w =>
        w.hanzi.includes(q) ||
        w.pinyin.toLowerCase().includes(q) ||
        w.pinyinPlain.includes(qPlain) ||
        w.meaningLow.includes(q)
      );
    }

    if (state.vocabStatusFilter === 'unlearned') {
      filtered = filtered.filter(w => !learnedMap[w.id]);
    } else if (state.vocabStatusFilter === 'learned') {
      filtered = filtered.filter(w => Boolean(learnedMap[w.id]));
    } else if (state.vocabStatusFilter === 'today') {
      filtered = filtered.filter(w => learnedMap[w.id] === tk);
    } else if (state.vocabStatusFilter === 'starred') {
      const starSet = new Set(state.progress.vocabStarred || []);
      filtered = filtered.filter(w => starSet.has(w.id));
    }

    if (q || state.vocabStatusFilter !== 'all') {
      return {
        items: filtered.slice(0, 200),
        totalMatched: filtered.length,
        totalSets: Math.max(1, Math.ceil(pool.length / goal)),
        isFiltered: true,
        setStart: 1,
        setEnd: Math.min(filtered.length, 200)
      };
    }

    const totalSets = Math.max(1, Math.ceil(pool.length / goal));
    if (state.vocabSet > totalSets) state.vocabSet = totalSets;
    if (state.vocabSet < 1) state.vocabSet = 1;
    const startIdx = (state.vocabSet - 1) * goal;
    const slice = pool.slice(startIdx, startIdx + goal);
    return {
      items: slice,
      totalMatched: pool.length,
      totalSets,
      isFiltered: false,
      setStart: startIdx + 1,
      setEnd: startIdx + slice.length
    };
  }

  function updateVocabHeroCounters() {
    const todayCount = getVocabTodayCount();
    const totalLearned = getVocabTotalLearned();
    const goal = state.progress.vocabGoal || 100;
    const pct = Math.min(100, Math.round((todayCount / goal) * 100));
    const doneDays = getVocabCompletedDays();

    const todayEl = document.getElementById('vb-today-count');
    if (todayEl) todayEl.textContent = `${todayCount} / ${goal} คำ`;
    const pctEl = document.getElementById('vb-today-pct');
    if (pctEl) pctEl.textContent = `${pct}%`;
    const barEl = document.getElementById('vb-today-bar');
    if (barEl) barEl.style.width = `${pct}%`;
    const totalEl = document.getElementById('vb-total-learned');
    if (totalEl) totalEl.textContent = `${totalLearned.toLocaleString()} / ${LEXICON.length.toLocaleString()} คำ`;
    const daysEl = document.getElementById('vb-done-days');
    if (daysEl) daysEl.textContent = `${doneDays} วัน`;

    const navVocab = document.getElementById('nav-vocab-badge');
    if (navVocab) {
      navVocab.textContent = todayCount >= goal ? `${todayCount} ✓` : `${todayCount}/${goal}`;
    }

    // Update 4x25 Chunking Sprint segments
    const chunkSize = Math.max(1, Math.ceil(goal / 4));
    for (let c = 0; c < 4; c++) {
      const seg = document.getElementById(`vb-chunk-${c}`);
      if (!seg) continue;
      const filled = Math.max(0, Math.min(chunkSize, todayCount - c * chunkSize));
      seg.classList.toggle('done', filled >= chunkSize);
      seg.classList.toggle('active', filled > 0 && filled < chunkSize);
      const valEl = seg.querySelector('b');
      if (valEl) valEl.textContent = `${filled}/${chunkSize}`;
    }
  }

  function printVocabCheatSheet(items, title) {
    if (!items.length) {
      showToast('ไม่มีคำศัพท์สำหรับพิมพ์', '', false);
      return;
    }
    const win = window.open('', '_blank', 'width=960,height=780');
    if (!win) {
      showToast('เบราว์เซอร์บล็อกหน้าต่างป๊อปอัป กรุณาอนุญาตป๊อปอัปเพื่อพิมพ์ชีท', '', false);
      return;
    }
    const rowsHtml = items.map((w, i) => `
      <div class="p-row">
        <span class="p-chk">☐</span>
        <span class="p-num">${i + 1}.</span>
        <span class="p-hz">${escapeHtml(w.hanzi)}</span>
        <span class="p-py">${escapeHtml(w.pinyin)}</span>
        <span class="p-th">${escapeHtml(w.meaning)}</span>
      </div>
    `).join('');
    win.document.write(`<!doctype html>
<html lang="th"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  body { font-family: "Noto Sans Thai", "Noto Sans SC", system-ui, sans-serif; margin: 18px; color: #111; }
  .p-head { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #222; padding-bottom: 8px; margin-bottom: 12px; }
  .p-head h1 { margin: 0; font-size: 18px; }
  .p-head button { padding: 7px 14px; font-size: 13px; border: 0; border-radius: 6px; background: #007aff; color: #fff; cursor: pointer; font-weight: 600; }
  .p-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px 18px; }
  .p-row { display: grid; grid-template-columns: 16px 28px 66px 86px 1fr; gap: 4px; align-items: baseline; padding: 3px 0; border-bottom: 1px dashed #ddd; font-size: 12px; break-inside: avoid; }
  .p-hz { font-size: 15px; font-weight: 700; }
  .p-py { color: #0055b3; font-weight: 600; }
  .p-num { color: #666; font-size: 11px; }
  @media print { .no-print { display: none !important; } body { margin: 8mm; } }
</style></head>
<body>
  <div class="p-head">
    <h1>你好 Nihao · ${escapeHtml(title)} (${items.length} คำ)</h1>
    <button class="no-print" onclick="window.print()">🖨️ พิมพ์ / บันทึกเป็น PDF</button>
  </div>
  <div class="p-grid">${rowsHtml}</div>
  <script>setTimeout(() => window.print(), 350);<\/script>
</body></html>`);
    win.document.close();
  }

  function renderVocabBankResults() {
    const host = document.getElementById('vocab-bank-results');
    const summaryEl = document.getElementById('vb-results-summary');
    if (!host) return;

    const { items, totalMatched, isFiltered, setStart, setEnd } = getVocabVisibleItems();
    const learnedMap = state.progress.vocabLearned || {};
    const tk = todayKey();
    const learnedInView = items.filter(w => Boolean(learnedMap[w.id])).length;

    if (summaryEl) {
      if (isFiltered) {
        summaryEl.innerHTML = `พบ <b>${totalMatched.toLocaleString()}</b> คำ${totalMatched > 200 ? ' (แสดง 200 คำแรก)' : ''} · สะสมแล้วในหน้านี้ <b>${learnedInView}/${items.length}</b> คำ`;
      } else {
        summaryEl.innerHTML = `ชุดที่ <b>${state.vocabSet}</b> (คำที่ ${setStart.toLocaleString()}–${setEnd.toLocaleString()}) · สะสมแล้ว <b>${learnedInView}/${items.length}</b> คำ`;
      }
    }

    const bulkBtn = document.getElementById('vb-bulk-toggle');
    if (bulkBtn) {
      const allDone = items.length > 0 && learnedInView === items.length;
      bulkBtn.textContent = allDone ? '↺ ล้างเช็กชุดนี้' : `✓ เช็กสะสมครบชุดนี้ (${items.length} คำ)`;
      bulkBtn.dataset.mode = allDone ? 'clear' : 'mark';
    }

    if (!items.length) {
      host.innerHTML = `<div class="vb-empty">ไม่พบคำศัพท์ตามเงื่อนไขที่เลือก ลองล้างคำค้นหาหรือเปลี่ยนตัวกรอง</div>`;
      return;
    }

    const hidePyClass = state.vocabHidePinyin ? ' vb-masked' : '';
    const hideMeanClass = state.vocabHideMeaning ? ' vb-masked' : '';

    if (state.vocabViewMode === 'list') {
      host.innerHTML = `
        <div class="vb-list">
          ${items.map((w, i) => {
            const learnedDate = learnedMap[w.id];
            const isLearned = Boolean(learnedDate);
            const isToday = learnedDate === tk;
            const seq = isFiltered ? (i + 1) : (setStart + i);
            return `
              <div class="vb-item vb-row ${isLearned ? 'is-learned' : ''}" data-vid="${w.id}">
                <span class="vb-seq tabular-nums">#${seq}</span>
                <span class="vb-hsk-tag lv-${w.level}">HSK ${w.level === 7 ? '7+' : w.level}</span>
                <button type="button" class="vb-row-hanzi hanzi-font" data-speak="${escapeHtml(w.hanzi)}" title="กดฟังเสียง">${escapeHtml(w.hanzi)}</button>
                <span class="vb-row-pinyin${hidePyClass}" data-peek="1">${escapeHtml(w.pinyin)}</span>
                <span class="vb-row-meaning${hideMeanClass}" data-peek="1">${escapeHtml(w.meaning)}</span>
                <div class="vb-row-actions">
                  <button type="button" class="btn-speak-sm vb-star-btn ${(state.progress.vocabStarred || []).includes(w.id) ? 'starred' : ''}" data-star="${w.id}" title="ปักหมุดคำโปรด">★</button>
                  <button type="button" class="btn-speak-sm" data-speak="${escapeHtml(w.hanzi)}" aria-label="ฟังเสียง">🔊</button>
                  <button type="button" class="btn-speak-sm" data-detail="${w.id}" title="ดูรากศัพท์ ฝึกเขียน & ตัวอย่างประโยค">🧩</button>
                  <button type="button" class="vb-check-btn ${isLearned ? 'checked' : ''}" data-toggle="${w.id}">
                    ${isLearned ? (isToday ? '✓ วันนี้' : '✓ สะสมแล้ว') : '+ สะสม'}
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    } else {
      host.innerHTML = `
        <div class="vb-grid">
          ${items.map((w, i) => {
            const learnedDate = learnedMap[w.id];
            const isLearned = Boolean(learnedDate);
            const isToday = learnedDate === tk;
            const seq = isFiltered ? (i + 1) : (setStart + i);
            return `
              <div class="vb-item vb-card ${isLearned ? 'is-learned' : ''}" data-vid="${w.id}">
                <div class="vb-card-meta">
                  <span class="vb-seq tabular-nums">#${seq}</span>
                  <span class="vb-hsk-tag lv-${w.level}">HSK ${w.level === 7 ? '7+' : w.level}</span>
                </div>
                <div class="vb-card-head">
                  <button type="button" class="vb-hanzi hanzi-font" data-speak="${escapeHtml(w.hanzi)}" title="กดฟังเสียง">${escapeHtml(w.hanzi)}</button>
                  <div class="vb-card-btns">
                    <button type="button" class="btn-speak-sm vb-star-btn ${(state.progress.vocabStarred || []).includes(w.id) ? 'starred' : ''}" data-star="${w.id}" title="ปักหมุดคำโปรด">★</button>
                    <button type="button" class="btn-speak-sm" data-detail="${w.id}" title="ดูรากศัพท์ ฝึกเขียน & ตัวอย่างประโยค">🧩</button>
                    <button type="button" class="btn-speak-sm" data-speak="${escapeHtml(w.hanzi)}" aria-label="ฟังเสียง">🔊</button>
                  </div>
                </div>
                <div class="vb-pinyin${hidePyClass}" data-peek="1">${escapeHtml(w.pinyin)}</div>
                <div class="vb-meaning${hideMeanClass}" data-peek="1">${escapeHtml(w.meaning)}</div>
                ${(state.progress.vocabNotes || {})[w.id] ? `<div class="vb-user-note">📝 ${escapeHtml(state.progress.vocabNotes[w.id])}</div>` : ''}
                <button type="button" class="vb-check-btn ${isLearned ? 'checked' : ''}" data-toggle="${w.id}">
                  ${isLearned ? (isToday ? '✓ สะสมวันนี้แล้ว' : '✓ สะสมแล้ว') : '+ สะสมคำนี้'}
                </button>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    host.querySelectorAll('[data-speak]').forEach(btn => {
      btn.addEventListener('click', () => speak(btn.dataset.speak));
    });

    host.querySelectorAll('[data-detail]').forEach(btn => {
      btn.addEventListener('click', () => openVocabDetailModal(Number(btn.dataset.detail)));
    });

    host.querySelectorAll('[data-star]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.star);
        const list = state.progress.vocabStarred || (state.progress.vocabStarred = []);
        const idx = list.indexOf(id);
        if (idx === -1) {
          list.push(id);
          btn.classList.add('starred');
          playChime('ok');
        } else {
          list.splice(idx, 1);
          btn.classList.remove('starred');
        }
        saveProgress();
      });
    });

    host.querySelectorAll('[data-peek]').forEach(el => {
      el.addEventListener('click', () => {
        if (el.classList.contains('vb-masked')) {
          el.classList.toggle('vb-revealed');
        }
      });
    });

    host.querySelectorAll('[data-toggle]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.toggle);
        const map = state.progress.vocabLearned || (state.progress.vocabLearned = {});
        const tkNow = todayKey();
        const card = btn.closest('.vb-item');
        if (map[id]) {
          delete map[id];
          if (state.progress.vocabSrs) delete state.progress.vocabSrs[id];
          if (card) card.classList.remove('is-learned');
          btn.classList.remove('checked');
          btn.textContent = state.vocabViewMode === 'list' ? '+ สะสม' : '+ สะสมคำนี้';
          saveProgress();
        } else {
          map[id] = tkNow;
          syncVocabSrsOnLearn(id, tkNow);
          if (card) card.classList.add('is-learned');
          btn.classList.add('checked');
          btn.textContent = state.vocabViewMode === 'list' ? '✓ วันนี้' : '✓ สะสมวันนี้แล้ว';
          playChime('ok');
          const milestoneMsg = checkVocabMilestones(getVocabTodayCount());
          saveProgress(milestoneMsg);
        }
        updateVocabHeroCounters();
        updateVocabSrsBadge();
        const learnedNow = items.filter(w => Boolean(map[w.id])).length;
        if (summaryEl) {
          if (isFiltered) {
            summaryEl.innerHTML = `พบ <b>${totalMatched.toLocaleString()}</b> คำ${totalMatched > 200 ? ' (แสดง 200 คำแรก)' : ''} · สะสมแล้วในหน้านี้ <b>${learnedNow}/${items.length}</b> คำ`;
          } else {
            summaryEl.innerHTML = `ชุดที่ <b>${state.vocabSet}</b> (คำที่ ${setStart.toLocaleString()}–${setEnd.toLocaleString()}) · สะสมแล้ว <b>${learnedNow}/${items.length}</b> คำ`;
          }
        }
      });
    });
  }

  function renderVocabBank() {
    const container = document.getElementById('vocab-bank-view');
    if (!container) return;
    if (!LEXICON.length) {
      container.innerHTML = `<div class="vb-empty">กำลังโหลดคลังคำศัพท์ หรือไม่พบไฟล์ data/lexicon.js</div>`;
      return;
    }

    const all = getVocabIndex();
    const learnedMap = state.progress.vocabLearned || {};
    const goal = state.progress.vocabGoal || 100;
    const todayCount = getVocabTodayCount();
    const totalLearned = getVocabTotalLearned();
    const doneDays = getVocabCompletedDays();
    const pct = Math.min(100, Math.round((todayCount / goal) * 100));

    const levelDefs = [
      { key: 'all', label: 'ทั้งหมด' },
      { key: '1', label: 'HSK 1' },
      { key: '2', label: 'HSK 2' },
      { key: '3', label: 'HSK 3' },
      { key: '4', label: 'HSK 4' },
      { key: '5', label: 'HSK 5' },
      { key: '6', label: 'HSK 6' },
      { key: '7', label: 'HSK 7–9' }
    ];

    const levelCounts = { all: all.length };
    all.forEach(w => { levelCounts[w.level] = (levelCounts[w.level] || 0) + 1; });

    const pool = getVocabLevelPool(state.vocabLevel);
    const totalSets = Math.max(1, Math.ceil(pool.length / goal));
    if (state.vocabSet > totalSets) state.vocabSet = totalSets;
    if (state.vocabSet < 1) state.vocabSet = 1;

    const setOptions = [];
    for (let s = 1; s <= totalSets; s++) {
      const start = (s - 1) * goal;
      const slice = pool.slice(start, start + goal);
      let done = 0;
      for (let i = 0; i < slice.length; i++) {
        if (learnedMap[slice[i].id]) done++;
      }
      const mark = done === slice.length ? ' ✓' : (done > 0 ? ` (${done}/${slice.length})` : '');
      setOptions.push(`<option value="${s}" ${state.vocabSet === s ? 'selected' : ''}>ชุดที่ ${s} · คำที่ ${start + 1}–${start + slice.length}${mark}</option>`);
    }

    container.innerHTML = `
      <div class="vb-hero">
        <div class="vb-hero-top">
          <div>
            <div class="vb-hero-kicker">เป้าหมายสะสมคำศัพท์วันนี้</div>
            <div class="vb-hero-main">
              <strong class="tabular-nums" id="vb-today-count">${todayCount} / ${goal} คำ</strong>
              <span class="vb-pct-pill tabular-nums" id="vb-today-pct">${pct}%</span>
            </div>
          </div>
          <div class="vb-hero-stats">
            <div class="vb-mini-stat">
              <span>สะสมทั้งหมด</span>
              <strong class="tabular-nums" id="vb-total-learned">${totalLearned.toLocaleString()} / ${all.length.toLocaleString()} คำ</strong>
            </div>
            <div class="vb-mini-stat">
              <span>พิชิตเป้ารายวัน</span>
              <strong class="tabular-nums" id="vb-done-days">${doneDays} วัน</strong>
            </div>
            <div class="vb-mini-stat">
              <span>เป้าหมาย/วัน</span>
              <select id="vb-goal-select" class="vb-select-sm" aria-label="เป้าหมายคำศัพท์ต่อวัน">
                ${[10, 50, 100, 150, 200].map(g => `<option value="${g}" ${goal === g ? 'selected' : ''}>${g === 10 ? '10 คำ (โหมดวันยุ่ง)' : `${g} คำ/วัน`}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>
        <div class="progress-track vb-progress-track">
          <div class="progress-fill" id="vb-today-bar" style="width:${pct}%"></div>
        </div>
        <div class="vb-sprint-bar">
          <div class="vb-chunks">
            ${[0, 1, 2, 3].map(c => {
              const cs = Math.max(1, Math.ceil(goal / 4));
              const filled = Math.max(0, Math.min(cs, todayCount - c * cs));
              const cls = filled >= cs ? 'done' : (filled > 0 ? 'active' : '');
              return `<div class="vb-chunk ${cls}" id="vb-chunk-${c}"><span>รอบ ${c + 1}</span><b class="tabular-nums">${filled}/${cs}</b></div>`;
            }).join('')}
          </div>
          <div class="vb-sprint-timer">
            <span class="tabular-nums" id="vb-sprint-clock">⏱ ${formatTimer(state.vocabSprint.seconds)}</span>
            <button type="button" class="vb-chip ${state.vocabSprint.running ? 'active' : ''}" id="vb-sprint-toggle">${state.vocabSprint.running ? '⏸ พักโฟกัส' : '▶ โฟกัส 15 นาที'}</button>
            <button type="button" class="vb-chip" id="vb-sprint-reset" title="รีเซ็ตเวลา">↺</button>
          </div>
        </div>
        <div class="vb-hero-foot">
          <span>${todayCount >= goal ? '🎉 <b>ครบเป้าวันนี้แล้ว!</b> กดทำควิซเพื่อทวนความจำได้เลย' : 'แตะ <b>+ สะสมคำนี้</b> เพื่อเก็บยอดรายวัน · ครบ 25% / 50% / 75% / 100% รับโบนัส XP ทันที'}</span>
          <div class="vb-hero-actions">
            <button type="button" class="${todayCount >= goal ? 'btn-primary' : 'btn-secondary'} vb-jump-btn" id="vb-open-quiz-today">🎯 ควิซทวนคำวันนี้ (${todayCount})</button>
            <button type="button" class="btn-secondary vb-jump-btn" id="vb-chat-ai-today">💬 ฝึกใช้คำวันนี้กับครู AI</button>
            <button type="button" class="btn-secondary vb-jump-btn" id="vb-ics-reminder" title="เพิ่มแจ้งเตือนเรียนประจำวันลงปฏิทิน iPad/iPhone">🔔 แจ้งเตือน iPad</button>
            <button type="button" class="btn-secondary vb-jump-btn" id="vb-jump-next">ไปชุดถัดไป →</button>
          </div>
        </div>
      </div>

      <div class="vb-routine-strip">
        <div class="vb-routine-head">
          <span>📅 <b>กิจวัตร 4 ช่วงเวลาวันนี้</b> (ทำครบวันละนิดไม่เหนื่อย!)</span>
          <span class="vb-routine-sub">วันยุ่งมากเปลี่ยนเป้าเป็น 10 คำ เพื่อรักษาสถิติสีเขียวได้</span>
        </div>
        <div class="vb-routine-grid">
          <button type="button" class="vb-rt-card ${getDueVocabSrsWords().length === 0 && totalLearned > 0 ? 'done' : ''}" id="vb-rt-morning">
            <span class="vb-rt-ico">🌅</span>
            <span><b>เช้า · 5 นาที</b><small>ทวน SRS & ฟัง Podcast</small></span>
          </button>
          <button type="button" class="vb-rt-card ${todayCount >= Math.ceil(goal * 0.5) ? 'done' : ''}" id="vb-rt-noon">
            <span class="vb-rt-ico">☀️</span>
            <span><b>เที่ยง · ครึ่งทาง</b><small>สะสม ${Math.min(todayCount, Math.ceil(goal * 0.5))}/${Math.ceil(goal * 0.5)} คำ</small></span>
          </button>
          <button type="button" class="vb-rt-card ${todayCount >= goal ? 'done' : ''}" id="vb-rt-evening">
            <span class="vb-rt-ico">🌆</span>
            <span><b>เย็น · ปิดเป้า + เกม</b><small>ครบ ${goal} คำ & เล่นเกมศัพท์</small></span>
          </button>
          <button type="button" class="vb-rt-card" id="vb-rt-night">
            <span class="vb-rt-ico">🌙</span>
            <span><b>ก่อนนอน · ทวนสั้นๆ</b><small>ควิซ 20 ข้อ & อ่านนิทาน AI</small></span>
          </button>
        </div>
      </div>

      <div class="vb-levels" id="vb-levels">
        ${levelDefs.map(lv => `
          <button type="button" class="vb-lv-pill ${state.vocabLevel === lv.key ? 'active' : ''}" data-vlv="${lv.key}">
            <span>${lv.label}</span>
            <small class="tabular-nums">${(levelCounts[lv.key] || 0).toLocaleString()}</small>
          </button>
        `).join('')}
      </div>

      <div class="vb-toolbar">
        <div class="vb-set-nav">
          <button type="button" class="btn-secondary vb-nav-btn" id="vb-prev-set" ${state.vocabSet <= 1 ? 'disabled' : ''}>◀ ชุดก่อน</button>
          <select id="vb-set-select" class="vb-select" aria-label="เลือกชุดคำศัพท์">
            ${setOptions.join('')}
          </select>
          <button type="button" class="btn-secondary vb-nav-btn" id="vb-next-set" ${state.vocabSet >= totalSets ? 'disabled' : ''}>ชุดถัดไป ▶</button>
        </div>

        <div class="vb-search-wrap">
          <input type="search" id="vb-search-input" class="vb-search" value="${escapeHtml(state.vocabQuery)}" placeholder="ค้นหาคำจีน, พินอิน (เช่น ai) หรือคำแปลไทย...">
        </div>

        <select id="vb-topic-select" class="vb-select" aria-label="กรองตามหมวดชีวิตจริง">
          ${VOCAB_TOPICS.map(t => `<option value="${t.key}" ${state.vocabTopic === t.key ? 'selected' : ''}>${t.label}</option>`).join('')}
        </select>
      </div>

      <div class="vb-subbar">
        <div class="vb-filter-group">
          ${[
            { k: 'all', label: 'ทั้งหมด' },
            { k: 'unlearned', label: 'ยังไม่สะสม' },
            { k: 'learned', label: 'สะสมแล้ว' },
            { k: 'today', label: 'สะสมวันนี้' },
            { k: 'starred', label: `⭐ ปักหมุด (${(state.progress.vocabStarred || []).length})` }
          ].map(f => `
            <button type="button" class="vb-chip ${state.vocabStatusFilter === f.k ? 'active' : ''}" data-vfilter="${f.k}">${f.label}</button>
          `).join('')}
        </div>

        <div class="vb-tool-group">
          <button type="button" class="vb-chip ${state.vocabHidePinyin ? 'active' : ''}" id="vb-toggle-py">ซ่อนพินอิน</button>
          <button type="button" class="vb-chip ${state.vocabHideMeaning ? 'active' : ''}" id="vb-toggle-mean">ซ่อนคำแปล</button>
          <button type="button" class="vb-chip" id="vb-toggle-view">${state.vocabViewMode === 'grid' ? '☰ แบบรายการ' : '▦ แบบการ์ด'}</button>
          <button type="button" class="vb-chip ${state.vocabAutoPlay ? 'active' : ''}" id="vb-autoplay-btn">${state.vocabAutoPlay ? '⏹ หยุดฟัง' : '🔊 ฟังต่อเนื่อง'}</button>
          <button type="button" class="vb-chip" id="vb-quiz-this-set">🎯 ควิซทวนชุดนี้</button>
          <button type="button" class="vb-chip" id="vb-print-sheet">🖨️ พิมพ์ชีท / PDF</button>
          <button type="button" class="btn-primary vb-bulk-btn" id="vb-bulk-toggle">✓ เช็กสะสมครบชุดนี้</button>
        </div>
      </div>

      <div class="vb-results-summary" id="vb-results-summary"></div>
      <div id="vocab-bank-results"></div>
    `;

    // Bind events
    document.getElementById('vb-goal-select')?.addEventListener('change', (e) => {
      stopVocabAutoPlay();
      state.progress.vocabGoal = Number(e.target.value) || 100;
      state.vocabSet = 1;
      saveProgress();
      renderVocabBank();
    });

    document.getElementById('vb-open-quiz-today')?.addEventListener('click', () => {
      stopVocabAutoPlay();
      const tc = getVocabTodayCount();
      state.vocabQuiz.source = tc >= 4 ? 'today' : 'set';
      state.vocabQuiz.active = false;
      state.vocabQuiz.finished = false;
      state.vocabMode = 'quiz';
      renderVocab();
    });

    document.getElementById('vb-chat-ai-today')?.addEventListener('click', () => {
      stopVocabAutoPlay();
      const pool = getVocabQuizPool('today');
      const sample = (pool.length ? pool : getVocabQuizPool('set')).slice(0, 3);
      const wordStr = sample.map(w => w.hanzi).join('、');
      switchTab('tutor');
      setTimeout(() => {
        const inp = document.getElementById('tutor-input');
        if (inp) {
          inp.value = `ช่วยชวนฉันคุยภาษาจีนง่ายๆ โดยใช้คำว่า ${wordStr} หน่อยครับ`;
          inp.focus();
        }
      }, 120);
    });

    document.getElementById('vb-ics-reminder')?.addEventListener('click', () => {
      const url = 'https://nihao-chinese-learning.netlify.app';
      const nowStamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      const baseDate = todayKey().replace(/-/g, '');
      const mkEvent = (uid, hour, min, title, desc) => [
        'BEGIN:VEVENT',
        `UID:${uid}@nihao-learning`,
        `DTSTAMP:${nowStamp}`,
        `DTSTART:${baseDate}T${hour}${min}00`,
        `DTEND:${baseDate}T${hour}${String(Number(min) + 15).padStart(2, '0')}00`,
        'RRULE:FREQ=DAILY',
        `SUMMARY:${title}`,
        `DESCRIPTION:${desc} ${url}`,
        `URL:${url}`,
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        `DESCRIPTION:${title}`,
        'TRIGGER:-PT0M',
        'END:VALARM',
        'END:VEVENT'
      ].join('\r\n');
      const ics = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Nihao Chinese Learning//Daily Routine//TH',
        'CALSCALE:GREGORIAN',
        mkEvent('nihao-morning', '08', '00', '🌅 Nihao: ทวน SRS & ฟัง Podcast 5 นาที', 'เปิดทวนคำศัพท์เก่าและฟัง Podcast:'),
        mkEvent('nihao-noon', '12', '30', '☀️ Nihao: สะสมศัพท์ 50 คำแรก (15 นาที)', 'เปิดสะสมคำศัพท์รอบเที่ยง:'),
        mkEvent('nihao-evening', '19', '00', '🌆 Nihao: ปิดเป้า 100 คำ + เล่นเกมศัพท์', 'เก็บให้ครบเป้าวันนี้แล้วเล่น Speed Match:'),
        mkEvent('nihao-night', '21', '30', '🌙 Nihao: ควิซทวน 20 ข้อ & อ่านนิทาน AI', 'ทวนความจำก่อนนอน 5 นาที:'),
        'END:VCALENDAR'
      ].join('\r\n');
      const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
      const dlUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = dlUrl;
      a.download = 'nihao-daily-reminders.ics';
      a.click();
      setTimeout(() => URL.revokeObjectURL(dlUrl), 2000);
      showToast('ดาวน์โหลดไฟล์แจ้งเตือนปฏิทิน (.ics) แล้ว — แตะเปิดบน iPad เพื่อเพิ่มลงปฏิทินได้เลย!', '', false);
    });

    document.getElementById('vb-rt-morning')?.addEventListener('click', () => {
      state.vocabMode = getDueVocabSrsWords().length > 0 ? 'srs' : 'podcast';
      renderVocab();
    });
    document.getElementById('vb-rt-noon')?.addEventListener('click', () => {
      document.getElementById('vb-sprint-toggle')?.click();
    });
    document.getElementById('vb-rt-evening')?.addEventListener('click', () => {
      state.vocabMode = 'games';
      renderVocab();
    });
    document.getElementById('vb-rt-night')?.addEventListener('click', () => {
      state.vocabMode = 'quiz';
      renderVocab();
    });

    document.getElementById('vb-quiz-this-set')?.addEventListener('click', () => {
      stopVocabAutoPlay();
      state.vocabQuiz.source = 'set';
      state.vocabQuiz.active = false;
      state.vocabQuiz.finished = false;
      state.vocabMode = 'quiz';
      renderVocab();
    });

    document.getElementById('vb-jump-next')?.addEventListener('click', () => {
      stopVocabAutoPlay();
      state.vocabQuery = '';
      state.vocabStatusFilter = 'all';
      for (let s = 1; s <= totalSets; s++) {
        const start = (s - 1) * goal;
        const slice = pool.slice(start, start + goal);
        if (slice.some(w => !learnedMap[w.id])) {
          state.vocabSet = s;
          renderVocabBank();
          showToast(`ข้ามไปยังชุดที่ ${s} (คำที่ ${start + 1}–${start + slice.length})`, '', false);
          return;
        }
      }
      showToast('คุณสะสมครบทุกชุดในระดับนี้แล้ว!', 'ยอดเยี่ยม', false);
    });

    container.querySelectorAll('[data-vlv]').forEach(btn => {
      btn.addEventListener('click', () => {
        stopVocabAutoPlay();
        state.vocabLevel = btn.dataset.vlv;
        state.vocabSet = 1;
        renderVocabBank();
      });
    });

    document.getElementById('vb-prev-set')?.addEventListener('click', () => {
      if (state.vocabSet > 1) {
        stopVocabAutoPlay();
        state.vocabSet--;
        renderVocabBank();
      }
    });

    document.getElementById('vb-next-set')?.addEventListener('click', () => {
      if (state.vocabSet < totalSets) {
        stopVocabAutoPlay();
        state.vocabSet++;
        renderVocabBank();
      }
    });

    document.getElementById('vb-set-select')?.addEventListener('change', (e) => {
      stopVocabAutoPlay();
      state.vocabSet = Number(e.target.value) || 1;
      state.vocabQuery = '';
      state.vocabStatusFilter = 'all';
      renderVocabBank();
    });

    document.getElementById('vb-search-input')?.addEventListener('input', (e) => {
      stopVocabAutoPlay();
      state.vocabQuery = e.target.value;
      renderVocabBankResults();
    });

    document.getElementById('vb-topic-select')?.addEventListener('change', (e) => {
      stopVocabAutoPlay();
      state.vocabTopic = e.target.value;
      state.vocabSet = 1;
      renderVocabBank();
    });

    document.getElementById('vb-print-sheet')?.addEventListener('click', () => {
      const { items } = getVocabVisibleItems();
      const topicObj = VOCAB_TOPICS.find(t => t.key === state.vocabTopic);
      const title = state.vocabTopic !== 'all'
        ? `หมวด ${topicObj?.label || ''} ชุดที่ ${state.vocabSet}`
        : `คลังศัพท์ชุดที่ ${state.vocabSet}`;
      printVocabCheatSheet(items, title);
    });

    document.getElementById('vb-sprint-toggle')?.addEventListener('click', () => {
      const sp = state.vocabSprint;
      if (sp.running) {
        clearInterval(sp.timerId);
        sp.timerId = null;
        sp.running = false;
      } else {
        if (sp.seconds <= 0) sp.seconds = 15 * 60;
        sp.running = true;
        sp.timerId = setInterval(() => {
          if (sp.seconds > 0) {
            sp.seconds--;
            const ck = document.getElementById('vb-sprint-clock');
            if (ck) ck.textContent = `⏱ ${formatTimer(sp.seconds)}`;
          } else {
            clearInterval(sp.timerId);
            sp.timerId = null;
            sp.running = false;
            playChime('levelup');
            showToast('ครบรอบโฟกัส 15 นาทีแล้ว! พักสายตา 2 นาทีแล้วลุยรอบถัดไปได้เลย', '+15 XP', false);
            state.progress.bonusXp = (state.progress.bonusXp || 0) + 15;
            saveProgress();
            renderVocabBank();
          }
        }, 1000);
      }
      renderVocabBank();
    });

    document.getElementById('vb-sprint-reset')?.addEventListener('click', () => {
      const sp = state.vocabSprint;
      if (sp.timerId) { clearInterval(sp.timerId); sp.timerId = null; }
      sp.running = false;
      sp.seconds = 15 * 60;
      renderVocabBank();
    });

    container.querySelectorAll('[data-vfilter]').forEach(btn => {
      btn.addEventListener('click', () => {
        stopVocabAutoPlay();
        state.vocabStatusFilter = btn.dataset.vfilter;
        container.querySelectorAll('[data-vfilter]').forEach(b => b.classList.toggle('active', b === btn));
        renderVocabBankResults();
      });
    });

    document.getElementById('vb-toggle-py')?.addEventListener('click', (e) => {
      state.vocabHidePinyin = !state.vocabHidePinyin;
      e.currentTarget.classList.toggle('active', state.vocabHidePinyin);
      renderVocabBankResults();
    });

    document.getElementById('vb-toggle-mean')?.addEventListener('click', (e) => {
      state.vocabHideMeaning = !state.vocabHideMeaning;
      e.currentTarget.classList.toggle('active', state.vocabHideMeaning);
      renderVocabBankResults();
    });

    document.getElementById('vb-toggle-view')?.addEventListener('click', (e) => {
      state.vocabViewMode = state.vocabViewMode === 'grid' ? 'list' : 'grid';
      e.currentTarget.textContent = state.vocabViewMode === 'grid' ? '☰ แบบรายการ' : '▦ แบบการ์ด';
      renderVocabBankResults();
    });

    document.getElementById('vb-autoplay-btn')?.addEventListener('click', () => {
      if (state.vocabAutoPlay) {
        stopVocabAutoPlay();
      } else {
        const { items } = getVocabVisibleItems();
        startVocabAutoPlay(items);
      }
    });

    document.getElementById('vb-bulk-toggle')?.addEventListener('click', (e) => {
      const mode = e.currentTarget.dataset.mode;
      const { items } = getVocabVisibleItems();
      const map = state.progress.vocabLearned || (state.progress.vocabLearned = {});
      const tkNow = todayKey();
      if (mode === 'clear') {
        items.forEach(w => {
          delete map[w.id];
          if (state.progress.vocabSrs) delete state.progress.vocabSrs[w.id];
        });
        saveProgress('ล้างเช็กชุดนี้แล้ว');
      } else {
        items.forEach(w => {
          if (!map[w.id]) {
            map[w.id] = tkNow;
            syncVocabSrsOnLearn(w.id, tkNow);
          }
        });
        playChime('ok');
        const milestoneMsg = checkVocabMilestones(getVocabTodayCount());
        saveProgress(milestoneMsg || `สะสมครบ ${items.length} คำในชุดนี้แล้ว!`);
      }
      updateVocabSrsBadge();
      renderVocabBank();
    });

    renderVocabBankResults();
  }

  function renderVocabLevel1Packs() {
    const listEl = document.getElementById('vocab-pack-list');
    if (!listEl) return;
    listEl.innerHTML = DATA.vocabPacks.map((pack, idx) => `
      <button type="button" class="pack-btn ${state.selectedVocabPack === idx ? 'active' : ''}" data-pack="${idx}">
        <span class="pack-icon hanzi-font">${pack.icon}</span>
        <span>
          <b>${escapeHtml(pack.title)}</b>
          <span>${escapeHtml(pack.desc)} (${pack.words.length} คำ)</span>
        </span>
      </button>
    `).join('');

    listEl.querySelectorAll('[data-pack]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.selectedVocabPack = Number(btn.dataset.pack);
        renderVocabLevel1Packs();
      });
    });

    const pack = DATA.vocabPacks[state.selectedVocabPack];
    document.getElementById('vocab-pack-header').innerHTML = `
      <h3 style="margin:0 0 4px;color:var(--jade)">${escapeHtml(pack.title)}</h3>
      <p style="margin:0;color:var(--muted);font-size:14px">${escapeHtml(pack.desc)}</p>
    `;

    const gridEl = document.getElementById('vocab-grid');
    gridEl.innerHTML = pack.words.map(w => `
      <div class="vocab-card">
        <div class="vocab-top">
          <span class="vocab-hanzi hanzi-font">${w.hanzi}</span>
          <button type="button" class="btn-speak-sm" data-speak="${w.hanzi.split(' / ')[0]}">🔊 ฟัง</button>
        </div>
        <div class="vocab-pinyin">${w.pinyin}</div>
        <div class="vocab-meaning">${escapeHtml(w.meaning)}</div>
        <div class="vocab-breakdown">โครงสร้าง: ${escapeHtml(w.breakdown)}</div>
        <div class="vocab-note">💡 ${escapeHtml(w.note)}</div>
      </div>
    `).join('');

    gridEl.querySelectorAll('[data-speak]').forEach(btn => {
      btn.addEventListener('click', () => speak(btn.dataset.speak));
    });
  }

  function shuffleArray(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function getVocabQuizPool(source) {
    const all = getVocabIndex();
    const learnedMap = state.progress.vocabLearned || {};
    const tk = todayKey();
    if (source === 'today') {
      return all.filter(w => learnedMap[w.id] === tk);
    }
    if (source === 'all_learned') {
      return all.filter(w => Boolean(learnedMap[w.id]));
    }
    if (source === 'mistakes') {
      const mSet = new Set(state.progress.vocabMistakes || []);
      return all.filter(w => mSet.has(w.id));
    }
    if (source === 'srs_due') {
      return getDueVocabSrsWords();
    }
    if (source === 'starred') {
      const sSet = new Set(state.progress.vocabStarred || []);
      return all.filter(w => sSet.has(w.id));
    }
    // 'set': current set in current level
    const pool = getVocabLevelPool(state.vocabLevel);
    const goal = state.progress.vocabGoal || 100;
    const startIdx = (Math.max(1, state.vocabSet) - 1) * goal;
    return pool.slice(startIdx, startIdx + goal);
  }

  function startVocabQuiz(customItems = null) {
    const qz = state.vocabQuiz;
    const pool = Array.isArray(customItems) && customItems.length ? customItems : getVocabQuizPool(qz.source);
    if (pool.length < ((qz.qType === 'speak' || qz.qType === 'typing') ? 1 : 4) && !customItems) {
      showToast('ต้องมีคำศัพท์อย่างน้อย 4 คำเพื่อสร้างตัวเลือก 4 ข้อ', '', false);
      return;
    }

    const allLex = getVocabIndex();
    const distractorBank = pool.length >= 12 ? pool : allLex.slice(0, 600);
    const selected = shuffleArray(pool).slice(0, customItems ? pool.length : Math.min(qz.count, pool.length));
    const modes = ['zh2th', 'th2zh', 'audio2th'];

    qz.questions = selected.map(word => {
      const mode = qz.qType === 'mixed' ? modes[Math.floor(Math.random() * modes.length)] : qz.qType;
      const distractors = [];
      const usedHanzi = new Set([word.hanzi]);
      const usedMeaning = new Set([word.meaning]);
      let guard = 0;
      while (distractors.length < 3 && guard < 200) {
        guard++;
        const cand = distractorBank[Math.floor(Math.random() * distractorBank.length)];
        if (!cand || usedHanzi.has(cand.hanzi) || usedMeaning.has(cand.meaning)) continue;
        usedHanzi.add(cand.hanzi);
        usedMeaning.add(cand.meaning);
        distractors.push(cand);
      }
      const choices = shuffleArray([word, ...distractors]);
      return {
        word,
        mode,
        choices,
        correctIdx: choices.findIndex(c => c.id === word.id)
      };
    });

    qz.active = true;
    qz.finished = false;
    qz.idx = 0;
    qz.score = 0;
    qz.streak = 0;
    qz.bestStreak = 0;
    qz.answered = false;
    qz.pickedIdx = -1;
    qz.wrongItems = [];
    qz.listening = false;
    qz.spokenText = '';
    qz.speakHint = false;
    renderVocabQuiz();
  }

  function renderVocabQuiz() {
    const container = document.getElementById('vocab-quiz-view');
    if (!container) return;
    const qz = state.vocabQuiz;

    const todayPool = getVocabQuizPool('today');
    const setPool = getVocabQuizPool('set');
    const allLearnedPool = getVocabQuizPool('all_learned');
    const mistakePool = getVocabQuizPool('mistakes');
    const srsDuePool = getVocabQuizPool('srs_due');
    const starredPool = getVocabQuizPool('starred');

    // ---- 1. Quiz Setup Screen ----
    if (!qz.active && !qz.finished) {
      const curPool = getVocabQuizPool(qz.source);
      const minRequired = (qz.qType === 'speak' || qz.qType === 'typing') ? 1 : 4;
      const canStart = curPool.length >= minRequired;
      const sourceDefs = [
        { key: 'today', title: 'คำที่สะสมวันนี้', sub: `${todayPool.length} คำ`, icon: '📅' },
        { key: 'srs_due', title: 'ครบกำหนดทวน SRS', sub: `${srsDuePool.length} คำ`, icon: '🔄' },
        { key: 'starred', title: '⭐ คำที่ปักหมุด', sub: `${starredPool.length} คำ`, icon: '⭐' },
        { key: 'set', title: `ชุดปัจจุบัน (ชุดที่ ${state.vocabSet})`, sub: `${setPool.length} คำ`, icon: '📦' },
        { key: 'all_learned', title: 'คำที่สะสมทั้งหมด', sub: `${allLearnedPool.length.toLocaleString()} คำ`, icon: '🏆' },
        { key: 'mistakes', title: 'คำที่เคยตอบผิด', sub: `${mistakePool.length} คำ`, icon: '🔁' }
      ];
      const modeDefs = [
        { key: 'zh2th', label: 'จีน → ไทย', desc: 'ดูตัวจีน/พินอิน เลือกคำแปลไทย' },
        { key: 'th2zh', label: 'ไทย → จีน', desc: 'ดูคำแปลไทย เลือกคำจีนที่ตรงกัน' },
        { key: 'audio2th', label: 'ฟังเสียง → ไทย', desc: 'ฟังเสียงจีนอย่างเดียวแล้วทายความหมาย' },
        { key: 'speak', label: '🗣️ ฝึกพูด (ใส่ไมค์)', desc: 'ดูคำแปลไทยแล้วพูดภาษาจีนใส่ไมค์' },
        { key: 'typing', label: '⌨️ พิมพ์พินอิน', desc: 'ดูตัวจีน/คำแปลแล้วพิมพ์พินอินให้ถูก' },
        { key: 'mixed', label: 'ผสมทุกแบบ', desc: 'สุ่มสลับทั้งอ่าน แปล และฟัง' }
      ];

      container.innerHTML = `
        <div class="vq-setup-card">
          <div class="vq-setup-head">
            <div>
              <h2 class="vq-title">🎯 ควิซทวนความจำคำศัพท์</h2>
              <p class="vq-desc">ทดสอบว่าคำศัพท์ที่สะสมไว้จำได้แม่นแค่ไหน พร้อมบันทึกคำที่ตอบผิดไว้ทวนซ้ำอัตโนมัติ</p>
            </div>
            <div class="vq-stat-chip tabular-nums">ทำควิซไปแล้ว ${state.progress.vocabQuizCount || 0} ครั้ง</div>
          </div>

          <div class="vq-section-label">1. เลือกแหล่งคำศัพท์</div>
          <div class="vq-source-grid">
            ${sourceDefs.map(s => `
              <button type="button" class="vq-source-btn ${qz.source === s.key ? 'active' : ''}" data-qsrc="${s.key}">
                <span class="vq-src-icon">${s.icon}</span>
                <span>
                  <b>${escapeHtml(s.title)}</b>
                  <small class="tabular-nums">${s.sub}</small>
                </span>
              </button>
            `).join('')}
          </div>

          <div class="vq-section-label">2. รูปแบบคำถาม</div>
          <div class="vq-mode-grid">
            ${modeDefs.map(m => `
              <button type="button" class="vq-mode-btn ${qz.qType === m.key ? 'active' : ''}" data-qtype="${m.key}">
                <b>${m.label}</b>
                <small>${m.desc}</small>
              </button>
            `).join('')}
          </div>

          <div class="vq-row-opts">
            <div>
              <div class="vq-section-label" style="margin-top:0">3. จำนวนข้อสอบ</div>
              <div class="vq-count-pills">
                ${[10, 20, 50, 100].map(c => `
                  <button type="button" class="vb-chip ${qz.count === c ? 'active' : ''}" data-qcnt="${c}">${c} ข้อ${c === 100 ? ' (ครบชุด!)' : ''}</button>
                `).join('')}
              </div>
            </div>
            <label class="vq-toggle-label">
              <input type="checkbox" id="vq-show-py-chk" ${qz.showPinyin ? 'checked' : ''}>
              <span>แสดงพินอินช่วยในโหมด จีน → ไทย</span>
            </label>
          </div>

          ${!canStart ? `
            <div class="vq-warn">
              แหล่งที่เลือกมีคำศัพท์ <b>${curPool.length} คำ</b> (ต้องมีอย่างน้อย 4 คำขึ้นไป) — แนะนำให้สะสมคำเพิ่ม หรือกดเลือก <b>ชุดปัจจุบัน (ชุดที่ ${state.vocabSet})</b> เพื่อเริ่มทดสอบทันที
            </div>
          ` : ''}

          <div class="vq-start-bar">
            <button type="button" class="btn-primary vq-start-btn" id="vq-start-btn" ${!canStart ? 'disabled' : ''}>
              เริ่มทำควิซ (${Math.min(qz.count, curPool.length)} ข้อ) →
            </button>
          </div>
        </div>
      `;

      container.querySelectorAll('[data-qsrc]').forEach(btn => {
        btn.addEventListener('click', () => {
          qz.source = btn.dataset.qsrc;
          renderVocabQuiz();
        });
      });
      container.querySelectorAll('[data-qtype]').forEach(btn => {
        btn.addEventListener('click', () => {
          qz.qType = btn.dataset.qtype;
          renderVocabQuiz();
        });
      });
      container.querySelectorAll('[data-qcnt]').forEach(btn => {
        btn.addEventListener('click', () => {
          qz.count = Number(btn.dataset.qcnt);
          renderVocabQuiz();
        });
      });
      document.getElementById('vq-show-py-chk')?.addEventListener('change', (e) => {
        qz.showPinyin = e.target.checked;
      });
      document.getElementById('vq-start-btn')?.addEventListener('click', () => startVocabQuiz());
      return;
    }

    // ---- 2. Quiz Summary Screen ----
    if (qz.finished) {
      const total = qz.questions.length || 1;
      const pct = Math.round((qz.score / total) * 100);
      const grade =
        pct >= 90 ? { label: 'จำแม่นระดับเทพ!', badge: 'grade-s' } :
        pct >= 80 ? { label: 'ยอดเยี่ยมมาก!', badge: 'grade-a' } :
        pct >= 60 ? { label: 'ดีเลย! ทวนอีกนิดจะเป๊ะ', badge: 'grade-b' } :
        { label: 'มาทวนคำที่ผิดกันอีกรอบนะ!', badge: 'grade-c' };

      container.innerHTML = `
        <div class="vq-result-card">
          <div class="vq-grade-pill ${grade.badge}">${grade.label}</div>
          <div class="vq-score-big tabular-nums">${qz.score} / ${total}</div>
          <div class="vq-score-sub tabular-nums">ความแม่นยำ <b>${pct}%</b> · ตอบถูกต่อเนื่องสูงสุด <b>${qz.bestStreak} ข้อ</b></div>

          <div class="vq-result-actions">
            ${qz.wrongItems.length > 0 ? `<button type="button" class="btn-primary" id="vq-retry-wrong">🔁 ทวนเฉพาะคำที่ตอบผิด (${qz.wrongItems.length} คำ)</button>` : ''}
            <button type="button" class="btn-secondary" id="vq-retry-new">🎯 สุ่มทำควิซใหม่อีกครั้ง</button>
            <button type="button" class="btn-secondary" id="vq-back-setup">⚙ ตั้งค่าควิซใหม่</button>
            <button type="button" class="btn-secondary" id="vq-back-bank">← กลับคลังคำศัพท์</button>
          </div>

          ${qz.wrongItems.length > 0 ? `
            <div class="vq-wrong-section">
              <h3>คำที่ตอบผิดในรอบนี้ (${qz.wrongItems.length} คำ) — กดฟังเสียงทวนได้เลย</h3>
              <div class="vq-wrong-list">
                ${qz.wrongItems.map(w => `
                  <div class="vq-wrong-row">
                    <span class="vq-wrong-hz hanzi-font">${escapeHtml(w.hanzi)}</span>
                    <span class="vq-wrong-py">${escapeHtml(w.pinyin)}</span>
                    <span class="vq-wrong-th">${escapeHtml(w.meaning)}</span>
                    <button type="button" class="btn-speak-sm" data-speak="${escapeHtml(w.hanzi)}">🔊 ฟัง</button>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : `<div class="vq-perfect-note">สุดยอด! รอบนี้คุณตอบถูกครบทุกข้อ ไม่มีคำผิดเลย 🎉</div>`}
        </div>
      `;

      container.querySelectorAll('[data-speak]').forEach(btn => {
        btn.addEventListener('click', () => speak(btn.dataset.speak));
      });
      document.getElementById('vq-retry-wrong')?.addEventListener('click', () => {
        startVocabQuiz(qz.wrongItems);
      });
      document.getElementById('vq-retry-new')?.addEventListener('click', () => startVocabQuiz());
      document.getElementById('vq-back-setup')?.addEventListener('click', () => {
        qz.active = false;
        qz.finished = false;
        renderVocabQuiz();
      });
      document.getElementById('vq-back-bank')?.addEventListener('click', () => {
        qz.active = false;
        qz.finished = false;
        state.vocabMode = 'bank';
        renderVocab();
      });
      return;
    }

    // ---- 3. Active Question Screen ----
    const curQ = qz.questions[qz.idx];
    const total = qz.questions.length;
    const progressPct = Math.round(((qz.idx + (qz.answered ? 1 : 0)) / total) * 100);

    let promptHtml = '';
    if (curQ.mode === 'zh2th') {
      promptHtml = `
        <div class="vq-mode-tag">จีน → ไทย · เลือกความหมายที่ถูกต้อง</div>
        <div class="vq-prompt-hanzi hanzi-font">${escapeHtml(curQ.word.hanzi)}</div>
        ${(qz.showPinyin || qz.answered) ? `<div class="vq-prompt-py">${escapeHtml(curQ.word.pinyin)}</div>` : `<div class="vq-prompt-py muted">ซ่อนพินอินอยู่</div>`}
        <button type="button" class="btn-secondary vq-audio-btn" id="vq-play-audio">🔊 ฟังเสียงออกเสียง</button>
      `;
    } else if (curQ.mode === 'th2zh') {
      promptHtml = `
        <div class="vq-mode-tag">ไทย → จีน · เลือกคำภาษาจีนที่ตรงกับความหมายนี้</div>
        <div class="vq-prompt-th">${escapeHtml(curQ.word.meaning)}</div>
      `;
    } else if (curQ.mode === 'speak') {
      promptHtml = `
        <div class="vq-mode-tag">🗣️ ฝึกพูดภาษาจีน · ดูความหมายแล้วพูดคำจีนใส่ไมค์</div>
        <div class="vq-prompt-th">${escapeHtml(curQ.word.meaning)}</div>
        ${(qz.speakHint || qz.answered) ? `<div class="vq-prompt-hanzi hanzi-font" style="margin-top:8px">${escapeHtml(curQ.word.hanzi)}</div><div class="vq-prompt-py">${escapeHtml(curQ.word.pinyin)}</div>` : ''}
        <div class="vq-speak-controls">
          <button type="button" class="btn-primary vq-mic-btn ${qz.listening ? 'listening' : ''}" id="vq-mic-btn" ${qz.answered ? 'disabled' : ''}>
            ${qz.listening ? '🎙️ กำลังฟังเสียงคุณ...' : '🎤 กดแล้วพูดภาษาจีน'}
          </button>
          <button type="button" class="btn-secondary" id="vq-play-audio">🔊 ฟังเสียงตัวอย่าง</button>
          ${!qz.answered ? `<button type="button" class="vb-chip ${qz.speakHint ? 'active' : ''}" id="vq-hint-btn">${qz.speakHint ? 'ซ่อนคำใบ้' : '💡 แสดงคำใบ้'}</button>` : ''}
        </div>
        ${qz.spokenText ? `<div class="vq-spoken-box">เสียงที่ระบบได้ยิน: <strong class="hanzi-font">${escapeHtml(qz.spokenText)}</strong></div>` : ''}
      `;
    } else if (curQ.mode === 'typing') {
      promptHtml = `
        <div class="vq-mode-tag">⌨️ พิมพ์พินอิน (ไม่ต้องใส่วรรณยุกต์ก็ได้ เช่น xihuan หรือ xi huan)</div>
        <div class="vq-prompt-hanzi hanzi-font">${escapeHtml(curQ.word.hanzi)}</div>
        <div class="vq-prompt-th" style="font-size:18px;margin-top:4px">${escapeHtml(curQ.word.meaning)}</div>
        <button type="button" class="btn-secondary vq-audio-btn" id="vq-play-audio" style="margin-top:8px">🔊 ฟังเสียงช่วย</button>
      `;
    } else {
      promptHtml = `
        <div class="vq-mode-tag">ฟังเสียง → ไทย · ฟังแล้วเลือกความหมายที่ถูกต้อง</div>
        <button type="button" class="btn-primary vq-audio-big" id="vq-play-audio">🔊 กดฟังเสียงคำนี้</button>
        ${qz.answered ? `<div class="vq-prompt-hanzi hanzi-font" style="margin-top:10px">${escapeHtml(curQ.word.hanzi)}</div><div class="vq-prompt-py">${escapeHtml(curQ.word.pinyin)}</div>` : ''}
      `;
    }

    container.innerHTML = `
      <div class="vq-play-card">
        <div class="vq-top-bar">
          <button type="button" class="btn-secondary vq-exit-btn" id="vq-exit-btn">✕ ออก</button>
          <div class="vq-meta-pills tabular-nums">
            <span>ข้อ <b>${qz.idx + 1}</b> / ${total}</span>
            <span>ถูก <b>${qz.score}</b></span>
            ${qz.streak >= 2 ? `<span class="vq-streak-pill">🔥 ${qz.streak} ติดกัน</span>` : ''}
          </div>
          ${curQ.mode === 'zh2th' ? `<button type="button" class="vb-chip ${qz.showPinyin ? '' : 'active'}" id="vq-inline-py">${qz.showPinyin ? 'ซ่อนพินอิน' : 'แสดงพินอิน'}</button>` : '<span></span>'}
        </div>

        <div class="progress-track" style="height:8px;margin:10px 0 18px">
          <div class="progress-fill" style="width:${progressPct}%"></div>
        </div>

        <div class="vq-prompt-box">${promptHtml}</div>

        ${curQ.mode === 'speak' ? `
          ${!qz.answered ? `
            <div class="vq-speak-fallback">
              <span>หากอุปกรณ์ไม่มีไมค์ หรืออยากประเมินตัวเอง:</span>
              <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:8px">
                <button type="button" class="btn-secondary" id="vq-self-ok">✓ ฉันพูดคำนี้ได้แล้ว</button>
                <button type="button" class="btn-secondary" id="vq-self-skip">ข้าม / ยังจำไม่ได้</button>
              </div>
            </div>
          ` : ''}
        ` : curQ.mode === 'typing' ? `
          <form class="vq-typing-form" id="vq-typing-form">
            <input type="text" id="vq-typing-input" class="vq-typing-input" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="พิมพ์พินอินที่นี่แล้วกด Enter..." value="${escapeHtml(qz.typedInput || '')}" ${qz.answered ? 'disabled' : ''}>
            <button type="submit" class="btn-primary" ${qz.answered ? 'disabled' : ''}>ตรวจคำตอบ</button>
          </form>
        ` : `
          <div class="vq-choices">
            ${curQ.choices.map((c, ci) => {
              let cls = 'vq-choice-btn';
              if (qz.answered) {
                if (ci === curQ.correctIdx) cls += ' is-correct';
                else if (ci === qz.pickedIdx) cls += ' is-wrong';
              }
              const labelHtml = curQ.mode === 'th2zh'
                ? `<span class="vq-ch-hz hanzi-font">${escapeHtml(c.hanzi)}</span><span class="vq-ch-py">${escapeHtml(c.pinyin)}</span>`
                : `<span class="vq-ch-th">${escapeHtml(c.meaning)}</span>`;
              return `
                <button type="button" class="${cls}" data-choice="${ci}" ${qz.answered ? 'disabled' : ''}>
                  <span class="vq-ch-num">${ci + 1}</span>
                  <span class="vq-ch-body">${labelHtml}</span>
                </button>
              `;
            }).join('')}
          </div>
        `}

        ${qz.answered ? `
          <div class="vq-feedback ${qz.pickedIdx === curQ.correctIdx ? 'ok' : 'err'}">
            <div>
              <b>${qz.pickedIdx === curQ.correctIdx ? '✓ ถูกต้อง!' : '✗ ยังไม่ถูก'}</b> ·
              <span class="hanzi-font" style="font-size:18px;font-weight:600">${escapeHtml(curQ.word.hanzi)}</span>
              (${escapeHtml(curQ.word.pinyin)}) = ${escapeHtml(curQ.word.meaning)}
            </div>
            <div style="display:flex;gap:8px;align-items:center">
              <button type="button" class="btn-speak-sm" id="vq-fb-speak">🔊 ฟัง</button>
              <button type="button" class="btn-primary" id="vq-next-btn">${qz.idx + 1 >= total ? 'ดูสรุปผลคะแนน →' : 'ข้อถัดไป →'}</button>
            </div>
          </div>
        ` : ''}
      </div>
    `;

    if (curQ.mode === 'audio2th' && !qz.answered) {
      speak(curQ.word.hanzi);
    }

    document.getElementById('vq-play-audio')?.addEventListener('click', () => speak(curQ.word.hanzi));
    document.getElementById('vq-fb-speak')?.addEventListener('click', () => speak(curQ.word.hanzi));

    document.getElementById('vq-exit-btn')?.addEventListener('click', () => {
      qz.active = false;
      qz.finished = false;
      renderVocabQuiz();
    });

    document.getElementById('vq-inline-py')?.addEventListener('click', () => {
      qz.showPinyin = !qz.showPinyin;
      renderVocabQuiz();
    });

    const recordSpeakOutcome = (isCorrect) => {
      qz.answered = true;
      qz.listening = false;
      qz.pickedIdx = isCorrect ? curQ.correctIdx : -1;
      const mistakes = state.progress.vocabMistakes || (state.progress.vocabMistakes = []);
      const wId = curQ.word.id;
      if (isCorrect) {
        qz.score++;
        qz.streak++;
        if (qz.streak > qz.bestStreak) qz.bestStreak = qz.streak;
        playChime('ok');
        const mIdx = mistakes.indexOf(wId);
        if (mIdx !== -1) mistakes.splice(mIdx, 1);
      } else {
        qz.streak = 0;
        qz.wrongItems.push(curQ.word);
        playChime('err');
        if (!mistakes.includes(wId)) mistakes.push(wId);
      }
      renderVocabQuiz();
    };

    document.getElementById('vq-hint-btn')?.addEventListener('click', () => {
      qz.speakHint = !qz.speakHint;
      renderVocabQuiz();
    });

    document.getElementById('vq-self-ok')?.addEventListener('click', () => recordSpeakOutcome(true));
    document.getElementById('vq-self-skip')?.addEventListener('click', () => recordSpeakOutcome(false));

    const typingInput = document.getElementById('vq-typing-input');
    if (typingInput && !qz.answered) {
      setTimeout(() => typingInput.focus(), 30);
    }
    document.getElementById('vq-typing-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      if (qz.answered) return;
      const raw = String(typingInput?.value || '').trim();
      if (!raw) return;
      qz.typedInput = raw;
      const normUser = stripToneMarks(raw).replace(/[^a-züv]/g, '').replace(/v/g, 'u').replace(/ü/g, 'u');
      const normTarget = curQ.word.pinyinPlain.replace(/[^a-zü]/g, '').replace(/ü/g, 'u');
      const isOk = normUser.length > 0 && normUser === normTarget;
      recordSpeakOutcome(isOk);
    });

    document.getElementById('vq-mic-btn')?.addEventListener('click', () => {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) {
        showToast('เบราว์เซอร์นี้ไม่รองรับการรับเสียง กรุณาใช้ Chrome/Edge หรือกดประเมินตัวเองด้านล่าง', '', false);
        return;
      }
      if (qz.listening) return;
      try {
        const rec = new SR();
        rec.lang = 'zh-CN';
        rec.interimResults = false;
        rec.maxAlternatives = 3;
        qz.listening = true;
        qz.spokenText = '';
        renderVocabQuiz();

        rec.onresult = (ev) => {
          const alts = [];
          for (let i = 0; i < ev.results[0].length; i++) {
            alts.push(String(ev.results[0][i].transcript || '').trim());
          }
          const primary = alts[0] || '';
          qz.spokenText = primary;
          const cleanTarget = curQ.word.hanzi.replace(/[，。！？、\s儿]/g, '');
          const matched = alts.some(t => {
            const ct = t.replace(/[，。！？、\s儿]/g, '');
            return ct && (ct === cleanTarget || ct.includes(cleanTarget) || cleanTarget.includes(ct));
          });
          recordSpeakOutcome(matched);
        };
        rec.onerror = () => {
          qz.listening = false;
          showToast('ไม่ได้ยินเสียงชัดเจน ลองกดพูดอีกครั้งนะครับ', '', false);
          renderVocabQuiz();
        };
        rec.onend = () => {
          if (qz.listening) {
            qz.listening = false;
            renderVocabQuiz();
          }
        };
        rec.start();
      } catch {
        qz.listening = false;
        showToast('ไม่สามารถเปิดไมโครโฟนได้', '', false);
        renderVocabQuiz();
      }
    });

    container.querySelectorAll('[data-choice]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (qz.answered) return;
        const ci = Number(btn.dataset.choice);
        qz.answered = true;
        qz.pickedIdx = ci;
        const mistakes = state.progress.vocabMistakes || (state.progress.vocabMistakes = []);
        const wId = curQ.word.id;

        if (ci === curQ.correctIdx) {
          qz.score++;
          qz.streak++;
          if (qz.streak > qz.bestStreak) qz.bestStreak = qz.streak;
          playChime('ok');
          const mIdx = mistakes.indexOf(wId);
          if (mIdx !== -1) mistakes.splice(mIdx, 1);
        } else {
          qz.streak = 0;
          qz.wrongItems.push(curQ.word);
          playChime('err');
          if (!mistakes.includes(wId)) mistakes.push(wId);
        }
        renderVocabQuiz();
      });
    });

    document.getElementById('vq-next-btn')?.addEventListener('click', () => {
      if (qz.idx + 1 >= total) {
        qz.finished = true;
        qz.active = false;
        const pct = Math.round((qz.score / total) * 100);
        const earnedXp = qz.score * 5 + (pct >= 80 ? 50 : 0);
        state.progress.bonusXp = (state.progress.bonusXp || 0) + earnedXp;
        state.progress.vocabQuizCount = (state.progress.vocabQuizCount || 0) + 1;
        if (pct >= 80) {
          spawnConfetti(36);
          if (typeof pandaReact === 'function') pandaReact('levelup');
        }
        saveProgress(`จบควิซทวนคำศัพท์ ${qz.score}/${total} (${pct}%)`);
        renderVocabQuiz();
      } else {
        qz.idx++;
        qz.answered = false;
        qz.pickedIdx = -1;
        qz.listening = false;
        qz.spokenText = '';
        qz.speakHint = false;
        qz.typedInput = '';
        renderVocabQuiz();
      }
    });
  }

  // ---- FEATURE 5: Radical Breakdown & Example Sentence Inspector Modal ----
  const RADICAL_DB = [
    { rad: '氵 / 水', name: 'น้ำ (ของเหลว)', tip: 'คำที่มี 氵 มักเกี่ยวกับน้ำ แม่น้ำ การล้าง หรือความเย็น', chars: '水河海洗渴汁汤汽泳流满清淡酒泪汗游温澡活法汉没' },
    { rad: '口', name: 'ปาก / การพูดกิน', tip: 'คำที่มี 口 มักเกี่ยวกับปาก การกิน ดื่ม พูด ร้อง หรือเสียง', chars: '口吃喝唱问叫吗呢吧啊听和味喊响哭笑喜右名号告诉回员商' },
    { rad: '讠 / 言', name: 'คำพูด / ภาษา', tip: 'คำที่มี 讠 มักเกี่ยวกับภาษา การพูด อ่าน ขอ หรือบอก', chars: '说请谢认识读说话语课记试诉谈讨议论许译词详诚评误谁该' },
    { rad: '亻 / 人', name: 'คน / บุคคล', tip: 'คำที่มี 亻 มักเกี่ยวกับคน การกระทำของคน หรือสถานะ', chars: '人你他他们们住作做休体位便件什借付代件值低传信保候像' },
    { rad: '女', name: 'ผู้หญิง / ครอบครัว', tip: 'คำที่มี 女 มักเกี่ยวกับผู้หญิง ญาติฝ่ายหญิง หรือความงาม', chars: '女妈妹妹姐姐奶奶好她姓婚姑婆妇妙妥妻始委娃娘' },
    { rad: '木', name: 'ต้นไม้ / ไม้', tip: 'คำที่มี 木 มักเกี่ยวกับต้นไม้ ผลไม้ โต๊ะ ตู้ หรือสิ่งทำจากไม้', chars: '木树林果桌椅杯本机楼板桥床校样格检查极条村枝根桃梨' },
    { rad: '火 / 灬', name: 'ไฟ / ความร้อน', tip: 'คำที่มี 火 หรือ 灬 (4 จุดล่าง) มักเกี่ยวกับไฟ ความร้อน การปรุงอาหาร', chars: '火热灯点烧烤煮熟照烟烦炒燃煤熄灭灾灰灿灵' },
    { rad: '心 / 忄', name: 'หัวใจ / อารมณ์', tip: 'คำที่มี 心 หรือ 忄 มักเกี่ยวกับความรู้สึก ความคิด อารมณ์', chars: '心想忙快慢怕怪情惯懂感愿忘念思怎您急怒怨悲态总息爱' },
    { rad: '手 / 扌', name: 'มือ / การกระทำ', tip: 'คำที่มี 扌 มักเกี่ยวกับการใช้มือ จับ ถือ ตี ดึง ผลัก', chars: '手打拿找拉推提把拍排搬换扫擦接抓指挑按掉挂护报找招' },
    { rad: '日', name: 'ดวงอาทิตย์ / เวลา', tip: 'คำที่มี 日 มักเกี่ยวกับเวลา แสงแดด วัน หรือความสว่าง', chars: '日明早晚时星昨春晴暖暗暑景晒晶晕智暂旧旦' },
    { rad: '月', name: 'ดวงจันทร์ / ร่างกาย', tip: 'คำที่มี 月 มักเกี่ยวกับเดือน เวลา หรืออวัยวะในร่างกาย', chars: '月明朋期服望胖肚脚脸脑腿胸背腰肌肝肺肠胃肥' },
    { rad: '目', name: 'ดวงตา / การมอง', tip: 'คำที่มี 目 มักเกี่ยวกับตา การมองเห็น หรือการนอนหลับ', chars: '目看睡眼睛相盼省眉真直着盲盾瞧盯眯眨' },
    { rad: '足 / 走', name: 'เท้า / การเดินวิ่ง', tip: 'คำที่มี 足 หรือ 走 มักเกี่ยวกับการเดิน วิ่ง กระโดด หรือเท้า', chars: '足跑跳踢路跟距跨踩踏走起赶趁超趣越赵趟' },
    { rad: '辶', name: 'การเดินทาง / เส้นทาง', tip: 'คำที่มี 辶 มักเกี่ยวกับการไป มา ใกล้ ไกล หรือการส่ง', chars: '这进远近送还过道边通迎追逃退运选造连速迟迷遇' },
    { rad: '车', name: 'รถ / ยานพาหนะ', tip: 'คำที่มี 车 มักเกี่ยวกับรถ ล้อ การขนส่ง หรือการหมุน', chars: '车轮轻软较辆转输载辉辈辑轰' },
    { rad: '饣 / 食', name: 'อาหาร / การกิน', tip: 'คำที่มี 饣 มักเกี่ยวกับข้าว อาหาร ความหิว หรือความอิ่ม', chars: '饭饿饱饮馆饼饺馒餐食余养饰' },
    { rad: '金 / 钅', name: 'โลหะ / เงิน', tip: 'คำที่มี 钅 มักเกี่ยวกับเงิน โลหะ เหล็ก หรือเครื่องมือ', chars: '钱钟错铁银铜钢镜钥匙针钓铃锁销锅铺' },
    { rad: '艹', name: 'พืช / ดอกไม้ / หญ้า', tip: 'คำที่มี 艹 ด้านบนมักเกี่ยวกับผัก ผลไม้ ดอกไม้ ชา หรือยา', chars: '花草茶菜药苹蓝落英苦节苏芽苗若苦莓萄葱蒜' },
    { rad: '雨', name: 'ฝน / สภาพอากาศ', tip: 'คำที่มี 雨 ด้านบนมักเกี่ยวกับฝน หิมะ เมฆ หรือฟ้าผ่า', chars: '雨雪云雷电零雾霜露震需霸' },
    { rad: '宀', name: 'หลังคา / บ้าน', tip: 'คำที่มี 宀 ด้านบนมักเกี่ยวกับบ้าน ห้อง ความสงบ หรือครอบครัว', chars: '家室安完定客实宽寄宿寒察富察宝字它宜' },
    { rad: '门', name: 'ประตู / ช่องเปิด', tip: 'คำที่มี 门 มักเกี่ยวกับประตู ห้อง การเปิดปิด หรือการถาม', chars: '门问间闻闹闭闪闲闷闯闰阅阔' },
    { rad: '马', name: 'ม้า / การขี่', tip: 'คำที่มี 马 มักเกี่ยวกับม้า การขี่ หรือความเร็ว', chars: '马骑驾骗骂验骄驻驶驴驼' },
    { rad: '病 / 疒', name: 'โรคภัย / ความเจ็บป่วย', tip: 'คำที่มี 疒 มักเกี่ยวกับอาการป่วย เจ็บ เหนื่อย หรือโรค', chars: '病疼瘦痛疲疾疗痒疯疤痕症' },
    { rad: '衣 / 衤', name: 'เสื้อผ้า / เครื่องนุ่งห่ม', tip: 'คำที่มี 衤 มักเกี่ยวกับเสื้อ กางเกง ถุงเท้า หรือผ้า', chars: '衣裤衬裙袜袖被袋装补初' },
    { rad: '贝', name: 'เปลือกหอย / เงินทอง', tip: 'คำที่มี 贝 มักเกี่ยวกับเงิน ราคา การซื้อขาย หรือความมีค่า', chars: '贵买费货财贷贴账贫贪质资赞赛赚赢赠' },
    { rad: '山 / 土', name: 'ภูเขา / ดิน / สถานที่', tip: 'คำที่มี 山 หรือ 土 มักเกี่ยวกับภูเขา พื้นดิน เมือง หรือสถานที่', chars: '山岁岛岸岩峰岭土在地坐块场城墙坏报垃圾堂塔坡' },
    { rad: '糸 / 纟', name: 'เส้นด้าย / สี / การผูก', tip: 'คำที่มี 纟 มักเกี่ยวกับเชือก เส้นใย สี หรือการเชื่อมโยง', chars: '红绿蓝纸给经练结级纪约组细织线终统继继续' }
  ];

  function analyzeWordRadicals(hanzi) {
    const chars = Array.from(String(hanzi || '')).filter(c => /[\u4e00-\u9fff]/.test(c));
    return chars.map(ch => {
      const found = RADICAL_DB.find(r => r.chars.includes(ch));
      if (found) {
        return { ch, rad: found.rad, name: found.name, tip: found.tip };
      }
      return { ch, rad: 'อักษรเดี่ยว / ผสม', name: 'สังเกตภาพรวมตัวอักษร', tip: 'ลองจำเสียงพินอินคู่กับรูปร่างของตัวอักษรนี้ และฝึกออกเสียงซ้ำ 3 ครั้ง' };
    });
  }

  const CURATED_EXAMPLES = {
    '爱': [
      { hz: '我爱学中文。', py: 'Wǒ ài xué Zhōngwén.', th: 'ฉันชอบ/รักการเรียนภาษาจีน' },
      { hz: '妈妈很爱我。', py: 'Māma hěn ài wǒ.', th: 'แม่รักฉันมาก' }
    ],
    '吃': [
      { hz: '你想吃什么？', py: 'Nǐ xiǎng chī shénme?', th: 'คุณอยากกินอะไร?' },
      { hz: '我们一起吃饭吧。', py: 'Wǒmen yìqǐ chīfàn ba.', th: 'พวกเราไปกินข้าวด้วยกันเถอะ' }
    ],
    '喝': [
      { hz: '我喜欢喝茶。', py: 'Wǒ xǐhuan hē chá.', th: 'ฉันชอบดื่มชา' },
      { hz: '请喝一杯水。', py: 'Qǐng hē yì bēi shuǐ.', th: 'เชิญดื่มน้ำหนึ่งแก้ว' }
    ],
    '学习': [
      { hz: '我每天学习一百个生词。', py: 'Wǒ měitiān xuéxí yìbǎi gè shēngcí.', th: 'ฉันเรียนคำศัพท์ใหม่วันละ 100 คำทุกวัน' },
      { hz: '他在图书馆学习汉语。', py: 'Tā zài túshūguǎn xuéxí Hànyǔ.', th: 'เขาเรียนภาษาจีนอยู่ที่ห้องสมุด' }
    ],
    '朋友': [
      { hz: '他是我的好朋友。', py: 'Tā shì wǒ de hǎo péngyou.', th: 'เขาคือเพื่อนสนิทของฉัน' },
      { hz: '我有很多中国朋友。', py: 'Wǒ yǒu hěn duō Zhōngguó péngyou.', th: 'ฉันมีเพื่อนชาวจีนเยอะมาก' }
    ],
    '时间': [
      { hz: '你今天有时间吗？', py: 'Nǐ jīntiān yǒu shíjiān ma?', th: 'วันนี้คุณมีเวลาไหม?' },
      { hz: '时间过得真快！', py: 'Shíjiān guò de zhēn kuài!', th: 'เวลาผ่านไปเร็วจริงๆ!' }
    ],
    '高兴': [
      { hz: '认识你我很高兴。', py: 'Rènshi nǐ wǒ hěn gāoxìng.', th: 'ยินดีมากที่ได้รู้จักคุณ' },
      { hz: '今天大家都很高兴。', py: 'Jīntiān dàjiā dōu hěn gāoxìng.', th: 'วันนี้ทุกคนดีใจกันมาก' }
    ]
  };

  function buildVocabExamples(word) {
    if (CURATED_EXAMPLES[word.hanzi]) return CURATED_EXAMPLES[word.hanzi];
    const shortMeaning = word.meaning.split(',')[0].trim();
    return [
      {
        hz: `我今天学会了“${word.hanzi}”这个词。`,
        py: `Wǒ jīntiān xuéhuì le "${word.pinyin}" zhège cí.`,
        th: `วันนี้ฉันจำคำว่า "${word.hanzi}" (${shortMeaning}) ได้แล้ว`
      },
      {
        hz: `请问，“${word.hanzi}”怎么用？`,
        py: `Qǐngwèn, "${word.pinyin}" zěnme yòng?`,
        th: `ขอถามหน่อย คำว่า "${word.hanzi}" (${shortMeaning}) ใช้ยังไงเหรอ?`
      }
    ];
  }

  function closeVocabDetailModal() {
    const bd = document.getElementById('vb-modal-backdrop');
    if (bd) {
      bd.hidden = true;
      bd.innerHTML = '';
    }
  }

  function openVocabDetailModal(id) {
    const all = getVocabIndex();
    const word = all[id];
    const bd = document.getElementById('vb-modal-backdrop');
    if (!word || !bd) return;

    const radicals = analyzeWordRadicals(word.hanzi);
    const examples = buildVocabExamples(word);
    const learnedDate = (state.progress.vocabLearned || {})[word.id];
    const srsEntry = (state.progress.vocabSrs || {})[word.id];

    bd.innerHTML = `
      <div class="vb-modal" role="dialog" aria-modal="true">
        <div class="vb-modal-head">
          <div style="display:flex;align-items:center;gap:8px">
            <span class="vb-hsk-tag lv-${word.level}">HSK ${word.level === 7 ? '7+' : word.level}</span>
            ${learnedDate ? `<span class="vb-pct-pill">✓ สะสมเมื่อ ${learnedDate}</span>` : `<span class="vb-seq">ยังไม่ได้สะสม</span>`}
          </div>
          <button type="button" class="btn-secondary vb-modal-close" id="vb-modal-close">✕ ปิด</button>
        </div>

        <div class="vb-modal-word">
          <div class="vb-modal-hz hanzi-font">${escapeHtml(word.hanzi)}</div>
          <div class="vb-modal-py">${escapeHtml(word.pinyin)}</div>
          <div class="vb-modal-th">${escapeHtml(word.meaning)}</div>
          <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:10px">
            <button type="button" class="btn-primary" id="vb-modal-speak">🔊 ฟังเสียงคำนี้</button>
            <button type="button" class="btn-secondary" id="vb-modal-toggle-learn">${learnedDate ? '✓ สะสมแล้ว (กดเพื่อยกเลิก)' : '+ กดสะสมคำนี้'}</button>
            <button type="button" class="btn-secondary ${(state.progress.vocabStarred || []).includes(word.id) ? 'vb-star-active' : ''}" id="vb-modal-star">${(state.progress.vocabStarred || []).includes(word.id) ? '★ ปักหมุดแล้ว' : '☆ ปักหมุดคำโปรด'}</button>
            <button type="button" class="btn-secondary" id="vb-modal-ai-chat">💬 ฝึกใช้คำนี้กับครู AI</button>
          </div>
        </div>

        <div class="vb-modal-sec">
          <h4>✍️ ฝึกเขียนลำดับขีด (Hanzi Writer)</h4>
          <div class="vb-writer-box">
            <div class="vb-writer-chars" id="vb-writer-chars">
              ${radicals.map((r, i) => `<button type="button" class="vb-chip ${i === 0 ? 'active' : ''}" data-wchar="${escapeHtml(r.ch)}"><span class="hanzi-font" style="font-size:16px">${escapeHtml(r.ch)}</span></button>`).join('')}
            </div>
            <div class="vb-writer-stage">
              <div id="vb-hanzi-canvas" class="vb-hanzi-canvas"></div>
              <div class="vb-writer-actions">
                <button type="button" class="btn-secondary" id="vb-hw-animate">▶ ดูลำดับขีด</button>
                <button type="button" class="btn-primary" id="vb-hw-quiz">✍️ ลองลากเส้นเขียน</button>
                <div id="vb-hw-status" class="vb-hw-status">เลือกตัวอักษรแล้วกดดูลำดับขีดหรือฝึกเขียนได้เลย</div>
              </div>
            </div>
          </div>
        </div>

        <div class="vb-modal-sec">
          <h4>🧩 แกะรากศัพท์ / หมวดอักษร (ช่วยจำ)</h4>
          <div class="vb-rad-list">
            ${radicals.map(r => `
              <div class="vb-rad-item">
                <span class="vb-rad-ch hanzi-font">${escapeHtml(r.ch)}</span>
                <div>
                  <div class="vb-rad-title">หมวด: <b>${escapeHtml(r.rad)}</b> — ${escapeHtml(r.name)}</div>
                  <div class="vb-rad-tip">💡 ${escapeHtml(r.tip)}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="vb-modal-sec">
          <h4>💬 ตัวอย่างประโยคใช้งาน</h4>
          <div class="vb-ex-list">
            ${examples.map((ex, i) => `
              <div class="vb-ex-item">
                <div class="vb-ex-top">
                  <span class="vb-ex-hz hanzi-font">${escapeHtml(ex.hz)}</span>
                  <button type="button" class="btn-speak-sm" data-ex-speak="${i}">🔊 ฟัง</button>
                </div>
                <div class="vb-ex-py">${escapeHtml(ex.py)}</div>
                <div class="vb-ex-th">${escapeHtml(ex.th)}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="vb-modal-sec">
          <h4>📝 โน้ตช่วยจำส่วนตัว (Mnemonic)</h4>
          <div class="vb-note-editor">
            <textarea id="vb-note-input" rows="2" placeholder="จดทริคช่วยจำของคุณเอง เช่น คำพ้องเสียง หรือเรื่องตลกช่วยจำ...">${escapeHtml((state.progress.vocabNotes || {})[word.id] || '')}</textarea>
            <button type="button" class="btn-secondary" id="vb-note-save">💾 บันทึกโน้ต</button>
          </div>
        </div>

        ${srsEntry ? `
          <div class="vb-modal-srs-foot">
            🔄 สถานะทวนอัตโนมัติ (SRS): รอบทวนถัดไป <b>${srsEntry.nextDue}</b> (ระดับความจำ ${srsEntry.step + 1}/5)
          </div>
        ` : ''}
      </div>
    `;
    bd.hidden = false;

    bd.onclick = (e) => {
      if (e.target === bd) closeVocabDetailModal();
    };
    document.getElementById('vb-modal-close')?.addEventListener('click', closeVocabDetailModal);
    document.getElementById('vb-modal-speak')?.addEventListener('click', () => speak(word.hanzi));
    document.getElementById('vb-modal-ai-chat')?.addEventListener('click', () => {
      closeVocabDetailModal();
      switchTab('tutor');
      setTimeout(() => {
        const inp = document.getElementById('tutor-input');
        if (inp) {
          inp.value = `ช่วยแต่งประโยคและชวนฉันคุยภาษาจีนโดยใช้คำว่า "${word.hanzi}" (${word.meaning.split(',')[0]}) หน่อยครับ`;
          inp.focus();
        }
      }, 120);
    });
    document.getElementById('vb-modal-star')?.addEventListener('click', () => {
      const list = state.progress.vocabStarred || (state.progress.vocabStarred = []);
      const idx = list.indexOf(word.id);
      if (idx === -1) { list.push(word.id); playChime('ok'); }
      else { list.splice(idx, 1); }
      saveProgress();
      openVocabDetailModal(word.id);
      if (state.vocabMode === 'bank') renderVocabBankResults();
    });

    document.getElementById('vb-note-save')?.addEventListener('click', () => {
      const val = String(document.getElementById('vb-note-input')?.value || '').trim();
      const notes = state.progress.vocabNotes || (state.progress.vocabNotes = {});
      if (val) notes[word.id] = val;
      else delete notes[word.id];
      saveProgress('บันทึกโน้ตช่วยจำแล้ว');
      playChime('ok');
      if (state.vocabMode === 'bank') renderVocabBankResults();
    });

    // Initialize Hanzi Writer inside modal
    let modalWriter = null;
    const mountModalWriter = (ch) => {
      const target = document.getElementById('vb-hanzi-canvas');
      const statusEl = document.getElementById('vb-hw-status');
      if (!target || !ch) return;
      target.innerHTML = '';
      if (typeof window.HanziWriter === 'undefined') {
        if (statusEl) statusEl.textContent = 'ไม่สามารถโหลด HanziWriter ได้ (ต้องเชื่อมต่ออินเทอร์เน็ต)';
        return;
      }
      try {
        modalWriter = window.HanziWriter.create(target, ch, {
          width: 156,
          height: 156,
          padding: 10,
          showOutline: true,
          strokeAnimationSpeed: 1,
          delayBetweenStrokes: 260,
          strokeColor: '#007aff',
          radicalColor: '#34c759'
        });
        if (statusEl) statusEl.textContent = `พร้อมฝึกเขียนตัว "${ch}"`;
      } catch {
        if (statusEl) statusEl.textContent = `ยังไม่มีข้อมูลลำดับขีดสำหรับตัว "${ch}"`;
      }
    };
    if (radicals.length > 0) {
      mountModalWriter(radicals[0].ch);
    }
    bd.querySelectorAll('[data-wchar]').forEach(btn => {
      btn.addEventListener('click', () => {
        bd.querySelectorAll('[data-wchar]').forEach(b => b.classList.toggle('active', b === btn));
        mountModalWriter(btn.dataset.wchar);
      });
    });
    document.getElementById('vb-hw-animate')?.addEventListener('click', () => {
      if (modalWriter) modalWriter.animateCharacter();
    });
    document.getElementById('vb-hw-quiz')?.addEventListener('click', () => {
      const statusEl = document.getElementById('vb-hw-status');
      if (!modalWriter) return;
      if (statusEl) statusEl.textContent = 'ลากเส้นตามลำดับขีดบนกรอบสี่เหลี่ยมได้เลย!';
      modalWriter.quiz({
        onComplete: () => {
          playChime('ok');
          state.progress.bonusXp = (state.progress.bonusXp || 0) + 5;
          saveProgress('ฝึกเขียนอักษรจีนสำเร็จ!');
          if (statusEl) statusEl.textContent = '🎉 เขียนครบทุกขีดถูกต้อง! (+5 XP)';
        }
      });
    });
    bd.querySelectorAll('[data-ex-speak]').forEach(btn => {
      btn.addEventListener('click', () => speak(examples[Number(btn.dataset.exSpeak)].hz));
    });
    document.getElementById('vb-modal-toggle-learn')?.addEventListener('click', () => {
      const map = state.progress.vocabLearned || (state.progress.vocabLearned = {});
      const tkNow = todayKey();
      if (map[word.id]) {
        delete map[word.id];
        if (state.progress.vocabSrs) delete state.progress.vocabSrs[word.id];
        saveProgress();
      } else {
        map[word.id] = tkNow;
        syncVocabSrsOnLearn(word.id, tkNow);
        playChime('ok');
        const msg = checkVocabMilestones(getVocabTodayCount());
        saveProgress(msg);
      }
      updateVocabSrsBadge();
      openVocabDetailModal(word.id);
      if (state.vocabMode === 'bank') renderVocabBankResults();
      updateVocabHeroCounters();
    });
  }

  // ---- FEATURE 1: Smart SRS (1-3-7-14-30 Days) for 10,969-Word Bank ----
  const SRS_INTERVALS = [1, 3, 7, 14, 30];

  function addDaysToKey(dateStr, days) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  function syncVocabSrsOnLearn(id, dateStr) {
    if (!state.progress.vocabSrs) state.progress.vocabSrs = {};
    if (!state.progress.vocabSrs[id]) {
      state.progress.vocabSrs[id] = {
        step: 0,
        nextDue: addDaysToKey(dateStr || todayKey(), 1),
        reviews: 0,
        updatedAt: Date.now()
      };
    }
  }

  function ensureAllLearnedInSrs() {
    const learnedMap = state.progress.vocabLearned || {};
    for (const id in learnedMap) {
      syncVocabSrsOnLearn(id, learnedMap[id]);
    }
  }

  function getDueVocabSrsWords() {
    ensureAllLearnedInSrs();
    const all = getVocabIndex();
    const srsMap = state.progress.vocabSrs || {};
    const tk = todayKey();
    const due = [];
    for (const id in srsMap) {
      if (srsMap[id] && srsMap[id].nextDue <= tk && all[Number(id)]) {
        due.push(all[Number(id)]);
      }
    }
    return due;
  }

  function updateVocabSrsBadge() {
    const badge = document.getElementById('vtab-srs-due');
    if (badge) {
      const n = getDueVocabSrsWords().length;
      badge.textContent = String(n);
      badge.classList.toggle('has-due', n > 0);
    }
  }

  function renderVocabSrs() {
    const container = document.getElementById('vocab-srs-view');
    if (!container) return;
    ensureAllLearnedInSrs();
    updateVocabSrsBadge();

    const srsMap = state.progress.vocabSrs || {};
    const totalInSrs = Object.keys(srsMap).length;
    const dueWords = getDueVocabSrsWords();
    const masteredCount = Object.values(srsMap).filter(x => x && x.step >= 2).length;
    const todayWords = getVocabQuizPool('today');
    const sess = state.vocabSrsSession;

    if (!sess.queue.length && dueWords.length > 0 && !sess.earlyMode) {
      sess.queue = shuffleArray(dueWords);
      sess.idx = 0;
      sess.flipped = false;
    }

    const activeWord = sess.queue[sess.idx] || null;

    container.innerHTML = `
      <div class="vsrs-kpi-row">
        <div class="vsrs-kpi">
          <span>ครบกำหนดทวนวันนี้</span>
          <strong class="tabular-nums">${dueWords.length} คำ</strong>
        </div>
        <div class="vsrs-kpi">
          <span>อยู่ในระบบ SRS ทั้งหมด</span>
          <strong class="tabular-nums">${totalInSrs.toLocaleString()} คำ</strong>
        </div>
        <div class="vsrs-kpi">
          <span>จำแม่นแล้ว (ช่วง ≥ 7 วัน)</span>
          <strong class="tabular-nums">${masteredCount.toLocaleString()} คำ</strong>
        </div>
      </div>

      ${activeWord ? `
        <div class="vsrs-card-wrap">
          <div class="vsrs-head">
            <span class="tabular-nums">${sess.earlyMode ? 'โหมดทวนล่วงหน้า' : 'รอบทวนตามกำหนดวันนี้'} · การ์ดที่ <b>${sess.idx + 1}</b> / ${sess.queue.length}</span>
            <button type="button" class="btn-speak-sm" id="vsrs-detail-btn">🧩 ดูรากศัพท์ & ประโยค</button>
          </div>

          <div class="vsrs-flashcard ${sess.flipped ? 'flipped' : ''}" id="vsrs-flashcard" role="button" tabindex="0">
            <div class="vsrs-fc-hz hanzi-font">${escapeHtml(activeWord.hanzi)}</div>
            <button type="button" class="btn-secondary vsrs-speak-btn" id="vsrs-speak-btn">🔊 ฟังเสียง</button>
            ${sess.flipped ? `
              <div class="vsrs-fc-answer">
                <div class="vsrs-fc-py">${escapeHtml(activeWord.pinyin)}</div>
                <div class="vsrs-fc-th">${escapeHtml(activeWord.meaning)}</div>
              </div>
            ` : `<div class="vsrs-fc-hint">แตะการ์ดเพื่อเฉลยพินอินและคำแปลไทย</div>`}
          </div>

          ${sess.flipped ? (() => {
            const curSrs = srsMap[activeWord.id];
            const tk = todayKey();
            const dHard = computeNextSm2(curSrs, 'hard', tk).interval;
            const dGood = computeNextSm2(curSrs, 'good', tk).interval;
            const dEasy = computeNextSm2(curSrs, 'easy', tk).interval;
            return `
            <div class="vsrs-rate-bar">
              <button type="button" class="vsrs-rate-btn r-again" data-rate="again"><b>ลืมแล้ว</b><small>[1] ทวนซ้ำวันนี้</small></button>
              <button type="button" class="vsrs-rate-btn r-hard" data-rate="hard"><b>จำไม่ค่อยแม่น</b><small>[2] +${dHard} วัน</small></button>
              <button type="button" class="vsrs-rate-btn r-good" data-rate="good"><b>จำได้</b><small>[3] +${dGood} วัน</small></button>
              <button type="button" class="vsrs-rate-btn r-easy" data-rate="easy"><b>ง่ายมาก!</b><small>[4] +${dEasy} วัน</small></button>
            </div>
            `;
          })() : `
            <div style="text-align:center;margin-top:12px">
              <button type="button" class="btn-primary" id="vsrs-flip-btn">พลิกดูเฉลย →</button>
            </div>
          `}
          <div style="text-align:center;font-size:12px;color:var(--sys-label-3);margin-top:10px">คีย์ลัด: Space พลิกการ์ด · 1–4 ให้คะแนน · R ฟังเสียงซ้ำ</div>
        </div>
      ` : `
        <div class="vsrs-empty-card">
          <div style="font-size:38px;margin-bottom:8px">🎉</div>
          <h3>${totalInSrs === 0 ? 'ยังไม่มีคำศัพท์ในระบบทวน SRS' : 'ทวนคำศัพท์ครบตามกำหนดวันนี้แล้ว!'}</h3>
          <p>${totalInSrs === 0
            ? 'เริ่มกด "+ สะสมคำนี้" ในแท็บคลังศัพท์ 100 คำ/วัน แล้วระบบจะคำนวณรอบทวน 1 → 3 → 7 → 14 → 30 วันให้อัตโนมัติครับ'
            : 'คำที่คุณสะสมวันนี้จะครบกำหนดทวนรอบแรกในวันพรุ่งนี้ หรือจะกดทวนล่วงหน้าตอนนี้เลยก็ได้ครับ'}</p>
          <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:14px">
            ${todayWords.length > 0 ? `<button type="button" class="btn-primary" id="vsrs-early-today">⚡ ทวนล่วงหน้าจากคำที่สะสมวันนี้ (${todayWords.length} คำ)</button>` : ''}
            ${totalInSrs > 0 ? `<button type="button" class="btn-secondary" id="vsrs-early-all">สุ่มทวน 20 คำจากที่สะสมทั้งหมด</button>` : ''}
            <button type="button" class="btn-secondary" id="vsrs-go-bank">← ไปหน้าคลังศัพท์ 100 คำ</button>
          </div>
        </div>
      `}
    `;

    document.getElementById('vsrs-speak-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (activeWord) speak(activeWord.hanzi);
    });
    document.getElementById('vsrs-detail-btn')?.addEventListener('click', () => {
      if (activeWord) openVocabDetailModal(activeWord.id);
    });
    const flipCard = () => {
      if (!activeWord) return;
      sess.flipped = !sess.flipped;
      renderVocabSrs();
    };
    document.getElementById('vsrs-flashcard')?.addEventListener('click', flipCard);
    document.getElementById('vsrs-flip-btn')?.addEventListener('click', flipCard);

    container.querySelectorAll('[data-rate]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!activeWord) return;
        const rate = btn.dataset.rate;
        const tk = todayKey();
        const nextEntry = computeNextSm2(srsMap[activeWord.id], rate, tk);
        if (rate === 'again') {
          sess.queue.push(activeWord); // re-queue in current session
        }
        srsMap[activeWord.id] = nextEntry;
        state.progress.bonusXp = (state.progress.bonusXp || 0) + 4;
        sess.doneCount++;
        sess.idx++;
        sess.flipped = false;
        playChime(rate === 'again' ? 'err' : 'ok');
        if (sess.idx >= sess.queue.length) {
          sess.queue = [];
          sess.idx = 0;
          sess.earlyMode = false;
          spawnConfetti(26);
          saveProgress('ทวน SRS ครบชุดแล้ว! เยี่ยมมาก');
        } else {
          saveProgress();
        }
        renderVocabSrs();
      });
    });

    document.getElementById('vsrs-early-today')?.addEventListener('click', () => {
      sess.queue = shuffleArray(todayWords).slice(0, 30);
      sess.idx = 0;
      sess.flipped = false;
      sess.earlyMode = true;
      renderVocabSrs();
    });
    document.getElementById('vsrs-early-all')?.addEventListener('click', () => {
      const allL = getVocabQuizPool('all_learned');
      sess.queue = shuffleArray(allL).slice(0, 20);
      sess.idx = 0;
      sess.flipped = false;
      sess.earlyMode = true;
      renderVocabSrs();
    });
    document.getElementById('vsrs-go-bank')?.addEventListener('click', () => {
      state.vocabMode = 'bank';
      renderVocab();
    });
  }

  // ---- FEATURE 2: Vocab Games (Speed Match & Hanzi Rain from Daily 100 Words) ----
  function stopVocabGameTimers() {
    const g = state.vocabGame;
    if (g.timerId) {
      clearInterval(g.timerId);
      g.timerId = null;
    }
    g.active = false;
  }

  function dealMatchBoard() {
    const g = state.vocabGame;
    const batch = shuffleArray(g.pool).slice(0, Math.min(6, g.pool.length));
    g.pairs = batch;
    g.leftOrder = shuffleArray(batch);
    g.rightOrder = shuffleArray(batch);
    g.selLeft = null;
    g.selRight = null;
    g.matchedIds = [];
  }

  function spawnRainDrop() {
    const g = state.vocabGame;
    if (!g.pool.length) return;
    const target = g.pool[Math.floor(Math.random() * g.pool.length)];
    const distractors = [];
    const used = new Set([target.meaning]);
    let guard = 0;
    const bank = g.pool.length >= 8 ? g.pool : getVocabIndex().slice(0, 400);
    while (distractors.length < 3 && guard < 120) {
      guard++;
      const c = bank[Math.floor(Math.random() * bank.length)];
      if (c && !used.has(c.meaning)) {
        used.add(c.meaning);
        distractors.push(c);
      }
    }
    g.rainWord = target;
    g.rainChoices = shuffleArray([target, ...distractors]);
    g.rainY = 0;
  }

  function finishVocabGame() {
    const g = state.vocabGame;
    stopVocabGameTimers();
    g.finished = true;
    const xpGain = Math.min(120, Math.max(10, Math.round(g.score / 5)));
    state.progress.bonusXp = (state.progress.bonusXp || 0) + xpGain;
    if (g.mode === 'match' && g.score > (state.progress.vocabMatchBest || 0)) {
      state.progress.vocabMatchBest = g.score;
      spawnConfetti(30);
    } else if (g.mode === 'rain' && g.score > (state.progress.vocabRainBest || 0)) {
      state.progress.vocabRainBest = g.score;
      spawnConfetti(30);
    }
    saveProgress(`จบเกมศัพท์ได้ ${g.score} คะแนน!`);
    renderVocabGames();
  }

  function startVocabGame() {
    const g = state.vocabGame;
    stopVocabGameTimers();
    const pool = getVocabQuizPool(g.source);
    if (pool.length < 6) {
      showToast('ต้องมีคำศัพท์อย่างน้อย 6 คำเพื่อเล่นเกม (ลองเลือกชุดปัจจุบัน 100 คำ)', '', false);
      return;
    }
    g.pool = pool;
    g.active = true;
    g.finished = false;
    g.score = 0;
    g.combo = 0;
    g.bestCombo = 0;
    g.clearedCount = 0;

    if (g.mode === 'match') {
      g.timeLeft = 60;
      dealMatchBoard();
      renderVocabGames();
      g.timerId = setInterval(() => {
        if (!g.active) return;
        g.timeLeft--;
        const tEl = document.getElementById('vg-time-val');
        if (tEl) tEl.textContent = `${g.timeLeft}s`;
        if (g.timeLeft <= 0) finishVocabGame();
      }, 1000);
    } else {
      g.lives = 3;
      g.rainCaught = 0;
      g.rainSpeed = 1.35;
      spawnRainDrop();
      renderVocabGames();
      g.timerId = setInterval(() => {
        if (!g.active) return;
        g.rainY += g.rainSpeed;
        const dropEl = document.getElementById('vg-rain-drop');
        if (dropEl) dropEl.style.top = `${Math.min(84, g.rainY)}%`;
        if (g.rainY >= 84) {
          g.lives--;
          g.combo = 0;
          playChime('err');
          if (g.lives <= 0) {
            finishVocabGame();
          } else {
            spawnRainDrop();
            renderVocabGames();
          }
        }
      }, 90);
    }
  }

  function renderVocabGames() {
    const container = document.getElementById('vocab-games-view');
    if (!container) return;
    const g = state.vocabGame;
    const todayPool = getVocabQuizPool('today');
    const setPool = getVocabQuizPool('set');
    const allLearnedPool = getVocabQuizPool('all_learned');

    if (!g.active && !g.finished) {
      const curPool = getVocabQuizPool(g.source);
      const canStart = curPool.length >= 6;
      container.innerHTML = `
        <div class="vq-setup-card">
          <div class="vq-setup-head">
            <div>
              <h2 class="vq-title">⚡ เกมทวนคำศัพท์ (Speed Match & ฝนตัวอักษร)</h2>
              <p class="vq-desc">เปลี่ยนการท่องศัพท์วันละ 100 คำให้สนุกเหมือนเล่นเกม ฝึกสมองดึงความหมายให้ไวขึ้น!</p>
            </div>
            <div class="vq-stat-chip tabular-nums">สถิติ: Match ${state.progress.vocabMatchBest || 0} · Rain ${state.progress.vocabRainBest || 0}</div>
          </div>

          <div class="vq-section-label">1. เลือกเกม</div>
          <div class="vq-mode-grid">
            <button type="button" class="vq-mode-btn ${g.mode === 'match' ? 'active' : ''}" data-vgmode="match">
              <b>⚡ Speed Match (60 วิ)</b>
              <small>จับคู่ตัวจีนกับคำแปลไทยให้ไวที่สุด ทำคอมโบเก็บแต้ม!</small>
            </button>
            <button type="button" class="vq-mode-btn ${g.mode === 'rain' ? 'active' : ''}" data-vgmode="rain">
              <b>🌧️ ฝนตัวอักษร (Hanzi Rain)</b>
              <small>ยิงคำแปลให้ทันก่อนคำจีนจะตกลงพื้น มีหัวใจ 3 ดวง!</small>
            </button>
          </div>

          <div class="vq-section-label">2. เลือกชุดคำศัพท์ที่จะนำมาเล่น</div>
          <div class="vq-source-grid">
            <button type="button" class="vq-source-btn ${g.source === 'today' ? 'active' : ''}" data-vgsrc="today">
              <span class="vq-src-icon">📅</span><span><b>คำที่สะสมวันนี้</b><small>${todayPool.length} คำ</small></span>
            </button>
            <button type="button" class="vq-source-btn ${g.source === 'set' ? 'active' : ''}" data-vgsrc="set">
              <span class="vq-src-icon">📦</span><span><b>ชุดปัจจุบัน (ชุดที่ ${state.vocabSet})</b><small>${setPool.length} คำ</small></span>
            </button>
            <button type="button" class="vq-source-btn ${g.source === 'all_learned' ? 'active' : ''}" data-vgsrc="all_learned">
              <span class="vq-src-icon">🏆</span><span><b>คำที่สะสมทั้งหมด</b><small>${allLearnedPool.length.toLocaleString()} คำ</small></span>
            </button>
          </div>

          ${!canStart ? `<div class="vq-warn">แหล่งนี้มี <b>${curPool.length} คำ</b> (ต้องมีอย่างน้อย 6 คำ) — กดเลือก <b>ชุดปัจจุบัน (ชุดที่ ${state.vocabSet})</b> เพื่อเริ่มเล่นได้เลย!</div>` : ''}

          <div class="vq-start-bar">
            <button type="button" class="btn-primary vq-start-btn" id="vg-start-btn" ${!canStart ? 'disabled' : ''}>🚀 เริ่มเล่นเกม!</button>
          </div>
        </div>
      `;
      container.querySelectorAll('[data-vgmode]').forEach(b => b.addEventListener('click', () => { g.mode = b.dataset.vgmode; renderVocabGames(); }));
      container.querySelectorAll('[data-vgsrc]').forEach(b => b.addEventListener('click', () => { g.source = b.dataset.vgsrc; renderVocabGames(); }));
      document.getElementById('vg-start-btn')?.addEventListener('click', startVocabGame);
      return;
    }

    if (g.finished) {
      container.innerHTML = `
        <div class="vq-result-card">
          <div class="vq-grade-pill grade-a">${g.mode === 'match' ? '⚡ จบเกม Speed Match!' : '🌧️ จบเกมฝนตัวอักษร!'}</div>
          <div class="vq-score-big tabular-nums">${g.score} แต้ม</div>
          <div class="vq-score-sub tabular-nums">คอมโบสูงสุด <b>${g.bestCombo}</b> · ${g.mode === 'match' ? `จับคู่สำเร็จ ${g.clearedCount} คู่` : `รับคำศัพท์ได้ ${g.rainCaught} คำ`}</div>
          <div class="vq-result-actions">
            <button type="button" class="btn-primary" id="vg-again">🔁 เล่นอีกครั้ง</button>
            <button type="button" class="btn-secondary" id="vg-menu">⚙ เปลี่ยนเกม / ชุดคำ</button>
          </div>
        </div>
      `;
      document.getElementById('vg-again')?.addEventListener('click', startVocabGame);
      document.getElementById('vg-menu')?.addEventListener('click', () => { g.finished = false; renderVocabGames(); });
      return;
    }

    if (g.mode === 'match') {
      container.innerHTML = `
        <div class="vq-play-card">
          <div class="vq-top-bar">
            <button type="button" class="btn-secondary vq-exit-btn" id="vg-stop">✕ หยุด</button>
            <div class="vq-meta-pills tabular-nums">
              <span>⏱ <b id="vg-time-val">${g.timeLeft}s</b></span>
              <span>คะแนน <b>${g.score}</b></span>
              ${g.combo >= 2 ? `<span class="vq-streak-pill">🔥 x${g.combo}</span>` : ''}
            </div>
          </div>
          <div class="vg-match-grid">
            <div class="vg-col">
              ${g.leftOrder.map(w => `
                <button type="button" class="vg-tile ${g.matchedIds.includes(w.id) ? 'matched' : ''} ${g.selLeft === w.id ? 'selected' : ''}" data-left="${w.id}" ${g.matchedIds.includes(w.id) ? 'disabled' : ''}>
                  <span class="hanzi-font" style="font-size:24px;font-weight:600">${escapeHtml(w.hanzi)}</span>
                  <small>${escapeHtml(w.pinyin)}</small>
                </button>
              `).join('')}
            </div>
            <div class="vg-col">
              ${g.rightOrder.map(w => `
                <button type="button" class="vg-tile ${g.matchedIds.includes(w.id) ? 'matched' : ''} ${g.selRight === w.id ? 'selected' : ''}" data-right="${w.id}" ${g.matchedIds.includes(w.id) ? 'disabled' : ''}>
                  <span>${escapeHtml(w.meaning)}</span>
                </button>
              `).join('')}
            </div>
          </div>
        </div>
      `;
      document.getElementById('vg-stop')?.addEventListener('click', () => { stopVocabGameTimers(); renderVocabGames(); });

      const checkMatch = () => {
        if (g.selLeft === null || g.selRight === null) return;
        if (g.selLeft === g.selRight) {
          g.matchedIds.push(g.selLeft);
          g.combo++;
          if (g.combo > g.bestCombo) g.bestCombo = g.combo;
          g.score += 10 + Math.min(20, g.combo * 2);
          g.clearedCount++;
          playChime('ok');
          const matchedWord = g.pairs.find(p => p.id === g.selLeft);
          if (matchedWord) speak(matchedWord.hanzi);
          g.selLeft = null;
          g.selRight = null;
          if (g.matchedIds.length >= g.pairs.length) {
            dealMatchBoard();
          }
        } else {
          g.combo = 0;
          playChime('err');
          g.selLeft = null;
          g.selRight = null;
        }
        renderVocabGames();
      };

      container.querySelectorAll('[data-left]').forEach(btn => {
        btn.addEventListener('click', () => { g.selLeft = Number(btn.dataset.left); checkMatch(); if (g.selRight === null) renderVocabGames(); });
      });
      container.querySelectorAll('[data-right]').forEach(btn => {
        btn.addEventListener('click', () => { g.selRight = Number(btn.dataset.right); checkMatch(); if (g.selLeft === null) renderVocabGames(); });
      });
    } else {
      const rw = g.rainWord;
      container.innerHTML = `
        <div class="vq-play-card">
          <div class="vq-top-bar">
            <button type="button" class="btn-secondary vq-exit-btn" id="vg-stop">✕ หยุด</button>
            <div class="vq-meta-pills tabular-nums">
              <span>${'❤️'.repeat(Math.max(0, g.lives))}${'🖤'.repeat(Math.max(0, 3 - g.lives))}</span>
              <span>คะแนน <b>${g.score}</b></span>
              ${g.combo >= 2 ? `<span class="vq-streak-pill">🔥 x${g.combo}</span>` : ''}
            </div>
          </div>
          <div class="vg-rain-arena">
            <div class="vg-rain-drop" id="vg-rain-drop" style="top:${g.rainY}%">
              <div class="hanzi-font" style="font-size:34px;font-weight:700">${escapeHtml(rw.hanzi)}</div>
              <div style="font-size:13px;color:var(--sys-accent-text);font-weight:700">${escapeHtml(rw.pinyin)}</div>
            </div>
            <div class="rain-danger-line"></div>
          </div>
          <div class="vq-choices" style="margin-top:12px">
            ${g.rainChoices.map(c => `
              <button type="button" class="vq-choice-btn" data-rain-pick="${c.id}">
                <span class="vq-ch-th">${escapeHtml(c.meaning)}</span>
              </button>
            `).join('')}
          </div>
        </div>
      `;
      document.getElementById('vg-stop')?.addEventListener('click', () => { stopVocabGameTimers(); renderVocabGames(); });
      container.querySelectorAll('[data-rain-pick]').forEach(btn => {
        btn.addEventListener('click', () => {
          const picked = Number(btn.dataset.rainPick);
          if (picked === rw.id) {
            g.combo++;
            if (g.combo > g.bestCombo) g.bestCombo = g.combo;
            g.score += 15 + Math.min(25, g.combo * 3);
            g.rainCaught++;
            g.rainSpeed = Math.min(3.2, 1.35 + g.rainCaught * 0.08);
            playChime('ok');
            speak(rw.hanzi);
            spawnRainDrop();
            renderVocabGames();
          } else {
            g.lives--;
            g.combo = 0;
            playChime('err');
            if (g.lives <= 0) {
              finishVocabGame();
            } else {
              spawnRainDrop();
              renderVocabGames();
            }
          }
        });
      });
    }
  }

  // ---- FEATURE 3: Story / Dialogue Generator from Today's Words ----
  function buildOfflineVocabStory(words) {
    const w = (i) => words[i % words.length];
    const m = (item) => item.meaning.split(',')[0].trim();
    const lines = [
      {
        hz: `今天早上，我一边喝茶，一边学习了“${w(0).hanzi}”和“${w(1).hanzi}”。`,
        py: `Jīntiān zǎoshang, wǒ yìbiān hē chá, yìbiān xuéxí le "${w(0).pinyin}" hé "${w(1).pinyin}".`,
        th: `เช้าวันนี้ ฉันจิบชาไปพร้อมกับท่องคำว่า "${w(0).hanzi}" (${m(w(0))}) และ "${w(1).hanzi}" (${m(w(1))})`,
        usedWords: [w(0).hanzi, w(1).hanzi]
      },
      {
        hz: `中午的时候，朋友问我：“${w(2).hanzi}”和“${w(3).hanzi}”是什么意思？`,
        py: `Zhōngwǔ de shíhou, péngyou wèn wǒ: "${w(2).pinyin}" hé "${w(3).pinyin}" shì shénme yìsi?`,
        th: `ตอนเที่ยง เพื่อนถามฉันว่า "${w(2).hanzi}" (${m(w(2))}) กับ "${w(3).hanzi}" (${m(w(3))}) แปลว่าอะไร?`,
        usedWords: [w(2).hanzi, w(3).hanzi]
      },
      {
        hz: `我马上告诉他，还用“${w(4).hanzi}”和“${w(5).hanzi}”造了一个句子。`,
        py: `Wǒ mǎshàng gàosu tā, hái yòng "${w(4).pinyin}" hé "${w(5).pinyin}" zào le yí gè jùzi.`,
        th: `ฉันรีบบอกเขาทันที แถมยังเอาคำว่า "${w(4).hanzi}" (${m(w(4))}) และ "${w(5).hanzi}" (${m(w(5))}) มาแต่งประโยคให้ดูด้วย`,
        usedWords: [w(4).hanzi, w(5).hanzi]
      },
      {
        hz: `下午复习的时候，我觉得“${w(6).hanzi}”和“${w(7).hanzi}”非常有用！`,
        py: `Xiàwǔ fùxí de shíhou, wǒ juéde "${w(6).pinyin}" hé "${w(7).pinyin}" fēicháng yǒuyòng!`,
        th: `ตอนบ่ายช่วงทบทวน ฉันรู้สึกว่าคำว่า "${w(6).hanzi}" (${m(w(6))}) และ "${w(7).hanzi}" (${m(w(7))}) มีประโยชน์มากจริงๆ!`,
        usedWords: [w(6).hanzi, w(7).hanzi]
      },
      {
        hz: `晚上我又听了一遍录音，现在这些词我都记住啦！`,
        py: `Wǎnshang wǒ yòu tīng le yí biàn lùyīn, xiànzài zhèxiē cí wǒ dōu jìzhù la!`,
        th: `ตอนเย็นฉันฟังเสียงทวนอีกรอบ ตอนนี้คำศัพท์พวกนี้ฉันจำได้หมดแล้ว!`,
        usedWords: []
      }
    ];
    return {
      title: `📖 บันทึกฝึกศัพท์วันนี้ (${words.slice(0, 4).map(x => x.hanzi).join(' · ')})`,
      sourceLabel: 'โหมดสร้างทันที (ออฟไลน์)',
      lines
    };
  }

  function highlightStoryWords(hz, words) {
    let out = escapeHtml(hz);
    const uniq = [...new Set(words.map(w => w.hanzi).filter(Boolean))].sort((a, b) => b.length - a.length);
    for (const term of uniq) {
      const esc = escapeHtml(term);
      out = out.split(esc).join(`<mark class="vst-mark">${esc}</mark>`);
    }
    return out;
  }

  function renderVocabStory() {
    const container = document.getElementById('vocab-story-view');
    if (!container) return;
    const st = state.vocabStory;
    const todayPool = getVocabQuizPool('today');
    const setPool = getVocabQuizPool('set');
    const allLearnedPool = getVocabQuizPool('all_learned');
    const curPool = getVocabQuizPool(st.source);

    const generateStory = async (useAi) => {
      if (curPool.length < 4) {
        showToast('ต้องมีคำศัพท์อย่างน้อย 4 คำ (ลองเลือกชุดปัจจุบัน 100 คำ)', '', false);
        return;
      }
      const picked = shuffleArray(curPool).slice(0, Math.min(8, curPool.length));
      st.words = picked;
      if (!useAi) {
        st.story = buildOfflineVocabStory(picked);
        renderVocabStory();
        return;
      }
      if (useAi && !authState.user) {
        showToast('กรุณาเข้าสู่ระบบก่อนสร้างนิทานด้วย AI (หรือใช้ปุ่มสร้างนิทานทันที)', 'LOGIN');
        openAuthModal();
        return;
      }
      st.busy = true;
      renderVocabStory();
      try {
        const res = await fetch('/api/ai/vocab-story', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ words: picked.map(w => ({ hanzi: w.hanzi, pinyin: w.pinyin, meaning: w.meaning })) })
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.ok && data.story && Array.isArray(data.story.lines)) {
          st.story = { ...data.story, sourceLabel: 'สร้างโดย AI Gemini' };
        } else {
          st.story = buildOfflineVocabStory(picked);
          showToast(data.error || 'AI ไม่พร้อมใช้งานชั่วคราว — ใช้โหมดสร้างนิทานทันทีให้แทนครับ', '', false);
        }
      } catch {
        st.story = buildOfflineVocabStory(picked);
        showToast('AI ไม่พร้อมใช้งานชั่วคราว — ใช้โหมดสร้างนิทานทันทีให้แทนครับ', '', false);
      } finally {
        st.busy = false;
        renderVocabStory();
      }
    };

    container.innerHTML = `
      <div class="vq-setup-card">
        <div class="vq-setup-head">
          <div>
            <h2 class="vq-title">📖 สร้างนิทานสั้นจากคำศัพท์ของคุณ</h2>
            <p class="vq-desc">สุ่มคำศัพท์ 8 คำมาแต่งเป็นเรื่องสั้นภาษาจีนพร้อมพินอิน เสียงอ่าน และคำแปล เพื่อฝึกจำในบริบทจริง</p>
          </div>
        </div>

        <div class="vq-source-grid" style="margin-bottom:14px">
          <button type="button" class="vq-source-btn ${st.source === 'today' ? 'active' : ''}" data-stsrc="today">
            <span class="vq-src-icon">📅</span><span><b>คำที่สะสมวันนี้</b><small>${todayPool.length} คำ</small></span>
          </button>
          <button type="button" class="vq-source-btn ${st.source === 'set' ? 'active' : ''}" data-stsrc="set">
            <span class="vq-src-icon">📦</span><span><b>ชุดปัจจุบัน (ชุดที่ ${state.vocabSet})</b><small>${setPool.length} คำ</small></span>
          </button>
          <button type="button" class="vq-source-btn ${st.source === 'all_learned' ? 'active' : ''}" data-stsrc="all_learned">
            <span class="vq-src-icon">🏆</span><span><b>คำที่สะสมทั้งหมด</b><small>${allLearnedPool.length.toLocaleString()} คำ</small></span>
          </button>
        </div>

        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <button type="button" class="btn-primary" id="vst-gen-instant" ${st.busy ? 'disabled' : ''}>⚡ สร้างนิทานทันที (8 คำ)</button>
          <button type="button" class="btn-secondary" id="vst-gen-ai" ${st.busy ? 'disabled' : ''}>${st.busy ? '⏳ กำลังแต่งนิทานด้วย AI...' : '✨ แต่งนิทานใหม่ด้วย AI'}</button>
        </div>

        ${st.story ? `
          <div class="vst-story-box">
            <div class="vst-story-head">
              <div>
                <h3 style="margin:0 0 2px">${escapeHtml(st.story.title)}</h3>
                <small style="color:var(--sys-label-2)">${escapeHtml(st.story.sourceLabel || '')}</small>
              </div>
              <div style="display:flex;gap:6px;flex-wrap:wrap">
                <button type="button" class="vb-chip ${st.showPy ? 'active' : ''}" id="vst-tog-py">พินอิน</button>
                <button type="button" class="vb-chip ${st.showTh ? 'active' : ''}" id="vst-tog-th">คำแปลไทย</button>
                <button type="button" class="btn-secondary" id="vst-play-all">🔊 ฟังทั้งเรื่อง</button>
              </div>
            </div>

            <div class="vst-word-pills">
              ${st.words.map(w => `<button type="button" class="vst-wpill" data-wdet="${w.id}"><span class="hanzi-font">${escapeHtml(w.hanzi)}</span> · ${escapeHtml(w.meaning.split(',')[0])}</button>`).join('')}
            </div>

            <div class="vst-lines">
              ${st.story.lines.map((ln, idx) => `
                <div class="vst-line">
                  <div class="vst-line-top">
                    <div class="vst-line-hz hanzi-font">${highlightStoryWords(ln.hz, st.words)}</div>
                    <button type="button" class="btn-speak-sm" data-ln-speak="${idx}">🔊 ฟัง</button>
                  </div>
                  ${st.showPy ? `<div class="vst-line-py">${escapeHtml(ln.py)}</div>` : ''}
                  ${st.showTh ? `<div class="vst-line-th">${escapeHtml(ln.th)}</div>` : ''}
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;

    container.querySelectorAll('[data-stsrc]').forEach(b => b.addEventListener('click', () => { st.source = b.dataset.stsrc; renderVocabStory(); }));
    document.getElementById('vst-gen-instant')?.addEventListener('click', () => generateStory(false));
    document.getElementById('vst-gen-ai')?.addEventListener('click', () => generateStory(true));
    document.getElementById('vst-tog-py')?.addEventListener('click', () => { st.showPy = !st.showPy; renderVocabStory(); });
    document.getElementById('vst-tog-th')?.addEventListener('click', () => { st.showTh = !st.showTh; renderVocabStory(); });
    container.querySelectorAll('[data-wdet]').forEach(b => b.addEventListener('click', () => openVocabDetailModal(Number(b.dataset.wdet))));
    container.querySelectorAll('[data-ln-speak]').forEach(b => {
      b.addEventListener('click', () => speak(st.story.lines[Number(b.dataset.lnSpeak)].hz));
    });
    document.getElementById('vst-play-all')?.addEventListener('click', () => {
      if (!st.story || !st.story.lines.length) return;
      let i = 0;
      const playLine = () => {
        if (i >= st.story.lines.length) return;
        speak(st.story.lines[i].hz, () => {
          i++;
          setTimeout(playLine, 500);
        });
      };
      playLine();
    });
  }

  // ---- FEATURE: Hands-Free Podcast Audio Loop (ZH -> Pause -> TH -> ZH) ----
  function speakThai(text, onEnd) {
    const clean = String(text || '').trim();
    if (!clean) {
      if (onEnd) onEnd();
      return;
    }
    stopSpeech();
    const seq = speakSeq;
    if (!thVoice) pickZhVoice();
    if (IS_IOS_DEVICE) {
      speakViaWebSpeech(clean, 'th-TH', 1.0, thVoice, seq, onEnd, () => {
        if (onEnd) onEnd();
      }, true);
      return;
    }
    playServerTts(clean, 'th-TH', 1.0, seq, onEnd, () => {
      if ('speechSynthesis' in window) {
        speakViaWebSpeech(clean, 'th-TH', 1.0, thVoice, seq, onEnd, () => {
          if (onEnd) onEnd();
        });
      } else if (onEnd) {
        onEnd();
      }
    });
  }

  function stopVocabPodcast() {
    const pc = state.vocabPodcast;
    pc.playing = false;
    if (pc.timerId) {
      clearTimeout(pc.timerId);
      pc.timerId = null;
    }
    stopSpeech();
  }

  function runVocabPodcastStep() {
    const pc = state.vocabPodcast;
    if (!pc.playing) return;
    if (!pc.items.length) {
      stopVocabPodcast();
      renderVocabPodcast();
      return;
    }
    if (pc.idx >= pc.items.length) {
      if (pc.loop) {
        pc.idx = 0;
      } else {
        stopVocabPodcast();
        showToast('เล่น Podcast ครบชุดแล้ว!', '', false);
        renderVocabPodcast();
        return;
      }
    }
    const word = pc.items[pc.idx];
    renderVocabPodcast();

    const finishWord = () => {
      if (!pc.playing) return;
      pc.timerId = setTimeout(() => {
        if (!pc.playing) return;
        pc.idx++;
        runVocabPodcastStep();
      }, 900);
    };

    const afterThai = () => {
      if (!pc.playing) return;
      if (pc.repeatZh) {
        pc.timerId = setTimeout(() => {
          if (!pc.playing) return;
          speak(word.hanzi, finishWord);
        }, 450);
      } else {
        finishWord();
      }
    };

    speak(word.hanzi, () => {
      if (!pc.playing) return;
      if (pc.readThai) {
        pc.timerId = setTimeout(() => {
          if (!pc.playing) return;
          const shortTh = word.meaning.split(',')[0].trim();
          speakThai(shortTh, afterThai);
        }, 1200);
      } else {
        afterThai();
      }
    });
  }

  function renderVocabPodcast() {
    const container = document.getElementById('vocab-podcast-view');
    if (!container) return;
    const pc = state.vocabPodcast;
    const todayPool = getVocabQuizPool('today');
    const setPool = getVocabQuizPool('set');
    const starredPool = getVocabQuizPool('starred');
    const allLearnedPool = getVocabQuizPool('all_learned');
    const pool = getVocabQuizPool(pc.source);

    if (!pc.playing) {
      pc.items = pool;
      if (pc.idx >= pc.items.length) pc.idx = 0;
    }
    const cur = pc.items[pc.idx] || null;

    container.innerHTML = `
      <div class="vq-setup-card">
        <div class="vq-setup-head">
          <div>
            <h2 class="vq-title">🎧 Podcast ฟังคำศัพท์ตอนเดินทาง (Hands-Free)</h2>
            <p class="vq-desc">ระบบจะอ่าน <b>เสียงจีน → เว้น 1.2 วิให้นึก → อ่านคำแปลไทย → ย้ำเสียงจีนอีกครั้ง</b> วนต่อเนื่องโดยไม่ต้องมองจอ</p>
          </div>
        </div>

        <div class="vq-source-grid" style="margin-bottom:16px">
          <button type="button" class="vq-source-btn ${pc.source === 'today' ? 'active' : ''}" data-pcsrc="today">
            <span class="vq-src-icon">📅</span><span><b>คำที่สะสมวันนี้</b><small>${todayPool.length} คำ</small></span>
          </button>
          <button type="button" class="vq-source-btn ${pc.source === 'set' ? 'active' : ''}" data-pcsrc="set">
            <span class="vq-src-icon">📦</span><span><b>ชุดปัจจุบัน (ชุดที่ ${state.vocabSet})</b><small>${setPool.length} คำ</small></span>
          </button>
          <button type="button" class="vq-source-btn ${pc.source === 'starred' ? 'active' : ''}" data-pcsrc="starred">
            <span class="vq-src-icon">⭐</span><span><b>คำที่ปักหมุด</b><small>${starredPool.length} คำ</small></span>
          </button>
          <button type="button" class="vq-source-btn ${pc.source === 'all_learned' ? 'active' : ''}" data-pcsrc="all_learned">
            <span class="vq-src-icon">🏆</span><span><b>คำที่สะสมทั้งหมด</b><small>${allLearnedPool.length.toLocaleString()} คำ</small></span>
          </button>
        </div>

        ${cur ? `
          <div class="vpc-player">
            <div class="vpc-counter tabular-nums">คำที่ <b>${pc.idx + 1}</b> / ${pc.items.length} ${pc.playing ? '· 🔊 กำลังเล่น...' : ''}</div>
            <div class="podcast-word-hz hanzi-font">${escapeHtml(cur.hanzi)}</div>
            <div class="podcast-word-py">${escapeHtml(cur.pinyin)}</div>
            <div class="podcast-word-th">${escapeHtml(cur.meaning)}</div>

            <div class="podcast-controls">
              <button type="button" class="btn-secondary" id="vpc-prev">⏮ ก่อนหน้า</button>
              <button type="button" class="btn-primary" id="vpc-toggle" style="min-width:140px">${pc.playing ? '⏸ หยุดพัก' : '▶ เริ่มเล่น Podcast'}</button>
              <button type="button" class="btn-secondary" id="vpc-next">ถัดไป ⏭</button>
            </div>

            <div class="vpc-opts">
              <label class="vq-toggle-label"><input type="checkbox" id="vpc-opt-th" ${pc.readThai ? 'checked' : ''}><span>อ่านคำแปลไทยด้วย</span></label>
              <label class="vq-toggle-label"><input type="checkbox" id="vpc-opt-rep" ${pc.repeatZh ? 'checked' : ''}><span>อ่านเสียงจีนย้ำอีกรอบ</span></label>
              <label class="vq-toggle-label"><input type="checkbox" id="vpc-opt-loop" ${pc.loop ? 'checked' : ''}><span>วนซ้ำเมื่อครบชุด</span></label>
            </div>
          </div>
        ` : `
          <div class="vq-warn">ยังไม่มีคำศัพท์ในแหล่งนี้ — ลองเลือก <b>ชุดปัจจุบัน (ชุดที่ ${state.vocabSet})</b> เพื่อเริ่มฟังได้ทันทีครับ</div>
        `}
      </div>
    `;

    container.querySelectorAll('[data-pcsrc]').forEach(btn => {
      btn.addEventListener('click', () => {
        stopVocabPodcast();
        pc.source = btn.dataset.pcsrc;
        pc.idx = 0;
        renderVocabPodcast();
      });
    });
    document.getElementById('vpc-opt-th')?.addEventListener('change', (e) => { pc.readThai = e.target.checked; });
    document.getElementById('vpc-opt-rep')?.addEventListener('change', (e) => { pc.repeatZh = e.target.checked; });
    document.getElementById('vpc-opt-loop')?.addEventListener('change', (e) => { pc.loop = e.target.checked; });
    document.getElementById('vpc-prev')?.addEventListener('click', () => {
      const wasPlaying = pc.playing;
      stopVocabPodcast();
      pc.idx = (pc.idx - 1 + pc.items.length) % pc.items.length;
      if (wasPlaying) { pc.playing = true; runVocabPodcastStep(); } else { renderVocabPodcast(); }
    });
    document.getElementById('vpc-next')?.addEventListener('click', () => {
      const wasPlaying = pc.playing;
      stopVocabPodcast();
      pc.idx = (pc.idx + 1) % pc.items.length;
      if (wasPlaying) { pc.playing = true; runVocabPodcastStep(); } else { renderVocabPodcast(); }
    });
    document.getElementById('vpc-toggle')?.addEventListener('click', () => {
      if (pc.playing) {
        stopVocabPodcast();
        renderVocabPodcast();
      } else {
        pc.items = getVocabQuizPool(pc.source);
        if (!pc.items.length) return;
        pc.playing = true;
        runVocabPodcastStep();
      }
    });
  }

  // ---- FEATURE: Stats Heatmap & JSON Backup/Restore ----
  function renderVocabStats() {
    const container = document.getElementById('vocab-stats-view');
    if (!container) return;

    const all = getVocabIndex();
    const learnedMap = state.progress.vocabLearned || {};
    const goal = state.progress.vocabGoal || 100;
    const byDate = {};
    for (const id in learnedMap) {
      const d = learnedMap[id];
      byDate[d] = (byDate[d] || 0) + 1;
    }

    // Build last 42 days (6 weeks) heatmap
    const days = [];
    for (let offset = -41; offset <= 0; offset++) {
      const dk = todayKey(offset);
      const cnt = byDate[dk] || 0;
      let lvl = 0;
      if (cnt >= goal) lvl = 4;
      else if (cnt >= Math.round(goal * 0.5)) lvl = 3;
      else if (cnt >= Math.round(goal * 0.2)) lvl = 2;
      else if (cnt > 0) lvl = 1;
      days.push({ dk, cnt, lvl });
    }

    // Per-HSK level progress
    const lvTotals = {};
    const lvDone = {};
    all.forEach(w => {
      lvTotals[w.level] = (lvTotals[w.level] || 0) + 1;
      if (learnedMap[w.id]) lvDone[w.level] = (lvDone[w.level] || 0) + 1;
    });

    const totalLearned = getVocabTotalLearned();
    const doneDays = getVocabCompletedDays();
    const starredCount = (state.progress.vocabStarred || []).length;

    container.innerHTML = `
      <div class="vq-setup-card" style="max-width:860px">
        <div class="vq-setup-head">
          <div>
            <h2 class="vq-title">📊 สถิติการสะสมคำศัพท์ & สำรองข้อมูล</h2>
            <p class="vq-desc">ติดตามวินัยการสะสมคำศัพท์ย้อนหลัง 6 สัปดาห์ พร้อมสำรอง/กู้คืนไฟล์ข้อมูลเผื่อย้ายเครื่อง</p>
          </div>
        </div>

        <div class="vsrs-kpi-row" style="max-width:none">
          <div class="vsrs-kpi"><span>สะสมแล้วทั้งหมด</span><strong class="tabular-nums">${totalLearned.toLocaleString()} คำ</strong></div>
          <div class="vsrs-kpi"><span>พิชิตเป้า ${goal} คำ/วัน</span><strong class="tabular-nums">${doneDays} วัน</strong></div>
          <div class="vsrs-kpi"><span>⭐ คำที่ปักหมุด</span><strong class="tabular-nums">${starredCount} คำ</strong></div>
          <div class="vsrs-kpi"><span>ทำควิซทวนแล้ว</span><strong class="tabular-nums">${state.progress.vocabQuizCount || 0} ครั้ง</strong></div>
        </div>

        <div class="vq-section-label">ปฏิทินการสะสมคำศัพท์ย้อนหลัง 42 วัน</div>
        <div class="vst-heatmap">
          ${days.map(d => `
            <div class="vst-hm-cell lv-${d.lvl}" title="${d.dk}: สะสม ${d.cnt} คำ">
              <span class="vst-hm-day">${d.dk.slice(8)}</span>
              ${d.cnt > 0 ? `<small class="tabular-nums">${d.cnt}</small>` : ''}
            </div>
          `).join('')}
        </div>
        <div class="vst-hm-legend">
          <span>น้อย</span>
          <i class="lv-0"></i><i class="lv-1"></i><i class="lv-2"></i><i class="lv-3"></i><i class="lv-4"></i>
          <span>ครบเป้า ${goal}+ คำ</span>
        </div>

        <div class="vq-section-label" style="margin-top:20px">ความคืบหน้าแยกตามระดับ HSK</div>
        <div class="vst-hsk-bars">
          ${[1, 2, 3, 4, 5, 6, 7].map(lv => {
            const tot = lvTotals[lv] || 1;
            const dn = lvDone[lv] || 0;
            const p = Math.round((dn / tot) * 100);
            return `
              <div class="vst-hsk-row">
                <span class="vb-hsk-tag lv-${lv}">HSK ${lv === 7 ? '7+' : lv}</span>
                <div class="progress-track" style="height:8px;flex:1"><div class="progress-fill" style="width:${p}%"></div></div>
                <span class="tabular-nums vst-hsk-num">${dn.toLocaleString()} / ${tot.toLocaleString()} (${p}%)</span>
              </div>
            `;
          }).join('')}
        </div>

        <div class="vst-backup-box">
          <div>
            <h4 style="margin:0 0 4px">💾 สำรอง & กู้คืนข้อมูลความคืบหน้า (.json)</h4>
            <p style="margin:0;font-size:12.5px;color:var(--sys-label-2)">ดาวน์โหลดเก็บไว้ในเครื่องหรือ Google Drive/OneDrive เพื่อย้ายเครื่องหรือป้องกันข้อมูลหายตอนล้างเบราว์เซอร์</p>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button type="button" class="btn-primary" id="vst-export-btn">⬇ Export Backup (.json)</button>
            <label class="btn-secondary" style="cursor:pointer;display:inline-flex;align-items:center">
              ⬆ Import Backup
              <input type="file" id="vst-import-input" accept="application/json,.json" hidden>
            </label>
          </div>
        </div>
      </div>
    `;

    document.getElementById('vst-export-btn')?.addEventListener('click', () => {
      const payload = {
        app: 'nihao-learning-platform',
        exportedAt: new Date().toISOString(),
        progress: state.progress
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nihao-backup-${todayKey()}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      showToast('ดาวน์โหลดไฟล์สำรองข้อมูลเรียบร้อยแล้ว!', '', false);
    });

    document.getElementById('vst-import-input')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result || '{}'));
          const incoming = parsed.progress && typeof parsed.progress === 'object' ? parsed.progress : parsed;
          if (!incoming || typeof incoming !== 'object') throw new Error('Invalid format');
          state.progress = { ...state.progress, ...incoming };
          ensureTodayDaily(state.progress);
          saveProgress('กู้คืนข้อมูล Backup สำเร็จ!');
          playChime('levelup');
          renderVocabStats();
          updateVocabSrsBadge();
        } catch {
          showToast('ไฟล์ Backup ไม่ถูกต้อง กรุณาเลือกไฟล์ .json ที่ส่งออกจากแอปนี้', '', false);
        }
      };
      reader.readAsText(file);
    });
  }

  // ---- FEATURE: Confusable Pairs (คำคล้าย & คำชวนสับสน) ----
  const CONFUSABLE_GROUPS = [
    {
      type: 'หน้าตาคล้าย',
      tip: '卖 (ขาย) มีเครื่องหมาย 十 (สิบ/บวกเงิน) อยู่ด้านบน เหมือนบวกกำไรเพิ่ม!',
      items: [
        { hz: '买', py: 'mǎi', th: 'ซื้อ' },
        { hz: '卖', py: 'mài', th: 'ขาย' }
      ]
    },
    {
      type: 'หน้าตาคล้าย',
      tip: '大 (คนกางแขน = ใหญ่), 太 (มีจุดเล็กๆ ข้างล่าง = เกินไป), 天 (มีขีดบนหัว = ท้องฟ้า/วัน)',
      items: [
        { hz: '大', py: 'dà', th: 'ใหญ่' },
        { hz: '太', py: 'tài', th: 'เกินไป' },
        { hz: '天', py: 'tiān', th: 'วัน / ท้องฟ้า' }
      ]
    },
    {
      type: 'หน้าตาคล้าย',
      tip: '午 (เที่ยง) หัวไม่ทะลุ, 牛 (วัว) หัวทะลุขึ้นข้างบนเหมือนเขาวัว!',
      items: [
        { hz: '午', py: 'wǔ', th: 'เที่ยง (中午)' },
        { hz: '牛', py: 'niú', th: 'วัว (牛奶)' }
      ]
    },
    {
      type: 'หน้าตาคล้าย',
      tip: '人 (ซ้ายสั้นขวาพิง = คน), 入 (ซ้ายยาวขวาครอบ = เข้า), 八 (แยกกัน = แปด)',
      items: [
        { hz: '人', py: 'rén', th: 'คน' },
        { hz: '入', py: 'rù', th: 'เข้า' },
        { hz: '八', py: 'bā', th: 'แปด' }
      ]
    },
    {
      type: 'หน้าตาคล้าย',
      tip: '日 (1 ขีดกลาง = ดวงอาทิตย์/วัน), 目 (2 ขีดกลาง = ดวงตา), 白 (มีติ่งบนหัว = สีขาว)',
      items: [
        { hz: '日', py: 'rì', th: 'วัน / ดวงอาทิตย์' },
        { hz: '目', py: 'mù', th: 'ดวงตา / รายการ' },
        { hz: '白', py: 'bái', th: 'สีขาว' }
      ]
    },
    {
      type: 'หน้าตาคล้าย (ชุด 青)',
      tip: 'ดูหมวดซ้าย: 讠พูด = 请 เชิญ, 氵น้ำ = 清 ใสสะอาด, 忄ใจ = 情 อารมณ์, 日แดด = 晴 แดดออก',
      items: [
        { hz: '请', py: 'qǐng', th: 'เชิญ / กรุณา' },
        { hz: '清', py: 'qīng', th: 'ใส / ชัดเจน' },
        { hz: '情', py: 'qíng', th: 'อารมณ์ / ความรัก' },
        { hz: '晴', py: 'qíng', th: 'แดดออก / แจ่มใส' }
      ]
    },
    {
      type: 'หน้าตาคล้าย (ชุด 门)',
      tip: 'ประตู 门 + ปาก 口 = 问 (ถาม), ประตู 门 + พระอาทิตย์ 日 = 间 (ห้อง/ระหว่าง), ประตู 门 + หู 耳 = 闻 (ได้ยิน/ข่าว)',
      items: [
        { hz: '问', py: 'wèn', th: 'ถาม' },
        { hz: '间', py: 'jiān', th: 'ห้อง / ระหว่าง' },
        { hz: '闻', py: 'wén', th: 'ได้ยิน / ข่าว (新闻)' }
      ]
    },
    {
      type: 'หน้าตาคล้าย',
      tip: '喝 มี 口 (ปาก) อยู่ซ้าย = ดื่ม, 渴 มี 氵 (น้ำ) อยู่ซ้าย = กระหายน้ำ!',
      items: [
        { hz: '喝', py: 'hē', th: 'ดื่ม' },
        { hz: '渴', py: 'kě', th: 'กระหายน้ำ' }
      ]
    },
    {
      type: 'หน้าตาคล้าย',
      tip: '木 (ต้นไม้), 本 (ขีดที่โคนต้น = ราก/สมุด/เล่ม), 休 (คน 亻 พิงต้นไม้ 木 = พักผ่อน)',
      items: [
        { hz: '木', py: 'mù', th: 'ไม้ / ต้นไม้' },
        { hz: '本', py: 'běn', th: 'เล่ม / สมุด' },
        { hz: '休', py: 'xiū', th: 'พักผ่อน (休息)' }
      ]
    },
    {
      type: 'หน้าตาคล้าย',
      tip: '己 (เปิดสนิท = ตัวเอง 自己), 已 (ปิดครึ่งเดียว = แล้ว 已经)',
      items: [
        { hz: '己', py: 'jǐ', th: 'ตัวเอง (自己)' },
        { hz: '已', py: 'yǐ', th: 'แล้ว (已经)' }
      ]
    },
    {
      type: 'หน้าตาคล้าย',
      tip: '土 (ขีดล่างยาว = ดิน), 士 (ขีดบนยาว = บัณฑิต/ทหาร)',
      items: [
        { hz: '土', py: 'tǔ', th: 'ดิน / พื้นดิน' },
        { hz: '士', py: 'shì', th: 'บัณฑิต / พยาบาล (护士)' }
      ]
    },
    {
      type: 'เสียงคล้าย',
      tip: 'ระวังเสียงม้วนลิ้น sh- กับไม่ม้วนลิ้น s-: 是 (shì ม้วนลิ้น) vs 四 (sì ไม่ม้วนลิ้น)',
      items: [
        { hz: '是', py: 'shì', th: 'เป็น / คือ / ใช่' },
        { hz: '四', py: 'sì', th: 'เลขสี่ (4)' },
        { hz: '十', py: 'shí', th: 'เลขสิบ (10)' }
      ]
    },
    {
      type: 'เสียงคล้าย',
      tip: 'เสียงเหมือนกันเป๊ะ แต่วรรณยุกต์ต่าง! 睡觉 (shuìjiào เสียง 4-4 = นอน) vs 水饺 (shuǐjiǎo เสียง 3-3 = เกี๊ยวต้ม)',
      items: [
        { hz: '睡觉', py: 'shuì jiào', th: 'นอนหลับ' },
        { hz: '水饺', py: 'shuǐ jiǎo', th: 'เกี๊ยวต้ม' }
      ]
    },
    {
      type: 'เสียงคล้าย',
      tip: '早 (zǎo ไม่ม้วนลิ้น = เช้า) vs 找 (zhǎo ม้วนลิ้น = หา)',
      items: [
        { hz: '早', py: 'zǎo', th: 'เช้า / เร็ว' },
        { hz: '找', py: 'zhǎo', th: 'หา / ตามหา' }
      ]
    }
  ];

  function startConfusableQuiz() {
    const cq = state.confusableQuiz;
    const qs = shuffleArray(CONFUSABLE_GROUPS).slice(0, 10).map(grp => {
      const target = grp.items[Math.floor(Math.random() * grp.items.length)];
      return { grp, target, choices: shuffleArray(grp.items) };
    });
    cq.active = true;
    cq.idx = 0;
    cq.score = 0;
    cq.answered = false;
    cq.picked = -1;
    cq.questions = qs;
    renderVocabConfusable();
  }

  function renderVocabConfusable() {
    const container = document.getElementById('vocab-confusable-view');
    if (!container) return;
    const cq = state.confusableQuiz;

    if (cq.active) {
      if (cq.idx >= cq.questions.length) {
        const pct = Math.round((cq.score / cq.questions.length) * 100);
        container.innerHTML = `
          <div class="vq-result-card">
            <div class="vq-grade-pill ${pct >= 80 ? 'grade-a' : 'grade-b'}">🧠 จบด่านปราบคำคล้าย!</div>
            <div class="vq-score-big tabular-nums">${cq.score} / ${cq.questions.length}</div>
            <div class="vq-score-sub">ความแม่นยำ <b>${pct}%</b></div>
            <div class="vq-result-actions">
              <button type="button" class="btn-primary" id="vcf-again">🔁 เล่นด่านคำคล้ายอีกครั้ง</button>
              <button type="button" class="btn-secondary" id="vcf-back">← ดูตารางคำคล้ายทั้งหมด</button>
            </div>
          </div>
        `;
        document.getElementById('vcf-again')?.addEventListener('click', startConfusableQuiz);
        document.getElementById('vcf-back')?.addEventListener('click', () => { cq.active = false; renderVocabConfusable(); });
        return;
      }

      const q = cq.questions[cq.idx];
      container.innerHTML = `
        <div class="vq-play-card">
          <div class="vq-top-bar">
            <button type="button" class="btn-secondary vq-exit-btn" id="vcf-exit">✕ ออก</button>
            <div class="vq-meta-pills tabular-nums">
              <span>ข้อ <b>${cq.idx + 1}</b> / ${cq.questions.length}</span>
              <span>ถูก <b>${cq.score}</b></span>
            </div>
          </div>
          <div class="vq-prompt-box" style="margin-top:12px">
            <div class="vq-mode-tag">🧠 เลือกตัวจีนที่ตรงกับความหมายนี้ (ระวังตัวหลอก!)</div>
            <div class="vq-prompt-th">${escapeHtml(q.target.th)}</div>
            <button type="button" class="btn-secondary vq-audio-btn" id="vcf-speak" style="margin-top:8px">🔊 ฟังเสียงใบ้</button>
          </div>
          <div class="vq-choices">
            ${q.choices.map((c, ci) => {
              let cls = 'vq-choice-btn';
              if (cq.answered) {
                if (c.hz === q.target.hz) cls += ' is-correct';
                else if (ci === cq.picked) cls += ' is-wrong';
              }
              return `
                <button type="button" class="${cls}" data-cfpick="${ci}" ${cq.answered ? 'disabled' : ''}>
                  <span class="vq-ch-num">${ci + 1}</span>
                  <span class="vq-ch-body">
                    <span class="vq-ch-hz hanzi-font">${escapeHtml(c.hz)}</span>
                    ${cq.answered ? `<span class="vq-ch-py">${escapeHtml(c.py)} · ${escapeHtml(c.th)}</span>` : ''}
                  </span>
                </button>
              `;
            }).join('')}
          </div>
          ${cq.answered ? `
            <div class="vq-feedback ${q.choices[cq.picked]?.hz === q.target.hz ? 'ok' : 'err'}">
              <div>💡 ${escapeHtml(q.grp.tip)}</div>
              <button type="button" class="btn-primary" id="vcf-next">${cq.idx + 1 >= cq.questions.length ? 'ดูคะแนน →' : 'ข้อถัดไป →'}</button>
            </div>
          ` : ''}
        </div>
      `;
      document.getElementById('vcf-exit')?.addEventListener('click', () => { cq.active = false; renderVocabConfusable(); });
      document.getElementById('vcf-speak')?.addEventListener('click', () => speak(q.target.hz));
      container.querySelectorAll('[data-cfpick]').forEach(btn => {
        btn.addEventListener('click', () => {
          if (cq.answered) return;
          cq.answered = true;
          cq.picked = Number(btn.dataset.cfpick);
          if (q.choices[cq.picked].hz === q.target.hz) {
            cq.score++;
            playChime('ok');
          } else {
            playChime('err');
          }
          renderVocabConfusable();
        });
      });
      document.getElementById('vcf-next')?.addEventListener('click', () => {
        cq.idx++;
        cq.answered = false;
        cq.picked = -1;
        if (cq.idx >= cq.questions.length) {
          state.progress.bonusXp = (state.progress.bonusXp || 0) + cq.score * 6;
          if (cq.score >= 8) spawnConfetti(28);
          saveProgress(`จบด่านแยกคำคล้าย ${cq.score}/${cq.questions.length}`);
        }
        renderVocabConfusable();
      });
      return;
    }

    container.innerHTML = `
      <div class="vq-setup-card" style="max-width:900px">
        <div class="vq-setup-head">
          <div>
            <h2 class="vq-title">🧠 โหมดปราบคำคล้าย & คำชวนสับสน (${CONFUSABLE_GROUPS.length} ชุดยอดฮิต)</h2>
            <p class="vq-desc">เปรียบเทียบตัวจีนหน้าตาคล้ายและเสียงคล้ายที่คนเรียนมักจำสลับกันบ่อยที่สุด พร้อมทริคแยกความต่าง</p>
          </div>
          <button type="button" class="btn-primary" id="vcf-start-quiz">🎯 ทำควิซแยกคำคล้าย (10 ข้อ)</button>
        </div>

        <div class="vcf-grid">
          ${CONFUSABLE_GROUPS.map(g => `
            <div class="vcf-card">
              <div class="vcf-type-tag">${escapeHtml(g.type)}</div>
              <div class="vcf-pair-row">
                ${g.items.map(it => `
                  <button type="button" class="vcf-item" data-speak="${escapeHtml(it.hz)}" title="กดฟังเสียง">
                    <span class="vcf-hz hanzi-font">${escapeHtml(it.hz)}</span>
                    <span class="vcf-py">${escapeHtml(it.py)}</span>
                    <span class="vcf-th">${escapeHtml(it.th)}</span>
                  </button>
                `).join('')}
              </div>
              <div class="vcf-tip">💡 ${escapeHtml(g.tip)}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    document.getElementById('vcf-start-quiz')?.addEventListener('click', startConfusableQuiz);
    container.querySelectorAll('[data-speak]').forEach(btn => {
      btn.addEventListener('click', () => speak(btn.dataset.speak));
    });
  }

  function renderVocab() {
    if (!LEXICON.length && state.vocabMode !== 'level1') {
      const bankEl = document.getElementById('vocab-bank-view');
      if (bankEl) {
        bankEl.hidden = false;
        bankEl.innerHTML = `<div class="vb-empty">กำลังโหลดคลังคำศัพท์ HSK 10,969 คำ...</div>`;
      }
      ensureLexiconLoaded().then((loaded) => {
        if (loaded.length > 0) renderVocab();
        else if (bankEl) bankEl.innerHTML = `<div class="vb-empty">ไม่สามารถโหลดคลังคำศัพท์ได้ กรุณารีเฟรชหน้าเว็บ</div>`;
      });
      return;
    }
    updateVocabSrsBadge();
    const modeTabs = document.getElementById('vocab-mode-tabs');
    if (modeTabs) {
      modeTabs.querySelectorAll('[data-vmode]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.vmode === state.vocabMode);
        btn.onclick = () => {
          stopVocabAutoPlay();
          stopVocabGameTimers();
          stopVocabPodcast();
          state.vocabMode = btn.dataset.vmode;
          renderVocab();
        };
      });
    }

    const bankEl = document.getElementById('vocab-bank-view');
    const srsEl = document.getElementById('vocab-srs-view');
    const quizEl = document.getElementById('vocab-quiz-view');
    const gamesEl = document.getElementById('vocab-games-view');
    const podcastEl = document.getElementById('vocab-podcast-view');
    const storyEl = document.getElementById('vocab-story-view');
    const confEl = document.getElementById('vocab-confusable-view');
    const statsEl = document.getElementById('vocab-stats-view');
    const l1El = document.getElementById('vocab-level1-view');

    if (bankEl) bankEl.hidden = state.vocabMode !== 'bank';
    if (srsEl) srsEl.hidden = state.vocabMode !== 'srs';
    if (quizEl) quizEl.hidden = state.vocabMode !== 'quiz';
    if (gamesEl) gamesEl.hidden = state.vocabMode !== 'games';
    if (podcastEl) podcastEl.hidden = state.vocabMode !== 'podcast';
    if (storyEl) storyEl.hidden = state.vocabMode !== 'story';
    if (confEl) confEl.hidden = state.vocabMode !== 'confusable';
    if (statsEl) statsEl.hidden = state.vocabMode !== 'stats';
    if (l1El) l1El.hidden = state.vocabMode !== 'level1';

    if (state.vocabMode === 'bank') {
      renderVocabBank();
    } else if (state.vocabMode === 'srs') {
      renderVocabSrs();
    } else if (state.vocabMode === 'quiz') {
      renderVocabQuiz();
    } else if (state.vocabMode === 'games') {
      renderVocabGames();
    } else if (state.vocabMode === 'podcast') {
      renderVocabPodcast();
    } else if (state.vocabMode === 'story') {
      renderVocabStory();
    } else if (state.vocabMode === 'confusable') {
      renderVocabConfusable();
    } else if (state.vocabMode === 'stats') {
      renderVocabStats();
    } else {
      renderVocabLevel1Packs();
    }
  }

  // ---- 60-Minute Study Timer State ----
  const timerState = { seconds: 60 * 60, running: false, intervalId: null };

  function formatTimer(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  function updateTimerDisplay() {
    const clock = document.getElementById('study-timer-clock');
    const toggleBtn = document.getElementById('study-timer-toggle');
    if (clock) clock.textContent = formatTimer(timerState.seconds);
    if (toggleBtn) toggleBtn.textContent = timerState.running ? 'หยุดชั่วคราว' : 'เริ่มจับเวลา';
  }

  function stopStudyTimer() {
    if (timerState.intervalId) {
      clearInterval(timerState.intervalId);
      timerState.intervalId = null;
    }
    timerState.running = false;
    updateTimerDisplay();
  }

  function toggleStudyTimer() {
    if (timerState.running) {
      stopStudyTimer();
      return;
    }
    if (timerState.seconds <= 0) timerState.seconds = 60 * 60;
    timerState.running = true;
    timerState.intervalId = setInterval(() => {
      if (timerState.seconds > 0) {
        timerState.seconds--;
        updateTimerDisplay();
      } else {
        stopStudyTimer();
      }
    }, 1000);
    updateTimerDisplay();
  }

  // ---- MODULE 0: 14-Day Intensive 60-Min Study Plan & Daily Quizzes ----
  function renderDailyPlan() {
    const sidebar = document.getElementById('plan-sidebar');
    const recommendedDay = (PLAN.find(d => (state.progress.dayScores[d.day] || 0) < DAILY_PASS_SCORE) || PLAN[PLAN.length - 1]).day;

    const renderWeek = (weekNum, label) => {
      const days = PLAN.filter(d => d.week === weekNum);
      return `
        <div class="week-label">${label}</div>
        <div class="day-list">
          ${days.map(d => {
            const best = state.progress.dayScores[d.day];
            const passed = best !== undefined && best >= DAILY_PASS_SCORE;
            const active = state.selectedDay === d.day;
            const isNow = d.day === recommendedDay && !passed;
            return `
              <button type="button" class="day-item ${active ? 'active' : ''} ${passed ? 'passed' : ''}" data-day="${d.day}">
                <span class="day-num">${passed ? '✓' : 'D' + d.day}</span>
                <span class="day-item-body">
                  <b>Day ${d.day}: ${escapeHtml(d.title)}</b>
                  <span>60 นาที · สอบ ${d.quiz.length} ข้อ</span>
                </span>
                ${passed
                  ? `<span class="day-badge-score">${best}/${d.quiz.length}</span>`
                  : isNow
                    ? '<span class="day-badge-now">วันนี้</span>'
                    : best !== undefined
                      ? `<span class="day-badge-now">${best}/${d.quiz.length}</span>`
                      : ''}
              </button>
            `;
          }).join('')}
        </div>
      `;
    };

    sidebar.innerHTML =
      renderWeek(1, 'สัปดาห์ที่ 1 · พยัญชนะ สระเดี่ยว วรรณยุกต์') +
      renderWeek(2, 'สัปดาห์ที่ 2 · ม้วนลิ้น สระประสม ผันเสียง & สอบจบ');

    sidebar.querySelectorAll('[data-day]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.selectedDay = Number(btn.dataset.day);
        state.dailyQuiz = { idx: 0, score: 0, answered: false, started: false };
        renderDailyPlan();
      });
    });

    renderDailyMain();
  }

  function renderDailyMain() {
    const dayObj = PLAN.find(d => d.day === state.selectedDay) || PLAN[0];
    const best = state.progress.dayScores[dayObj.day];
    const checks = state.progress.dayChecks[dayObj.day] || [];
    const mainEl = document.getElementById('plan-main');
    const doneMins = dayObj.blocks.reduce((sum, b, idx) => sum + (checks.includes(idx) ? b.min : 0), 0);

    mainEl.innerHTML = `
      <div class="day-hero-card">
        <div class="day-meta-row">
          <span class="day-pill">Day ${dayObj.day} / 14 · สัปดาห์ที่ ${dayObj.week}</span>
          <span class="day-duration tabular-nums">ทำไปแล้ว ${doneMins} / 60 นาที${best !== undefined ? ` · คะแนนสูงสุด ${best}/${dayObj.quiz.length}` : ''}</span>
        </div>
        <h3>${escapeHtml(dayObj.title)}</h3>
        <p class="day-goal">เป้าหมายวันนี้: ${escapeHtml(dayObj.goal)}</p>

        <!-- Built-in 60-Min Study Timer -->
        <div class="timer-bar">
          <div class="timer-left">
            <span class="timer-clock tabular-nums" id="study-timer-clock">${formatTimer(timerState.seconds)}</span>
            <span class="timer-label">จับเวลาเรียน</span>
          </div>
          <div class="timer-actions">
            <button type="button" class="btn-secondary" data-preset="10">10 น.</button>
            <button type="button" class="btn-secondary" data-preset="15">15 น.</button>
            <button type="button" class="btn-secondary" data-preset="60">60 น.</button>
            <button type="button" class="btn-primary" id="study-timer-toggle">${timerState.running ? 'หยุดชั่วคราว' : 'เริ่มจับเวลา'}</button>
            <button type="button" class="btn-secondary" id="study-timer-reset">รีเซ็ต</button>
          </div>
        </div>

        <div style="font-size:13px;font-weight:600;color:var(--sys-label-2);margin-bottom:8px">ตารางฝึกเข้มข้น 60 นาที (5 ช่วง · ติ๊กเมื่อทำเสร็จแต่ละช่วง)</div>
        <div class="checklist-box">
          ${dayObj.blocks.map((blk, idx) => {
            const checked = checks.includes(idx);
            return `
              <div class="block-row ${checked ? 'done' : ''}">
                <label class="block-left">
                  <input type="checkbox" data-check-idx="${idx}" ${checked ? 'checked' : ''}>
                  <div>
                    <div class="block-meta">
                      <span class="block-time">${blk.min} นาที</span>
                      <span class="block-phase">${escapeHtml(blk.phase)}</span>
                    </div>
                    <p class="block-text">${escapeHtml(blk.text)}</p>
                    <div class="block-target">เป้าผ่านช่วงนี้: ${escapeHtml(blk.target)}</div>
                  </div>
                </label>
                <button type="button" class="btn-secondary" data-goto-tab="${blk.tab}" ${blk.focusInitial ? `data-focus-init="${blk.focusInitial}"` : ''}>
                  ${escapeHtml(blk.actionLabel)} →
                </button>
              </div>
            `;
          }).join('')}
        </div>

        <div style="font-size:13px;font-weight:600;color:var(--sys-label-2);margin-bottom:8px">คลังคำและพยางค์สำคัญของ Day ${dayObj.day} (กดฟังเสียง)</div>
        <div class="quick-review-grid">
          ${dayObj.quickReview.map(qr => `
            <button type="button" class="qr-btn" data-speak="${qr.hanzi.split(' / ')[0]}">
              <span class="hz hanzi-font">${qr.hanzi}</span>
              <span class="py">${qr.py}</span>
              <span class="th">${escapeHtml(qr.th)}</span>
            </button>
          `).join('')}
        </div>

        ${(() => {
          const w1 = window.WEEK1_INTENSIVE_DRILLS && window.WEEK1_INTENSIVE_DRILLS[dayObj.day];
          if (!w1) return '';
          return `
            ${w1.ruleBox ? `
              <div class="info-box" style="margin-top:16px">
                <strong>${escapeHtml(w1.ruleBox.title)}</strong>
                <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">
                  ${w1.ruleBox.items.map(it => `<span class="nav-badge muted-badge">${escapeHtml(it)}</span>`).join('')}
                </div>
              </div>
            ` : ''}

            <div style="font-size:13px;font-weight:600;color:var(--sys-label-2);margin:16px 0 8px">ใบฝึกอ่านคู่เทียบเสียงประจำ Day ${dayObj.day} (กดเทียบ A ↔ B ฟังติดกัน)</div>
            <div class="quick-review-grid">
              ${w1.drillPairs.map(pr => `
                <button type="button" class="qr-btn" data-pair-a="${pr.a[0]}" data-pair-b="${pr.b[0]}">
                  <span class="hz hanzi-font">${pr.a[0]} ↔ ${pr.b[0]}</span>
                  <span class="py">${pr.a[1]} ↔ ${pr.b[1]}</span>
                  <span class="th">${escapeHtml(pr.focus)}</span>
                </button>
              `).join('')}
            </div>

            <div class="rule-example" style="margin-top:14px;padding:12px 14px">
              <div>
                <div style="font-size:11.5px;font-weight:700;color:var(--sys-accent-text);margin-bottom:2px">ประโยคลิ้นพันกันประจำวัน (Tongue Twister)</div>
                <div class="hanzi-font" style="font-size:18px;font-weight:700">${escapeHtml(w1.twister.hz)}</div>
                <div style="font-size:13px;font-weight:600;color:var(--sys-accent-text)">${escapeHtml(w1.twister.py)}</div>
                <div style="font-size:12px;color:var(--sys-label-2)">${escapeHtml(w1.twister.th)}</div>
              </div>
              <button type="button" class="btn-primary" data-speak="${escapeHtml(w1.twister.hz)}">ฟังประโยค</button>
            </div>
          `;
        })()}
      </div>

      <div class="daily-quiz-card" id="daily-quiz-card"></div>
    `;

    // Timer wiring
    document.getElementById('study-timer-toggle')?.addEventListener('click', toggleStudyTimer);
    document.getElementById('study-timer-reset')?.addEventListener('click', () => {
      stopStudyTimer();
      timerState.seconds = 60 * 60;
      updateTimerDisplay();
    });
    mainEl.querySelectorAll('[data-preset]').forEach(btn => {
      btn.addEventListener('click', () => {
        stopStudyTimer();
        timerState.seconds = Number(btn.dataset.preset) * 60;
        updateTimerDisplay();
      });
    });

    mainEl.querySelectorAll('[data-check-idx]').forEach(cb => {
      cb.addEventListener('change', () => {
        const idx = Number(cb.dataset.checkIdx);
        const list = state.progress.dayChecks[dayObj.day] || [];
        if (cb.checked && !list.includes(idx)) list.push(idx);
        else if (!cb.checked) {
          const pos = list.indexOf(idx);
          if (pos !== -1) list.splice(pos, 1);
        }
        state.progress.dayChecks[dayObj.day] = list;
        saveProgress();
        renderDailyMain();
      });
    });

    mainEl.querySelectorAll('[data-goto-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.dataset.gotoTab;
        if (targetTab === 'plan') {
          document.getElementById('daily-quiz-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
          return;
        }
        if (btn.dataset.focusInit) {
          state.selectedInitial = btn.dataset.focusInit;
          renderInitials();
        }
        if (targetTab === 'practice') {
          const w1 = window.WEEK1_INTENSIVE_DRILLS && window.WEEK1_INTENSIVE_DRILLS[dayObj.day];
          if (w1 && w1.pairFilter) {
            state.pairFilter = w1.pairFilter;
            if (state.drillMode === 'pairs') nextDrillQuestion();
          }
        }
        switchTab(targetTab);
      });
    });

    mainEl.querySelectorAll('[data-pair-a]').forEach(btn => {
      btn.addEventListener('click', () => {
        speak(btn.dataset.pairA, () => {
          setTimeout(() => speak(btn.dataset.pairB), 300);
        });
      });
    });

    mainEl.querySelectorAll('[data-speak]').forEach(btn => {
      btn.addEventListener('click', () => speak(btn.dataset.speak));
    });

    renderDailyQuizCard();
  }

  function renderDailyQuizCard() {
    const dayObj = PLAN.find(d => d.day === state.selectedDay) || PLAN[0];
    const card = document.getElementById('daily-quiz-card');
    const dq = state.dailyQuiz;
    const total = dayObj.quiz.length;

    if (!dq.started) {
      const best = state.progress.dayScores[dayObj.day];
      card.innerHTML = `
        <div class="dq-header">
          <h4>แบบทดสอบเข้มข้นประจำวัน · Day ${dayObj.day} (${total} ข้อ)</h4>
          <span class="streak-badge">${best !== undefined ? `สถิติสูงสุด: ${best}/${total}` : `เกณฑ์ผ่าน ${DAILY_PASS_SCORE}/${total}`}</span>
        </div>
        <p style="margin:0 0 14px;color:var(--sys-label-2);font-size:13.5px">
          ทดสอบครบทั้งการฟังแยกเสียงจริงและทฤษฎีของ Day ${dayObj.day} จำนวน ${total} ข้อ — ทำผ่าน ${DAILY_PASS_SCORE}/${total} เพื่อปลดล็อกเครื่องหมายผ่านประจำวัน
        </p>
        <button type="button" class="btn-primary" id="dq-start">เริ่มทำข้อสอบ Day ${dayObj.day} (${total} ข้อ) →</button>
      `;
      document.getElementById('dq-start').addEventListener('click', () => {
        state.dailyQuiz = { idx: 0, score: 0, answered: false, started: true };
        renderDailyQuizCard();
      });
      return;
    }

    if (dq.idx >= total) {
      const passed = dq.score >= DAILY_PASS_SCORE;
      const nextDay = dayObj.day < PLAN.length ? dayObj.day + 1 : null;
      card.innerHTML = `
        <div style="text-align:center;padding:12px 6px">
          <h4 style="margin:0 0 6px;font-size:20px">
            ${passed ? `ผ่าน Day ${dayObj.day} เรียบร้อยแล้ว ✓` : `ได้ ${dq.score}/${total} คะแนน — ลองทบทวนแล้วสอบใหม่`}
          </h4>
          <p style="margin:0 0 16px;color:var(--sys-label-2)">คะแนนรอบนี้: <b class="tabular-nums">${dq.score} / ${total}</b> (เกณฑ์ผ่าน ${DAILY_PASS_SCORE}/${total})</p>
          <div style="display:flex;justify-content:center;gap:10px;flex-wrap:wrap">
            <button type="button" class="btn-secondary" id="dq-retry">ทำควิซ Day ${dayObj.day} ใหม่</button>
            ${nextDay ? `<button type="button" class="btn-primary" id="dq-next-day">ไปเรียน Day ${nextDay} ต่อเลย →</button>` : ''}
          </div>
        </div>
      `;
      document.getElementById('dq-retry').addEventListener('click', () => {
        state.dailyQuiz = { idx: 0, score: 0, answered: false, started: true };
        renderDailyQuizCard();
      });
      if (nextDay) {
        document.getElementById('dq-next-day').addEventListener('click', () => {
          state.selectedDay = nextDay;
          state.dailyQuiz = { idx: 0, score: 0, answered: false, started: false };
          renderDailyPlan();
        });
      }
      return;
    }

    const q = dayObj.quiz[dq.idx];
    card.innerHTML = `
      <div class="dq-header">
        <h4>แบบทดสอบ Day ${dayObj.day} · ข้อที่ ${dq.idx + 1} / ${total}</h4>
        <span class="streak-badge tabular-nums">คะแนนสะสม: ${dq.score}</span>
      </div>
      <div style="margin-bottom:14px">
        <div style="font-size:15.5px;font-weight:600;margin-bottom:10px">${escapeHtml(q.q)}</div>
        ${q.type === 'audio' ? `<button type="button" class="btn-primary" id="dq-play" style="margin-bottom:6px">ฟังเสียงโจทย์</button>` : ''}
      </div>
      <div class="drill-options" style="grid-template-columns:1fr">
        ${q.options.map((opt, idx) => `
          <button type="button" class="drill-opt" style="text-align:left" data-dq-opt="${idx}">
            ${idx + 1}. ${escapeHtml(opt)}
          </button>
        `).join('')}
      </div>
      <div class="drill-feedback" id="dq-fb"></div>
      <div style="text-align:right">
        <button type="button" class="btn-primary" id="dq-next" style="display:none">
          ${dq.idx + 1 === total ? 'ดูผลคะแนน Day ' + dayObj.day : 'ข้อถัดไป →'}
        </button>
      </div>
    `;

    if (q.type === 'audio') {
      document.getElementById('dq-play').addEventListener('click', () => speak(q.audioChar));
    }

    card.querySelectorAll('[data-dq-opt]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (state.dailyQuiz.answered) return;
        state.dailyQuiz.answered = true;
        const chosen = Number(btn.dataset.dqOpt);
        const fb = document.getElementById('dq-fb');
        card.querySelectorAll('[data-dq-opt]').forEach(b => {
          b.disabled = true;
          if (Number(b.dataset.dqOpt) === q.answer) b.classList.add('correct');
        });
        if (chosen === q.answer) {
          state.dailyQuiz.score++;
          fb.className = 'drill-feedback show ok';
          fb.innerHTML = `<b>ถูกต้อง ✓</b> ${escapeHtml(q.explain)}`;
        } else {
          btn.classList.add('wrong');
          fb.className = 'drill-feedback show err';
          fb.innerHTML = `<b>ยังไม่ถูก</b> · ${escapeHtml(q.explain)}`;
        }
        document.getElementById('dq-next').style.display = 'inline-block';
      });
    });

    document.getElementById('dq-next').addEventListener('click', () => {
      state.dailyQuiz.idx++;
      state.dailyQuiz.answered = false;
      if (state.dailyQuiz.idx >= total) {
        const prevBest = state.progress.dayScores[dayObj.day];
        if (prevBest === undefined || state.dailyQuiz.score > prevBest) {
          state.progress.dayScores[dayObj.day] = state.dailyQuiz.score;
          saveProgress();
        }
        renderDailyPlan();
      } else {
        renderDailyQuizCard();
      }
    });
  }

  // ---- GAME PROFILE, SKILL RADAR & WORLD ROADMAP ----
  function renderSkillRadarSVG(skills) {
    const cx = 135, cy = 128, maxR = 82;
    const count = skills.length;
    const angleFor = i => (-Math.PI / 2) + (i * 2 * Math.PI) / count;

    const ringPolygon = ratio =>
      skills.map((_, i) => {
        const a = angleFor(i);
        return `${(cx + Math.cos(a) * maxR * ratio).toFixed(1)},${(cy + Math.sin(a) * maxR * ratio).toFixed(1)}`;
      }).join(' ');

    const dataPoints = skills.map((s, i) => {
      const a = angleFor(i);
      const r = Math.max(0.12, s.pct / 100) * maxR;
      return `${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`;
    }).join(' ');

    const axesHtml = skills.map((s, i) => {
      const a = angleFor(i);
      const x2 = cx + Math.cos(a) * maxR;
      const y2 = cy + Math.sin(a) * maxR;
      const lx = cx + Math.cos(a) * (maxR + 22);
      const ly = cy + Math.sin(a) * (maxR + 18);
      return `
        <line x1="${cx}" y1="${cy}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="var(--sys-separator)" stroke-width="1"/>
        <text x="${lx.toFixed(1)}" y="${(ly + 4).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="600" fill="var(--sys-label-2)">${escapeHtml(s.short)}</text>
      `;
    }).join('');

    return `
      <svg class="radar-svg" viewBox="0 0 270 256" role="img" aria-label="แผนภูมิสกิล 5 ด้าน">
        <polygon points="${ringPolygon(1)}" fill="none" stroke="var(--sys-separator)" stroke-width="1"/>
        <polygon points="${ringPolygon(0.66)}" fill="none" stroke="var(--sys-separator)" stroke-dasharray="3 3" stroke-width="1"/>
        <polygon points="${ringPolygon(0.33)}" fill="none" stroke="var(--sys-separator)" stroke-dasharray="3 3" stroke-width="1"/>
        ${axesHtml}
        <polygon points="${dataPoints}" fill="var(--sys-accent-tint-strong)" stroke="var(--sys-accent)" stroke-width="2.2" stroke-linejoin="round"/>
        ${skills.map((s, i) => {
          const a = angleFor(i);
          const r = Math.max(0.12, s.pct / 100) * maxR;
          return `<circle cx="${(cx + Math.cos(a) * r).toFixed(1)}" cy="${(cy + Math.sin(a) * r).toFixed(1)}" r="3.8" fill="var(--sys-accent)"/>`;
        }).join('')}
      </svg>
    `;
  }

  function renderProfilePage() {
    const container = document.getElementById('profile-content');
    if (!container) return;
    const g = computeGameStats();
    const p = state.progress;

    const avgSkill = Math.round(g.skills.reduce((s, sk) => s + sk.pct, 0) / g.skills.length);

    // 5 Stages of World 1 (Level 1 Game Map)
    const stageDefs = [
      { code: 'Stage 1-1', name: 'ปาก & ปุ่มเหงือก', desc: 'b-f, d-l, g-h, y-w และ 6 สระเดี่ยว', days: [1, 2, 3], gotoDay: 1 },
      { code: 'Stage 1-2', name: 'เส้นเสียงวรรณยุกต์', desc: 'วรรณยุกต์ 4+1 และกฎเสียง 3 ชน 3', days: [4], gotoDay: 4 },
      { code: 'Stage 1-3', name: 'กลุ่มยิ้ม & ลิ้นแบน', desc: 'j/q/x ตัดจุด ü, z/c/s และคัดอักษรชุดแรก', days: [5, 6, 7], gotoDay: 5 },
      { code: 'Stage 1-4', name: 'ม้วนลิ้น & สระประสม', desc: 'zh/ch/sh/r, สระประสม, แม่กน -n / แม่กง -ng', days: [8, 9, 10, 11, 12], gotoDay: 8 },
      { code: 'BOSS 1-5', name: 'บอสจบ Level 1', desc: 'กฎผัน 不/一, ฝึกพูดไมค์ และสอบใหญ่ 10 ข้อ', days: [13, 14], gotoDay: 13, isBoss: true }
    ];

    let foundCurrent = false;
    const stagesHtml = stageDefs.map(st => {
      const passedInStage = st.days.filter(d => (p.dayScores[d] || 0) >= DAILY_PASS_SCORE).length;
      const cleared = st.isBoss ? (passedInStage === st.days.length && g.bossPassed) : (passedInStage === st.days.length);
      let isCurrent = false;
      if (!cleared && !foundCurrent) {
        isCurrent = true;
        foundCurrent = true;
      }
      const starsCount = cleared ? 3 : passedInStage > 0 ? Math.min(2, Math.ceil((passedInStage / st.days.length) * 2)) : 0;
      const starsStr = '★'.repeat(starsCount) + '☆'.repeat(3 - starsCount);
      const statusText = cleared
        ? 'ผ่านด่านแล้ว ✓'
        : isCurrent
          ? `กำลังลุย (${passedInStage}/${st.days.length} วัน) →`
          : `รอปลดล็อก (${passedInStage}/${st.days.length})`;

      return `
        <button type="button" class="stage-node ${cleared ? 'cleared' : ''} ${isCurrent ? 'current' : ''} ${st.isBoss ? 'boss' : ''}" data-stage-day="${st.gotoDay}">
          <div class="stage-top">
            <span>${st.code}</span>
            <span class="stage-stars">${starsStr}</span>
          </div>
          <b>${escapeHtml(st.name)}</b>
          <p>${escapeHtml(st.desc)}</p>
          <span class="stage-status">${statusText}</span>
        </button>
      `;
    }).join('');

    const daily = ensureTodayDaily(p);
    // 28-Day Activity Heatmap cells (oldest -> today)
    const heatmapHtml = Array.from({ length: 28 }, (_, i) => {
      const k = todayKey(-(27 - i));
      const cnt = p.activity[k] || 0;
      const lv = cnt >= 8 ? 'lv3' : cnt >= 3 ? 'lv2' : cnt >= 1 ? 'lv1' : '';
      const isToday = i === 27 ? 'today' : '';
      return `<div class="hm-cell ${lv} ${isToday}" title="${k}: ${cnt} กิจกรรม"></div>`;
    }).join('');

    const questsHtml = ENG.dailyQuests.map(q => {
      const cur = Math.min(q.target, daily[q.metric] || 0);
      const done = cur >= q.target;
      const claimed = daily.claimed.includes(q.id);
      return `
        <div class="quest-row">
          <div class="quest-info">
            <b>${escapeHtml(q.title)} (+${q.xp} XP)</b>
            <span>ความคืบหน้าวันนี้: ${cur} / ${q.target}</span>
          </div>
          ${claimed
            ? `<span class="day-badge-score">รับแล้ว ✓</span>`
            : done
              ? `<button type="button" class="btn-primary" data-claim-quest="${q.id}">รับ +${q.xp} XP</button>`
              : `<button type="button" class="btn-secondary" data-goto="${q.tab}">ไปทำ →</button>`}
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="game-grid">
        <!-- Player Level & XP Banner -->
        <div class="player-card">
          <div class="level-crest">
            <small>LEVEL</small>
            <strong class="tabular-nums">${g.level}</strong>
          </div>
          <div class="player-meta">
            <h2><span class="hanzi-font">${g.rank.zh}</span> · ${escapeHtml(g.rank.th)}</h2>
            <p>พลังสกิลเฉลี่ย: <b class="tabular-nums">${avgSkill}%</b> · สตรีคต่อเนื่อง: <b class="tabular-nums">${g.streak} วัน</b> · เหรียญตรา: <b>${g.badges.filter(b => b.unlocked).length}/${g.badges.length}</b></p>
            <div class="xp-bar-wrap">
              <div class="progress-track"><div class="progress-fill" style="width:${g.lvPct}%"></div></div>
              <span class="tabular-nums">${g.xpInLevel} / ${g.xpSpan} XP (อีก ${g.xpToNext} XP ขึ้น LV.${g.level + 1})</span>
            </div>
          </div>
          <div class="player-total-box">
            <span>คะแนนสะสมทั้งหมด</span>
            <strong class="tabular-nums">${g.xp.toLocaleString()} XP</strong>
          </div>
        </div>

        <!-- Daily Streak Heatmap + 3 Daily Quests -->
        <div class="habit-grid">
          <div class="card-panel">
            <div class="section-row">
              <div>
                <h2 class="section-subtitle">ความสม่ำเสมอ 28 วัน (Activity Heatmap)</h2>
                <p class="section-subdesc">เรียนต่อเนื่องแล้ว <b class="tabular-nums">${g.streak} วัน</b> · สีเข้ม = ฝึกหนักในวันนั้น</p>
              </div>
              <span class="nav-badge tabular-nums">${g.streak} วันติด</span>
            </div>
            <div class="heatmap-grid">${heatmapHtml}</div>
          </div>

          <div class="card-panel">
            <div class="section-row">
              <div>
                <h2 class="section-subtitle">ภารกิจรายวัน (Daily Quests)</h2>
                <p class="section-subdesc">รีเซ็ตทุกวัน · ทำครบกดรับโบนัส XP ทันที</p>
              </div>
              <span class="nav-badge muted-badge tabular-nums">${daily.claimed.length}/${ENG.dailyQuests.length}</span>
            </div>
            <div class="quest-list">${questsHtml}</div>
          </div>
        </div>

        <!-- Skill Summary (Radar Chart + 5 Skill Bars) -->
        <div class="skills-layout">
          <div class="card-panel radar-box">
            <div class="section-subtitle" style="align-self:flex-start;margin-bottom:4px">แผนภูมิสกิล 5 ด้าน</div>
            ${renderSkillRadarSVG(g.skills)}
          </div>

          <div class="card-panel">
            <div class="section-row" style="margin-bottom:14px">
              <div>
                <h2 class="section-subtitle">บทสรุปสกิลรายด้าน (Skill Breakdown)</h2>
                <p class="section-subdesc">อัปเกรดสกิลแต่ละด้านเพื่อเก็บ XP เพิ่มเลเวล</p>
              </div>
              <span class="nav-badge tabular-nums">เฉลี่ย ${avgSkill}%</span>
            </div>
            <div class="skill-bars-list">
              ${g.skills.map(sk => `
                <div>
                  <div class="skill-row-head">
                    <b>${escapeHtml(sk.name)}</b>
                    <div class="skill-row-right">
                      <span class="tabular-nums">${sk.detail} (${sk.pct}%)</span>
                      <button type="button" class="skill-link" data-goto="${sk.tab}">อัปสกิล →</button>
                    </div>
                  </div>
                  <div class="progress-track"><div class="progress-fill" style="width:${sk.pct}%"></div></div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- Game World Map Roadmap -->
        <div class="world-section">
          <div class="world-card">
            <div class="world-head">
              <div>
                <span class="world-tag">World 1 · Active</span>
                <h2 class="section-subtitle" style="margin-top:6px">แผนที่ด่าน World 1: เกาะพินอินพื้นฐาน (Level 1 · 14 วัน)</h2>
                <p class="section-subdesc">กดที่ด่านใดก็ได้เพื่อวาร์ปไปเริ่มเรียนและเก็บดาว (★ ★ ★) ประจำด่าน</p>
              </div>
              <span class="nav-badge tabular-nums">ผ่านแล้ว ${g.daysPassed} / 14 วัน</span>
            </div>
            <div class="stage-path">${stagesHtml}</div>
          </div>

          <div class="world-card">
            <div class="world-head" style="margin-bottom:10px">
              <div>
                <span class="world-tag upcoming">Upcoming Worlds · Long-Term Roadmap</span>
                <h2 class="section-subtitle" style="margin-top:6px">แผนที่ด่านระยะยาว (World 2 → World 4)</h2>
              </div>
            </div>
            <div class="future-worlds-grid">
              <div class="future-world">
                <span class="world-tag upcoming">World 2 · v1.5</span>
                <h4>หุบเขาความจำ SRS</h4>
                <p>Flashcard ทบทวนอัตโนมัติแบบ Anki, Daily Streak และไฟล์เสียงเจ้าของภาษาแท้ทุกพยางค์</p>
              </div>
              <div class="future-world">
                <span class="world-tag upcoming">World 3 · v2.0</span>
                <h4>เมืองบทสนทนา HSK 1–2</h4>
                <p>คลังคำศัพท์ 150–300 คำ, เกมเรียงประโยคไวยากรณ์, บทสนทนาจำลอง และเรื่องสั้นจิ้มแปล</p>
              </div>
              <div class="future-world">
                <span class="world-tag upcoming">World 4 · v3.0</span>
                <h4>หอคอย AI Tutor</h4>
                <p>ซิงค์ข้อมูลข้ามมือถือ-คอม (Cloud Sync), แอป PWA ออฟไลน์ และคู่ซ้อมสนทนา AI</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Achievement Badges -->
        <div class="card-panel">
          <div class="section-row" style="margin-bottom:12px">
            <div>
              <h2 class="section-subtitle">เหรียญตราความสำเร็จ (Achievements)</h2>
              <p class="section-subdesc">ทำภารกิจให้ครบเพื่อปลดล็อกเหรียญตราประจำตัว</p>
            </div>
            <span class="nav-badge muted-badge tabular-nums">${g.badges.filter(b => b.unlocked).length} / ${g.badges.length}</span>
          </div>
          <div class="badges-grid">
            ${g.badges.map(b => `
              <div class="ach-card ${b.unlocked ? 'unlocked' : 'locked'}">
                <div class="ach-icon hanzi-font">${b.icon}</div>
                <div class="ach-body">
                  <b>${escapeHtml(b.title)}${b.unlocked ? ' ✓' : ''}</b>
                  <span>${escapeHtml(b.desc)}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Weekly Learning Insights (7-Day Chart + Retention + Weak Words) -->
        ${(() => {
          const days7 = [];
          let maxAct = 1;
          let activeDays = 0;
          let totalUnits7 = 0;
          const thDays = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
          for (let i = 6; i >= 0; i--) {
            const k = todayKey(-i);
            const v = Number(p.activity?.[k] || 0);
            const dt = new Date(k + 'T00:00:00');
            if (v > 0) activeDays++;
            totalUnits7 += v;
            if (v > maxAct) maxAct = v;
            days7.push({ key: k, label: thDays[dt.getDay()], val: v, isToday: i === 0 });
          }
          const ret = computeSrsRetention(p.vocabSrs);
          const weakWords = (Array.isArray(p.vocabMistakes) ? p.vocabMistakes : []).slice(0, 5);
          return `
            <div class="card-panel">
              <div class="section-row" style="margin-bottom:12px;flex-wrap:wrap;gap:8px">
                <div>
                  <h2 class="section-subtitle">📊 สรุปการเรียน 7 วันล่าสุด (Weekly Insights)</h2>
                  <p class="section-subdesc">ติดตามความสม่ำเสมอ อัตราจำแม่น SM-2 และจุดอ่อนที่ควรติวซ้ำ</p>
                </div>
                <div style="display:flex;gap:8px;flex-wrap:wrap">
                  <span class="shop-price tabular-nums">เข้าเรียน ${activeDays}/7 วัน</span>
                  <span class="shop-price tabular-nums">${ret.retentionPct !== null ? `จำแม่น ${ret.retentionPct}%` : `กำลังสะสม SRS (${ret.totalTracked} คำ)`}</span>
                </div>
              </div>
              <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:8px;align-items:end;height:110px;padding:10px 6px 4px;border-radius:12px;background:var(--sys-fill-2)">
                ${days7.map(d => {
                  const h = d.val > 0 ? Math.max(14, Math.round((d.val / maxAct) * 76)) : 6;
                  return `
                    <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
                      <span class="tabular-nums" style="font-size:11px;color:var(--sys-label-2)">${d.val || ''}</span>
                      <div style="width:100%;max-width:34px;height:${h}px;border-radius:8px;background:${d.isToday ? 'var(--sys-accent)' : d.val > 0 ? 'var(--sys-green, #34c759)' : 'var(--sys-separator)'};opacity:${d.val > 0 ? 1 : 0.45}"></div>
                      <span style="font-size:11.5px;font-weight:${d.isToday ? 700 : 500};color:${d.isToday ? 'var(--sys-accent-text)' : 'var(--sys-label-2)'}">${d.label}</span>
                    </div>
                  `;
                }).join('')}
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-top:12px;font-size:13px">
                <div>
                  <b>กิจกรรมรวมสัปดาห์นี้:</b> <span class="tabular-nums">${totalUnits7}</span> ครั้ง · <b>คำที่จำแม่น (SM-2):</b> <span class="tabular-nums">${ret.mastered}</span> คำ
                </div>
                ${weakWords.length > 0 ? `
                  <button type="button" class="btn-primary" id="profile-drill-weak-btn" style="padding:5px 12px;font-size:12.5px">⚡ ติวด่วนคำที่ผิดบ่อย (${weakWords.length} คำ)</button>
                ` : ''}
              </div>
              ${weakWords.length > 0 ? `
                <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">
                  ${weakWords.map(w => `<span class="vtab-pill" style="padding:3px 9px;font-size:12.5px" title="${escapeHtml((w.pinyin || '') + ' · ' + (w.meaning || ''))}">${escapeHtml(w.hanzi)} <small style="opacity:0.75">${escapeHtml(w.pinyin || '')}</small></span>`).join('')}
                </div>
              ` : ''}
            </div>
          `;
        })()}

        <!-- Panda Shop (Bamboo Coins & Accessories) -->
        <div class="card-panel">
          <div class="section-row" style="margin-bottom:12px">
            <div>
              <h2 class="section-subtitle">ร้านแต่งตัวน้องเป่าเปา (Panda Shop)</h2>
              <p class="section-subdesc">ใช้เหรียญไผ่ที่ได้จากการเรียนสะสม XP มาซื้อและสวมใส่ของตกแต่งให้น้องเป่าเปาได้เลย</p>
            </div>
            <span class="shop-price tabular-nums">คงเหลือ ${getBambooCoins(g.xp)} เหรียญไผ่</span>
          </div>
          <div class="shop-grid">
            ${(() => {
              const coins = getBambooCoins(g.xp);
              const freezes = p.streakFreezes || 0;
              const freezeCost = 120;
              const maxFreezes = 3;
              return `
                <div class="shop-item ${freezes > 0 ? 'equipped' : ''}">
                  <div class="shop-item-head">
                    <b>❄️ ตั๋วกันสตรีคขาด (Streak Freeze)</b>
                    <span class="shop-price">${freezes}/${maxFreezes} ใบ</span>
                  </div>
                  <p>ป้องกันสตรีคขาดอัตโนมัติ 1 วัน หากวันไหนลืมเข้ามาเรียน (เก็บได้สูงสุด 3 ใบ)</p>
                  <button type="button" class="${freezes < maxFreezes && coins >= freezeCost ? 'btn-primary' : 'btn-secondary'}" id="buy-streak-freeze-btn" ${freezes >= maxFreezes || coins < freezeCost ? 'disabled' : ''}>
                    ${freezes >= maxFreezes ? 'เก็บครบสูงสุดแล้ว (3/3)' : coins >= freezeCost ? `ซื้อเพิ่ม (${freezeCost} ไผ่)` : `ขาดอีก ${freezeCost - coins} ไผ่`}
                  </button>
                </div>
              `;
            })()}
            ${FUN.pandaShop.map(item => {
              const owned = p.ownedItems.includes(item.id);
              const equipped = p.equipped[item.slot] === item.id;
              const coins = getBambooCoins(g.xp);
              return `
                <div class="shop-item ${equipped ? 'equipped' : ''}">
                  <div class="shop-item-head">
                    <b>${escapeHtml(item.name)}</b>
                    <span class="shop-price">${owned ? (equipped ? 'กำลังใส่' : 'มีแล้ว') : item.cost + ' ไผ่'}</span>
                  </div>
                  <p>${escapeHtml(item.desc)}</p>
                  ${owned
                    ? `<button type="button" class="${equipped ? 'btn-secondary' : 'btn-primary'}" data-equip="${item.id}">${equipped ? 'ถอดออก' : 'สวมใส่'}</button>`
                    : `<button type="button" class="btn-secondary" data-buy="${item.id}" ${coins >= item.cost ? '' : 'disabled'}>${coins >= item.cost ? `ซื้อ (${item.cost} ไผ่)` : `ขาดอีก ${item.cost - coins} ไผ่`}</button>`}
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Certificate PNG Studio & Save File Backup -->
        <div class="utility-grid">
          <div class="card-panel">
            <h2 class="section-subtitle">การ์ดประกาศนียบัตร / สรุปพลัง Level 1 (.PNG)</h2>
            <p class="section-subdesc">กรอกชื่อของคุณแล้วดาวน์โหลดการ์ดสรุปเลเวล ฉายา และคะแนนสกิล 5 ด้านเก็บไว้แชร์ได้เลย</p>
            <div class="cert-input-row">
              <input type="text" class="sys-input" id="cert-name-input" placeholder="ชื่อของคุณ (เช่น คุณสมชาย)" maxlength="32">
              <button type="button" class="btn-primary" id="cert-download-btn">ดาวน์โหลดการ์ด .PNG</button>
            </div>
          </div>

          <div class="card-panel">
            <h2 class="section-subtitle">ซิงก์บัญชีผู้ใช้คลาวด์ & สำรองไฟล์</h2>
            <p class="section-subdesc">เข้าสู่ระบบด้วยบัญชีผู้ใช้ (Email / Google) เพื่อซิงก์ความคืบหน้าข้ามอุปกรณ์อย่างปลอดภัยอัตโนมัติ</p>
            <div class="cert-input-row">
              <button type="button" class="btn-primary" id="profile-auth-btn">${authState.user ? 'จัดการบัญชี / ซิงก์เดี๋ยวนี้' : 'เข้าสู่ระบบเพื่อซิงก์คลาวด์'}</button>
              <button type="button" class="btn-secondary" id="export-save-btn">Export .JSON</button>
              <label class="btn-secondary" style="cursor:pointer">
                Import .JSON
                <input type="file" id="import-save-input" accept="application/json" hidden>
              </label>
            </div>
            <div class="sync-status" id="sync-status">${authState.user
              ? `เชื่อมต่อบัญชี: ${escapeHtml(authState.user.email || 'ผู้เรียน')}${authState.lastSyncedAt ? ` · ซิงก์ล่าสุด ${new Date(authState.lastSyncedAt).toLocaleTimeString('th-TH')}` : ''}`
              : 'ยังไม่ได้เข้าสู่ระบบ (ข้อมูลเก็บในเบราว์เซอร์เครื่องนี้)'}</div>
          </div>
        </div>
      </div>
    `;

    container.querySelectorAll('[data-claim-quest]').forEach(btn => {
      btn.addEventListener('click', () => {
        const q = ENG.dailyQuests.find(x => x.id === btn.dataset.claimQuest);
        const d = ensureTodayDaily(state.progress);
        if (!q || d.claimed.includes(q.id)) return;
        d.claimed.push(q.id);
        state.progress.bonusXp = (state.progress.bonusXp || 0) + q.xp;
        saveProgress(`ภารกิจสำเร็จ: ${q.title}`);
        renderProfilePage();
      });
    });

    document.getElementById('profile-drill-weak-btn')?.addEventListener('click', () => {
      const weak = (Array.isArray(state.progress.vocabMistakes) ? state.progress.vocabMistakes : []).slice(0, 15);
      if (!weak.length) return;
      state.vocabMode = 'srs';
      state.vocabSrsSession = { queue: weak, idx: 0, flipped: false, doneCount: 0, earlyMode: true };
      switchTab('vocab');
      renderVocab();
      showToast(`เริ่มติวด่วน ${weak.length} คำที่ผิดบ่อย!`, 'DRILL');
    });

    document.getElementById('buy-streak-freeze-btn')?.addEventListener('click', () => {
      const freezeCost = 120;
      const maxFreezes = 3;
      const curFreezes = state.progress.streakFreezes || 0;
      const coins = getBambooCoins(g.xp);
      if (curFreezes >= maxFreezes || coins < freezeCost) return;
      state.progress.spentCoins = (state.progress.spentCoins || 0) + freezeCost;
      state.progress.streakFreezes = curFreezes + 1;
      playChime('ok');
      saveProgress('ซื้อตั๋วกันสตรีคขาด ❄️ (+1 ใบ)');
      renderProfilePage();
    });

    container.querySelectorAll('[data-buy]').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = FUN.pandaShop.find(x => x.id === btn.dataset.buy);
        if (!item) return;
        const coins = getBambooCoins(g.xp);
        if (coins < item.cost || state.progress.ownedItems.includes(item.id)) return;
        state.progress.spentCoins = (state.progress.spentCoins || 0) + item.cost;
        state.progress.ownedItems.push(item.id);
        state.progress.equipped[item.slot] = item.id;
        saveProgress();
        renderPandaSprite(g.level);
        pandaSay(`เย้! ได้ "${item.name}" แล้ว!`, 2600);
        playChime('levelup');
        renderProfilePage();
      });
    });

    container.querySelectorAll('[data-equip]').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = FUN.pandaShop.find(x => x.id === btn.dataset.equip);
        if (!item) return;
        if (state.progress.equipped[item.slot] === item.id) delete state.progress.equipped[item.slot];
        else state.progress.equipped[item.slot] = item.id;
        saveProgress();
        renderPandaSprite(g.level);
        playChime('ok');
        renderProfilePage();
      });
    });

    container.querySelectorAll('[data-goto]').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.goto));
    });

    container.querySelectorAll('[data-stage-day]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.selectedDay = Number(btn.dataset.stageDay);
        state.dailyQuiz = { idx: 0, score: 0, answered: false, started: false };
        renderDailyPlan();
        switchTab('plan');
      });
    });

    document.getElementById('cert-download-btn')?.addEventListener('click', () => {
      const name = (document.getElementById('cert-name-input')?.value || '').trim() || 'Nihao Learner';
      downloadCertificatePng(name, g);
    });

    document.getElementById('profile-auth-btn')?.addEventListener('click', () => {
      openAuthModal();
    });

    document.getElementById('export-save-btn')?.addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(state.progress, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nihao-level1-save-${todayKey()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('ดาวน์โหลดไฟล์สำรองข้อมูลแล้ว', 'SAVED');
    });

    document.getElementById('import-save-input')?.addEventListener('change', (ev) => {
      const file = ev.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result || '{}'));
          if (!parsed || typeof parsed !== 'object') throw new Error('Invalid');
          localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
          state.progress = loadProgress();
          const st = computeGameStats();
          lastKnownXp = st.xp;
          lastKnownLevel = st.level;
          updateDashboard();
          renderDailyPlan();
          renderInitials();
          renderFinals();
          renderProfilePage();
          playChime('levelup');
          showToast('นำเข้าข้อมูลการเรียนสำเร็จ!', 'RESTORED', true);
        } catch {
          playChime('err');
          showToast('ไฟล์สำรองไม่ถูกต้อง กรุณาเลือกไฟล์ .json ที่ส่งออกจากเว็บนี้', 'ERROR');
        }
      };
      reader.readAsText(file);
    });
  }

  function downloadCertificatePng(learnerName, g) {
    const canvas = document.createElement('canvas');
    canvas.width = 1000;
    canvas.height = 620;
    const ctx = canvas.getContext('2d');

    // Clean Apple-minimal card background
    ctx.fillStyle = '#f5f5f7';
    ctx.fillRect(0, 0, 1000, 620);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(36, 36, 928, 548, 28);
    ctx.fill();
    ctx.strokeStyle = 'rgba(60,60,67,0.16)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Accent bar
    const grad = ctx.createLinearGradient(36, 36, 964, 36);
    grad.addColorStop(0, '#007aff');
    grad.addColorStop(1, '#5856d6');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(36, 36, 928, 12, [28, 28, 0, 0]);
    ctx.fill();

    // Header
    ctx.fillStyle = '#007aff';
    ctx.font = '700 18px Inter, sans-serif';
    ctx.fillText('NIHAO LEARNING PLATFORM · LEVEL 1 CHINESE FOUNDATION', 76, 102);

    ctx.fillStyle = '#1d1d1f';
    ctx.font = '700 40px "Noto Sans Thai", Inter, sans-serif';
    ctx.fillText(g.bossPassed && g.daysPassed >= 14 ? 'ใบประกาศนียบัตรจบหลักสูตร Level 1' : 'บัตรสรุปความคืบหน้า Level 1', 76, 158);

    ctx.fillStyle = '#6e6e73';
    ctx.font = '500 20px "Noto Sans Thai", Inter, sans-serif';
    ctx.fillText('มอบให้แก่', 76, 212);

    ctx.fillStyle = '#1d1d1f';
    ctx.font = '700 44px "Noto Sans Thai", Inter, sans-serif';
    ctx.fillText(learnerName, 76, 266);

    // Level badge on right
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(760, 90, 160, 150, 24);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '700 16px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('LEVEL', 840, 130);
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 58px Inter, sans-serif';
    ctx.fillText(String(g.level), 840, 192);
    ctx.font = '600 16px "Noto Sans Thai", sans-serif';
    ctx.fillText(`${g.xp.toLocaleString()} XP`, 840, 224);

    // Rank & Skills
    ctx.textAlign = 'left';
    ctx.fillStyle = '#0066cc';
    ctx.font = '700 22px "Noto Sans Thai", "Noto Sans SC", sans-serif';
    ctx.fillText(`ฉายาปัจจุบัน: ${g.rank.zh} · ${g.rank.th}`, 76, 314);

    // 5 Skills Bars
    g.skills.forEach((sk, idx) => {
      const y = 360 + idx * 36;
      ctx.fillStyle = '#1d1d1f';
      ctx.font = '600 17px "Noto Sans Thai", sans-serif';
      ctx.fillText(sk.name, 76, y);

      ctx.fillStyle = '#f2f2f7';
      ctx.beginPath();
      ctx.roundRect(270, y - 14, 480, 14, 7);
      ctx.fill();

      ctx.fillStyle = '#007aff';
      ctx.beginPath();
      ctx.roundRect(270, y - 14, Math.max(12, 480 * (sk.pct / 100)), 14, 7);
      ctx.fill();

      ctx.fillStyle = '#6e6e73';
      ctx.font = '600 16px Inter, sans-serif';
      ctx.fillText(`${sk.pct}% (${sk.detail})`, 768, y);
    });

    // Footer
    ctx.fillStyle = '#86868b';
    ctx.font = '500 15px Inter, sans-serif';
    ctx.fillText(`วันที่ออกบัตร: ${todayKey()}  ·  แผน 14 วัน: ${g.daysPassed}/14 วัน  ·  สตรีคต่อเนื่อง: ${g.streak} วัน`, 76, 554);

    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `nihao-level1-certificate-${todayKey()}.png`;
    a.click();
    playChime('ok');
    showToast('ดาวน์โหลดการ์ด .PNG เรียบร้อยแล้ว', 'CERT');
  }

  // ---- SMART WEAK-SPOT TRAINER ----
  function renderWeakSpotDrill() {
    const stage = document.getElementById('drill-stage');
    const mistakes = state.progress.mistakes;

    if (!mistakes.length) {
      stage.innerHTML = `
        <div style="text-align:center;padding:24px 12px">
          <h3 style="margin:0 0 8px;font-size:20px">ยังไม่มีจุดอ่อนค้างอยู่เลย ✓</h3>
          <p style="margin:0 0 18px;color:var(--sys-label-2);font-size:14px">
            เมื่อคุณตอบผิดในโหมดฝึกฟังแยกวรรณยุกต์ หรือแยกคู่เสียงสับสน ระบบจะเก็บข้อนั้นมาจัดชุดซ่อมเฉพาะจุดอ่อนให้อัตโนมัติที่นี่!
          </p>
          <button type="button" class="btn-primary" id="ws-goto-pairs">ลองฝึกแยกคู่เสียงสับสนเลย →</button>
        </div>
      `;
      document.getElementById('ws-goto-pairs').addEventListener('click', () => {
        state.drillMode = 'pairs';
        document.querySelectorAll('.drill-mode-card').forEach(b => b.classList.toggle('active', b.dataset.mode === 'pairs'));
        nextDrillQuestion();
      });
      return;
    }

    const item = mistakes[0];
    let answered = false;
    stage.innerHTML = `
      <div class="drill-topbar">
        <span>ซ่อมจุดอ่อนอัตโนมัติ · เหลือ ${mistakes.length} จุด (เคยพลาด ${item.misses} ครั้ง)</span>
        <span class="streak-badge">ตอบถูก 2 ครั้งเพื่อล้างจุดอ่อน (+25 XP)</span>
      </div>
      <div class="drill-prompt">
        <h3>${escapeHtml(item.q)}</h3>
        ${item.audioChar ? `<button type="button" class="drill-audio-btn" id="ws-play">ฟังเสียงโจทย์</button>` : ''}
      </div>
      <div class="drill-options" style="grid-template-columns:1fr">
        ${item.options.map((opt, idx) => `
          <button type="button" class="drill-opt" style="text-align:left" data-ws-opt="${idx}">
            ${idx + 1}. ${escapeHtml(opt)}
          </button>
        `).join('')}
      </div>
      <div class="drill-feedback" id="ws-fb"></div>
      <div style="text-align:right">
        <button type="button" class="btn-primary" id="ws-next" style="display:none">ข้อถัดไป →</button>
      </div>
    `;

    if (item.audioChar) {
      document.getElementById('ws-play').addEventListener('click', () => speak(item.audioChar));
    }

    stage.querySelectorAll('[data-ws-opt]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (answered) return;
        answered = true;
        const chosen = Number(btn.dataset.wsOpt);
        const fb = document.getElementById('ws-fb');
        stage.querySelectorAll('[data-ws-opt]').forEach(b => {
          b.disabled = true;
          if (Number(b.dataset.wsOpt) === item.answer) b.classList.add('correct');
        });
        if (chosen === item.answer) {
          item.streakOk = (item.streakOk || 0) + 1;
          ensureTodayDaily(state.progress).drills++;
          if (item.streakOk >= 2) {
            state.progress.mistakes.shift();
            state.progress.bonusXp = (state.progress.bonusXp || 0) + 25;
            saveProgress('ซ่อมจุดอ่อนสำเร็จ!');
            fb.className = 'drill-feedback show ok';
            fb.innerHTML = `<b>ซ่อมจุดอ่อนนี้สำเร็จแล้ว! (+25 XP) ✓</b> ${escapeHtml(item.explain)}`;
          } else {
            // Rotate to back of queue
            state.progress.mistakes.push(state.progress.mistakes.shift());
            state.progress.drillCorrect++;
            saveProgress('ซ่อมจุดอ่อน 1/2');
            fb.className = 'drill-feedback show ok';
            fb.innerHTML = `<b>ถูกต้อง! (1/2)</b> ตอบถูกอีก 1 รอบจะล้างจุดอ่อนนี้ได้ · ${escapeHtml(item.explain)}`;
          }
        } else {
          item.streakOk = 0;
          item.misses++;
          playChime('err');
          btn.classList.add('wrong');
          fb.className = 'drill-feedback show err';
          fb.innerHTML = `<b>ยังไม่ตรง</b> · ${escapeHtml(item.explain)}`;
        }
        document.getElementById('ws-next').style.display = 'inline-block';
      });
    });

    document.getElementById('ws-next').addEventListener('click', renderWeakSpotDrill);
  }

  // ---- SRS FLASHCARDS & MINI DIALOGUES ----
  const allVocabWords = DATA.vocabPacks.flatMap(p => p.words);

  function getDueSrsWords() {
    const now = Date.now();
    return allVocabWords.filter(w => {
      const rec = state.progress.srs[w.hanzi];
      return !rec || (rec.nextReview || 0) <= now;
    });
  }

  function renderSrsPage() {
    const host = document.getElementById('srs-content');
    if (!host) return;
    document.querySelectorAll('#srs-mode-switch button').forEach(b => {
      b.classList.toggle('active', b.dataset.smode === state.srsSubMode);
    });

    if (state.srsSubMode === 'dialogue') {
      renderDialogues(host);
      return;
    }
    if (state.srsSubMode === 'podcast') {
      renderPodcastPlayer(host);
      return;
    }

    const due = getDueSrsWords();
    const masteredCount = allVocabWords.filter(w => (state.progress.srs[w.hanzi]?.interval || 0) >= 3).length;

    if (!due.length) {
      host.innerHTML = `
        <div class="card-panel srs-wrap" style="text-align:center;padding:36px 24px">
          <h3 style="font-size:22px;margin-bottom:8px">ทบทวนการ์ดวันนี้ครบหมดแล้ว ✓</h3>
          <p style="color:var(--sys-label-2);margin:0 0 18px">จำแม่นแล้ว ${masteredCount} / ${allVocabWords.length} คำ · พรุ่งนี้ระบบจะดึงคำที่ใกล้ลืมมาทบทวนให้อัตโนมัติ</p>
          <button type="button" class="btn-secondary" id="srs-reset-due">ทบทวนซ้ำทั้งหมดอีกรอบ</button>
        </div>
      `;
      document.getElementById('srs-reset-due').addEventListener('click', () => {
        Object.keys(state.progress.srs).forEach(k => { state.progress.srs[k].nextReview = 0; });
        saveProgress();
        renderSrsPage();
      });
      return;
    }

    const card = due[0];
    const cleanSpeech = card.hanzi.split(' / ')[0];
    host.innerHTML = `
      <div class="srs-wrap">
        <div class="srs-stats-row">
          <span>รอทบทวนวันนี้: <b class="tabular-nums">${due.length}</b> คำ</span>
          <span>จำแม่นระยะยาวแล้ว: <b class="tabular-nums">${masteredCount} / ${allVocabWords.length}</b></span>
        </div>

        <div class="flashcard" id="srs-card" role="button" tabindex="0">
          <div class="fc-hanzi hanzi-font">${card.hanzi}</div>
          <button type="button" class="btn-secondary" id="srs-play-audio">ฟังเสียง</button>
          ${state.srsFlipped ? `
            <div class="fc-pinyin">${card.pinyin}</div>
            <div class="fc-meaning">${escapeHtml(card.meaning)}</div>
            <div class="fc-meta">${escapeHtml(card.breakdown)} · ${escapeHtml(card.note)}</div>
          ` : `
            <div class="fc-meta" style="margin-top:8px">แตะการ์ดเพื่อพลิกดูพินอินและคำแปล</div>
          `}
        </div>

        ${state.srsFlipped ? `
          <div class="srs-rate-row">
            <button type="button" class="srs-btn again" data-srs-rate="0">ลืม<small>[1] วนซ้ำทันที</small></button>
            <button type="button" class="srs-btn good" data-srs-rate="1">คุ้นๆ<small>[2] ทบทวนใน 1 วัน</small></button>
            <button type="button" class="srs-btn easy" data-srs-rate="3">แม่นเป๊ะ<small>[3] ทบทวนใน 3–7 วัน</small></button>
          </div>
        ` : ''}
        <div style="text-align:center;font-size:12px;color:var(--sys-label-3);margin-top:10px">คีย์ลัด: Space พลิกการ์ด · 1–3 ให้คะแนน · R ฟังเสียงซ้ำ</div>
      </div>
    `;

    document.getElementById('srs-play-audio').addEventListener('click', (e) => {
      e.stopPropagation();
      speak(cleanSpeech);
    });

    document.getElementById('srs-card').addEventListener('click', () => {
      state.srsFlipped = !state.srsFlipped;
      if (state.srsFlipped) speak(cleanSpeech);
      renderSrsPage();
    });

    host.querySelectorAll('[data-srs-rate]').forEach(btn => {
      btn.addEventListener('click', () => {
        const rate = Number(btn.dataset.srsRate);
        const rec = state.progress.srs[card.hanzi] || { interval: 0, reps: 0, nextReview: 0 };
        const dayMs = 24 * 60 * 60 * 1000;
        if (rate === 0) {
          rec.interval = 0;
          rec.nextReview = Date.now() + 5000;
          playChime('err');
        } else if (rate === 1) {
          rec.interval = 1;
          rec.reps++;
          rec.nextReview = Date.now() + dayMs;
          state.progress.bonusXp = (state.progress.bonusXp || 0) + 5;
        } else {
          rec.interval = rec.interval >= 3 ? Math.min(14, rec.interval * 2) : 3;
          rec.reps++;
          rec.nextReview = Date.now() + rec.interval * dayMs;
          state.progress.bonusXp = (state.progress.bonusXp || 0) + 10;
        }
        rec.updatedAt = Date.now();
        state.progress.srs[card.hanzi] = rec;
        ensureTodayDaily(state.progress).srs++;
        state.srsFlipped = false;
        saveProgress('ทบทวนการ์ด SRS');
        renderSrsPage();
      });
    });
  }

  function renderDialogues(host) {
    const dlg = ENG.dialogues[state.selectedDialogue] || ENG.dialogues[0];
    host.innerHTML = `
      <div class="dialogue-layout">
        <div class="pack-list">
          ${ENG.dialogues.map((d, idx) => `
            <button type="button" class="pack-btn ${state.selectedDialogue === idx ? 'active' : ''}" data-dlg="${idx}">
              <span class="pack-icon">${idx + 1}</span>
              <span>
                <b>${escapeHtml(d.title)}</b>
                <span>${escapeHtml(d.scene)}</span>
              </span>
            </button>
          `).join('')}
        </div>

        <div class="card-panel">
          <div class="dialogue-controls">
            <div>
              <h2 class="section-subtitle">${escapeHtml(dlg.title)}</h2>
              <p class="section-subdesc">${escapeHtml(dlg.scene)}</p>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              <button type="button" class="btn-secondary" id="dlg-toggle-py">${state.dialogueShowPinyin ? 'ซ่อนพินอิน' : 'แสดงพินอิน'}</button>
              <button type="button" class="btn-secondary" id="dlg-toggle-th">${state.dialogueShowThai ? 'ซ่อนคำแปล' : 'แสดงคำแปล'}</button>
              <button type="button" class="btn-primary" id="dlg-play-all">▶ เล่นทั้งบทสนทนา</button>
            </div>
          </div>

          <div class="chat-stream">
            ${dlg.lines.map(ln => `
              <button type="button" class="chat-bubble ${ln.speaker === 'B' ? 'side-b' : ''}" data-speak="${ln.hanzi}">
                <div class="chat-role">${escapeHtml(ln.role)}</div>
                <div class="chat-hanzi hanzi-font">${ln.hanzi}</div>
                ${state.dialogueShowPinyin ? `<div class="chat-py">${ln.pinyin}</div>` : ''}
                ${state.dialogueShowThai ? `<div class="chat-th">${escapeHtml(ln.thai)}</div>` : ''}
              </button>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    host.querySelectorAll('[data-dlg]').forEach(btn => {
      btn.addEventListener('click', () => { state.selectedDialogue = Number(btn.dataset.dlg); renderSrsPage(); });
    });
    document.getElementById('dlg-toggle-py').addEventListener('click', () => { state.dialogueShowPinyin = !state.dialogueShowPinyin; renderSrsPage(); });
    document.getElementById('dlg-toggle-th').addEventListener('click', () => { state.dialogueShowThai = !state.dialogueShowThai; renderSrsPage(); });
    host.querySelectorAll('[data-speak]').forEach(btn => {
      btn.addEventListener('click', () => speak(btn.dataset.speak));
    });

    host.querySelectorAll('[data-detail]').forEach(btn => {
      btn.addEventListener('click', () => openVocabDetailModal(Number(btn.dataset.detail)));
    });

    host.querySelectorAll('[data-star]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.star);
        const list = state.progress.vocabStarred || (state.progress.vocabStarred = []);
        const idx = list.indexOf(id);
        if (idx === -1) {
          list.push(id);
          btn.classList.add('starred');
          playChime('ok');
        } else {
          list.splice(idx, 1);
          btn.classList.remove('starred');
        }
        saveProgress();
      });
    });
    document.getElementById('dlg-play-all').addEventListener('click', () => {
      let i = 0;
      const playNext = () => {
        if (i >= dlg.lines.length) return;
        speak(dlg.lines[i].hanzi, () => { i++; setTimeout(playNext, 350); });
      };
      playNext();
    });
  }

  // ---- HANDS-FREE AUDIO LOOP (PODCAST MODE) ----
  function getPodcastList() {
    if (state.podcastDeck === 'hsk1') {
      return L2.hsk1Words.map(w => ({ hz: w.hz, py: w.py, th: w.th, speak: w.hz.split(' / ')[0] }));
    }
    if (state.podcastDeck === 'culture') {
      return FUN.cultureGroups.flatMap(g => g.items.map(it => ({ hz: it.hz, py: it.py, th: it.th, speak: it.speak })));
    }
    return allVocabWords.map(w => ({ hz: w.hanzi, py: w.pinyin, th: w.meaning, speak: w.hanzi.split(' / ')[0] }));
  }

  function stopPodcast() {
    state.podcastPlaying = false;
    if (state.podcastTimer) { clearTimeout(state.podcastTimer); state.podcastTimer = null; }
    stopSpeech();
  }

  function speakThai(text, onEnd) {
    const clean = String(text || '').trim();
    if (!clean) { if (onEnd) onEnd(); return; }
    stopSpeech();
    const seq = speakSeq;
    if (!thVoice) pickZhVoice();

    playServerTts(clean, 'th', 0.95, seq, onEnd, () => {
      if (thVoice) {
        speakViaWebSpeech(clean, 'th-TH', 0.95, thVoice, seq, onEnd, () => { if (onEnd) onEnd(); });
      } else if (onEnd) {
        onEnd();
      }
    });
  }

  function runPodcastStep() {
    if (!state.podcastPlaying) return;
    const list = getPodcastList();
    const item = list[state.podcastIdx % list.length];
    const host = document.getElementById('srs-content');
    if (host && state.activeTab === 'srs' && state.srsSubMode === 'podcast') {
      renderPodcastPlayer(host);
    }
    speak(item.speak, () => {
      if (!state.podcastPlaying) return;
      state.podcastTimer = setTimeout(() => {
        if (!state.podcastPlaying) return;
        speakThai(item.th.replace(/\(.*?\)/g, ''), () => {
          if (!state.podcastPlaying) return;
          state.podcastTimer = setTimeout(() => {
            if (!state.podcastPlaying) return;
            state.podcastIdx = (state.podcastIdx + 1) % list.length;
            runPodcastStep();
          }, 900);
        });
      }, 1100);
    });
  }

  function renderPodcastPlayer(host) {
    const list = getPodcastList();
    const item = list[state.podcastIdx % list.length];
    host.innerHTML = `
      <div class="card-panel podcast-card">
        <div class="finals-filter" style="justify-content:center;margin-bottom:8px">
          <button type="button" class="filter-pill ${state.podcastDeck === 'level1' ? 'active' : ''}" data-pdeck="level1">Level 1 (34 คำ)</button>
          <button type="button" class="filter-pill ${state.podcastDeck === 'hsk1' ? 'active' : ''}" data-pdeck="hsk1">HSK 1 (150 คำ)</button>
          <button type="button" class="filter-pill ${state.podcastDeck === 'culture' ? 'active' : ''}" data-pdeck="culture">โซเชียล & เที่ยวจีน</button>
        </div>

        <div style="font-size:12px;color:var(--sys-label-2)">คำที่ ${(state.podcastIdx % list.length) + 1} / ${list.length} · โหมดฟังวนอัตโนมัติ (จีน → เว้นให้พูดตาม → แปลไทย)</div>
        <div class="podcast-word-hz hanzi-font">${item.hz}</div>
        <div class="podcast-word-py">${item.py}</div>
        <div class="podcast-word-th">${escapeHtml(item.th)}</div>

        <div class="podcast-controls">
          <button type="button" class="btn-secondary" id="pod-prev">← ก่อนหน้า</button>
          <button type="button" class="btn-primary" id="pod-toggle" style="min-width:140px">${state.podcastPlaying ? '⏸ หยุดเล่น' : '▶ เล่นวนอัตโนมัติ'}</button>
          <button type="button" class="btn-secondary" id="pod-next">ถัดไป →</button>
        </div>
      </div>
    `;

    host.querySelectorAll('[data-pdeck]').forEach(b => b.addEventListener('click', () => {
      stopPodcast();
      state.podcastDeck = b.dataset.pdeck;
      state.podcastIdx = 0;
      renderPodcastPlayer(host);
    }));
    document.getElementById('pod-prev').addEventListener('click', () => {
      state.podcastIdx = (state.podcastIdx - 1 + list.length) % list.length;
      if (state.podcastPlaying) { stopPodcast(); state.podcastPlaying = true; runPodcastStep(); }
      else renderPodcastPlayer(host);
    });
    document.getElementById('pod-next').addEventListener('click', () => {
      state.podcastIdx = (state.podcastIdx + 1) % list.length;
      if (state.podcastPlaying) { stopPodcast(); state.podcastPlaying = true; runPodcastStep(); }
      else renderPodcastPlayer(host);
    });
    document.getElementById('pod-toggle').addEventListener('click', () => {
      if (state.podcastPlaying) {
        stopPodcast();
        renderPodcastPlayer(host);
      } else {
        state.podcastPlaying = true;
        runPodcastStep();
      }
    });
  }

  // ---- SPEED MATCH 60s MINI-GAME ----
  const speedState = { active: false, timeLeft: 60, score: 0, combo: 0, tiles: [], selectedIdx: null, matchedCount: 0, timerId: null };

  function buildSpeedBoard() {
    const shuffled = [...allVocabWords].sort(() => Math.random() - 0.5).slice(0, 6);
    const tiles = [];
    shuffled.forEach((w, pairId) => {
      tiles.push({ pairId, kind: 'zh', text: w.hanzi, sub: w.pinyin, speakText: w.hanzi.split(' / ')[0], matched: false });
      tiles.push({ pairId, kind: 'th', text: w.meaning, sub: '', speakText: '', matched: false });
    });
    speedState.tiles = tiles.sort(() => Math.random() - 0.5);
    speedState.selectedIdx = null;
    speedState.matchedCount = 0;
  }

  function stopSpeedTimer() {
    if (speedState.timerId) { clearInterval(speedState.timerId); speedState.timerId = null; }
    speedState.active = false;
  }

  function startSpeedGame() {
    stopSpeedTimer();
    speedState.active = true;
    speedState.timeLeft = 60;
    speedState.score = 0;
    speedState.combo = 0;
    buildSpeedBoard();
    renderSpeedGame();
    speedState.timerId = setInterval(() => {
      speedState.timeLeft--;
      const clock = document.getElementById('speed-clock');
      if (clock) clock.textContent = `${speedState.timeLeft} วิ`;
      if (speedState.timeLeft <= 0) {
        stopSpeedTimer();
        const xpEarned = Math.min(120, Math.floor(speedState.score / 10));
        if (speedState.score > (state.progress.speedBest || 0)) {
          state.progress.speedBest = speedState.score;
        }
        if (xpEarned > 0) {
          state.progress.bonusXp = (state.progress.bonusXp || 0) + xpEarned;
          saveProgress(`จบเกม Speed Match (${speedState.score} แต้ม)`);
        } else {
          saveProgress();
        }
        renderSpeedGame(true);
      }
    }, 1000);
  }

  function renderSpeedGame(finished = false) {
    const host = document.getElementById('speed-content');
    if (!host) return;
    document.querySelectorAll('#game-mode-switch button').forEach(b => {
      b.classList.toggle('active', b.dataset.gmode === state.gameSubMode);
    });
    if (state.gameSubMode === 'rain') {
      renderHanziRain(host);
      return;
    }

    if (!speedState.active) {
      host.innerHTML = `
        <div class="card-panel" style="max-width:640px;margin:0 auto;text-align:center;padding:34px 24px">
          <h2 style="font-size:22px;margin-bottom:8px">${finished ? `หมดเวลา! คะแนนของคุณ ${speedState.score} แต้ม` : 'พร้อมท้าทายความไว 60 วินาทีไหม?'}</h2>
          <p style="color:var(--sys-label-2);margin:0 0 18px">
            จับคู่คำภาษาจีนกับความหมายภาษาไทยให้เร็วที่สุด · ยิ่งต่อคอมโบต่อเนื่องคะแนนยิ่งคูณ (สูงสุด x4) · สถิติสูงสุด: <b class="tabular-nums">${state.progress.speedBest || 0} แต้ม</b>
          </p>
          <button type="button" class="btn-primary" id="speed-start-btn">${finished ? 'เล่นอีกครั้ง' : 'เริ่มเกม 60 วินาที →'}</button>
        </div>
      `;
      document.getElementById('speed-start-btn').addEventListener('click', startSpeedGame);
      return;
    }

    const mult = Math.min(4, 1 + Math.floor(speedState.combo / 3));
    host.innerHTML = `
      <div class="card-panel">
        <div class="speed-hud">
          <div class="speed-stats tabular-nums">
            <span>เวลา: <b id="speed-clock" style="color:var(--sys-red-text)">${speedState.timeLeft} วิ</b></span>
            <span>คะแนน: <b style="color:var(--sys-accent-text)">${speedState.score}</b></span>
            <span>คอมโบ: <b>${speedState.combo} (x${mult})</b></span>
          </div>
          <button type="button" class="btn-secondary" id="speed-quit">หยุดเกม</button>
        </div>
        <div class="speed-grid">
          ${speedState.tiles.map((t, i) => `
            <button type="button" class="speed-tile ${t.matched ? 'matched' : ''} ${speedState.selectedIdx === i ? 'selected' : ''}" data-st="${i}" ${t.matched ? 'disabled' : ''}>
              <div class="${t.kind === 'zh' ? 'hanzi-font' : ''}" style="font-size:${t.kind === 'zh' ? '24px' : '14px'}">${escapeHtml(t.text)}</div>
              ${t.sub ? `<span style="font-size:12px;color:var(--sys-accent-text)">${t.sub}</span>` : ''}
            </button>
          `).join('')}
        </div>
      </div>
    `;

    document.getElementById('speed-quit').addEventListener('click', () => { stopSpeedTimer(); renderSpeedGame(false); });

    host.querySelectorAll('[data-st]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.st);
        const tile = speedState.tiles[idx];
        if (tile.matched) return;
        if (tile.speakText) speak(tile.speakText);

        if (speedState.selectedIdx === null) {
          speedState.selectedIdx = idx;
          renderSpeedGame();
          return;
        }
        if (speedState.selectedIdx === idx) {
          speedState.selectedIdx = null;
          renderSpeedGame();
          return;
        }

        const first = speedState.tiles[speedState.selectedIdx];
        if (first.pairId === tile.pairId && first.kind !== tile.kind) {
          first.matched = true;
          tile.matched = true;
          speedState.combo++;
          const m = Math.min(4, 1 + Math.floor(speedState.combo / 3));
          speedState.score += 10 * m;
          speedState.matchedCount++;
          speedState.selectedIdx = null;
          playChime('ok');
          if (speedState.matchedCount >= 6) {
            buildSpeedBoard();
          }
          renderSpeedGame();
        } else {
          speedState.combo = 0;
          speedState.selectedIdx = null;
          playChime('err');
          btn.classList.add('wrong');
          setTimeout(() => renderSpeedGame(), 260);
        }
      });
    });
  }

  // ---- HANZI RAIN ARCADE (ฝนอักษรจีนตกจากฟ้า) ----
  const rainState = { active: false, over: false, score: 0, lives: 3, drops: [], options: [], rafId: null, lastTs: 0, spawnAcc: 0, showPy: true };

  function stopHanziRain() {
    if (rainState.rafId) { cancelAnimationFrame(rainState.rafId); rainState.rafId = null; }
    rainState.active = false;
  }

  function spawnRainDrop() {
    const pool = allVocabWords;
    const w = pool[Math.floor(Math.random() * pool.length)];
    rainState.drops.push({
      id: Date.now() + Math.random(),
      hz: w.hanzi.split(' / ')[0],
      py: w.pinyin,
      th: w.meaning,
      x: 14 + Math.random() * 72,
      y: -36
    });
  }

  function refreshRainOptions() {
    if (!rainState.drops.length) spawnRainDrop();
    // Target is the lowest falling drop
    rainState.drops.sort((a, b) => b.y - a.y);
    const target = rainState.drops[0];
    const distractors = allVocabWords
      .filter(w => w.meaning !== target.th)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map(w => w.meaning);
    rainState.options = [target.th, ...distractors].sort(() => Math.random() - 0.5);
  }

  function startHanziRain() {
    stopHanziRain();
    rainState.active = true;
    rainState.over = false;
    rainState.score = 0;
    rainState.lives = 3;
    rainState.drops = [];
    rainState.spawnAcc = 0;
    rainState.lastTs = performance.now();
    spawnRainDrop();
    refreshRainOptions();
    renderSpeedGame();

    const step = (ts) => {
      if (!rainState.active) return;
      const dt = Math.min(0.08, (ts - rainState.lastTs) / 1000);
      rainState.lastTs = ts;
      const speed = 36 + Math.min(68, rainState.score * 0.45);
      rainState.spawnAcc += dt;
      if (rainState.spawnAcc > Math.max(1.4, 3.0 - rainState.score * 0.015) && rainState.drops.length < 4) {
        rainState.spawnAcc = 0;
        spawnRainDrop();
      }

      let missed = false;
      rainState.drops.forEach(d => { d.y += speed * dt; });
      const survivors = [];
      for (const d of rainState.drops) {
        if (d.y >= 265) {
          rainState.lives--;
          missed = true;
        } else {
          survivors.push(d);
        }
      }
      rainState.drops = survivors;

      if (missed) {
        playChime('err');
        if (rainState.lives <= 0) {
          stopHanziRain();
          rainState.over = true;
          const xpEarned = Math.min(120, Math.floor(rainState.score / 10));
          if (rainState.score > (state.progress.rainBest || 0)) state.progress.rainBest = rainState.score;
          if (xpEarned > 0) {
            state.progress.bonusXp = (state.progress.bonusXp || 0) + xpEarned;
            saveProgress(`จบเกมฝนอักษรจีน (${rainState.score} แต้ม)`);
          } else {
            saveProgress();
          }
          renderSpeedGame();
          return;
        }
        refreshRainOptions();
        renderSpeedGame();
      } else {
        // Lightweight DOM position update for 60fps smoothness
        const stage = document.getElementById('rain-stage');
        if (stage) {
          stage.innerHTML = `
            ${rainState.drops.map((d, i) => `
              <div class="rain-drop ${i === 0 ? 'target' : ''}" style="left:${d.x}%;top:${d.y.toFixed(1)}px">
                <span class="hz hanzi-font">${d.hz}</span>
                ${rainState.showPy ? `<span class="py">${d.py}</span>` : ''}
              </div>
            `).join('')}
            <div class="rain-danger-line"></div>
          `;
        }
      }

      rainState.rafId = requestAnimationFrame(step);
    };
    rainState.rafId = requestAnimationFrame(step);
  }

  function renderHanziRain(host) {
    if (!rainState.active) {
      host.innerHTML = `
        <div class="card-panel" style="max-width:640px;margin:0 auto;text-align:center;padding:34px 24px">
          <h2 style="font-size:22px;margin-bottom:8px">${rainState.over ? `เกมจบแล้ว! คะแนนของคุณ ${rainState.score} แต้ม` : 'เกมฝนอักษรจีน (Hanzi Rain)'}</h2>
          <p style="color:var(--sys-label-2);margin:0 0 18px">
            กดเลือกความหมายของตัวจีน <b>ตัวที่อยู่ต่ำสุด (กรอบสีฟ้า)</b> ให้ทันก่อนตกถึงพื้น! มีหัวใจ 3 ดวง · สถิติสูงสุด: <b class="tabular-nums">${state.progress.rainBest || 0} แต้ม</b>
          </p>
          <button type="button" class="btn-primary" id="rain-start">${rainState.over ? 'เล่นอีกครั้ง' : 'เริ่มเกมฝนอักษรจีน →'}</button>
        </div>
      `;
      document.getElementById('rain-start').addEventListener('click', startHanziRain);
      return;
    }

    const hearts = '♥ '.repeat(rainState.lives) + '♡ '.repeat(Math.max(0, 3 - rainState.lives));
    host.innerHTML = `
      <div class="card-panel">
        <div class="speed-hud">
          <div class="speed-stats tabular-nums">
            <span style="color:var(--sys-red-text)">${hearts}</span>
            <span>คะแนน: <b style="color:var(--sys-accent-text)">${rainState.score}</b></span>
          </div>
          <div style="display:flex;gap:6px">
            <button type="button" class="btn-secondary" id="rain-py">${rainState.showPy ? 'ซ่อนพินอิน' : 'แสดงพินอิน'}</button>
            <button type="button" class="btn-secondary" id="rain-quit">หยุดเกม</button>
          </div>
        </div>
        <div class="rain-stage" id="rain-stage">
          ${rainState.drops.map((d, i) => `
            <div class="rain-drop ${i === 0 ? 'target' : ''}" style="left:${d.x}%;top:${d.y.toFixed(1)}px">
              <span class="hz hanzi-font">${d.hz}</span>
              ${rainState.showPy ? `<span class="py">${d.py}</span>` : ''}
            </div>
          `).join('')}
          <div class="rain-danger-line"></div>
        </div>
        <div class="drill-options" style="margin-bottom:0">
          ${rainState.options.map((opt, idx) => `
            <button type="button" class="drill-opt" data-ropt="${escapeHtml(opt)}">${idx + 1}. ${escapeHtml(opt)}</button>
          `).join('')}
        </div>
      </div>
    `;

    document.getElementById('rain-py').addEventListener('click', () => { rainState.showPy = !rainState.showPy; renderSpeedGame(); });
    document.getElementById('rain-quit').addEventListener('click', () => { stopHanziRain(); rainState.over = false; renderSpeedGame(); });

    host.querySelectorAll('[data-ropt]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!rainState.drops.length) return;
        const target = rainState.drops[0];
        if (btn.dataset.ropt === target.th) {
          speak(target.hz);
          playChime('ok');
          rainState.score += 15;
          rainState.drops.shift();
          refreshRainOptions();
          renderSpeedGame();
        } else {
          playChime('err');
          btn.classList.add('wrong');
          rainState.score = Math.max(0, rainState.score - 5);
        }
      });
    });
  }

  // ---- WORLD 2: SENTENCE BUILDER, HSK 1 GRAMMAR & 150 WORDS ----
  let builderShuffled = [];
  let builderLoadedIdx = -1;

  function renderLevel2Page() {
    const host = document.getElementById('level2-content');
    if (!host) return;
    document.querySelectorAll('#l2-mode-switch button').forEach(b => {
      b.classList.toggle('active', b.dataset.l2mode === state.l2SubMode);
    });

    if (state.l2SubMode === 'readers') {
      const story = PRO.readers[state.selectedReader] || PRO.readers[0];
      const fullText = story.sentences.map(s => s.map(t => t.hz).join('')).join(' ');
      const insp = state.readerInsp;
      const ansMap = state.readerAnswers[story.id] || {};

      host.innerHTML = `
        <div class="reader-layout">
          <div class="pack-list">
            ${PRO.readers.map((r, idx) => `
              <button type="button" class="pack-btn ${state.selectedReader === idx ? 'active' : ''}" data-rd="${idx}">
                <span class="pack-icon">${idx + 1}</span>
                <span>
                  <b>${escapeHtml(r.title)}</b>
                  <span>${escapeHtml(r.level)}</span>
                </span>
              </button>
            `).join('')}
          </div>

          <div class="card-panel">
            <div class="dialogue-controls">
              <div>
                <h2 class="section-subtitle">${escapeHtml(story.title)}</h2>
                <p class="section-subdesc">แตะที่คำจีนคำไหนก็ได้ในเรื่องเพื่อดูพินอิน คำแปล และฟังเสียง</p>
              </div>
              <div style="display:flex;gap:6px;flex-wrap:wrap">
                <button type="button" class="btn-secondary" id="rd-toggle-py">${state.readerShowPy ? 'ซ่อนพินอิน' : 'แสดงพินอิน'}</button>
                <button type="button" class="btn-primary" id="rd-play-all">▶ ฟังทั้งเรื่อง</button>
              </div>
            </div>

            <!-- Gemini AI Custom Story Generator Bar -->
            <form class="cert-input-row" id="ai-story-form" style="margin:0 0 12px">
              <input type="text" class="sys-input" id="ai-story-topic" placeholder="สร้างเรื่องสั้นใหม่ด้วย Gemini AI เช่น สั่งกาแฟ, ไปหาหมอ, เที่ยวเซี่ยงไฮ้..." ${state.storyBusy ? 'disabled' : ''}>
              <button type="submit" class="btn-primary" ${state.storyBusy ? 'disabled' : ''}>${state.storyBusy ? 'Gemini กำลังแต่งเรื่อง...' : 'สร้างเรื่องด้วย Gemini AI'}</button>
            </form>

            <div class="reader-word-insp">
              ${insp ? `
                <div>
                  <b class="hanzi-font" style="font-size:20px">${escapeHtml(insp.hz)}</b>
                  <span style="color:var(--sys-accent-text);font-weight:700;margin:0 8px">${escapeHtml(insp.py)}</span>
                  <span>${escapeHtml(insp.th)}</span>
                </div>
                <button type="button" class="btn-secondary" id="rd-insp-speak">ฟังคำนี้</button>
              ` : `<span style="font-size:13px;color:var(--sys-label-2)">จิ้มคำศัพท์ในเนื้อเรื่องด้านล่างเพื่อแปลคำนั้นทันที</span>`}
            </div>

            <div class="reader-story">
              ${story.sentences.map((sent, si) => `
                <div class="reader-sentence">
                  ${sent.map((tok, ti) => tok.py ? `
                    <button type="button" class="tok-btn ${insp && insp.hz === tok.hz ? 'active' : ''}" data-tok="${si}-${ti}">
                      ${state.readerShowPy ? `<span class="tok-py">${tok.py}</span>` : ''}
                      <span class="tok-hz hanzi-font">${tok.hz}</span>
                    </button>
                  ` : `<span class="tok-punct hanzi-font">${tok.hz}</span>`).join('')}
                </div>
              `).join('')}
            </div>

            <h3 style="font-size:15px;margin-bottom:10px">คำถามจับใจความท้ายเรื่อง (3 ข้อ)</h3>
            <div style="display:flex;flex-direction:column;gap:12px">
              ${story.questions.map((q, qi) => {
                const chosen = ansMap[qi];
                return `
                  <div style="padding:12px;border-radius:12px;background:var(--sys-surface-2);border:1px solid var(--sys-separator)">
                    <div style="font-size:14px;font-weight:600;margin-bottom:8px">${qi + 1}. ${escapeHtml(q.q)}</div>
                    <div class="drill-options" style="margin-bottom:0">
                      ${q.options.map((opt, oi) => {
                        let cls = '';
                        if (chosen !== undefined) {
                          if (oi === q.answer) cls = 'correct';
                          else if (oi === chosen) cls = 'wrong';
                        }
                        return `<button type="button" class="drill-opt ${cls}" style="padding:9px 10px;font-size:13px" data-rq="${qi}-${oi}" ${chosen !== undefined ? 'disabled' : ''}>${escapeHtml(opt)}</button>`;
                      }).join('')}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>
      `;

      host.querySelectorAll('[data-rd]').forEach(b => b.addEventListener('click', () => {
        state.selectedReader = Number(b.dataset.rd);
        state.readerInsp = null;
        renderLevel2Page();
      }));
      document.getElementById('rd-toggle-py').addEventListener('click', () => { state.readerShowPy = !state.readerShowPy; renderLevel2Page(); });
      document.getElementById('rd-play-all').addEventListener('click', () => speak(fullText));
      document.getElementById('rd-insp-speak')?.addEventListener('click', () => { if (insp) speak(insp.hz); });

      document.getElementById('ai-story-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const topic = (document.getElementById('ai-story-topic')?.value || '').trim();
        if (!topic || state.storyBusy) return;
        if (!state.aiStatus.configured) {
          showToast('ระบบสร้างเรื่องด้วย AI ไม่พร้อมใช้งานชั่วคราว', 'AI');
          return;
        }
        if (!authState.user) {
          showToast('กรุณาเข้าสู่ระบบก่อนสร้างเรื่องสั้นด้วย AI', 'LOGIN');
          openAuthModal();
          return;
        }
        state.storyBusy = true;
        renderLevel2Page();
        try {
          const res = await fetch('/api/ai/story', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ topic: topic.slice(0, 200) })
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || !data.story) throw new Error(data.error || 'สร้างเรื่องไม่สำเร็จ');
          PRO.readers.unshift(data.story);
          state.selectedReader = 0;
          state.readerInsp = null;
          state.storyBusy = false;
          state.progress.bonusXp = (state.progress.bonusXp || 0) + 15;
          saveProgress(`สร้างเรื่องสั้น AI: ${topic}`);
          renderLevel2Page();
        } catch (err) {
          state.storyBusy = false;
          playChime('err');
          showToast(err.message || 'ระบบสร้างเรื่องด้วย AI ไม่พร้อมใช้งานชั่วคราว', 'AI');
          renderLevel2Page();
        }
      });

      host.querySelectorAll('[data-tok]').forEach(btn => {
        btn.addEventListener('click', () => {
          const [si, ti] = btn.dataset.tok.split('-').map(Number);
          const tok = story.sentences[si][ti];
          state.readerInsp = tok;
          speak(tok.hz);
          renderLevel2Page();
        });
      });

      host.querySelectorAll('[data-rq]').forEach(btn => {
        btn.addEventListener('click', () => {
          const [qi, oi] = btn.dataset.rq.split('-').map(Number);
          if (!state.readerAnswers[story.id]) state.readerAnswers[story.id] = {};
          state.readerAnswers[story.id][qi] = oi;
          if (oi === story.questions[qi].answer) {
            state.progress.bonusXp = (state.progress.bonusXp || 0) + 15;
            saveProgress('ตอบคำถามเรื่องสั้นถูก');
          } else {
            playChime('err');
          }
          renderLevel2Page();
        });
      });
      return;
    }

    if (state.l2SubMode === 'radicals') {
      host.innerHTML = `
        <div class="radicals-grid">
          ${PRO.radicals.map(r => `
            <div class="rad-card">
              <div class="rad-top">
                <div class="rad-glyph hanzi-font">${r.rad}</div>
                <div class="rad-meta">
                  <b>${escapeHtml(r.th)}</b>
                  <span class="hanzi-font">${escapeHtml(r.name)}</span>
                </div>
              </div>
              <p class="rad-tip">${escapeHtml(r.tip)}</p>
              <div class="rad-examples">
                ${r.examples.map(([hz, py, th]) => `
                  <button type="button" class="rad-ex-btn" data-speak="${hz}">
                    <span class="hanzi-font">${hz}</span> ${py} (${escapeHtml(th)})
                  </button>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      `;
      host.querySelectorAll('[data-speak]').forEach(b => b.addEventListener('click', () => speak(b.dataset.speak)));
      return;
    }

    if (state.l2SubMode === 'culture') {
      host.innerHTML = FUN.cultureGroups.map(grp => `
        <div style="margin-bottom:22px">
          <h2 class="section-subtitle" style="margin-bottom:10px">${escapeHtml(grp.name)}</h2>
          <div class="rules-grid">
            ${grp.items.map(it => `
              <div class="rule-card">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:6px">
                  <div>
                    <div class="hanzi-font" style="font-size:22px;font-weight:700">${escapeHtml(it.hz)}</div>
                    <div style="font-size:13px;font-weight:600;color:var(--sys-accent-text)">${escapeHtml(it.py)}</div>
                  </div>
                  <button type="button" class="btn-secondary" data-speak="${escapeHtml(it.speak)}">ฟัง</button>
                </div>
                <div style="font-size:14px;font-weight:600;margin-bottom:4px">${escapeHtml(it.th)}</div>
                <p style="margin:0">${escapeHtml(it.tip)}</p>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('');
      host.querySelectorAll('[data-speak]').forEach(b => b.addEventListener('click', () => speak(b.dataset.speak)));
      return;
    }

    if (state.l2SubMode === 'grammar') {
      host.innerHTML = `
        <div class="rules-grid">
          ${L2.grammarPatterns.map(gp => `
            <div class="rule-card">
              <h4>${escapeHtml(gp.title)}</h4>
              <div class="rule-formula">${escapeHtml(gp.formula)}</div>
              <p>${escapeHtml(gp.tip)}</p>
              <div style="display:flex;flex-direction:column;gap:6px">
                ${gp.examples.map(ex => `
                  <button type="button" class="rule-example" data-speak="${ex.hz}" style="width:100%;text-align:left">
                    <span>
                      <b class="hanzi-font" style="font-size:16px">${ex.hz}</b>
                      <span style="color:var(--sys-accent-text);font-weight:600;margin-left:6px">${ex.py}</span>
                      <div style="font-size:12px;color:var(--sys-label-2)">${escapeHtml(ex.th)}</div>
                    </span>
                    <span class="btn-secondary">ฟัง</span>
                  </button>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      `;
      host.querySelectorAll('[data-speak]').forEach(b => b.addEventListener('click', () => speak(b.dataset.speak)));
      return;
    }

    if (state.l2SubMode === 'culture') {
      host.innerHTML = FUN.cultureGroups.map(grp => `
        <div style="margin-bottom:22px">
          <h2 class="section-subtitle" style="margin-bottom:10px">${escapeHtml(grp.name)}</h2>
          <div class="rules-grid">
            ${grp.items.map(it => `
              <div class="rule-card">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:6px">
                  <div>
                    <div class="hanzi-font" style="font-size:22px;font-weight:700">${escapeHtml(it.hz)}</div>
                    <div style="font-size:13px;font-weight:600;color:var(--sys-accent-text)">${escapeHtml(it.py)}</div>
                  </div>
                  <button type="button" class="btn-secondary" data-speak="${escapeHtml(it.speak)}">ฟัง</button>
                </div>
                <div style="font-size:14px;font-weight:600;margin-bottom:4px">${escapeHtml(it.th)}</div>
                <p style="margin:0">${escapeHtml(it.tip)}</p>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('');
      host.querySelectorAll('[data-speak]').forEach(b => b.addEventListener('click', () => speak(b.dataset.speak)));
      return;
    }

    if (state.l2SubMode === 'hsk1') {
      const cats = ['all', ...Array.from(new Set(L2.hsk1Words.map(w => w.cat)))];
      const q = state.hskQuery.trim().toLowerCase();
      const filtered = L2.hsk1Words.filter(w => {
        if (state.hskCat !== 'all' && w.cat !== state.hskCat) return false;
        if (!q) return true;
        return w.hz.includes(q) || w.py.toLowerCase().includes(q) || w.th.toLowerCase().includes(q);
      });

      host.innerHTML = `
        <div class="hsk-toolbar">
          <div class="finals-filter" style="margin:0">
            ${cats.map(c => `<button type="button" class="filter-pill ${state.hskCat === c ? 'active' : ''}" data-hcat="${c}">${c === 'all' ? 'ทั้งหมด (' + L2.hsk1Words.length + ')' : c}</button>`).join('')}
          </div>
          <input type="search" class="sys-input" id="hsk-search" value="${escapeHtml(state.hskQuery)}" placeholder="ค้นหาคำจีน / พินอิน / ไทย..." style="max-width:240px">
        </div>
        <div class="hsk-grid">
          ${filtered.map(w => `
            <button type="button" class="hsk-card" data-speak="${w.hz.split(' / ')[0]}">
              <div>
                <span class="hz hanzi-font">${w.hz}</span>
                <span class="py">${w.py}</span>
                <span class="th">${escapeHtml(w.th)}</span>
              </div>
              <span style="font-size:11px;color:var(--sys-label-3)">ฟัง</span>
            </button>
          `).join('')}
        </div>
      `;

      host.querySelectorAll('[data-hcat]').forEach(btn => {
        btn.addEventListener('click', () => { state.hskCat = btn.dataset.hcat; renderLevel2Page(); });
      });
      document.getElementById('hsk-search')?.addEventListener('input', (e) => {
        state.hskQuery = e.target.value;
        renderLevel2Page();
        const inp = document.getElementById('hsk-search');
        if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
      });
      host.querySelectorAll('[data-speak]').forEach(btn => {
        btn.addEventListener('click', () => speak(btn.dataset.speak));
      });
      return;
    }

    // Sentence Builder Mode (20 Challenges)
    const item = L2.sentenceBuilder[state.builderIdx % L2.sentenceBuilder.length];
    if (builderLoadedIdx !== state.builderIdx) {
      builderLoadedIdx = state.builderIdx;
      builderShuffled = item.tokens.map((t, i) => ({ ...t, origIdx: i })).sort(() => Math.random() - 0.5);
      state.builderPicked = [];
      state.builderChecked = false;
    }

    const pickedObjs = state.builderPicked.map(si => ({ ...builderShuffled[si], shufIdx: si }));
    const assembled = pickedObjs.map(o => o.hz).join('');
    const targetSentence = item.tokens.map(t => t.hz).join('');
    const isCorrect = state.builderChecked && assembled === targetSentence;

    host.innerHTML = `
      <div class="card-panel builder-wrap">
        <div class="drill-topbar">
          <span>เกมเรียงคำแต่งประโยค · ข้อที่ ${(state.builderIdx % L2.sentenceBuilder.length) + 1} / ${L2.sentenceBuilder.length}</span>
          <button type="button" class="btn-secondary" id="bld-toggle-py">${state.builderShowPy ? 'ซ่อนพินอิน' : 'แสดงพินอิน'}</button>
        </div>

        <div style="font-size:13px;color:var(--sys-label-2);margin-bottom:4px">แต่งประโยคภาษาจีนให้ตรงกับความหมาย:</div>
        <h2 style="font-size:21px;margin-bottom:6px">“${escapeHtml(item.thai)}”</h2>

        <div class="builder-slots" id="bld-slots">
          ${pickedObjs.length
            ? pickedObjs.map((o, pos) => `
                <button type="button" class="word-chip in-slot" data-unpick="${pos}" ${state.builderChecked ? 'disabled' : ''}>
                  <span class="hz hanzi-font">${o.hz}</span>
                  ${state.builderShowPy ? `<span class="py">${o.py}</span>` : ''}
                </button>
              `).join('')
            : `<span style="font-size:13px;color:var(--sys-label-3)">กดเลือกคำด้านล่างเพื่อเรียงประโยค...</span>`}
        </div>

        <div class="builder-pool">
          ${builderShuffled.map((o, si) => {
            const used = state.builderPicked.includes(si);
            return `
              <button type="button" class="word-chip" data-pick="${si}" ${used || state.builderChecked ? 'disabled' : ''}>
                <span class="hz hanzi-font">${o.hz}</span>
                ${state.builderShowPy ? `<span class="py">${o.py}</span>` : ''}
              </button>
            `;
          }).join('')}
        </div>

        ${state.builderChecked ? `
          <div class="drill-feedback show ${isCorrect ? 'ok' : 'err'}">
            ${isCorrect
              ? `<b>ถูกต้อง! (+20 XP) ✓</b> <span class="hanzi-font">${targetSentence}</span> (${item.tokens.map(t => t.py).join(' ')}) — ${escapeHtml(item.note)}`
              : `<b>ยังไม่ตรงลำดับ</b> ประโยคที่ถูกคือ: <b class="hanzi-font">${targetSentence}</b> (${item.tokens.map(t => t.py).join(' ')}) · ${escapeHtml(item.note)}`}
          </div>
        ` : ''}

        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
          <div style="display:flex;gap:6px">
            <button type="button" class="btn-secondary" id="bld-clear" ${state.builderChecked ? 'disabled' : ''}>ล้างคำ</button>
            <button type="button" class="btn-secondary" id="bld-listen">ฟังเสียงเฉลย</button>
          </div>
          ${state.builderChecked
            ? `<button type="button" class="btn-primary" id="bld-next">ประโยคถัดไป →</button>`
            : `<button type="button" class="btn-primary" id="bld-check" ${pickedObjs.length === item.tokens.length ? '' : 'disabled'}>ตรวจประโยค</button>`}
        </div>
      </div>
    `;

    document.getElementById('bld-toggle-py').addEventListener('click', () => { state.builderShowPy = !state.builderShowPy; renderLevel2Page(); });
    document.getElementById('bld-listen').addEventListener('click', () => speak(targetSentence));
    document.getElementById('bld-clear')?.addEventListener('click', () => { state.builderPicked = []; renderLevel2Page(); });

    host.querySelectorAll('[data-pick]').forEach(btn => {
      btn.addEventListener('click', () => {
        const si = Number(btn.dataset.pick);
        if (!state.builderPicked.includes(si)) {
          state.builderPicked.push(si);
          speak(builderShuffled[si].hz);
          renderLevel2Page();
        }
      });
    });

    host.querySelectorAll('[data-unpick]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.builderPicked.splice(Number(btn.dataset.unpick), 1);
        renderLevel2Page();
      });
    });

    document.getElementById('bld-check')?.addEventListener('click', () => {
      state.builderChecked = true;
      const ans = state.builderPicked.map(si => builderShuffled[si].hz).join('');
      if (ans === targetSentence) {
        state.progress.bonusXp = (state.progress.bonusXp || 0) + 20;
        saveProgress('แต่งประโยคถูกต้อง!');
        speak(targetSentence);
      } else {
        playChime('err');
      }
      renderLevel2Page();
    });

    document.getElementById('bld-next')?.addEventListener('click', () => {
      state.builderIdx = (state.builderIdx + 1) % L2.sentenceBuilder.length;
      renderLevel2Page();
    });
  }

  // ---- WORLD 2: INTERACTIVE CHINESE CONVERSATION TUTOR ----
  function generateTutorReply(inputRaw) {
    const text = inputRaw.trim();
    const low = text.toLowerCase();

    if (/再见|拜拜|zaijian|bye/.test(low)) {
      return {
        hz: '再见！今天你学得很好，明天见！',
        py: 'Zàijiàn! Jīntiān nǐ xué de hěn hǎo, míngtiān jiàn!',
        th: 'ลาก่อน! วันนี้คุณเรียนได้ดีมาก เจอกันพรุ่งนี้นะ!',
        tip: '再见 (zàijiàn) แปลตรงตัวว่า "พบกันอีกครั้ง"'
      };
    }
    if (/谢谢|感谢|xiexie/.test(low)) {
      return {
        hz: '不客气！我们继续练习吧。你喜欢喝茶还是喝水？',
        py: 'Bú kèqi! Wǒmen jìxù liànxí ba. Nǐ xǐhuan hē chá háishi hē shuǐ?',
        th: 'ไม่เป็นไรเลย! เรามาฝึกกันต่อนะ คุณชอบดื่มชาหรือดื่มน้ำ?',
        tip: 'จำกฎผันเสียง: 不客气 อ่านว่า bú kèqi (ไม่ผันเป็น bù)'
      };
    }
    if (/对不起|不好意思|duibuqi/.test(low)) {
      return {
        hz: '没关系！学语言不怕错，多说就会进步。',
        py: 'Méi guānxi! Xué yǔyán bú pà cuò, duō shuō jiù huì jìnbù.',
        th: 'ไม่เป็นไร! เรียนภาษาไม่ต้องกลัวผิด พูดบ่อยๆ ก็จะเก่งขึ้นเอง',
        tip: 'เวลาตอบรับ 对不起 ให้ใช้ 没关系 (méi guānxi)'
      };
    }
    if (/我叫|我是|名字|泰国/.test(text)) {
      return {
        hz: '很高兴认识你！你的中文很不错。你今天想喝茶吗？',
        py: 'Hěn gāoxìng rènshi nǐ! Nǐ de Zhōngwén hěn búcuò. Nǐ jīntiān xiǎng hē chá ma?',
        th: 'ยินดีมากที่ได้รู้จักคุณ! ภาษาจีนของคุณไม่เลวเลย วันนี้คุณอยากดื่มชาไหม?',
        tip: 'โครงสร้างแนะนำตัวที่เป๊ะมาก: 我叫 [ชื่อ] + 我是泰国人 (ฉันเป็นคนไทย)'
      };
    }
    if (/喝|茶|水|吃|米饭|苹果|咖啡/.test(text)) {
      return {
        hz: '太好了！我也喜欢。一杯茶十块钱，你想买吗？',
        py: 'Tài hǎo le! Wǒ yě xǐhuan. Yì bēi chá shí kuài qián, nǐ xiǎng mǎi ma?',
        th: 'ดีเลย! ฉันก็ชอบเหมือนกัน ชา 1 แก้วราคา 10 หยวน คุณอยากซื้อไหม?',
        tip: 'สังเกตลักษณะนาม: 一杯茶 (yì bēi chá = ชา 1 แก้ว) เรียงตัวเลข+ลักษณะนามไว้หน้าคำนาม'
      };
    }
    if (/几点|时间|现在/.test(text)) {
      const now = new Date();
      const h = now.getHours();
      const m = now.getMinutes();
      return {
        hz: `现在是 ${h} 点 ${m} 分。你每天学习中文吗？`,
        py: `Xiànzài shì ${h} diǎn ${m} fēn. Nǐ měitiān xuéxí Zhōngwén ma?`,
        th: `ตอนนี้เวลา ${h} โมง ${m} นาที คุณเรียนภาษาจีนทุกวันไหม?`,
        tip: 'บอกเวลาในภาษาจีนใช้ [ชั่วโมง] 点 (diǎn) + [นาที] 分 (fēn)'
      };
    }
    if (/多少|钱|买/.test(text)) {
      return {
        hz: '这个苹果五块钱，很便宜！你要几个？',
        py: 'Zhège píngguǒ wǔ kuài qián, hěn piányi! Nǐ yào jǐ gè?',
        th: 'แอปเปิลลูกนี้ 5 หยวน ถูกมาก! คุณจะเอากี่ลูกดี?',
        tip: 'ถามราคาใช้ 多少钱 (duōshao qián), หน่วยเงินพูดว่า 块 (kuài)'
      };
    }
    if (/你好|您好|nihao|hello|hi/.test(low)) {
      return {
        hz: '你好！欢迎来练习中文。你叫什么名字？你是泰国人吗？',
        py: 'Nǐ hǎo! Huānyíng lái liànxí Zhōngwén. Nǐ jiào shénme míngzi? Nǐ shì Tàiguórén ma?',
        th: 'สวัสดี! ยินดีต้อนรับสู่การฝึกภาษาจีน คุณชื่ออะไร และเป็นคนไทยใช่ไหม?',
        tip: 'ลองตอบกลับว่า "我叫...，我是泰国人。" ดูสิ!'
      };
    }

    return {
      hz: `你说得很好！“${text}” — 你可以用“我想…”或“我喜欢…”再说一句吗？`,
      py: `Nǐ shuō de hěn hǎo! Nǐ kěyǐ yòng "wǒ xiǎng..." huò "wǒ xǐhuan..." zài shuō yí jù ma?`,
      th: `คุณพิมพ์/พูดได้ดีมาก! ลองใช้โครงสร้าง "我想... (ฉันอยาก...)" หรือ "我喜欢... (ฉันชอบ...)" แต่งอีกประโยคดูนะ`,
      tip: 'เคล็ดลับ: กดปุ่มประโยคตัวอย่างด้านล่าง หรือกดปุ่มไมค์เพื่อฝึกพูดคุยด้วยเสียงจริงได้'
    };
  }

  function getTutorFocusWords() {
    const out = [];
    const seen = new Set();
    const pushWord = (w) => {
      if (!w || !w.hanzi || seen.has(w.hanzi) || out.length >= 5) return;
      seen.add(w.hanzi);
      out.push({ hanzi: w.hanzi, pinyin: w.pinyin || '', meaning: w.meaning || '' });
    };

    // 1. Prioritize recent vocab mistakes
    if (Array.isArray(state.progress.vocabMistakes)) {
      state.progress.vocabMistakes.slice(0, 3).forEach(pushWord);
    }
    // 2. Add words learned today (if LEXICON is loaded)
    if (LEXICON.length > 0 && out.length < 5) {
      const todayPool = getVocabQuizPool('today');
      todayPool.slice(0, 5 - out.length).forEach(pushWord);
    }
    // 3. Fallback to Level 1 mistakes if any
    if (out.length < 5 && Array.isArray(state.progress.mistakes)) {
      state.progress.mistakes.slice(0, 5 - out.length).forEach((m) => {
        if (m && m.hanzi) pushWord(m);
      });
    }
    return out;
  }

  const TUTOR_SCENARIOS = [
    {
      id: '',
      label: '💬 คุยอิสระ',
      greeting: {
        hz: '你好！我是你的中文老师。今天你想聊什么？',
        py: 'Nǐ hǎo! Wǒ shì nǐ de Zhōngwén lǎoshī. Jīntiān nǐ xiǎng liáo shénme?',
        th: 'สวัสดี! ฉันคือครูสอนภาษาจีนของคุณ วันนี้อยากคุยเรื่องอะไรดี?',
        tip: 'ลองทักทายหรือถามอะไรก็ได้เป็นภาษาจีน พินอิน หรือภาษาไทย'
      }
    },
    {
      id: 'restaurant',
      label: '🍜 สั่งอาหาร & ชานม',
      greeting: {
        hz: '欢迎光临！请问您想喝什么奶茶，还是想点菜？',
        py: 'Huānyíng guānglín! Qǐngwèn nín xiǎng hē shénme nǎichá, háishi xiǎng diǎncài?',
        th: 'ยินดีต้อนรับครับ! ไม่ทราบว่าอยากดื่มชานมอะไร หรืออยากสั่งอาหารดีครับ?',
        tip: 'ลองตอบว่า "我要一杯珍珠奶茶，少糖少冰。" (ขอชานมไข่มุก 1 แก้ว หวานน้อย น้ำแข็งน้อย)'
      }
    },
    {
      id: 'shopping',
      label: '🛍️ ต่อราคา & สแกนจ่าย',
      greeting: {
        hz: '你好！看看吧，这件衣服很好看，喜欢可以试一下！',
        py: 'Nǐ hǎo! Kànkan ba, zhè jiàn yīfu hěn hǎokàn, xǐhuan kěyǐ shì yíxià!',
        th: 'สวัสดีครับ! ลองดูได้เลย เสื้อตัวนี้สวยมาก ถ้าชอบลองใส่ได้นะครับ!',
        tip: 'ลองถามราคาว่า "这个多少钱？可以便宜一点吗？" (อันนี้ราคาเท่าไร ลดหน่อยได้ไหม?)'
      }
    },
    {
      id: 'taxi',
      label: '🚕 นั่งแท็กซี่ & ถามทาง',
      greeting: {
        hz: '你好！请问你要去哪里？',
        py: 'Nǐ hǎo! Qǐngwèn nǐ yào qù nǎlǐ?',
        th: 'สวัสดีครับ! ไม่ทราบว่าจะไปที่ไหนครับ?',
        tip: 'ลองตอบว่า "我要去机场，大概需要多久？" (ฉันจะไปสนามบิน ใช้เวลาประมาณเท่าไร?)'
      }
    },
    {
      id: 'hotel',
      label: '🏨 เช็คอินโรงแรม',
      greeting: {
        hz: '您好，欢迎入住！请问您有预订房间吗？请给我看一下护照。',
        py: 'Nínhǎo, huānyíng rùzhù! Qǐngwèn nín yǒu yùdìng fángjiān ma? Qǐng gěi wǒ kàn yíxià hùzhào.',
        th: 'สวัสดีครับ ยินดีต้อนรับเข้าพัก! ไม่ทราบว่าจองห้องไว้ไหมครับ ขอชมพาสปอร์ตหน่อยครับ',
        tip: 'ลองตอบว่า "我有预订，这是我的护照。房间有Wi-Fi吗？" (ฉันจองไว้แล้ว นี่พาสปอร์ตค่ะ ห้องมี Wi-Fi ไหม?)'
      }
    }
  ];

  function renderTutorPage() {
    const host = document.getElementById('tutor-content');
    if (!host) return;
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    const aiReady = state.aiStatus.configured;
    const aiLoggedIn = Boolean(authState.user);
    const quotaText = state.aiUsage ? ` · เหลือ ${state.aiUsage.remaining}/${state.aiUsage.limit} ครั้งวันนี้` : '';
    if (typeof state.tutorUseFocusWords !== 'boolean') state.tutorUseFocusWords = true;
    if (typeof state.tutorScenario !== 'string') state.tutorScenario = '';
    const focusWords = getTutorFocusWords();

    host.innerHTML = `
      <div class="card-panel tutor-shell">
        <div class="section-row" style="padding-bottom:10px;border-bottom:1px solid var(--sys-separator);gap:8px;flex-wrap:wrap">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span class="${aiReady && aiLoggedIn ? 'day-badge-score' : 'day-badge-now'}">
              ${!aiReady
                ? 'ครู AI ไม่พร้อมใช้งานชั่วคราว (ใช้โหมดออฟไลน์แทนได้)'
                : aiLoggedIn
                  ? `ครู AI พร้อมใช้งาน (${escapeHtml(state.aiStatus.model)})${quotaText}`
                  : 'เข้าสู่ระบบเพื่อคุยกับครู AI (ตอนนี้ใช้โหมดออฟไลน์)'}
            </span>
            ${aiReady && !aiLoggedIn ? `<button type="button" class="btn-primary" id="tutor-login-btn" style="padding:4px 10px;font-size:12px">เข้าสู่ระบบ</button>` : ''}
          </div>
          <button type="button" class="btn-secondary" id="tutor-reset-chat">เริ่มบทสนทนาใหม่</button>
        </div>

        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:8px 0;border-bottom:1px solid var(--sys-separator)">
          <span style="font-size:12px;color:var(--sys-label-2);font-weight:600">🎭 โหมดจำลองสถานการณ์:</span>
          ${TUTOR_SCENARIOS.map(sc => `
            <button type="button" class="${state.tutorScenario === sc.id ? 'btn-primary' : 'btn-secondary'}" data-tscenario="${escapeHtml(sc.id)}" style="padding:4px 10px;font-size:12px">${escapeHtml(sc.label)}</button>
          `).join('')}
        </div>

        ${focusWords.length > 0 ? `
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:8px 0;border-bottom:1px solid var(--sys-separator);font-size:12px">
            <button type="button" class="${state.tutorUseFocusWords ? 'btn-primary' : 'btn-secondary'}" id="tutor-focus-toggle" style="padding:3px 9px;font-size:12px">
              ${state.tutorUseFocusWords ? '🎯 เน้นคำเป้าหมาย: เปิด' : '🎯 เน้นคำเป้าหมาย: ปิด'}
            </button>
            ${focusWords.map(w => `<span class="vtab-pill" style="font-size:12px;padding:2px 8px" title="${escapeHtml(w.pinyin + ' · ' + w.meaning)}">${escapeHtml(w.hanzi)}</span>`).join('')}
          </div>
        ` : ''}

        <div class="tutor-messages" id="tutor-messages">
          ${state.tutorLog.map(m => `
            <button type="button" class="chat-bubble ${m.from === 'user' ? 'side-b' : ''}" data-speak="${escapeHtml(m.hz)}">
              <div class="chat-role">${m.from === 'bot' ? (m.viaAi ? 'Gemini 老师 · กดฟัง' : '老师 · คู่ซ้อมภาษาจีน (กดฟัง)') : 'คุณ'}</div>
              <div class="chat-hanzi hanzi-font">${escapeHtml(m.hz)}</div>
              ${m.py ? `<div class="chat-py">${escapeHtml(m.py)}</div>` : ''}
              ${m.th ? `<div class="chat-th">${escapeHtml(m.th)}</div>` : ''}
              ${m.correction ? `<div class="tutor-tip" style="color:var(--sys-orange-text);background:var(--sys-orange-tint);border-color:transparent">แก้ประโยค: ${escapeHtml(m.correction)}</div>` : ''}
              ${m.tip ? `<div class="tutor-tip">ไวยากรณ์: ${escapeHtml(m.tip)}</div>` : ''}
            </button>
          `).join('')}
          ${state.tutorBusy ? `<div class="chat-bubble"><div class="chat-role">Gemini 老师</div><div style="font-size:13px;color:var(--sys-label-2)">กำลังพิมพ์คำตอบภาษาจีน...</div></div>` : ''}
        </div>

        <div class="tutor-quick-bar">
          ${L2.tutorQuickReplies.map(qr => `<button type="button" class="btn-secondary" data-tquick="${escapeHtml(qr)}" ${state.tutorBusy ? 'disabled' : ''}>${escapeHtml(qr)}</button>`).join('')}
        </div>

        <form class="tutor-input-row" id="tutor-form">
          <input type="text" class="sys-input" id="tutor-input" maxlength="500" placeholder="พิมพ์ภาษาจีน พินอิน หรือภาษาไทยเพื่อถามครู AI..." autocomplete="off" ${state.tutorBusy ? 'disabled' : ''}>
          ${SpeechRec ? `<button type="button" class="btn-secondary" id="tutor-mic" ${state.tutorBusy ? 'disabled' : ''}>พูดใส่ไมค์</button>` : ''}
          <button type="submit" class="btn-primary" ${state.tutorBusy ? 'disabled' : ''}>${state.tutorBusy ? '...' : 'ส่ง'}</button>
        </form>
      </div>

      <!-- AI Sentence X-Ray (Grammar & Word-by-Word Breakdown) -->
      <div class="card-panel" style="margin-top:14px">
        <div class="section-row" style="margin-bottom:8px;flex-wrap:wrap;gap:6px">
          <div>
            <h2 class="section-subtitle" style="margin:0">🔍 ผ่าประโยค & ไวยากรณ์จีน (AI Sentence X-Ray)</h2>
            <p class="section-subdesc" style="margin:2px 0 0">วางประโยคจีนจากซีรีส์/TikTok/บทเรียน เพื่อแยกคำศัพท์ หน้าที่คำ และโครงสร้างไวยากรณ์แบบคนไทยเข้าใจง่าย</p>
          </div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
          ${['我把作业做完了。', '他跑得很快。', '我去过中国两次。', '虽然很累，但是我很开心。'].map(ex => `
            <button type="button" class="btn-secondary" data-xray-sample="${escapeHtml(ex)}" style="font-size:12px;padding:3px 9px">${escapeHtml(ex)}</button>
          `).join('')}
        </div>
        <form class="tutor-input-row" id="xray-form">
          <input type="text" class="sys-input" id="xray-input" maxlength="180" value="${escapeHtml(state.xrayQuery || '')}" placeholder="วางประโยคภาษาจีนที่ต้องการผ่าโครงสร้าง..." autocomplete="off" ${state.xrayBusy ? 'disabled' : ''}>
          <button type="submit" class="btn-primary" ${state.xrayBusy ? 'disabled' : ''}>${state.xrayBusy ? 'กำลังผ่า...' : '🔍 ผ่าประโยค'}</button>
        </form>
        ${state.xrayResult ? `
          <div style="margin-top:12px;padding:12px;border-radius:12px;background:var(--sys-fill-2)">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
              <div>
                <div class="hanzi-font" style="font-size:20px;font-weight:700">${escapeHtml(state.xrayResult.sentence)}</div>
                <div style="font-size:13px;color:var(--sys-accent-text)">${escapeHtml(state.xrayResult.pinyin)}</div>
                <div style="font-size:14px;color:var(--sys-label-2);margin-top:2px">${escapeHtml(state.xrayResult.translation)}</div>
              </div>
              <button type="button" class="btn-secondary" data-speak="${escapeHtml(state.xrayResult.sentence)}">🔊 ฟังทั้งประโยค</button>
            </div>
            ${state.xrayResult.pattern ? `<div style="margin-top:8px;font-size:12.5px;padding:6px 10px;border-radius:8px;background:var(--sys-bg)"><b>📐 โครงสร้าง:</b> ${escapeHtml(state.xrayResult.pattern)}</div>` : ''}
            <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px">
              ${(state.xrayResult.tokens || []).map(t => `
                <button type="button" data-speak="${escapeHtml(t.hz)}" style="text-align:left;padding:8px 10px;border-radius:10px;border:1px solid var(--sys-separator);background:var(--sys-bg);cursor:pointer;min-width:86px">
                  <div class="hanzi-font" style="font-size:17px;font-weight:700">${escapeHtml(t.hz)}</div>
                  <div style="font-size:11.5px;color:var(--sys-accent-text)">${escapeHtml(t.py)}</div>
                  <div style="font-size:11px;color:var(--sys-label-3)">${escapeHtml(t.pos)}</div>
                  <div style="font-size:12px;color:var(--sys-label-2);margin-top:2px">${escapeHtml(t.th)}</div>
                </button>
              `).join('')}
            </div>
            ${Array.isArray(state.xrayResult.grammarNotes) && state.xrayResult.grammarNotes.length ? `
              <ul style="margin:10px 0 0;padding-left:18px;font-size:13px;line-height:1.6;color:var(--sys-label-2)">
                ${state.xrayResult.grammarNotes.map(n => `<li>${escapeHtml(n)}</li>`).join('')}
              </ul>
            ` : ''}
          </div>
        ` : ''}
      </div>
    `;

    const msgBox = document.getElementById('tutor-messages');
    if (msgBox) msgBox.scrollTop = msgBox.scrollHeight;

    document.getElementById('tutor-login-btn')?.addEventListener('click', () => {
      openAuthModal();
    });

    document.getElementById('tutor-focus-toggle')?.addEventListener('click', () => {
      state.tutorUseFocusWords = !state.tutorUseFocusWords;
      renderTutorPage();
    });

    host.querySelectorAll('[data-tscenario]').forEach(btn => {
      btn.addEventListener('click', () => {
        const scId = btn.dataset.tscenario || '';
        const sc = TUTOR_SCENARIOS.find(s => s.id === scId) || TUTOR_SCENARIOS[0];
        state.tutorScenario = sc.id;
        state.tutorLog = [{ from: 'bot', ...sc.greeting }];
        renderTutorPage();
      });
    });

    document.getElementById('tutor-reset-chat')?.addEventListener('click', () => {
      const sc = TUTOR_SCENARIOS.find(s => s.id === state.tutorScenario) || TUTOR_SCENARIOS[0];
      state.tutorLog = [{ from: 'bot', ...sc.greeting }];
      renderTutorPage();
    });

    const sendUserMsg = async (txt) => {
      const clean = txt.trim().slice(0, 500);
      if (!clean || state.tutorBusy) return;

      // Capture last 8 messages BEFORE pushing current user turn for multi-turn memory
      const history = state.tutorLog
        .slice(-8)
        .map(m => ({
          role: m.from === 'user' ? 'user' : 'model',
          text: String(m.hz || '').trim().slice(0, 500)
        }))
        .filter(m => m.text);

      const activeFocusWords = state.tutorUseFocusWords ? getTutorFocusWords() : [];
      state.tutorLog.push({ from: 'user', hz: clean });

      if (state.aiStatus.configured && authState.user) {
        state.tutorBusy = true;
        renderTutorPage();
        try {
          const res = await fetch('/api/ai/tutor', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
              message: clean,
              history,
              focusWords: activeFocusWords,
              scenario: state.tutorScenario || ''
            })
          });
          const data = await res.json().catch(() => ({}));
          if (data.usage) state.aiUsage = data.usage;
          if (!res.ok || !data.reply) throw new Error(data.error || 'ครู AI ไม่พร้อมใช้งานชั่วคราว');
          state.tutorLog.push({ from: 'bot', viaAi: true, ...data.reply });
          state.tutorBusy = false;
          state.progress.bonusXp = (state.progress.bonusXp || 0) + 10;
          saveProgress('คุยกับครู Gemini AI');
          renderTutorPage();
          speak(data.reply.hz);
          return;
        } catch (err) {
          state.tutorBusy = false;
          showToast(err.message || 'ครู AI ไม่พร้อมใช้งานชั่วคราว — ใช้โหมดออฟไลน์แทน', 'AI');
        }
      }

      const reply = generateTutorReply(clean);
      state.tutorLog.push({ from: 'bot', ...reply });
      state.progress.bonusXp = (state.progress.bonusXp || 0) + 5;
      saveProgress('ฝึกสนทนาภาษาจีน');
      renderTutorPage();
      speak(reply.hz);
    };

    host.querySelectorAll('[data-speak]').forEach(b => b.addEventListener('click', () => speak(b.dataset.speak)));
    host.querySelectorAll('[data-tquick]').forEach(b => b.addEventListener('click', () => sendUserMsg(b.dataset.tquick)));

    const runSentenceXray = async (rawSentence) => {
      const sentence = String(rawSentence || '').trim().slice(0, 180);
      if (!sentence || state.xrayBusy) return;
      if (!authState.user) {
        showToast('กรุณาเข้าสู่ระบบก่อนใช้งาน AI ผ่าประโยค', 'LOGIN');
        openAuthModal();
        return;
      }
      state.xrayQuery = sentence;
      state.xrayBusy = true;
      renderTutorPage();
      try {
        const res = await fetch('/api/ai/tutor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ mode: 'xray', sentence })
        });
        const data = await res.json().catch(() => ({}));
        if (data.usage) state.aiUsage = data.usage;
        if (!res.ok || !data.xray) throw new Error(data.error || 'ไม่สามารถผ่าประโยคได้ชั่วคราว');
        state.xrayResult = data.xray;
        state.progress.bonusXp = (state.progress.bonusXp || 0) + 5;
        saveProgress('ผ่าประโยคด้วย AI X-Ray');
      } catch (err) {
        playChime('err');
        showToast(err.message || 'ครู AI ไม่พร้อมใช้งานชั่วคราว', 'AI');
      } finally {
        state.xrayBusy = false;
        renderTutorPage();
      }
    };

    host.querySelectorAll('[data-xray-sample]').forEach(btn => {
      btn.addEventListener('click', () => runSentenceXray(btn.dataset.xraySample));
    });
    document.getElementById('xray-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const inp = document.getElementById('xray-input');
      runSentenceXray(inp?.value || '');
    });
    document.getElementById('tutor-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const inp = document.getElementById('tutor-input');
      sendUserMsg(inp.value);
    });

    document.getElementById('tutor-mic')?.addEventListener('click', () => {
      const rec = new SpeechRec();
      rec.lang = 'zh-CN';
      const btn = document.getElementById('tutor-mic');
      btn.textContent = 'กำลังฟัง...';
      rec.onresult = (ev) => {
        const heard = ev.results[0]?.[0]?.transcript || '';
        if (heard) sendUserMsg(heard);
      };
      rec.onend = () => { if (btn) btn.textContent = 'พูดใส่ไมค์'; };
      rec.start();
    });
  }

  // ---- PINYIN TYPING TRAINER (ni3 hao3 -> nǐ hǎo) ----
  function convertNumberedPinyin(raw) {
    return raw
      .replace(/v/gi, 'ü')
      .replace(/([a-zA-ZüÜ]+)([1-4])/g, (_, syl, t) => applyToneMark(syl.toLowerCase(), Number(t)));
  }

  function normalizePinyinForCompare(str) {
    return convertNumberedPinyin(str)
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/5/g, '');
  }

  function renderTypingDrill() {
    const item = PRO.typingChallenges[state.typingIdx % PRO.typingChallenges.length];
    const stage = document.getElementById('drill-stage');

    stage.innerHTML = `
      <div class="drill-topbar">
        <span>ฝึกพิมพ์พินอิน (Keyboard) · ข้อที่ ${(state.typingIdx % PRO.typingChallenges.length) + 1} / ${PRO.typingChallenges.length}</span>
        <span class="streak-badge">ถูกติดกัน ${state.drillStreak}</span>
      </div>
      <div class="speaking-card">
        <div class="speaking-target-hanzi hanzi-font">${item.hz}</div>
        <div style="font-size:16px;color:var(--sys-label-2);margin-bottom:10px">${escapeHtml(item.th)}</div>
        <div style="margin-bottom:12px">
          <button type="button" class="btn-secondary" id="ty-listen">ฟังเสียงอ่าน</button>
        </div>
        <div class="typing-preview" id="ty-preview">พิมพ์เช่น ni3 hao3 (ใช้ v แทน ü)</div>
        <form class="typing-form" id="ty-form">
          <input type="text" class="sys-input" id="ty-input" placeholder="พิมพ์พินอินพร้อมเลขวรรณยุกต์ เช่น ${item.num.replace(/[0-9]/g, '#')}" autocomplete="off" autofocus>
          <button type="submit" class="btn-primary">ตรวจ</button>
        </form>
        <div class="drill-feedback" id="ty-fb"></div>
        <div style="display:flex;justify-content:center;gap:8px">
          <button type="button" class="btn-secondary" id="ty-hint">ดูเฉลย</button>
          <button type="button" class="btn-primary" id="ty-next">คำถัดไป →</button>
        </div>
      </div>
    `;

    const inp = document.getElementById('ty-input');
    const prev = document.getElementById('ty-preview');
    const fb = document.getElementById('ty-fb');

    document.getElementById('ty-listen').addEventListener('click', () => speak(item.hz));
    inp.addEventListener('input', () => {
      const converted = convertNumberedPinyin(inp.value.trim());
      prev.textContent = converted || 'พิมพ์เช่น ni3 hao3 (ใช้ v แทน ü)';
    });

    document.getElementById('ty-hint').addEventListener('click', () => {
      fb.className = 'drill-feedback show ok';
      fb.innerHTML = `เฉลย: <b>${item.py}</b> (พิมพ์เป็นตัวเลข: <code>${item.num}</code>)`;
    });

    document.getElementById('ty-next').addEventListener('click', () => {
      state.typingIdx = (state.typingIdx + 1) % PRO.typingChallenges.length;
      renderTypingDrill();
    });

    document.getElementById('ty-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const userNorm = normalizePinyinForCompare(inp.value);
      const targetNorm = normalizePinyinForCompare(item.py);
      if (userNorm === targetNorm) {
        state.drillStreak++;
        state.progress.drillCorrect++;
        state.progress.bonusXp = (state.progress.bonusXp || 0) + 5;
        ensureTodayDaily(state.progress).drills++;
        saveProgress(`พิมพ์พินอินถูก "${item.hz}"`);
        speak(item.hz);
        fb.className = 'drill-feedback show ok';
        fb.innerHTML = `<b>เป๊ะมาก! ✓</b> <span class="hanzi-font">${item.hz}</span> = <b>${item.py}</b> (${escapeHtml(item.th)})`;
        setTimeout(() => {
          state.typingIdx = (state.typingIdx + 1) % PRO.typingChallenges.length;
          renderTypingDrill();
        }, 950);
      } else {
        state.drillStreak = 0;
        playChime('err');
        fb.className = 'drill-feedback show err';
        fb.innerHTML = `<b>ยังไม่ตรง</b> คุณพิมพ์ได้ "${escapeHtml(convertNumberedPinyin(inp.value))}" · ที่ถูกต้องคือ <b>${item.py}</b> (<code>${item.num}</code>)`;
      }
    });
  }

  // ---- FULL HSK 1 MOCK EXAM (20 Qs / 200 Points / 15 Mins) ----
  const mockState = { active: false, finished: false, idx: 0, timeLeft: 15 * 60, answers: [], timerId: null };

  function stopMockTimer() {
    if (mockState.timerId) { clearInterval(mockState.timerId); mockState.timerId = null; }
  }

  function finishMockExam() {
    stopMockTimer();
    mockState.active = false;
    mockState.finished = true;
    const qs = PRO.hsk1MockExam;
    let listenPts = 0, readPts = 0;
    qs.forEach((q, i) => {
      if (mockState.answers[i] === q.answer) {
        if (q.part === 'listening') listenPts += 10;
        else readPts += 10;
      }
    });
    const total = listenPts + readPts;
    if (total >= 120) {
      state.progress.bonusXp = (state.progress.bonusXp || 0) + 250;
      saveProgress(`สอบผ่าน HSK 1 Mock Exam (${total}/200)!`);
    } else {
      saveProgress();
    }
    renderMockExamPage();
  }

  function renderMockExamPage() {
    const host = document.getElementById('mock-content');
    if (!host) return;
    const qs = PRO.hsk1MockExam;

    if (!mockState.active && !mockState.finished) {
      host.innerHTML = `
        <div class="card-panel" style="max-width:680px;margin:0 auto;text-align:center;padding:34px 24px">
          <h2 style="font-size:22px;margin-bottom:8px">สนามสอบจำลอง HSK 1 เต็มรูปแบบ</h2>
          <p style="color:var(--sys-label-2);margin:0 0 18px">
            ข้อสอบมาตรฐาน 20 ข้อ แบ่งเป็น <b>การฟัง 10 ข้อ (100 คะแนน)</b> + <b>การอ่าน/ไวยากรณ์ 10 ข้อ (100 คะแนน)</b><br>
            จับเวลา 15 นาที · เกณฑ์สอบผ่านตามมาตรฐานจริง <b>120 / 200 คะแนน</b> (ผ่านรับโบนัส +250 XP)
          </p>
          <button type="button" class="btn-primary" id="mock-start">เริ่มทำข้อสอบ HSK 1 (จับเวลา 15:00) →</button>
        </div>
      `;
      document.getElementById('mock-start').addEventListener('click', () => {
        stopMockTimer();
        mockState.active = true;
        mockState.finished = false;
        mockState.idx = 0;
        mockState.timeLeft = 15 * 60;
        mockState.answers = new Array(qs.length).fill(null);
        mockState.timerId = setInterval(() => {
          mockState.timeLeft--;
          const el = document.getElementById('mock-clock');
          if (el) el.textContent = formatTimer(mockState.timeLeft);
          if (mockState.timeLeft <= 0) finishMockExam();
        }, 1000);
        renderMockExamPage();
      });
      return;
    }

    if (mockState.finished) {
      let listenPts = 0, readPts = 0;
      const missed = [];
      qs.forEach((q, i) => {
        if (mockState.answers[i] === q.answer) {
          if (q.part === 'listening') listenPts += 10;
          else readPts += 10;
        } else {
          missed.push({ num: i + 1, ...q, chosen: mockState.answers[i] });
        }
      });
      const total = listenPts + readPts;
      const passed = total >= 120;

      host.innerHTML = `
        <div class="card-panel" style="max-width:740px;margin:0 auto">
          <div style="text-align:center">
            <span class="day-pill">${passed ? 'PASSED · สอบผ่านเกณฑ์ HSK 1 ✓' : 'NOT PASSED · ลองทบทวนแล้วสอบใหม่'}</span>
            <h2 style="font-size:26px;margin:10px 0 4px">คะแนนรวม ${total} / 200</h2>
            <p style="color:var(--sys-label-2);margin:0">เกณฑ์มาตรฐาน HSK 1 คือ 120 / 200 คะแนน</p>
          </div>
          <div class="mock-score-grid">
            <div class="mock-score-box"><span>Part 1 · การฟัง</span><strong class="tabular-nums">${listenPts} / 100</strong></div>
            <div class="mock-score-box"><span>Part 2 · การอ่าน</span><strong class="tabular-nums">${readPts} / 100</strong></div>
            <div class="mock-score-box"><span>ผลลัพธ์</span><strong style="color:${passed ? 'var(--sys-green-text)' : 'var(--sys-red-text)'}">${passed ? 'ผ่าน ✓' : 'ไม่ผ่าน'}</strong></div>
          </div>

          ${missed.length ? `
            <h3 style="font-size:15px;margin:0 0 10px">เฉลยข้อที่ตอบพลาด (${missed.length} ข้อ)</h3>
            <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:18px">
              ${missed.map(m => `
                <div class="info-box" style="margin:0">
                  <strong>ข้อ ${m.num} (${m.part === 'listening' ? 'การฟัง' : 'การอ่าน'}): ${escapeHtml(m.q)}</strong>
                  <div>เฉลย: <b>${escapeHtml(m.options[m.answer])}</b> · ${escapeHtml(m.explain)}</div>
                </div>
              `).join('')}
            </div>
          ` : `<p style="text-align:center;color:var(--sys-green-text);font-weight:600">สุดยอด! ตอบถูกครบทั้ง 20 ข้อเต็ม 200 คะแนน!</p>`}

          <div style="text-align:center">
            <button type="button" class="btn-primary" id="mock-retry">สอบจำลอง HSK 1 อีกครั้ง</button>
          </div>
        </div>
      `;
      document.getElementById('mock-retry').addEventListener('click', () => {
        mockState.finished = false;
        renderMockExamPage();
      });
      return;
    }

    const q = qs[mockState.idx];
    const chosen = mockState.answers[mockState.idx];
    host.innerHTML = `
      <div class="card-panel" style="max-width:720px;margin:0 auto">
        <div class="drill-topbar">
          <span>${q.part === 'listening' ? 'Part 1 · การฟัง (Listening)' : 'Part 2 · การอ่าน/ไวยากรณ์ (Reading)'} · ข้อ ${mockState.idx + 1} / ${qs.length}</span>
          <span class="streak-badge tabular-nums">เวลาเหลือ <b id="mock-clock">${formatTimer(mockState.timeLeft)}</b></span>
        </div>

        <h3 style="font-size:17px;margin:0 0 12px">${escapeHtml(q.q)}</h3>
        ${q.part === 'listening' ? `<button type="button" class="btn-primary" id="mock-play" style="margin-bottom:14px">ฟังเสียงข้อสอบ</button>` : ''}

        <div class="drill-options" style="grid-template-columns:1fr">
          ${q.options.map((opt, idx) => `
            <button type="button" class="drill-opt ${chosen === idx ? 'selected' : ''}" style="text-align:left;${chosen === idx ? 'border-color:var(--sys-accent);background:var(--sys-accent-tint);color:var(--sys-accent-text)' : ''}" data-mopt="${idx}">
              ${idx + 1}. ${escapeHtml(opt)}
            </button>
          `).join('')}
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px">
          <button type="button" class="btn-secondary" id="mock-prev" ${mockState.idx === 0 ? 'disabled' : ''}>← ข้อก่อนหน้า</button>
          ${mockState.idx + 1 === qs.length
            ? `<button type="button" class="btn-primary" id="mock-submit">ส่งข้อสอบและดูคะแนน →</button>`
            : `<button type="button" class="btn-primary" id="mock-next">ข้อถัดไป →</button>`}
        </div>
      </div>
    `;

    if (q.part === 'listening') {
      document.getElementById('mock-play').addEventListener('click', () => speak(q.audio));
    }

    host.querySelectorAll('[data-mopt]').forEach(btn => {
      btn.addEventListener('click', () => {
        mockState.answers[mockState.idx] = Number(btn.dataset.mopt);
        renderMockExamPage();
      });
    });

    document.getElementById('mock-prev')?.addEventListener('click', () => { mockState.idx--; renderMockExamPage(); });
    document.getElementById('mock-next')?.addEventListener('click', () => { mockState.idx++; renderMockExamPage(); });
    document.getElementById('mock-submit')?.addEventListener('click', finishMockExam);
  }

  // ---- INTERACTIVE PANDA COMPANION (宝宝 เป่าเปา) & CONFETTI ----
  let pandaEnabled = (() => {
    try { return localStorage.getItem('nihao-panda') !== 'off'; } catch { return true; }
  })();

  const pandaState = { x: 48, bubbleTimer: null, walkTimer: null, roamTimer: null };

  function spawnConfetti(count = 24) {
    const layer = document.getElementById('confetti-layer');
    if (!layer) return;
    const colors = ['#007aff', '#34c759', '#ff9500', '#ff3b30', '#5856d6', '#af52de'];
    const cx = window.innerWidth * 0.55;
    const cy = window.innerHeight * 0.45;
    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      el.className = 'confetti-piece';
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
      const dist = 90 + Math.random() * 190;
      el.style.left = `${cx + (Math.random() - 0.5) * 80}px`;
      el.style.top = `${cy + (Math.random() - 0.5) * 40}px`;
      el.style.background = colors[i % colors.length];
      el.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
      el.style.setProperty('--dy', `${Math.sin(angle) * dist + 140}px`);
      el.style.setProperty('--rot', `${Math.round((Math.random() - 0.5) * 720)}deg`);
      layer.appendChild(el);
      setTimeout(() => el.remove(), 1450);
    }
  }

  function getBambooCoins(xp) {
    return Math.max(0, Math.floor(xp / 5) + 50 - (state.progress.spentCoins || 0));
  }

  function renderPandaSprite(level = 1) {
    const sprite = document.getElementById('panda-sprite');
    if (!sprite) return;
    const eq = state.progress.equipped || {};
    const headItem = eq.head || (level >= 8 ? 'crown' : level >= 3 ? 'headband' : '');
    const faceItem = eq.face || '';
    const neckItem = eq.neck || '';
    const handItem = eq.hand || (level >= 5 ? 'bamboo' : '');

    let headSvg = '';
    if (headItem === 'headband') {
      headSvg = `<path d="M 16 25 Q 32 19 48 25" fill="none" stroke="#ff3b30" stroke-width="3.5" stroke-linecap="round"/>`;
    } else if (headItem === 'crown') {
      headSvg = `<path d="M 22 15 L 25 7 L 32 12 L 39 7 L 42 15 Z" fill="#ff9500" stroke="#b25f00" stroke-width="1.2" stroke-linejoin="round"/>`;
    } else if (headItem === 'hat') {
      headSvg = `<path d="M 8 20 L 32 7 L 56 20 Q 32 24 8 20 Z" fill="#e5b869" stroke="#8a5a19" stroke-width="1.6" stroke-linejoin="round"/>`;
    } else if (headItem === 'headphones') {
      headSvg = `<path d="M 13 28 A 19 19 0 0 1 51 28" fill="none" stroke="#007aff" stroke-width="3.2" stroke-linecap="round"/><rect x="9" y="24" width="6" height="10" rx="3" fill="#007aff"/><rect x="49" y="24" width="6" height="10" rx="3" fill="#007aff"/>`;
    }

    const faceSvg = faceItem === 'shades'
      ? `<g><rect x="17" y="25" width="13" height="8" rx="3" fill="#1d1d1f"/><rect x="34" y="25" width="13" height="8" rx="3" fill="#1d1d1f"/><line x1="30" y1="28" x2="34" y2="28" stroke="#1d1d1f" stroke-width="2"/><line x1="20" y1="27" x2="24" y2="27" stroke="#ffffff" stroke-width="1.2" opacity="0.5"/><line x1="37" y1="27" x2="41" y2="27" stroke="#ffffff" stroke-width="1.2" opacity="0.5"/></g>`
      : '';

    const neckSvg = neckItem === 'scarf'
      ? `<g><path d="M 19 41 Q 32 46 45 41" fill="none" stroke="#ff3b30" stroke-width="5" stroke-linecap="round"/><path d="M 38 42 L 42 53 L 35 52 Z" fill="#d70015"/></g>`
      : '';

    let handSvg = '';
    if (handItem === 'bamboo') {
      handSvg = `<g><line x1="51" y1="22" x2="55" y2="52" stroke="#34c759" stroke-width="3" stroke-linecap="round"/><ellipse cx="56" cy="26" rx="4" ry="2" transform="rotate(-25 56 26)" fill="#34c759"/></g>`;
    } else if (handItem === 'boba') {
      handSvg = `<g><path d="M 48 36 L 58 36 L 56 50 L 50 50 Z" fill="#f3d19c" stroke="#8a5a19" stroke-width="1.4"/><line x1="53" y1="30" x2="53" y2="38" stroke="#1d1d1f" stroke-width="2"/><circle cx="52" cy="47" r="1.4" fill="#1d1d1f"/><circle cx="55" cy="46" r="1.4" fill="#1d1d1f"/></g>`;
    }

    sprite.innerHTML = `
      <svg viewBox="0 0 64 64" width="56" height="56" aria-hidden="true">
        <ellipse cx="32" cy="59" rx="16" ry="3.5" fill="rgba(0,0,0,0.12)"/>
        <ellipse cx="32" cy="46" rx="15" ry="12" fill="#ffffff" stroke="#1d1d1f" stroke-width="2"/>
        <ellipse cx="18" cy="45" rx="5" ry="7" transform="rotate(20 18 45)" fill="#1d1d1f"/>
        <ellipse cx="46" cy="45" rx="5" ry="7" transform="rotate(-20 46 45)" fill="#1d1d1f"/>
        <ellipse cx="24" cy="55" rx="5.5" ry="4" fill="#1d1d1f"/>
        <ellipse cx="40" cy="55" rx="5.5" ry="4" fill="#1d1d1f"/>
        <circle cx="17" cy="18" r="6.5" fill="#1d1d1f"/>
        <circle cx="47" cy="18" r="6.5" fill="#1d1d1f"/>
        <ellipse cx="32" cy="30" rx="18" ry="15" fill="#ffffff" stroke="#1d1d1f" stroke-width="2"/>
        <ellipse cx="24" cy="30" rx="5.2" ry="6.2" transform="rotate(-14 24 30)" fill="#1d1d1f"/>
        <ellipse cx="40" cy="30" rx="5.2" ry="6.2" transform="rotate(14 40 30)" fill="#1d1d1f"/>
        <circle cx="25" cy="29" r="1.9" fill="#ffffff"/>
        <circle cx="39" cy="29" r="1.9" fill="#ffffff"/>
        <ellipse cx="18.5" cy="35" rx="3" ry="1.8" fill="#ff9bb3" opacity="0.75"/>
        <ellipse cx="45.5" cy="35" rx="3" ry="1.8" fill="#ff9bb3" opacity="0.75"/>
        <ellipse cx="32" cy="34" rx="2.5" ry="1.7" fill="#1d1d1f"/>
        <path d="M 28.5 37 Q 32 40 35.5 37" fill="none" stroke="#1d1d1f" stroke-width="1.8" stroke-linecap="round"/>
        ${neckSvg}
        ${faceSvg}
        ${headSvg}
        ${handSvg}
      </svg>
    `;
  }

  function pandaSay(msg, duration = 2600) {
    const bubble = document.getElementById('panda-bubble');
    if (!bubble) return;
    bubble.textContent = msg;
    bubble.classList.add('show');
    if (pandaState.bubbleTimer) clearTimeout(pandaState.bubbleTimer);
    pandaState.bubbleTimer = setTimeout(() => bubble.classList.remove('show'), duration);
  }

  function pandaReact(mood, level) {
    if (!pandaEnabled) return;
    const actor = document.getElementById('panda-actor');
    if (!actor) return;
    if (level) renderPandaSprite(level);

    actor.classList.remove('jumping', 'spinning');
    void actor.offsetWidth;

    if (mood === 'levelup') {
      actor.classList.add('spinning');
      pandaSay(`太厉害了! ขึ้น LV.${level} แล้ว!`, 3400);
      spawnConfetti(34);
      setTimeout(() => actor.classList.remove('spinning'), 800);
    } else if (mood === 'happy') {
      const cheers = ['太棒了! เยี่ยมมาก!', '很好! เก่งขึ้นอีกขั้น!', '加油! ลุยต่อเลย!', '真不错! สุดยอด!'];
      actor.classList.add('jumping');
      pandaSay(cheers[Math.floor(Math.random() * cheers.length)], 2200);
      setTimeout(() => actor.classList.remove('jumping'), 1150);
    } else if (mood === 'encourage') {
      const tips = ['没关系! ลองใหม่อีกทีนะ', '加油! อีกนิดเดียว!', '慢慢来! ค่อยๆ ฝึกนะ'];
      pandaSay(tips[Math.floor(Math.random() * tips.length)], 2200);
    }
  }

  function schedulePandaRoam() {
    if (pandaState.roamTimer) clearTimeout(pandaState.roamTimer);
    pandaState.roamTimer = setTimeout(() => {
      if (!pandaEnabled) return;
      const stage = document.getElementById('panda-stage');
      const actor = document.getElementById('panda-actor');
      if (!stage || !actor) return;
      const maxW = Math.max(80, stage.clientWidth - 70);
      const targetX = Math.round(16 + Math.random() * (maxW - 16));
      const dist = Math.abs(targetX - pandaState.x);
      const durMs = Math.max(1200, Math.min(4800, dist * 9));

      actor.classList.toggle('facing-left', targetX < pandaState.x);
      actor.classList.add('walking');
      actor.style.transition = `left ${durMs}ms linear`;
      actor.style.left = `${targetX}px`;
      pandaState.x = targetX;

      if (pandaState.walkTimer) clearTimeout(pandaState.walkTimer);
      pandaState.walkTimer = setTimeout(() => {
        actor.classList.remove('walking');
        schedulePandaRoam();
      }, durMs + 100);
    }, 3500 + Math.random() * 4500);
  }

  function syncPandaVisibility() {
    const stage = document.getElementById('panda-stage');
    const btn = document.getElementById('panda-toggle');
    if (stage) stage.classList.toggle('hidden', !pandaEnabled);
    if (btn) btn.classList.toggle('is-active', pandaEnabled);
    if (pandaEnabled) schedulePandaRoam();
  }

  document.getElementById('panda-toggle')?.addEventListener('click', () => {
    pandaEnabled = !pandaEnabled;
    try { localStorage.setItem('nihao-panda', pandaEnabled ? 'on' : 'off'); } catch {}
    syncPandaVisibility();
    if (pandaEnabled) pandaSay('你好! เป่าเปากลับมาแล้ว!', 2200);
  });

  document.getElementById('panda-actor')?.addEventListener('click', () => {
    const petPhrases = [
      { zh: '加油！', label: '加油! (สู้ๆ นะ!)' },
      { zh: '你很棒！', label: '你很棒! (คุณเก่งมาก!)' },
      { zh: '每天进步一点点！', label: '每天进步一点点! (เก่งขึ้นวันละนิด!)' },
      { zh: '你好厉害！', label: '你好厉害! (สุดยอดไปเลย!)' },
      { zh: '我们一起学中文吧！', label: 'มาเรียนจีนด้วยกันเถอะ!' }
    ];
    const pick = petPhrases[Math.floor(Math.random() * petPhrases.length)];
    const actor = document.getElementById('panda-actor');
    actor.classList.remove('jumping');
    void actor.offsetWidth;
    actor.classList.add('jumping');
    setTimeout(() => actor.classList.remove('jumping'), 1150);
    pandaSay(pick.label, 2800);
    playChime('ok');
    speak(pick.zh);
  });

  // ---- PWA Service Worker & Install Prompt ----
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
  let deferredInstallPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    const btn = document.getElementById('pwa-install-btn');
    if (btn) btn.hidden = false;
  });
  document.getElementById('pwa-install-btn')?.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    document.getElementById('pwa-install-btn').hidden = true;
  });

  // ---- Theme System (Light / Dark — Nakon-TRS Style) ----
  function applyTheme(theme) {
    const isDark = theme === 'dark';
    document.documentElement.classList.toggle('theme-dark', isDark);
    document.documentElement.classList.toggle('theme-light', !isDark);
    const shell = document.getElementById('app-shell');
    if (shell) {
      shell.classList.toggle('theme-dark', isDark);
      shell.classList.toggle('theme-light', !isDark);
    }
    const sun = document.getElementById('theme-icon-sun');
    const moon = document.getElementById('theme-icon-moon');
    if (sun) sun.hidden = !isDark;
    if (moon) moon.hidden = isDark;
    try { localStorage.setItem('nihao-theme', theme); } catch {}
  }

  const savedTheme = (() => {
    try { return localStorage.getItem('nihao-theme') || 'light'; } catch { return 'light'; }
  })();
  applyTheme(savedTheme);

  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    const isDark = document.documentElement.classList.contains('theme-dark');
    applyTheme(isDark ? 'light' : 'dark');
    if (state.activeTab === 'writing') loadWritingCharacter();
  });

  document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.toggle('open');
    document.getElementById('sidebar-backdrop')?.classList.toggle('open');
  });

  document.getElementById('sidebar-backdrop')?.addEventListener('click', closeMobileSidebar);

  // ---- Sound FX Toggle ----
  function syncSfxIcon() {
    const on = document.getElementById('sfx-icon-on');
    const off = document.getElementById('sfx-icon-off');
    if (on) on.hidden = !sfxEnabled;
    if (off) off.hidden = sfxEnabled;
  }
  syncSfxIcon();
  document.getElementById('sfx-toggle')?.addEventListener('click', () => {
    sfxEnabled = !sfxEnabled;
    try { localStorage.setItem('nihao-sfx', sfxEnabled ? 'on' : 'off'); } catch {}
    syncSfxIcon();
    if (sfxEnabled) playChime('ok');
  });

  document.querySelectorAll('#srs-mode-switch button').forEach(btn => {
    btn.addEventListener('click', () => {
      state.srsSubMode = btn.dataset.smode;
      renderSrsPage();
    });
  });

  document.querySelectorAll('#game-mode-switch button').forEach(btn => {
    btn.addEventListener('click', () => {
      stopSpeedTimer();
      stopHanziRain();
      state.gameSubMode = btn.dataset.gmode;
      renderSpeedGame();
    });
  });

  document.querySelectorAll('#l2-mode-switch button').forEach(btn => {
    btn.addEventListener('click', () => {
      state.l2SubMode = btn.dataset.l2mode;
      renderLevel2Page();
    });
  });

  // ---- Global Event Wiring ----
  document.getElementById('header-xp-pill')?.addEventListener('click', () => switchTab('profile'));

  document.querySelectorAll('.nav-link').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  document.querySelectorAll('.segmented-control button').forEach(btn => {
    if (btn.closest('#srs-mode-switch') || btn.closest('#l2-mode-switch') || btn.closest('#game-mode-switch')) return;
    btn.addEventListener('click', () => {
      state.rate = Number(btn.dataset.rate);
      btn.closest('.segmented-control').querySelectorAll('button').forEach(b => b.classList.toggle('active', b === btn));
    });
  });

  // ---- NETLIFY IDENTITY + POSTGRES CLOUD SYNC STATE ----
  const authState = {
    user: null,
    settings: null,
    syncing: false,
    lastSyncedAt: null,
    syncTimer: null,
    modalTab: 'login'
  };

  // ---- Initial Render ----
  const initStats = computeGameStats();
  lastKnownXp = initStats.xp;
  lastKnownLevel = initStats.level;
  renderPandaSprite(initStats.level);
  syncPandaVisibility();
  if (pandaEnabled) setTimeout(() => pandaSay('你好! วันนี้มาเก็บ XP กัน!', 3200), 700);
  updateDashboard();
  renderProfilePage();
  renderDailyPlan();
  renderInitials();
  renderFinals();
  renderTones();
  renderPinyinChart();
  renderCombiner();
  renderWritingStatic();
  initPracticeSelectors();
  nextDrillQuestion();
  renderVocab();
  renderSrsPage();
  renderSpeedGame();
  renderLevel2Page();
  renderTutorPage();
  renderMockExamPage();

  // ---- NihaoCore: public bridge for feature plugins (src/features/*) ----
  function ensureFeatureSection(sectionId, title) {
    const nav = document.querySelector('.nav-panel');
    if (!nav) return null;
    let anchor = nav.querySelector(`[data-feature-section="${sectionId}"]`);
    if (!anchor) {
      anchor = document.createElement('div');
      anchor.className = 'nav-section';
      anchor.dataset.featureSection = sectionId;
      anchor.textContent = title || sectionId;
      nav.appendChild(anchor);
    }
    return anchor;
  }

  function registerFeatureTab(def) {
    if (!def || !def.id || featureTabs.has(def.id)) return null;
    featureTabs.set(def.id, def);
    const nav = document.querySelector('.nav-panel');
    const sectionAnchor = ensureFeatureSection(def.section || 'pro', def.sectionTitle || '✨ Pro Studio');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'nav-link';
    btn.dataset.tab = def.id;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', 'false');
    btn.innerHTML = `<span class="nav-icon ${escapeHtml(def.iconClass || 'icon-purple')}">${def.iconSvg || `<span style="font-size:13px;line-height:1">${escapeHtml(def.emoji || '✨')}</span>`}</span>
      <span class="nav-label-text">${escapeHtml(def.label || def.id)}</span>
      ${def.badge !== undefined ? `<span class="nav-badge" id="nav-badge-${escapeHtml(def.id)}">${escapeHtml(def.badge)}</span>` : ''}`;
    btn.addEventListener('click', () => switchTab(def.id));
    // Insert after the last button belonging to this section
    let insertAfter = sectionAnchor;
    let sib = sectionAnchor ? sectionAnchor.nextElementSibling : null;
    while (sib && !sib.classList.contains('nav-section')) { insertAfter = sib; sib = sib.nextElementSibling; }
    if (insertAfter && insertAfter.parentNode) insertAfter.parentNode.insertBefore(btn, insertAfter.nextSibling);
    else if (nav) nav.appendChild(btn);

    const wrap = document.querySelector('.main-content .content-wrap');
    const panel = document.createElement('section');
    panel.className = 'tab-panel';
    panel.id = 'tab-' + def.id;
    panel.innerHTML = `
      <div class="page-head"><div>
        <h1 class="page-title">${escapeHtml(def.title || def.label || def.id)}</h1>
        ${def.desc ? `<p class="page-desc">${escapeHtml(def.desc)}</p>` : ''}
      </div></div>
      <div class="feature-host" id="feature-host-${escapeHtml(def.id)}"></div>`;
    if (wrap) wrap.appendChild(panel);
    return { button: btn, panel, host: panel.querySelector('.feature-host') };
  }

  function getExt(ns) {
    if (!state.progress.ext || typeof state.progress.ext !== 'object') state.progress.ext = {};
    if (!state.progress.ext[ns] || typeof state.progress.ext[ns] !== 'object') state.progress.ext[ns] = { updatedAt: 0 };
    return state.progress.ext[ns];
  }

  function setExt(ns, patchOrFn, opts = {}) {
    const cur = getExt(ns);
    const next = typeof patchOrFn === 'function' ? (patchOrFn(cur) || cur) : Object.assign(cur, patchOrFn);
    next.updatedAt = Date.now();
    state.progress.ext[ns] = next;
    if (opts.save === false) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress)); } catch { /* ignore */ }
      scheduleCloudSync();
    } else {
      saveProgress(opts.reason || '');
    }
    return next;
  }

  window.NihaoCore = {
    version: 1,
    state,
    data: { DATA, CHART, WS, PLAN, ENG, L2, PRO, FUN },
    get lexicon() { return LEXICON; },
    ensureLexiconLoaded,
    allVocabWords,
    allInitials,
    allFinals,
    tutorScenarios: TUTOR_SCENARIOS,
    // helpers
    todayKey,
    escapeHtml,
    applyToneMark,
    stripToneMarks,
    shuffleArray,
    speak,
    speakThai,
    stopSpeech,
    playChime,
    showToast,
    spawnConfetti,
    pandaSay,
    switchTab,
    computeGameStats,
    updateDashboard,
    recordMistake,
    logActivity,
    saveProgress,
    addXp(amount, reason = '') {
      const n = Math.max(0, Math.round(Number(amount) || 0));
      if (n > 0) state.progress.bonusXp = (state.progress.bonusXp || 0) + n;
      saveProgress(reason);
    },
    getExt,
    setExt,
    registerTab: registerFeatureTab,
    isSignedIn: () => Boolean(authState.user),
    getUser: () => authState.user,
    openAuthModal: () => openAuthModal(),
    get aiStatus() { return state.aiStatus; },
    on(name, fn) { const h = (e) => fn(e.detail || {}); coreBus.addEventListener(name, h); return () => coreBus.removeEventListener(name, h); },
    emit: emitCore,
    /** POST JSON to a same-origin API; returns { ok, status, data } and handles AUTH/RATE errors uniformly */
    async api(path, body, method = 'POST') {
      try {
        const res = await fetch(path, {
          method,
          headers: body ? { 'Content-Type': 'application/json' } : undefined,
          credentials: 'same-origin',
          body: body ? JSON.stringify(body) : undefined
        });
        const data = await res.json().catch(() => ({}));
        if (data && data.usage) state.aiUsage = data.usage;
        return { ok: res.ok && data.ok !== false, status: res.status, data };
      } catch (err) {
        return { ok: false, status: 0, data: { error: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ (ออฟไลน์?)' } };
      }
    }
  };
  // Load feature plugins lazily as a separate chunk
  import('./features/index.js')
    .then(() => emitCore('features-ready', {}))
    .catch(err => console.error('[features] failed to load', err));

  // ---- NETLIFY IDENTITY + POSTGRES CLOUD SYNC ----

  function updateAuthButton() {
    const label = document.getElementById('header-auth-label');
    const dot = document.getElementById('header-auth-dot');
    const btn = document.getElementById('header-auth-btn');
    if (!label || !dot || !btn) return;
    if (authState.user) {
      const name = authState.user.user_metadata?.full_name || authState.user.email?.split('@')[0] || 'บัญชีของฉัน';
      label.textContent = authState.syncing ? `${name} · ซิงก์...` : name;
      dot.classList.add('online');
      btn.classList.add('signed-in');
    } else {
      label.textContent = 'เข้าสู่ระบบ';
      dot.classList.remove('online');
      btn.classList.remove('signed-in');
    }
  }

  function isCloudAuthOrigin() {
    return (
      window.location.protocol === 'https:' ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1'
    );
  }

  function mergeCloudProgress(localP, cloudP) {
    const merged = mergeCloudProgressData(localP, cloudP);
    ensureTodayDaily(merged);
    return merged;
  }

  async function pushCloudProgress(silent = true) {
    if (!authState.user || !isCloudAuthOrigin()) return;
    authState.syncing = true;
    updateAuthButton();
    try {
      const res = await fetch('/api/me/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ progress: state.progress })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        authState.lastSyncedAt = data.updatedAt || new Date().toISOString();
        if (!silent) showToast('ซิงก์ข้อมูลลงฐานข้อมูลเรียบร้อย!', '', false);
      } else if (!silent) {
        showToast(data.error || 'ไม่สามารถซิงก์ข้อมูลได้', '', false);
      }
    } catch {
      if (!silent) showToast('เชื่อมต่อฐานข้อมูลไม่ได้ชั่วคราว', '', false);
    } finally {
      authState.syncing = false;
      updateAuthButton();
    }
  }

  function scheduleCloudSync() {
    if (!authState.user || !isCloudAuthOrigin()) return;
    if (authState.syncTimer) clearTimeout(authState.syncTimer);
    authState.syncTimer = setTimeout(() => {
      authState.syncTimer = null;
      pushCloudProgress(true);
    }, 1200);
  }

  async function pullCloudProgress() {
    if (!authState.user || !isCloudAuthOrigin()) return;
    authState.syncing = true;
    updateAuthButton();
    try {
      const res = await fetch('/api/me/progress', { credentials: 'same-origin' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        if (data.progress && typeof data.progress === 'object' && Object.keys(data.progress).length > 0) {
          state.progress = mergeCloudProgress(state.progress, data.progress);
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress)); } catch { /* ignore */ }
          authState.lastSyncedAt = data.updatedAt || new Date().toISOString();
          updateDashboard();
          if (state.activeTab === 'vocab') renderVocab();
          if (state.activeTab === 'profile') renderProfilePage();
          if (state.activeTab === 'tutor') renderTutorPage();
        }
        // Push merged state back so both devices stay in sync
        await pushCloudProgress(true);
      }
    } catch {
      // Ignore offline errors
    } finally {
      authState.syncing = false;
      updateAuthButton();
    }
  }

  function openAuthModal() {
    const bd = document.getElementById('vb-modal-backdrop');
    if (!bd) return;
    const auth = window.NetlifyAuth;
    const isHttps = isCloudAuthOrigin();

    if (!isHttps) {
      bd.innerHTML = `
        <div class="vb-modal" role="dialog" aria-modal="true" style="max-width:440px">
          <div class="vb-modal-head">
            <h3 style="margin:0">👤 ระบบแยก Account & ฐานข้อมูล</h3>
            <button type="button" class="btn-secondary vb-modal-close" id="vb-modal-close">✕ ปิด</button>
          </div>
          <p style="font-size:13.5px;color:var(--sys-label-2);line-height:1.55">
            ระบบล็อกอินด้วย <b>Netlify Identity (Google / Email)</b> และซิงก์ลงฐานข้อมูล Postgres ทำงานบนเว็บจริงที่:<br>
            <a href="https://nihao-chinese-learning.netlify.app" target="_blank" rel="noopener" style="color:var(--sys-accent-text);font-weight:600">https://nihao-chinese-learning.netlify.app</a>
          </p>
        </div>
      `;
      bd.hidden = false;
      bd.onclick = (e) => { if (e.target === bd) closeVocabDetailModal(); };
      document.getElementById('vb-modal-close')?.addEventListener('click', closeVocabDetailModal);
      return;
    }

    if (authState.user) {
      const name = authState.user.user_metadata?.full_name || 'ผู้เรียน';
      const email = authState.user.email || '';
      const syncedText = authState.lastSyncedAt
        ? new Date(authState.lastSyncedAt).toLocaleString('th-TH')
        : 'พร้อมซิงก์อัตโนมัติ';
      bd.innerHTML = `
        <div class="vb-modal" role="dialog" aria-modal="true" style="max-width:440px">
          <div class="vb-modal-head">
            <h3 style="margin:0">👤 บัญชีของคุณ (Cloud DB)</h3>
            <button type="button" class="btn-secondary vb-modal-close" id="vb-modal-close">✕ ปิด</button>
          </div>
          <div class="auth-profile-box">
            <div class="auth-avatar">${escapeHtml(name.slice(0, 1).toUpperCase())}</div>
            <div>
              <div style="font-weight:700;font-size:15px">${escapeHtml(name)}</div>
              <div style="font-size:12.5px;color:var(--sys-label-2)">${escapeHtml(email)}</div>
              <div style="font-size:11.5px;color:var(--sys-green-text);margin-top:3px">● ซิงก์ Postgres อัตโนมัติ · ล่าสุด: ${escapeHtml(syncedText)}</div>
            </div>
          </div>
          <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
            <button type="button" class="btn-primary" id="auth-sync-now" style="flex:1">🔄 ซิงก์ข้อมูลเดี๋ยวนี้</button>
            <button type="button" class="btn-secondary" id="auth-logout-btn">ออกจากระบบ</button>
          </div>
        </div>
      `;
      bd.hidden = false;
      bd.onclick = (e) => { if (e.target === bd) closeVocabDetailModal(); };
      document.getElementById('vb-modal-close')?.addEventListener('click', closeVocabDetailModal);
      document.getElementById('auth-sync-now')?.addEventListener('click', async () => {
        await pushCloudProgress(false);
        openAuthModal();
      });
      document.getElementById('auth-logout-btn')?.addEventListener('click', async () => {
        try { if (auth) await auth.logout(); } catch { /* ignore */ }
        authState.user = null;
        authState.lastSyncedAt = null;
        updateAuthButton();
        closeVocabDetailModal();
        showToast('ออกจากระบบเรียบร้อยแล้ว', '', false);
      });
      return;
    }

    const isFirebaseHost = /\.web\.app$|\.firebaseapp\.com$|\.run\.app$/.test(window.location.hostname);
    const googleEnabled = isFirebaseHost || (authState.settings ? Boolean(authState.settings?.external?.google) : true);
    bd.innerHTML = `
      <div class="vb-modal" role="dialog" aria-modal="true" style="max-width:440px">
        <div class="vb-modal-head">
          <h3 style="margin:0">👤 เข้าสู่ระบบ / แยก Account</h3>
          <button type="button" class="btn-secondary vb-modal-close" id="vb-modal-close">✕ ปิด</button>
        </div>
        <p style="margin:0 0 12px;font-size:13px;color:var(--sys-label-2)">
          ล็อกอินเพื่อเก็บความคืบหน้า คำศัพท์ที่สะสม SRS และโน้ตลงฐานข้อมูล <b>Postgres</b> ซิงก์อัตโนมัติระหว่างคอมและ iPad
        </p>

        ${googleEnabled ? `
          <button type="button" class="auth-google-btn" id="auth-google-btn">
            <span>🔵</span> <span>เข้าสู่ระบบด้วย Google</span>
          </button>
          <div class="auth-divider"><span>หรือใช้อีเมล</span></div>
        ` : ''}

        <div class="vocab-mode-tabs" style="width:100%;display:grid;grid-template-columns:1fr 1fr;margin-bottom:12px">
          <button type="button" class="vocab-mode-btn ${authState.modalTab === 'login' ? 'active' : ''}" data-atab="login">เข้าสู่ระบบ</button>
          <button type="button" class="vocab-mode-btn ${authState.modalTab === 'signup' ? 'active' : ''}" data-atab="signup">สมัครสมาชิกใหม่</button>
        </div>

        <form id="auth-form" class="auth-form">
          ${authState.modalTab === 'signup' ? `<input type="text" id="auth-name" class="vb-search" placeholder="ชื่อเล่นของคุณ (เช่น บีม)" required>` : ''}
          <input type="email" id="auth-email" class="vb-search" placeholder="อีเมล" required>
          <input type="password" id="auth-pass" class="vb-search" placeholder="รหัสผ่าน (อย่างน้อย 6 ตัวอักษร)" minlength="6" required>
          <div id="auth-err" class="auth-err" hidden></div>
          <button type="submit" class="btn-primary" id="auth-submit-btn" style="width:100%;padding:10px">
            ${authState.modalTab === 'login' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}
          </button>
        </form>

        ${!authState.settings ? `
          <div class="vq-warn" style="margin-top:12px;font-size:12px">
            หากยังกดสมัครไม่ได้ ให้เจ้าของเว็บไปกด <b>Enable Identity</b> (และเปิด Google Provider) 1 ครั้งที่ Netlify Dashboard → Identity
          </div>
        ` : ''}
      </div>
    `;
    bd.hidden = false;
    bd.onclick = (e) => { if (e.target === bd) closeVocabDetailModal(); };
    document.getElementById('vb-modal-close')?.addEventListener('click', closeVocabDetailModal);

    bd.querySelectorAll('[data-atab]').forEach(btn => {
      btn.addEventListener('click', () => {
        authState.modalTab = btn.dataset.atab;
        openAuthModal();
      });
    });

    document.getElementById('auth-google-btn')?.addEventListener('click', () => {
      if (auth && typeof auth.oauthLogin === 'function') {
        auth.oauthLogin('google');
      } else {
        window.location.href = '/.netlify/identity/authorize?provider=google';
      }
    });

    document.getElementById('auth-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!auth) return;
      const email = String(document.getElementById('auth-email')?.value || '').trim();
      const pass = String(document.getElementById('auth-pass')?.value || '');
      const name = String(document.getElementById('auth-name')?.value || '').trim();
      const errEl = document.getElementById('auth-err');
      const subBtn = document.getElementById('auth-submit-btn');
      if (errEl) errEl.hidden = true;
      if (subBtn) subBtn.disabled = true;
      try {
        if (authState.modalTab === 'signup') {
          await auth.signup(email, pass, { full_name: name || email.split('@')[0] });
          const u = await auth.getUser().catch(() => null);
          if (u) {
            authState.user = u;
            updateAuthButton();
            closeVocabDetailModal();
            showToast('สมัครสมาชิกและเข้าสู่ระบบเรียบร้อย!', '', false);
            await pullCloudProgress();
          } else {
            if (errEl) {
              errEl.textContent = 'ส่งลิงก์ยืนยันไปที่อีเมลแล้ว กรุณากดยืนยันในอีเมลแล้วเข้าสู่ระบบครับ';
              errEl.hidden = false;
            }
          }
        } else {
          await auth.login(email, pass);
          authState.user = await auth.getUser();
          updateAuthButton();
          closeVocabDetailModal();
          showToast('เข้าสู่ระบบสำเร็จ! กำลังซิงก์ข้อมูลจากฐานข้อมูล...', '', false);
          await pullCloudProgress();
        }
      } catch (err) {
        if (errEl) {
          errEl.textContent = err?.message || 'เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบอีเมล/รหัสผ่าน หรือเปิดใช้งาน Netlify Identity';
          errEl.hidden = false;
        }
      } finally {
        if (subBtn) subBtn.disabled = false;
      }
    });
  }

  async function initCloudAuth() {
    if (isCloudAuthOrigin() && !authState.settings) {
      try {
        const sRes = await fetch('/.netlify/identity/settings');
        if (sRes.ok) authState.settings = await sRes.json();
      } catch { /* ignore */ }
    }
    const auth = window.NetlifyAuth;
    if (!auth) return;
    try {
      if (typeof auth.handleAuthCallback === 'function') {
        await auth.handleAuthCallback().catch(() => null);
      }
      if (!authState.settings && typeof auth.getSettings === 'function') {
        authState.settings = await auth.getSettings().catch(() => null);
      }
      if (typeof auth.getUser === 'function') {
        authState.user = await auth.getUser().catch(() => null);
      }
      updateAuthButton();
      if (authState.user) {
        refreshAiStatus();
        if (state.activeTab === 'tutor') renderTutorPage();
        if (state.activeTab === 'profile') renderProfilePage();
        await pullCloudProgress();
      }
    } catch {
      // Ignore if Identity not enabled yet
    }
  }

  function refreshAiStatus() {
    fetch('/api/ai/status', { credentials: 'same-origin' })
      .then(r => r.json())
      .then(st => {
        if (st && typeof st.configured === 'boolean') {
          state.aiStatus = st;
          if (st.usage) state.aiUsage = st.usage;
          if (state.activeTab === 'tutor') renderTutorPage();
        }
      })
      .catch(() => {});
  }

  // ---- Keyboard Shortcuts for SRS & Flashcards (Desktop Productivity) ----
  document.addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target?.isContentEditable) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    const modalOpen = !document.getElementById('vb-modal-backdrop')?.hidden;
    if (modalOpen) {
      if (e.key === 'Escape') closeVocabDetailModal();
      return;
    }

    // Vocab SRS shortcuts: Space flip, 1-4 rate, R speak
    if (state.activeTab === 'vocab' && state.vocabMode === 'srs') {
      if (e.code === 'Space') {
        const flipBtn = document.getElementById('vsrs-flip-btn') || document.getElementById('vsrs-flashcard');
        if (flipBtn) { e.preventDefault(); flipBtn.click(); }
      } else if (e.key === 'r' || e.key === 'R') {
        document.getElementById('vsrs-speak-btn')?.click();
      } else if (['1', '2', '3', '4'].includes(e.key)) {
        const map = { '1': 'again', '2': 'hard', '3': 'good', '4': 'easy' };
        document.querySelector(`#vocab-srs-view [data-rate="${map[e.key]}"]`)?.click();
      }
      return;
    }

    // Level 1 SRS shortcuts: Space flip, 1-3 rate, R speak
    if (state.activeTab === 'srs') {
      if (e.code === 'Space') {
        const cardEl = document.getElementById('srs-card');
        if (cardEl) { e.preventDefault(); cardEl.click(); }
      } else if (e.key === 'r' || e.key === 'R') {
        document.getElementById('srs-play-audio')?.click();
      } else if (['1', '2', '3'].includes(e.key)) {
        const map = { '1': '0', '2': '1', '3': '3' };
        document.querySelector(`#srs-content [data-srs-rate="${map[e.key]}"]`)?.click();
      }
    }
  });

  document.getElementById('header-auth-btn')?.addEventListener('click', openAuthModal);
  if (window.NetlifyAuth) initCloudAuth();
  else window.addEventListener('netlify-auth-ready', initCloudAuth, { once: true });

  // Check Gemini AI backend availability & daily quota
  refreshAiStatus();
})();
