// Global TH <-> EN Language Switcher + Firebase Google Sign-In bridge
// Works on both Firebase Hosting (/__/firebase/*) and local dev without breaking Netlify Identity.

const LANG_KEY = 'nihao-lang';

const TH_TO_EN = new Map([
  // Brand & Header
  ['Level 1 · พื้นฐานพินอิน', 'Level 1 · Pinyin Foundations'],
  ['เข้าสู่ระบบ', 'Sign In'],
  ['ติดตั้งแอป', 'Install App'],
  ['ปกติ', 'Normal'],
  ['ช้าชัดๆ', 'Slow'],
  ['บัญชีของฉัน', 'My Account'],
  ['ออกจากระบบ', 'Sign Out'],
  ['เข้าสู่ระบบด้วย Google', 'Sign in with Google'],
  ['หรือใช้อีเมล', 'or use email'],
  ['สมัครสมาชิกใหม่', 'Sign Up'],
  ['สมัครสมาชิก', 'Create Account'],

  // Sidebar sections & tabs
  ['🌱 เดือนแรก (แนะนำ)', '🌱 Month 1 (Recommended)'],
  ['เดือนแรก 0→HSK1', 'Month 1: 0→HSK1'],
  ['30 วัน', '30 Days'],
  ['โปรไฟล์ & แผนที่ด่าน', 'Profile & Map'],
  ['แผนเรียน 14 วัน', '14-Day Study Plan'],
  ['คำศัพท์พื้นฐาน', 'Core Vocabulary'],
  ['พยัญชนะต้น', 'Initials'],
  ['สระพินอิน', 'Finals'],
  ['วรรณยุกต์ & กฎผัน', 'Tones & Sandhi'],
  ['ตารางพินอินเต็ม', 'Full Pinyin Chart'],
  ['ห้องผสมคำ', 'Syllable Combiner'],
  ['ฝึกเขียนลำดับขีด', 'Hanzi Writing'],
  ['การ์ด SRS & บทสนทนา', 'SRS & Dialogues'],
  ['เกม Speed Match', 'Speed Match Game'],
  ['ฝึกฟัง-พูด & สอบเวล 1', 'Listen, Speak & Quiz'],
  ['แต่งประโยค & HSK 1', 'Sentences & HSK 1'],
  ['คู่ซ้อมสนทนาจีน', 'AI Chinese Tutor'],
  ['สอบจำลอง HSK 1', 'HSK 1 Mock Exam'],
  ['เส้นทางบทเรียน', 'Learning Path'],
  ['เกม & อ่านจีน', 'Games & Reading'],
  ['ภารกิจ & ลีก', 'Quests & League'],
  ['ตั้งค่า & ออฟไลน์', 'Settings & Offline'],

  // KPI & common labels
  ['พยัญชนะ / สระ', 'Initials / Finals'],
  ['ฝึกเขียนผ่านแล้ว', 'Hanzi Mastered'],
  ['สอบจบ Level 1', 'Level 1 Final Exam'],
  ['ยังไม่สอบ', 'Not taken'],
  ['แผนเรียนจีนเข้มข้น 14 วัน (วันละ 60 นาที)', '14-Day Intensive Mandarin Plan (60 min/day)'],
  ['โปรไฟล์ผู้เรียน · สกิล & แผนที่ด่าน', 'Learner Profile · Skills & Roadmap'],
  ['🌱 เดือนแรก 0 → HSK 1 (Starter Pack)', '🌱 Month 1: 0 → HSK 1 (Starter Pack)'],
  ['🌱 แผน 30 วัน', '🌱 30-Day Plan'],
  ['🗣️ 50 ประโยคเอาตัวรอด', '🗣️ 50 Survival Phrases'],
  ['🔍 ค้นศัพท์ (/)', '🔍 Quick Dict (/)'],
  ['▶ เริ่มเรียนวันนี้ (15 นาที)', '▶ Start Today’s Session (15 min)'],
  ['โหมดเดือนแรก (ซ่อนเมนูขั้นสูง)', 'Month-1 Mode (hide advanced tabs)'],
  ['เปิดแผน Day 1–14 (พินอิน) →', 'Open Day 1–14 (Pinyin) →'],
  ['🔊 ฟัง', '🔊 Listen'],
  ['🐢 ช้า', '🐢 Slow'],
  ['🐢 0.6x', '🐢 0.6x'],
  ['🔊 ปกติ', '🔊 Normal'],
  ['✍️ ลำดับขีด', '✍️ Strokes'],
  ['✕ ปิด', '✕ Close'],
  ['ออก', 'Exit'],
  ['จำได้แล้ว', 'Got it'],
  ['พูดตามแล้ว', 'Spoken'],
  ['พูดแล้ว', 'Spoken'],
  ['ฝึกแล้ว', 'Practiced'],
  ['กลับหน้าเดือนแรก', 'Back to Month 1'],
  ['🎙️ ลองใช้จริงใน AI Roleplay →', '🎙️ Practice in AI Roleplay →'],
  ['🎧 ทดสอบฟังแยกคู่เสียง', '🎧 Tone Pair Listening Quiz'],
  ['🎵 20 คู่วรรณยุกต์ (Tone Pairs Mastery)', '🎵 20 Tone Pairs Mastery'],
  ['⚠️ กับดักเสียงคนไทยโดยเฉพาะ (Thai-Speaker Traps)', '⚠️ Common Pronunciation Traps'],
  ['🧠 64 ภาพจำตัวอักษรจีนเดือนแรก (Thai Mnemonics)', '🧠 64 First-Month Hanzi Mnemonics'],
  ['🗣️ 50 ประโยคเอาตัวรอดเดือนแรก (HSK 1 ล้วน)', '🗣️ 50 Survival Phrases (HSK 1)'],
  ['🔍 พจนานุกรมค้นด่วน', '🔍 Quick Dictionary']
]);

let currentLang = (() => {
  try { return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'th'; } catch { return 'th'; }
})();

const originalTextMap = new WeakMap();
let observer = null;

function translateTextNode(node) {
  if (!node || node.nodeType !== 3) return;
  const raw = node.nodeValue;
  if (!raw || !raw.trim()) return;
  if (!originalTextMap.has(node)) {
    originalTextMap.set(node, raw);
  }
  const orig = originalTextMap.get(node);
  if (currentLang === 'th') {
    if (node.nodeValue !== orig) node.nodeValue = orig;
    return;
  }
  const trimmed = orig.trim();
  const mapped = TH_TO_EN.get(trimmed);
  if (mapped) {
    node.nodeValue = orig.replace(trimmed, mapped);
    return;
  }
  // Pattern-based translations for dynamic counters
  let out = orig;
  out = out
    .replace(/อีก\s*([\d,]+)\s*XP\s*ขึ้น\s*LV\.(\d+)/g, '$1 XP to LV.$2')
    .replace(/(\d+)\s*\/\s*(\d+)\s*วัน/g, '$1 / $2 days')
    .replace(/(\d+)\s*\/\s*(\d+)\s*ตัว/g, '$1 / $2 chars')
    .replace(/วันนี้เรียน Day (\d+) \/ 30/g, 'Today: Day $1 / 30')
    .replace(/🎵 20 คู่วรรณยุกต์ \((\d+)\/20\)/g, '🎵 20 Tone Pairs ($1/20)')
    .replace(/🧠 64 ภาพจำอักษร \((\d+)\/64\)/g, '🧠 64 Hanzi Mnemonics ($1/64)');
  if (out !== node.nodeValue) node.nodeValue = out;
}

function walkAndTranslate(root) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    const parentTag = n.parentElement?.tagName;
    if (parentTag === 'SCRIPT' || parentTag === 'STYLE') continue;
    translateTextNode(n);
  }
}

export function applyLanguage(lang, core) {
  currentLang = lang === 'en' ? 'en' : 'th';
  try { localStorage.setItem(LANG_KEY, currentLang); } catch { /* ignore */ }
  document.documentElement.lang = currentLang;
  document.documentElement.dataset.lang = currentLang;

  const btn = document.getElementById('pf-lang-toggle');
  if (btn) btn.textContent = currentLang === 'en' ? '🇬🇧 EN' : '🇹🇭 TH';

  walkAndTranslate(document.body);
  if (core && typeof core.emit === 'function') {
    core.emit('platform:lang', { lang: currentLang });
  }
}

export function initLanguageSwitcher(core) {
  if (document.getElementById('pf-lang-toggle')) return;
  const actions = document.querySelector('.header-actions');
  if (actions) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'pf-lang-toggle';
    btn.className = 'btn-secondary pf-lang-btn';
    btn.style.cssText = 'padding:5px 10px;font-size:12px;font-weight:700;border-radius:999px;white-space:nowrap';
    btn.title = 'Switch UI Language (Thai / English)';
    btn.textContent = currentLang === 'en' ? '🇬🇧 EN' : '🇹🇭 TH';
    btn.addEventListener('click', () => {
      applyLanguage(currentLang === 'th' ? 'en' : 'th', core);
      core?.showToast(currentLang === 'en' ? 'Switched UI to English 🇬🇧' : 'เปลี่ยนภาษาเป็นภาษาไทย 🇹🇭');
    });
    const authBtn = document.getElementById('header-auth-btn');
    if (authBtn && authBtn.parentNode === actions) actions.insertBefore(btn, authBtn);
    else actions.insertBefore(btn, actions.firstChild);
  }

  // Re-translate dynamically rendered tab content when in EN mode
  if (!observer) {
    observer = new MutationObserver((mutations) => {
      if (currentLang !== 'en') return;
      for (const m of mutations) {
        m.addedNodes.forEach((node) => {
          if (node.nodeType === 3) translateTextNode(node);
          else if (node.nodeType === 1) walkAndTranslate(node);
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (currentLang === 'en') {
    setTimeout(() => applyLanguage('en', core), 120);
  }
}

// ---- Firebase Auth (Google Sign-In) for Firebase Hosting / Cloud Run ----
let fbAuthReady = null;

function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load ' + src));
    document.head.appendChild(s);
  });
}

async function ensureFirebaseAuth() {
  if (fbAuthReady) return fbAuthReady;
  fbAuthReady = (async () => {
    const initRes = await fetch('/__/firebase/init.json').catch(() => null);
    if (!initRes || !initRes.ok) return null;
    const cfg = await initRes.json().catch(() => null);
    if (!cfg || !cfg.apiKey) return null;
    await loadScriptOnce('/__/firebase/10.12.2/firebase-app-compat.js');
    await loadScriptOnce('/__/firebase/10.12.2/firebase-auth-compat.js');
    if (!window.firebase) return null;
    if (!window.firebase.apps.length) window.firebase.initializeApp(cfg);
    return window.firebase.auth();
  })();
  return fbAuthReady;
}

export function initFirebaseGoogleAuth(core) {
  // Attach x-nihao-lang and x-nihao-user headers to all same-origin /api/* fetches
  if (!window.__nihaoFetchWrapped && typeof window.fetch === 'function') {
    window.__nihaoFetchWrapped = true;
    const origFetch = window.fetch.bind(window);
    window.fetch = (input, init = {}) => {
      const url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
      if (url.startsWith('/api/')) {
        const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
        headers.set('x-nihao-lang', currentLang);
        if (window.__nihaoFirebaseUser?.uid) {
          headers.set('x-nihao-user', `fb:${window.__nihaoFirebaseUser.uid}`);
        }
        return origFetch(input, { ...init, headers });
      }
      return origFetch(input, init);
    };
  }

  const host = window.location.hostname;
  const isFirebaseHost = host.endsWith('.web.app') || host.endsWith('.firebaseapp.com') || host.endsWith('.run.app');
  if (!isFirebaseHost) return;

  let syncTimer = null;
  const pushFirebaseProgress = () => {
    if (!window.__nihaoFirebaseUser?.uid || !core?.state?.progress) return;
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      fetch('/api/me/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ progress: core.state.progress })
      }).catch(() => {});
    }, 1500);
  };
  core?.on?.('progress', pushFirebaseProgress);

  const updateHeader = (user) => {
    const label = document.getElementById('header-auth-label');
    const dot = document.getElementById('header-auth-dot');
    const btn = document.getElementById('header-auth-btn');
    if (!label || !dot || !btn) return;
    if (user) {
      label.textContent = user.displayName || user.email?.split('@')[0] || 'Account';
      dot.classList.add('online');
      btn.classList.add('signed-in');
    } else {
      label.textContent = currentLang === 'en' ? 'Sign In' : 'เข้าสู่ระบบ';
      dot.classList.remove('online');
      btn.classList.remove('signed-in');
    }
  };

  // Check existing Firebase session on load
  ensureFirebaseAuth().then((auth) => {
    if (!auth) return;
    auth.onAuthStateChanged((user) => {
      window.__nihaoFirebaseUser = user || null;
      updateHeader(user);
    });
  }).catch(() => {});

  // Intercept Google button inside the existing auth modal
  document.addEventListener('click', async (e) => {
    const googleBtn = e.target?.closest?.('#auth-google-btn');
    if (!googleBtn) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    try {
      const auth = await ensureFirebaseAuth();
      if (!auth) {
        core?.showToast('กรุณาเปิด Google Sign-In ใน Firebase Console → Authentication → Sign-in method');
        return;
      }
      const provider = new window.firebase.auth.GoogleAuthProvider();
      const cred = await auth.signInWithPopup(provider);
      window.__nihaoFirebaseUser = cred.user;
      updateHeader(cred.user);
      const bd = document.getElementById('vb-modal-backdrop');
      if (bd) bd.hidden = true;
      core?.showToast(currentLang === 'en' ? `Welcome, ${cred.user.displayName || 'Learner'}!` : `เข้าสู่ระบบด้วย Google สำเร็จ! ยินดีต้อนรับ ${cred.user.displayName || ''}`);
    } catch (err) {
      const msg = err?.code === 'auth/configuration-not-found' || err?.code === 'auth/operation-not-allowed'
        ? 'กรุณาเปิด Google Provider ใน Firebase Console → Authentication ก่อนใช้งานครับ'
        : (err?.message || 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ');
      core?.showToast(msg);
    }
  }, true);
}
