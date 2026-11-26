// Month-1 Starter Pack + Unified Today Dashboard + Copybook entry point
import './style.css';
import { initQuickDictionary } from './quick-dict.js';
import { applyBeginnerMode, renderGuidedRunner, renderExamOnlyRunner } from './guided-session.js';
import { renderMonth1Tab } from './views.js';
import { renderCopybookTab } from './copybook.js';
import { renderTodayDashboard } from './today-dashboard.js';

const core = window.NihaoCore;

if (core) {
  window.__nihaoRenderGuidedDay = (host, dayNum, onDone) => renderGuidedRunner(core, host, onDone, { targetDay: dayNum });
  window.__nihaoRenderMasteryExam = (host, dayNum, onDone) => renderExamOnlyRunner(core, host, dayNum, onDone);
  core.registerTab({
    id: 'today',
    label: 'หน้าแรกวันนี้',
    title: '🏠 หน้าแรกวันนี้ (Unified Today Hub)',
    desc: 'รวมทุกอย่างที่ต้องทำวันนี้ไว้ในหน้าเดียว: เริ่มเรียน 15 นาที, การ์ด FSRS & โหมดก่อนนอน 3 นาที, ครู AI ตรวจลายมือ, แกะเพลงจีน และห้องดวล 1v1',
    emoji: '🏠',
    iconClass: 'icon-blue',
    badge: 'TODAY',
    section: 'home',
    sectionTitle: '🏠 หน้าแรกวันนี้',
    render(host) {
      renderTodayDashboard(core, host);
    }
  });

  core.registerTab({
    id: 'month1',
    label: 'เดือนแรก 0→HSK1',
    title: '🌱 เดือนแรก 0 → HSK 1 (Starter Pack)',
    desc: 'รวมทุกอย่างที่มือใหม่เดือนแรกต้องใช้: แผน 30 วัน, 20 คู่วรรณยุกต์, 64 ภาพจำอักษร, 50 ประโยคเอาตัวรอด และพจนานุกรมค้นด่วน (/)',
    emoji: '🌱',
    iconClass: 'icon-green',
    badge: '30 วัน',
    section: 'home',
    sectionTitle: '🏠 หน้าแรกวันนี้',
    render(host) {
      renderMonth1Tab(core, host);
    }
  });

  core.registerTab({
    id: 'copybook',
    label: 'สมุดคัด & AI ตรวจ',
    title: '📝 สมุดคัดลายมือจีน + ครู AI ตรวจสัดส่วน (田字格 / 米字格)',
    desc: 'คัดอักษรจีนแบบตารางเหมือนสมุดจริง รองรับ Apple Pencil / นิ้ว / เมาส์ ส่งให้ Gemini Vision ตรวจเกรด S–C หรือสั่งพิมพ์ลงกระดาษ A4',
    emoji: '📝',
    iconClass: 'icon-orange',
    badge: 'AI',
    section: 'write-studio',
    sectionTitle: '✍️ สมุดคัด & ลำดับขีด',
    render(host) {
      renderCopybookTab(core, host);
    }
  });

  initQuickDictionary(core);

  // Land users on the clean Unified Today Hub by default (unless deep-linked to ?duel=CODE)
  const ensureMasteryInitialized = () => {
    const ext = core.getExt('month1') || {};
    const p = core.state.progress || {};
    const hasActivity = Object.keys(p.dayScores || {}).length > 0 || Object.keys(p.activity || {}).length > 0;
    const nextPatch = {};
    let changed = false;
    if (!ext.welcomed) {
      nextPatch.welcomed = true;
      nextPatch.beginnerMode = !hasActivity;
      changed = true;
    }
    if (!ext.dayMastery || typeof ext.dayMastery !== 'object') {
      const migrated = {};
      for (const [k, score] of Object.entries(p.dayScores || {})) {
        if (Number(score) >= 10) {
          migrated[k] = { bestPct: 100, lastPct: 100, attempts: 1, passed: true, updatedAt: Date.now() };
        }
      }
      nextPatch.dayMastery = migrated;
      changed = true;
    }
    if (changed) {
      core.setExt('month1', nextPatch, { save: false });
    }
  };

  core.on('features-ready', () => {
    ensureMasteryInitialized();
    const hasDuelParam = new URLSearchParams(window.location.search).has('duel');
    if (!hasDuelParam) {
      core.switchTab('today');
    }
    applyBeginnerMode(core);
  });
  core.on('cloud-synced', () => ensureMasteryInitialized());
  setTimeout(() => applyBeginnerMode(core), 200);
}
