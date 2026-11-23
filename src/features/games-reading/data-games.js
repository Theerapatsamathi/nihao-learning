// Datasets for #14 Mini-Games: Radical Builder (>=30), Measure-word Match (>=40), Tone Bubble, Word Sprint fallback

export const RADICAL_ITEMS = [
  { char: '好', left: '女', right: '子', py: 'hǎo', th: 'ดี', hint: 'ผู้หญิง (女) + ลูก (子) = ดี' },
  { char: '明', left: '日', right: '月', py: 'míng', th: 'สว่าง / ชัดเจน', hint: 'พระอาทิตย์ (日) + พระจันทร์ (月) = สว่าง' },
  { char: '林', left: '木', right: '木', py: 'lín', th: 'ป่าไม้', hint: 'ต้นไม้ 2 ต้นเรียงกัน = ป่า' },
  { char: '休', left: '亻', right: '木', py: 'xiū', th: 'พักผ่อน', hint: 'คน (亻) พิงต้นไม้ (木) = พักผ่อน' },
  { char: '看', left: '手', right: '目', py: 'kàn', th: 'มอง / ดู', hint: 'มือ (手) ป้องเหนือตา (目) = มองดู' },
  { char: '男', left: '田', right: '力', py: 'nán', th: 'ผู้ชาย', hint: 'ทุ่งนา (田) + แรง (力) = ผู้ชาย' },
  { char: '妈', left: '女', right: '马', py: 'mā', th: 'แม่', hint: 'ผู้หญิง (女) + เสียง ม่า (马)' },
  { char: '你', left: '亻', right: '尔', py: 'nǐ', th: 'คุณ', hint: 'คน (亻) + 尔' },
  { char: '他', left: '亻', right: '也', py: 'tā', th: 'เขา (ผู้ชาย)', hint: 'คน (亻) + 也' },
  { char: '她', left: '女', right: '也', py: 'tā', th: 'เธอ (ผู้หญิง)', hint: 'ผู้หญิง (女) + 也' },
  { char: '们', left: '亻', right: '门', py: 'men', th: 'พวก (พหูพจน์)', hint: 'คน (亻) + ประตู (门)' },
  { char: '吃', left: '口', right: '乞', py: 'chī', th: 'กิน', hint: 'ปาก (口) + 乞' },
  { char: '喝', left: '口', right: '曷', py: 'hē', th: 'ดื่ม', hint: 'ปาก (口) + 曷' },
  { char: '吗', left: '口', right: '马', py: 'ma', th: 'ไหม (คำถาม)', hint: 'ปาก (口) + 马' },
  { char: '呢', left: '口', right: '尼', py: 'ne', th: 'ล่ะ / นะ', hint: 'ปาก (口) + 尼' },
  { char: '语', left: '讠', right: '吾', py: 'yǔ', th: 'ภาษา', hint: 'คำพูด (讠) + 吾' },
  { char: '说', left: '讠', right: '兑', py: 'shuō', th: 'พูด', hint: 'คำพูด (讠) + 兑' },
  { char: '请', left: '讠', right: '青', py: 'qǐng', th: 'เชิญ / กรุณา', hint: 'คำพูด (讠) + 青' },
  { char: '清', left: '氵', right: '青', py: 'qīng', th: 'ใส / สะอาด', hint: 'น้ำ (氵) + 青' },
  { char: '晴', left: '日', right: '青', py: 'qíng', th: 'อากาศแจ่มใส', hint: 'พระอาทิตย์ (日) + 青' },
  { char: '情', left: '忄', right: '青', py: 'qíng', th: 'อารมณ์ / ความรู้สึก', hint: 'ใจ (忄) + 青' },
  { char: '江', left: '氵', right: '工', py: 'jiāng', th: 'แม่น้ำ', hint: 'น้ำ (氵) + 工' },
  { char: '河', left: '氵', right: '可', py: 'hé', th: 'แม่น้ำ / คลอง', hint: 'น้ำ (氵) + 可' },
  { char: '洗', left: '氵', right: '先', py: 'xǐ', th: 'ล้าง / ซัก', hint: 'น้ำ (氵) + 先' },
  { char: '打', left: '扌', right: '丁', py: 'dǎ', th: 'ตี / โทร / เล่น', hint: 'มือ (扌) + 丁' },
  { char: '找', left: '扌', right: '戈', py: 'zhǎo', th: 'หา', hint: 'มือ (扌) + 戈' },
  { char: '把', left: '扌', right: '巴', py: 'bǎ', th: 'จับ / คำช่วยกรรม', hint: 'มือ (扌) + 巴' },
  { char: '姐', left: '女', right: '且', py: 'jiě', th: 'พี่สาว', hint: 'ผู้หญิง (女) + 且' },
  { char: '妹', left: '女', right: '未', py: 'mèi', th: 'น้องสาว', hint: 'ผู้หญิง (女) + 未' },
  { char: '安', left: '宀', right: '女', py: 'ān', th: 'สงบ / ปลอดภัย', hint: 'หลังคา (宀) + ผู้หญิง (女)' },
  { char: '家', left: '宀', right: '豕', py: 'jiā', th: 'บ้าน / ครอบครัว', hint: 'หลังคา (宀) + หมู (豕)' },
  { char: '鲜', left: '鱼', right: '羊', py: 'xiān', th: 'สด / อร่อยกลมกล่อม', hint: 'ปลา (鱼) + แกะ (羊) = รสอูมามิสดอร่อย' }
];

export const MEASURE_WORDS = [
  { mw: '个', py: 'gè', hint: 'คน / สิ่งของทั่วไป' },
  { mw: '本', py: 'běn', hint: 'หนังสือ / สมุด / นิตยสาร' },
  { mw: '只', py: 'zhī', hint: 'สัตว์เล็ก / ข้างเดียว' },
  { mw: '张', py: 'zhāng', hint: 'ของแบนๆ (โต๊ะ กระดาษ ตั๋ว)' },
  { mw: '杯', py: 'bēi', hint: 'แก้ว / ถ้วยเครื่องดื่ม' },
  { mw: '件', py: 'jiàn', hint: 'เสื้อ / เรื่องราว / พัสดุ' },
  { mw: '条', py: 'tiáo', hint: 'ของยาวๆ (กางเกง ปลา ถนน แม่น้ำ)' },
  { mw: '辆', py: 'liàng', hint: 'รถที่มีล้อ' },
  { mw: '位', py: 'wèi', hint: 'ท่าน (สุภาพสำหรับคน)' },
  { mw: '双', py: 'shuāng', hint: 'คู่ (รองเท้า ตะเกียบ ถุงเท้า)' },
  { mw: '支', py: 'zhī', hint: 'แท่ง (ปากกา ดินสอ)' },
  { mw: '瓶', py: 'píng', hint: 'ขวด' }
];

export const MEASURE_ITEMS = [
  { noun: '苹果', py: 'píngguǒ', th: 'แอปเปิล', mw: '个' },
  { noun: '朋友', py: 'péngyou', th: 'เพื่อน', mw: '个' },
  { noun: '学生', py: 'xuésheng', th: 'นักเรียน', mw: '个' },
  { noun: '问题', py: 'wèntí', th: 'คำถาม / ปัญหา', mw: '个' },
  { noun: '手机', py: 'shǒujī', th: 'โทรศัพท์มือถือ', mw: '个' },
  { noun: '书', py: 'shū', th: 'หนังสือ', mw: '本' },
  { noun: '词典', py: 'cídiǎn', th: 'พจนานุกรม', mw: '本' },
  { noun: '杂志', py: 'zázhì', th: 'นิตยสาร', mw: '本' },
  { noun: '笔记本', py: 'bǐjìběn', th: 'สมุดโน้ต', mw: '本' },
  { noun: '漫画', py: 'mànhuà', th: 'หนังสือการ์ตูน', mw: '本' },
  { noun: '猫', py: 'māo', th: 'แมว', mw: '只' },
  { noun: '狗', py: 'gǒu', th: 'สุนัข', mw: '只' },
  { noun: '鸟', py: 'niǎo', th: 'นก', mw: '只' },
  { noun: '熊猫', py: 'xióngmāo', th: 'แพนด้า', mw: '只' },
  { noun: '兔子', py: 'tùzi', th: 'กระต่าย', mw: '只' },
  { noun: '桌子', py: 'zhuōzi', th: 'โต๊ะ', mw: '张' },
  { noun: '纸', py: 'zhǐ', th: 'กระดาษ', mw: '张' },
  { noun: '电影票', py: 'diànyǐngpiào', th: 'ตั๋วหนัง', mw: '张' },
  { noun: '照片', py: 'zhàopiàn', th: 'รูปถ่าย', mw: '张' },
  { noun: '床', py: 'chuáng', th: 'เตียงนอน', mw: '张' },
  { noun: '咖啡', py: 'kāfēi', th: 'กาแฟ', mw: '杯' },
  { noun: '茶', py: 'chá', th: 'ชา', mw: '杯' },
  { noun: '水', py: 'shuǐ', th: 'น้ำ', mw: '杯' },
  { noun: '奶茶', py: 'nǎichá', th: 'ชานม', mw: '杯' },
  { noun: '牛奶', py: 'niúnǎi', th: 'นมสด', mw: '杯' },
  { noun: '衣服', py: 'yīfu', th: 'เสื้อผ้า', mw: '件' },
  { noun: '衬衫', py: 'chènshān', th: 'เสื้อเชิ้ต', mw: '件' },
  { noun: '外套', py: 'wàitào', th: 'เสื้อคลุม', mw: '件' },
  { noun: '事情', py: 'shìqing', th: 'เรื่องราว / ธุระ', mw: '件' },
  { noun: '裤子', py: 'kùzi', th: 'กางเกง', mw: '条' },
  { noun: '裙子', py: 'qúnzi', th: 'กระโปรง', mw: '条' },
  { noun: '鱼', py: 'yú', th: 'ปลา', mw: '条' },
  { noun: '路', py: 'lù', th: 'ถนน', mw: '条' },
  { noun: '河', py: 'hé', th: 'แม่น้ำ', mw: '条' },
  { noun: '汽车', py: 'qìchē', th: 'รถยนต์', mw: '辆' },
  { noun: '自行车', py: 'zìxíngchē', th: 'จักรยาน', mw: '辆' },
  { noun: '出租车', py: 'chūzūchē', th: 'รถแท็กซี่', mw: '辆' },
  { noun: '老师', py: 'lǎoshī', th: 'คุณครู (สุภาพ)', mw: '位' },
  { noun: '客人', py: 'kèrén', th: 'แขก / ลูกค้า (สุภาพ)', mw: '位' },
  { noun: '医生', py: 'yīshēng', th: 'คุณหมอ (สุภาพ)', mw: '位' },
  { noun: '鞋', py: 'xié', th: 'รองเท้า', mw: '双' },
  { noun: '筷子', py: 'kuàizi', th: 'ตะเกียบ', mw: '双' },
  { noun: '袜子', py: 'wàzi', th: 'ถุงเท้า', mw: '双' },
  { noun: '笔', py: 'bǐ', th: 'ปากกา', mw: '支' },
  { noun: '矿泉水', py: 'kuàngquánshuǐ', th: 'น้ำแร่ (ขวด)', mw: '瓶' }
];

export const TONE_BUBBLE_SETS = [
  {
    base: 'ma',
    tones: [
      { tone: 1, py: 'mā', zh: '妈', th: 'แม่' },
      { tone: 2, py: 'má', zh: '麻', th: 'ป่าน / ชา' },
      { tone: 3, py: 'mǎ', zh: '马', th: 'ม้า' },
      { tone: 4, py: 'mà', zh: '骂', th: 'ดุ / ด่า' }
    ]
  },
  {
    base: 'ba',
    tones: [
      { tone: 1, py: 'bā', zh: '八', th: 'แปด' },
      { tone: 2, py: 'bá', zh: '拔', th: 'ถอน' },
      { tone: 3, py: 'bǎ', zh: '把', th: 'จับ' },
      { tone: 4, py: 'bà', zh: '爸', th: 'พ่อ' }
    ]
  },
  {
    base: 'shi',
    tones: [
      { tone: 1, py: 'shī', zh: '师', th: 'อาจารย์' },
      { tone: 2, py: 'shí', zh: '十', th: 'สิบ' },
      { tone: 3, py: 'shǐ', zh: '史', th: 'ประวัติศาสตร์' },
      { tone: 4, py: 'shì', zh: '是', th: 'เป็น / คือ' }
    ]
  },
  {
    base: 'yi',
    tones: [
      { tone: 1, py: 'yī', zh: '一', th: 'หนึ่ง' },
      { tone: 2, py: 'yí', zh: '姨', th: 'น้าสาว' },
      { tone: 3, py: 'yǐ', zh: '椅', th: 'เก้าอี้' },
      { tone: 4, py: 'yì', zh: '亿', th: 'ร้อยล้าน' }
    ]
  },
  {
    base: 'tang',
    tones: [
      { tone: 1, py: 'tāng', zh: '汤', th: 'ซุป' },
      { tone: 2, py: 'táng', zh: '糖', th: 'น้ำตาล / ลูกอม' },
      { tone: 3, py: 'tǎng', zh: '躺', th: 'นอนราบ' },
      { tone: 4, py: 'tàng', zh: '烫', th: 'ร้อนลวก' }
    ]
  },
  {
    base: 'mai',
    tones: [
      { tone: 1, py: 'māi', zh: '咪', th: 'เสียงเรียก' },
      { tone: 2, py: 'mái', zh: '埋', th: 'ฝัง' },
      { tone: 3, py: 'mǎi', zh: '买', th: 'ซื้อ' },
      { tone: 4, py: 'mài', zh: '卖', th: 'ขาย' }
    ]
  },
  {
    base: 'wen',
    tones: [
      { tone: 1, py: 'wēn', zh: '温', th: 'อุ่น' },
      { tone: 2, py: 'wén', zh: '文', th: 'อักษร / บทความ' },
      { tone: 3, py: 'wěn', zh: '吻', th: 'จูบ' },
      { tone: 4, py: 'wèn', zh: '问', th: 'ถาม' }
    ]
  },
  {
    base: 'shu',
    tones: [
      { tone: 1, py: 'shū', zh: '书', th: 'หนังสือ' },
      { tone: 2, py: 'shú', zh: '熟', th: 'สุก / คุ้นเคย' },
      { tone: 3, py: 'shǔ', zh: '数', th: 'นับ' },
      { tone: 4, py: 'shù', zh: '树', th: 'ต้นไม้' }
    ]
  },
  {
    base: 'hua',
    tones: [
      { tone: 1, py: 'huā', zh: '花', th: 'ดอกไม้' },
      { tone: 2, py: 'huá', zh: '滑', th: 'ลื่น' },
      { tone: 3, py: 'huǎ', zh: '华', th: 'งดงาม' },
      { tone: 4, py: 'huà', zh: '画', th: 'วาดภาพ' }
    ]
  },
  {
    base: 'fang',
    tones: [
      { tone: 1, py: 'fāng', zh: '方', th: 'ทิศ / สี่เหลี่ยม' },
      { tone: 2, py: 'fáng', zh: '房', th: 'ห้อง / บ้าน' },
      { tone: 3, py: 'fǎng', zh: '访', th: 'เยี่ยมเยือน' },
      { tone: 4, py: 'fàng', zh: '放', th: 'วาง / ปล่อย' }
    ]
  }
];

export const SPRINT_FALLBACK_VOCAB = [
  { zh: '你好', py: 'nǐ hǎo', th: 'สวัสดี' },
  { zh: '谢谢', py: 'xièxie', th: 'ขอบคุณ' },
  { zh: '再见', py: 'zàijiàn', th: 'ลาก่อน' },
  { zh: '对不起', py: 'duìbuqǐ', th: 'ขอโทษ' },
  { zh: '没关系', py: 'méi guānxi', th: 'ไม่เป็นไร' },
  { zh: '喜欢', py: 'xǐhuan', th: 'ชอบ' },
  { zh: '朋友', py: 'péngyou', th: 'เพื่อน' },
  { zh: '老师', py: 'lǎoshī', th: 'คุณครู' },
  { zh: '学生', py: 'xuésheng', th: 'นักเรียน' },
  { zh: '中国', py: 'Zhōngguó', th: 'ประเทศจีน' },
  { zh: '泰国', py: 'Tàiguó', th: 'ประเทศไทย' },
  { zh: '今天', py: 'jīntiān', th: 'วันนี้' },
  { zh: '明天', py: 'míngtiān', th: 'พรุ่งนี้' },
  { zh: '昨天', py: 'zuótiān', th: 'เมื่อวาน' },
  { zh: '现在', py: 'xiànzài', th: 'ตอนนี้' },
  { zh: '高兴', py: 'gāoxìng', th: 'ดีใจ' },
  { zh: '漂亮', py: 'piàoliang', th: 'สวย' },
  { zh: '好吃', py: 'hǎochī', th: 'อร่อย' },
  { zh: '便宜', py: 'piányi', th: 'ราคาถูก' },
  { zh: '天气', py: 'tiānqì', th: 'สภาพอากาศ' },
  { zh: '下雨', py: 'xiàyǔ', th: 'ฝนตก' },
  { zh: '咖啡', py: 'kāfēi', th: 'กาแฟ' },
  { zh: '米饭', py: 'mǐfàn', th: 'ข้าวสวย' },
  { zh: '水果', py: 'shuǐguǒ', th: 'ผลไม้' },
  { zh: '电影', py: 'diànyǐng', th: 'ภาพยนตร์' },
  { zh: '音乐', py: 'yīnyuè', th: 'ดนตรี' },
  { zh: '医院', py: 'yīyuàn', th: 'โรงพยาบาล' },
  { zh: '地铁', py: 'dìtiě', th: 'รถไฟใต้ดิน' },
  { zh: '手机', py: 'shǒujī', th: 'โทรศัพท์มือถือ' },
  { zh: '电脑', py: 'diànnǎo', th: 'คอมพิวเตอร์' },
  { zh: '工作', py: 'gōngzuò', th: 'ทำงาน' },
  { zh: '学习', py: 'xuéxí', th: 'เรียน / ศึกษา' },
  { zh: '休息', py: 'xiūxi', th: 'พักผ่อน' },
  { zh: '准备', py: 'zhǔnbèi', th: 'เตรียมตัว' },
  { zh: '帮助', py: 'bāngzhù', th: 'ช่วยเหลือ' },
  { zh: '希望', py: 'xīwàng', th: 'หวังว่า' }
];
