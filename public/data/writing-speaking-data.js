// Phase 1: Writing Studio (8 Basic Strokes + 32 Level 1 Characters) & Speaking Lab Data
window.WRITING_SPEAKING_DATA = {
  basicStrokes: [
    {
      name: '横 (Héng)',
      thai: 'ขีดขวาง',
      dir: 'ลากจากซ้าย → ไปขวา เฉียงขึ้นเล็กน้อย',
      example: '一, 二, 三, 十',
      path: 'M 18 52 L 82 48',
      start: [18, 52],
      arrow: 'M 75 43 L 83 48 L 76 54'
    },
    {
      name: '竖 (Shù)',
      thai: 'ขีดตั้ง',
      dir: 'ลากตรงจากบน ↓ ลงล่าง',
      example: '十, 中, 山, 木',
      path: 'M 50 16 L 50 84',
      start: [50, 16],
      arrow: 'M 44 77 L 50 85 L 56 77'
    },
    {
      name: '撇 (Piě)',
      thai: 'ขีดตวัดซ้าย',
      dir: 'ลากโค้งจากบนขวา ↙ ลงล่างซ้าย (ปลายเรียว)',
      example: '人, 八, 大, 你',
      path: 'M 68 18 Q 58 56 24 82',
      start: [68, 18],
      arrow: 'M 25 73 L 23 83 L 33 81'
    },
    {
      name: '捺 (Nà)',
      thai: 'ขีดตวัดขวา',
      dir: 'ลากจากบนซ้าย ↘ ลงล่างขวา กดหนักแล้วปล่อยปลาย',
      example: '人, 大, 木, 天',
      path: 'M 28 20 Q 48 56 80 80',
      start: [28, 20],
      arrow: 'M 71 80 L 81 81 L 78 71'
    },
    {
      name: '点 (Diǎn)',
      thai: 'ขีดแต้ม / จุด',
      dir: 'แต้มสั้นๆ จากบนซ้ายลงล่างขวา',
      example: '六, 主, 火, 小',
      path: 'M 42 36 Q 52 48 58 64',
      start: [42, 36],
      arrow: 'M 51 60 L 58 65 L 61 56'
    },
    {
      name: '提 (Tí)',
      thai: 'ขีดตวัดขึ้น',
      dir: 'กดจากล่างซ้าย ↗ ตวัดเร็วขึ้นบนขวา',
      example: '我, 打, 江, 冰',
      path: 'M 24 68 L 76 34',
      start: [24, 68],
      arrow: 'M 68 33 L 77 33 L 73 42'
    },
    {
      name: '折 (Zhé)',
      thai: 'ขีดหักมุม',
      dir: 'ลากขวางแล้วหักลงล่างโดยไม่ยกปากกา (นับเป็น 1 ขีด)',
      example: '口, 日, 四, 五',
      path: 'M 24 28 L 72 28 L 72 76',
      start: [24, 28],
      arrow: 'M 66 69 L 72 77 L 78 69'
    },
    {
      name: '钩 (Gōu)',
      thai: 'ขีดตะขอ',
      dir: 'ลากลงตรงๆ แล้วตวัดปลายเป็นตะขอขึ้นด้านซ้าย',
      example: '小, 水, 你, 手',
      path: 'M 54 18 L 54 78 L 36 66',
      start: [54, 18],
      arrow: 'M 38 74 L 35 65 L 44 65'
    }
  ],

  strokeRules: [
    { num: '1', title: 'ขวางก่อน ตั้งทีหลัง (先横后竖)', example: 'เช่น 十 (สิบ): ลาก 一 ก่อน แล้วค่อยลาก 丨' },
    { num: '2', title: 'บนลงล่าง (从上到下)', example: 'เช่น 三 (สาม): ลากเส้นบน → กลาง → ล่าง' },
    { num: '3', title: 'ซ้ายไปขวา (从左到右)', example: 'เช่น 你 (คุณ): เขียนซีกซ้าย 亻 ก่อน แล้วค่อยเขียนขวา 尔' },
    { num: '4', title: 'นอกก่อนใน แล้วค่อยปิดกล่อง (先外后内再封口)', example: 'เช่น 日, 国: วาดกรอบซ้าย-บน-ขวา → ใส่ไส้ใน → ปิดเส้นล่างสุดท้าย' }
  ],

  writingChars: [
    { char: '一', pinyin: 'yī', meaning: 'หนึ่ง (1)', strokes: 1, tip: 'ขีดขวาง 1 เส้นตรง ลากจากซ้ายไปขวา' },
    { char: '二', pinyin: 'èr', meaning: 'สอง (2)', strokes: 2, tip: 'เส้นบนสั้นกว่า เส้นล่างยาวกว่า' },
    { char: '人', pinyin: 'rén', meaning: 'คน', strokes: 2, tip: 'ตวัดซ้าย (撇) ก่อน แล้วค่อยตวัดขวา (捺)' },
    { char: '八', pinyin: 'bā', meaning: 'แปด (8)', strokes: 2, tip: 'คล้าย 人 แต่แยกด้านบนออกจากกัน' },
    { char: '十', pinyin: 'shí', meaning: 'สิบ (10)', strokes: 2, tip: 'ขวางก่อน แล้วค่อยตั้งตรงกลาง' },
    { char: '三', pinyin: 'sān', meaning: 'สาม (3)', strokes: 3, tip: 'บนลงล่าง เส้นกลางสั้นสุด เส้นล่างยาวสุด' },
    { char: '大', pinyin: 'dà', meaning: 'ใหญ่', strokes: 3, tip: 'เหมือนคน (人) กางแขนออกกว้างๆ' },
    { char: '小', pinyin: 'xiǎo', meaning: 'เล็ก', strokes: 3, tip: 'ลากขีดกลางมีตะขอก่อน แล้วค่อยแต้มซ้าย-ขวา' },
    { char: '口', pinyin: 'kǒu', meaning: 'ปาก', strokes: 3, tip: 'ตั้งซ้าย → หักมุมบนขวา → ปิดเส้นล่าง' },
    { char: '山', pinyin: 'shān', meaning: 'ภูเขา', strokes: 3, tip: 'ลากยอดเขากลางก่อน แล้วค่อยวาดฐานซ้าย-ขวา' },
    { char: '女', pinyin: 'nǚ', meaning: 'ผู้หญิง', strokes: 3, tip: 'หักเฉียงก่อน → ตวัดซ้าย → ปิดด้วยขีดขวาง' },
    { char: '日', pinyin: 'rì', meaning: 'วัน / อาทิตย์', strokes: 4, tip: 'วาดกรอบนอก → ใส่ขีดกลาง → ปิดเส้นล่าง' },
    { char: '月', pinyin: 'yuè', meaning: 'เดือน / พระจันทร์', strokes: 4, tip: 'คล้ายพระจันทร์เสี้ยว ใส่ขีดขวาง 2 เส้นข้างใน' },
    { char: '水', pinyin: 'shuǐ', meaning: 'น้ำ', strokes: 4, tip: 'ลากแกนกลางมีตะขอก่อน แล้วค่อยซ้าย-ขวา' },
    { char: '五', pinyin: 'wǔ', meaning: 'ห้า (5)', strokes: 4, tip: 'ขวางบน → ตั้งเอียง → หักมุม → ขวางล่างปิดฐาน' },
    { char: '六', pinyin: 'liù', meaning: 'หก (6)', strokes: 4, tip: 'แต้มจุดบน → ขวาง → ตวัดซ้าย → แต้มขวา' },
    { char: '七', pinyin: 'qī', meaning: 'เจ็ด (7)', strokes: 2, tip: 'ขวางเฉียงขึ้น → ตั้งโค้งงอขวา' },
    { char: '九', pinyin: 'jiǔ', meaning: 'เก้า (9)', strokes: 2, tip: 'ตวัดซ้ายก่อน → หักโค้งงอขึ้นตะขอ' },
    { char: '四', pinyin: 'sì', meaning: 'สี่ (4)', strokes: 5, tip: 'กรอบนอก → ใส่ไส้ 2 ขีดข้างใน → ปิดเส้นล่าง' },
    { char: '中', pinyin: 'zhōng', meaning: 'กลาง / จีน', strokes: 4, tip: 'วาดสี่เหลี่ยม 口 ก่อน แล้วแทงเส้นตั้งผ่ากลางสุดท้าย' },
    { char: '他', pinyin: 'tā', meaning: 'เขา (ผู้ชาย)', strokes: 5, tip: 'หมวดคน 亻 ด้านซ้าย + 也 ด้านขวา' },
    { char: '好', pinyin: 'hǎo', meaning: 'ดี', strokes: 6, tip: '女 (ผู้หญิง) + 子 (ลูก) อยู่ด้วยกัน = ดี' },
    { char: '妈', pinyin: 'mā', meaning: 'แม่', strokes: 6, tip: '女 (ผู้หญิง) บอกความหมาย + 马 (ม้า) บอกเสียง' },
    { char: '吃', pinyin: 'chī', meaning: 'กิน', strokes: 6, tip: 'เริ่มด้วยหมวดปาก 口 ด้านซ้าย (เกี่ยวกับการกิน)' },
    { char: '你', pinyin: 'nǐ', meaning: 'คุณ', strokes: 7, tip: 'เขียนหมวดคน 亻 ซ้ายก่อน แล้วค่อยเขียน 尔 ด้านขวา' },
    { char: '我', pinyin: 'wǒ', meaning: 'ฉัน', strokes: 7, tip: 'คำสำคัญมาก! ลองฝึกตามแอนิเมชัน 2-3 รอบจะจำได้แม่น' },
    { char: '爸', pinyin: 'bà', meaning: 'พ่อ', strokes: 8, tip: '父 ด้านบน + 巴 ด้านล่าง' },
    { char: '国', pinyin: 'guó', meaning: 'ประเทศ', strokes: 8, tip: 'วาดกรอบนอก 囗 → เขียน 玉 (หยก) ข้างใน → ปิดเส้นล่าง' },
    { char: '学', pinyin: 'xué', meaning: 'เรียน', strokes: 8, tip: 'แต้ม 3 จุดบน → หลังคา 冖 → 子 (เด็ก) อยู่ข้างใต้' },
    { char: '茶', pinyin: 'chá', meaning: 'ชา', strokes: 9, tip: 'บนสุดคือหมวดพืช 艹 + คน 人 + ต้นไม้ 木' },
    { char: '爱', pinyin: 'ài', meaning: 'รัก', strokes: 10, tip: 'เขียนจากบนลงล่างทีละชั้น จบด้วย 友 ด้านล่าง' },
    { char: '谢', pinyin: 'xiè', meaning: 'ขอบคุณ', strokes: 12, tip: 'แบ่ง 3 ส่วนจากซ้ายไปขวา: 讠 + 身 + 寸' }
  ],

  speakingChallenges: [
    { hanzi: '你好', pinyin: 'nǐ hǎo', meaning: 'สวัสดี', accept: ['你好', '您好'], focus: 'กฎเสียง 3 ชน 3 → ออกเสียง ní hǎo' },
    { hanzi: '谢谢', pinyin: 'xièxie', meaning: 'ขอบคุณ', accept: ['谢谢'], focus: 'กลุ่มยิ้ม x (ซ/ช) + พยางค์หลังเสียงเบา' },
    { hanzi: '再见', pinyin: 'zàijiàn', meaning: 'ลาก่อน', accept: ['再见'], focus: 'z ลิ้นแบน + j ยิ้มไม่พ่นลม' },
    { hanzi: '对不起', pinyin: 'duìbuqǐ', meaning: 'ขอโทษ', accept: ['对不起'], focus: 'd = ต ไม่พ่นลม, q = ช พ่นลม' },
    { hanzi: '爸爸', pinyin: 'bàba', meaning: 'คุณพ่อ', accept: ['爸爸'], focus: 'b = ป ไม่พ่นลม (ป้าปะ)' },
    { hanzi: '妈妈', pinyin: 'māma', meaning: 'คุณแม่', accept: ['妈妈'], focus: 'เสียง 1 สูงเรียบ + เสียงเบา' },
    { hanzi: '老师', pinyin: 'lǎoshī', meaning: 'คุณครู', accept: ['老师'], focus: 'sh ม้วนลิ้น + สระ อือ (ซือ)' },
    { hanzi: '朋友', pinyin: 'péngyou', meaning: 'เพื่อน', accept: ['朋友'], focus: 'p = พ พ่นลมแรง + แม่กง (-ng)' },
    { hanzi: '中国', pinyin: 'Zhōngguó', meaning: 'ประเทศจีน', accept: ['中国'], focus: 'zh ม้วนลิ้น + g (ก ไม่พ่นลม)' },
    { hanzi: '喝茶', pinyin: 'hē chá', meaning: 'ดื่มชา', accept: ['喝茶'], focus: 'e = เออ (เฮอ) + ch ม้วนลิ้นพ่นลม' },
    { hanzi: '吃饭', pinyin: 'chī fàn', meaning: 'กินข้าว', accept: ['吃饭'], focus: 'ch ม้วนลิ้นเสียง 1 + f เสียง 4' },
    { hanzi: '四', pinyin: 'sì', meaning: 'สี่ (4)', accept: ['四', '4', '是'], focus: 's ลิ้นแบน เสียง 4 (เทียบกับ 十)' },
    { hanzi: '十', pinyin: 'shí', meaning: 'สิบ (10)', accept: ['十', '10', '时', '实'], focus: 'sh ม้วนลิ้น เสียง 2 ขึ้นสูง' },
    { hanzi: '水', pinyin: 'shuǐ', meaning: 'น้ำ', accept: ['水'], focus: 'sh ม้วนลิ้น + ui เสียง 3 ลงลึก' },
    { hanzi: '苹果', pinyin: 'píngguǒ', meaning: 'แอปเปิล', accept: ['苹果'], focus: 'p พ่นลม + แม่กง -ng' },
    { hanzi: '我爱你', pinyin: 'wǒ ài nǐ', meaning: 'ฉันรักคุณ', accept: ['我爱你'], focus: 'เชื่อม 3 เสียง: 3 → 4 → 3' }
  ]
};
