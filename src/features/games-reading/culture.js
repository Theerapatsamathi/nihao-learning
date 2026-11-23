// #22 Daily Culture Card: deterministic daily card + archive + compact home widget
import { CULTURE_CARDS } from './data-culture.js';
import { EXT_NS, getDailyIndex, getGrExt, esc } from './utils.js';

export function getTodayCultureCard(core) {
  const key = core?.todayKey ? core.todayKey(0) : new Date().toISOString().slice(0, 10);
  const idx = getDailyIndex(key, CULTURE_CARDS.length);
  return { card: CULTURE_CARDS[idx], dateKey: key, idx };
}

function markCardSeen(core, cardId, dateKey) {
  const ext = getGrExt(core);
  const alreadyXpToday = ext.cultureXpDate === dateKey;
  const seenSet = new Set(ext.cultureSeen);
  seenSet.add(cardId);
  core?.setExt?.(
    EXT_NS,
    (cur) => ({
      ...cur,
      cultureSeen: [...seenSet],
      cultureXpDate: dateKey
    }),
    { save: true, reason: 'gr-culture-seen' }
  );
  if (!alreadyXpToday) {
    core?.addXp?.(5, 'gr-culture-daily');
    core?.showToast?.('อ่านเกร็ดวัฒนธรรมวันนี้แล้ว! +5 XP', '+5 XP');
  } else {
    core?.showToast?.('บันทึกว่าอ่านแล้ว ✓');
  }
}

/**
 * Compact Daily Culture Card widget for the Games & Reading Home hub.
 */
export function renderCultureWidget(core, onOpenFull) {
  const { card, dateKey } = getTodayCultureCard(core);
  const ext = getGrExt(core);
  const seenToday = ext.cultureXpDate === dateKey;

  const wrap = document.createElement('div');
  wrap.className = 'gr-culture-hero';
  wrap.innerHTML = `
    <div class="gr-between">
      <div class="gr-row">
        <span class="gr-badge gr-badge-orange">🏮 การ์ดวัฒนธรรมประจำวัน</span>
        <span class="gr-badge">${esc(core, card.category)}</span>
      </div>
      ${seenToday ? '<span class="gr-badge gr-badge-green">✓ รับ +5 XP วันนี้แล้ว</span>' : '<span class="gr-badge">+5 XP</span>'}
    </div>
    <h3 class="gr-title" style="font-size:1.15rem">${card.emoji} ${esc(core, card.title)}</h3>
    <p class="gr-sub">${esc(core, card.summary)}</p>
    <div class="gr-culture-phrase">
      <div>
        <div class="gr-culture-zh">${esc(core, card.zh)}</div>
        <div class="gr-culture-py">${esc(core, card.py)} · ${esc(core, card.th)}</div>
      </div>
      <button type="button" class="btn-secondary" data-act="speak" style="margin-left:auto">🔊 ฟังเสียง</button>
    </div>
    <div class="gr-row">
      <button type="button" class="btn-primary" data-act="open">อ่านเพิ่มเติม & ดูคลังการ์ด (${CULTURE_CARDS.length} ใบ)</button>
      ${!seenToday ? '<button type="button" class="btn-secondary" data-act="seen">✓ อ่านแล้ว (+5 XP)</button>' : ''}
    </div>
  `;

  wrap.querySelector('[data-act="speak"]')?.addEventListener('click', () => core?.speak?.(card.zh));
  wrap.querySelector('[data-act="open"]')?.addEventListener('click', () => onOpenFull?.());
  wrap.querySelector('[data-act="seen"]')?.addEventListener('click', () => {
    markCardSeen(core, card.id, dateKey);
    const parent = wrap.parentElement;
    if (parent) {
      const next = renderCultureWidget(core, onOpenFull);
      parent.replaceChild(next, wrap);
    }
  });
  return wrap;
}

export function renderCultureSection(core, host) {
  const { card: todayCard, dateKey } = getTodayCultureCard(core);
  let selectedCard = todayCard;
  let expanded = false;

  function render() {
    const ext = getGrExt(core);
    const seenSet = new Set(ext.cultureSeen);
    const seenToday = ext.cultureXpDate === dateKey;
    const isToday = selectedCard.id === todayCard.id;

    host.innerHTML = `
      <div class="gr-culture-hero">
        <div class="gr-between">
          <div class="gr-row">
            <span class="gr-badge gr-badge-orange">${isToday ? '🌟 การ์ดประจำวันนี้' : '🏮 คลังวัฒนธรรมจีน'}</span>
            <span class="gr-badge">${esc(core, selectedCard.category)}</span>
          </div>
          <span class="gr-badge gr-badge-green">อ่านแล้ว ${seenSet.size}/${CULTURE_CARDS.length} ใบ</span>
        </div>

        <h3 class="gr-title" style="font-size:1.3rem">${selectedCard.emoji} ${esc(core, selectedCard.title)}</h3>
        <p class="gr-sub" style="font-size:0.95rem;color:var(--sys-label)">${esc(core, selectedCard.summary)}</p>

        <div class="gr-culture-phrase">
          <div>
            <div class="gr-culture-zh">${esc(core, selectedCard.zh)}</div>
            <div class="gr-culture-py">${esc(core, selectedCard.py)}</div>
            <div class="gr-sent-th">${esc(core, selectedCard.th)}</div>
          </div>
          <button type="button" class="btn-secondary" id="gr-cul-speak" style="margin-left:auto">🔊 ฟังเสียง</button>
        </div>

        ${expanded ? `<div class="gr-card" style="background:var(--sys-surface-2)"><p class="gr-sub" style="color:var(--sys-label)">${esc(core, selectedCard.detail)}</p></div>` : ''}

        <div class="gr-row">
          <button type="button" class="btn-secondary" id="gr-cul-more">${expanded ? 'ซ่อนรายละเอียด' : '📖 อ่านเพิ่มเติม'}</button>
          <button type="button" class="btn-primary" id="gr-cul-seen">
            ${seenSet.has(selectedCard.id) ? '✓ บันทึกว่าอ่านแล้ว' : seenToday ? '✓ ทำเครื่องหมายว่าอ่านแล้ว' : '✓ อ่านแล้ว (+5 XP วันนี้)'}
          </button>
        </div>
      </div>

      <h4 class="gr-title" style="margin-top:8px">คลังการ์ดวัฒนธรรมจีน (${CULTURE_CARDS.length} ใบ)</h4>
      <div class="gr-grid">
        ${CULTURE_CARDS.map((c) => {
          const isSeen = seenSet.has(c.id);
          const isCur = c.id === selectedCard.id;
          return `
            <button type="button" class="gr-card gr-card-click" data-cid="${c.id}" style="${isCur ? 'border-color:var(--sys-accent)' : ''}">
              <div class="gr-card-head">
                <span class="gr-emoji">${c.emoji}</span>
                <span class="gr-badge ${isSeen ? 'gr-badge-green' : ''}">${isSeen ? '✓ อ่านแล้ว' : esc(core, c.category)}</span>
              </div>
              <div class="gr-title" style="font-size:0.96rem">${esc(core, c.title)}</div>
              <div class="gr-sub" style="font-size:0.82rem">${esc(core, c.zh)}</div>
            </button>
          `;
        }).join('')}
      </div>
    `;

    host.querySelector('#gr-cul-speak')?.addEventListener('click', () => core?.speak?.(selectedCard.zh));
    host.querySelector('#gr-cul-more')?.addEventListener('click', () => {
      expanded = !expanded;
      render();
    });
    host.querySelector('#gr-cul-seen')?.addEventListener('click', () => {
      markCardSeen(core, selectedCard.id, dateKey);
      render();
    });
    host.querySelectorAll('[data-cid]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const found = CULTURE_CARDS.find((c) => c.id === btn.dataset.cid);
        if (found) {
          selectedCard = found;
          expanded = false;
          render();
          host.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  }

  render();
  return () => core?.stopSpeech?.();
}
