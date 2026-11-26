// Smart Reader & C-Pop Lyrics / Subtitle Importer
// Segments any Chinese text using Intl.Segmenter('zh') + lexicon greedy fallback,
// adds Pinyin + tap-to-translate popovers, saves words to SRS, and launches 1v1 Arena Duel rooms from the text!

import { openWordPopover } from './word-popover.js';
import { esc, toggleStarWord } from './utils.js';

export const PRESET_IMPORTS = [
  {
    id: 'cpop-sweet',
    label: '🎵 เพลง C-Pop: 甜蜜蜜 (หวานปานน้ำผึ้ง)',
    title: '甜蜜蜜 · เถียนมี่มี่',
    text: '甜蜜蜜，你笑得甜蜜蜜。\n好像花儿开在春风里。\n在哪里，在哪里见过你？\n你的笑容这样熟悉。'
  },
  {
    id: 'drama-boba',
    label: '🎬 ซับซีรีส์: นัดเจอที่ร้านชานม',
    title: '奶茶店见 · เจอกันร้านชานม',
    text: '今天工作太忙了，我想喝一杯珍珠奶茶。\n少冰半糖，好不好？\n下班以后我们在地铁站见面吧！'
  },
  {
    id: 'xhs-travel',
    label: '📕 โพสต์ Xiaohongshu: เที่ยวเซี่ยงไฮ้',
    title: '上海周末游 · เที่ยวเซี่ยงไฮ้สุดสัปดาห์',
    text: '周末我和朋友一起去上海旅游。\n早上喝咖啡，下午逛街买东西。\n晚上看夜景，真的太漂亮了！'
  }
];

const PUNCT_RE = /^[\s，。！？、；：“”‘’（）《》【】—…,.!?;:'"()\-~·]+$/;
const CJK_RE = /[\u4e00-\u9fff]/;

/**
 * Builds a fast lookup map `hanzi -> { hz, py, th }` from core vocabulary + 10,969 lexicon.
 */
export function buildChineseLookupMap(core) {
  const map = new Map();
  const add = (hz, py, th) => {
    if (!hz) return;
    if (!map.has(hz)) map.set(hz, { hz, py: py || '', th: th || '' });
  };
  for (const w of (core?.allVocabWords || [])) {
    add(w.hanzi || w.hz, w.pinyin || w.py, w.meaning || w.th);
  }
  for (const w of (core?.lexicon || [])) {
    add(w.hanzi || w.hz, w.pinyin || w.py, w.meaning || w.th);
  }
  // Extra lyrical / everyday words so preset C-Pop & Xiaohongshu samples shine even before lazy lexicon finishes
  const extras = [
    ['甜蜜蜜', 'tiánmìmì', 'หวานชื่น / หวานปานน้ำผึ้ง'],
    ['甜蜜', 'tiánmì', 'หวานชื่น'],
    ['笑', 'xiào', 'ยิ้ม / หัวเราะ'],
    ['好像', 'hǎoxiàng', 'ราวกับ / ดูเหมือนว่า'],
    ['花儿', 'huār', 'ดอกไม้'],
    ['春风', 'chūnfēng', 'ลมฤดูใบไม้ผลิ'],
    ['见过', 'jiànguo', 'เคยพบเจอ'],
    ['笑容', 'xiàoróng', 'รอยยิ้ม'],
    ['熟悉', 'shúxī', 'คุ้นเคย'],
    ['珍珠', 'zhēnzhū', 'ไข่มุก'],
    ['奶茶', 'nǎichá', 'ชานม'],
    ['少冰', 'shǎobīng', 'น้ำแข็งน้อย'],
    ['半糖', 'bàntáng', 'หวาน 50%'],
    ['下班', 'xiàbān', 'เลิกงาน'],
    ['以后', 'yǐhòu', 'หลังจาก'],
    ['地铁站', 'dìtiězhàn', 'สถานีรถไฟใต้ดิน'],
    ['见面', 'jiànmiàn', 'พบกัน / เจอกัน'],
    ['周末', 'zhōumò', 'สุดสัปดาห์'],
    ['上海', 'Shànghǎi', 'เซี่ยงไฮ้'],
    ['旅游', 'lǚyóu', 'ท่องเที่ยว'],
    ['逛街', 'guàngjiē', 'เดินช้อปปิ้ง'],
    ['夜景', 'yèjǐng', 'วิวกลางคืน'],
    ['漂亮', 'piàoliang', 'สวยมาก']
  ];
  for (const [hz, py, th] of extras) add(hz, py, th);
  return map;
}

/**
 * Segments raw Chinese text into lines of `{ zh, py, th, punct }` tokens.
 * Combines dictionary longest-prefix matching (up to 4 chars) with `Intl.Segmenter('zh', { granularity: 'word' })`.
 */
export function segmentChineseText(rawText, lookupMap = new Map()) {
  const lines = String(rawText || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean).slice(0, 30);
  const seg = typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter('zh-CN', { granularity: 'word' })
    : null;

  const lookupPiece = (word) => {
    if (PUNCT_RE.test(word) || !CJK_RE.test(word)) {
      return [{ zh: word, py: '', th: '', punct: true }];
    }
    const exact = lookupMap.get(word);
    if (exact) {
      return [{ zh: word, py: exact.py, th: exact.th, punct: false }];
    }
    // Greedy sub-segmentation against lookupMap (max len 4 -> 1)
    const chars = [...word];
    const sub = [];
    let i = 0;
    while (i < chars.length) {
      let matched = null;
      for (let len = Math.min(4, chars.length - i); len >= 1; len--) {
        const cand = chars.slice(i, i + len).join('');
        if (lookupMap.has(cand)) {
          const hit = lookupMap.get(cand);
          matched = { zh: cand, py: hit.py, th: hit.th, punct: false, len };
          break;
        }
      }
      if (matched) {
        sub.push({ zh: matched.zh, py: matched.py, th: matched.th, punct: false });
        i += matched.len;
      } else {
        sub.push({ zh: chars[i], py: '', th: 'แตะเพื่อฟังเสียง', punct: false });
        i += 1;
      }
    }
    return sub;
  };

  return lines.map((line) => {
    const tokens = [];
    if (seg) {
      for (const part of seg.segment(line)) {
        tokens.push(...lookupPiece(part.segment));
      }
    } else {
      // Pure dictionary longest-match fallback
      const chars = [...line];
      let i = 0;
      while (i < chars.length) {
        if (PUNCT_RE.test(chars[i]) || !CJK_RE.test(chars[i])) {
          tokens.push({ zh: chars[i], py: '', th: '', punct: true });
          i++;
          continue;
        }
        let matched = null;
        for (let len = Math.min(4, chars.length - i); len >= 1; len--) {
          const cand = chars.slice(i, i + len).join('');
          if (lookupMap.has(cand)) {
            matched = lookupMap.get(cand);
            tokens.push({ zh: cand, py: matched.py, th: matched.th, punct: false });
            i += len;
            break;
          }
        }
        if (!matched) {
          tokens.push({ zh: chars[i], py: '', th: 'แตะเพื่อฟังเสียง', punct: false });
          i++;
        }
      }
    }
    return { raw: line, tokens };
  });
}

/**
 * Extracts unique vocabulary items `{ hz, py, th }` with known meanings from segmented lines,
 * and builds custom 4-option duel questions for 1v1 Arena!
 */
export function buildDuelQuestionsFromTokens(segmentedLines) {
  const unique = [];
  const seen = new Set();
  for (const line of segmentedLines) {
    for (const t of line.tokens) {
      if (!t.punct && t.zh && t.th && t.th !== 'แตะเพื่อฟังเสียง' && !seen.has(t.zh)) {
        seen.add(t.zh);
        unique.push({ hz: t.zh, py: t.py, th: t.th });
      }
    }
  }
  const fallbackPool = ['สวัสดี', 'ขอบคุณ', 'ชานม', 'ท่องเที่ยว', 'อร่อยมาก', 'เลิกงาน', 'ความสุข', 'เพื่อนสนิท'];
  return unique.slice(0, 10).map((item) => {
    const distractors = unique
      .filter(u => u.hz !== item.hz && u.th !== item.th)
      .map(u => u.th);
    for (const fb of fallbackPool) {
      if (distractors.length >= 3) break;
      if (fb !== item.th && !distractors.includes(fb)) distractors.push(fb);
    }
    const opts = [item.th, ...distractors.slice(0, 3)].sort(() => Math.random() - 0.5);
    return {
      q: `${item.hz}${item.py ? ` (${item.py})` : ''}`,
      a: item.th,
      opts
    };
  });
}

export function renderSmartImporterSection(core, host) {
  const state = {
    title: PRESET_IMPORTS[0].title,
    rawText: PRESET_IMPORTS[0].text,
    showPinyin: true,
    playingLine: -1
  };

  if (typeof core?.ensureLexiconLoaded === 'function') {
    core.ensureLexiconLoaded().then(() => draw());
  }

  function saveExtractedToSrs(uniqueWords) {
    let added = 0;
    const allWords = core.allVocabWords || [];
    const byHz = new Map(allWords.map(w => [w.hanzi || w.hz, w]));
    const tk = core.todayKey();
    if (!core.state.progress.vocabLearned) core.state.progress.vocabLearned = {};
    if (!core.state.progress.vocabSrs) core.state.progress.vocabSrs = {};

    for (const u of uniqueWords) {
      toggleStarWord(core, u.hz);
      const hit = byHz.get(u.hz);
      if (hit && hit.id !== undefined && !core.state.progress.vocabLearned[hit.id]) {
        core.state.progress.vocabLearned[hit.id] = tk;
        core.state.progress.vocabSrs[hit.id] = { step: 0, interval: 1, ease: 2.5, reviews: 0, lapses: 0, nextDue: tk, updatedAt: Date.now() };
        added++;
      }
    }
    core.addXp(15, `บันทึกคำศัพท์จากบทความ ${uniqueWords.length} คำ!`);
    core.showToast(`บันทึก ${uniqueWords.length} คำเข้าสมุดทบทวน & SRS แล้ว (+${added} คำใหม่ในคลัง) ⭐`);
  }

  async function createDuelFromText(segmented) {
    const customQuestions = buildDuelQuestionsFromTokens(segmented);
    if (customQuestions.length < 4) {
      core.showToast('ข้อความสั้นเกินไป กรุณาวางประโยคจีนที่มีคำศัพท์อย่างน้อย 4 คำเพื่อสร้างห้องดวลครับ');
      return;
    }
    const ext = core.getExt('arena') || {};
    const res = await core.api('/api/arena/rooms', {
      topic: 'custom',
      title: state.title || 'ดวลศัพท์จากเพลง/ซับจีน',
      customQuestions,
      name: ext.displayName || 'Host',
      avatar: ext.avatar || '🐼'
    }, 'POST');

    if (res.ok && res.data?.room) {
      window.__nihaoPendingArenaRoom = res.data.room;
      core.showToast(`สร้างห้องดวลรหัส ${res.data.room.code} จากเนื้อเพลงแล้ว! ⚔️`);
      core.switchTab('arena');
    } else {
      core.showToast(res.data?.error || 'สร้างห้องดวลไม่สำเร็จ');
    }
  }

  function draw() {
    const lookupMap = buildChineseLookupMap(core);
    const segmented = segmentChineseText(state.rawText, lookupMap);
    const uniqueKnown = [];
    const seen = new Set();
    for (const l of segmented) {
      for (const t of l.tokens) {
        if (!t.punct && t.th && t.th !== 'แตะเพื่อฟังเสียง' && !seen.has(t.zh)) {
          seen.add(t.zh);
          uniqueKnown.push({ hz: t.zh, py: t.py, th: t.th });
        }
      }
    }

    host.innerHTML = `
      <div class="gr-card">
        <div class="gr-between">
          <div>
            <h3 class="gr-title">🎵 โหมดเรียนจากเพลงจีน / ซับซีรีส์ / บทความ (Smart Reader)</h3>
            <p class="gr-sub">วางเนื้อเพลง C-Pop, ซับซีรีส์ หรือโพสต์ Xiaohongshu → ตัดคำอัตโนมัติ + พินอิน + แตะแปล + สร้างห้องดวล 1v1 ทันที</p>
          </div>
          <span class="gr-badge">${uniqueKnown.length} คำศัพท์ที่พบ</span>
        </div>

        <div class="gr-row">
          ${PRESET_IMPORTS.map(p => `
            <button type="button" class="btn-secondary" style="font-size:12px;padding:5px 10px" data-preset="${p.id}">${esc(core, p.label)}</button>
          `).join('')}
        </div>

        <textarea id="gr-imp-text" class="vb-search" rows="4" style="width:100%;font-size:15px;line-height:1.5;resize:vertical" placeholder="วางเนื้อเพลงหรือประโยคภาษาจีนที่นี่...">${esc(core, state.rawText)}</textarea>

        <div class="gr-between">
          <div class="gr-row">
            <button type="button" class="btn-primary" id="gr-imp-analyze">✨ แปลงเป็นบทเรียนแตะแปล</button>
            <button type="button" class="btn-secondary" id="gr-imp-toggle-py">${state.showPinyin ? '🙈 ซ่อนพินอิน' : '👁️ แสดงพินอิน'}</button>
          </div>
          <div class="gr-row">
            <button type="button" class="btn-secondary" id="gr-imp-save-srs">⭐ เก็บทั้งชุดเข้า SRS (${uniqueKnown.length})</button>
            <button type="button" class="btn-primary" id="gr-imp-duel">⚔️ สร้างห้องดวล 1v1 จากข้อความนี้</button>
          </div>
        </div>
      </div>

      <div class="gr-card" style="margin-top:12px">
        <div class="gr-between">
          <strong>📖 กระดานอ่านแตะแปล (แตะที่คำเพื่อดูคำแปล & ฟังเสียง)</strong>
          <button type="button" class="btn-secondary" style="font-size:12px;padding:5px 10px" id="gr-imp-play-all">🔊 อ่านออกเสียงทั้งบท</button>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;margin-top:6px">
          ${segmented.map((line, li) => `
            <div class="gr-story-sent ${state.playingLine === li ? 'is-active' : ''}">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
                <div style="line-height:2">
                  ${line.tokens.map((t, ti) => t.punct
                    ? `<span class="gr-tok-punct">${esc(core, t.zh)}</span>`
                    : `<button type="button" class="gr-tok" data-li="${li}" data-ti="${ti}">
                        ${state.showPinyin && t.py ? `<span class="gr-tok-py">${esc(core, t.py)}</span>` : ''}
                        <span class="gr-tok-zh hanzi-font">${esc(core, t.zh)}</span>
                      </button>`
                  ).join('')}
                </div>
                <button type="button" class="btn-secondary" style="padding:4px 9px;font-size:12px;flex-shrink:0" data-say-line="${li}">🔊</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    host.querySelectorAll('[data-preset]').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = PRESET_IMPORTS.find(x => x.id === btn.dataset.preset);
        if (p) {
          state.title = p.title;
          state.rawText = p.text;
          draw();
        }
      });
    });

    host.querySelector('#gr-imp-analyze')?.addEventListener('click', () => {
      state.rawText = host.querySelector('#gr-imp-text')?.value || '';
      state.title = 'บทเรียนที่นำเข้าเอง';
      core.playChime('ok', true);
      draw();
    });

    host.querySelector('#gr-imp-toggle-py')?.addEventListener('click', () => {
      state.rawText = host.querySelector('#gr-imp-text')?.value || state.rawText;
      state.showPinyin = !state.showPinyin;
      draw();
    });

    host.querySelector('#gr-imp-save-srs')?.addEventListener('click', () => {
      if (!uniqueKnown.length) return core.showToast('ยังไม่มีคำศัพท์ที่รู้จักในข้อความนี้');
      saveExtractedToSrs(uniqueKnown);
    });

    host.querySelector('#gr-imp-duel')?.addEventListener('click', () => createDuelFromText(segmented));

    host.querySelectorAll('.gr-tok').forEach(tokBtn => {
      tokBtn.addEventListener('click', () => {
        const li = Number(tokBtn.dataset.li);
        const ti = Number(tokBtn.dataset.ti);
        const tok = segmented[li]?.tokens?.[ti];
        if (tok) {
          core.speak(tok.zh);
          openWordPopover(core, tokBtn, tok);
        }
      });
    });

    host.querySelectorAll('[data-say-line]').forEach(btn => {
      btn.addEventListener('click', () => {
        const li = Number(btn.dataset.sayLine);
        const line = segmented[li];
        if (line) core.speak(line.raw);
      });
    });

    host.querySelector('#gr-imp-play-all')?.addEventListener('click', () => {
      let idx = 0;
      const next = () => {
        if (idx >= segmented.length) {
          state.playingLine = -1;
          draw();
          return;
        }
        state.playingLine = idx;
        draw();
        const text = segmented[idx].raw;
        idx++;
        core.speak(text, () => setTimeout(next, 250));
      };
      next();
    });
  }

  draw();
  return () => core?.stopSpeech?.();
}
