// Speak Studio — Scenarios (#1), Shadowing sets (#4), Tone Graph drills (#12)

export const ROLEPLAY_SCENARIOS = [
  {
    id: 'bubble-tea',
    title: 'สั่งชานมไข่มุก',
    emoji: '🧋',
    difficulty: 'HSK 1',
    aiRole: 'พนักงานร้านชานม (เสี่ยวหง)',
    brief: 'คุณอยู่หน้าร้านชานมไข่มุกในเซี่ยงไฮ้ ลองสั่งเมนู ปรับความหวาน/น้ำแข็ง และจ่ายเงินให้ครบ!',
    opening: {
      hz: '欢迎光临！请问您想喝点什么？',
      py: 'Huānyíng guānglín! Qǐngwèn nín xiǎng hē diǎn shénme?',
      th: 'ยินดีต้อนรับค่ะ! ไม่ทราบว่าอยากดื่มอะไรดีคะ?'
    },
    goals: [
      { text: 'สั่งชานมหรือเครื่องดื่มที่ต้องการ', keywords: ['奶茶', '珍珠', '茶', '咖啡', '杯', '要', '喝', 'nǎichá', 'zhēnzhū'] },
      { text: 'ระบุระดับความหวานหรือน้ำแข็ง', keywords: ['少糖', '半糖', '无糖', '少冰', '去冰', '热', '冰', '糖', 'shǎo', 'bàn', 'bīng'] },
      { text: 'ถามราคาหรือขอจ่ายเงิน', keywords: ['多少钱', '微信', '支付宝', '付', '结账', '买单', 'duōshao', 'wēixìn'] }
    ],
    keyPhrases: [
      { hz: '我要一杯珍珠奶茶', py: 'Wǒ yào yī bēi zhēnzhū nǎichá', th: 'ฉันเอาชานมไข่มุก 1 แก้ว' },
      { hz: '半糖，少冰', py: 'Bàn táng, shǎo bīng', th: 'หวาน 50% น้ำแข็งน้อย' },
      { hz: '多少钱？可以用微信支付吗？', py: 'Duōshao qián? Kěyǐ yòng Wēixìn zhīfù ma?', th: 'เท่าไรคะ? ใช้ WeChat Pay ได้ไหม?' }
    ],
    offlineTurns: [
      {
        hz: '好的！珍珠奶茶很受欢迎。请问要几分糖？要冰的还是热的？',
        py: 'Hǎo de! Zhēnzhū nǎichá hěn shòu huānyíng. Qǐngwèn yào jǐ fēn táng? Yào bīng de háishi rè de?',
        th: 'ได้ค่ะ! ชานมไข่มุกขายดีมาก ไม่ทราบว่ารับหวานกี่เปอร์เซ็นต์ และรับเย็นหรือร้อนคะ?',
        hint: { keywords: '半糖 (bàn táng หวานครึ่ง) · 少冰 (shǎo bīng น้ำแข็งน้อย)', py: 'Bàn táng, shǎo bīng, xièxie.', hz: '半糖，少冰，谢谢。' }
      },
      {
        hz: '没问题，半糖少冰。还需要加别的配料吗？',
        py: 'Méi wèntí, bàn táng shǎo bīng. Hái xūyào jiā biéde pèiliào ma?',
        th: 'ไม่มีปัญหาค่ะ หวาน 50% น้ำแข็งน้อย ต้องการเพิ่มท็อปปิ้งอื่นไหมคะ?',
        hint: { keywords: '不用了 (bùyòng le ไม่ต้องแล้ว) · 多少钱 (duōshao qián เท่าไร)', py: 'Bùyòng le, yīgòng duōshao qián?', hz: '不用了，一共多少钱？' }
      },
      {
        hz: '一共十八块钱。您可以用微信或者支付宝付款。',
        py: 'Yīgòng shíbā kuài qián. Nín kěyǐ yòng Wēixìn huòzhě Zhīfùbǎo fùkuǎn.',
        th: 'ทั้งหมด 18 หยวนค่ะ สามารถจ่ายด้วย WeChat หรือ Alipay ได้เลยค่ะ',
        hint: { keywords: '微信支付 (Wēixìn zhīfù) · 给你 (gěi nǐ ให้คุณ)', py: 'Wǒ yòng Wēixìn zhīfù, xièxie!', hz: '我用微信支付，谢谢！' }
      },
      {
        hz: '收到啦！这是您的珍珠奶茶，请慢用，欢迎下次再来！',
        py: 'Shōudào la! Zhè shì nín de zhēnzhū nǎichá, qǐng mànyòng, huānyíng xiàcì zàilái!',
        th: 'ได้รับเงินแล้วค่ะ! นี่ชานมไข่มุกของคุณค่ะ ทานให้อร่อย โอกาสหน้าเชิญใหม่นะคะ!',
        hint: { keywords: '谢谢 (xièxie ขอบคุณ) · 再见 (zàijiàn ลาก่อน)', py: 'Xièxie, zàijiàn!', hz: '谢谢，再见！' }
      }
    ]
  },
  {
    id: 'night-market',
    title: 'ต่อราคาตลาดกลางคืน',
    emoji: '🏮',
    difficulty: 'HSK 1',
    aiRole: 'พ่อค้าตลาดกลางคืนปักกิ่ง (เหลาหวัง)',
    brief: 'คุณเจอของฝากน่ารักที่ตลาดกลางคืน ลองถามราคา ต่อราคาอย่างสุภาพ และตกลงซื้อ',
    opening: {
      hz: '来看看吧！这些纪念品都很漂亮，你喜欢哪一个？',
      py: 'Lái kànkan ba! Zhèxiē jìniànpǐn dōu hěn piàoliang, nǐ xǐhuan nǎ yīgè?',
      th: 'มาดูสิครับ! ของที่ระลึกพวกนี้สวยมาก ชอบชิ้นไหนครับ?'
    },
    goals: [
      { text: 'ถามราคาสินค้า', keywords: ['多少钱', '怎么卖', '价格', 'duōshao', 'zěnme'] },
      { text: 'ต่อราคาให้ถูกลง', keywords: ['太贵', '便宜', '一点', '可以吗', '打折', 'piányi', 'guì'] },
      { text: 'ตกลงซื้อและขอบคุณ', keywords: ['买', '要', '好吧', '成交', '谢谢', 'mǎi', 'yào', 'xièxie'] }
    ],
    keyPhrases: [
      { hz: '这个多少钱？', py: 'Zhège duōshao qián?', th: 'อันนี้ราคาเท่าไร?' },
      { hz: '太贵了，便宜一点儿吧！', py: 'Tài guì le, piányi yīdiǎnr ba!', th: 'แพงไป ลดราคาหน่อยนะ!' },
      { hz: '好吧，我买两个。', py: 'Hǎo ba, wǒ mǎi liǎng gè.', th: 'ตกลง ฉันซื้อ 2 ชิ้น' }
    ],
    offlineTurns: [
      {
        hz: '这个熊猫钥匙扣五十块钱，质量特别好！',
        py: 'Zhège xióngmāo yàoshikòu wǔshí kuài qián, zhìliàng tèbié hǎo!',
        th: 'พวงกุญแจแพนด้าอันนี้ 50 หยวน คุณภาพดีมากเลยนะ!',
        hint: { keywords: '太贵了 (tài guì le แพงไป) · 便宜一点儿 (piányi yīdiǎnr ลดหน่อย)', py: 'Tài guì le! Piányi yīdiǎnr kěyǐ ma?', hz: '太贵了！便宜一点儿可以吗？' }
      },
      {
        hz: '哈哈，你真会砍价！算你四十块钱吧，怎么样？',
        py: 'Hāhā, nǐ zhēn huì kǎnjià! Suàn nǐ sìshí kuài qián ba, zěnmeyàng?',
        th: 'ฮ่าๆ ต่อราคาเก่งจัง! คิดให้ 40 หยวนแล้วกัน เป็นไง?',
        hint: { keywords: '三十五 (sānshíwǔ 35) · 买两个 (mǎi liǎng gè ซื้อ 2 ชิ้น)', py: 'Sānshíwǔ kuài ba, wǒ mǎi liǎng gè!', hz: '三十五块吧，我买两个！' }
      },
      {
        hz: '行！看你这么爽快，两个七十块，给你装好啦！',
        py: 'Xíng! Kàn nǐ zhème shuǎngkuai, liǎng gè qīshí kuài, gěi nǐ zhuānghǎo la!',
        th: 'ได้เลย! เห็นคุยง่ายแบบนี้ 2 อัน 70 หยวน ใส่ถุงให้เรียบร้อยแล้วครับ!',
        hint: { keywords: '太好了 (tài hǎo le ดีเลย) · 谢谢 (xièxie ขอบคุณ)', py: 'Tài hǎo le! Xièxie lǎobǎn!', hz: '太好了！谢谢老板！' }
      },
      {
        hz: '不客气！祝你在北京玩得开心！',
        py: 'Bù kèqi! Zhù nǐ zài Běijīng wán de kāixīn!',
        th: 'ไม่เป็นไรครับ! ขอให้เที่ยวปักกิ่งให้สนุกนะ!',
        hint: { keywords: '再见 (zàijiàn ลาก่อน)', py: 'Xièxie, zàijiàn!', hz: '谢谢，再见！' }
      }
    ]
  },
  {
    id: 'taxi-ride',
    title: 'นั่งแท็กซี่ไปสนามบิน',
    emoji: '🚕',
    difficulty: 'HSK 1',
    aiRole: 'คนขับแท็กซี่ (ซือฝุหลี่)',
    brief: 'คุณเพิ่งขึ้นแท็กซี่เพื่อไปสนามบิน บอกจุดหมาย ถามระยะเวลา และบอกจุดให้จอด',
    opening: {
      hz: '你好！请问去哪里？',
      py: 'Nǐ hǎo! Qǐngwèn qù nǎlǐ?',
      th: 'สวัสดีครับ! ไม่ทราบว่าจะไปไหนครับ?'
    },
    goals: [
      { text: 'บอกจุดหมายปลายทาง (เช่น สนามบิน/โรงแรม)', keywords: ['机场', '酒店', '火车站', '去', '我要去', 'jīchǎng', 'jiǔdiàn'] },
      { text: 'ถามว่าใช้เวลากี่นาทีหรือไกลไหม', keywords: ['多久', '分钟', '远', '堵车', 'duōjiǔ', 'fēnzhōng'] },
      { text: 'บอกคนขับให้จอดหรือขอบคุณเมื่อถึง', keywords: ['停', '这里', '前面', '谢谢', '到了', 'tíng', 'zhèlǐ'] }
    ],
    keyPhrases: [
      { hz: '师傅，我去机场。', py: 'Shīfu, wǒ qù jīchǎng.', th: 'คุณลุงคนขับ ฉันไปสนามบินค่ะ' },
      { hz: '大概要开多久？', py: 'Dàgài yào kāi duōjiǔ?', th: 'ประมาณขับรถนานเท่าไรคะ?' },
      { hz: '就在前面停吧，谢谢！', py: 'Jiù zài qiánmiàn tíng ba, xièxie!', th: 'จอดตรงข้างหน้านี้ได้เลย ขอบคุณค่ะ!' }
    ],
    offlineTurns: [
      {
        hz: '好的，去国际机场。请系好安全带！',
        py: 'Hǎo de, qù guójì jīchǎng. Qǐng jì hǎo ānquándài!',
        th: 'ครับ ไปสนามบินนานาชาติ กรุณาคาดเข็มขัดนิรภัยด้วยนะครับ!',
        hint: { keywords: '多久 (duōjiǔ นานเท่าไร) · 堵车 (dǔchē รถติด)', py: 'Shīfu, dàgài yào kāi duōjiǔ?', hz: '师傅，大概要开多久？' }
      },
      {
        hz: '现在不堵车，大概三十分钟就到了。你是泰国人吗？',
        py: 'Xiànzài bù dǔchē, dàgài sānshí fēnzhōng jiù dào le. Nǐ shì Tàiguórén ma?',
        th: 'ตอนนี้รถไม่ติด ประมาณ 30 นาทีก็ถึงแล้วครับ คุณเป็นคนไทยเหรอครับ?',
        hint: { keywords: '对 (duì ใช่) · 泰国人 (Tàiguórén คนไทย)', py: 'Duì, wǒ shì Tàiguórén. Nín hěn yǒuhǎo!', hz: '对，我是泰国人。您很友好！' }
      },
      {
        hz: '机场快到了，请问在几号航站楼下车？',
        py: 'Jīchǎng kuài dào le, qǐngwèn zài jǐ hào hángzhànlóu xiàchē?',
        th: 'ใกล้ถึงสนามบินแล้วครับ ลงอาคารผู้โดยสารไหนครับ?',
        hint: { keywords: '前面停 (qiánmiàn tíng จอดข้างหน้า) · 谢谢 (xièxie)', py: 'Jiù zài qiánmiàn tíng ba, xièxie shīfu!', hz: '就在前面停吧，谢谢师傅！' }
      },
      {
        hz: '好嘞，一共八十五块。别忘了拿行李，一路平安！',
        py: 'Hǎolei, yīgòng bāshíwǔ kuài. Bié wàng le ná xíngli, yīlù píngān!',
        th: 'ครับผม ทั้งหมด 85 หยวน อย่าลืมหยิบกระเป๋านะครับ เดินทางปลอดภัยครับ!',
        hint: { keywords: '给你 (gěi nǐ) · 再见 (zàijiàn)', py: 'Xièxie, zàijiàn!', hz: '谢谢，再见！' }
      }
    ]
  },
  {
    id: 'hotel-checkin',
    title: 'เช็คอินโรงแรม',
    emoji: '🏨',
    difficulty: 'HSK 1',
    aiRole: 'พนักงานต้อนรับโรงแรม (เสี่ยวหลิน)',
    brief: 'คุณมาถึงโรงแรมในจีน ลองแจ้งการจอง ยื่นพาสปอร์ต และถามเรื่อง Wi-Fi หรืออาหารเช้า',
    opening: {
      hz: '您好，欢迎入住！请问您有预订房间吗？',
      py: 'Nín hǎo, huānyíng rùzhù! Qǐngwèn nín yǒu yùdìng fángjiān ma?',
      th: 'สวัสดีค่ะ ยินดีต้อนรับเข้าพักค่ะ ไม่ทราบว่าจองห้องพักไว้ไหมคะ?'
    },
    goals: [
      { text: 'แจ้งว่าได้จองห้องพักไว้แล้ว', keywords: ['预订', '订了', '房间', '入住', '名字', 'yùdìng', 'fángjiān'] },
      { text: 'ยื่นพาสปอร์ตให้พนักงาน', keywords: ['护照', '给你', '这是', 'hùzhào'] },
      { text: 'ถามเรื่อง Wi-Fi หรือเวลาอาหารเช้า', keywords: ['Wi-Fi', 'wifi', '密码', '早餐', '几点', 'mìmǎ', 'zǎocān'] }
    ],
    keyPhrases: [
      { hz: '你好，我预订了一个房间。', py: 'Nǐ hǎo, wǒ yùdìng le yīgè fángjiān.', th: 'สวัสดี ฉันจองห้องพักไว้ 1 ห้อง' },
      { hz: '这是我的护照。', py: 'Zhè shì wǒ de hùzhào.', th: 'นี่คือพาสปอร์ตของฉัน' },
      { hz: '请问早餐几点开始？Wi-Fi密码是什么？', py: 'Qǐngwèn zǎocān jǐ diǎn kāishǐ? Wi-Fi mìmǎ shì shénme?', th: 'ขอถามหน่อย อาหารเช้าเริ่มกี่โมง? รหัส Wi-Fi คืออะไร?' }
    ],
    offlineTurns: [
      {
        hz: '好的，请出示一下您的护照，我帮您登记。',
        py: 'Hǎo de, qǐng chūshì yīxià nín de hùzhào, wǒ bāng nín dēngjì.',
        th: 'ได้ค่ะ รบกวนขอดูพาสปอร์ตหน่อยนะคะ เดี๋ยวลงทะเบียนให้ค่ะ',
        hint: { keywords: '护照 (hùzhào พาสปอร์ต) · 给您 (gěi nín ให้คุณ)', py: 'Zhè shì wǒ de hùzhào, gěi nín.', hz: '这是我的护照，给您。' }
      },
      {
        hz: '谢谢！您的房间在八楼，808号。这是房卡。',
        py: 'Xièxie! Nín de fángjiān zài bā lóu, bā-líng-bā hào. Zhè shì fángkǎ.',
        th: 'ขอบคุณค่ะ! ห้องของคุณอยู่ชั้น 8 ห้อง 808 นี่คีย์การ์ดค่ะ',
        hint: { keywords: '早餐 (zǎocān อาหารเช้า) · 密码 (mìmǎ รหัสผ่าน)', py: 'Qǐngwèn zǎocān jǐ diǎn kāishǐ? Wi-Fi mìmǎ shì shénme?', hz: '请问早餐几点开始？Wi-Fi密码是什么？' }
      },
      {
        hz: '早餐在二楼，早上七点到十点。Wi-Fi密码是88888888。',
        py: 'Zǎocān zài èr lóu, zǎoshang qī diǎn dào shí diǎn. Wi-Fi mìmǎ shì bā bā bā bā bā bā bā bā.',
        th: 'อาหารเช้าอยู่ชั้น 2 เวลา 7:00 - 10:00 น. รหัส Wi-Fi คือ 88888888 ค่ะ',
        hint: { keywords: '明白了 (míngbai le เข้าใจแล้ว) · 谢谢 (xièxie)', py: 'Míngbai le, fēicháng gǎnxiè!', hz: '明白了，非常感谢！' }
      },
      {
        hz: '不客气！电梯在右边，祝您入住愉快！',
        py: 'Bù kèqi! Diàntī zài yòubiān, zhù nín rùzhù yúkuài!',
        th: 'ยินดีค่ะ! ลิฟต์อยู่ทางขวามือ ขอให้พักผ่อนอย่างมีความสุขนะคะ!',
        hint: { keywords: '谢谢 (xièxie)', py: 'Xièxie nǐ!', hz: '谢谢你！' }
      }
    ]
  },
  {
    id: 'ask-directions',
    title: 'ถามทางไปสถานีรถไฟใต้ดิน',
    emoji: '🗺️',
    difficulty: 'HSK 1',
    aiRole: 'คนท้องถิ่นใจดี (ต้าหมิง)',
    brief: 'คุณหลงทางและอยากหาสถานีรถไฟใต้ดิน ลองทักทายอย่างสุภาพ ถามทาง และถามระยะทาง',
    opening: {
      hz: '你好，有什么我可以帮你的吗？',
      py: 'Nǐ hǎo, yǒu shénme wǒ kěyǐ bāng nǐ de ma?',
      th: 'สวัสดีครับ มีอะไรให้ผมช่วยไหมครับ?'
    },
    goals: [
      { text: 'ขอโทษ/ทักทายและถามทางไปรถไฟใต้ดิน', keywords: ['请问', '地铁', '怎么走', '在哪', 'dìtiě', 'zěnme'] },
      { text: 'ถามว่าไกลไหมหรือเดินกี่นาที', keywords: ['远', '走', '分钟', '多久', 'yuǎn', 'fēnzhōng'] },
      { text: 'ทวนทิศทางหรือกล่าวขอบคุณ', keywords: ['直走', '左转', '右转', '谢谢', '明白', 'xièxie'] }
    ],
    keyPhrases: [
      { hz: '请问，地铁站怎么走？', py: 'Qǐngwèn, dìtiězhàn zěnme zǒu?', th: 'ขอโทษครับ สถานีรถไฟใต้ดินไปทางไหน?' },
      { hz: '从这里走路要几分钟？', py: 'Cóng zhèlǐ zǒulù yào jǐ fēnzhōng?', th: 'เดินจากตรงนี้ใช้เวลากี่นาที?' },
      { hz: '直走然后左转，对吗？', py: 'Zhízǒu ránhòu zuǒzhuǎn, duì ma?', th: 'เดินตรงไปแล้วเลี้ยวซ้าย ใช่ไหม?' }
    ],
    offlineTurns: [
      {
        hz: '地铁站不远！你往前直走，到了红绿灯左转就能看见。',
        py: 'Dìtiězhàn bù yuǎn! Nǐ wǎng qián zhízǒu, dào le hónglǜdēng zuǒzhuǎn jiù néng kànjiàn.',
        th: 'สถานีรถไฟใต้ดินไม่ไกลครับ! เดินตรงไปข้างหน้า พอถึงไฟแดงเลี้ยวซ้ายก็จะเห็นเลย',
        hint: { keywords: '走路 (zǒulù เดิน) · 几分钟 (jǐ fēnzhōng กี่นาที)', py: 'Zǒulù dàgài yào jǐ fēnzhōng?', hz: '走路大概要几分钟？' }
      },
      {
        hz: '走路大概五分钟就到了，很方便！',
        py: 'Zǒulù dàgài wǔ fēnzhōng jiù dào le, hěn fāngbiàn!',
        th: 'เดินประมาณ 5 นาทีก็ถึงแล้วครับ สะดวกมาก!',
        hint: { keywords: '直走 (zhízǒu ตรงไป) · 左转 (zuǒzhuǎn เลี้ยวซ้าย)', py: 'Zhízǒu ránhòu zuǒzhuǎn, duì ma?', hz: '直走然后左转，对吗？' }
      },
      {
        hz: '对，没错！就在一家咖啡店旁边。',
        py: 'Duì, méicuò! Jiù zài yī jiā kāfēidiàn pángbiān.',
        th: 'ใช่ครับ ถูกต้อง! อยู่ข้างๆ ร้านกาแฟเลยครับ',
        hint: { keywords: '太谢谢你了 (tài xièxie nǐ le ขอบคุณมาก)', py: 'Tài xièxie nǐ le! Zàijiàn!', hz: '太谢谢你了！再见！' }
      },
      {
        hz: '不客气，慢走啊！',
        py: 'Bù kèqi, mànzǒu a!',
        th: 'ไม่เป็นไรครับ เดินทางดีๆ นะครับ!',
        hint: { keywords: '再见 (zàijiàn)', py: 'Zàijiàn!', hz: '再见！' }
      }
    ]
  },
  {
    id: 'pharmacy',
    title: 'ซื้อยาที่ร้านขายยา',
    emoji: '💊',
    difficulty: 'HSK 2',
    aiRole: 'เภสัชกร (คุณหมอจาง)',
    brief: 'คุณรู้สึกไม่สบาย (ปวดหัวหรือเป็นหวัด) ลองบอกอาการ ถามวิธีทานยา และซื้อยา',
    opening: {
      hz: '你好！请问哪里不舒服？',
      py: 'Nǐ hǎo! Qǐngwèn nǎlǐ bù shūfu?',
      th: 'สวัสดีค่ะ ไม่ทราบว่าไม่สบายตรงไหนคะ?'
    },
    goals: [
      { text: 'บอกอาการไม่สบาย (เช่น เป็นหวัด ปวดหัว เจ็บคอ)', keywords: ['感冒', '头疼', '发烧', '咳嗽', '嗓子', '肚子', 'gǎnmào', 'tóuténg'] },
      { text: 'ขอยาหรือถามวิธีรับประทานยา', keywords: ['药', '怎么吃', '一天', '几次', 'yào', 'chī'] },
      { text: 'ถามราคาหรือขอบคุณเภสัชกร', keywords: ['多少钱', '谢谢', '好', '买', 'xièxie', 'duōshao'] }
    ],
    keyPhrases: [
      { hz: '我感冒了，有点儿头疼。', py: 'Wǒ gǎnmào le, yǒudiǎnr tóuténg.', th: 'ฉันเป็นหวัด ปวดหัวนิดหน่อย' },
      { hz: '这个药一天吃几次？', py: 'Zhège yào yī tiān chī jǐ cì?', th: 'ยานี้กินวันละกี่ครั้ง?' },
      { hz: '谢谢医生！', py: 'Xièxie yīshēng!', th: 'ขอบคุณคุณหมอ!' }
    ],
    offlineTurns: [
      {
        hz: '有发烧或者咳嗽吗？这种感冒药效果很好。',
        py: 'Yǒu fāshāo huòzhě késou ma? Zhè zhǒng gǎnmàoyào xiàoguǒ hěn hǎo.',
        th: 'มีไข้หรือไอไหมคะ? ยาแก้หวัดตัวนี้ได้ผลดีมากค่ะ',
        hint: { keywords: '没发烧 (méi fāshāo ไม่มีไข้) · 怎么吃 (zěnme chī กินยังไง)', py: 'Méi fāshāo. Zhège yào zěnme chī?', hz: '没发烧。这个药怎么吃？' }
      },
      {
        hz: '一天吃三次，每次两片，饭后用温水吃。记得多喝水！',
        py: 'Yī tiān chī sān cì, měi cì liǎng piàn, fànhòu yòng wēnshuǐ chī. Jìde duō hē shuǐ!',
        th: 'ทานวันละ 3 ครั้ง ครั้งละ 2 เม็ด หลังอาหารพร้อมน้ำอุ่น อย่าลืมดื่มน้ำเยอะๆ นะคะ!',
        hint: { keywords: '多少钱 (duōshao qián เท่าไร) · 买一盒 (mǎi yī hé ซื้อ 1 กล่อง)', py: 'Hǎo de, wǒ mǎi yī hé. Duōshao qián?', hz: '好的，我买一盒。多少钱？' }
      },
      {
        hz: '一盒二十五块。希望你早日康复！',
        py: 'Yī hé èrshíwǔ kuài. Xīwàng nǐ zǎorì kāngfù!',
        th: 'กล่องละ 25 หยวนค่ะ ขอให้หายไวๆ นะคะ!',
        hint: { keywords: '谢谢 (xièxie)', py: 'Xièxie nín!', hz: '谢谢您！' }
      },
      {
        hz: '不客气，好好休息哦！',
        py: 'Bù kèqi, hǎohāo xiūxi o!',
        th: 'ไม่เป็นไรค่ะ พักผ่อนเยอะๆ นะคะ!',
        hint: { keywords: '再见 (zàijiàn)', py: 'Zàijiàn!', hz: '再见！' }
      }
    ]
  },
  {
    id: 'work-intro',
    title: 'แนะนำตัวในที่ทำงานใหม่',
    emoji: '💼',
    difficulty: 'HSK 2',
    aiRole: 'เพื่อนร่วมงานใหม่ (เสี่ยวเฉิน)',
    brief: 'วันแรกที่ทำงานกับทีมจีน ลองแนะนำชื่อ สัญชาติ หน้าที่งาน และฝากเนื้อฝากตัว',
    opening: {
      hz: '你好！欢迎加入我们团队！能介绍一下你自己吗？',
      py: 'Nǐ hǎo! Huānyíng jiārù wǒmen tuánduì! Néng jièshào yīxià nǐ zìjǐ ma?',
      th: 'สวัสดี! ยินดีต้อนรับเข้าสู่ทีมเรานะ แนะนำตัวเองหน่อยได้ไหม?'
    },
    goals: [
      { text: 'แนะนำชื่อและบอกว่ามาจากประเทศไทย', keywords: ['我叫', '我是', '泰国', '来自', 'jiào', 'Tàiguó'] },
      { text: 'บอกตำแหน่งหรือหน้าที่ที่ทำ', keywords: ['工作', '负责', '经理', '设计', '市场', '学习', 'gōngzuò'] },
      { text: 'พูดฝากเนื้อฝากตัว (请多关照)', keywords: ['关照', '高兴', '合作', '认识', 'guānzhào', 'gāoxìng'] }
    ],
    keyPhrases: [
      { hz: '大家好，我叫…，我来自泰国。', py: 'Dàjiā hǎo, wǒ jiào..., wǒ láizì Tàiguó.', th: 'สวัสดีทุกคน ฉันชื่อ... มาจากประเทศไทย' },
      { hz: '我负责市场工作。', py: 'Wǒ fùzé shìchǎng gōngzuò.', th: 'ฉันรับผิดชอบงานด้านการตลาด' },
      { hz: '很高兴认识大家，请多关照！', py: 'Hěn gāoxìng rènshi dàjiā, qǐng duō guānzhào!', th: 'ยินดีที่ได้รู้จักทุกคน ขอฝากเนื้อฝากตัวด้วยนะ!' }
    ],
    offlineTurns: [
      {
        hz: '太棒了！你的中文说得真不错！你在团队里负责什么工作？',
        py: 'Tài bàng le! Nǐ de Zhōngwén shuō de zhēn bùcuò! Nǐ zài tuánduì lǐ fùzé shénme gōngzuò?',
        th: 'ยอดเยี่ยมเลย! ภาษาจีนของคุณพูดได้ดีมาก! ในทีมคุณรับผิดชอบงานอะไรเหรอ?',
        hint: { keywords: '负责 (fùzé รับผิดชอบ) · 工作 (gōngzuò งาน)', py: 'Wǒ fùzé shìchǎng gōngzuò.', hz: '我负责市场工作。' }
      },
      {
        hz: '原来如此，我们以后会经常合作！有什么不懂的随时问我。',
        py: 'Yuánlái rúcǐ, wǒmen yǐhòu huì jīngcháng hézuò! Yǒu shénme bù dǒng de suíshí wèn wǒ.',
        th: 'อย่างนี้นี่เอง ต่อไปเราคงได้ร่วมงานกันบ่อยๆ! มีอะไรไม่เข้าใจถามฉันได้ตลอดเลยนะ',
        hint: { keywords: '请多关照 (qǐng duō guānzhào ฝากเนื้อฝากตัว)', py: 'Hěn gāoxìng rènshi nǐ, qǐng duō guānzhào!', hz: '很高兴认识你，请多关照！' }
      },
      {
        hz: '中午一起去吃午饭吧，我带你熟悉一下周围！',
        py: 'Zhōngwǔ yīqǐ qù chī wǔfàn ba, wǒ dài nǐ shúxī yīxià zhōuwéi!',
        th: 'เที่ยงนี้ไปกินข้าวกลางวันด้วยกันนะ เดี๋ยวพาไปดูรอบๆ!',
        hint: { keywords: '好啊 (hǎo a ดีเลย) · 谢谢 (xièxie)', py: 'Hǎo a, tài xièxie nǐ le!', hz: '好啊，太谢谢你了！' }
      },
      {
        hz: '那就这么说定啦，加油！',
        py: 'Nà jiù zhème shuōdìng la, jiāyóu!',
        th: 'ตกลงตามนี้นะ สู้ๆ!',
        hint: { keywords: '加油 (jiāyóu สู้ๆ)', py: 'Jiāyóu!', hz: '加油！' }
      }
    ]
  },
  {
    id: 'phone-friend',
    title: 'โทรนัดเพื่อนชาวจีน',
    emoji: '📱',
    difficulty: 'HSK 2',
    aiRole: 'เพื่อนชาวจีน (เสี่ยวเหม่ย)',
    brief: 'คุณโทรหาเพื่อนชาวจีนเพื่อนัดกินข้าวหรือดูหนังวันเสาร์ ลองถามว่าว่างไหมและนัดเวลา',
    opening: {
      hz: '喂，你好！最近怎么样？',
      py: 'Wéi, nǐ hǎo! Zuìjìn zěnmeyàng?',
      th: 'ฮัลโหล สวัสดี! ช่วงนี้เป็นไงบ้าง?'
    },
    goals: [
      { text: 'ถามเพื่อนว่าสุดสัปดาห์นี้ว่างไหม', keywords: ['周末', '有空', '有时间', '星期六', '星期天', 'zhōumò', 'yǒukòng'] },
      { text: 'ชวนทำกิจกรรม (กินข้าว/ดูหนัง/ดื่มกาแฟ)', keywords: ['吃饭', '看电影', '喝咖啡', '一起', '逛街', 'chīfàn', 'diànyǐng'] },
      { text: 'นัดเวลาและสถานที่', keywords: ['点', '见', '下午', '晚上', '门口', 'diǎn', 'jiàn'] }
    ],
    keyPhrases: [
      { hz: '你这个周末有空吗？', py: 'Nǐ zhège zhōumò yǒukòng ma?', th: 'สุดสัปดาห์นี้เธอว่างไหม?' },
      { hz: '我们一起去吃火锅吧！', py: 'Wǒmen yīqǐ qù chī huǒguō ba!', th: 'พวกเราไปกินหม่าล่าหม้อไฟด้วยกันเถอะ!' },
      { hz: '星期六晚上六点见！', py: 'Xīngqīliù wǎnshang liù diǎn jiàn!', th: 'เจอกันวันเสาร์ 6 โมงเย็นนะ!' }
    ],
    offlineTurns: [
      {
        hz: '我挺好的！这个星期六下午我有空，你想去做什么？',
        py: 'Wǒ tǐng hǎo de! Zhège xīngqīliù xiàwǔ wǒ yǒukòng, nǐ xiǎng qù zuò shénme?',
        th: 'สบายดีเลย! เสาร์นี้ตอนบ่ายฉันว่าง เธออยากไปทำอะไรเหรอ?',
        hint: { keywords: '一起 (yīqǐ ด้วยกัน) · 吃饭 (chīfàn กินข้าว)', py: 'Wǒmen yīqǐ qù chī huǒguō ba!', hz: '我们一起去吃火锅吧！' }
      },
      {
        hz: '吃火锅太棒了！那我们几点在哪里见面？',
        py: 'Chī huǒguō tài bàng le! Nà wǒmen jǐ diǎn zài nǎlǐ jiànmiàn?',
        th: 'กินหม้อไฟเยี่ยมเลย! งั้นเราเจอกันกี่โมงที่ไหนดี?',
        hint: { keywords: '六点 (liù diǎn 6 โมง) · 地铁站见 (dìtiězhàn jiàn เจอกันที่รถไฟใต้ดิน)', py: 'Wǎnshang liù diǎn zài dìtiězhàn jiàn!', hz: '晚上六点在地铁站见！' }
      },
      {
        hz: '没问题！六点地铁站见，到时候发微信给我哦！',
        py: 'Méi wèntí! Liù diǎn dìtiězhàn jiàn, dàoshíhou fā Wēixìn gěi wǒ o!',
        th: 'ไม่มีปัญหา! 6 โมงเจอกันที่สถานีรถไฟใต้ดิน ถึงแล้วทัก WeChat มานะ!',
        hint: { keywords: '好的 (hǎo de โอเค) · 拜拜 (báibai บ๊ายบาย)', py: 'Hǎo de, bù jiàn bù sàn, báibai!', hz: '好的，不见不散，拜拜！' }
      },
      {
        hz: '拜拜，星期六见！',
        py: 'Báibai, xīngqīliù jiàn!',
        th: 'บ๊ายบาย เจอกันวันเสาร์นะ!',
        hint: { keywords: '拜拜 (báibai)', py: 'Báibai!', hz: '拜拜！' }
      }
    ]
  },
  {
    id: 'restaurant-issue',
    title: 'แจ้งปัญหาในร้านอาหาร',
    emoji: '🍜',
    difficulty: 'HSK 2',
    aiRole: 'พนักงานร้านอาหาร (เสี่ยวจ้าว)',
    brief: 'อาหารที่มาเสิร์ฟผิดเมนูหรือเผ็ดเกินไป ลองเรียกพนักงาน แจ้งปัญหาอย่างสุภาพ และขอเปลี่ยน',
    opening: {
      hz: '您好，这是您的菜，请慢用！',
      py: 'Nín hǎo, zhè shì nín de cài, qǐng mànyòng!',
      th: 'สวัสดีครับ นี่อาหารของคุณครับ เชิญทานให้อร่อยครับ!'
    },
    goals: [
      { text: 'เรียกพนักงานอย่างสุภาพ', keywords: ['服务员', '不好意思', '请问', 'fúwùyuán'] },
      { text: 'แจ้งว่าเสิร์ฟผิดหรือเผ็ดเกินไป', keywords: ['错了', '不是', '太辣', '没点', 'cuò', 'là'] },
      { text: 'ขอเปลี่ยนจานใหม่หรือขอเช็คบิล', keywords: ['换', '不要辣', '结账', '买单', '谢谢', 'huàn'] }
    ],
    keyPhrases: [
      { hz: '服务员，不好意思！', py: 'Fúwùyuán, bù hǎoyìsi!', th: 'น้องพนักงาน ขอโทษนะครับ!' },
      { hz: '这个菜上错了，我点的是不辣的。', py: 'Zhège cài shàng cuò le, wǒ diǎn de shì bù là de.', th: 'อาหารจานนี้เสิร์ฟผิด ที่ฉันสั่งคือไม่เผ็ด' },
      { hz: '可以帮我换一下吗？', py: 'Kěyǐ bāng wǒ huàn yīxià ma?', th: 'ช่วยเปลี่ยนให้หน่อยได้ไหม?' }
    ],
    offlineTurns: [
      {
        hz: '哎呀，真对不起！请问有什么问题吗？',
        py: 'Āiyā, zhēn duìbuqǐ! Qǐngwèn yǒu shénme wèntí ma?',
        th: 'โอ๊ะ ขอโทษจริงๆ ครับ! ไม่ทราบว่ามีปัญหาอะไรครับ?',
        hint: { keywords: '上错了 (shàng cuò le เสิร์ฟผิด) · 太辣了 (tài là le เผ็ดไป)', py: 'Zhège cài shàng cuò le, tài là le.', hz: '这个菜上错了，太辣了。' }
      },
      {
        hz: '非常抱歉！是我们厨房搞错了。您要换一份不辣的吗？',
        py: 'Fēicháng bàoqiàn! Shì wǒmen chúfáng gǎocuò le. Nín yào huàn yī fèn bù là de ma?',
        th: 'ขออภัยอย่างสูงครับ! ทางครัวทำผิดเอง คุณต้องการเปลี่ยนเป็นแบบไม่เผ็ดไหมครับ?',
        hint: { keywords: '换一下 (huàn yīxià เปลี่ยนหน่อย) · 不辣 (bù là ไม่เผ็ด)', py: 'Duì, qǐng bāng wǒ huàn yī fèn bù là de, xièxie.', hz: '对，请帮我换一份不辣的，谢谢。' }
      },
      {
        hz: '马上给您重做，另外送您一杯免费的酸梅汤表示歉意！',
        py: 'Mǎshàng gěi nín chóngzuò, lìngwài sòng nín yī bēi miǎnfèi de suānméitāng biǎoshì qiànyì!',
        th: 'จะรีบทำให้ใหม่ทันทีเลยครับ และแถมน้ำบ๊วยฟรี 1 แก้วเพื่อเป็นการขอโทษนะครับ!',
        hint: { keywords: '没关系 (méi guānxi ไม่เป็นไร) · 谢谢 (xièxie)', py: 'Méi guānxi, xièxie nǐ!', hz: '没关系，谢谢你！' }
      },
      {
        hz: '谢谢您的理解，请稍等五分钟！',
        py: 'Xièxie nín de lǐjiě, qǐng shāoděng wǔ fēnzhōng!',
        th: 'ขอบคุณที่เข้าใจนะครับ รบกวนรอสัก 5 นาทีครับ!',
        hint: { keywords: '好的 (hǎo de)', py: 'Hǎo de, xièxie!', hz: '好的，谢谢！' }
      }
    ]
  },
  {
    id: 'buy-sim',
    title: 'ซื้อซิมการ์ดในจีน',
    emoji: '📶',
    difficulty: 'HSK 2',
    aiRole: 'พนักงานร้านมือถือ (เสี่ยวอู๋)',
    brief: 'คุณเพิ่งลงเครื่องและอยากซื้อซิมเน็ตจีน ลองบอกจำนวนวันที่อยู่ ถามปริมาณเน็ต และขอให้ช่วยใส่ซิม',
    opening: {
      hz: '你好！欢迎光临中国移动，请问需要办理什么业务？',
      py: 'Nǐ hǎo! Huānyíng guānglín Zhōngguó Yídòng, qǐngwèn xūyào bànlǐ shénme yèwù?',
      th: 'สวัสดีค่ะ ยินดีต้อนรับสู่ China Mobile ต้องการทำรายการอะไรคะ?'
    },
    goals: [
      { text: 'บอกว่าต้องการซื้อซิมการ์ดโทรศัพท์', keywords: ['电话卡', 'SIM', '上网', '流量', '买卡', 'diànhuàkǎ'] },
      { text: 'บอกจำนวนวันที่อยู่หรือถามราคาแพ็กเกจ', keywords: ['天', '周', '多少钱', '套餐', 'tiān', 'duōshao'] },
      { text: 'ขอให้พนักงานช่วยใส่ซิมหรือตั้งค่า', keywords: ['帮我', '装', '设置', '谢谢', 'bāng', 'xièxie'] }
    ],
    keyPhrases: [
      { hz: '我想买一张上网电话卡。', py: 'Wǒ xiǎng mǎi yī zhāng shàngwǎng diànhuàkǎ.', th: 'ฉันอยากซื้อซิมเน็ต 1 ใบ' },
      { hz: '我在中国玩七天，多少钱？', py: 'Wǒ zài Zhōngguó wán qī tiān, duōshao qián?', th: 'ฉันเที่ยวที่จีน 7 วัน ราคาเท่าไร?' },
      { hz: '可以帮我装一下吗？', py: 'Kěyǐ bāng wǒ zhuāng yīxià ma?', th: 'ช่วยใส่ซิมให้หน่อยได้ไหม?' }
    ],
    offlineTurns: [
      {
        hz: '好的！请问您在中国待几天？主要用来上网吗？',
        py: 'Hǎo de! Qǐngwèn nín zài Zhōngguó dāi jǐ tiān? Zhǔyào yònglái shàngwǎng ma?',
        th: 'ได้ค่ะ! ไม่ทราบว่าอยู่ที่จีนกี่วันคะ? เน้นใช้เล่นอินเทอร์เน็ตใช่ไหมคะ?',
        hint: { keywords: '七天 (qī tiān 7 วัน) · 多少钱 (duōshao qián เท่าไร)', py: 'Wǒ dāi qī tiān, duōshao qián?', hz: '我待七天，多少钱？' }
      },
      {
        hz: '七天无限流量套餐只要八十块钱，需要出示护照登记。',
        py: 'Qī tiān wúxiàn liúliàng tàocān zhǐyào bāshí kuài qián, xūyào chūshì hùzhào dēngjì.',
        th: 'แพ็กเกจเน็ตไม่อั้น 7 วัน แค่ 80 หยวนค่ะ ต้องใช้พาสปอร์ตลงทะเบียนด้วยนะคะ',
        hint: { keywords: '好的 (hǎo de) · 帮我装 (bāng wǒ zhuāng ช่วยใส่ให้)', py: 'Hǎo de, kěyǐ bāng wǒ zhuāng yīxià ma?', hz: '好的，可以帮我装一下吗？' }
      },
      {
        hz: '当然可以！已经帮您装好并开通了，您试试看能上网吗？',
        py: 'Dāngrán kěyǐ! Yǐjīng bāng nín zhuānghǎo bìng kāitōng le, nín shìshi kàn néng shàngwǎng ma?',
        th: 'ได้เลยค่ะ! ใส่ซิมและเปิดใช้งานให้แล้ว ลองเช็กดูว่าเล่นเน็ตได้ไหมคะ?',
        hint: { keywords: '可以了 (kěyǐ le ได้แล้ว) · 谢谢 (xièxie)', py: 'Kěyǐ le! Fēicháng gǎnxiè!', hz: '可以了！非常感谢！' }
      },
      {
        hz: '不客气！祝您旅途愉快！',
        py: 'Bù kèqi! Zhù nín lǚtú yúkuài!',
        th: 'ยินดีค่ะ! ขอให้เดินทางท่องเที่ยวอย่างสนุกนะคะ!',
        hint: { keywords: '再见 (zàijiàn)', py: 'Zàijiàn!', hz: '再见！' }
      }
    ]
  }
];

export const SHADOWING_SETS = [
  // Topic 1: ทักทาย & แนะนำตัว (7)
  { id: 'sh-01', topic: 'ทักทาย & แนะนำตัว', hz: '你好，很高兴认识你。', py: 'Nǐ hǎo, hěn gāoxìng rènshi nǐ.', th: 'สวัสดี ยินดีที่ได้รู้จักคุณ', level: 'HSK 1' },
  { id: 'sh-02', topic: 'ทักทาย & แนะนำตัว', hz: '我是泰国人，正在学中文。', py: 'Wǒ shì Tàiguórén, zhèngzài xué Zhōngwén.', th: 'ฉันเป็นคนไทย กำลังเรียนภาษาจีนอยู่', level: 'HSK 1' },
  { id: 'sh-03', topic: 'ทักทาย & แนะนำตัว', hz: '请问你贵姓？', py: 'Qǐngwèn nǐ guìxìng?', th: 'ขอถามหน่อย คุณแซ่อะไรครับ/คะ?', level: 'HSK 1' },
  { id: 'sh-04', topic: 'ทักทาย & แนะนำตัว', hz: '好久不见，你最近怎么样？', py: 'Hǎojiǔ bùjiàn, nǐ zuìjìn zěnmeyàng?', th: 'ไม่ได้เจอกันนาน ช่วงนี้เป็นยังไงบ้าง?', level: 'HSK 2' },
  { id: 'sh-05', topic: 'ทักทาย & แนะนำตัว', hz: '不好意思，请再说一遍。', py: 'Bù hǎoyìsi, qǐng zài shuō yī biàn.', th: 'ขอโทษนะ ช่วยพูดอีกครั้งได้ไหม', level: 'HSK 1' },
  { id: 'sh-06', topic: 'ทักทาย & แนะนำตัว', hz: '请问你可以说慢一点儿吗？', py: 'Qǐngwèn nǐ kěyǐ shuō màn yīdiǎnr ma?', th: 'ขอโทษนะ ช่วยพูดช้าลงหน่อยได้ไหม?', level: 'HSK 2' },
  { id: 'sh-07', topic: 'ทักทาย & แนะนำตัว', hz: '非常感谢你的帮助！', py: 'Fēicháng gǎnxiè nǐ de bāngzhù!', th: 'ขอบคุณมากสำหรับความช่วยเหลือของคุณ!', level: 'HSK 2' },

  // Topic 2: สั่งอาหาร & ชานม (7)
  { id: 'sh-08', topic: 'สั่งอาหาร & ชานม', hz: '我要一杯珍珠奶茶，半糖少冰。', py: 'Wǒ yào yī bēi zhēnzhū nǎichá, bàn táng shǎo bīng.', th: 'เอาชานมไข่มุก 1 แก้ว หวานครึ่ง น้ำแข็งน้อย', level: 'HSK 1' },
  { id: 'sh-09', topic: 'สั่งอาหาร & ชานม', hz: '请问有什么招牌菜？', py: 'Qǐngwèn yǒu shénme zhāopáicài?', th: 'ไม่ทราบว่ามีเมนูแนะนำอะไรบ้างคะ?', level: 'HSK 2' },
  { id: 'sh-10', topic: 'สั่งอาหาร & ชานม', hz: '我不吃辣，请不要放辣椒。', py: 'Wǒ bù chī là, qǐng bùyào fàng làjiāo.', th: 'ฉันไม่กินเผ็ด กรุณาอย่าใส่พริก', level: 'HSK 2' },
  { id: 'sh-11', topic: 'สั่งอาหาร & ชานม', hz: '服务员，麻烦拿一双筷子。', py: 'Fúwùyuán, máfan ná yī shuāng kuàizi.', th: 'น้องพนักงาน รบกวนขอตะเกียบ 1 คู่', level: 'HSK 2' },
  { id: 'sh-12', topic: 'สั่งอาหาร & ชานม', hz: '这个菜很好吃，我非常喜欢！', py: 'Zhège cài hěn hǎochī, wǒ fēicháng xǐhuan!', th: 'อาหารจานนี้อร่อยมาก ฉันชอบมากเลย!', level: 'HSK 1' },
  { id: 'sh-13', topic: 'สั่งอาหาร & ชานม', hz: '请问可以打包吗？', py: 'Qǐngwèn kěyǐ dǎbāo ma?', th: 'ขอถามหน่อย ห่อกลับบ้านได้ไหม?', level: 'HSK 2' },
  { id: 'sh-14', topic: 'สั่งอาหาร & ชานม', hz: '买单，一共多少钱？', py: 'Mǎidān, yīgòng duōshao qián?', th: 'เช็คบิลด้วย ทั้งหมดเท่าไร?', level: 'HSK 1' },

  // Topic 3: เดินทาง & ถามทาง (7)
  { id: 'sh-15', topic: 'เดินทาง & ถามทาง', hz: '请问，最近的地铁站在哪里？', py: 'Qǐngwèn, zuìjìn de dìtiězhàn zài nǎlǐ?', th: 'ขอโทษครับ สถานีรถไฟใต้ดินที่ใกล้ที่สุดอยู่ที่ไหน?', level: 'HSK 1' },
  { id: 'sh-16', topic: 'เดินทาง & ถามทาง', hz: '往前直走，然后向右转。', py: 'Wǎng qián zhízǒu, ránhòu xiàng yòu zhuǎn.', th: 'เดินตรงไปข้างหน้า แล้วเลี้ยวขวา', level: 'HSK 2' },
  { id: 'sh-17', topic: 'เดินทาง & ถามทาง', hz: '师傅，我要去国际机场。', py: 'Shīfu, wǒ yào qù guójì jīchǎng.', th: 'คุณคนขับ ฉันจะไปสนามบินนานาชาติ', level: 'HSK 1' },
  { id: 'sh-18', topic: 'เดินทาง & ถามทาง', hz: '从这里到酒店要多久？', py: 'Cóng zhèlǐ dào jiǔdiàn yào duōjiǔ?', th: 'จากตรงนี้ไปโรงแรมใช้เวลานานเท่าไร?', level: 'HSK 2' },
  { id: 'sh-19', topic: 'เดินทาง & ถามทาง', hz: '就在前面停吧，谢谢师傅。', py: 'Jiù zài qiánmiàn tíng ba, xièxie shīfu.', th: 'จอดตรงข้างหน้านี้เลย ขอบคุณครับคุณคนขับ', level: 'HSK 2' },
  { id: 'sh-20', topic: 'เดินทาง & ถามทาง', hz: '请问这趟车去市中心吗？', py: 'Qǐngwèn zhè tàng chē qù shìzhōngxīn ma?', th: 'ขอถามหน่อย รถคันนี้ไปใจกลางเมืองไหม?', level: 'HSK 2' },
  { id: 'sh-21', topic: 'เดินทาง & ถามทาง', hz: '我迷路了，可以帮帮我吗？', py: 'Wǒ mílù le, kěyǐ bāngbang wǒ ma?', th: 'ฉันหลงทาง ช่วยฉันหน่อยได้ไหม?', level: 'HSK 2' },

  // Topic 4: ช้อปปิ้ง & ต่อราคา (7)
  { id: 'sh-22', topic: 'ช้อปปิ้ง & ต่อราคา', hz: '这个多少钱？我可以试试吗？', py: 'Zhège duōshao qián? Wǒ kěyǐ shìshi ma?', th: 'อันนี้เท่าไร? ฉันขอลองได้ไหม?', level: 'HSK 1' },
  { id: 'sh-23', topic: 'ช้อปปิ้ง & ต่อราคา', hz: '太贵了，便宜一点儿吧！', py: 'Tài guì le, piányi yīdiǎnr ba!', th: 'แพงเกินไปแล้ว ลดราคาหน่อยนะ!', level: 'HSK 1' },
  { id: 'sh-24', topic: 'ช้อปปิ้ง & ต่อราคา', hz: '有别的颜色或者大一号的吗？', py: 'Yǒu biéde yánsè huòzhě dà yī hào de ma?', th: 'มีสีอื่นหรือไซส์ใหญ่กว่านี้ไหม?', level: 'HSK 2' },
  { id: 'sh-25', topic: 'ช้อปปิ้ง & ต่อราคา', hz: '可以用支付宝或者微信支付吗？', py: 'Kěyǐ yòng Zhīfùbǎo huòzhě Wēixìn zhīfù ma?', th: 'จ่ายด้วย Alipay หรือ WeChat Pay ได้ไหม?', level: 'HSK 2' },
  { id: 'sh-26', topic: 'ช้อปปิ้ง & ต่อราคา', hz: '我再看看，谢谢。', py: 'Wǒ zài kànkan, xièxie.', th: 'ฉันขอดูไปก่อนนะ ขอบคุณ', level: 'HSK 1' },
  { id: 'sh-27', topic: 'ช้อปปิ้ง & ต่อราคา', hz: '请帮我包起来，谢谢。', py: 'Qǐng bāng wǒ bāo qǐlái, xièxie.', th: 'ช่วยห่อให้หน่อยนะ ขอบคุณ', level: 'HSK 2' },
  { id: 'sh-28', topic: 'ช้อปปิ้ง & ต่อราคา', hz: '请问这里可以退税吗？', py: 'Qǐngwèn zhèlǐ kěyǐ tuìshuì ma?', th: 'ขอถามหน่อย ที่นี่ขอคืนภาษีได้ไหม?', level: 'HSK 3' },

  // Topic 5: ชีวิตประจำวัน & ทำงาน (7)
  { id: 'sh-29', topic: 'ชีวิตประจำวัน & ทำงาน', hz: '今天天气真不错，我们出去走走吧。', py: 'Jīntiān tiānqì zhēn bùcuò, wǒmen chūqù zǒuzou ba.', th: 'วันนี้อากาศดีจริงๆ ออกไปเดินเล่นกันเถอะ', level: 'HSK 2' },
  { id: 'sh-30', topic: 'ชีวิตประจำวัน & ทำงาน', hz: '你这个周末有什么计划？', py: 'Nǐ zhège zhōumò yǒu shénme jìhuà?', th: 'สุดสัปดาห์นี้คุณมีแพลนอะไรไหม?', level: 'HSK 2' },
  { id: 'sh-31', topic: 'ชีวิตประจำวัน & ทำงาน', hz: '我每天早上七点起床。', py: 'Wǒ měitiān zǎoshang qī diǎn qǐchuáng.', th: 'ฉันตื่นนอนตอน 7 โมงเช้าทุกวัน', level: 'HSK 1' },
  { id: 'sh-32', topic: 'ชีวิตประจำวัน & ทำงาน', hz: '很高兴和大家一起工作，请多关照。', py: 'Hěn gāoxìng hé dàjiā yīqǐ gōngzuò, qǐng duō guānzhào.', th: 'ดีใจมากที่ได้ทำงานร่วมกับทุกคน ฝากเนื้อฝากตัวด้วยนะ', level: 'HSK 2' },
  { id: 'sh-33', topic: 'ชีวิตประจำวัน & ทำงาน', hz: '我们明天上午十点开会。', py: 'Wǒmen míngtiān shàngwǔ shí diǎn kāihuì.', th: 'พรุ่งนี้ 10 โมงเช้าพวกเรามีประชุม', level: 'HSK 2' },
  { id: 'sh-34', topic: 'ชีวิตประจำวัน & ทำงาน', hz: '没问题，我马上发给你。', py: 'Méi wèntí, wǒ mǎshàng fā gěi nǐ.', th: 'ไม่มีปัญหา เดี๋ยวฉันส่งให้ทันที', level: 'HSK 2' },
  { id: 'sh-35', topic: 'ชีวิตประจำวัน & ทำงาน', hz: '辛苦了，早点休息吧！', py: 'Xīnkǔ le, zǎodiǎn xiūxi ba!', th: 'เหนื่อยหน่อยนะ รีบพักผ่อนเถอะ!', level: 'HSK 2' },

  // Topic 6: โรงแรม & สุขภาพ (7)
  { id: 'sh-36', topic: 'โรงแรม & สุขภาพ', hz: '你好，我预订了一个房间。', py: 'Nǐ hǎo, wǒ yùdìng le yīgè fángjiān.', th: 'สวัสดี ฉันจองห้องพักไว้ 1 ห้อง', level: 'HSK 1' },
  { id: 'sh-37', topic: 'โรงแรม & สุขภาพ', hz: '请问这里的Wi-Fi密码是什么？', py: 'Qǐngwèn zhèlǐ de Wi-Fi mìmǎ shì shénme?', th: 'ขอถามหน่อย รหัส Wi-Fi ที่นี่คืออะไร?', level: 'HSK 1' },
  { id: 'sh-38', topic: 'โรงแรม & สุขภาพ', hz: '请问可以延迟退房吗？', py: 'Qǐngwèn kěyǐ yánchí tuìfáng ma?', th: 'ขอถามหน่อย เช็คเอาต์เลทได้ไหม?', level: 'HSK 3' },
  { id: 'sh-39', topic: 'โรงแรม & สุขภาพ', hz: '我感冒了，有点儿发烧。', py: 'Wǒ gǎnmào le, yǒudiǎnr fāshāo.', th: 'ฉันเป็นหวัด มีไข้นิดหน่อย', level: 'HSK 2' },
  { id: 'sh-40', topic: 'โรงแรม & สุขภาพ', hz: '请问这个药一天吃几次？', py: 'Qǐngwèn zhège yào yī tiān chī jǐ cì?', th: 'ขอถามหน่อย ยานี้กินวันละกี่ครั้ง?', level: 'HSK 2' },
  { id: 'sh-41', topic: 'โรงแรม & สุขภาพ', hz: '我的手机没电了，可以借充电宝吗？', py: 'Wǒ de shǒujī méi diàn le, kěyǐ jiè chōngdiànbǎo ma?', th: 'มือถือฉันแบตหมด ขอยืมพาวเวอร์แบงก์ได้ไหม?', level: 'HSK 2' },
  { id: 'sh-42', topic: 'โรงแรม & สุขภาพ', hz: '请问洗手间在什么地方？', py: 'Qǐngwèn xǐshǒujiān zài shénme dìfang?', th: 'ขอถามหน่อย ห้องน้ำอยู่ที่ไหนคะ?', level: 'HSK 1' }
];

export const TONE_DRILLS = [
  // Single syllables
  { id: 'tn-1', hz: '妈', py: 'mā', th: 'แม่', tones: [1], group: 'พยางค์เดียว (1 พยางค์)' },
  { id: 'tn-2', hz: '麻', py: 'má', th: 'ป่าน / ชา', tones: [2], group: 'พยางค์เดียว (1 พยางค์)' },
  { id: 'tn-3', hz: '马', py: 'mǎ', th: 'ม้า', tones: [3], group: 'พยางค์เดียว (1 พยางค์)' },
  { id: 'tn-4', hz: '骂', py: 'mà', th: 'ดุ / ด่า', tones: [4], group: 'พยางค์เดียว (1 พยางค์)' },
  { id: 'tn-5', hz: '吗', py: 'ma', th: 'ไหม (เสียงเบา)', tones: [5], group: 'พยางค์เดียว (1 พยางค์)' },
  { id: 'tn-6', hz: '吃', py: 'chī', th: 'กิน', tones: [1], group: 'พยางค์เดียว (1 พยางค์)' },
  { id: 'tn-7', hz: '茶', py: 'chá', th: 'ชา', tones: [2], group: 'พยางค์เดียว (1 พยางค์)' },
  { id: 'tn-8', hz: '水', py: 'shuǐ', th: 'น้ำ', tones: [3], group: 'พยางค์เดียว (1 พยางค์)' },
  // 2-syllable words
  { id: 'tn-9', hz: '中国', py: 'Zhōngguó', th: 'ประเทศจีน (1+2)', tones: [1, 2], group: 'คำ 2 พยางค์' },
  { id: 'tn-10', hz: '老师', py: 'lǎoshī', th: 'คุณครู (3+1)', tones: [3, 1], group: 'คำ 2 พยางค์' },
  { id: 'tn-11', hz: '谢谢', py: 'xièxie', th: 'ขอบคุณ (4+เบา)', tones: [4, 5], group: 'คำ 2 พยางค์' },
  { id: 'tn-12', hz: '奶茶', py: 'nǎichá', th: 'ชานม (3+2)', tones: [3, 2], group: 'คำ 2 พยางค์' },
  { id: 'tn-13', hz: '北京', py: 'Běijīng', th: 'ปักกิ่ง (3+1)', tones: [3, 1], group: 'คำ 2 พยางค์' },
  { id: 'tn-14', hz: '再见', py: 'zàijiàn', th: 'ลาก่อน (4+4)', tones: [4, 4], group: 'คำ 2 พยางค์' },
  { id: 'tn-15', hz: '明天', py: 'míngtiān', th: 'พรุ่งนี้ (2+1)', tones: [2, 1], group: 'คำ 2 พยางค์' },
  { id: 'tn-16', hz: '咖啡', py: 'kāfēi', th: 'กาแฟ (1+1)', tones: [1, 1], group: 'คำ 2 พยางค์' }
];
