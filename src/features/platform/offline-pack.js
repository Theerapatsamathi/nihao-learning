// #38 Offline Audio Pack + SW Update Toast + #36 Storage & Performance helpers

import {
  DAILY_TTS_CAP,
  DATA_PACK_SIZES,
  buildAudioPackItems,
  formatBytes,
  getRemainingTtsQuota
} from './logic.js';

export const AUDIO_CACHE_NAME = 'nihao-audio-v1';

export function initOfflinePack(core) {
  let abortController = null;
  let updateToastShown = false;

  // Listen for Service Worker updates and show a non-intrusive reload toast
  function watchSwUpdates() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) return;
      const notifyUpdate = (worker) => {
        if (updateToastShown) return;
        updateToastShown = true;
        showUpdateBanner(worker);
      };
      if (reg.waiting) {
        notifyUpdate(reg.waiting);
      }
      reg.addEventListener('updatefound', () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            notifyUpdate(installing);
          }
        });
      });
    }).catch(() => {});

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // Reload once when user clicked update
      if (window.__pfReloading) {
        window.location.reload();
      }
    });
  }

  function showUpdateBanner(worker) {
    if (document.getElementById('pf-sw-update-toast')) return;
    const el = document.createElement('div');
    el.id = 'pf-sw-update-toast';
    el.className = 'pf-update-toast';
    el.setAttribute('role', 'status');
    el.innerHTML = `
      <span>✨ มีเวอร์ชันใหม่ของ <strong>你好 Nihao</strong> พร้อมใช้งาน</span>
      <button type="button" class="btn-primary pf-update-btn">อัปเดตเลย</button>
      <button type="button" class="pf-update-close" aria-label="ปิด">✕</button>
    `;
    el.querySelector('.pf-update-btn')?.addEventListener('click', () => {
      window.__pfReloading = true;
      if (worker) {
        worker.postMessage({ type: 'SKIP_WAITING' });
      } else {
        window.location.reload();
      }
    });
    el.querySelector('.pf-update-close')?.addEventListener('click', () => el.remove());
    document.body.appendChild(el);
  }

  function getAvailableDecks() {
    const allVocab = Array.isArray(core.allVocabWords) ? core.allVocabWords : [];
    const l2Words = Array.isArray(core.data?.L2?.HSK1_WORDS) ? core.data.L2.HSK1_WORDS : [];
    const hskSource = l2Words.length ? l2Words : allVocab;

    return [
      {
        id: 'today-l1',
        label: 'คำศัพท์พื้นฐาน Level 1 (34 คำ)',
        items: buildAudioPackItems(allVocab.slice(0, 34), 34)
      },
      {
        id: 'hsk1-part1',
        label: 'HSK 1 ชุดที่ 1 (50 คำแรก)',
        items: buildAudioPackItems(hskSource.slice(0, 50), 50)
      },
      {
        id: 'hsk1-part2',
        label: 'HSK 1 ชุดที่ 2 (คำที่ 51–100)',
        items: buildAudioPackItems(hskSource.slice(50, 100), 50)
      },
      {
        id: 'hsk1-part3',
        label: 'HSK 1 ชุดที่ 3 (คำที่ 101–150)',
        items: buildAudioPackItems(hskSource.slice(100, 150), 50)
      }
    ].filter((d) => d.items.length > 0);
  }

  function getTtsQuota() {
    const ext = core.getExt('platform') || {};
    return getRemainingTtsQuota(ext.ttsDownloadedToday, core.todayKey(), DAILY_TTS_CAP);
  }

  function incrementTtsUsage(delta) {
    if (delta <= 0) return;
    const today = core.todayKey();
    const cur = getTtsQuota();
    core.setExt('platform', {
      ttsDownloadedToday: { date: today, count: cur.used + delta }
    }, { save: true, reason: 'offline-audio-pack' });
  }

  async function getStorageStats() {
    let usage = 0;
    let quota = 0;
    let supported = false;
    if (navigator.storage && typeof navigator.storage.estimate === 'function') {
      try {
        const est = await navigator.storage.estimate();
        usage = est.usage || 0;
        quota = est.quota || 0;
        supported = true;
      } catch {
        // ignore
      }
    }
    let audioCount = 0;
    let cacheNames = [];
    if ('caches' in window) {
      try {
        cacheNames = await caches.keys();
        if (cacheNames.includes(AUDIO_CACHE_NAME)) {
          const cache = await caches.open(AUDIO_CACHE_NAME);
          const keys = await cache.keys();
          audioCount = keys.length;
        }
      } catch {
        // ignore
      }
    }
    const eagerBytes = DATA_PACK_SIZES.filter((d) => d.eager).reduce((s, d) => s + d.bytes, 0);
    const lazyBytes = DATA_PACK_SIZES.filter((d) => !d.eager).reduce((s, d) => s + d.bytes, 0);
    return {
      supported,
      usage,
      quota,
      usageText: formatBytes(usage),
      quotaText: formatBytes(quota),
      audioCount,
      cacheNames,
      eagerBytes,
      lazyBytes,
      lexiconLoaded: Array.isArray(core.lexicon) && core.lexicon.length > 0,
      lexiconCount: Array.isArray(core.lexicon) ? core.lexicon.length : 0
    };
  }

  async function downloadDeck(deckId, onProgress) {
    if (!('caches' in window)) {
      throw new Error('เบราว์เซอร์นี้ไม่รองรับ Cache API');
    }
    const deck = getAvailableDecks().find((d) => d.id === deckId);
    if (!deck) throw new Error('ไม่พบชุดคำศัพท์ที่เลือก');

    const quota = getTtsQuota();
    if (quota.remaining <= 0) {
      throw new Error(`ครบโควตาดาวน์โหลดเสียงวันนี้แล้ว (${quota.cap} คำ/วัน)`);
    }

    abortController = new AbortController();
    const signal = abortController.signal;
    const cache = await caches.open(AUDIO_CACHE_NAME);
    const items = deck.items.slice(0, quota.remaining);

    let done = 0;
    let downloaded = 0;
    let skipped = 0;
    let failed = 0;

    for (const text of items) {
      if (signal.aborted) break;
      const url = `/api/tts?lang=${encodeURIComponent('zh-CN')}&text=${encodeURIComponent(text)}`;
      const existing = await cache.match(url);
      if (existing) {
        skipped++;
        done++;
        if (onProgress) onProgress({ done, total: items.length, downloaded, skipped, failed, current: text });
        continue;
      }

      try {
        const res = await fetch(url, { credentials: 'same-origin', signal });
        if (res.status === 501) {
          throw new Error('เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า TTS (501) — แอปจะใช้เสียง Web Speech ของอุปกรณ์แทน');
        }
        if (res.status === 429) {
          throw new Error('เกินโควตาเรียกเสียง TTS ชั่วคราว (429) โปรดลองใหม่ภายหลัง');
        }
        if (res.ok) {
          await cache.put(url, res.clone());
          downloaded++;
        } else {
          failed++;
        }
      } catch (err) {
        if (signal.aborted) break;
        if (err.message && (err.message.includes('501') || err.message.includes('429'))) {
          incrementTtsUsage(downloaded);
          throw err;
        }
        failed++;
      }

      done++;
      if (onProgress) onProgress({ done, total: items.length, downloaded, skipped, failed, current: text });
    }

    incrementTtsUsage(downloaded);
    abortController = null;
    return { done, total: items.length, downloaded, skipped, failed, aborted: signal.aborted };
  }

  function cancelDownload() {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
  }

  async function clearAudioCache() {
    if (!('caches' in window)) return false;
    return caches.delete(AUDIO_CACHE_NAME);
  }

  watchSwUpdates();

  return {
    getAvailableDecks,
    getTtsQuota,
    getStorageStats,
    downloadDeck,
    cancelDownload,
    clearAudioCache
  };
}
