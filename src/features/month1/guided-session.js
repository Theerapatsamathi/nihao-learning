// Guided Daily Session (15-min 4-step runner) & Beginner Mode Sidebar Filter
import { buildGuidedSession, getTodayBlueprintDay } from './logic.js';

const BEGINNER_TABS = new Set([
  'month1', 'copybook', 'arena', 'plan', 'initials', 'finals', 'tones', 'writing', 'vocab', 'speak-studio', 'settings-plus'
]);

export function applyBeginnerMode(core) {
  const ext = core.getExt('month1');
  const enabled = Boolean(ext.beginnerMode);
  document.documentElement.classList.toggle('m1-beginner-mode', enabled);
  document.querySelectorAll('.nav-panel .nav-link').forEach(btn => {
    const id = btn.dataset.tab;
    if (!id) return;
    btn.classList.toggle('m1-nav-hidden', enabled && !BEGINNER_TABS.has(id));
  });
}

export function toggleBeginnerMode(core, nextVal) {
  core.setExt('month1', { beginnerMode: Boolean(nextVal) }, { save: true });
  applyBeginnerMode(core);
  core.showToast(nextVal ? 'เปิดโหมดเดือนแรก (ซ่อนเมนูขั้นสูงแล้ว)' : 'แสดงเมนูทั้งหมดแล้ว');
}

export function renderGuidedRunner(core, host, onDone) {
  const day = getTodayBlueprintDay(core.state.progress, core.getExt('month1'));
  const session = buildGuidedSession(day, core.state.progress.mistakes || []);
  let step = 0; // 0: warmup, 1: tone pairs, 2: speak 5, 3: finish
  const checkedWarmup = new Set();
  const checkedTones = new Set();
  const checkedSpeak = new Set();

  const draw = () => {
    const pct = Math.round(((step) / 3) * 100);
    if (step === 0) {
      host.innerHTML = `
        <div class="card-panel m1-runner">
          <div class="m1-runner-head">
            <div>
              <span class="m1-tag">Day ${session.day} · ขั้นที่ 1/3 (3 นาที)</span>
              <h2 style="margin:6px 0 2px">🔥 วอร์มอัพทบทวน 3 คำ</h2>
              <p class="m1-muted" style="margin:0">กดฟังเสียงแล้วออกเสียงตามให้ครบ 3 คำ</p>
            </div>
            <button type="button" class="btn-secondary" id="m1-run-exit">ออก</button>
          </div>
          <div class="m1-prog"><div class="m1-prog-fill" style="width:${Math.max(10, pct)}%"></div></div>
          <div class="m1-list">
            ${session.warmup.map((w, i) => `
              <div class="m1-item ${checkedWarmup.has(i) ? 'done' : ''}">
                <div>
                  <div class="m1-hz hanzi-font">${core.escapeHtml(w.hz)} <span class="m1-py">${core.escapeHtml(w.py)}</span></div>
                  <div class="m1-muted">${core.escapeHtml(w.th)}</div>
                </div>
                <div class="m1-row-btns">
                  <button type="button" class="btn-secondary" data-play="${i}">🔊 ฟัง</button>
                  <button type="button" class="btn-primary" data-ok="${i}">${checkedWarmup.has(i) ? '✓ แล้ว' : 'จำได้แล้ว'}</button>
                </div>
              </div>`).join('')}
          </div>
          <div class="m1-runner-foot">
            <button type="button" class="btn-primary" id="m1-next-step">ไปขั้นที่ 2: ฝึกคู่วรรณยุกต์ →</button>
          </div>
        </div>`;
      host.querySelectorAll('[data-play]').forEach(b => b.addEventListener('click', () => core.speak(session.warmup[Number(b.dataset.play)].hz)));
      host.querySelectorAll('[data-ok]').forEach(b => b.addEventListener('click', () => {
        checkedWarmup.add(Number(b.dataset.ok));
        core.playChime('ok');
        draw();
      }));
    } else if (step === 1) {
      host.innerHTML = `
        <div class="card-panel m1-runner">
          <div class="m1-runner-head">
            <div>
              <span class="m1-tag">Day ${session.day} · ขั้นที่ 2/3 (6 นาที)</span>
              <h2 style="margin:6px 0 2px">🎵 ฝึก 4 คู่วรรณยุกต์ประจำวัน</h2>
              <p class="m1-muted" style="margin:0">${core.escapeHtml(session.meta.title)} — ${core.escapeHtml(session.meta.focus)}</p>
            </div>
            <button type="button" class="btn-secondary" id="m1-run-exit">ออก</button>
          </div>
          <div class="m1-prog"><div class="m1-prog-fill" style="width:45%"></div></div>
          <div class="m1-list">
            ${session.toneFocus.map((t, i) => `
              <div class="m1-item ${checkedTones.has(i) ? 'done' : ''}">
                <div>
                  <span class="m1-tag">${core.escapeHtml(t.label)}</span>
                  <div class="m1-hz hanzi-font" style="margin-top:4px">${core.escapeHtml(t.hz)} <span class="m1-py">${core.escapeHtml(t.py)}</span></div>
                  <div class="m1-muted">${core.escapeHtml(t.th)} · 💡 ${core.escapeHtml(t.tip)}</div>
                </div>
                <div class="m1-row-btns">
                  <button type="button" class="btn-secondary" data-play="${i}">🔊 ฟัง</button>
                  <button type="button" class="btn-primary" data-ok="${i}">${checkedTones.has(i) ? '✓ ผ่าน' : 'พูดตามแล้ว'}</button>
                </div>
              </div>`).join('')}
          </div>
          <div class="m1-runner-foot">
            <button type="button" class="btn-primary" id="m1-next-step">ไปขั้นที่ 3: ฝึกพูด 5 ประโยค →</button>
          </div>
        </div>`;
      host.querySelectorAll('[data-play]').forEach(b => b.addEventListener('click', () => core.speak(session.toneFocus[Number(b.dataset.play)].hz)));
      host.querySelectorAll('[data-ok]').forEach(b => b.addEventListener('click', () => {
        checkedTones.add(Number(b.dataset.ok));
        core.playChime('ok');
        draw();
      }));
    } else if (step === 2) {
      host.innerHTML = `
        <div class="card-panel m1-runner">
          <div class="m1-runner-head">
            <div>
              <span class="m1-tag">Day ${session.day} · ขั้นที่ 3/3 (6 นาที)</span>
              <h2 style="margin:6px 0 2px">🗣️ พูดตาม 5 ประโยคเอาตัวรอด</h2>
              <p class="m1-muted" style="margin:0">กดฟังช้าๆ แล้วออกเสียงตามให้คล่องปาก</p>
            </div>
            <button type="button" class="btn-secondary" id="m1-run-exit">ออก</button>
          </div>
          <div class="m1-prog"><div class="m1-prog-fill" style="width:80%"></div></div>
          <div class="m1-list">
            ${session.speakItems.map((s, i) => `
              <div class="m1-item ${checkedSpeak.has(i) ? 'done' : ''}">
                <div>
                  <div class="m1-hz hanzi-font">${core.escapeHtml(s.hz)}</div>
                  <div class="m1-py">${core.escapeHtml(s.py)}</div>
                  <div class="m1-muted">${core.escapeHtml(s.th)}</div>
                </div>
                <div class="m1-row-btns">
                  <button type="button" class="btn-secondary" data-slow="${i}">🐢 0.6x</button>
                  <button type="button" class="btn-secondary" data-play="${i}">🔊 ปกติ</button>
                  <button type="button" class="btn-primary" data-ok="${i}">${checkedSpeak.has(i) ? '✓ คล่อง' : 'พูดแล้ว'}</button>
                </div>
              </div>`).join('')}
          </div>
          <div class="m1-runner-foot">
            <button type="button" class="btn-primary" id="m1-next-step">🎉 จบบทเรียนวันนี้ (+40 XP)</button>
          </div>
        </div>`;
      host.querySelectorAll('[data-play]').forEach(b => b.addEventListener('click', () => core.speak(session.speakItems[Number(b.dataset.play)].hz)));
      host.querySelectorAll('[data-slow]').forEach(b => b.addEventListener('click', () => {
        const prev = core.state.rate;
        core.state.rate = 0.6;
        core.speak(session.speakItems[Number(b.dataset.slow)].hz, () => { core.state.rate = prev; });
      }));
      host.querySelectorAll('[data-ok]').forEach(b => b.addEventListener('click', () => {
        checkedSpeak.add(Number(b.dataset.ok));
        core.playChime('ok');
        draw();
      }));
    } else {
      // Completed!
      core.setExt('month1', (cur) => {
        const done = new Set(Array.isArray(cur.doneDays) ? cur.doneDays : []);
        if (session.day >= 15) done.add(session.day);
        cur.doneDays = [...done];
        cur.lastGuidedDate = core.todayKey();
        return cur;
      }, { save: false });
      core.addXp(40, `เรียนรอบประจำวัน Day ${session.day} ครบแล้ว!`);
      core.spawnConfetti(28);
      core.pandaSay('太棒了! เก่งมาก เรียนครบวันนี้แล้ว!');
      host.innerHTML = `
        <div class="card-panel m1-runner" style="text-align:center;padding:32px 20px">
          <div style="font-size:48px">🎉</div>
          <h2 style="margin:8px 0">เยี่ยมมาก! จบชุดเรียน Day ${session.day} แล้ว</h2>
          <p class="m1-muted">ได้รับ +40 XP · บันทึกความคืบหน้าและรักษา Streak เรียบร้อย</p>
          <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:18px">
            <button type="button" class="btn-primary" id="m1-done-back">กลับหน้าเดือนแรก</button>
            <button type="button" class="btn-secondary" id="m1-go-roleplay">🎙️ ไปลองคุย AI Roleplay</button>
          </div>
        </div>`;
      host.querySelector('#m1-done-back')?.addEventListener('click', onDone);
      host.querySelector('#m1-go-roleplay')?.addEventListener('click', () => core.switchTab('speak-studio'));
      return;
    }

    host.querySelector('#m1-run-exit')?.addEventListener('click', onDone);
    host.querySelector('#m1-next-step')?.addEventListener('click', () => { step++; draw(); });
  };

  draw();
}
