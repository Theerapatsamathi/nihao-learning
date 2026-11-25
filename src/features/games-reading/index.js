// games-reading feature group entry
import './style.css';
import { renderGamesSection } from './games.js';
import { renderStoriesSection } from './stories.js';
import { renderScenesSection } from './scenes.js';
import { renderPodcastSection } from './podcast.js';
import { renderCultureSection, renderCultureWidget } from './culture.js';
import { renderSmartImporterSection } from './smart-importer.js';
import { renderSnapCameraSection } from './snap-camera.js';
import { closeWordPopover } from './word-popover.js';
import { getGrExt, esc } from './utils.js';
import { GRADED_STORIES } from './data-stories.js';
import { IMMERSIVE_SCENES } from './data-scenes.js';
import { PODCAST_EPISODES } from './data-podcast.js';
import { CULTURE_CARDS } from './data-culture.js';

const core = window.NihaoCore;

const SUBTABS = [
  { id: 'home', emoji: '🏠', label: 'หน้าหลัก' },
  { id: 'importer', emoji: '🎵', label: 'แกะเพลง/ซับจีน' },
  { id: 'snap', emoji: '📸', label: 'ถ่ายรูปแปลเมนู' },
  { id: 'games', emoji: '🎮', label: 'มินิเกม (4)' },
  { id: 'stories', emoji: '📖', label: 'นิทาน & คาราโอเกะ' },
  { id: 'scenes', emoji: '🎬', label: 'ฉากจำลอง' },
  { id: 'podcast', emoji: '🎧', label: 'พอดแคสต์' },
  { id: 'culture', emoji: '🏮', label: 'วัฒนธรรมจีน' }
];

let currentSubtab = 'home';
let activeCleanup = null;

function runCleanup() {
  if (activeCleanup) {
    try { activeCleanup(); } catch {}
    activeCleanup = null;
  }
  closeWordPopover();
}

function renderHome(host, switchSub) {
  const ext = getGrExt(core);
  const storiesDoneCount = Object.keys(ext.storiesDone).length;
  const scenesDoneCount = Object.keys(ext.scenesDone).length;
  const podsDoneCount = Object.keys(ext.podcastsDone).length;

  host.innerHTML = '';
  const widget = renderCultureWidget(core, () => switchSub('culture'));
  host.appendChild(widget);

  const grid = document.createElement('div');
  grid.className = 'gr-grid-2';
  const cards = [
    {
      id: 'importer',
      emoji: '🎵',
      badge: 'NEW · C-Pop',
      title: 'แกะเพลงจีน / ซับซีรีส์ / บทความเอง',
      sub: 'วางเนื้อเพลงหรือข้อความจีนอะไรก็ได้ → ตัดคำใส่พินอิน แตะแปล เก็บเข้า SRS และสร้างห้องดวล 1v1 ทันที'
    },
    {
      id: 'snap',
      emoji: '📸',
      badge: 'NEW · Vision AI',
      title: 'ถ่ายรูปเมนูอาหาร & ป้ายร้านจีน (Snap & Learn)',
      sub: 'เปิดกล้องถ่ายเมนูหรือป้ายภาษาจีน ให้ครู AI ดึงคำศัพท์ พินอิน และประโยคสั่งอาหารที่ใช้พูดจริง'
    },
    {
      id: 'games',
      emoji: '🎮',
      badge: '4 เกมใหม่',
      title: 'มินิเกมฝึกศัพท์และวรรณยุกต์',
      sub: 'Word Sprint, Tone Bubble, Radical Builder และ Measure-word Match พร้อมเก็บสถิติและ XP'
    },
    {
      id: 'stories',
      emoji: '📖',
      badge: `${storiesDoneCount}/${GRADED_STORIES.length} เรื่อง`,
      title: 'นิทานแบ่งระดับ & คาราโอเกะ',
      sub: 'นิทาน HSK1–HSK2 แตะแปลทุกคำ เล่นคาราโอเกะปรับความเร็ว 0.5x–1.2x และอัดเสียงอ่านตาม'
    },
    {
      id: 'scenes',
      emoji: '🎬',
      badge: `${scenesDoneCount}/${IMMERSIVE_SCENES.length} ฉาก`,
      title: 'ฉากจำลองโต้ตอบ (Mini-Drama)',
      sub: 'คาเฟ่ รถไฟใต้ดิน ออฟฟิศ วันเกิด ตลาดนัด คลินิก พร้อมโหมดตาคุณพูดด้วยไมโครโฟน'
    },
    {
      id: 'podcast',
      emoji: '🎧',
      badge: `${podsDoneCount}/${PODCAST_EPISODES.length} ตอน`,
      title: 'พอดแคสต์พร้อมสคริปต์โต้ตอบ',
      sub: 'บทเรียนเสียงไทย-จีน แตะคำจีนแปลได้ทันที พร้อมควิซทบทวนท้ายตอน'
    },
    {
      id: 'culture',
      emoji: '🏮',
      badge: `${ext.cultureSeen.length}/${CULTURE_CARDS.length} ใบ`,
      title: 'การ์ดวัฒนธรรมจีนประจำวัน',
      sub: 'เทศกาล มารยาท ภาษามือ ตัวเลขมงคล และสแลงเน็ตจีน (yyds, 绝绝子, 躺平, 内卷)'
    }
  ];

  grid.innerHTML = cards
    .map(
      (c) => `
    <button type="button" class="gr-card gr-card-click" data-go="${c.id}">
      <div class="gr-card-head">
        <span class="gr-emoji">${c.emoji}</span>
        <span class="gr-badge">${esc(core, c.badge)}</span>
      </div>
      <h3 class="gr-title">${esc(core, c.title)}</h3>
      <p class="gr-sub">${esc(core, c.sub)}</p>
    </button>
  `
    )
    .join('');

  grid.querySelectorAll('[data-go]').forEach((btn) => {
    btn.addEventListener('click', () => switchSub(btn.dataset.go));
  });
  host.appendChild(grid);
}

if (core?.registerTab) {
  core.on?.('tab', ({ tabId }) => {
    if (tabId !== 'games-reading') runCleanup();
  });

  core.registerTab({
    id: 'games-reading',
    label: 'อ่าน & แกะเพลงจีน',
    title: 'อ่านจีน · แกะเพลง · ถ่ายเมนู & มินิเกม',
    desc: 'วางเนื้อเพลง/ซับซีรีส์แตะแปลคำ ถ่ายรูปเมนูจีน นิทานคาราโอเกะ ฉากจำลอง และมินิเกม',
    emoji: '🎮',
    section: 'vocab-read',
    sectionTitle: '📚 คลังศัพท์ & อ่านจีนจริง',
    render(host) {
      if (window.__nihaoOpenReadingSub) {
        currentSubtab = window.__nihaoOpenReadingSub;
        window.__nihaoOpenReadingSub = null;
      }
      runCleanup();
      host.innerHTML = `
        <div class="gr-root">
          <nav class="gr-subnav" aria-label="หมวดหมู่เกมและการอ่าน">
            ${SUBTABS.map(
              (st) =>
                `<button type="button" class="gr-subnav-btn ${currentSubtab === st.id ? 'is-active' : ''}" data-sub="${st.id}">${st.emoji} ${esc(core, st.label)}</button>`
            ).join('')}
          </nav>
          <div id="gr-body"></div>
        </div>
      `;

      const bodyEl = host.querySelector('#gr-body');

      function switchSub(subId) {
        runCleanup();
        currentSubtab = subId;
        host.querySelectorAll('.gr-subnav-btn').forEach((btn) => {
          btn.classList.toggle('is-active', btn.dataset.sub === subId);
        });
        bodyEl.innerHTML = '';
        if (subId === 'home') renderHome(bodyEl, switchSub);
        else if (subId === 'importer') activeCleanup = renderSmartImporterSection(core, bodyEl);
        else if (subId === 'snap') activeCleanup = renderSnapCameraSection(core, bodyEl);
        else if (subId === 'games') activeCleanup = renderGamesSection(core, bodyEl);
        else if (subId === 'stories') activeCleanup = renderStoriesSection(core, bodyEl);
        else if (subId === 'scenes') activeCleanup = renderScenesSection(core, bodyEl);
        else if (subId === 'podcast') activeCleanup = renderPodcastSection(core, bodyEl);
        else if (subId === 'culture') activeCleanup = renderCultureSection(core, bodyEl);
      }

      host.querySelectorAll('.gr-subnav-btn').forEach((btn) => {
        btn.addEventListener('click', () => switchSub(btn.dataset.sub));
      });

      switchSub(currentSubtab);
    }
  });
}

export {};
