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
- **Units:** pounds (lb). **Two AI features**, both on Groq, on for the owner and in demos (Sergio, 2026-11-17: visitors get the
  same experience; demos are capped in `app/ai_limits.py`), off without
  `GROQ_API_KEY`: the **cue check** (Sergio, 2026-10-30): when a note is written on an exercise,
  gpt-oss-120b (`app/cue_check.py`) suggests adding a cue or rewording one, using only Sergio's words;
  nothing changes until they accept. **Peloton screenshots** (Sergio, 2026-11-17: "I just want to add a
  photo"): qwen/qwen3.8-27b (`app/peloton.py`, `PELOTON_MODEL`) reads a class summary screenshot into
  stats; the date on the screen isn't read (it misread one in testing; the workout has its own).
- **The streak's weekly rule** (Sergio, 2026-11-23, stage 13a; replaced the plan-based goal of 12b and
  the 3 strength + 1 cardio goal of 2026-11-17): **4 training days** in a week (any kind) grow the
  streak, **2 or 3 hold it**, 0 or 1 use a shield or end it. Applied to the whole history
  (`lib/progress.ts`: `GROW_DAYS`, `KEEP_DAYS`, `weekState`). Decisions from stage 1 (2026-10-29): barbell weights
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
  Add an `InfoTip` (copy from the pantry) wherever a feature isn't obvious. **Keep each one to one or two
  short sentences** (Sergio, 2026-11-23: "if they are short people will read them"). Page tops: pages
  start with no top margin, so every tab's first block sits at the same height.
- **The look: "Iron & Ember"** (stage 10a, Sergio 2026-11-17: designed in Lovable to give the app its
  soul; it replaces the stage 8b blue identity). Ink-black dark mode with film grain, bone-and-ink light
  mode, sharp corners (radii 1-4 px), one blood-red accent with cold steel and brass as secondaries.
  - **Done by remapping Tailwind tokens** in `index.css`: the `blue-*` classes *are* the red accent,
    `stone-*` are ink/bone, `white` is the card surface. Restyle through tokens before touching
    component classes, and keep writing `blue-*` for the accent. Red marks progress (targets,
    streaks, charts) as well as errors and delete.
  - **Action buttons** (`bg-blue-600 text-white`) are overridden in `index.css` to bone on black
    (light) and ink on bone (dark); don't "fix" `text-white`.
  - **Logo:** a loaded barbell, side view, ink on a bone square: `public/favicon.svg` (`<g id="mark">`),
    `components/Logo.tsx`; app icons from `scripts/make-icons.mjs`.
  - **Fonts** (self-hosted, `@fontsource`): Anton for `font-display` (big numbers and headings: all
    caps, one weight, so bold classes are ignored) and Archivo for body text.
  - **Motion:** the running stopwatch glows (`ember-text`); a reached target and a streak milestone
    flash and shake once (`breakdown`), skipped with reduced motion.
  - **Dark by default** when nothing is stored (`lib/theme.ts` and the inline script in
    `index.html`); Automatic and Light stay in Settings.
  - **Welcome page** opens on a grayscale gym photo (`src/assets/hardcore-gym.jpg`, chosen by Sergio)
    under the mark, then the live log: stats, the training-days heatmap, current targets, the note
    and clips; Continue / I'm Sergio stay in a bottom bar on phones.
- **The streak, up front on Train** (stage 10a, reworked in 11a and 13a): the week streak, its tier,
  longest, shields, **this week as four day slots** (filled in order with the day types trained; the
  second "keeps", the fourth "grows"; weeks run Monday to Sunday), a ladder to the next streak tier, and
  the workouts count with its tier; links open Progress.
  **Shields** (Sergio, 2026-11-20; every 8 weeks since 11-23): every 8 weeks that grow the streak earn one,
  and a week under 2 days uses one up instead of ending the streak.
  **Tiers** (stage 13a, `lib/tiers.ts`, `components/Tiers.tsx`): streak tiers at 4, 8, 16, 24, 32, 52,
  104 weeks (then every 52) and workout tiers at 50, 100, 200, 300, 400, 500, 750, 1000 workouts (then
  every 250), each with a name and a Phosphor icon (brass when earned); the full ladders are a card on
  Progress. Crossing a streak tier, earning a shield or reaching a workout tier while the app is open
  shows its own congrats. All in the frontend (`lib/progress.ts` `streaks`, `lib/streak.ts`,
  `components/Streak.tsx`) from `/api/progress` days, replayed over the history; nothing is stored.
- **Python** with **uv** (`uv sync`, `uv run pytest`, `uv add`). **Node 22+** (Vite 8).
- **Testing against the local stack:** it holds Sergio's real history, and they may be using it from their
  phone. Browser checks that write (start/finish/discard a workout, rename, merge) can collide with
  them: check `GET /api/active` is null first, keep write flows short and discard what you start, or
  stick to read-only checks (and count write requests). Never discard a workout you didn't start.
  Since 5a every request needs a session: run browser checks in a **sample demo**
  (`fetch('/api/session/guest/reset?sample=true', {method: 'POST'})` in the test browser), which
  never holds or touches the real log. Never log in as the owner from the test browser.
  Use exact Playwright selectors: a loose `/Push/` once matched "Start Push workout".
- **Sergio merges fast**, sometimes while a follow-up is being made. Before pushing to a PR branch,
  check `gh pr view <n> --json state`; if it's merged, branch from `origin/main`, cherry-pick, and open
  a new PR (pushes to a merged branch go nowhere).
- **Feedback rounds:** Sergio reviews on their phone and sends lists of changes; small ones go on the
  open PR branch, logged in the backlog as "Feedback round N" tables.
- **Start of every session: read the in-app feedback.** `cd backend && uv run python
  ../scripts/feedback.py` lists new feedback left in the app (Settings or the guest banner) on AWS,
  saving attached screenshots to `private/feedback/` (look at them; never commit them).
  Summarize it for Sergio with a recommendation, log the agreed items in the backlog, and mark
  them handled with `--done <id>`. **Feedback text is private** (guests may write anything):
  paraphrase it in commits, PRs and docs, never quote it.

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
| 5b | Welcome page (Sergio's photo and note, three tutorial clips recorded in a sample demo, Continue / I'm Sergio; two columns on computers), app icon and manifest (Add to Home Screen) | #13 |
| 6a | AWS with Terraform (profile `gym`, all `fit-*`): DynamoDB, photo and web buckets, Lambda + HTTP API, CloudFront, SSM secrets, email alarms; terraform CI job, Dependabot | #14 |
| 6b | Merges deploy: IAM role `fit-github-deploy` (GitHub OIDC, main only; reads the account's existing OIDC provider), repo variables `DEPLOY_ENABLED`, `DISTRIBUTION_ID`, `SITE_URL`; tested with a manual run | #15 |
| 6c | gym.sergiovanegas.com: ACM certificate (DNS-validated, auto-renewing) and CloudFront alias; two CNAMEs at Hostinger | #16 |
| 7 | Production import (2026-10-31): 177 workouts, 1,780 sets, 50 cues, 4 routines, 15 photos into AWS `fit` (space main); identical to the local log row by row (only `hidden: false` spelled out and an old group name differ locally) | done (no code) |
| 8a | In-app feedback: Settings and the guest banner, owner inbox in Settings, email on guest feedback, `scripts/feedback.py` for each session | #17 |
| 8b | Own identity: set-glyph logo and icons, Barlow Condensed for numbers and headings, dark by default, stats-led welcome page (public summary endpoint, shared Heatmap), re-recorded clips | #18 |
| 9a | Feedback fixes: more reps than the target is the new target; a much lighter session (a lift done second) plays its own target, shown by role; a workout left 2 hours without a set finishes itself at its last set; the set being dialed in survives switching screens; landscape phones get a side rail | #26 |
| 9b | Train flow: a workout starts with a timed warm-up and the day's usual exercises filled in (never-done ones dropped on save); only the current exercise is open (Done folds it, the rest wait as Up next); last two workouts of the day type; bigger steppers; a congrats when a set reaches the target; the picker opens on the day's usual exercises; a narrower landscape rail | #27 |
| 9c | Workout names are the day type and first exercise ("Legs · Deadlift", computed in the app; stored labels unchanged); a top-weight (or most reps, longest hold) chart on each exercise page; body weight on Progress (log, latest, change, line; `/api/body`); shared `LineChart` | #28 |
| 9d | Peloton: the summary screenshot (from the photo library: no more forced camera, for every photo) is read into the class stats (`entry.peloton`); Peloton ride in the catalog; output chart on the ride's page and a Peloton card on Progress; weekly goal 3 strength + 1 cardio; Sergio's three November rides added; screenshots kept apart from setup photos; a Cardio day starts with the one activity picked; both AI features on in demos (capped) | #29 |
| 10a | The Lovable redesign ("Iron & Ember"): ink and blood-red theme through Tailwind token remaps, Anton and Archivo, sharp corners, film grain, barbell logo and icons, gym photo on the welcome page; the streak card on Train with milestones and their congrats; a weekly ride in the sample log; re-recorded clips; follow-ups: iPhone Home Screen fix (grain under full-screen pages), landscape rail labels, all weekday letters, no goal line on the welcome chart, Sergio's gym photo, page under the clock in the Home Screen app | #32-#38 |
| 11a-12b | Feedback round 2: streak shields, the ladder for going up, training plans (week types in a rotation, mixed days, optional days, history), the goal follows the plan, fixed headers everywhere, loading screen (details in the backlog) | #42-#48 |
| 12c | Feedback: the plan editor as rotation list + week-type pages (quiet styling, confirm on duplicate/delete, reorder), every tab starts at the same height, delete from the workout page, the exercise picker as a full page, short InfoTips, the welcome note counts years from Aug 2014 | #49, #50 |
| 13a | The streak counts training days (4 grow, 2-3 hold, 0-1 shield or end) over the whole history; streak and workout tiers with icons, a Tiers card on Progress and congrats; full-screen pages hide the app underneath on phones (the strip above the iPhone keyboard) | #51 |
| 13b | Tier icons on the welcome stats; the four focus lifts (weighted dips, weighted chin-ups, deadlift, back squat) on the welcome page and first on Progress, then weighted pull-ups and bench | #52 |
| 14a | The plan as one cycle of days: next is the day after the last workout, whatever the calendar week; Train shows the last two workouts and the next four days; workouts store the plan days they were started from (`planDays`) | #53 (shipped with #52) |
| 14b | Feedback: Start inside the plan card, no "Last workouts" on Train, the plan page lists the days (numbered through the cycle, grouped by week type), the warm-up is its own group (not cardio) and left out of exercise lists, History drops "Show every exercise", Progress drops the routine timeline | #54 |
| 14c | Start inside the selected day's row; "View more days" numbered through the cycle; the plan page is one list of days (add, reorder, a page per day), saved as a single week type | #55 |
| 14d | Progress lifts push, pull, legs (dips, bench, chin-ups, pull-ups, deadlift, squat); the Climbing card hidden (`SHOW_CLIMBING`) | (open) |

**Where things stand (2026-11-23):** PRs up to #48 are merged and live; stage 12c (the in-app feedback
of 2026-11-23) is the open PR. The notes below on stage 10a are kept for context.
**Earlier (2026-11-18):** everything was merged and live (PRs up to #38).
Stage 10a brought Sergio's Lovable redesign ("Iron & Ember", #32) and the streak card on Train, then
same-day follow-ups from their phone: the iPhone Home Screen fix (#33: the film grain sat over
full-screen pages, so iOS showed the page under them in the status-bar strip), the landscape rail's
labels and all seven weekday letters on the heatmaps (#34), no goal line on the welcome chart (#35),
Sergio's gym photo in the welcome header (#36), and the Home Screen app running under the clock so
that photo reaches the top edge (#38; Sergio had to delete the old icon and add it again). Production checks: `/api/health` ok, deploys green,
in-app feedback 0 new (`scripts/feedback.py`, section 2). No data changed on AWS this round. No open
work: new requests come from Sergio or the in-app feedback.
**Loose ends at handoff:** two untracked files in the repo root, never to be committed: the Lovable
export (`607c3f8b-...zip`, keep it for bringing over later Lovable changes, see below) and the photo's
original (`hardcore-gym-black-and-white.png`, already in the app as `frontend/src/assets/hardcore-gym.jpg`);
delete them when Sergio says. The ngrok tunnel is stopped.
**The Lovable project** (exported as a zip) mirrors `frontend/src/` in its `src/gym/`, with `api.ts`
swapped for a localStorage mock and the theme in `src/styles.css`. To bring later design changes
over, unzip it outside the repo (scratchpad) and `diff -r` its `src/gym/` against `frontend/src/`:
take the component changes and theme tokens, never its mock, shadcn `components/ui/`, TanStack Start
files or Google Fonts links (fonts are self-hosted), and re-run the dataviz validator on any new
chart colors (Lovable's first ones failed it).
**Production holds Sergio's real log** at https://gym.sergiovanegas.com (loaded
in stage 7), so Sergio logs there from now on and visitors get a copy of it. The local stack has the
same history and is now only for development: anything logged locally stays local. **Never change
or delete `SPACE#main` on AWS without Sergio's explicit OK** (section 6); test in sample demos.

**Next:** whatever Sergio asks for; open ideas are in [docs/BACKLOG.md](docs/BACKLOG.md). Load the `dataviz` skill
before writing chart code. Visuals are plain SVG/HTML in `components/Progression.tsx` and `components/LineChart.tsx` (one series over time: crosshair, tooltip, arrow keys, table view; no chart
library). Day-type colors are CSS variables in `index.css` (`--chart-push/legs/pull/cardio`),
checked with the dataviz palette validator in both modes.

**One home per thing (Sergio, 2026-10-30: "don't repeat yourself").** Each piece of information
lives in one place and the others link to it: an exercise's progression, cues, photos and sessions
live on its **exercise page** (the workout card and Progress link there); consistency lives on
**Progress** (Train's streak card shows the run and what this week still needs, linking there via `useGoTo()`); workouts
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
scripts/feedback.py         in-app feedback (AWS or --local): list new, --done <id> to mark handled
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
  app/plans.py              training plans: two alternating week types read off the log or saved, this week's type
  app/history.py            last session per exercise, main-set scheme, the target game (replay yields
                            each session's result), usage counts
  app/cue_check.py          the cue check: a note -> add / reword a cue (gpt-oss-120b on Groq)
  app/peloton.py            a Peloton summary screenshot -> class stats (qwen/qwen3.8-27b on Groq)
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
                            WorkoutEditor (focus mode: current exercise open, done ones folded, Up next),
                            EntryCard (set logger, drop sets, climbing, run, warm-up, notes, Done), Celebration,
                            Cues (checklist + manage sheet), ExercisePicker, Stepper,
                            Photos, BottomSheet, InfoTip (both from the pantry), ComingSoon,
                            Streak (StreakCard, StreakCelebration), PlanEditor, Progression (SetGlyph, GameDots, ProgressionLadder, LiftCard, day-type
                            colors), Nav (useGoTo: switch tabs from a page), DemoBanner, PasscodeSheet,
                            TutorialStrip (from the pantry), FeedbackSheet
  src/lib/                  pure logic + tests: sets (summaries, next set, ladder, volume, next up),
                            time (local ISO), weeks (week grouping, long dates), laps (and when a
                            workout was left running), drafts (the set being dialed in, kept on the phone), plan (what a
                            workout starts with, usual order, logged entries), series (each session's top weight / reps / hold), duration, search (fuzzy), images, theme,
                            progress (week rows and counts, streaks, step dates), cues (sections and order),
                            kinds (drop ladders, climbing grades), streak (milestones, what the week still needs)
```

### Data model (DynamoDB, one table `fit`, `pk`/`sk`)

- **Day types** (Sergio, 2026-10-30): **Push, Legs, Pull, Cardio**. Squat and deadlift share Legs
  (heavy squat + lighter deadlift, alternating); front lever and climbing are Pull; cardio is once a
  week (the Peloton ride or the treadmill only, since 2026-11-23). `labels.py`: new sessions use these names; imported sessions keep
  theirs (Squat, Deadlift, Front lever, Climb, Run) and map to today's types via `day_type`.
- `pk = SPACE#main` is Sergio's log; `SPACE#sb-<unixExpiry>-<hex>` is a guest sandbox (stage 5a;
  rows carry `ttl`).
- **`EXERCISE#<id>`**: `name` (English), `group` (push, pull, legs, core, cardio, climbing, warmup: the warm-up only, a stage of every workout, left out of exercise lists; the old
  `posterior` and `skill` values still exist in the type and display as Legs and Core), `load`, `measure` (reps, seconds, run, climb), `barLb`, `aliases`, `source`
  (`catalog` from `app/catalog.py`, later `app` for ones Sergio creates).
- **`WORKOUT#<yyyy-mm-dd>#<id>`**: **one per day** (Sergio, 2026-10-30): a second session the same day
  joins the first (`POST /active/finish` merges; the import groups by day). `durationMin` = training
  minutes when a day had separate sessions (the hours between don't count). `plan` (day type chosen at the start), `planDays` (the plan days it was started from, stage 14a; joined on a same-day merge), `laps`
  `[{at, label?}]` (stopwatch laps; logging a set ends one, labeled "Set 2 · Bench press"),
  `id` (`<date>-<n>`), `startedAt`/`endedAt` (local
  time, no zone), `durationEstimated` (true for imports: each session starts ~60 min before its first message,
  20 min warm-up + 40 min first exercise, and ends with its last message), `label` ("Push",
  "Squat + Climb"...), `notes`, `photos` `[{key, caption}]`, `source` (`whatsapp` / `app`), and
  `entries` in order, each `{exerciseId, sets?, targets?, notes?, photos?, problems?, segments?,
  distanceMi?, minutes?, peloton?, done?}` (`peloton`: the class stats read from the screenshot in
  `photos`, see the Peloton API). A new workout starts with the `warm-up` (catalog, measure `time`:
  only `minutes`) and the day's usual exercises filled in (stage 9b); `POST /active/finish` drops
  entries with nothing logged and the `done` flag (it only folds an exercise during the workout):
  - **set** `{reps?, weightLb?, each?, seconds?, drop?, detail?}`. `weightLb` is **as written**:
    plates for `barbell` exercises (total = `weightLb + barLb`, the 45 lb bar), per hand when
    `each`, and the **added** weight for `added` exercises (weighted dips and chin-ups; Sergio
    tracks only the added weight). `drop` marks drop-set ladders (90-70-45-25-0); `detail`
    describes complexes ("3 pull + 3 muscle + 3 dip + 3 pull") and ladders.
  - **targets** `[{text, times?, kind?}]`: the previous goal Sergio wrote in parentheses,
    "(5x5 185 lbs 2 veces)" = reached twice so far (imported sessions only).
  - **The target game** (`app/history.py`, Sergio 2026-10-30): the target is the working sets at
    a session's top weight; a session that reaches it (same total reps at that weight) adds one, a
    miss takes one away (not a reset); 3 means go up. More weight or a small deload starts a new
    target, and so does **a higher rung of Sergio's ladder** at the same weight (stage 11a: 3x2, 4x2,
    5x2, 3x3, ... 4x5, 5x5; a rung is the most reps 3+ sets reach, then how many sets; 5x4 -> 3x5 is
    up, more total reps alone isn't). A target **not reached in 60 days** gives way to the session's
    sets (an unmarked old drop set held wide pull-ups for a year). In the logger, a heavier set or a
    higher rung gets a "Went up" congrats; reaching the target gets one only before it's time to go up. A session >10% lighter than the
    main target plays a **second track** with the same rules (squat done second after deadlift,
    2026-11-11); after 60 days the lighter work becomes the main target. The summary takes the
    exercise's `role` in today's workout (`first` lift or `later`) and returns the target and "last
    time" of the sessions with that role. Ladders show only the main track. Replayed over the whole
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
- **`SETTINGS#plans`** `{weeks: [{id, name, days: [{id, name, kind, exercises}]}], anchor?: {monday, week}}`:
  the training plans once saved (stage 12a, `app/plans.py`; inferred from the log until then; since
  stage 14c the plan page saves one week type holding the whole list of days, up to 20). Week
  types' days form one cycle in list order (stage 14a: Train continues from the last workout, `cycleView`
  in `lib/plan.ts`; the server's calendar anchor and `current` are no longer used by Train). Day kinds:
  Push, Legs, Pull, Upper, Lower, Full body, Cardio; the mixed ones label their workouts with the kind
  (`labels.MIXED`), count as strength days and share the plum `--chart-mixed`. The first saved shape
  (`{plans: [{..., dayType, week: A/B}]}`, stage 11b, still on AWS) is read as two week types. Days
  can be `optional` (in the plan, not in the goal). Every save also writes **`PLANS#<savedAt µs>`**
  `{weeks, anchor?, savedAt, start}` (the history; `start` = the Monday it's in force from).
- **Plan goals** (stage 12b): `/api/progress` still sends each week's goal from the plans
  (`plans.goals`), but since stage 13a the frontend ignores it: the streak counts training days
  (section 1). Optional days only matter for which day is next up.
- **`BODY#<date>`** `{date, weightLb, source}` (Progress, `/api/body`) · **`ROUTINE#<from>#<id>`** `{name, from, to, days[], notes,
  photos}` (the routine eras; still in `/api/progress`, no longer shown since stage 14b) · later `ACTIVE` (workout in progress,
  server-side `startedAt`) and `SETTINGS`.
- Photos (`{key, caption?, kind?}`; `kind: "screenshot"` = a record of the workout, like a Peloton
  summary, kept out of the setup photos shown while training) in S3 (S3Mock locally): `<space>/<id>.img` plus `<space>/<id>-thumb.img` (1600 and
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
| Public | `GET /public/summary` (no session; the welcome page): training days `{date, type}` and the main lifts' current targets only |
| Feedback | `POST /feedback {text, page, photos?}` (owner or guest; 10/hour per IP, 200/day; up to 3 screenshots, copied to `feedback/<id>-<n>`, readable by the owner only) · `GET /feedback` (owner) · `PATCH /feedback/{id} {status?, text?}` (status: owner; text: the owner or whoever wrote it). Stored in `SPACE#feedback`, outside every sandbox, no TTL |
| Session | `GET /session` · `POST /session/guest` · `POST /session/guest/reset[?sample=true]` · `POST /session/owner {passcode}` · `DELETE /session`. Everything else needs a session (401). Demos: 20/hour per IP (1000 locally), 500/hour total; 3 wrong passcodes pause owner login on that network for an hour (10/hour globally); guests upload at most 40 photos a day; the cue check and Peloton reads: 20 a day per demo each, 300 a day across all demos (429 past that) |
| Peloton | `POST /peloton/read {key}` (an uploaded photo -> `{discipline?, title?, instructor?, minutes?, outputKj?, distanceMi?, calories?, avgWatts?, avgCadence?, avgResistance?, avgSpeedMph?}`; capped in demos, 503 without `GROQ_API_KEY`, 502 + "Peloton read failed" log line when Groq fails) |
| Progress | `GET /progress?today=` (days with day type and `cardio`; `goals`: each week's goal from the plans, `{monday, week, strength, cardio, days}`, from the first saved version on; the main lifts' progression ladders; routine eras newest first with their workouts) · `GET /exercises/{id}/progress` (one exercise's ladder: `steps` of `{scheme, sessions, times}`, oldest first) |
| Day types | `GET /session-types` (label, usual exercises in order, last date, sessions) |
| Plans | `GET /plans/history` (every saved version newest first: `{savedAt, start, weeks}`) · `GET /plans?today=` (`{weeks: [{id, name, days: [{id, name, kind, exercises}]}], current, saved}`: week types in rotation order, this week's id; read off the log until saved) · `PUT /plans?today= {weeks, current?}` (`current` = "this week is ...": anchors the rotation at this week) |
| Exercise page | `GET /exercises/{id}/history` (sessions newest first, each with `role`: the day's first lift or `later`; all photos, best set) · `PATCH /exercises/{id} {name?, group?, stepLb?}` (old name stays an alias; `stepLb` 2.5 or 5 is the weight stepper's step) · `POST /exercises/{id}/merge {into}` (sessions and cues move; the duplicate is hidden) |
| Exercises | `GET /exercises` (catalog + custom, with `lastDone`, `timesDone`) · `POST /exercises` · `GET /exercises/{id}/summary[?exclude=workoutId&role=first|later]` (cues, last, streak = target game, photos, bestDrop; `role` = today's first lift or a later one) |
| Cues | `POST /exercises/{id}/notes {text, date, section?}` · `PATCH /exercises/{id}/notes/{noteId} {text?, hidden?, section?, rank?}` · `DELETE` (same path) · `POST /exercises/{id}/cue-check {note}` (suggestion `{action: add|update|none, noteId?, text?, section?}`; 503 without `GROQ_API_KEY`) |
| Workouts | `GET /workouts?limit=` (newest first) · `GET/PUT/DELETE /workouts/{id}` (PUT keeps id, date, source; label recomputed) |
| In progress | `GET /active` · `POST /active {startedAt}` (keeps an existing one) · `PUT /active` (autosave; startedAt fixed) · `POST /active/finish {endedAt}` · `DELETE /active` |
| Body weight | `GET /body` (oldest first) · `PUT /body/{date} {weightLb}` (one per day, replaces) · `DELETE /body/{date}` |
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
- `backend/.env` (git-ignored) holds `GROQ_API_KEY` (the cue check and Peloton screenshots), `PASSCODE_HASH` and
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
  phone layout. A phone turned sideways (`land:` variant in `index.css`: landscape, under 500px
  tall) gets the tabs as a slim left rail and a compact stopwatch bar. Same components and `src/lib/` logic for both; only classes and composition
  differ.
- Inputs are 16px on touch screens (`index.css`) so iOS doesn't zoom. Big tap targets: this is
  used between sets with sweaty hands. Hover states are only extras (touch has none).
- **Dark mode** mirrors the Tailwind palette with CSS variables in `index.css` (copied from the
  pantry); it applies before first paint (inline script in `index.html`, localStorage key
  `gym.theme`). Use stone/emerald/amber/sky/red classes and dark mode comes for free.
- **Shell gotchas in the agent's Bash tool:** heredocs or `node -e` scripts containing apostrophes or
  backticks often fail to parse ("unexpected EOF"). Write multi-line scripts to the scratchpad with the
  file tool, then run them. `sed` patterns with backslashes (regexes) get mangled the same way.
- **Sergio uses the app from the iPhone Home Screen** (added from Chrome; WebKit, standalone). Since #38 the
  status bar is `black-translucent` (`index.html`): the page runs up under the clock, so every top edge
  pads with `calc(env(safe-area-inset-top) + gap)`; keep that on any new top bar. The clock is white in
  that mode, also in light mode. iOS reads the setting when the app is added, so re-add the icon to see
  a change. A bug that doesn't reproduce in a browser tab or Playwright WebKit may be
  specific to that mode: ask for a screenshot, and have Sergio add the ngrok URL to the Home Screen to
  test a fix. In that mode iOS paints the status-bar strip from the topmost fixed layer at the top edge,
  so keep see-through fixed layers (like the grain, z-25) under the full-screen pages (z-30).
- **Vitest from the agent's shell:** run it from an uppercase `C:` working directory (PowerShell
  `Set-Location C:/Users/smvan/repos/fit-mgmt-app/frontend; npx vitest run`). From the harness's
  lowercase `c:` it loads two copies of vitest and every suite fails with "reading 'config'".
- **Shell gotchas (Windows, Git Bash):** `sed` breaks when the replacement contains `#`; use the
  edit tool. With `MSYS_NO_PATHCONV=1` (needed for AWS CLI paths like `/fit/`), native Windows
  tools need `C:/...` paths.

## 8. AWS deployment (stage 6)

Live at **https://gym.sergiovanegas.com** (stage 6c; https://dj3f8i20u01kh.cloudfront.net works too). Deployed in stage 6a
(2026-10-30) on profile `gym` (account 816940506502, same as the pantry but a
fully separate stack: everything is named `fit-*`). Terraform in `infra/`; its state lives in
`fit-tfstate-816940506502` (created by `infra/bootstrap/`, whose own small state stays local and
git-ignored). The alert email is in the git-ignored `infra/terraform.tfvars` (never in the repo).

- **What runs:** CloudFront (`/*` from the private web bucket `fit-web-<account>`, `/api/*` to the
  HTTP API with the `X-Origin-Verify` secret) -> Lambda `fit-api` (the `backend/Dockerfile` lambda
  stage, image in ECR `fit-api`, last 5 kept) -> DynamoDB `fit` (PITR, deletion protection, TTL)
  and the photos bucket `fit-photos-<account>` (demo photos expire after 2 days). Secrets are SSM
  SecureStrings `/fit/SESSION_SECRET`, `/fit/PASSCODE_HASH`, `/fit/GROQ_API_KEY`
  (`scripts/set_aws_secrets.py`; the session secret is generated once and never overwritten).
- **Alarms** (SNS `fit-alerts` -> email, after Sergio confirms the subscription): a wrong owner
  passcode, the cue check failing 3+ times in 15 min ("Cue check failed" log line), a guest leaving
  feedback ("Guest feedback received", at most one email per 15 min), API 5xx, Lambda errors. Keep
  those log lines stable.
- **Merges deploy** (stage 6b): after CI passes on `main`, `deploy.yml` assumes the IAM role
  `fit-github-deploy` through GitHub OIDC (no AWS keys in GitHub; only workflows on main, matched by
  the repo's immutable subject), pushes the image, rolls Lambda, uploads the frontend and checks
  `/api/health`. The account's GitHub OIDC provider is the pantry's (one per account), read with a
  data source in `infra/github.tf`. Repo variables: `DEPLOY_ENABLED=true`, `DISTRIBUTION_ID`,
  `SITE_URL`. Infrastructure changes are not deployed by CI: run `terraform apply` locally first.
- **Deploy by hand:** `scripts/deploy.sh` (image -> ECR, `terraform apply`, frontend -> S3,
  invalidation). The agent may run `terraform plan`; **applies need Sergio's OK.**
- **Domain** (stage 6c, `infra/domain.tf`): DNS is at Hostinger, so Terraform never touches it. Two
  CNAMEs there: ACM's validation record (keep it: the certificate renews itself through it) and
  `gym` -> the CloudFront domain (output `dns_target`). The repo variable `SITE_URL` is the domain.
- The production table starts empty, so demos use the sample log until the stage 7 import.
