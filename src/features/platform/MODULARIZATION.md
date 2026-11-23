# แผนการแยกโมดูล `src/app.js` (Modularization Plan · #35)

ปัจจุบัน `src/app.js` มีความยาว **8,903 บรรทัด** รวมทั้ง Core Runtime, State, Audio/TTS, Auth/Cloud Sync และ UI ของทุกแท็บไว้ในไฟล์เดียว
เอกสารนี้เสนอแผนการแยกโค้ดออกเป็นโมดูลย่อยทีละแท็บ โดยใช้ `window.NihaoCore` ที่มีอยู่แล้วเป็นสะพานเชื่อม (Bridge) เพื่อให้แยกได้อย่างปลอดภัยโดยไม่กระทบผู้ใช้

---

## 1. สถาปัตยกรรมเป้าหมาย

```text
src/
  core/
    state.js        # state, loadProgress, saveProgress, getExt/setExt
    audio.js        # getTtsBlobUrl, playServerTts, speak, speakThai, playChime
    gamification.js # computeGameStats, addXp, updateDashboard, confetti, panda
    auth-sync.js    # Netlify Identity, openAuthModal, cloud sync
    router.js       # switchTab, registerTab, event bus (on/emit)
  tabs/
    pinyin.js       # initials, finals, tones, chart, combiner
    writing.js      # hanzi-writer + freehand canvas
    practice.js     # toneDrill, pairDrill, speakingDrill, weakspot, typing, mastery
    vocab.js        # vocab bank, SRS, quiz, games, podcast, story, confusable, stats
    plan.js         # 14-day plan + 60-min timer + daily quiz
    profile.js      # profile page + skill radar SVG + world roadmap
    srs-arcade.js   # SRS flashcards, dialogues, speed match, hanzi rain
    level2.js       # sentence builder, readers, radicals, culture, grammar, HSK1
    tutor-mock.js   # conversation tutor + HSK 1 mock exam
  features/         # feature plugins (platform, motivation, lesson-path, ...)
  app.js            # thin bootstrapper (< 250 lines)
```

---

## 2. แผนที่ฟังก์ชัน → โมดูล (Function-to-Module Mapping)

| โมดูลเป้าหมาย | ช่วงบรรทัดใน `src/app.js` | ฟังก์ชันหลักที่จะย้าย |
|---|---|---|
| `src/core/audio.js` | L49–108, L357–546 | `playChime`, `getTtsBlobUrl`, `playServerTts`, `speak`, `speakThai`, `stopSpeech` |
| `src/core/state.js` | L110–356 | `state`, `loadProgress`, `saveProgress`, `getExt`, `setExt`, `recordMistake` |
| `src/core/gamification.js` | L583–750, L8077–8265 | `computeGameStats`, `updateDashboard`, `renderPandaSprite`, `pandaSay`, `spawnConfetti` |
| `src/tabs/pinyin.js` | L799–1327 | `renderArticulationSVG`, `renderInitials`, `renderInitialInspector`, `renderFinals`, `renderTones`, `renderToneSets`, `renderPinyinChart`, `renderChartInspector`, `renderCombiner` |
| `src/tabs/writing.js` | L1328–1546 | `renderWritingStatic`, `renderWritingPicker`, `loadWritingCharacter`, `setupFreehandCanvas` |
| `src/tabs/practice.js` | L1547–2037, L6253–6345, L7830–7917 | `initPracticeSelectors`, `renderToneDrill`, `renderPairDrill`, `renderSpeakingDrill`, `renderMasteryQuiz`, `renderWeakSpotDrill`, `renderTypingDrill` |
| `src/tabs/vocab.js` | L2038–5235 | `renderVocab`, `renderVocabBank`, `renderVocabBankResults`, `renderVocabPodcast`, `renderVocabStats`, `renderVocabConfusable` (~3,200 บรรทัด — ใหญ่ที่สุด) |
| `src/tabs/plan.js` | L5236–5625 | `updateTimerDisplay`, `renderDailyPlan`, `renderDailyMain`, `renderDailyQuizCard` |
| `src/tabs/profile.js` | L5626–6252 | `renderSkillRadarSVG`, `renderProfilePage` |
| `src/tabs/srs-arcade.js` | L6346–6973 | `renderSrsPage`, `renderDialogues`, `renderPodcastPlayer`, `buildSpeedBoard`, `renderSpeedGame`, `renderHanziRain` |
| `src/tabs/level2.js` | L6974–7405 | `renderLevel2Page` |
| `src/tabs/tutor-mock.js` | L7406–7829, L7918–8076 | `renderTutorPage`, `renderMockExamPage` |
| `src/core/auth-sync.js` | L8373–8407, L8544–8856 | `updateAuthButton`, `openAuthModal`, cloud sync handlers |

---

## 3. ลำดับการแยกที่ปลอดภัย (Extraction Order)

1. **เฟส 1 — แท็บที่พึ่งพาต่ำ (Low-coupling tabs):** เริ่มจาก `tabs/tutor-mock.js`, `tabs/level2.js`, `tabs/srs-arcade.js` โดยให้แต่ละโมดูลรับ `core` (`window.NihaoCore`) และ export `renderX()` แล้วเรียกจาก `switchTab()` ใน `app.js`
2. **เฟส 2 — แท็บพินอินและฝึกเขียน:** แยก `tabs/pinyin.js` และ `tabs/writing.js` (ใช้ `core.data.DATA`, `core.data.CHART`, `core.data.WS`, `core.speak`)
3. **เฟส 3 — แท็บแผนเรียน โปรไฟล์ และแบบฝึกหัด:** แยก `tabs/plan.js`, `tabs/profile.js`, `tabs/practice.js`
4. **เฟส 4 — คลังคำศัพท์ขนาดใหญ่ (`tabs/vocab.js`):** แตกย่อยอีกชั้นเป็น `vocab-bank.js`, `vocab-srs.js`, `vocab-quiz.js`, `vocab-story.js` เนื่องจากมีขนาดกว่า 3,200 บรรทัด และเปิดใช้ Dynamic `import()` เมื่อเปิดแท็บ `vocab`
5. **เฟส 5 — Core Modules & Lazy Data Packs:** แยก `core/audio.js`, `core/state.js`, `core/auth-sync.js` และเปลี่ยน data packs รอง (`pro-pack-data.js`, `fun-pack-data.js`, `level2-hsk1-data.js`) ให้โหลดแบบ lazy เมื่อเข้าแท็บที่ใช้งาน

---

## 4. เกณฑ์ตรวจสอบหลังแยกแต่ละเฟส

- `vite build` ผ่านและสร้าง chunk แยกตามแท็บ (Code Splitting)
- `node --test` ผ่านครบทุกชุดทดสอบ
- สัญญา `window.NihaoCore` คงเดิม 100% เพื่อให้ปลั๊กอินใน `src/features/*` ทำงานได้โดยไม่ต้องแก้โค้ด
