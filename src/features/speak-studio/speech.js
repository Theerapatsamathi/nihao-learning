// SpeechRecognition, slow TTS (0.6x), lexicon pinyin cache, and ext storage helpers
import { buildCharPinyinMap } from './scoring.js';

let cachedCharPyMap = null;

export function hasSpeechRecognition() {
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

/**
 * Start one-shot SpeechRecognition (zh-CN or th-TH).
 * Returns a controller { stop() }.
 */
export function startSpeechRecognition({ lang = 'zh-CN', onResult, onError, onEnd, onStart } = {}) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    onError?.('เบราว์เซอร์นี้ไม่รองรับการรับเสียง (แนะนำ Chrome / Edge หรือพิมพ์ข้อความแทน)');
    return { stop() {} };
  }
  const rec = new SR();
  rec.lang = lang;
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  rec.continuous = false;

  let finished = false;
  rec.onstart = () => onStart?.();
  rec.onresult = (ev) => {
    const text = ev?.results?.[0]?.[0]?.transcript || '';
    if (text) onResult?.(text.trim());
  };
  rec.onerror = (ev) => {
    if (finished) return;
    const code = ev?.error || 'unknown';
    if (code === 'not-allowed' || code === 'service-not-allowed') {
      onError?.('กรุณาอนุญาตการใช้ไมโครโฟนในเบราว์เซอร์');
    } else if (code === 'no-speech') {
      onError?.('ไม่ได้ยินเสียงพูด กรุณาลองกดพูดใหม่อีกครั้ง');
    } else if (code !== 'aborted') {
      onError?.(`ไม่สามารถรับเสียงได้ (${code})`);
    }
  };
  rec.onend = () => {
    finished = true;
    onEnd?.();
  };

  try {
    rec.start();
  } catch (e) {
    onError?.('ไม่สามารถเปิดไมโครโฟนได้ในขณะนี้');
  }

  return {
    stop() {
      try {
        rec.stop();
      } catch (_) {}
    }
  };
}

/**
 * Speak Chinese at 0.6x slow speed using Web Speech API (with fallback to core.speak).
 */
export function speakSlow(core, zh, rate = 0.6) {
  if (!zh) return;
  try {
    if (window.speechSynthesis && typeof SpeechSynthesisUtterance !== 'undefined') {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(zh);
      u.lang = 'zh-CN';
      u.rate = rate;
      const voices = window.speechSynthesis.getVoices?.() || [];
      const zhVoice = voices.find((v) => /^zh/i.test(v.lang));
      if (zhVoice) u.voice = zhVoice;
      window.speechSynthesis.speak(u);
      return;
    }
  } catch (_) {}
  core.speak(zh);
}

/**
 * Lazily build and cache char -> pinyin map from core.lexicon.
 */
export async function getCharPinyinMap(core) {
  if (cachedCharPyMap) return cachedCharPyMap;
  try {
    const lex = await core.ensureLexiconLoaded?.();
    cachedCharPyMap = buildCharPinyinMap(lex || core.lexicon || []);
  } catch (_) {
    cachedCharPyMap = buildCharPinyinMap(core.lexicon || []);
  }
  return cachedCharPyMap;
}

/**
 * Persist an item into ext['speak-studio'].reviewQueue (deduplicated by hz).
 * Resurfaced next day (dueDate = todayKey(1)) by default, or today if immediate=true.
 */
export function addToReviewQueue(core, item, { immediate = false } = {}) {
  const hz = String(item?.hz || '').trim();
  if (!hz) return false;
  const ext = core.getExt('speak-studio') || {};
  const queue = Array.isArray(ext.reviewQueue) ? [...ext.reviewQueue] : [];
  const existingIdx = queue.findIndex((q) => q.hz === hz);
  const dueDate = immediate ? core.todayKey(0) : core.todayKey(1);

  const record = {
    id: item.id || `rv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    hz,
    py: String(item.py || '').trim(),
    th: String(item.th || '').trim(),
    source: item.source || 'Speak Studio',
    addedAt: core.todayKey(0),
    dueDate,
    streak: 0
  };

  if (existingIdx >= 0) {
    queue[existingIdx] = { ...queue[existingIdx], ...record, dueDate };
  } else {
    queue.unshift(record);
  }

  core.setExt('speak-studio', { reviewQueue: queue.slice(0, 100) }, { save: true, reason: 'speak-review-add' });
  return true;
}

/**
 * Handle AI API errors (401 auth prompt, 429 rate limit).
 */
export function handleAiError(core, res) {
  if (!res) return 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ AI ได้';
  if (res.status === 401 || res.data?.code === 'AUTH_REQUIRED') {
    core.showToast('กรุณาเข้าสู่ระบบเพื่อใช้งานครู AI (หรือใช้โหมดออฟไลน์)', 'AUTH');
    core.openAuthModal?.();
    return 'กรุณาเข้าสู่ระบบเพื่อใช้งานครู AI';
  }
  if (res.status === 429 || res.data?.code === 'RATE_LIMITED') {
    core.showToast('โควตา AI วันนี้เต็มแล้ว สลับไปใช้โหมดออฟไลน์ให้ทันที', 'LIMIT');
    return 'โควตา AI วันนี้เต็มแล้ว';
  }
  return res.data?.error || 'AI ไม่พร้อมใช้งานชั่วคราว';
}

/**
 * Render reusable per-syllable pronunciation scoring breakdown (#11).
 */
export function renderPronunciationBreakdownHtml(core, result) {
  if (!result || !Array.isArray(result.syllables) || result.syllables.length === 0) return '';
  const esc = core.escapeHtml;
  const chips = result.syllables.map((s) => `
    <span class="ss-syl ss-syl-${s.status}" title="${esc(s.reason)}">
      <span class="ss-syl-hz hanzi-font">${esc(s.char)}</span>
      <span class="ss-syl-py">${esc(s.expectedPy || '·')}</span>
    </span>
  `).join('');

  const issues = result.syllables
    .filter((s) => s.status !== 'green')
    .slice(0, 4)
    .map((s) => `<li><strong>${esc(s.char)}</strong> (${esc(s.expectedPy || '-')}) — ${esc(s.reason)}</li>`)
    .join('');

  return `
    <div class="ss-pron-box">
      <div class="ss-pron-head">
        <span class="ss-score-pill ${result.score >= 80 ? 'ok' : result.score >= 55 ? 'mid' : 'low'}">
          คะแนนการออกเสียง ${result.score}%
        </span>
        <span class="ss-pron-summary">${esc(result.summary)}</span>
      </div>
      <div class="ss-syl-row">${chips}</div>
      ${issues ? `<ul class="ss-pron-issues">${issues}</ul>` : ''}
    </div>
  `;
}
