// Motivation feature group entry point
import './style.css';
import { initMotivationHud } from './hud.js';
import { renderMistakeBook, renderNotebook } from './view-mistakes-notebook.js';
import { renderLeagueView, renderFriendsView } from './view-league-friends.js';
import { renderGoalsStreakView } from './view-goals-streak.js';
import { renderInsightsView } from './view-insights-certs.js';

const core = window.NihaoCore;

const SUBTABS = [
  { id: 'goals', label: '🎯 เป้าหมาย & สตรีค' },
  { id: 'league', label: '🏆 ลีกสัปดาห์' },
  { id: 'friends', label: '🤝 เพื่อน & ภารกิจ' },
  { id: 'mistakes', label: '📕 สมุดคำผิด' },
  { id: 'notebook', label: '📒 สมุดโน้ต' },
  { id: 'insights', label: '📊 แผน & สรุปผล' }
];

let activeSubTab = 'goals';
let lastHost = null;

function openSubTab(id) {
  if (SUBTABS.some((t) => t.id === id)) {
    activeSubTab = id;
    if (lastHost) renderMotivationTab(lastHost);
  }
}

const hud = initMotivationHud(core, { openSubTab });

function renderMotivationTab(host) {
  lastHost = host;
  host.innerHTML = `
    <div class="mo-root">
      <nav class="mo-subnav" aria-label="หมวดย่อย ภารกิจ & ลีก">
        ${SUBTABS.map((t) => `
          <button type="button" class="mo-subtab ${activeSubTab === t.id ? 'active' : ''}" data-mo-tab="${t.id}">
            ${t.label}
          </button>
        `).join('')}
      </nav>
      <div class="mo-body" id="mo-sub-body"></div>
    </div>
  `;

  host.querySelectorAll('[data-mo-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeSubTab = btn.dataset.moTab;
      renderMotivationTab(host);
    });
  });

  const body = host.querySelector('#mo-sub-body');
  if (!body) return;

  if (activeSubTab === 'goals') {
    renderGoalsStreakView(body, core, { onHudRefresh: () => hud.refresh(), openSubTab });
  } else if (activeSubTab === 'league') {
    renderLeagueView(body, core);
  } else if (activeSubTab === 'friends') {
    renderFriendsView(body, core);
  } else if (activeSubTab === 'mistakes') {
    renderMistakeBook(body, core, { onHeartsChanged: () => hud.refresh() });
  } else if (activeSubTab === 'notebook') {
    renderNotebook(body, core);
  } else if (activeSubTab === 'insights') {
    renderInsightsView(body, core);
  }
}

core.registerTab({
  id: 'motivation',
  label: 'ภารกิจ & ลีก',
  title: 'ภารกิจ & ลีก (Motivation)',
  desc: 'เป้าหมายรายวัน ซ่อมสตรีค ลีกประจำสัปดาห์ เพื่อน สมุดคำผิด สมุดโน้ต แผนการเรียน และใบประกาศฯ',
  emoji: '🔥',
  section: 'motivate',
  sectionTitle: '🔥 Motivation',
  render: renderMotivationTab
});

export {};
