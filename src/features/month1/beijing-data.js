// Beijing Trip (Jan 25, 2027) Hardcore Survival Quests & Pre-Flight >=95% Boarding Exam
import { DAILY_MASTERY_PASS_PCT } from './logic.js';

export const BEIJING_TRIP_DATE = '2027-01-25';

export const BEIJING_QUESTS = [
  {
    id: 'airport',
    icon: '🛬',
    title: 'Quest 1 · สนามบิน & ตม. ปักกิ่ง (PEK/PKX)',
    focus: 'ผ่าน ตม. ตอบจุดประสงค์ ซื้อซิม/เน็ต และขึ้นรถไฟเข้าเมือง',
    phrases: [
      { hz: '我是来旅游的', py: 'wǒ shì lái lǚ yóu de', th: 'ฉันมาท่องเที่ยวครับ/ค่ะ', tip: 'ประโยคหลักเวลา ตม. ถามจุดประสงค์' },
      { hz: '我打算在北京待七天', py: 'wǒ dǎ suàn zài Běi jīng dāi qī tiān', th: 'ฉันวางแผนจะอยู่ปักกิ่ง 7 วัน', tip: '待 (dāi) = พักอยู่' },
      { hz: '这是我的护照和酒店预订单', py: 'zhè shì wǒ de hù zhào hé jiǔ diàn yù dìng dān', th: 'นี่คือพาสปอร์ตและใบจองโรงแรมของฉัน', tip: 'ยื่นพร้อมกันตอนตรวจ ตม.' },
      { hz: '请问在哪里可以买电话卡', py: 'qǐng wèn zài nǎ lǐ kě yǐ mǎi diàn huà kǎ', th: 'ขอโทษครับ ซื้อซิมโทรศัพท์ได้ที่ไหน', tip: '电话卡 = ซิมการ์ด' },
      { hz: '请问机场快轨怎么走', py: 'qǐng wèn jī chǎng kuài guǐ zěn me zǒu', th: 'ขอโทษครับ รถไฟเข้าเมือง (Airport Express) ไปทางไหน', tip: '机场快轨 = Airport Express ปักกิ่ง' },
      { hz: '行李提取处在哪儿', py: 'xíng li tí qǔ chù zài nǎr', th: 'จุดรับกระเป๋าอยู่ที่ไหน', tip: '哪儿 (nǎr) สำเนียงปักกิ่งม้วนลิ้น' },
      { hz: '我的行李还没出来', py: 'wǒ de xíng li hái méi chū lái', th: 'กระเป๋าของฉันยังไม่ออกมาเลย', tip: 'ใช้แจ้งเจ้าหน้าที่สายพานกระเป๋า' },
      { hz: '请问这里可以换人民币吗', py: 'qǐng wèn zhè lǐ kě yǐ huàn rén mín bì ma', th: 'ขอโทษครับ ที่นี่แลกเงินหยวนได้ไหม', tip: '人民币 = เงินหยวน RMB' }
    ]
  },
  {
    id: 'transport',
    icon: '🚇',
    title: 'Quest 2 · รถไฟใต้ดิน & แท็กซี่/Didi ปักกิ่ง',
    focus: 'บอกจุดหมายดังๆ (กู้กง/เทียนอันเหมิน/กำแพงเมืองจีน) และจับสำเนียงปักกิ่ง',
    phrases: [
      { hz: '师傅，我要去天安门广场', py: 'shī fu, wǒ yào qù Tiān ān mén guǎng chǎng', th: 'พี่คนขับครับ ผมจะไปจัตุรัสเทียนอันเหมิน', tip: 'เรียกคนขับแท็กซี่ในปักกิ่งว่า 师傅 (shīfu)' },
      { hz: '请在这里停一下儿', py: 'qǐng zài zhè lǐ tíng yī xiàr', th: 'รบกวนจอดตรงนี้หน่อยครับ', tip: '一下儿 (yīxiàr) ม้วนลิ้นแบบคนปักกิ่ง' },
      { hz: '到故宫大概要多长时间', py: 'dào Gù gōng dà gài yào duō cháng shí jiān', th: 'ไปพระราชวังต้องห้ามใช้เวลาประมาณเท่าไร', tip: '故宫 = พระราชวังต้องห้าม' },
      { hz: '请问去长城怎么坐车', py: 'qǐng wèn qù Cháng chéng zěn me zuò chē', th: 'ขอโทษครับ ไปกำแพงเมืองจีนนั่งรถยังไง', tip: '长城 = กำแพงเมืองจีน' },
      { hz: '请问换乘二号线往哪边走', py: 'qǐng wèn huàn chéng èr hào xiàn wǎng nǎ biān zǒu', th: 'ขอโทษครับ เปลี่ยนไปสาย 2 เดินไปทางไหน', tip: '换乘 = เปลี่ยนสายรถไฟใต้ดิน' },
      { hz: '前面路口右转就到了', py: 'qián miàn lù kǒu yòu zhuǎn jiù dào le', th: 'แยกข้างหน้าเลี้ยวขวาก็ถึงแล้ว', tip: '右转 เลี้ยวขวา / 左转 เลี้ยวซ้าย' },
      { hz: '请打表，谢谢', py: 'qǐng dǎ biǎo, xiè xie', th: 'รบกวนกดมิเตอร์ด้วยครับ ขอบคุณครับ', tip: 'สำคัญมาก! ป้องกันแท็กซี่เหมาแพง' },
      { hz: '我是尾号一二三四的乘客', py: 'wǒ shì wěi hào yī èr sān sì de chéng kè', th: 'ฉันคือผู้โดยสารที่เบอร์ลงท้าย 1234', tip: 'คนขับ Didi จะถามเลขท้ายเบอร์โทร 4 ตัวเสมอ' }
    ]
  },
  {
    id: 'food',
    icon: '🦆',
    title: 'Quest 3 · เป็ดปักกิ่ง · สตรีทฟู้ด & Alipay/WeChat',
    focus: 'สั่งอาหารดังปักกิ่ง แจ้งไม่เผ็ด/ไม่ใส่ผักชี และสแกนจ่ายเงิน',
    phrases: [
      { hz: '我们要半只北京烤鸭', py: 'wǒ men yào bàn zhī Běi jīng kǎo yā', th: 'พวกเราเอาเป็ดปักกิ่งครึ่งตัวครับ', tip: '烤鸭 = เป็ดย่างปักกิ่ง, 半只 = ครึ่งตัว' },
      { hz: '请问怎么扫码点餐', py: 'qǐng wèn zěn me sǎo mǎ diǎn cān', th: 'ขอโทษครับ สแกน QR สั่งอาหารยังไง', tip: 'ร้านในจีน 90% สแกน QR บนโต๊ะสั่ง' },
      { hz: '不要辣，也不要香菜', py: 'bù yào là, yě bù yào xiāng cài', th: 'ไม่เอาเผ็ด และไม่ใส่ผักชีครับ', tip: '香菜 = ผักชี (ประโยคช่วยชีวิต!)' },
      { hz: '服务员，麻烦加点儿热水', py: 'fú wù yuán, má fan jiā diǎnr rè shuǐ', th: 'พนักงานครับ รบกวนเติมน้ำร้อนหน่อย', tip: 'หน้าหนาวปักกิ่งดื่มน้ำร้อนจะช่วยได้เยอะ' },
      { hz: '可以刷支付宝或者微信吗', py: 'kě yǐ shuā Zhī fù bǎo huò zhě Wēi xìn ma', th: 'จ่ายผ่าน Alipay หรือ WeChat ได้ไหม', tip: '支付宝 Alipay / 微信 WeChat' },
      { hz: '请问有英文或者带图片的菜单吗', py: 'qǐng wèn yǒu Yīng wén huò zhě dài tú piàn de cài dān ma', th: 'ขอโทษครับ มีเมนูภาษาอังกฤษหรือแบบมีรูปไหม', tip: '带图片的菜单 = เมนูที่มีรูป' },
      { hz: '这个菜很好吃，再来一份', py: 'zhè ge cài hěn hǎo chī, zài lái yī fèn', th: 'จานนี้อร่อยมาก ขอเพิ่มอีก 1 ที่', tip: '再来一份 = ขอเพิ่มอีก 1 จาน' },
      { hz: '服务员，买单，可以打包吗', py: 'fú wù yuán, mǎi dān, kě yǐ dǎ bāo ma', th: 'พนักงานครับ เก็บเงินครับ ห่อกลับบ้านได้ไหม', tip: '打包 (dǎbāo) = ห่อกลับบ้าน' }
    ]
  },
  {
    id: 'hotel',
    icon: '🏨',
    title: 'Quest 4 · เช็กอินโรงแรม & แก้ปัญหาเฉพาะหน้า',
    focus: 'เช็กอิน ขอ Wi-Fi ฝากกระเป๋า และแจ้งปัญหาห้องพัก',
    phrases: [
      { hz: '你好，我预订了房间，要办理入住', py: 'nǐ hǎo, wǒ yù dìng le fáng jiān, yào bàn lǐ rù zhù', th: 'สวัสดีครับ ผมจองห้องไว้ จะมาเช็กอิน', tip: '办理入住 = เช็กอิน' },
      { hz: '请问包含早餐吗，几点开始', py: 'qǐng wèn bāo hán zǎo cān ma, jǐ diǎn kāi shǐ', th: 'ขอโทษครับ รวมอาหารเช้าไหม เริ่มกี่โมง', tip: '包含 = รวมอยู่ด้วย' },
      { hz: '请问无线网络密码是多少', py: 'qǐng wèn wú xiàn wǎng luò mì mǎ shì duō shǎo', th: 'ขอโทษครับ รหัส Wi-Fi คืออะไร', tip: 'พูดสั้นๆ ว่า Wi-Fi 密码是多少 ก็ได้' },
      { hz: '退房以后可以寄存行李吗', py: 'tuì fáng yǐ hòu kě yǐ jì cún xíng li ma', th: 'หลังเช็กเอาต์ฝากกระเป๋าไว้ได้ไหม', tip: '寄存行李 = ฝากกระเป๋า' },
      { hz: '房间的暖气好像不够热', py: 'fáng jiān de nuǎn qì hǎo xiàng bù gòu rè', th: 'ฮีตเตอร์ในห้องเหมือนจะไม่ค่อยอุ่นเลย', tip: '暖气 (nuǎnqì) = ฮีตเตอร์ (จำเป็นมากเดือน ม.ค.!)' },
      { hz: '我的房卡刷不开门', py: 'wǒ de fáng kǎ shuā bù kāi mén', th: 'คีย์การ์ดของฉันแตะเปิดประตูไม่ได้', tip: '房卡 = คีย์การ์ดห้อง' },
      { hz: '麻烦帮我叫一辆出租车', py: 'má fan bāng wǒ jiào yī liàng chū zū chē', th: 'รบกวนช่วยเรียกแท็กซี่ให้คันหนึ่งครับ', tip: 'ให้ฟรอนต์ช่วยเรียกได้' },
      { hz: '我要办理退房，谢谢', py: 'wǒ yào bàn lǐ tuì fáng, xiè xie', th: 'ฉันต้องการเช็กเอาต์ครับ ขอบคุณครับ', tip: '办理退房 = เช็กเอาต์' }
    ]
  },
  {
    id: 'shopping',
    icon: '🛍️',
    title: 'Quest 5 · ช้อปปิ้ง & ต่อราคาเดือด (หวังฝูจิ่ง)',
    focus: 'ถามราคา ต่อราคาแบบคนพื้นที่ ขอลองไซส์ และทำ Tax Refund',
    phrases: [
      { hz: '老板，这个多少钱', py: 'lǎo bǎn, zhè ge duō shǎo qián', th: 'เถ้าแก่ครับ อันนี้ราคาเท่าไร', tip: 'เรียกเจ้าของร้านว่า 老板 (lǎobǎn)' },
      { hz: '太贵了，能便宜一点儿吗', py: 'tài guì le, néng pián yi yī diǎnr ma', th: 'แพงไปหน่อย ลดราคาลงนิดนึงได้ไหม', tip: 'ประโยคต่อราคาคลาสสิก' },
      { hz: '最低多少钱，诚心买', py: 'zuì dī duō shǎo qián, chéng xīn mǎi', th: 'ลดสุดๆ ได้เท่าไร ตั้งใจซื้อจริงครับ', tip: '诚心买 = ตั้งใจซื้อจริง (แม่ค้าจะยอมลด)' },
      { hz: '有没有大一号或者小一号的', py: 'yǒu méi yǒu dà yī hào huò zhě xiǎo yī hào de', th: 'มีไซส์ใหญ่กว่านี้หรือเล็กกว่านี้ 1 เบอร์ไหม', tip: '大一号 ใหญ่ขึ้น 1 ไซส์ / 小一号 เล็กลง 1 ไซส์' },
      { hz: '我可以试穿一下吗', py: 'wǒ kě yǐ shì chuān yī xià ma', th: 'ฉันขอลองสวมดูหน่อยได้ไหม', tip: '试穿 = ลองใส่เสื้อผ้า/รองเท้า' },
      { hz: '这个可以退税吗', py: 'zhè ge kě yǐ tuì shuì ma', th: 'อันนี้ขอคืนภาษี (Tax Refund) ได้ไหม', tip: '退税 = Tax Refund' },
      { hz: '我再看看，谢谢', py: 'wǒ zài kàn kan, xiè xie', th: 'ขอเดินดูก่อนนะครับ ขอบคุณครับ', tip: 'ใช้เดินออกจากร้านแบบสุภาพ (บางทีแม่ค้าจะเรียกกลับแล้วลดให้!)' },
      { hz: '请给我一个袋子', py: 'qǐng gěi wǒ yī ge dài zi', th: 'รบกวนขอถุงใส่ของ 1 ใบครับ', tip: 'ร้านในจีนมักไม่แถมถุงถ้าไม่ขอ' }
    ]
  },
  {
    id: 'winter',
    icon: '❄️',
    title: 'Quest 6 · หน้าหนาวปักกิ่ง (ม.ค. ติดลบ!) & ฉุกเฉิน',
    focus: 'รับมืออากาศติดลบ ซื้อถุงร้อน/ยา ของหาย และขอความช่วยเหลือ',
    phrases: [
      { hz: '北京冬天太冷了，零下十度', py: 'Běi jīng dōng tiān tài lěng le, líng xià shí dù', th: 'หน้าหนาวปักกิ่งหนาวมาก ติดลบสิบองศา', tip: '零下 (língxià) = ติดลบ' },
      { hz: '请问哪里有卖暖宝宝', py: 'qǐng wèn nǎ lǐ yǒu mài nuǎn bǎo bao', th: 'ขอโทษครับ ที่ไหนมีขายแผ่นแปะกันหนาว (ถุงร้อน)', tip: '暖宝宝 = แผ่นร้อนแปะเสื้อ (ขาดไม่ได้ใน ม.ค.!)' },
      { hz: '我感冒了，想买感冒药', py: 'wǒ gǎn mào le, xiǎng mǎi gǎn mào yào', th: 'ฉันเป็นหวัด อยากซื้อยาแก้หวัด', tip: '感冒药 = ยาแก้หวัด' },
      { hz: '请问附近有药店吗', py: 'qǐng wèn fù jìn yǒu yào diàn ma', th: 'ขอโทษครับ แถวนี้มีร้านขายยาไหม', tip: '药店 = ร้านขายยา' },
      { hz: '请问洗手间在哪儿', py: 'qǐng wèn xǐ shǒu jiān zài nǎr', th: 'ขอโทษครับ ห้องน้ำอยู่ที่ไหน', tip: 'ใช้ได้ทั้งห้าง ร้านอาหาร และสถานที่ท่องเที่ยว' },
      { hz: '不好意思，我迷路了', py: 'bù hǎo yì si, wǒ mí lù le', th: 'ขอโทษนะครับ ฉันหลงทางแล้ว', tip: '迷路 = หลงทาง' },
      { hz: '我的手机快没电了，可以借充电宝吗', py: 'wǒ de shǒu jī kuài méi diàn le, kě yǐ jiè chōng diàn bǎo ma', th: 'มือถือฉันแบตจะหมดแล้ว เช่าพาวเวอร์แบงก์ได้ไหม', tip: '充电宝 = พาวเวอร์แบงก์ (ในจีนมีตู้เช่าทุกที่!)' },
      { hz: '请帮我联系泰国大使馆', py: 'qǐng bāng wǒ lián xì Tài guó dà shǐ guǎn', th: 'ช่วยติดต่อสถานทูตไทยให้ฉันหน่อย', tip: 'ประโยคฉุกเฉินสำคัญ (พาสปอร์ตหาย ฯลฯ)' }
    ]
  }
];

export function getDaysUntilBeijing(todayKey = '2026-11-26', targetDate = BEIJING_TRIP_DATE) {
  const toUtc = (k) => {
    const [y, m, d] = String(k || '').split('-').map(Number);
    if (!y || !m || !d) return NaN;
    return Date.UTC(y, m - 1, d);
  };
  const a = toUtc(todayKey);
  const b = toUtc(targetDate);
  if (Number.isNaN(a) || Number.isNaN(b)) return 60;
  return Math.max(0, Math.round((b - a) / 86400000));
}

export function calcBeijingReadiness(beijingState = {}) {
  const passedQuests = (beijingState && typeof beijingState.quests === 'object' && beijingState.quests) || {};
  const questsDone = BEIJING_QUESTS.filter(q => passedQuests[q.id]?.passed).length;
  const boardingPassed = Boolean(beijingState?.boardingExam?.passed);
  const pct = Math.round(((questsDone + (boardingPassed ? 2 : 0)) / (BEIJING_QUESTS.length + 2)) * 100);
  return {
    questsDone,
    questsTotal: BEIJING_QUESTS.length,
    boardingPassed,
    boardingBestPct: Number(beijingState?.boardingExam?.bestPct) || 0,
    pct
  };
}

function seededShuffle(arr, seed = 1) {
  const out = [...arr];
  let s = (Number(seed) || 1) >>> 0;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function buildBeijingQuestExam(questId, seed = 1) {
  const quest = BEIJING_QUESTS.find(q => q.id === questId) || BEIJING_QUESTS[0];
  const allPhrases = BEIJING_QUESTS.flatMap(q => q.phrases);
  const questions = quest.phrases.map((p, idx) => {
    const distractors = seededShuffle(allPhrases.filter(x => x.th !== p.th), seed + idx * 17).slice(0, 3);
    const isEar = idx % 2 === 0;
    const opts = seededShuffle([p.th, ...distractors.map(d => d.th)], seed + idx * 31);
    return {
      id: `${quest.id}-q-${idx}`,
      kind: 'choice',
      isEar,
      prompt: isEar
        ? '🎧 ฟังเสียงคนปักกิ่งพูด แล้วเลือกความหมายที่ถูกต้อง (โหมดหูไว 1.15x)'
        : `ประโยค "${p.hz}" (${p.py}) แปลว่าอะไร?`,
      audioHz: p.hz,
      rate: isEar ? 1.15 : 0.95,
      options: opts,
      answer: opts.indexOf(p.th),
      ref: p
    };
  });
  const speaking = seededShuffle(quest.phrases, seed + 99).slice(0, 2);
  return {
    quest,
    passPct: DAILY_MASTERY_PASS_PCT,
    questions,
    speaking
  };
}

export function buildPreFlightBoardingExam(seed = 1) {
  const allPhrases = BEIJING_QUESTS.flatMap(q => q.phrases.map(p => ({ ...p, questTitle: q.title })));
  const picked = seededShuffle(allPhrases, seed).slice(0, 16);
  const questions = picked.map((p, idx) => {
    const distractors = seededShuffle(allPhrases.filter(x => x.th !== p.th), seed + idx * 23).slice(0, 3);
    const isEar = idx % 2 === 0;
    const opts = seededShuffle([p.th, ...distractors.map(d => d.th)], seed + idx * 41);
    return {
      id: `boarding-q-${idx}`,
      kind: 'choice',
      isEar,
      prompt: isEar
        ? `🎧 ด่านสนามจริง (${p.questTitle}): ฟังเสียงสปีดปักกิ่ง 1.2x แล้วแปลให้ถูก`
        : `อ่านประโยค "${p.hz}" แล้วเลือกความหมายที่ถูกต้อง (ไม่มีพินอิน!)`,
      audioHz: p.hz,
      rate: isEar ? 1.2 : 1.0,
      options: opts,
      answer: opts.indexOf(p.th),
      ref: p
    };
  });
  const speaking = seededShuffle(allPhrases, seed + 777).slice(0, 4);
  return {
    passPct: DAILY_MASTERY_PASS_PCT,
    questions,
    speaking
  };
}
