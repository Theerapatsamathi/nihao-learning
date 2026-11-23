// Speak Studio feature group entry
import './style.css';
import { getDueReviewItems } from './scoring.js';
import { createRoleplayController } from './roleplay.js';
import { createFreeTalkController, createAskTeacherController } from './freetalk-teacher.js';
import {
  createShadowingController,
  createToneGraphController,
  createSmartReviewController
} from './shadowing-tone.js';

const core = window.NihaoCore;

if (core && typeof core.registerTab === 'function') {
  const roleplayCtrl = createRoleplayController(core);
  const freeTalkCtrl = createFreeTalkController(core);
  const askTeacherCtrl = createAskTeacherController(core);
  const shadowingCtrl = createShadowingController(core);
  const toneGraphCtrl = createToneGraphController(core);
  const smartReviewCtrl = createSmartReviewController(core);

  let activeSub = 'roleplay';

  const SUB_TABS = [
    { id: 'roleplay', label: '🎭 Roleplay' },
    { id: 'freetalk', label: '🗣️ Free Talk' },
    { id: 'shadowing', label: '🔁 Shadowing' },
    { id: 'teacher', label: '🙋 ถามครู' },
    { id: 'tone', label: '📈 วรรณยุกต์' },
    { id: 'review', label: '🧠 ทบทวนพูด' }
  ];

  function getDueCount() {
    const ext = core.getExt('speak-studio') || {};
    const queue = Array.isArray(ext.reviewQueue) ? ext.reviewQueue : [];
    return getDueReviewItems(queue, core.todayKey(0)).length;
  }

  function renderSpeakStudio(host) {
    const dueCount = getDueCount();

    host.innerHTML = `
      <div class="ss-wrap">
        <nav class="ss-subnav" role="tablist" aria-label="เมนู Speak Studio">
          ${SUB_TABS.map((t) => `
            <button
              type="button"
              role="tab"
              aria-selected="${t.id === activeSub}"
              class="ss-subnav-btn ${t.id === activeSub ? 'active' : ''}"
              data-sub="${t.id}"
            >
              <span>${t.label}</span>
              ${t.id === 'review' && dueCount > 0 ? `<span class="ss-badge">${dueCount}</span>` : ''}
            </button>
          `).join('')}
        </nav>
        <div id="ss-stage"></div>
      </div>
    `;

    const stage = host.querySelector('#ss-stage');
    const renderActive = () => {
      if (activeSub !== 'tone') toneGraphCtrl.stop?.();
      if (activeSub === 'roleplay') roleplayCtrl.render(stage);
      else if (activeSub === 'freetalk') freeTalkCtrl.render(stage);
      else if (activeSub === 'shadowing') shadowingCtrl.render(stage);
      else if (activeSub === 'teacher') askTeacherCtrl.render(stage);
      else if (activeSub === 'tone') toneGraphCtrl.render(stage);
      else if (activeSub === 'review') smartReviewCtrl.render(stage);
    };

    host.querySelectorAll('.ss-subnav-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeSub = btn.dataset.sub;
        renderSpeakStudio(host);
      });
    });

    renderActive();
  }

  core.registerTab({
    id: 'speak-studio',
    label: 'Speak Studio 🎙️',
    title: 'Speak Studio 🎙️',
    desc: 'ฝึกพูดภาษาจีนแบบลงมือจริง: Roleplay 10 สถานการณ์, Free Talk, Shadowing, ถามครู, กราฟวรรณยุกต์ และทบทวนพูด',
    emoji: '🎙️',
    section: 'speak',
    sectionTitle: '🎙️ Speaking First',
    render: renderSpeakStudio
  });
}
