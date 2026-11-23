// Engagement Pack Data: Mini Dialogues (Level 1), Daily Quests & Speed Match Pool
window.ENGAGEMENT_DATA = {
  dailyQuests: [
    { id: 'q_drill', title: 'ฝึกฟัง-พูดถูก 5 ข้อ', target: 5, xp: 50, tab: 'practice', metric: 'drills' },
    { id: 'q_write', title: 'เขียนอักษรจีนผ่าน 2 ตัว', target: 2, xp: 40, tab: 'writing', metric: 'writes' },
    { id: 'q_srs', title: 'ทบทวนการ์ด SRS 5 ใบ', target: 5, xp: 40, tab: 'srs', metric: 'srs' }
  ],

  dialogues: [
    {
      id: 'd_teacher',
      title: 'ฉากที่ 1: ทักทายคุณครูครั้งแรก',
      scene: 'ฝึกกฎเสียง 3 ชน 3 (你好) และมารยาทพื้นฐาน',
      lines: [
        { speaker: 'A', role: 'นักเรียน', hanzi: '老师，你好！', pinyin: 'Lǎoshī, nǐ hǎo!', thai: 'สวัสดีครับ/ค่ะ คุณครู!' },
        { speaker: 'B', role: 'คุณครู', hanzi: '你好！请坐。', pinyin: 'Nǐ hǎo! Qǐng zuò.', thai: 'สวัสดีจ้ะ เชิญนั่งเลย' },
        { speaker: 'A', role: 'นักเรียน', hanzi: '谢谢老师！', pinyin: 'Xièxie lǎoshī!', thai: 'ขอบคุณครับ/ค่ะ คุณครู!' },
        { speaker: 'B', role: 'คุณครู', hanzi: '不客气。', pinyin: 'Bú kèqi.', thai: 'ไม่เป็นไรจ้ะ (ยินดี)' }
      ]
    },
    {
      id: 'd_cafe',
      title: 'ฉากที่ 2: ดื่มน้ำหรือดื่มชาดี?',
      scene: 'ฝึกคำกิริยา 吃 (กิน) / 喝 (ดื่ม) และเสียงม้วนลิ้น ch / sh',
      lines: [
        { speaker: 'A', role: 'เพื่อน', hanzi: '你喝水还是喝茶？', pinyin: 'Nǐ hē shuǐ háishi hē chá?', thai: 'คุณจะดื่มน้ำหรือดื่มชาดี?' },
        { speaker: 'B', role: 'ฉัน', hanzi: '我喝茶，谢谢！', pinyin: 'Wǒ hē chá, xièxie!', thai: 'ฉันดื่มชาครับ/ค่ะ ขอบคุณ!' },
        { speaker: 'A', role: 'เพื่อน', hanzi: '你吃米饭吗？', pinyin: 'Nǐ chī mǐfàn ma?', thai: 'คุณกินข้าวสวยไหม?' },
        { speaker: 'B', role: 'ฉัน', hanzi: '好！我爱吃米饭。', pinyin: 'Hǎo! Wǒ ài chī mǐfàn.', thai: 'ดีเลย! ฉันชอบกินข้าวสวย' }
      ]
    },
    {
      id: 'd_family',
      title: 'ฉากที่ 3: แนะนำครอบครัว',
      scene: 'ฝึกคำซ้ำพยางค์เสียงเบา (爸爸, 妈妈, 哥哥, 姐姐)',
      lines: [
        { speaker: 'A', role: 'เพื่อน', hanzi: '他是谁？', pinyin: 'Tā shì shéi?', thai: 'เขาคือใครเหรอ?' },
        { speaker: 'B', role: 'ฉัน', hanzi: '他是我哥哥。', pinyin: 'Tā shì wǒ gēge.', thai: 'เขาคือพี่ชายของฉันเอง' },
        { speaker: 'A', role: 'เพื่อน', hanzi: '爸爸妈妈好吗？', pinyin: 'Bàba māma hǎo ma?', thai: 'คุณพ่อคุณแม่สบายดีไหม?' },
        { speaker: 'B', role: 'ฉัน', hanzi: '他们很好，谢谢！', pinyin: 'Tāmen hěn hǎo, xièxie!', thai: 'ท่านสบายดีมาก ขอบคุณนะ!' }
      ]
    },
    {
      id: 'd_sorry',
      title: 'ฉากที่ 4: ขอโทษและบอกลา',
      scene: 'ฝึกออกเสียง d/t, q, z, x และกฎผันเสียง 不',
      lines: [
        { speaker: 'A', role: 'ฉัน', hanzi: '对不起，朋友！', pinyin: 'Duìbuqǐ, péngyou!', thai: 'ขอโทษนะ เพื่อน!' },
        { speaker: 'B', role: 'เพื่อน', hanzi: '没关系，没事。', pinyin: 'Méi guānxi, méi shì.', thai: 'ไม่เป็นไรเลย ไม่มีปัญหา' },
        { speaker: 'A', role: 'ฉัน', hanzi: '明天见，再见！', pinyin: 'Míngtiān jiàn, zàijiàn!', thai: 'เจอกันพรุ่งนี้นะ ลาก่อน!' },
        { speaker: 'B', role: 'เพื่อน', hanzi: '再见！', pinyin: 'Zàijiàn!', thai: 'ลาก่อน!' }
      ]
    }
  ]
};
