// Curriculum data for Learning Path+ (10 units, HSK1 -> HSK2)
// Accurate Simplified Chinese, tone-marked pinyin, and natural Thai.

export const GOALS = [
  { id: 'travel', emoji: '✈️', label: 'ท่องเที่ยว', desc: 'สั่งอาหาร ถามทาง ซื้อของ และเอาตัวรอดในจีน' },
  { id: 'work', emoji: '💼', label: 'การทำงานและธุรกิจ', desc: 'สื่อสารในออฟฟิศ นัดหมาย และคุยกับลูกค้าจีน' },
  { id: 'hsk', emoji: '🎓', label: 'สอบวัดระดับ HSK', desc: 'ปูพื้นฐานตามลำดับ HSK 1 → HSK 2 อย่างเป็นระบบ' },
  { id: 'culture', emoji: '🎬', label: 'ซีรีส์ เพลง และวัฒนธรรม', desc: 'เข้าใจบทสนทนาในซีรีส์ อาหาร และชีวิตประจำวัน' },
  { id: 'family', emoji: '👨‍👩‍👧‍👦', label: 'ครอบครัวและเด็ก', desc: 'คำศัพท์ใกล้ตัว ครอบครัว ตัวเลข และกิจกรรมสนุกๆ' }
];

export const DAILY_MINUTES_OPTIONS = [5, 10, 15, 20, 30];

export const UNITS = [
  {
    id: 'u1-greetings',
    num: 1,
    level: 'HSK 1',
    emoji: '👋',
    color: '#007aff',
    title: 'ทักทายและแนะนำตัว',
    subtitle: 'สวัสดี ขอบคุณ ขอโทษ และแนะนำชื่อ',
    words: [
      { hz: '你好', py: 'nǐ hǎo', th: 'สวัสดี', emoji: '👋', char: '好' },
      { hz: '谢谢', py: 'xièxie', th: 'ขอบคุณ', emoji: '🙏', char: '谢' },
      { hz: '不客气', py: 'bú kèqi', th: 'ไม่เป็นไร / ด้วยความยินดี', emoji: '😊', char: '不' },
      { hz: '对不起', py: 'duìbuqǐ', th: 'ขอโทษ', emoji: '🙇', char: '对' },
      { hz: '没关系', py: 'méi guānxi', th: 'ไม่เป็นไร (ตอบรับคำขอโทษ)', emoji: '👌', char: '没' },
      { hz: '再见', py: 'zàijiàn', th: 'ลาก่อน / พบกันใหม่', emoji: '👋', char: '见' },
      { hz: '名字', py: 'míngzi', th: 'ชื่อ', emoji: '🪪', char: '名' },
      { hz: '认识', py: 'rènshi', th: 'รู้จัก', emoji: '🤝', char: '认' },
      { hz: '高兴', py: 'gāoxìng', th: 'ดีใจ / ยินดี', emoji: '😄', char: '高' },
      { hz: '泰国', py: 'Tàiguó', th: 'ประเทศไทย', emoji: '🇹🇭', char: '国' },
      { hz: '中国', py: 'Zhōngguó', th: 'ประเทศจีน', emoji: '🇨🇳', char: '中' },
      { hz: '老师', py: 'lǎoshī', th: 'คุณครู', emoji: '👩‍🏫', char: '老' }
    ],
    sentences: [
      { hz: '你好，我叫小明。', py: 'Nǐ hǎo, wǒ jiào Xiǎomíng.', th: 'สวัสดี ฉันชื่อเสี่ยวหมิง', tokens: ['你好', '我', '叫', '小明'], blankIdx: 2 },
      { hz: '我是泰国人。', py: 'Wǒ shì Tàiguórén.', th: 'ฉันเป็นคนไทย', tokens: ['我', '是', '泰国人'], blankIdx: 1 },
      { hz: '你叫什么名字？', py: 'Nǐ jiào shénme míngzi?', th: 'คุณชื่ออะไร?', tokens: ['你', '叫', '什么', '名字'], blankIdx: 2 },
      { hz: '很高兴认识你。', py: 'Hěn gāoxìng rènshi nǐ.', th: 'ยินดีมากที่ได้รู้จักคุณ', tokens: ['很', '高兴', '认识', '你'], blankIdx: 2 },
      { hz: '谢谢老师，再见！', py: 'Xièxie lǎoshī, zàijiàn!', th: 'ขอบคุณคุณครู ลาก่อน!', tokens: ['谢谢', '老师', '再见'], blankIdx: 0 }
    ],
    lessons: [
      { id: 'u1-l1', title: 'คำทักทายพื้นฐาน', emoji: '👋' },
      { id: 'u1-l2', title: 'ขอบคุณและขอโทษ', emoji: '🙏' },
      { id: 'u1-l3', title: 'แนะนำชื่อและสัญชาติ', emoji: '🪪' },
      { id: 'u1-l4', title: 'ทบทวนบทที่ 1', emoji: '⭐' }
    ]
  },
  {
    id: 'u2-numbers',
    num: 2,
    level: 'HSK 1',
    emoji: '🔢',
    color: '#5856d6',
    title: 'ตัวเลขและจำนวน',
    subtitle: 'นับเลข 1–100 อายุ และจำนวนสิ่งของ',
    words: [
      { hz: '一', py: 'yī', th: 'หนึ่ง (1)', emoji: '1️⃣', char: '一' },
      { hz: '二', py: 'èr', th: 'สอง (2)', emoji: '2️⃣', char: '二' },
      { hz: '两', py: 'liǎng', th: 'สอง (ใช้นำหน้าลักษณะนาม)', emoji: '✌️', char: '两' },
      { hz: '三', py: 'sān', th: 'สาม (3)', emoji: '3️⃣', char: '三' },
      { hz: '五', py: 'wǔ', th: 'ห้า (5)', emoji: '5️⃣', char: '五' },
      { hz: '十', py: 'shí', th: 'สิบ (10)', emoji: '🔟', char: '十' },
      { hz: '百', py: 'bǎi', th: 'ร้อย (100)', emoji: '💯', char: '百' },
      { hz: '零', py: 'líng', th: 'ศูนย์ (0)', emoji: '0️⃣', char: '零' },
      { hz: '几', py: 'jǐ', th: 'กี่ (จำนวนไม่เกิน 10)', emoji: '❓', char: '几' },
      { hz: '岁', py: 'suì', th: 'ขวบ / ปี (อายุ)', emoji: '🎂', char: '岁' },
      { hz: '电话', py: 'diànhuà', th: 'โทรศัพท์', emoji: '📞', char: '电' },
      { hz: '号码', py: 'hàomǎ', th: 'หมายเลข / เบอร์', emoji: '#️⃣', char: '号' }
    ],
    sentences: [
      { hz: '我今年二十岁。', py: 'Wǒ jīnnián èrshí suì.', th: 'ปีนี้ฉันอายุ 20 ปี', tokens: ['我', '今年', '二十', '岁'], blankIdx: 3 },
      { hz: '你家有几口人？', py: 'Nǐ jiā yǒu jǐ kǒu rén?', th: 'บ้านคุณมีกี่คน?', tokens: ['你家', '有', '几口', '人'], blankIdx: 2 },
      { hz: '我有两本书。', py: 'Wǒ yǒu liǎng běn shū.', th: 'ฉันมีหนังสือ 2 เล่ม', tokens: ['我', '有', '两本', '书'], blankIdx: 2 },
      { hz: '你的电话号码是多少？', py: 'Nǐ de diànhuà hàomǎ shì duōshao?', th: 'เบอร์โทรศัพท์ของคุณคือเบอร์อะไร?', tokens: ['你的', '电话号码', '是', '多少'], blankIdx: 1 },
      { hz: '这里有三个人。', py: 'Zhèlǐ yǒu sān gè rén.', th: 'ที่นี่มีคน 3 คน', tokens: ['这里', '有', '三个', '人'], blankIdx: 2 }
    ],
    lessons: [
      { id: 'u2-l1', title: 'ตัวเลข 0 ถึง 10', emoji: '🔢' },
      { id: 'u2-l2', title: 'การใช้ 二 และ 两', emoji: '✌️' },
      { id: 'u2-l3', title: 'ถามอายุและเบอร์โทร', emoji: '📞' },
      { id: 'u2-l4', title: 'ทบทวนตัวเลข', emoji: '⭐' }
    ]
  },
  {
    id: 'u3-family',
    num: 3,
    level: 'HSK 1',
    emoji: '👨‍👩‍👧‍👦',
    color: '#ff9500',
    title: 'ครอบครัวและผู้คน',
    subtitle: 'สมาชิกในบ้าน เพื่อน และคำแสดงความเป็นเจ้าของ',
    words: [
      { hz: '爸爸', py: 'bàba', th: 'พ่อ', emoji: '👨', char: '爸' },
      { hz: '妈妈', py: 'māma', th: 'แม่', emoji: '👩', char: '妈' },
      { hz: '哥哥', py: 'gēge', th: 'พี่ชาย', emoji: '👦', char: '哥' },
      { hz: '姐姐', py: 'jiějie', th: 'พี่สาว', emoji: '👧', char: '姐' },
      { hz: '弟弟', py: 'dìdi', th: 'น้องชาย', emoji: '🧒', char: '弟' },
      { hz: '妹妹', py: 'mèimei', th: 'น้องสาว', emoji: '👧', char: '妹' },
      { hz: '朋友', py: 'péngyou', th: 'เพื่อน', emoji: '🧑‍🤝‍🧑', char: '友' },
      { hz: '学生', py: 'xuésheng', th: 'นักเรียน', emoji: '🎒', char: '学' },
      { hz: '医生', py: 'yīshēng', th: 'หมอ / แพทย์', emoji: '👨‍⚕️', char: '医' },
      { hz: '家', py: 'jiā', th: 'บ้าน / ครอบครัว', emoji: '🏠', char: '家' },
      { hz: '爱', py: 'ài', th: 'รัก', emoji: '❤️', char: '爱' },
      { hz: '猫', py: 'māo', th: 'แมว', emoji: '🐱', char: '猫' }
    ],
    sentences: [
      { hz: '我爱我的家人。', py: 'Wǒ ài wǒ de jiārén.', th: 'ฉันรักครอบครัวของฉัน', tokens: ['我', '爱', '我的', '家人'], blankIdx: 1 },
      { hz: '他是我哥哥。', py: 'Tā shì wǒ gēge.', th: 'เขาคือพี่ชายของฉัน', tokens: ['他', '是', '我', '哥哥'], blankIdx: 3 },
      { hz: '我妈妈是医生。', py: 'Wǒ māma shì yīshēng.', th: 'แม่ของฉันเป็นหมอ', tokens: ['我妈妈', '是', '医生'], blankIdx: 2 },
      { hz: '我有一个中国朋友。', py: 'Wǒ yǒu yí gè Zhōngguó péngyou.', th: 'ฉันมีเพื่อนชาวจีน 1 คน', tokens: ['我', '有', '一个', '中国', '朋友'], blankIdx: 4 },
      { hz: '我家有一只猫。', py: 'Wǒ jiā yǒu yì zhī māo.', th: 'บ้านฉันมีแมว 1 ตัว', tokens: ['我家', '有', '一只', '猫'], blankIdx: 3 }
    ],
    lessons: [
      { id: 'u3-l1', title: 'พ่อแม่และพี่น้อง', emoji: '👨‍👩‍👧' },
      { id: 'u3-l2', title: 'เพื่อนและอาชีพ', emoji: '👩‍⚕️' },
      { id: 'u3-l3', title: 'บ้านและสัตว์เลี้ยง', emoji: '🐱' },
      { id: 'u3-l4', title: 'ทบทวนครอบครัว', emoji: '⭐' }
    ]
  },
  {
    id: 'u4-food',
    num: 4,
    level: 'HSK 1',
    emoji: '🍜',
    color: '#ff3b30',
    title: 'อาหารและเครื่องดื่ม',
    subtitle: 'สั่งอาหาร กาแฟ ชา ผลไม้ และบอกความอร่อย',
    words: [
      { hz: '米饭', py: 'mǐfàn', th: 'ข้าวสวย', emoji: '🍚', char: '米' },
      { hz: '面条', py: 'miàntiáo', th: 'ก๋วยเตี๋ยว / บะหมี่', emoji: '🍜', char: '面' },
      { hz: '茶', py: 'chá', th: 'ชา', emoji: '🍵', char: '茶' },
      { hz: '咖啡', py: 'kāfēi', th: 'กาแฟ', emoji: '☕', char: '咖' },
      { hz: '水', py: 'shuǐ', th: 'น้ำเปล่า', emoji: '💧', char: '水' },
      { hz: '苹果', py: 'píngguǒ', th: 'แอปเปิล', emoji: '🍎', char: '果' },
      { hz: '牛奶', py: 'niúnǎi', th: 'นมวัว', emoji: '🥛', char: '牛' },
      { hz: '好吃', py: 'hǎochī', th: 'อร่อย', emoji: '😋', char: '吃' },
      { hz: '喝', py: 'hē', th: 'ดื่ม', emoji: '🥤', char: '喝' },
      { hz: '菜', py: 'cài', th: 'กับข้าว / ผัก', emoji: '🥗', char: '菜' },
      { hz: '水果', py: 'shuǐguǒ', th: 'ผลไม้', emoji: '🍉', char: '水' },
      { hz: '饭馆', py: 'fànguǎn', th: 'ร้านอาหาร', emoji: '🍽️', char: '饭' }
    ],
    sentences: [
      { hz: '我想喝一杯茶。', py: 'Wǒ xiǎng hē yì bēi chá.', th: 'ฉันอยากดื่มชา 1 แก้ว', tokens: ['我', '想', '喝', '一杯', '茶'], blankIdx: 2 },
      { hz: '中国菜很好吃。', py: 'Zhōngguó cài hěn hǎochī.', th: 'อาหารจีนอร่อยมาก', tokens: ['中国菜', '很', '好吃'], blankIdx: 2 },
      { hz: '你喜欢吃面条吗？', py: 'Nǐ xǐhuan chī miàntiáo ma?', th: 'คุณชอบกินก๋วยเตี๋ยวไหม?', tokens: ['你', '喜欢', '吃', '面条', '吗'], blankIdx: 3 },
      { hz: '我要一碗米饭。', py: 'Wǒ yào yì wǎn mǐfàn.', th: 'ฉันเอาข้าวสวย 1 ถ้วย', tokens: ['我', '要', '一碗', '米饭'], blankIdx: 3 },
      { hz: '我每天都喝咖啡。', py: 'Wǒ měitiān dōu hē kāfēi.', th: 'ฉันดื่มกาแฟทุกวัน', tokens: ['我', '每天', '都', '喝', '咖啡'], blankIdx: 4 }
    ],
    lessons: [
      { id: 'u4-l1', title: 'เครื่องดื่มยอดฮิต', emoji: '🍵' },
      { id: 'u4-l2', title: 'อาหารจานหลัก', emoji: '🍜' },
      { id: 'u4-l3', title: 'สั่งอาหารที่ร้าน', emoji: '🍽️' },
      { id: 'u4-l4', title: 'ทบทวนอาหาร', emoji: '⭐' }
    ]
  },
  {
    id: 'u5-time',
    num: 5,
    level: 'HSK 1',
    emoji: '⏰',
    color: '#34c759',
    title: 'เวลา วัน และปฏิทิน',
    subtitle: 'บอกเวลา วันนี้ พรุ่งนี้ เดือน และวันในสัปดาห์',
    words: [
      { hz: '现在', py: 'xiànzài', th: 'ตอนนี้', emoji: '⏱️', char: '现' },
      { hz: '今天', py: 'jīntiān', th: 'วันนี้', emoji: '📅', char: '今' },
      { hz: '明天', py: 'míngtiān', th: 'พรุ่งนี้', emoji: '🌅', char: '明' },
      { hz: '昨天', py: 'zuótiān', th: 'เมื่อวาน', emoji: '⏪', char: '昨' },
      { hz: '点', py: 'diǎn', th: 'โมง / นาฬิกา', emoji: '🕒', char: '点' },
      { hz: '分钟', py: 'fēnzhōng', th: 'นาที', emoji: '⏳', char: '分' },
      { hz: '星期', py: 'xīngqī', th: 'สัปดาห์ / วันในสัปดาห์', emoji: '🗓️', char: '星' },
      { hz: '月', py: 'yuè', th: 'เดือน', emoji: '🌙', char: '月' },
      { hz: '年', py: 'nián', th: 'ปี', emoji: '🎊', char: '年' },
      { hz: '早上', py: 'zǎoshang', th: 'ตอนเช้า', emoji: '🌄', char: '早' },
      { hz: '晚上', py: 'wǎnshang', th: 'ตอนเย็น / กลางคืน', emoji: '🌃', char: '晚' },
      { hz: '生日', py: 'shēngrì', th: 'วันเกิด', emoji: '🎉', char: '生' }
    ],
    sentences: [
      { hz: '现在几点了？', py: 'Xiànzài jǐ diǎn le?', th: 'ตอนนี้กี่โมงแล้ว?', tokens: ['现在', '几', '点', '了'], blankIdx: 2 },
      { hz: '今天星期三。', py: 'Jīntiān xīngqīsān.', th: 'วันนี้วันพุธ', tokens: ['今天', '星期三'], blankIdx: 1 },
      { hz: '明天早上八点见。', py: 'Míngtiān zǎoshang bā diǎn jiàn.', th: 'เจอกันพรุ่งนี้เช้าแปดโมง', tokens: ['明天', '早上', '八点', '见'], blankIdx: 1 },
      { hz: '昨天我去学校了。', py: 'Zuótiān wǒ qù xuéxiào le.', th: 'เมื่อวานฉันไปโรงเรียนมา', tokens: ['昨天', '我', '去', '学校', '了'], blankIdx: 0 },
      { hz: '我的生日是五月十号。', py: 'Wǒ de shēngrì shì wǔ yuè shí hào.', th: 'วันเกิดของฉันคือวันที่ 10 พฤษภาคม', tokens: ['我的', '生日', '是', '五月十号'], blankIdx: 1 }
    ],
    lessons: [
      { id: 'u5-l1', title: 'วันนี้ พรุ่งนี้ เมื่อวาน', emoji: '📅' },
      { id: 'u5-l2', title: 'ถามและบอกเวลา', emoji: '⏰' },
      { id: 'u5-l3', title: 'วันในสัปดาห์และเดือน', emoji: '🗓️' },
      { id: 'u5-l4', title: 'ทบทวนเรื่องเวลา', emoji: '⭐' }
    ]
  },
  {
    id: 'u6-shopping',
    num: 6,
    level: 'HSK 1–2',
    emoji: '🛍️',
    color: '#af52de',
    title: 'ช้อปปิ้งและราคา',
    subtitle: 'ถามราคา ต่อรอง เสื้อผ้า และสีสัน',
    words: [
      { hz: '买', py: 'mǎi', th: 'ซื้อ', emoji: '🛒', char: '买' },
      { hz: '卖', py: 'mài', th: 'ขาย', emoji: '🏷️', char: '卖' },
      { hz: '多少钱', py: 'duōshao qián', th: 'ราคาเท่าไร', emoji: '💰', char: '钱' },
      { hz: '贵', py: 'guì', th: 'แพง', emoji: '💎', char: '贵' },
      { hz: '便宜', py: 'piányi', th: 'ถูก (ราคา)', emoji: '🔖', char: '便' },
      { hz: '衣服', py: 'yīfu', th: 'เสื้อผ้า', emoji: '👕', char: '衣' },
      { hz: '商店', py: 'shāngdiàn', th: 'ร้านค้า', emoji: '🏪', char: '店' },
      { hz: '颜色', py: 'yánsè', th: 'สี', emoji: '🎨', char: '色' },
      { hz: '红', py: 'hóng', th: 'สีแดง', emoji: '🔴', char: '红' },
      { hz: '白', py: 'bái', th: 'สีขาว', emoji: '⚪', char: '白' },
      { hz: '块', py: 'kuài', th: 'หยวน (ภาษาพูด)', emoji: '💵', char: '块' },
      { hz: '试', py: 'shì', th: 'ลอง (สวม/ทำ)', emoji: '👗', char: '试' }
    ],
    sentences: [
      { hz: '这件衣服多少钱？', py: 'Zhè jiàn yīfu duōshao qián?', th: 'เสื้อตัวนี้ราคาเท่าไร?', tokens: ['这件', '衣服', '多少钱'], blankIdx: 2 },
      { hz: '太贵了，便宜一点吧。', py: 'Tài guì le, piányi yìdiǎn ba.', th: 'แพงเกินไป ลดหน่อยได้ไหม', tokens: ['太贵了', '便宜', '一点', '吧'], blankIdx: 1 },
      { hz: '我想买红色的。', py: 'Wǒ xiǎng mǎi hóngsè de.', th: 'ฉันอยากซื้อสีแดง', tokens: ['我', '想', '买', '红色的'], blankIdx: 3 },
      { hz: '我可以试一下吗？', py: 'Wǒ kěyǐ shì yíxià ma?', th: 'ฉันขอลองหน่อยได้ไหม?', tokens: ['我', '可以', '试一下', '吗'], blankIdx: 2 },
      { hz: '这个苹果五块钱。', py: 'Zhège píngguǒ wǔ kuài qián.', th: 'แอปเปิลลูกนี้ราคา 5 หยวน', tokens: ['这个', '苹果', '五块', '钱'], blankIdx: 2 }
    ],
    lessons: [
      { id: 'u6-l1', title: 'ถามราคาและจ่ายเงิน', emoji: '💰' },
      { id: 'u6-l2', title: 'ถูกและแพง ต่อราคา', emoji: '🏷️' },
      { id: 'u6-l3', title: 'เสื้อผ้าและสีสัน', emoji: '👕' },
      { id: 'u6-l4', title: 'ทบทวนช้อปปิ้ง', emoji: '⭐' }
    ]
  },
  {
    id: 'u7-transport',
    num: 7,
    level: 'HSK 2',
    emoji: '🚄',
    color: '#00c7be',
    title: 'การเดินทางและสถานที่',
    subtitle: 'รถไฟ เครื่องบิน ถามทาง และบอกทิศทาง',
    words: [
      { hz: '飞机', py: 'fēijī', th: 'เครื่องบิน', emoji: '✈️', char: '飞' },
      { hz: '火车', py: 'huǒchē', th: 'รถไฟ', emoji: '🚆', char: '车' },
      { hz: '地铁', py: 'dìtiě', th: 'รถไฟใต้ดิน', emoji: '🚇', char: '地' },
      { hz: '出租车', py: 'chūzūchē', th: 'แท็กซี่', emoji: '🚕', char: '出' },
      { hz: '机场', py: 'jīchǎng', th: 'สนามบิน', emoji: '🛫', char: '机' },
      { hz: '酒店', py: 'jiǔdiàn', th: 'โรงแรม', emoji: '🏨', char: '酒' },
      { hz: '左', py: 'zuǒ', th: 'ซ้าย', emoji: '⬅️', char: '左' },
      { hz: '右', py: 'yòu', th: 'ขวา', emoji: '➡️', char: '右' },
      { hz: '远', py: 'yuǎn', th: 'ไกล', emoji: '🔭', char: '远' },
      { hz: '近', py: 'jìn', th: 'ใกล้', emoji: '📍', char: '近' },
      { hz: '旅游', py: 'lǚyóu', th: 'ท่องเที่ยว', emoji: '🧳', char: '旅' },
      { hz: '票', py: 'piào', th: 'ตั๋ว', emoji: '🎫', char: '票' }
    ],
    sentences: [
      { hz: '我坐地铁去公司。', py: 'Wǒ zuò dìtiě qù gōngsī.', th: 'ฉันนั่งรถไฟใต้ดินไปบริษัท', tokens: ['我', '坐', '地铁', '去', '公司'], blankIdx: 2 },
      { hz: '请问，机场怎么走？', py: 'Qǐngwèn, jīchǎng zěnme zǒu?', th: 'ขอโทษครับ สนามบินไปทางไหน?', tokens: ['请问', '机场', '怎么', '走'], blankIdx: 2 },
      { hz: '酒店离这里很近。', py: 'Jiǔdiàn lí zhèlǐ hěn jìn.', th: 'โรงแรมอยู่ใกล้ที่นี่มาก', tokens: ['酒店', '离', '这里', '很近'], blankIdx: 3 },
      { hz: '我已经买了火车票。', py: 'Wǒ yǐjīng mǎi le huǒchēpiào.', th: 'ฉันซื้อตั๋วรถไฟแล้ว', tokens: ['我', '已经', '买了', '火车票'], blankIdx: 3 },
      { hz: '明年我想去中国旅游。', py: 'Míngnián wǒ xiǎng qù Zhōngguó lǚyóu.', th: 'ปีหน้าฉันอยากไปเที่ยวจีน', tokens: ['明年', '我', '想', '去中国', '旅游'], blankIdx: 4 }
    ],
    lessons: [
      { id: 'u7-l1', title: 'ยานพาหนะ', emoji: '🚄' },
      { id: 'u7-l2', title: 'ถามทาง ซ้าย-ขวา', emoji: '🗺️' },
      { id: 'u7-l3', title: 'สนามบินและโรงแรม', emoji: '🏨' },
      { id: 'u7-l4', title: 'ทบทวนการเดินทาง', emoji: '⭐' }
    ]
  },
  {
    id: 'u8-hobbies',
    num: 8,
    level: 'HSK 2',
    emoji: '⚽',
    color: '#ff2d55',
    title: 'งานอดิเรกและกีฬา',
    subtitle: 'ดูหนัง ฟังเพลง ออกกำลังกาย และความชอบ',
    words: [
      { hz: '电影', py: 'diànyǐng', th: 'ภาพยนตร์ / หนัง', emoji: '🎬', char: '影' },
      { hz: '音乐', py: 'yīnyuè', th: 'ดนตรี / เพลง', emoji: '🎵', char: '乐' },
      { hz: '唱歌', py: 'chànggē', th: 'ร้องเพลง', emoji: '🎤', char: '唱' },
      { hz: '跳舞', py: 'tiàowǔ', th: 'เต้นรำ', emoji: '💃', char: '跳' },
      { hz: '跑步', py: 'pǎobù', th: 'วิ่งออกกำลังกาย', emoji: '🏃', char: '跑' },
      { hz: '游泳', py: 'yóuyǒng', th: 'ว่ายน้ำ', emoji: '🏊', char: '游' },
      { hz: '踢足球', py: 'tī zúqiú', th: 'เตะฟุตบอล', emoji: '⚽', char: '球' },
      { hz: '打篮球', py: 'dǎ lánqiú', th: 'เล่นบาสเกตบอล', emoji: '🏀', char: '打' },
      { hz: '看书', py: 'kànshū', th: 'อ่านหนังสือ', emoji: '📚', char: '书' },
      { hz: '运动', py: 'yùndòng', th: 'ออกกำลังกาย / กีฬา', emoji: '🏋️', char: '运' },
      { hz: '好玩', py: 'hǎowán', th: 'สนุก', emoji: '🎮', char: '玩' },
      { hz: '周末', py: 'zhōumò', th: 'สุดสัปดาห์', emoji: '🛋️', char: '周' }
    ],
    sentences: [
      { hz: '周末我喜欢看电影。', py: 'Zhōumò wǒ xǐhuan kàn diànyǐng.', th: 'สุดสัปดาห์ฉันชอบดูหนัง', tokens: ['周末', '我', '喜欢', '看电影'], blankIdx: 3 },
      { hz: '他每天早上跑步。', py: 'Tā měitiān zǎoshang pǎobù.', th: 'เขาวิ่งออกกำลังกายทุกเช้า', tokens: ['他', '每天', '早上', '跑步'], blankIdx: 3 },
      { hz: '你会游泳吗？', py: 'Nǐ huì yóuyǒng ma?', th: 'คุณว่ายน้ำเป็นไหม?', tokens: ['你', '会', '游泳', '吗'], blankIdx: 2 },
      { hz: '她唱歌非常好听。', py: 'Tā chànggē fēicháng hǎotīng.', th: 'เธอร้องเพลงเพราะมาก', tokens: ['她', '唱歌', '非常', '好听'], blankIdx: 1 },
      { hz: '我们一起去打篮球吧。', py: 'Wǒmen yìqǐ qù dǎ lánqiú ba.', th: 'พวกเราไปเล่นบาสด้วยกันเถอะ', tokens: ['我们', '一起', '去', '打篮球', '吧'], blankIdx: 3 }
    ],
    lessons: [
      { id: 'u8-l1', title: 'หนัง เพลง และการอ่าน', emoji: '🎬' },
      { id: 'u8-l2', title: 'กีฬาและออกกำลังกาย', emoji: '⚽' },
      { id: 'u8-l3', title: 'ชวนเพื่อนทำกิจกรรม', emoji: '🎤' },
      { id: 'u8-l4', title: 'ทบทวนงานอดิเรก', emoji: '⭐' }
    ]
  },
  {
    id: 'u9-weather',
    num: 9,
    level: 'HSK 2',
    emoji: '🌤️',
    color: '#32ade6',
    title: 'สภาพอากาศและฤดูกาล',
    subtitle: 'ฝนตก ร้อน หนาว และพยากรณ์อากาศ',
    words: [
      { hz: '天气', py: 'tiānqì', th: 'สภาพอากาศ', emoji: '🌤️', char: '气' },
      { hz: '热', py: 'rè', th: 'ร้อน', emoji: '🥵', char: '热' },
      { hz: '冷', py: 'lěng', th: 'หนาว', emoji: '🥶', char: '冷' },
      { hz: '下雨', py: 'xiàyǔ', th: 'ฝนตก', emoji: '🌧️', char: '雨' },
      { hz: '下雪', py: 'xiàxuě', th: 'หิมะตก', emoji: '❄️', char: '雪' },
      { hz: '晴天', py: 'qíngtiān', th: 'วันฟ้าใส', emoji: '☀️', char: '晴' },
      { hz: '阴天', py: 'yīntiān', th: 'วันฟ้าครึ้ม', emoji: '☁️', char: '阴' },
      { hz: '风', py: 'fēng', th: 'ลม', emoji: '💨', char: '风' },
      { hz: '春天', py: 'chūntiān', th: 'ฤดูใบไม้ผลิ', emoji: '🌸', char: '春' },
      { hz: '夏天', py: 'xiàtiān', th: 'ฤดูร้อน', emoji: '🏖️', char: '夏' },
      { hz: '冬天', py: 'dōngtiān', th: 'ฤดูหนาว', emoji: '⛄', char: '冬' },
      { hz: '舒服', py: 'shūfu', th: 'สบาย', emoji: '😌', char: '舒' }
    ],
    sentences: [
      { hz: '今天天气很热。', py: 'Jīntiān tiānqì hěn rè.', th: 'วันนี้อากาศร้อนมาก', tokens: ['今天', '天气', '很', '热'], blankIdx: 3 },
      { hz: '外面下雨了。', py: 'Wàimiàn xiàyǔ le.', th: 'ข้างนอกฝนตกแล้ว', tokens: ['外面', '下雨', '了'], blankIdx: 1 },
      { hz: '北京的冬天很冷。', py: 'Běijīng de dōngtiān hěn lěng.', th: 'ฤดูหนาวของปักกิ่งหนาวมาก', tokens: ['北京的', '冬天', '很', '冷'], blankIdx: 1 },
      { hz: '春天的天气很舒服。', py: 'Chūntiān de tiānqì hěn shūfu.', th: 'อากาศฤดูใบไม้ผลิสลายมาก', tokens: ['春天的', '天气', '很', '舒服'], blankIdx: 3 },
      { hz: '今天比昨天冷一点。', py: 'Jīntiān bǐ zuótiān lěng yìdiǎn.', th: 'วันนี้หนาวกว่าเมื่อวานนิดหน่อย', tokens: ['今天', '比', '昨天', '冷一点'], blankIdx: 1 }
    ],
    lessons: [
      { id: 'u9-l1', title: 'ร้อน หนาว และฝนตก', emoji: '🌧️' },
      { id: 'u9-l2', title: 'ฤดูกาลทั้งสี่', emoji: '🌸' },
      { id: 'u9-l3', title: 'เปรียบเทียบสภาพอากาศ', emoji: '☀️' },
      { id: 'u9-l4', title: 'ทบทวนสภาพอากาศ', emoji: '⭐' }
    ]
  },
  {
    id: 'u10-work',
    num: 10,
    level: 'HSK 2',
    emoji: '💼',
    color: '#ff9f0a',
    title: 'การทำงานและชีวิตประจำวัน',
    subtitle: 'ออฟฟิศ ประชุม อีเมล และความรับผิดชอบ',
    words: [
      { hz: '工作', py: 'gōngzuò', th: 'ทำงาน / งาน', emoji: '💼', char: '工' },
      { hz: '公司', py: 'gōngsī', th: 'บริษัท', emoji: '🏢', char: '司' },
      { hz: '上班', py: 'shàngbān', th: 'เข้างาน / ไปทำงาน', emoji: '👔', char: '班' },
      { hz: '下班', py: 'xiàbān', th: 'เลิกงาน', emoji: '🏠', char: '下' },
      { hz: '忙', py: 'máng', th: 'ยุ่ง', emoji: '😵', char: '忙' },
      { hz: '累', py: 'lèi', th: 'เหนื่อย', emoji: '😮‍💨', char: '累' },
      { hz: '休息', py: 'xiūxi', th: 'พักผ่อน', emoji: '☕', char: '休' },
      { hz: '电脑', py: 'diànnǎo', th: 'คอมพิวเตอร์', emoji: '💻', char: '脑' },
      { hz: '会议', py: 'huìyì', th: 'การประชุม', emoji: '📊', char: '会' },
      { hz: '帮助', py: 'bāngzhù', th: 'ช่วยเหลือ', emoji: '🤝', char: '帮' },
      { hz: '问题', py: 'wèntí', th: 'คำถาม / ปัญหา', emoji: '❓', char: '问' },
      { hz: '准备', py: 'zhǔnbèi', th: 'เตรียมตัว / เตรียมพร้อม', emoji: '📝', char: '准' }
    ],
    sentences: [
      { hz: '我每天九点上班。', py: 'Wǒ měitiān jiǔ diǎn shàngbān.', th: 'ฉันเข้างานเก้าโมงทุกวัน', tokens: ['我', '每天', '九点', '上班'], blankIdx: 3 },
      { hz: '今天工作非常忙。', py: 'Jīntiān gōngzuò fēicháng máng.', th: 'วันนี้งานยุ่งมาก', tokens: ['今天', '工作', '非常', '忙'], blankIdx: 3 },
      { hz: '谢谢你的帮助。', py: 'Xièxie nǐ de bāngzhù.', th: 'ขอบคุณสำหรับความช่วยเหลือของคุณ', tokens: ['谢谢', '你的', '帮助'], blankIdx: 2 },
      { hz: '我准备好了。', py: 'Wǒ zhǔnbèi hǎo le.', th: 'ฉันเตรียมพร้อมแล้ว', tokens: ['我', '准备', '好了'], blankIdx: 1 },
      { hz: '下班以后我想休息。', py: 'Xiàbān yǐhòu wǒ xiǎng xiūxi.', th: 'หลังเลิกงานฉันอยากพักผ่อน', tokens: ['下班', '以后', '我', '想', '休息'], blankIdx: 4 }
    ],
    lessons: [
      { id: 'u10-l1', title: 'ชีวิตในออฟฟิศ', emoji: '🏢' },
      { id: 'u10-l2', title: 'ยุ่ง เหนื่อย และพักผ่อน', emoji: '☕' },
      { id: 'u10-l3', title: 'ประชุมและช่วยเหลือกัน', emoji: '🤝' },
      { id: 'u10-l4', title: 'ทบทวนการทำงาน', emoji: '🏆' }
    ]
  }
];

export const DICTATION_BANK = {
  word: [
    { hz: '你好', py: 'nǐ hǎo', th: 'สวัสดี' },
    { hz: '谢谢', py: 'xièxie', th: 'ขอบคุณ' },
    { hz: '老师', py: 'lǎoshī', th: 'คุณครู' },
    { hz: '朋友', py: 'péngyou', th: 'เพื่อน' },
    { hz: '咖啡', py: 'kāfēi', th: 'กาแฟ' },
    { hz: '苹果', py: 'píngguǒ', th: 'แอปเปิล' },
    { hz: '明天', py: 'míngtiān', th: 'พรุ่งนี้' },
    { hz: '便宜', py: 'piányi', th: 'ถูก (ราคา)' },
    { hz: '地铁', py: 'dìtiě', th: 'รถไฟใต้ดิน' },
    { hz: '电影', py: 'diànyǐng', th: 'ภาพยนตร์' },
    { hz: '天气', py: 'tiānqì', th: 'สภาพอากาศ' },
    { hz: '工作', py: 'gōngzuò', th: 'ทำงาน / งาน' },
    { hz: '电脑', py: 'diànnǎo', th: 'คอมพิวเตอร์' },
    { hz: '休息', py: 'xiūxi', th: 'พักผ่อน' }
  ],
  phrase: [
    { hz: '不客气', py: 'bú kèqi', th: 'ไม่เป็นไร / ด้วยความยินดี' },
    { hz: '对不起', py: 'duìbuqǐ', th: 'ขอโทษ' },
    { hz: '多少钱', py: 'duōshao qián', th: 'ราคาเท่าไร' },
    { hz: '一杯茶', py: 'yì bēi chá', th: 'ชา 1 แก้ว' },
    { hz: '两本书', py: 'liǎng běn shū', th: 'หนังสือ 2 เล่ม' },
    { hz: '中国菜', py: 'Zhōngguó cài', th: 'อาหารจีน' },
    { hz: '坐地铁', py: 'zuò dìtiě', th: 'นั่งรถไฟใต้ดิน' },
    { hz: '看电影', py: 'kàn diànyǐng', th: 'ดูหนัง' },
    { hz: '打篮球', py: 'dǎ lánqiú', th: 'เล่นบาสเกตบอล' },
    { hz: '非常忙', py: 'fēicháng máng', th: 'ยุ่งมาก' }
  ],
  sentence: [
    { hz: '我是泰国人', py: 'wǒ shì Tàiguórén', th: 'ฉันเป็นคนไทย' },
    { hz: '你好吗', py: 'nǐ hǎo ma', th: 'คุณสบายดีไหม' },
    { hz: '我想喝茶', py: 'wǒ xiǎng hē chá', th: 'ฉันอยากดื่มชา' },
    { hz: '现在几点了', py: 'xiànzài jǐ diǎn le', th: 'ตอนนี้กี่โมงแล้ว' },
    { hz: '今天很热', py: 'jīntiān hěn rè', th: 'วันนี้ร้อนมาก' },
    { hz: '外面下雨了', py: 'wàimiàn xiàyǔ le', th: 'ข้างนอกฝนตกแล้ว' },
    { hz: '我会说汉语', py: 'wǒ huì shuō Hànyǔ', th: 'ฉันพูดภาษาจีนเป็น' },
    { hz: '谢谢你的帮助', py: 'xièxie nǐ de bāngzhù', th: 'ขอบคุณความช่วยเหลือของคุณ' }
  ]
};

// Adaptive Placement Test Question Bank (20 questions, difficulty 1..5)
export const PLACEMENT_BANK = [
  // Difficulty 1 (Absolute beginner HSK 1)
  { id: 'p1-1', difficulty: 1, prompt: 'คำว่า "你好 (nǐ hǎo)" แปลว่าอะไร?', audio: '你好', choices: ['สวัสดี', 'ขอบคุณ', 'ลาก่อน', 'ขอโทษ'], answer: 0 },
  { id: 'p1-2', difficulty: 1, prompt: 'ข้อใดแปลว่า "ขอบคุณ"?', choices: ['再见 (zàijiàn)', '谢谢 (xièxie)', '对不起 (duìbuqǐ)', '没关系 (méi guānxi)'], answer: 1 },
  { id: 'p1-3', difficulty: 1, prompt: 'ตัวเลข "五 (wǔ)" คือเลขใด?', audio: '五', choices: ['3', '4', '5', '6'], answer: 2 },
  { id: 'p1-4', difficulty: 1, prompt: 'คำว่า "妈妈 (māma)" แปลว่าอะไร?', audio: '妈妈', choices: ['พ่อ', 'แม่', 'พี่สาว', 'น้องสาว'], answer: 1 },

  // Difficulty 2 (Early HSK 1)
  { id: 'p2-1', difficulty: 2, prompt: 'ประโยค "我是泰国人。" แปลว่าอะไร?', audio: '我是泰国人', choices: ['ฉันเป็นคนจีน', 'ฉันเป็นคนไทย', 'ฉันไปเมืองไทย', 'ฉันชอบอาหารไทย'], answer: 1 },
  { id: 'p2-2', difficulty: 2, prompt: 'เติมคำในช่องว่าง: 你喝茶___？ (คุณดื่มชาไหม?)', choices: ['的 (de)', '了 (le)', '吗 (ma)', '在 (zài)'], answer: 2 },
  { id: 'p2-3', difficulty: 2, prompt: '"หนังสือ 2 เล่ม" ภาษาจีนพูดอย่างไร?', choices: ['二本书', '两本书', '书两本', '两个书'], answer: 1 },
  { id: 'p2-4', difficulty: 2, prompt: 'ปฏิเสธคำว่า 有 (มี) ต้องใช้คำใด?', choices: ['不有', '没有', '不是有', '别有'], answer: 1 },

  // Difficulty 3 (Mid-Late HSK 1)
  { id: 'p3-1', difficulty: 3, prompt: 'ประโยคใดเรียงคำถูกต้องสำหรับ "ฉันกินข้าวอยู่ที่บ้าน"?', choices: ['我吃饭在家', '我在家吃饭', '在家我吃饭了', '我是家吃饭'], answer: 1 },
  { id: 'p3-2', difficulty: 3, prompt: 'คำว่า "多少钱 (duōshao qián)" ใช้ถามเรื่องใด?', audio: '多少钱', choices: ['ถามเวลา', 'ถามทาง', 'ถามราคา', 'ถามอายุ'], answer: 2 },
  { id: 'p3-3', difficulty: 3, prompt: 'ประโยค "今天天气很热。" แปลว่าอะไร?', audio: '今天天气很热', choices: ['วันนี้อากาศหนาวมาก', 'วันนี้อากาศร้อนมาก', 'พรุ่งนี้ฝนจะตก', 'เมื่อวานลมแรงมาก'], answer: 1 },
  { id: 'p3-4', difficulty: 3, prompt: 'ข้อใดใช้คำว่า 会 (huì) ได้ถูกต้อง?', choices: ['我会说汉语。', '我会喝水。', '我会很高兴。', '我会泰国人。'], answer: 0 },

  // Difficulty 4 (Early HSK 2)
  { id: 'p4-1', difficulty: 4, prompt: 'เติมคำในช่องว่าง: 今天___昨天冷一点。(วันนี้หนาวกว่าเมื่อวานนิดหน่อย)', choices: ['和 (hé)', '比 (bǐ)', '在 (zài)', '把 (bǎ)'], answer: 1 },
  { id: 'p4-2', difficulty: 4, prompt: 'คำว่า "我去过北京。" มีความหมายว่าอย่างไร?', audio: '我去过北京', choices: ['ฉันกำลังไปปักกิ่ง', 'ฉันเคยไปปักกิ่ง', 'ฉันอยากไปปักกิ่ง', 'ฉันจะไปปักกิ่งพรุ่งนี้'], answer: 1 },
  { id: 'p4-3', difficulty: 4, prompt: 'ข้อใดแปลว่า "ฉันนั่งรถไฟใต้ดินไปบริษัท"?', choices: ['我坐地铁去公司。', '我开地铁去公司。', '我去公司坐地铁。', '我走地铁去公司。'], answer: 0 },
  { id: 'p4-4', difficulty: 4, prompt: 'ประโยค "虽然很累，___我很高兴。" ควรเติมคำใด?', choices: ['所以 (suǒyǐ)', '但是 (dànshì)', '因为 (yīnwèi)', '而且 (érqiě)'], answer: 1 },

  // Difficulty 5 (Mid-Late HSK 2)
  { id: 'p5-1', difficulty: 5, prompt: 'ประโยคใดใช้โครงสร้าง "把" ได้ถูกต้อง?', choices: ['我把书放在桌子上了。', '我把看书了。', '我把去学校了。', '我把喜欢喝茶。'], answer: 0 },
  { id: 'p5-2', difficulty: 5, prompt: '"他的汉语说___很好。" ควรเติมคำใด?', choices: ['的 (de)', '地 (de)', '得 (de)', '了 (le)'], answer: 2 },
  { id: 'p5-3', difficulty: 5, prompt: 'โครงสร้าง "一…就…" ในประโยค "我一回家就休息。" แปลว่าอะไร?', audio: '我一回家就休息', choices: ['ฉันกลับบ้านแล้วไม่พักผ่อน', 'พอกลับถึงบ้านฉันก็พักผ่อนทันที', 'ฉันกลับบ้านวันละครั้ง', 'ถึงแม้กลับบ้านก็ยังไม่พัก'], answer: 1 },
  { id: 'p5-4', difficulty: 5, prompt: 'ประโยค "我是坐飞机来的。" ใช้ "是…的" เพื่อเน้นสิ่งใด?', audio: '我是坐飞机来的', choices: ['เน้นอนาคต', 'เน้นวิธีการเดินทาง (นั่งเครื่องบินมา)', 'เน้นความถี่', 'เน้นจำนวนคน'], answer: 1 }
];
