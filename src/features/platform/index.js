// Platform feature group entry point (`settings-plus` tab)
import './style.css';
import { DATA_PACK_SIZES, formatBytes } from './logic.js';
import { DISPLAY_MODE_META, initDisplayMode } from './display-mode.js';
import { SFX_PACK_META, initHapticsSfx } from './haptics-sfx.js';
import { initReminders } from './reminders.js';
import { initOfflinePack } from './offline-pack.js';
import { initWordOfTheDay } from './wotd.js';
import { collectWhatsNewTabs } from './whats-new.js';
import { initLanguageSwitcher, initFirebaseGoogleAuth } from './i18n-firebase-auth.js';
import { renderAiFlagshipHub } from './ai-flagship-hub.js';
import { renderRetentionSuite } from './retention-suite.js';
import { initUxPolish } from './ux-polish.js';

const core = window.NihaoCore;

if (core) {
  initLanguageSwitcher(core);
  initFirebaseGoogleAuth(core);
  initUxPolish(core);

  core.registerTab({
    id: 'ai-flagship-studio',
    label: '✨ AI Studio',
    title: '✨ Flagship AI Studio (Google Cloud)',
    desc: 'พอดแคสต์จีน 2 พิธีกร · การ์ดภาพช่วยจำ Imagen 3 · ซ่อมจุดอ่อน 3 นาที · การ์ดแชร์เลเวล',
    emoji: '✨',
    iconClass: 'icon-amber',
    section: 'ai',
    sectionTitle: '✨ AI Studio',
    render(host) {
      renderAiFlagshipHub(core, host);
    }
  });

  core.registerTab({
    id: 'panda-retention',
    label: '🎋 แพนด้า & ภารกิจ',
    title: '🎋 สวนแพนด้า · สปรินต์ 60 วิ · กล่องสุ่ม · พาสปอร์ตจีน',
    desc: 'เลี้ยงน้องแพนด้าโตตาม Streak · ต่อ Streak ด่วนใน 1 นาที · เปิดกล่องสุ่มรายวัน · เก็บตราประทับ 6 เมืองจีน',
    emoji: '🐼',
    iconClass: 'icon-emerald',
    section: 'ai',
    sectionTitle: '✨ AI Studio',
    render(host) {
      renderRetentionSuite(core, host);
    }
  });
  const displayCtrl = initDisplayMode(core);
  const hapticsCtrl = initHapticsSfx(core);
  const remindersCtrl = initReminders(core);
  const offlineCtrl = initOfflinePack(core);
  const wotdCtrl = initWordOfTheDay(core);

  let isDownloading = false;

  core.registerTab({
    id: 'settings-plus',
    label: 'ตั้งค่า & ออฟไลน์',
    title: 'ตั้งค่า การแสดงผล & โหมดออฟไลน์',
    desc: 'ปรับโหมดแสดงพินอิน/อักษรจีน ตั้งเวลาเตือนเรียน ดาวน์โหลดแพ็กเสียงออฟไลน์ เสียงประกอบ และคำศัพท์ประจำวัน',
    emoji: '⚙️',
    iconClass: 'icon-indigo',
    section: 'system',
    sectionTitle: '⚙️ System',
    render(host) {
      renderSettingsPage(host);
    }
  });

  function renderSettingsPage(host) {
    const mode = displayCtrl.getMode();
    const hapticsPrefs = hapticsCtrl.getPrefs();
    const remCfg = remindersCtrl.getConfig();
    const remCaps = remindersCtrl.getCapabilities();
    const nextRem = remindersCtrl.getNextReminder();
    const decks = offlineCtrl.getAvailableDecks();
    const quota = offlineCtrl.getTtsQuota();
    const word = wotdCtrl.getTodayWord();
    const whatsNew = collectWhatsNewTabs();

    const permLabel =
      remCaps.permission === 'granted' ? 'อนุญาตแล้ว'
        : remCaps.permission === 'denied' ? 'ถูกบล็อกในเบราว์เซอร์'
          : remCaps.permission === 'unsupported' ? 'ไม่รองรับ'
            : 'ยังไม่ได้ขอสิทธิ์';

    host.innerHTML = `
      <div class="pf-grid">
        <!-- #10 Global Display Mode -->
        <section class="card-panel pf-card">
          <div class="pf-card-head">
            <div>
              <h2 class="pf-card-title">👁️ โหมดการแสดงผล (Global Display)</h2>
              <p class="pf-card-desc">ปรับการแสดงพินอินและอักษรจีนทั่วทั้งแอป (ยกเว้นหน้าสอนพินอินโดยตรง)</p>
            </div>
            <span class="pf-badge pf-badge-ok">${core.escapeHtml(DISPLAY_MODE_META[mode].short)}</span>
          </div>
          <div class="pf-mode-grid" role="radiogroup" aria-label="โหมดการแสดงผล">
            ${Object.values(DISPLAY_MODE_META).map((m) => `
              <button type="button" class="pf-mode-btn ${m.id === mode ? 'active' : ''}" data-pf-mode="${m.id}" aria-pressed="${m.id === mode}">
                <strong>${core.escapeHtml(m.label)}</strong>
                <span>${core.escapeHtml(m.desc)}</span>
              </button>
            `).join('')}
          </div>
          <div class="pf-note">
            💡 คุณสามารถสลับโหมดอย่างรวดเร็วได้จากปุ่มลอยมุมซ้ายล่างของหน้าจอ หรืออ่านค่าจาก <code>document.documentElement.dataset.pfDisplay</code>
          </div>
        </section>

        <!-- #40 Word of the Day -->
        <section class="card-panel pf-card">
          <div class="pf-card-head">
            <div>
              <h2 class="pf-card-title">✨ คำศัพท์ประจำวัน (Word of the Day)</h2>
              <p class="pf-card-desc">สุ่มคำศัพท์อัตโนมัติตามวันที่ ${core.escapeHtml(core.todayKey())}</p>
            </div>
            <span class="pf-badge">${core.escapeHtml(word?.level || 'HSK 1')}</span>
          </div>
          ${word ? `
            <div class="pf-wotd-card-body">
              <div class="pf-wotd-big-hz hanzi-font" data-pf-role="hanzi">${core.escapeHtml(word.hanzi)}</div>
              <div class="pf-wotd-big-py" data-pf-role="pinyin">${core.escapeHtml(word.pinyin)}</div>
              <div class="pf-wotd-big-th">${core.escapeHtml(word.thai)}</div>
              ${word.exampleZh ? `
                <div class="pf-wotd-ex">
                  <div class="hanzi-font" data-pf-role="hanzi">${core.escapeHtml(word.exampleZh)}</div>
                  ${word.examplePy ? `<div data-pf-role="pinyin">${core.escapeHtml(word.examplePy)}</div>` : ''}
                  ${word.exampleTh ? `<div>${core.escapeHtml(word.exampleTh)}</div>` : ''}
                </div>
              ` : ''}
            </div>
            <div class="pf-inline-form">
              <button type="button" class="btn-secondary" id="pf-wotd-speak">🔊 ฟังเสียง</button>
              <button type="button" class="btn-primary" id="pf-wotd-share">📤 แชร์การ์ด PNG (1080×1920)</button>
            </div>
          ` : '<div class="pf-note">ยังไม่มีคำศัพท์ในคลัง</div>'}
        </section>

        <!-- #39 Haptics & SFX -->
        <section class="card-panel pf-card">
          <div class="pf-card-head">
            <div>
              <h2 class="pf-card-title">🔊 เสียงเอฟเฟกต์ & การสั่น (Haptics + SFX)</h2>
              <p class="pf-card-desc">ตอบสนองเมื่อตอบถูก/ผิดในแบบฝึกหัดทุกหน้า</p>
            </div>
          </div>
          <div class="pf-row">
            <div>
              <div class="pf-row-label">สั่นตอบสนอง (Haptics)</div>
              <div class="pf-row-sub">${hapticsCtrl.supportsVibrate ? 'สั่นสั้นเมื่อถูก · สั่นคู่เมื่อผิด' : 'อุปกรณ์/เบราว์เซอร์นี้ไม่รองรับการสั่น'}</div>
            </div>
            <label class="pf-switch" aria-label="เปิด/ปิดการสั่น">
              <input type="checkbox" id="pf-haptics-toggle" ${hapticsPrefs.hapticsEnabled ? 'checked' : ''}>
              <span class="pf-slider"></span>
            </label>
          </div>
          <div>
            <div class="pf-row-label" style="margin-bottom:8px">ชุดเสียงฉลองเสริม (Web Audio)</div>
            <div class="pf-mode-grid">
              ${Object.values(SFX_PACK_META).map((p) => `
                <button type="button" class="pf-mode-btn ${p.id === hapticsPrefs.sfxPack ? 'active' : ''}" data-pf-sfx="${p.id}" aria-pressed="${p.id === hapticsPrefs.sfxPack}">
                  <strong>${core.escapeHtml(p.label)}</strong>
                  <span>${core.escapeHtml(p.desc)}</span>
                </button>
              `).join('')}
            </div>
          </div>
          <div class="pf-inline-form">
            <button type="button" class="btn-secondary pf-btn-sm" id="pf-test-ok">ทดสอบตอบถูก</button>
            <button type="button" class="btn-secondary pf-btn-sm" id="pf-test-err">ทดสอบตอบผิด</button>
            <button type="button" class="btn-secondary pf-btn-sm" id="pf-test-vib">ทดสอบสั่น</button>
          </div>
        </section>

        <!-- #37 Study Reminders -->
        <section class="card-panel pf-card">
          <div class="pf-card-head">
            <div>
              <h2 class="pf-card-title">⏰ เตือนเวลาเรียน (Study Reminders)</h2>
              <p class="pf-card-desc">แจ้งเตือนอัตโนมัติเมื่อยังไม่ได้ฝึกภาษาจีนในวันนี้</p>
            </div>
            <span class="pf-badge ${remCaps.permission === 'granted' ? 'pf-badge-ok' : 'pf-badge-warn'}">${permLabel}</span>
          </div>
          <div class="pf-row">
            <div>
              <div class="pf-row-label">เปิดการแจ้งเตือนรายวัน</div>
              <div class="pf-row-sub">${nextRem && remCfg.enabled ? `รอบถัดไป: ${nextRem.slot} น.` : 'ปิดอยู่'}</div>
            </div>
            <label class="pf-switch" aria-label="เปิด/ปิดการแจ้งเตือนรายวัน">
              <input type="checkbox" id="pf-rem-toggle" ${remCfg.enabled ? 'checked' : ''}>
              <span class="pf-slider"></span>
            </label>
          </div>
          <div class="pf-slot-list" id="pf-rem-slots">
            ${remCfg.times.map((t) => `
              <span class="pf-slot-chip">
                <span>${core.escapeHtml(t)} น.</span>
                <button type="button" data-pf-rem-del="${core.escapeHtml(t)}" aria-label="ลบเวลา ${core.escapeHtml(t)}">✕</button>
              </span>
            `).join('')}
          </div>
          <div class="pf-inline-form">
            <input type="time" id="pf-rem-time-input" class="pf-input" value="19:30" aria-label="เลือกเวลาแจ้งเตือน">
            <button type="button" class="btn-secondary pf-btn-sm" id="pf-rem-add">+ เพิ่มเวลา</button>
            ${remCaps.permission !== 'granted'
              ? '<button type="button" class="btn-primary pf-btn-sm" id="pf-rem-perm">ขอสิทธิ์แจ้งเตือน</button>'
              : '<button type="button" class="btn-secondary pf-btn-sm" id="pf-rem-test">ทดสอบแจ้งเตือน</button>'}
          </div>
          <div class="pf-note">
            ${remCaps.isIOS && !remCaps.isStandalone
              ? '📱 บน iOS/iPadOS กรุณากด "เพิ่มไปยังหน้าจอโฮม" (Add to Home Screen) ก่อนจึงจะเปิดรับการแจ้งเตือนเว็บได้'
              : 'ℹ️ ทำงานผ่าน Notification API + Service Worker ขณะเปิดแอปหรือติดตั้งเป็น PWA (รองรับ Periodic Background Sync บน Chrome/Edge เมื่อติดตั้งแอป ไม่ใช้เซิร์ฟเวอร์ Push)'}
          </div>
        </section>

        <!-- #38 Offline Audio Pack -->
        <section class="card-panel pf-card">
          <div class="pf-card-head">
            <div>
              <h2 class="pf-card-title">📦 แพ็กเสียงออฟไลน์ (Offline Audio Pack)</h2>
              <p class="pf-card-desc">ดาวน์โหลดเสียงอ่านภาษาจีนเก็บไว้ในเครื่อง (แคช <code>nihao-audio-v1</code>)</p>
            </div>
            <span class="pf-badge" id="pf-audio-count-badge">กำลังตรวจสอบ...</span>
          </div>
          <div class="pf-inline-form">
            <select id="pf-deck-select" class="pf-input" aria-label="เลือกชุดคำศัพท์สำหรับดาวน์โหลดเสียง">
              ${decks.map((d) => `<option value="${core.escapeHtml(d.id)}">${core.escapeHtml(d.label)}</option>`).join('')}
            </select>
            <button type="button" class="btn-primary pf-btn-sm" id="pf-deck-dl">⬇️ ดาวน์โหลด</button>
            <button type="button" class="btn-secondary pf-btn-sm" id="pf-deck-cancel" hidden>ยกเลิก</button>
          </div>
          <div class="pf-progress-wrap" id="pf-dl-progress" hidden>
            <div class="pf-progress-track"><div class="pf-progress-fill" id="pf-dl-bar"></div></div>
            <div class="pf-row-sub" id="pf-dl-status">กำลังเตรียมดาวน์โหลด...</div>
          </div>
          <div class="pf-row">
            <div>
              <div class="pf-row-label">โควตาดาวน์โหลดเสียงวันนี้</div>
              <div class="pf-row-sub">ใช้ไปแล้ว ${quota.used} / ${quota.cap} คำ (เหลือ ${quota.remaining} คำ)</div>
            </div>
            <button type="button" class="btn-secondary pf-btn-sm" id="pf-audio-clear">🗑️ ล้างแคชเสียง</button>
          </div>
        </section>

        <!-- #36 Storage & Performance -->
        <section class="card-panel pf-card">
          <div class="pf-card-head">
            <div>
              <h2 class="pf-card-title">⚡ พื้นที่จัดเก็บ & ประสิทธิภาพ (Storage & Perf)</h2>
              <p class="pf-card-desc">ตรวจสอบขนาด Data Packs, สถานะ Lazy-load พจนานุกรม และพื้นที่แคช</p>
            </div>
          </div>
          <div id="pf-storage-summary" class="pf-note">กำลังอ่านข้อมูลพื้นที่จัดเก็บ...</div>
          <div class="pf-pack-list">
            ${DATA_PACK_SIZES.map((p) => `
              <div class="pf-pack-item">
                <span>${core.escapeHtml(p.label)} <small style="opacity:.7">(${core.escapeHtml(p.name)})</small></span>
                <strong>${formatBytes(p.bytes)} · ${p.eager ? 'Eager' : 'Lazy'}</strong>
              </div>
            `).join('')}
          </div>
          <div class="pf-inline-form">
            <button type="button" class="btn-secondary pf-btn-sm" id="pf-load-lexicon">📚 โหลดพจนานุกรม 10,969 คำ</button>
            <button type="button" class="btn-secondary pf-btn-sm" id="pf-refresh-storage">🔄 รีเฟรชสถานะ</button>
          </div>
        </section>

        <!-- What's New Changelog -->
        <section class="card-panel pf-card pf-card-full">
          <div class="pf-card-head">
            <div>
              <h2 class="pf-card-title">🆕 มีอะไรใหม่ใน 你好 Nihao (What's New)</h2>
              <p class="pf-card-desc">ทางลัดไปยังฟีเจอร์ใหม่ทั้งหมดที่เพิ่มเข้ามาในระบบ</p>
            </div>
            <span class="pf-badge pf-badge-ok">${whatsNew.length} ฟีเจอร์ใหม่</span>
          </div>
          <div class="pf-whatsnew-grid">
            ${whatsNew.map((item) => `
              <div class="pf-whatsnew-item">
                <div>
                  <strong>${core.escapeHtml(item.label)}</strong>
                  <p>${core.escapeHtml(item.desc)}</p>
                </div>
                <button type="button" class="btn-secondary pf-btn-sm" data-pf-goto="${core.escapeHtml(item.id)}">เปิดใช้งาน →</button>
              </div>
            `).join('')}
          </div>
        </section>
      </div>
    `;

    bindEvents(host);
    refreshStorageUi(host);
  }

  function bindEvents(host) {
    // Display mode buttons
    host.querySelectorAll('[data-pf-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        displayCtrl.setMode(btn.getAttribute('data-pf-mode'), { announce: true });
        renderSettingsPage(host);
      });
    });

    // WOTD actions
    host.querySelector('#pf-wotd-speak')?.addEventListener('click', () => {
      const w = wotdCtrl.getTodayWord();
      if (w) core.speak(w.hanzi);
    });
    host.querySelector('#pf-wotd-share')?.addEventListener('click', () => {
      wotdCtrl.shareWordCard();
    });

    // Haptics & SFX
    host.querySelector('#pf-haptics-toggle')?.addEventListener('change', (e) => {
      hapticsCtrl.setHaptics(e.target.checked);
    });
    host.querySelectorAll('[data-pf-sfx]').forEach((btn) => {
      btn.addEventListener('click', () => {
        hapticsCtrl.setSfxPack(btn.getAttribute('data-pf-sfx'));
        renderSettingsPage(host);
      });
    });
    host.querySelector('#pf-test-ok')?.addEventListener('click', () => hapticsCtrl.testOk());
    host.querySelector('#pf-test-err')?.addEventListener('click', () => hapticsCtrl.testErr());
    host.querySelector('#pf-test-vib')?.addEventListener('click', () => hapticsCtrl.testVibrate());

    // Reminders
    host.querySelector('#pf-rem-toggle')?.addEventListener('change', async (e) => {
      const checked = e.target.checked;
      if (checked && remindersCtrl.getCapabilities().permission === 'default') {
        await remindersCtrl.requestPermission();
      }
      remindersCtrl.setEnabled(checked);
      renderSettingsPage(host);
    });
    host.querySelector('#pf-rem-add')?.addEventListener('click', () => {
      const input = host.querySelector('#pf-rem-time-input');
      if (input && remindersCtrl.addTimeSlot(input.value)) {
        renderSettingsPage(host);
      } else {
        core.showToast('เวลานี้มีอยู่แล้วหรือรูปแบบไม่ถูกต้อง');
      }
    });
    host.querySelectorAll('[data-pf-rem-del]').forEach((btn) => {
      btn.addEventListener('click', () => {
        remindersCtrl.removeTimeSlot(btn.getAttribute('data-pf-rem-del'));
        renderSettingsPage(host);
      });
    });
    host.querySelector('#pf-rem-perm')?.addEventListener('click', async () => {
      await remindersCtrl.requestPermission();
      renderSettingsPage(host);
    });
    host.querySelector('#pf-rem-test')?.addEventListener('click', () => remindersCtrl.sendTest());

    // Offline Audio Pack
    const dlBtn = host.querySelector('#pf-deck-dl');
    const cancelBtn = host.querySelector('#pf-deck-cancel');
    const progWrap = host.querySelector('#pf-dl-progress');
    const progBar = host.querySelector('#pf-dl-bar');
    const progStatus = host.querySelector('#pf-dl-status');

    dlBtn?.addEventListener('click', async () => {
      if (isDownloading) return;
      const deckId = host.querySelector('#pf-deck-select')?.value;
      isDownloading = true;
      dlBtn.disabled = true;
      if (cancelBtn) cancelBtn.hidden = false;
      if (progWrap) progWrap.hidden = false;
      try {
        const res = await offlineCtrl.downloadDeck(deckId, (p) => {
          const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
          if (progBar) progBar.style.width = `${pct}%`;
          if (progStatus) {
            progStatus.textContent = `กำลังดาวน์โหลด ${p.done}/${p.total} (${p.current}) · ใหม่ ${p.downloaded} · มีแล้ว ${p.skipped}`;
          }
        });
        core.showToast(
          res.aborted
            ? `ยกเลิกแล้ว (บันทึกได้ ${res.downloaded} เสียง)`
            : `ดาวน์โหลดเสร็จสิ้น: ใหม่ ${res.downloaded} · มีแล้ว ${res.skipped}`
        );
      } catch (err) {
        core.showToast(err.message || 'ดาวน์โหลดเสียงไม่สำเร็จ');
      } finally {
        isDownloading = false;
        renderSettingsPage(host);
      }
    });

    cancelBtn?.addEventListener('click', () => {
      offlineCtrl.cancelDownload();
    });

    host.querySelector('#pf-audio-clear')?.addEventListener('click', async () => {
      await offlineCtrl.clearAudioCache();
      core.showToast('ล้างแคชเสียงออฟไลน์เรียบร้อยแล้ว');
      refreshStorageUi(host);
    });

    // Storage & Lexicon
    host.querySelector('#pf-load-lexicon')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      btn.textContent = 'กำลังโหลด...';
      try {
        await core.ensureLexiconLoaded();
        core.showToast('โหลดพจนานุกรม 10,969 คำเรียบร้อยแล้ว');
      } catch {
        core.showToast('โหลดพจนานุกรมไม่สำเร็จ');
      }
      refreshStorageUi(host);
    });
    host.querySelector('#pf-refresh-storage')?.addEventListener('click', () => refreshStorageUi(host));

    // What's new quick links
    host.querySelectorAll('[data-pf-goto]').forEach((btn) => {
      btn.addEventListener('click', () => {
        core.switchTab(btn.getAttribute('data-pf-goto'));
      });
    });
  }

  async function refreshStorageUi(host) {
    const stats = await offlineCtrl.getStorageStats();
    const audioBadge = host.querySelector('#pf-audio-count-badge');
    if (audioBadge) {
      audioBadge.textContent = `${stats.audioCount} เสียงในเครื่อง`;
    }
    const summary = host.querySelector('#pf-storage-summary');
    if (summary) {
      const storageLine = stats.supported
        ? `พื้นที่ใช้งาน: <strong>${stats.usageText}</strong> / ${stats.quotaText}`
        : 'เบราว์เซอร์ไม่เปิดเผยข้อมูล Storage Estimate';
      summary.innerHTML = `
        <div>${storageLine}</div>
        <div>Data Packs โหลดตอนเปิดแอป: <strong>${formatBytes(stats.eagerBytes)}</strong> · Lazy (lexicon.js): <strong>${formatBytes(stats.lazyBytes)}</strong> (${stats.lexiconLoaded ? `โหลดแล้ว ${stats.lexiconCount.toLocaleString()} คำ` : 'ยังไม่โหลด · ประหยัด ~1.05 MB'})</div>
        <div>แคชที่ใช้งานอยู่: <code>${stats.cacheNames.length ? stats.cacheNames.join(', ') : 'ยังไม่มี'}</code></div>
      `;
    }
    const lexBtn = host.querySelector('#pf-load-lexicon');
    if (lexBtn && stats.lexiconLoaded) {
      lexBtn.disabled = true;
      lexBtn.textContent = `✓ โหลดพจนานุกรมแล้ว (${stats.lexiconCount.toLocaleString()} คำ)`;
    }
  }
}
