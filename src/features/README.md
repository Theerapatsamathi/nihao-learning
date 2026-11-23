# Feature plugins (`src/features/*`)

`src/app.js` exposes `window.NihaoCore` and then lazily imports `src/features/index.js`,
which loads each feature group independently (`platform`, `motivation`, `lesson-path`,
`speak-studio`, `games-reading`). A crash in one group never breaks the others.

## Rules
- A group owns ONLY its folder `src/features/<group>/` (+ the backend files listed in its brief).
- Do **not** edit `src/app.js`, `index.html`, `src/styles.css` or other groups' folders.
  If you truly need a new core hook, message the coordinator.
- Styles: `import './style.css'` inside your group. Prefix every class with your group prefix
  (`pf-`, `mo-`, `lp-`, `ss-`, `gr-`) to avoid collisions. Reuse the design tokens from
  `src/styles.css` (`--sys-*` variables, `.btn-primary`, `.btn-secondary`, `.card-panel`, …) and
  support dark mode (`.theme-dark` on `html`/`.app-shell`).
- UI language: Thai, with Chinese (hanzi + tone-marked pinyin). Mobile-first (≥360px wide).
- Persist data only via `core.getExt(ns)` / `core.setExt(ns, patch, { save, reason })`.
  Use your group name as `ns` (sub-keys allowed). This syncs to the cloud automatically.
- Award XP only via `core.addXp(n, 'reason')` (keep it modest: 5–50 per activity).
- Every AI feature MUST work without AI too (offline/scripted fallback) and handle
  `401 AUTH_REQUIRED` (prompt `core.openAuthModal()`) and `429 RATE_LIMITED` gracefully.
- No new npm dependencies. No external CDNs (CSP is `default-src 'self'`).

## `window.NihaoCore` API
| member | notes |
|---|---|
| `state` | full app state; `state.progress` is the persisted progress object |
| `data.{DATA,CHART,WS,PLAN,ENG,L2,PRO,FUN}` | global data packs from `public/data/*.js` |
| `lexicon` / `ensureLexiconLoaded()` | big dictionary (lazy, ~1 MB) → `Promise<Array>` |
| `allVocabWords`, `allInitials`, `allFinals`, `tutorScenarios` | prebuilt lists |
| `todayKey(offset)`, `escapeHtml`, `applyToneMark`, `stripToneMarks`, `shuffleArray` | helpers |
| `speak(zh, onEnd)`, `speakThai(th, onEnd)`, `stopSpeech()` | TTS (server + Web Speech fallback) |
| `playChime('ok'/'err'/'levelup', noEvent?)` | SFX; ok/err also emit an `answer` event unless `noEvent` |
| `showToast(text, pts?, levelUp?)`, `spawnConfetti(n)`, `pandaSay(msg)` | feedback |
| `switchTab(id)`, `computeGameStats()`, `updateDashboard()` | navigation & stats (`{xp, level, streak, ...}`) |
| `recordMistake(item)`, `logActivity(units)`, `saveProgress(reason)`, `addXp(n, reason)` | progress |
| `getExt(ns)`, `setExt(ns, patchOrFn, {save=true, reason})` | namespaced persisted storage |
| `registerTab({id, label, title, desc, emoji, iconClass, badge, section, sectionTitle, render(host)})` | adds a sidebar nav button + page; `render(host)` runs every time the tab opens. Returns `{button, panel, host}` |
| `isSignedIn()`, `getUser()`, `openAuthModal()`, `aiStatus` | auth / AI availability (`aiStatus.configured`) |
| `on(event, fn)` → unsubscribe, `emit(event, detail)` | event bus |
| `api(path, body?, method='POST')` → `{ok, status, data}` | same-origin JSON fetch |

### Events
- `answer` `{correct}` — fired whenever any exercise in the app plays the ok/err chime.
- `progress` `{reason, xp, xpGained, level}` — after every `saveProgress`.
- `tab` `{tabId}` — after tab switch.
- `features-ready` — after all feature groups loaded.
- Groups may emit their own events, prefixed with the group name (e.g. `motivation:goal-met`).

## Backend
Netlify Functions in `netlify/functions/*.mjs` (path via `export const config = { path }`).
Reuse `netlify/functions/_lib/ai-helper.mjs` (`requireAuthAndRateLimit`, `generateStructuredJson`, `Type`).
DB migrations go to `netlify/database/migrations/<timestamp>_<name>.sql` (Postgres, `@netlify/database`).
