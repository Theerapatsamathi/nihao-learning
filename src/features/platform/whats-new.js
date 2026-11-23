// What's New changelog & quick-links to all newly added feature tabs

const KNOWN_FEATURE_CHANGELOG = [
  {
    group: 'Platform & Offline',
    items: [
      { id: 'settings-plus', title: 'ตั้งค่า & ออฟไลน์', desc: 'สลับโหมดแสดงพินอิน/อักษรจีน, เตือนเวลาเรียน, แพ็กเสียงออฟไลน์, เสียง/สั่น และคำศัพท์ประจำวัน' }
    ]
  },
  {
    group: 'Motivation & Streaks',
    items: [
      { id: 'quests', title: 'ภารกิจรายวัน & ลีก', desc: 'เควสต์ประจำวัน, Streak Freeze และตารางอันดับผู้เรียน' }
    ]
  },
  {
    group: 'Lesson Path',
    items: [
      { id: 'lesson-path', title: 'เส้นทางบทเรียน', desc: 'บทเรียนแบบเป็นขั้นเป็นตอนพร้อมแบบฝึกหัดโต้ตอบ' }
    ]
  },
  {
    group: 'Speak Studio',
    items: [
      { id: 'speak-studio', title: 'สตูดิโอฝึกพูด', desc: 'ฝึกออกเสียง โต้ตอบบทสนทนา และประเมินสำเนียง' }
    ]
  },
  {
    group: 'Games & Reading',
    items: [
      { id: 'games-reading', title: 'เกม & นิทานอ่านเพลิน', desc: 'เรื่องสั้นพร้อมพินอินและมินิเกมทบทวนคำศัพท์' }
    ]
  }
];

/**
 * Discover all dynamically registered plugin tabs from the sidebar DOM,
 * merging with our curated changelog descriptions.
 */
export function collectWhatsNewTabs() {
  const coreIds = new Set([
    'profile', 'plan', 'vocab', 'initials', 'finals', 'tones',
    'chart', 'combiner', 'writing', 'srs', 'speed', 'practice',
    'level2', 'tutor', 'mock'
  ]);
  const descMap = new Map();
  for (const g of KNOWN_FEATURE_CHANGELOG) {
    for (const item of g.items) {
      descMap.set(item.id, item.desc);
    }
  }

  const discovered = [];
  const buttons = document.querySelectorAll('.nav-panel .nav-link[data-tab]');
  buttons.forEach((btn) => {
    const id = btn.getAttribute('data-tab');
    if (!id || coreIds.has(id)) return;
    const label = btn.querySelector('.nav-label-text')?.textContent?.trim() || id;
    discovered.push({
      id,
      label,
      desc: descMap.get(id) || 'ฟีเจอร์ใหม่ในชุดอัปเกรด 你好 Nihao'
    });
  });

  return discovered;
}
