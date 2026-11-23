// Month-1 Starter Pack entry point (registered via window.NihaoCore)
import './style.css';
import { initQuickDictionary } from './quick-dict.js';
import { applyBeginnerMode } from './guided-session.js';
import { renderMonth1Tab } from './views.js';
import { renderCopybookTab } from './copybook.js';

const core = window.NihaoCore;

if (core) {
  core.registerTab({
    id: 'month1',
    label: 'เดือนแรก 0→HSK1',
    title: '🌱 เดือนแรก 0 → HSK 1 (Starter Pack)',
    desc: 'รวมทุกอย่างที่มือใหม่เดือนแรกต้องใช้: ปุ่มเรียนประจำวัน 15 นาที, แผน 30 วัน, 20 คู่วรรณยุกต์, 64 ภาพจำอักษร, 50 ประโยคเอาตัวรอด และพจนานุกรมค้นด่วน (/)',
    emoji: '🌱',
    iconClass: 'icon-green',
    badge: '30 วัน',
    section: 'start',
    sectionTitle: '🌱 เดือนแรก (แนะนำ)',
    render(host) {
      renderMonth1Tab(core, host);
    }
  });

  core.registerTab({
    id: 'copybook',
    label: 'สมุดคัดลายมือ',
    title: '📝 สมุดคัดลายมือจีน (田字格 / 米字格)',
    desc: 'คัดอักษรจีนแบบตารางเหมือนสมุดจริง รองรับ Apple Pencil / นิ้ว / เมาส์ พิมพ์คำเองได้ และสั่งพิมพ์ลงกระดาษ A4 ได้',
    emoji: '📝',
    iconClass: 'icon-orange',
    badge: 'สมุด',
    section: 'start',
    sectionTitle: '🌱 เดือนแรก (แนะนำ)',
    render(host) {
      renderCopybookTab(core, host);
    }
  });

  initQuickDictionary(core);
  // Apply beginner mode & auto-land new users on Month-1 tab
  core.on('features-ready', () => {
    const ext = core.getExt('month1');
    const p = core.state.progress || {};
    const hasActivity = Object.keys(p.dayScores || {}).length > 0 || Object.keys(p.activity || {}).length > 0;
    if (!ext.welcomed) {
      core.setExt('month1', { welcomed: true, beginnerMode: !hasActivity }, { save: false });
      if (!hasActivity) core.switchTab('month1');
    }
    applyBeginnerMode(core);
  });
  setTimeout(() => applyBeginnerMode(core), 200);
}
