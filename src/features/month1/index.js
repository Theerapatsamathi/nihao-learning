// Month-1 Starter Pack entry point (registered via window.NihaoCore)
import './style.css';
import { initQuickDictionary } from './quick-dict.js';
import { applyBeginnerMode } from './guided-session.js';
import { renderMonth1Tab } from './views.js';

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

  initQuickDictionary(core);
  // Apply beginner mode after all feature tabs finish registering
  core.on('features-ready', () => applyBeginnerMode(core));
  setTimeout(() => applyBeginnerMode(core), 200);
}
