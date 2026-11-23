# 🗺️ Product Roadmap — 你好 Nihao Chinese Learning Platform

- **Production URL (Firebase Hosting CDN):** https://nihao-chinese.web.app
- **Backend URL (Google Cloud Run · `asia-southeast1`):** https://nihao-learning-425130719927.asia-southeast1.run.app
- **Cloud Stack:** Google Cloud Run + Vertex AI (Gemini) + Cloud Firestore + Cloud Text-to-Speech (Neural2/Wavenet) + Firebase Auth (Google Sign-In) + Firebase Hosting

---

## ✅ v1.0 — สิ่งที่สร้างและเปิดใช้งานแล้ว (Completed)

1. **🌱 Month-1 Starter Pack (`src/features/month1/`)**
   - ปุ่ม **"▶ เริ่มเรียนวันนี้ (15 นาที)"** 3 ขั้นตอนอัตโนมัติ (Warm-up → 20 Tone Pairs → Speak 5 Survival Sentences) + โหมดผู้เริ่มต้นซ่อนเมนูขั้นสูง
   - แผนเรียน 30 วัน (Day 1–30 · 0 → HSK 1)
   - 20 คู่วรรณยุกต์ (Tone Pairs Mastery) + ด่านซ่อมกับดักเสียงคนไทย (`zh/z`, `ch/c`, `sh/s`, `j/q/x`, `ü/u`, กฎผัน `不/一/3+3`)
   - 64 ภาพจำตัวอักษรจีนเดือนแรก (Thai Visual Mnemonics) + ลำดับขีด `HanziWriter`
   - 50 ประโยคเอาตัวรอด 5 หมวด พร้อมเสียงช้า `0.6x`
   - พจนานุกรมค้นด่วนในตัว (กด `/` จากทุกหน้า)
2. **📝 สมุดคัดลายมือจีน (`src/features/month1/copybook.js`)**
   - ตารางสมุดคัด **米字格 (8 ทิศ)** และ **田字格 (4 ช่อง)** แบบหลายช่องต่อแถว
   - รอยประลากตาม, เลือกสีหมึก, รองรับ Apple Pencil / Stylus / นิ้ว / เมาส์, พิมพ์ตัวจีนเองได้, และสั่งพิมพ์ลงกระดาษ A4 ได้
3. **🎙️ Speak Studio (`src/features/speak-studio/`)**
   - AI Roleplay 10 สถานการณ์ + เป้าหมาย 3 ข้อ + Hint 3 ระดับ
   - Free Talk โหมดเสียงล้วน + สรุปฟีดแบ็กหลังคุยจบ
   - Shadowing 42 ประโยค + คะแนนรายพยางค์ (เขียว/เหลือง/แดง) + ถามครูกลางบทเรียน + กราฟเส้นวรรณยุกต์ (Tone Graph) + Smart Review
4. **🗺️ เส้นทางบทเรียน (`src/features/lesson-path/`)**
   - Skill Tree 10 บท (HSK 1–2) + Checkpoint ข้ามด่าน + Lesson Engine แบบฝึกผสม
   - Dictation ฟังแล้วพิมพ์ + Grammar Cards 20+ เรื่อง + Placement Test + Goal Onboarding
5. **🎮 เกม & อ่านจีน (`src/features/games-reading/`)**
   - 4 มินิเกมใหม่ (Word Sprint, Tone Bubble, Radical Builder, Measure-word Match)
   - Graded Stories + Karaoke Read-along + Immersive Mini-Drama + Podcast Transcript + การ์ดวัฒนธรรมจีนรายวัน
6. **🔥 ภารกิจ & ลีก (`src/features/motivation/`)**
   - Mistake Book, Notebook (Export CSV/Anki TSV), Streak Repair, Hearts, Combo Multiplier, Daily Goal Ring, ใบประกาศ PNG, Monthly Recap, AI Study Plan, Weakness Dashboard
7. **⚔️ Multiplayer Arena & Live Social (`src/features/arena/`)**
   - ห้องดวล 1v1 / Party รหัส 6 หลัก (`?duel=CODE`) แข่งโจทย์ชุดเดียวกัน 10 ข้อพร้อมโบนัสความไว
   - Live Firestore Leaderboard (Weekly XP / Streak / Speed Match) + ปุ่มส่งกำลังใจ 👏
   - Study Squad (เป้าหมายกลุ่ม 2,000 XP/สัปดาห์) + Live Activity Feed
   - แต่งตัวอวตารน้องเป่าเปา + ฉายาพิเศษ
8. **⚙️ ระบบกลาง & หลายภาษา (`src/features/platform/`)**
   - ปุ่มสลับภาษา **`🇹🇭 TH / 🇬🇧 EN`** + AI ตอบเป็นภาษาอังกฤษเมื่ออยู่ในโหมด EN
   - Global Display Toggle (พินอิน+จีน / จีนล้วน / พินอินล้วน / Character Mode), Word of the Day, Haptics + SFX, Study Reminders, Offline Audio Pack

---

## 🔥 เฟส 1: Viral & Daily Hook (สัปดาห์ที่ 1–2 ถัดไป)

- [ ] **1.1 การ์ดแชร์ผลดวล & ใบคะแนน (Shareable Battle Card PNG):** ชนะห้องดวล 1v1 หรือจบ Day 30 แล้วสร้างรูป PNG สวยๆ พร้อมรหัสห้อง `?duel=CODE` แชร์ลง IG Story / LINE ท้าเพื่อนต่อได้ทันที
- [ ] **1.2 AI ตรวจลายมือจากสมุดคัด (AI Handwriting Grader):** ส่งภาพจากตาราง `📝 สมุดคัดลายมือ` ให้ **Gemini Vision** วิเคราะห์สัดส่วนความสมดุลของตัวอักษร ให้เกรด A/B/C และแนะนำจุดแก้รายตัว
- [ ] **1.3 Boss Raid รายสัปดาห์ (Co-op Raid):** บอสมังกรคำศัพท์ประจำสุดสัปดาห์ เลือด 50,000 HP ให้สมาชิกใน Study Squad และผู้เล่นทั้งเว็บช่วยกันตอบคำถามตีบอส แจกสกินและฉายาแรร์
- [ ] **1.4 ขยายคำแปลภาษาอังกฤษ (EN) ครบ 100% ทุกบทเรียน:** ให้เนื้อหาในบทเรียนและการ์ดไวยากรณ์ทุกหน้ารองรับผู้เรียนต่างชาติเต็มรูปแบบ

---

## 🧠 เฟส 2: Real-World Immersion & HSK 2–3 (เดือนที่ 2)

- [ ] **2.1 โหมดเรียนจากเพลงจีน & ซับซีรีส์ (Import Any Chinese Text / Lyrics):** วางเนื้อเพลงหรือบทความจีน → เว็บตัดคำ + ใส่พินอิน + แตะแปล + สร้างชุดการ์ด SRS และสร้างห้องดวลจากบทความนั้นได้ทันที
- [ ] **2.2 พจนานุกรมวาดมือค้นศัพท์ (Handwriting Recognition ใน `/`):** วาดตัวจีนที่ไม่รู้พินอินลงในช่องค้นหา `/` ด้วยนิ้วหรือ Apple Pencil เพื่อค้นหาตัวอักษรและคำแปล (แบบ Pleco)
- [ ] **2.3 โทรคุยเสียงสดกับครู AI (Real-Time Voice Call):** โหมดสนทนาต่อเนื่องโดยไม่ต้องกดปุ่มค้าง มีซับไตเติลขึ้นสดและสรุปคำศัพท์ใหม่หลังวางสาย
- [ ] **2.4 แผนเรียนเดือนที่ 2–3 (Day 31–90 · HSK 2 → HSK 3):** ขยายหลักสูตรสู่ 600 คำ, ไวยากรณ์ระดับกลาง (`把`, `被`, กริยาบอกทิศทาง `趋向补语`, คำเชื่อมคู่) และแบบฝึกแยกคำสับสน (`或者 vs 还是`, `刚才 vs 刚刚`, `终于 vs 最后`)

---

## 🏆 เฟส 3: Multiplayer Seasons & Classroom Mode (เดือนที่ 3)

- [ ] **3.1 ระบบ Season Pass & สายทัวร์นาเมนต์ (8-Player Bracket):** จัดอันดับประจำเดือน ปลดล็อกของแต่งน้องเป่าเปาตามระดับ Season และโหมดแข่งแพ้คัดออก
- [ ] **3.2 โหมดห้องเรียน / ครูผู้สอน (Teacher & Classroom Dashboard):** สร้างห้องเรียน สั่งการบ้านรายสัปดาห์ (เช่น คัดลายมือ 10 ตัว + ดวลคำศัพท์ 1 รอบ) พร้อมตารางตรวจงานอัตโนมัติ
- [ ] **3.3 มินิเกมดวลใหม่ในห้อง 6 หลัก:**
  - **Tone Sniper:** แข่งฟังเสียงเร็วแล้วแย่งกดวรรณยุกต์
  - **Hanzi Speed Draw:** แข่งเขียนตัวอักษรตามคำแปล ใครถูกลำดับขีดและไวกว่าชนะ

---

## 🎓 เฟส 4: HSK 4 Mastery & สนามสอบจริง (เดือนที่ 4–6)

- [ ] **4.1 หลักสูตร HSK 4 ครบ 1,200 คำ + ผังรากศัพท์ครบทุกตัว:** ขยายคลังภาพจำ (Mnemonics) และตารางคัดลายมือครอบคลุม HSK 1–4 ทั้งหมด
- [ ] **4.2 ศูนย์สอบจำลอง HSK 2–4 & สอบพูด HSKK เต็มรูปแบบ:** ครบทั้งฟัง อ่าน และ **พาร์ทเขียนเรียงประโยค / แต่งประโยคจากรูปภาพ** ที่ตรวจให้คะแนนตามเกณฑ์จริงด้วย Vertex AI
- [ ] **4.3 อัปเกรดระบบทบทวนเป็น FSRS (Free Spaced Repetition Scheduler):** คำนวณความจำแม่นยำขึ้น ลดจำนวนการ์ดทบทวนต่อวันลง ~25% เมื่อคำศัพท์เกิน 1,000 คำ
