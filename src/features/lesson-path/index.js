// Feature group: lesson-path (Learning Path+)
// Implements #8 Skill Tree, #9 Mixed Lesson Engine, #13 Dictation,
// #15 Grammar Cards (21), #31 Adaptive Placement Test, #32 Goal Onboarding.

import './style.css';
import { UNITS, GOALS } from './curriculum-data.js';
import { isUnitUnlocked, getNextRecommendation, GOAL_UNIT_PRIORITY } from './logic.js';
import { runLessonView } from './lesson-engine.js';
import { renderDictationView } from './dictation.js';
import { renderGrammarView } from './grammar-view.js';
import { renderPlacementView, openGoalModal } from './placement.js';

const core = window.NihaoCore;

if (core) {
  let activeSubTab = 'tree'; // tree | dictation | grammar | placement
  let activeRunner = null;   // { unit, lesson } or null
  let onboardingPrompted = false;

  const getProgress = () => core.getExt('lesson-path') || {};

  const renderTree = (container, rerenderAll) => {
    const progress = getProgress();
    const profile = progress.profile || null;
    const goalId = profile?.goal || 'hsk';
    const goalMeta = GOALS.find(g => g.id === goalId) || GOALS[2];
    const lessonStars = progress.lessonStars || {};
    const checkpoints = progress.checkpoints || {};
    const rec = getNextRecommendation(UNITS, progress, goalId);
    const recUnit = UNITS.find(u => u.id === rec.unitId) || UNITS[0];
    const recLesson = rec.lessonId ? recUnit.lessons.find(l => l.id === rec.lessonId) : null;

    // Top 3 goal-priority units (besides unit 1) get a "แนะนำตามเป้าหมาย" badge
    const topGoalUnits = new Set((GOAL_UNIT_PRIORITY[goalId] || []).slice(0, 3));

    const totalLessons = UNITS.reduce((s, u) => s + u.lessons.length, 0);
    const completedLessons = Object.values(lessonStars).filter(v => v >= 1).length;
    const totalStars = Object.values(lessonStars).reduce((s, v) => s + Number(v || 0), 0);

    container.innerHTML = `
      <div class="lp-tree-summary card-panel">
        <div class="lp-summary-left">
          <div class="lp-summary-eyebrow">${goalMeta.emoji} เป้าหมาย: ${core.escapeHtml(goalMeta.label)} · ${profile?.dailyMinutes || 10} นาที/วัน</div>
          <h3 class="lp-summary-title">บทเรียนแนะนำถัดไป: ${core.escapeHtml(recLesson ? recLesson.title : `Checkpoint บทที่ ${recUnit.num}`)}</h3>
          <div class="lp-summary-sub">บทที่ ${recUnit.num}: ${core.escapeHtml(recUnit.title)} · ผ่านแล้ว ${completedLessons}/${totalLessons} บทเรียน · ★ ${totalStars}</div>
        </div>
        <div class="lp-summary-actions">
          <button type="button" class="btn-primary" data-start-rec>▶ เริ่มเรียนเลย</button>
          <button type="button" class="btn-secondary" data-edit-goal>🎯 เป้าหมาย</button>
        </div>
      </div>

      <div class="lp-units-wrap">
        ${UNITS.map((unit, uIdx) => {
          const unlocked = isUnitUnlocked(uIdx, UNITS, progress);
          const cpPassed = Boolean(checkpoints[unit.id]?.passed);
          const allLessons3Stars = unit.lessons.every(l => (lessonStars[l.id] || 0) >= 3);
          const crowned = cpPassed && allLessons3Stars;
          const isGoalFav = topGoalUnits.has(unit.id);

          // Winding horizontal offsets for Duolingo/HelloChinese-style S-curve path
          const offsets = [0, 36, 52, 24, -20];

          return `
            <section class="lp-unit ${unlocked ? 'is-unlocked' : 'is-locked'} ${crowned ? 'is-crowned' : ''}" data-unit="${unit.id}">
              <header class="lp-unit-banner" style="--lp-unit-color:${unit.color}">
                <div class="lp-unit-banner-main">
                  <span class="lp-unit-emoji">${unit.emoji}</span>
                  <div>
                    <div class="lp-unit-tags">
                      <span class="lp-unit-badge">บทที่ ${unit.num} · ${core.escapeHtml(unit.level)}</span>
                      ${isGoalFav ? `<span class="lp-unit-badge lp-badge-goal">⭐ แนะนำสำหรับคุณ</span>` : ''}
                      ${crowned ? `<span class="lp-unit-badge lp-badge-crown">👑 Crowned</span>` : ''}
                    </div>
                    <h4 class="lp-unit-title">${core.escapeHtml(unit.title)}</h4>
                    <div class="lp-unit-sub">${core.escapeHtml(unit.subtitle)}</div>
                  </div>
                </div>
                ${!unlocked ? `
                  <button type="button" class="lp-skip-btn" data-cp="${unit.id}" title="ทำแบบทดสอบข้ามบท (ผ่าน 80%)">
                    🔓 สอบข้ามมาบทนี้
                  </button>
                ` : ''}
              </header>

              <div class="lp-path-nodes">
                ${unit.lessons.map((lesson, lIdx) => {
                  const stars = Number(lessonStars[lesson.id] || 0);
                  const prevDone = lIdx === 0 || (lessonStars[unit.lessons[lIdx - 1].id] || 0) >= 1;
                  const nodeUnlocked = unlocked && (prevDone || stars > 0 || cpPassed);
                  const isCurrent = nodeUnlocked && stars === 0;
                  const shift = offsets[lIdx % offsets.length];
                  const stateCls = stars >= 3 ? 'is-crowned' : stars >= 1 ? 'is-done' : isCurrent ? 'is-current' : 'is-locked';

                  return `
                    <div class="lp-node-row" style="--lp-shift:${shift}px">
                      <button type="button"
                        class="lp-node-btn ${stateCls}"
                        data-lesson-unit="${unit.id}"
                        data-lesson-id="${lesson.id}"
                        ${nodeUnlocked ? '' : 'disabled'}
                        aria-label="${core.escapeHtml(lesson.title)} (${stars} ดาว)">
                        <span class="lp-node-icon">${nodeUnlocked ? lesson.emoji : '🔒'}</span>
                      </button>
                      <div class="lp-node-meta">
                        <div class="lp-node-title">${core.escapeHtml(lesson.title)}</div>
                        <div class="lp-node-stars" aria-hidden="true">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</div>
                      </div>
                    </div>
                  `;
                }).join('')}

                <div class="lp-node-row" style="--lp-shift:${offsets[4]}px">
                  <button type="button"
                    class="lp-node-btn lp-node-checkpoint ${cpPassed ? 'is-crowned' : 'is-current'}"
                    data-cp="${unit.id}"
                    aria-label="Checkpoint บทที่ ${unit.num}">
                    <span class="lp-node-icon">${cpPassed ? '👑' : '🏆'}</span>
                  </button>
                  <div class="lp-node-meta">
                    <div class="lp-node-title">Checkpoint บทที่ ${unit.num}</div>
                    <div class="lp-node-sub">${cpPassed ? `ผ่านแล้ว (${checkpoints[unit.id].pct}%)` : 'สอบผ่าน ≥80% เพื่อปลดล็อกบทถัดไป'}</div>
                  </div>
                </div>
              </div>
            </section>
          `;
        }).join('')}
      </div>
    `;

    container.querySelector('[data-start-rec]')?.addEventListener('click', () => {
      activeRunner = { unit: recUnit, lesson: recLesson };
      rerenderAll();
    });

    container.querySelector('[data-edit-goal]')?.addEventListener('click', () => {
      openGoalModal({ core, onSaved: () => rerenderAll() });
    });

    container.querySelectorAll('[data-lesson-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const u = UNITS.find(x => x.id === btn.dataset.lessonUnit);
        const l = u?.lessons.find(x => x.id === btn.dataset.lessonId);
        if (u && l) {
          activeRunner = { unit: u, lesson: l };
          rerenderAll();
        }
      });
    });

    container.querySelectorAll('[data-cp]').forEach(btn => {
      btn.addEventListener('click', () => {
        const u = UNITS.find(x => x.id === btn.dataset.cp);
        if (u) {
          activeRunner = { unit: u, lesson: null };
          rerenderAll();
        }
      });
    });
  };

  const renderTab = (host) => {
    const ext = getProgress();
    if (!onboardingPrompted && !ext.profile?.goal) {
      onboardingPrompted = true;
      setTimeout(() => openGoalModal({ core, onSaved: () => renderTab(host) }), 120);
    }

    if (activeRunner) {
      host.innerHTML = `<div class="lp-wrap" id="lp-runner-host"></div>`;
      const runnerHost = host.querySelector('#lp-runner-host');
      runLessonView(runnerHost, {
        core,
        unit: activeRunner.unit,
        lesson: activeRunner.lesson,
        allUnits: UNITS,
        onComplete: ({ passed, stars, pct, isCheckpoint }) => {
          const cur = getProgress();
          const unitIdx = UNITS.findIndex(u => u.id === activeRunner.unit.id);
          if (isCheckpoint) {
            const checkpoints = { ...(cur.checkpoints || {}) };
            const prev = checkpoints[activeRunner.unit.id] || {};
            checkpoints[activeRunner.unit.id] = {
              passed: Boolean(prev.passed || passed),
              pct: Math.max(Number(prev.pct || 0), pct)
            };
            const unlockedUpTo = passed
              ? Math.max(Number(cur.unlockedUpTo || 0), Math.min(UNITS.length - 1, unitIdx + 1))
              : Number(cur.unlockedUpTo || 0);
            core.setExt('lesson-path', { checkpoints, unlockedUpTo }, { reason: `lp-cp-${activeRunner.unit.id}` });
          } else {
            const lessonStars = { ...(cur.lessonStars || {}) };
            const lid = activeRunner.lesson.id;
            lessonStars[lid] = Math.max(Number(lessonStars[lid] || 0), stars);
            core.setExt('lesson-path', { lessonStars }, { reason: `lp-ls-${lid}` });
          }
        },
        onExit: () => {
          activeRunner = null;
          renderTab(host);
        }
      });
      return;
    }

    host.innerHTML = `
      <div class="lp-wrap">
        <nav class="lp-subnav" role="tablist" aria-label="หมวดหมู่เส้นทางบทเรียน">
          <button type="button" class="lp-subtab ${activeSubTab === 'tree' ? 'is-active' : ''}" data-sub="tree">🗺️ เส้นทางบทเรียน</button>
          <button type="button" class="lp-subtab ${activeSubTab === 'dictation' ? 'is-active' : ''}" data-sub="dictation">✍️ ฝึกฟังเขียน</button>
          <button type="button" class="lp-subtab ${activeSubTab === 'grammar' ? 'is-active' : ''}" data-sub="grammar">📖 การ์ดไวยากรณ์</button>
          <button type="button" class="lp-subtab ${activeSubTab === 'placement' ? 'is-active' : ''}" data-sub="placement">🎯 วัดระดับ</button>
        </nav>
        <div id="lp-sub-host"></div>
      </div>
    `;

    host.querySelectorAll('[data-sub]').forEach(btn => {
      btn.addEventListener('click', () => {
        activeSubTab = btn.dataset.sub;
        renderTab(host);
      });
    });

    const subHost = host.querySelector('#lp-sub-host');
    if (activeSubTab === 'tree') {
      renderTree(subHost, () => renderTab(host));
    } else if (activeSubTab === 'dictation') {
      renderDictationView(subHost, { core });
    } else if (activeSubTab === 'grammar') {
      renderGrammarView(subHost, { core });
    } else if (activeSubTab === 'placement') {
      renderPlacementView(subHost, {
        core,
        onApplied: () => {
          activeSubTab = 'tree';
          renderTab(host);
        }
      });
    }
  };

  core.registerTab({
    id: 'lesson-path',
    label: 'เส้นทางบทเรียน',
    title: 'เส้นทางบทเรียน (Learning Path+)',
    desc: 'แผนที่บทเรียน HSK 1–2 แบบขั้นบันได พร้อมฝึกฟังเขียน การ์ดไวยากรณ์ 21 หัวข้อ และวัดระดับอัตโนมัติ',
    emoji: '🗺️',
    section: 'path',
    sectionTitle: '🗺️ Learning Path+',
    render: renderTab
  });
}

export {};
