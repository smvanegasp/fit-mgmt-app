# AGENTS.md: Gym tracker

Read this first. It is the full context for continuing work in a new chat: what the app is, how
we work, what's done, how to run and test it, the rules that matter, and what's next. The
open work list and the staged plan live in **[docs/BACKLOG.md](docs/BACKLOG.md)**; keep both
files up to date. **[README.md](README.md)** is the public explanation; update it in the same PR
whenever the architecture, CI/CD, AWS or security story changes.

This app is a sibling of the pantry app (`C:\Users\smvan\repos\pantry-mgmt-app`,
<https://github.com/smvanegasp/pantry-mgmt-app>). **When in doubt, do it the way the pantry
does**: same stack, same structure, same conventions. Copy and adapt its files rather than
reinventing (its `AGENTS.md` explains each piece).

---

## 1. What this is

A mobile-first web app where Sergio logs their gym workouts and sees their progress.

- **Today** Sergio times sessions with the phone's stopwatch and logs workouts as messages in a
  WhatsApp chat with only themself. The app replaces both: a **built-in stopwatch** and a
  **structured log** (exercise, then sets of weight x reps, pre-filled from last time).
- **Progress:** consistency calendar and streaks, strength per exercise (top weight, estimated
  1RM, PRs), volume and session time, and how their routine evolved over time.
- **History import:** Sergio's full WhatsApp chat history is parsed (offline, once, by the agent)
  and written into the database with the real dates. The schema is shaped by what the chat
  contains.
- **Visitors** from sergiovanegas.com get a **private 24h guest copy** of Sergio's real training
  (the pantry's sandbox model): they can browse everything and try logging without touching
  Sergio's data. Sergio logs in as owner with a 6-digit passcode.
- **Every screen size, phone first** (Sergio, 2026-10-29). Sergio logs on the phone, so the
  phone is the primary design target, and Sergio likes the phone layout with bottom tabs. But
  visitors and reviewers will often open it on a computer, and there Sergio wants a
  **completely different experience, not the phone layout stretched**: a desktop dashboard
  designed on its own (stage 4c). Unlike the pantry, there is no "made for your phone" QR
  popup: desktop is a first-class way to view the app.
- **Exercise notes and photos:** Sergio photographs exercises and writes notes on how to do
  them and what they keep learning (cues, setup, machine settings). The chat contains these.
  Each exercise keeps a dated list of notes and photos (its "technique log"), shown on the
  exercise's page; a workout can also have notes and photos. Notes and photos are part of what
  guests see. **The log's main job is a concise checklist shown when Sergio starts that exercise
  while training**: the things that, if they do them, make the lift go better. Keep it short
  (one line per cue, newest wording only).
- **Everything in English** (Sergio insists): imported notes go through `private/note_translations.json`
  and cues through `cueTranslations`; never show Spanish in the UI (originals are stored, not shown).
- **Units:** pounds (lb). **One AI feature** (Sergio, 2026-10-30): the cue check. When a note is
  written on an exercise, gpt-oss-120b on Groq (`app/cue_check.py`) suggests adding a cue or
  rewording one, using only Sergio's words; nothing changes until they accept. It's off without
  `GROQ_API_KEY`. Decisions from stage 1 (2026-10-29): barbell weights
  are written as plates and the app adds a 45 lb bar for totals; weighted dips and chin-ups track
  only the added weight; exercise names are English (Spanish spellings are aliases; notes stay
  as written, mostly Spanish); **bouldering and treadmill runs are part of the app** alongside
  lifting.
- **Owner:** Sergio (GitHub `smvanegasp`). Repo <https://github.com/smvanegasp/fit-mgmt-app>
  (**public**). Target URL `https://gym.sergiovanegas.com`. Sergio develops on Windows 11 (Git
  Bash, VS Code, Node 24, uv, Docker Desktop, Terraform, ngrok).

## 2. How we work (follow this)

- **Small stages, each ending at a gate:** tests pass, the agent checks the UI in light and
  dark at **phone 390x844** (the main target), **tablet 820x1180** and **desktop 1440x900**,
  Sergio tests on their phone through ngrok, then a PR. **Don't
  start the next stage until Sergio is happy.** From stage 6b, merging deploys to production.
- **Plan first, then build:** for each new request, read the relevant code, propose the approach
  with a recommendation (ask with options only for real product choices), put it in
  `docs/BACKLOG.md`, then build. Docs (this file, backlog, README) change in the same PR.
- **Branch per stage** (`stage-<n><letter>-<slug>`), PR into `main`, PR body ends with the
  Claude Code attribution line. **Sergio merges PRs themself.** Small follow-ups go on the same
  branch while the PR is open.
- **Sergio's preferences:** concise explanations, recommendations over option lists, honest
  status (say what wasn't tested). They want to be asked what to have ready before a step that
  needs them (credentials, exports, DNS).
- **UI style:** no emojis anywhere. Phosphor icons (`@phosphor-icons/react`, `weight="fill"`).
  Add an `InfoTip` (copy from the pantry) wherever a feature isn't obvious. Black/charcoal dark
  mode. Blue accent (Tailwind blue, mirrored in `index.css` for dark mode; Sergio, 2026-10-30, after
  trying red), so it looks different from the pantry. Red is only for errors and delete.
- **Python** with **uv** (`uv sync`, `uv run pytest`, `uv add`). **Node 22+** (Vite 8).
- **Testing against the local stack:** it holds Sergio's real history, and they may be using it from their
  phone. Browser checks that write (start/finish/discard a workout, rename, merge) can collide with
  them: check `GET /api/active` is null first, keep write flows short and discard what you start, or
  stick to read-only checks (and count write requests). Never discard a workout you didn't start.
  Since 5a every request needs a session: run browser checks in a **sample demo**
  (`fetch('/api/session/guest/reset?sample=true', {method: 'POST'})` in the test browser), which
  never holds or touches the real log. Never log in as the owner from the test browser.
  Use exact Playwright selectors: a loose `/Push/` once matched "Start Push workout".
- **Feedback rounds:** Sergio reviews on their phone and sends lists of changes; small ones go on the
  open PR branch, logged in the backlog as "Feedback round N" tables.

## 3. Status

| Stage | What | PR |
|---|---|---|
| 0 | Skeleton: FastAPI + React/Vite, Docker Compose, CI (tests, build, Docker, secret scan), deploy workflow (off until 6b), Dependabot, docs | #1 |
| 1 | WhatsApp import: exercise catalog, chat parser, private corrections, review page, loader into DynamoDB + S3 (local), S3Mock in Compose | #4 |
| 2 | Train tab: day type + stopwatch with laps (a set ends a lap), picker (usual exercises for the day, category chips), English bullet cues, last time, target game (3 in a row, a miss takes one away), setup photos, "Last time" with sets and drop set apart, best drop set, set logger, drop sets, climbing and runs, notes and photos, finish / discard (no rest timer: Sergio times rest with laps), edit or delete past workouts | #5 |
| 3 | History: one workout per day, grouped by week with day-type filters; workout detail (read, then edit) with estimated times; exercise pages (target, best set, best drop, cues, photos, every session); rename and merge exercises; everything in English | #6 |
| 4a | Progress: one consistency view (weeks as rows of days colored by day type, count per week, streak of weeks with 3+), the five main lifts as progression ladders (set glyphs: columns = sets, squares = reps); full ladder on every exercise page; one home per piece of information, linked from the rest | #8 |
| 4b | Routine timeline (eras, sessions, days, notes, photo) on Progress; drop sets (total reps per ladder, best in full) on the dips and chin-ups pages; climbing grade pyramid and hardest send on the bouldering page, with a card on Progress | #9 |
| 4c | Desktop (from 1024px): sidebar, opens on Progress as a dashboard (streak + year heatmap, lifts and climbing in a grid, routine next to the last workouts), workout and exercise pages as a right-side panel, History two columns; Train and Settings stay one column | #10, #11 |
| 5a | Owner passcode login (6 digits, 3 tries then a pause, 90-day cookie) and guest demos (a private 24h copy of the log without the workout in progress, or a sample log when the owner has none), ported from the pantry; start screen, demo banner, log out; the cue check is off for guests | #12 |
| 5b | Welcome page (Sergio's photo and note, three tutorial clips recorded in a sample demo, Continue / I'm Sergio; two columns on computers), app icon and manifest (Add to Home Screen) | open |

**Where things stand (2026-10-30):** stages 0-5a are merged; stage 5b (welcome page) is in review on `stage-5b-welcome`. The app runs **only
locally** (Docker + ngrok); nothing is on AWS yet (stages 6a-6c), so the WhatsApp history is only in
the local DynamoDB (`load --local`), and anything logged in the app now stays local. Sergio logs in
with their passcode (set 2026-10-30). Sergio tests on
their phone through the ngrok URL and may be using the local app while the agent works.

**Next: Sergio's OK on the welcome note, then stage 6a** (AWS with Terraform on profile `gym`; see
[docs/BACKLOG.md](docs/BACKLOG.md); applies need Sergio's OK). Load the `dataviz` skill
before writing chart code. Visuals are plain SVG/HTML in `components/Progression.tsx` (no chart
library). Day-type colors are CSS variables in `index.css` (`--chart-push/legs/pull/cardio`),
checked with the dataviz palette validator in both modes.

**One home per thing (Sergio, 2026-10-30: "don't repeat yourself").** Each piece of information
lives in one place and the others link to it: an exercise's progression, cues, photos and sessions
live on its **exercise page** (the workout card and Progress link there); consistency lives on
**Progress** (Train shows "This week: 2 of 3 · streak" linking there via `useGoTo()`); workouts
live in **History** (Train shows only the last one). Prefer a link or a fold-out over a second copy.

## 4. Architecture

```
Phone ─ HTTPS ─▶ (local) ngrok ─▶ Vite dev server :5180 ─ /api proxy ─▶ FastAPI :8090
                                                                        ├─ DynamoDB Local :8010
                                                                        └─ S3Mock :9190 (photos)
(AWS, stage 6) CloudFront ─┬─ /*     → S3 (built frontend)
                           └─ /api/* → API Gateway → Lambda (same Docker image) → DynamoDB, S3
                                       (+ X-Origin-Verify)               secrets from SSM /fit/*
```

- **Backend:** Python 3.12, FastAPI, boto3. `backend/app/`.
- **Frontend:** React 19 + TypeScript 7 + Vite 8, Tailwind v4, TanStack Query, Phosphor icons;
  charts in plain SVG. `frontend/src/`. Same-origin `/api`, so no CORS; auth (stage 5a)
  uses an httpOnly cookie.
- **One Docker image** for local and Lambda: `backend/Dockerfile` has an `app` stage (compose
  and CI) and a final `lambda` stage with the AWS Lambda Web Adapter (built at deploy time).
- Local host ports (5180, 8090, 8010) differ from the pantry's so both stacks can run at once.
  Inside the containers the usual ports (5173, 8080, 8000) are used.

### Repo map

```
AGENTS.md, CLAUDE.md, docs/BACKLOG.md, README.md
docker-compose.yml          api (FastAPI), dynamodb (DynamoDB Local), s3 (S3Mock), web (node:22 Vite)
.github/workflows/ci.yml    pytest, vitest + build, docker build --target app, gitleaks
.github/workflows/deploy.yml  after CI on main: image -> ECR, Lambda, frontend -> S3 (needs
                            repo variable DEPLOY_ENABLED=true; off until stage 6b)
.github/dependabot.yml      weekly grouped updates
.mcp.json                   Playwright, AWS docs, Terraform MCP servers
scripts/upload_frontend.sh  frontend/dist -> S3 + CloudFront invalidation
scripts/import_whatsapp.py  WhatsApp import CLI: `parse` (-> private/import/) and `load`
private/                    git-ignored: export/ (chat + photos), corrections.json,
                            import/parsed.json + review.html
backend/
  app/main.py               app, /api/health, CloudFront-only middleware on AWS, creates the
                            table and bucket locally (AUTO_CREATE_TABLE=1)
  app/config.py             env config
  app/ssm.py                SSM /fit/* -> environment variables at startup (SSM_PREFIX)
  app/db.py                 DynamoDB single table: put/get/query/delete, batches; Decimal <-> int/float
  app/storage.py            S3 photos (copied from the pantry)
  app/models.py             Pydantic shapes: SetData, Entry, Problem, Segment, WorkoutBody, Workout,
                            Exercise, Note, Scheme/Streak, ExerciseSummary, Progress/Lift/Step
  app/history.py            last session per exercise, main-set scheme, the target game (replay yields
                            each session's result), usage counts
  app/cue_check.py          the cue check: a note -> add / reword a cue (gpt-oss-120b on Groq)
  app/progress.py           Progress tab: training days with day type; each exercise's progression
                            ladder (one step per target, from the target-game replay; MAIN_LIFTS)
  app/labels.py             session labels ("Push", "Squat + Climb"); shared with the importer
  app/session.py, space.py  signed cookie -> data space ("main" or "sb-<expiry>-<id>"); 401 without one
  app/sandbox.py            create/expire sandboxes (copy of main minus ACTIVE); sample_data.py seeds
                            the sample log (8 weeks of Push/Legs/Pull) when main has no workouts
  app/passcode.py           scrypt hash/verify; ratelimit.py DynamoDB fixed-window counters
  app/routers/              exercises (list, create, summary, cues, progress), workouts (saved + ACTIVE),
                            photos, progress, session (all from the pantry)
  app/catalog.py            built-in exercise catalog: English names, group, load type, bar
                            weight, aliases (Spanish, shorthand, typos)
  app/importer/             chat.py (export -> messages), parse.py (messages -> workouts, notes,
                            body weight; corrections), load.py (-> DynamoDB + S3, idempotent)
  tests/                    pytest with moto (in-memory AWS); import tests use made-up chat lines
frontend/
  src/App.tsx               tabs Train / History / Progress / Settings
  src/api.ts, hooks.ts      API client and TanStack Query hooks
  src/pages/                TrainPage (idle: day type, start, last workouts; active workout),
                            HistoryPage (Workouts by month and week + filters / Exercises), ProgressPage (consistency
                            weeks + streak, lift ladders), SettingsPage
  src/components/           Screens (stack of full-screen pages: useScreens().openWorkout / openExercise),
                            Screen, WorkoutDetail, ExercisePage, EditWorkout, WorkoutCard,
                            WorkoutEditor, EntryCard (set logger, drop sets, climbing, run, notes),
                            Cues (checklist + manage sheet), ExercisePicker, Stepper,
                            Photos, BottomSheet, InfoTip (both from the pantry), ComingSoon,
                            Progression (SetGlyph, GameDots, ProgressionLadder, LiftCard, day-type
                            colors), Nav (useGoTo: switch tabs from a page), DemoBanner, PasscodeSheet,
                            TutorialStrip (from the pantry)
  src/lib/                  pure logic + tests: sets (summaries, next set, ladder, volume, next up),
                            time (local ISO), weeks (week grouping, long dates), laps, duration, search (fuzzy), images, theme,
                            progress (week rows and counts, streaks, step dates), cues (sections and order),
                            kinds (drop ladders, climbing grades)
```

### Data model (DynamoDB, one table `fit`, `pk`/`sk`)

- **Day types** (Sergio, 2026-10-30): **Push, Legs, Pull, Cardio**. Squat and deadlift share Legs
  (heavy squat + lighter deadlift, alternating); front lever and climbing are Pull; cardio is once a
  week (Peloton run or walk). `labels.py`: new sessions use these names; imported sessions keep
  theirs (Squat, Deadlift, Front lever, Climb, Run) and map to today's types via `day_type`.
- `pk = SPACE#main` is Sergio's log; `SPACE#sb-<unixExpiry>-<hex>` is a guest sandbox (stage 5a;
  rows carry `ttl`).
- **`EXERCISE#<id>`**: `name` (English), `group` (push, pull, legs, core, cardio, climbing; the old
  `posterior` and `skill` values still exist in the type and display as Legs and Core), `load`, `measure` (reps, seconds, run, climb), `barLb`, `aliases`, `source`
  (`catalog` from `app/catalog.py`, later `app` for ones Sergio creates).
- **`WORKOUT#<yyyy-mm-dd>#<id>`**: **one per day** (Sergio, 2026-10-30): a second session the same day
  joins the first (`POST /active/finish` merges; the import groups by day). `durationMin` = training
  minutes when a day had separate sessions (the hours between don't count). `plan` (day type chosen at the start), `laps`
  `[{at, label?}]` (stopwatch laps; logging a set ends one, labeled "Set 2 · Bench press"),
  `id` (`<date>-<n>`), `startedAt`/`endedAt` (local
  time, no zone), `durationEstimated` (true for imports: each session starts ~60 min before its first message,
  20 min warm-up + 40 min first exercise, and ends with its last message), `label` ("Push",
  "Squat + Climb"...), `notes`, `photos` `[{key, caption}]`, `source` (`whatsapp` / `app`), and
  `entries` in order, each `{exerciseId, sets?, targets?, notes?, photos?, problems?, segments?,
  distanceMi?}`:
  - **set** `{reps?, weightLb?, each?, seconds?, drop?, detail?}`. `weightLb` is **as written**:
    plates for `barbell` exercises (total = `weightLb + barLb`, the 45 lb bar), per hand when
    `each`, and the **added** weight for `added` exercises (weighted dips and chin-ups; Sergio
    tracks only the added weight). `drop` marks drop-set ladders (90-70-45-25-0); `detail`
    describes complexes ("3 pull + 3 muscle + 3 dip + 3 pull") and ladders.
  - **targets** `[{text, times?, kind?}]`: the previous goal Sergio wrote in parentheses,
    "(5x5 185 lbs 2 veces)" = reached twice so far (imported sessions only).
  - **The target game** (`app/history.py`, Sergio 2026-10-30): the target is the working sets at
    a session's top weight; a session that reaches it (same total reps at that weight or more) adds
    one, a miss takes one away (not a reset); 3 means go up. More weight or a small deload starts a
    new target; a session >10% lighter is a light or comeback day and doesn't count (for up to 60
    days); after 3, more reps at the same weight is the next target. Replayed over the whole
    history; where the log has their written target for that weight, it syncs to their count first.
  - **problems** (bouldering) `[{grade, color?, result: sent|attempted, count?, attempts?, note?}]`;
    **segments** (treadmill) `[{mph, minutes}]` plus `distanceMi`.
- **`NOTE#<exerciseId>#<date>#<id>`**: the technique log. `text` (English), `original` (what
  Sergio wrote, when translated), `date` (first written),
  `lastSeen`, `sessions` (how many workouts repeat it), `section` (`setup`, `brace`, `lift`: the
  order they matter while training) and `rank` (importance within it; placed by the agent from
  Sergio's own cues, kept in the corrections' `cueOrder`). Imported cues are the ones written in 2+
  sessions plus hand-picked ones; per-session comments stay on the workout entry. Re-importing keeps
  `hidden`, `section` and `rank` set in the app.
- **`BODY#<date>`** `{weightLb}` · **`ROUTINE#<from>#<id>`** `{name, from, to, days[], notes,
  photos}` (the routine eras, for the evolution timeline) · later `ACTIVE` (workout in progress,
  server-side `startedAt`) and `SETTINGS`.
- Photos in S3 (S3Mock locally): `<space>/<id>.img` plus `<space>/<id>-thumb.img` (1600 and
  400 px JPEG). Imported photos are `main/wa-<chat file number>`. App uploads (stage 2) will be
  resized on the device like the pantry (`lib/images.ts`, `Photo.tsx` to copy).
- Numbers: `db.py` stores floats as Decimals and returns whole numbers as ints, others as floats
  (22.5 lb).

### WhatsApp import (stage 1)

- Source: Sergio's self-chat "Mi grupo", exported with media (iPhone zip), unzipped to
  `private/export/`. Training starts 2025-09-05; ~180 sessions, ~1,800 sets, 14 months.
- `parse` translates every shown text (notes, captions, climbing notes) to English with
  `private/note_translations.json`, and applies `private/corrections.json` (git-ignored): `start`, per-message rewrites keyed by
  `"YYYY-MM-DD HH:MM:SS"` (string = new text, `null` = drop, `{entries: [...]}` = given
  directly), `photos` (drop / attach), `textFixes` (typo fixes applied to every message first), `technique` (extra cues), `cueOrder` (cue sections and order by English text), `notTechnique` (repeated
  comments that aren't cues), `routines` (the eras, written by the agent from the chat and the
  2-week rotation photo). Fix parser rules for patterns, corrections for one-offs.
- Check `private/import/review.html` (chat next to result) after any parser change.
- Writing to production (stage 7) is `load --profile gym --table fit --bucket <photos bucket>`;
  it asks for "yes". Re-running replaces earlier `source: whatsapp` rows and never touches
  `source: app` rows.

### API (all under `/api`)

| Area | Endpoints |
|---|---|
| Health | `GET /health` (no session needed) |
| Session | `GET /session` · `POST /session/guest` · `POST /session/guest/reset[?sample=true]` · `POST /session/owner {passcode}` · `DELETE /session`. Everything else needs a session (401). Demos: 20/hour per IP (1000 locally), 500/hour total; 3 wrong passcodes pause owner login on that network for an hour (10/hour globally); guests upload at most 40 photos a day; the cue check is owner-only |
| Progress | `GET /progress` (days with day type; the main lifts' progression ladders; routine eras newest first with their workouts) · `GET /exercises/{id}/progress` (one exercise's ladder: `steps` of `{scheme, sessions, times}`, oldest first) |
| Day types | `GET /session-types` (label, usual exercises in order, last date, sessions) |
| Exercise page | `GET /exercises/{id}/history` (sessions newest first, all photos, best set) · `PATCH /exercises/{id} {name?, group?}` (old name stays an alias) · `POST /exercises/{id}/merge {into}` (sessions and cues move; the duplicate is hidden) |
| Exercises | `GET /exercises` (catalog + custom, with `lastDone`, `timesDone`) · `POST /exercises` · `GET /exercises/{id}/summary[?exclude=workoutId]` (cues, last, streak = target game, photos, bestDrop) |
| Cues | `POST /exercises/{id}/notes {text, date, section?}` · `PATCH /exercises/{id}/notes/{noteId} {text?, hidden?, section?, rank?}` · `DELETE` (same path) · `POST /exercises/{id}/cue-check {note}` (suggestion `{action: add|update|none, noteId?, text?, section?}`; 503 without `GROQ_API_KEY`) |
| Workouts | `GET /workouts?limit=` (newest first) · `GET/PUT/DELETE /workouts/{id}` (PUT keeps id, date, source; label recomputed) |
| In progress | `GET /active` · `POST /active {startedAt}` (keeps an existing one) · `PUT /active` (autosave; startedAt fixed) · `POST /active/finish {endedAt}` · `DELETE /active` |
| Photos | `POST /photos` (multipart photo + thumb, resized on the phone) · `GET /photos/{space}/{id}[?size=thumb]` |

Times are the phone local time without a zone (`2026-10-30T18:00:00`), like the import.

## 5. Run, test, preview

```sh
docker compose up -d --build          # app at http://localhost:5180 (API docs :8090/api/docs)
ngrok http 5180                       # phone URL (no password, by choice; see 6)
cd backend && uv run pytest -q
cd frontend && npm test && npm run build
cd frontend && npm run record-tutorials     # re-record the welcome clips (stack up, ffmpeg; sample demos)
cd frontend && node scripts/make-icons.mjs  # app icons from public/favicon.svg
cd backend && uv run python ../scripts/import_whatsapp.py parse        # -> private/import/
cd backend && uv run python ../scripts/import_whatsapp.py load --local # stack must be up
```

- Hot reload works through file polling (Docker on Windows doesn't forward file events).
  Rebuild the API after backend dependency changes (`docker compose up -d --build api`), restart
  `web` after frontend dependency changes.
- If ngrok returns 503 or localhost:5180 doesn't answer, check `docker compose logs web`: Vite
  restarts itself when `vite.config.ts` changes (e.g. on `git checkout`), and without
  `--host` on its command line it then stops listening outside the container. Compose passes
  `--host`; `docker compose restart web` fixes an old container.
- **ngrok:** the agent starts the tunnel itself (`ngrok http 5180` in the background) and reads
  the URL from `http://127.0.0.1:4040/api/tunnels`; Sergio's account has a static domain
  (`thrower-diary-savanna.ngrok-free.dev`), shared with the pantry, so only one of the two
  stacks can be tunneled at a time.
- Phone-sized screenshots without the MCP server: a small Node script can load Playwright from
  the pantry's `frontend/node_modules` (`createRequire`) and shoot 390x844 in both color schemes.

## 6. Secrets, privacy and safety rules (important)

- **The repo is public.** Never commit keys, tokens, passwords, `.env` files, Terraform state or
  `*.tfvars`. `.gitignore` covers them; CI runs **gitleaks** on every push and PR. Always check
  `git status` and the staged diff before committing, and never commit files you didn't create.
- **`private/` holds Sergio's WhatsApp export and must never be committed** (git-ignored),
  together with everything derived from it: `corrections.json`, `import/parsed.json` and
  `import/review.html` (which quotes the chat). Only code goes in the repo (the importer, and
  tests with made-up lines); parsed workouts go straight into DynamoDB, never into a seed file in
  git. The chat also has non-training messages (to-do lists, links, a birthday list): the
  importer drops them, and they must never be quoted in commits, PRs or docs.
- `backend/.env` (git-ignored) holds `GROQ_API_KEY` (the cue check), `PASSCODE_HASH` and
  `SESSION_SECRET` (written by `scripts/set_passcode.py`, which Sergio runs: a hidden prompt; it
  keeps the other keys). Compose reads the file when the `api` container is created, so run
  `docker compose up -d api` after changing it. **Never
  print, cat or paste secrets.** Never ask Sergio to paste a key or passcode into chat; they run
  the scripts or edit `.env` themself. On AWS they are SSM SecureStrings under `/fit/`.
- AWS access: profile **`gym`** (IAM user `gym-deployer`, AdministratorAccess, same account
  816940506502 as the pantry but a fully separate stack). Sergio created its keys themself;
  they live only in `~/.aws/credentials`. GitHub Actions never gets AWS keys (OIDC role).
- **The ngrok tunnel has no password** (Sergio's choice, 2026-10-29: the password prompt was
  annoying). Anyone with the URL can use the local app, and before stage 5a it has no login.
  Stop the tunnel when not testing, especially once the local database holds the real history.
- **Never touch the pantry's AWS resources** (profile `pantry`, anything named `pantry-*`).
- Once their real history is in production (stage 7), **never change or delete `SPACE#main`**
  without Sergio's explicit OK. Test in sample guest sandboxes.

## 7. UI conventions and gotchas

- **Phone first; desktop is its own design.** Every screen is designed for 390x844 with the
  bottom tabs. From `lg:` (1024px, `useDesktop()` / `DESKTOP` in `hooks.ts`) the app has its own
  layout (stage 4c): a left sidebar instead of the tabs, opening on Progress as a dashboard (the
  year heatmap shows as many weeks as fit; lifts in 2 columns, 3 from `xl:`), `Screen` pages as a
  panel on the right (click outside or Escape to close), History in two columns. Train and
  Settings stay one centered column (logging happens on the phone). Tablets (768-1023px) keep the
  phone layout. Same components and `src/lib/` logic for both; only classes and composition
  differ.
- Inputs are 16px on touch screens (`index.css`) so iOS doesn't zoom. Big tap targets: this is
  used between sets with sweaty hands. Hover states are only extras (touch has none).
- **Dark mode** mirrors the Tailwind palette with CSS variables in `index.css` (copied from the
  pantry); it applies before first paint (inline script in `index.html`, localStorage key
  `gym.theme`). Use stone/emerald/amber/sky/red classes and dark mode comes for free.
- **Shell gotchas in the agent's Bash tool:** heredocs or `node -e` scripts containing apostrophes or
  backticks often fail to parse ("unexpected EOF"). Write multi-line scripts to the scratchpad with the
  file tool, then run them. `sed` patterns with backslashes (regexes) get mangled the same way.
- **Shell gotchas (Windows, Git Bash):** `sed` breaks when the replacement contains `#`; use the
  edit tool. With `MSYS_NO_PATHCONV=1` (needed for AWS CLI paths like `/fit/`), native Windows
  tools need `C:/...` paths.

## 8. AWS deployment (stage 6)

Not deployed yet. The plan mirrors the pantry: Terraform in `infra/` (state bucket via
`infra/bootstrap/`), Lambda container + HTTP API + CloudFront + S3 + DynamoDB `fit` (PITR,
deletion protection) + SSM `/fit/` + SNS alarms, GitHub OIDC deploy role `fit-github-deploy`,
ACM certificate for `gym.sergiovanegas.com` with two CNAMEs at Hostinger. The agent may run
`terraform plan`; **applies need Sergio's OK**. After 6a/6b, set the repo variables
`DEPLOY_ENABLED=true`, `DISTRIBUTION_ID` and `SITE_URL` to turn on `deploy.yml`.
