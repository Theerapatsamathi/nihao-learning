// Flagship AI Studio Hub:
// 1) AI Personal Podcast (2-host Chirp 3 HD dialogue)
// 2) Visual Mnemonic Flashcards (Gemini story + Imagen 3 illustration)
// 3) AI Weakness Auto-Drill (3-min targeted repair)
// 4) Shareable Chinese Level Card (1080x1350 PNG download)

import {
  generatePersonalPodcast,
  generateVisualMnemonic,
  generateWeaknessDrill,
  buildShareableLevelCardDataUrl
} from '../../modules/gcp-ai.js';

export function renderAiFlagshipHub(core, host) {
  const esc = core?.escapeHtml || ((s) => String(s ?? ''));
  let activeTab = 'podcast';
  let busy = false;
  let podcastData = null;
  let mnemonicData = null;
  let drillData = null;
  let cardDataUrl = null;
  let activeAudio = null;

  function stopAudio() {
    if (activeAudio) {
      try { activeAudio.pause(); } catch {}
      activeAudio = null;
    }
  }

  async function playPodcastSequence(lines) {
    stopAudio();
    for (const line of lines || []) {
      const voice = line.speaker === 'B' ? 'male' : 'female';
      const url = `/api/tts?text=${encodeURIComponent(line.hz)}&lang=zh-CN&voice=${voice}`;
      await new Promise((resolve) => {
        const audio = new Audio(url);
        activeAudio = audio;
        audio.onended = resolve;
        audio.onerror = resolve;
        audio.play().catch(resolve);
      });
      if (!activeAudio) break;
    }
  }

  function render() {
    host.innerHTML = `
      <div class="ss-card" style="padding:16px">
        <div class="ss-card-top">
          <div>
            <h3 class="ss-title">✨ Flagship AI Studio (Google Cloud)</h3>
            <p class="ss-muted">พอดแคสต์ส่วนตัว · การ์ดภาพช่วยจำ Imagen 3 · ซ่อมจุดอ่อนอัตโนมัติ · การ์ดแชร์เลเวล</p>
          </div>
        </div>
        <div class="ss-actions" style="margin:10px 0 14px;flex-wrap:wrap;gap:6px">
          <button type="button" class="btn-secondary ${activeTab === 'podcast' ? 'is-active' : ''}" data-ftab="podcast">🎙️ AI Podcast</button>
          <button type="button" class="btn-secondary ${activeTab === 'mnemonic' ? 'is-active' : ''}" data-ftab="mnemonic">🎨 ภาพช่วยจำ</button>
          <button type="button" class="btn-secondary ${activeTab === 'drill' ? 'is-active' : ''}" data-ftab="drill">🧠 ซ่อมจุดอ่อน</button>
          <button type="button" class="btn-secondary ${activeTab === 'card' ? 'is-active' : ''}" data-ftab="card">🏆 การ์ดแชร์เลเวล</button>
        </div>
        <div id="flagship-body"></div>
      </div>
    `;

    host.querySelectorAll('[data-ftab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        stopAudio();
        activeTab = btn.dataset.ftab;
        render();
      });
    });

    const body = host.querySelector('#flagship-body');
    if (activeTab === 'podcast') {
      body.innerHTML = `
        <div class="ss-input-row" style="margin-bottom:10px">
          <input id="fp-topic" class="ss-input" placeholder="หัวข้อพอดแคสต์ เช่น สั่งชานม, เที่ยวปักกิ่ง..." value="ชีวิตประจำวันในจีน" />
          <button type="button" class="btn-primary" id="fp-gen" ${busy ? 'disabled' : ''}>${busy ? 'กำลังสร้าง...' : '🎙️ สร้างพอดแคสต์'}</button>
        </div>
        ${podcastData ? `
          <div class="ss-card" style="padding:12px">
            <h4>${esc(podcastData.title)}</h4>
            <p class="ss-muted">${esc(podcastData.topicSummary)}</p>
            <div class="ss-actions" style="margin:8px 0">
              <button type="button" class="btn-primary" id="fp-play-all">▶ เล่นทั้งตอน (เสียง Chirp 3 HD ชาย+หญิง)</button>
              <button type="button" class="btn-secondary" id="fp-stop">⏹ หยุด</button>
            </div>
            ${(podcastData.lines || []).map((l) => `
              <div style="padding:8px;border-bottom:1px solid rgba(148,163,184,0.2)">
                <strong>${l.speaker === 'B' ? '👨 大明' : '👩 小美'}:</strong>
                <span class="hanzi-font" style="font-size:1.05rem">${esc(l.hz)}</span>
                <div class="ss-py">${esc(l.py)}</div>
                <div class="ss-th">${esc(l.th)}</div>
              </div>
            `).join('')}
          </div>
        ` : '<p class="ss-muted">กดปุ่มด้านบนเพื่อให้ Gemini เขียนบทพอดแคสต์ 2 พิธีกรจากคำศัพท์ของคุณ</p>'}
      `;
      body.querySelector('#fp-gen')?.addEventListener('click', async () => {
        busy = true;
        render();
        try {
          const topic = host.querySelector('#fp-topic')?.value || 'ชีวิตประจำวันในจีน';
          const res = await generatePersonalPodcast({ topic });
          podcastData = res.podcast;
        } catch (err) {
          core?.showToast?.(err.message || 'สร้างพอดแคสต์ไม่สำเร็จ', 'AI');
        } finally {
          busy = false;
          render();
        }
      });
      body.querySelector('#fp-play-all')?.addEventListener('click', () => playPodcastSequence(podcastData?.lines));
      body.querySelector('#fp-stop')?.addEventListener('click', stopAudio);
    }

    if (activeTab === 'mnemonic') {
      body.innerHTML = `
        <div class="ss-input-row" style="margin-bottom:10px">
          <input id="fm-hz" class="ss-input" placeholder="พิมพ์อักษรจีน เช่น 好, 休, 熊猫..." value="${esc(mnemonicData?.hz || '休')}" />
          <button type="button" class="btn-primary" id="fm-gen" ${busy ? 'disabled' : ''}>${busy ? 'กำลังวาด...' : '🎨 วาดภาพช่วยจำ'}</button>
        </div>
        ${mnemonicData ? `
          <div class="ss-card" style="padding:12px">
            ${mnemonicData.imageUrl ? `<img src="${mnemonicData.imageUrl}" alt="${esc(mnemonicData.hz)}" style="width:100%;max-width:340px;border-radius:14px;display:block;margin:0 auto 10px" />` : ''}
            <h3 class="hanzi-font" style="text-align:center;font-size:2rem;margin:0">${esc(mnemonicData.hz)} <span style="font-size:1rem">(${esc(mnemonicData.py)})</span></h3>
            <p style="text-align:center;margin:4px 0 8px"><strong>${esc(mnemonicData.th)}</strong></p>
            <p class="ss-muted">🧩 <strong>แยกส่วนประกอบ:</strong> ${esc(mnemonicData.radicalBreakdown)}</p>
            <p>💡 <strong>เรื่องราวช่วยจำ:</strong> ${esc(mnemonicData.memoryStory)}</p>
          </div>
        ` : '<p class="ss-muted">พิมพ์อักษรจีนที่จำยาก แล้วให้ Gemini + Imagen 3 วาดภาพช่วยจำให้ทันที</p>'}
      `;
      body.querySelector('#fm-gen')?.addEventListener('click', async () => {
        const hz = host.querySelector('#fm-hz')?.value?.trim();
        if (!hz) return;
        busy = true;
        render();
        try {
          const res = await generateVisualMnemonic({ hz });
          mnemonicData = res.mnemonic;
        } catch (err) {
          core?.showToast?.(err.message || 'สร้างภาพช่วยจำไม่สำเร็จ', 'AI');
        } finally {
          busy = false;
          render();
        }
      });
    }

    if (activeTab === 'drill') {
      body.innerHTML = `
        <button type="button" class="btn-primary" id="fd-gen" style="margin-bottom:10px" ${busy ? 'disabled' : ''}>
          ${busy ? 'กำลังวิเคราะห์จุดอ่อน...' : '🧠 เสกชุดซ่อมจุดอ่อน 3 นาที'}
        </button>
        ${drillData ? `
          <div class="ss-card" style="padding:12px">
            <h4>🎯 ${esc(drillData.focusTitle)}</h4>
            <p class="ss-muted">${esc(drillData.coachTip)}</p>
            ${(drillData.drills || []).map((d, i) => `
              <div style="padding:8px;border-bottom:1px solid rgba(148,163,184,0.2)">
                <div class="hanzi-font" style="font-size:1.15rem">${i + 1}. ${esc(d.hz)} <small>(${esc(d.py)})</small></div>
                <div>${esc(d.th)}</div>
                <div class="ss-muted" style="font-size:0.85rem">⚠️ ${esc(d.trapNote)}</div>
                <button type="button" class="btn-secondary fd-speak" data-hz="${esc(d.hz)}" style="margin-top:4px;padding:3px 8px;font-size:12px">🔊 ฟังเสียง</button>
              </div>
            `).join('')}
          </div>
        ` : '<p class="ss-muted">กดปุ่มเพื่อให้ AI วิเคราะห์คำที่ผิดบ่อยและสร้างชุดฝึกเฉพาะตัว</p>'}
      `;
      body.querySelector('#fd-gen')?.addEventListener('click', async () => {
        busy = true;
        render();
        try {
          const mistakes = Array.isArray(core?.state?.mistakes) ? core.state.mistakes.slice(0, 10) : [];
          const res = await generateWeaknessDrill({ mistakes, weakTones: [2, 3] });
          drillData = res.drill;
        } catch (err) {
          core?.showToast?.(err.message || 'สร้างชุดฝึกไม่สำเร็จ', 'AI');
        } finally {
          busy = false;
          render();
        }
      });
      body.querySelectorAll('.fd-speak').forEach((b) => {
        b.addEventListener('click', () => core?.speak?.(b.dataset.hz));
      });
    }

    if (activeTab === 'card') {
      if (!cardDataUrl) {
        const st = core?.state || {};
        const mastered = Object.keys(st.vocabSrs || {}).length;
        cardDataUrl = buildShareableLevelCardDataUrl({
          name: st.profileName || 'ผู้เรียน 你好 Nihao',
          avatar: st.avatar || '🐼',
          levelTitle: mastered >= 150 ? 'HSK 2–3 Warrior' : 'HSK 1–2 Explorer',
          streak: Number(st.streak || 0),
          totalXp: Number(st.xp || 0),
          masteredWords: mastered,
          toneScore: 92
        });
      }
      body.innerHTML = `
        <div style="text-align:center">
          <img src="${cardDataUrl}" alt="Chinese Level Card" style="width:100%;max-width:320px;border-radius:16px;box-shadow:0 12px 30px rgba(0,0,0,0.25);margin-bottom:12px" />
          <div>
            <a href="${cardDataUrl}" download="nihao-chinese-level-card.png" class="btn-primary" style="display:inline-block;text-decoration:none">⬇️ ดาวน์โหลดรูปแชร์ลง IG / LINE</a>
          </div>
        </div>
      `;
    }
  }

  render();
}
