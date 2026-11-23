// #37 Study Reminders (Notification API + setTimeout + SW showNotification + Periodic Background Sync)

import { computeNextReminder, parseTimeSlot } from './logic.js';

const PERIODIC_SYNC_TAG = 'nihao-reminder';

export function initReminders(core) {
  let timerId = null;

  function getConfig() {
    const ext = core.getExt('platform') || {};
    const slots = Array.isArray(ext.reminderTimes) && ext.reminderTimes.length > 0
      ? ext.reminderTimes
      : ['20:00'];
    return {
      enabled: Boolean(ext.remindersEnabled),
      times: slots
    };
  }

  function getCapabilities() {
    const hasNotification = typeof window !== 'undefined' && 'Notification' in window;
    const hasSW = typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isStandalone = window.matchMedia?.('(display-mode: standalone)').matches || Boolean(navigator.standalone);
    return {
      hasNotification,
      permission: hasNotification ? Notification.permission : 'unsupported',
      hasSW,
      isIOS,
      isStandalone
    };
  }

  function hasStudiedToday() {
    const today = core.todayKey();
    const days = core.state?.progress?.studyDays || {};
    return Boolean(days[today] && Number(days[today]) > 0);
  }

  async function syncStateToSw() {
    if (!('serviceWorker' in navigator)) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const cfg = getConfig();
      const payload = {
        type: 'SYNC_REMINDER_STATE',
        enabled: cfg.enabled,
        times: cfg.times,
        todayKey: core.todayKey(),
        studiedToday: hasStudiedToday()
      };
      if (reg.active) {
        reg.active.postMessage(payload);
      }
      if (cfg.enabled && 'periodicSync' in reg) {
        try {
          const status = await navigator.permissions?.query?.({ name: 'periodic-background-sync' });
          if (!status || status.state === 'granted') {
            await reg.periodicSync.register(PERIODIC_SYNC_TAG, {
              minInterval: 12 * 60 * 60 * 1000
            });
          }
        } catch {
          // Periodic Background Sync is optional (Chromium-only)
        }
      } else if (!cfg.enabled && 'periodicSync' in reg) {
        try {
          await reg.periodicSync.unregister(PERIODIC_SYNC_TAG);
        } catch {
          // ignore
        }
      }
    } catch {
      // SW not ready
    }
  }

  async function showReminderNotification(title, body) {
    const caps = getCapabilities();
    if (!caps.hasNotification || Notification.permission !== 'granted') return false;
    const options = {
      body,
      icon: '/icon.svg',
      badge: '/icon.svg',
      tag: 'nihao-study-reminder',
      renotify: true,
      data: { url: '/' }
    };
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready;
        if (reg && typeof reg.showNotification === 'function') {
          await reg.showNotification(title, options);
          return true;
        }
      } catch {
        // fallback below
      }
    }
    try {
      new Notification(title, options);
      return true;
    } catch {
      return false;
    }
  }

  function scheduleNext() {
    if (timerId) {
      clearTimeout(timerId);
      timerId = null;
    }
    const cfg = getConfig();
    if (!cfg.enabled) return null;
    const caps = getCapabilities();
    if (!caps.hasNotification || caps.permission !== 'granted') return null;

    const next = computeNextReminder(cfg.times, new Date());
    if (!next) return null;

    // Cap setTimeout to 24h max (safe 32-bit int)
    const delay = Math.min(next.delayMs, 24 * 60 * 60 * 1000);
    timerId = setTimeout(() => {
      if (!hasStudiedToday()) {
        showReminderNotification(
          '你好 Nihao · ถึงเวลาฝึกภาษาจีนแล้ว!',
          'มาทบทวนคำศัพท์หรือทำแผนเรียนวันนี้ 5–10 นาที เพื่อรักษา Streak ของคุณ'
        );
      }
      scheduleNext();
    }, delay);

    return next;
  }

  async function requestPermission() {
    const caps = getCapabilities();
    if (!caps.hasNotification) {
      core.showToast('เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือน');
      return 'unsupported';
    }
    try {
      const result = await Notification.requestPermission();
      if (result === 'granted') {
        core.showToast('เปิดสิทธิ์การแจ้งเตือนเรียบร้อยแล้ว');
        scheduleNext();
        syncStateToSw();
      } else {
        core.showToast('ไม่ได้รับอนุญาตให้ส่งการแจ้งเตือน');
      }
      return result;
    } catch {
      return Notification.permission;
    }
  }

  function setEnabled(enabled) {
    core.setExt('platform', { remindersEnabled: Boolean(enabled) }, { save: true, reason: 'reminders-toggle' });
    scheduleNext();
    syncStateToSw();
  }

  function addTimeSlot(rawSlot) {
    const parsed = parseTimeSlot(rawSlot);
    if (!parsed) return false;
    const cfg = getConfig();
    if (cfg.times.includes(parsed.normalized)) return false;
    const nextTimes = [...cfg.times, parsed.normalized].sort();
    core.setExt('platform', { reminderTimes: nextTimes }, { save: true, reason: 'reminders-add' });
    scheduleNext();
    syncStateToSw();
    return true;
  }

  function removeTimeSlot(slot) {
    const cfg = getConfig();
    const nextTimes = cfg.times.filter((t) => t !== slot);
    core.setExt('platform', { reminderTimes: nextTimes.length ? nextTimes : ['20:00'] }, { save: true, reason: 'reminders-remove' });
    scheduleNext();
    syncStateToSw();
  }

  async function sendTest() {
    const ok = await showReminderNotification(
      '你好 Nihao · ทดสอบการแจ้งเตือน',
      'ระบบเตือนฝึกภาษาจีนทำงานปกติ! พร้อมลุยคำศัพท์วันนี้หรือยัง?'
    );
    if (!ok) {
      core.showToast('ไม่สามารถส่งการแจ้งเตือนได้ โปรดตรวจสอบสิทธิ์เบราว์เซอร์');
    }
    return ok;
  }

  // Keep SW informed when user logs progress
  core.on('progress', () => {
    syncStateToSw();
  });

  scheduleNext();
  syncStateToSw();

  return {
    getConfig,
    getCapabilities,
    getNextReminder: () => computeNextReminder(getConfig().times, new Date()),
    hasStudiedToday,
    requestPermission,
    setEnabled,
    addTimeSlot,
    removeTimeSlot,
    sendTest
  };
}
