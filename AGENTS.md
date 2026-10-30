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
  while training**: the things that, if he does them, make the lift go better. Keep it short
  (one line per cue, newest wording only).
- **Units:** pounds (lb). No AI in the app. Decisions from stage 1 (2026-10-29): barbell weights
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
  mode. Emerald accent.
- **Python** with **uv** (`uv sync`, `uv run pytest`, `uv add`). **Node 22+** (Vite 8).

## 3. Status

| Stage | What | PR |
|---|---|---|
| 0 | Skeleton: FastAPI + React/Vite, Docker Compose, CI (tests, build, Docker, secret scan), deploy workflow (off until 6b), Dependabot, docs | #1 |
| 1 | WhatsApp import: exercise catalog, chat parser, private corrections, review page, loader into DynamoDB + S3 (local), S3Mock in Compose | #4 |
| 2 | Train tab: stopwatch (server start time), exercise picker, technique cues while training, last time + target streak, set logger with steppers, drop sets, climbing and runs, notes and photos, rest timer, finish / discard, edit or delete past workouts | open |

Next: **stage 3, History** (list by week, workout detail, exercise pages). Full plan in [docs/BACKLOG.md](docs/BACKLOG.md).

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
  Recharts joins in stage 4. `frontend/src/`. Same-origin `/api`, so no CORS; auth (stage 5a)
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
                            Exercise, Note, Scheme/Streak, ExerciseSummary
  app/history.py            last session per exercise, main-set scheme, streak, usage counts
  app/labels.py             session labels ("Push", "Squat + Climb"); shared with the importer
  app/space.py              current_space(): "main" until stage 5a (then the pantry version)
  app/routers/              exercises (list, create, summary, cues), workouts (saved + ACTIVE), photos
  app/catalog.py            built-in exercise catalog: English names, group, load type, bar
                            weight, aliases (Spanish, shorthand, typos)
  app/importer/             chat.py (export -> messages), parse.py (messages -> workouts, notes,
                            body weight; corrections), load.py (-> DynamoDB + S3, idempotent)
  tests/                    pytest with moto (in-memory AWS); import tests use made-up chat lines
frontend/
  src/App.tsx               tabs Train / History / Progress / Settings
  src/api.ts, hooks.ts      API client and TanStack Query hooks
  src/pages/                TrainPage (idle: next up, start, recent; active workout; edit saved),
                            HistoryPage, ProgressPage, SettingsPage
  src/components/           WorkoutEditor, EntryCard (set logger, drop sets, climbing, run, notes),
                            Cues (checklist + manage sheet), ExercisePicker, Stepper, RestBar,
                            Photos, BottomSheet, InfoTip (both from the pantry), ComingSoon
  src/lib/                  pure logic + tests: sets (summaries, next set, ladder, volume, next up),
                            time (local ISO), restTimer, duration, search (fuzzy), images, theme
```

### Data model (DynamoDB, one table `fit`, `pk`/`sk`)

- `pk = SPACE#main` is Sergio's log; `SPACE#sb-<unixExpiry>-<hex>` is a guest sandbox (stage 5a;
  rows carry `ttl`).
- **`EXERCISE#<id>`**: `name` (English), `group` (push, pull, legs, posterior, core, skill,
  cardio, climbing), `load`, `measure` (reps, seconds, run, climb), `barLb`, `aliases`, `source`
  (`catalog` from `app/catalog.py`, later `app` for ones Sergio creates).
- **`WORKOUT#<yyyy-mm-dd>#<id>`**: one session. `id` (`<date>-<n>`), `startedAt`/`endedAt` (local
  time, no zone), `durationEstimated` (true for imports: first to last message), `label` ("Push",
  "Squat + Climb"...), `notes`, `photos` `[{key, caption}]`, `source` (`whatsapp` / `app`), and
  `entries` in order, each `{exerciseId, sets?, targets?, notes?, photos?, problems?, segments?,
  distanceMi?}`:
  - **set** `{reps?, weightLb?, each?, seconds?, drop?, detail?}`. `weightLb` is **as written**:
    plates for `barbell` exercises (total = `weightLb + barLb`, the 45 lb bar), per hand when
    `each`, and the **added** weight for `added` exercises (weighted dips and chin-ups; Sergio
    tracks only the added weight). `drop` marks drop-set ladders (90-70-45-25-0); `detail`
    describes complexes ("3 pull + 3 muscle + 3 dip + 3 pull") and ladders.
  - **targets** `[{text, times?, kind?}]`: the previous goal Sergio writes in parentheses,
    "(5x5 185 lbs 2 veces)" = hit twice so far. This is his progression system: repeat a target
    until hit a few times, then add weight. Stage 2 should show "target, hit N times" while logging.
  - **problems** (bouldering) `[{grade, color?, result: sent|attempted, count?, attempts?, note?}]`;
    **segments** (treadmill) `[{mph, minutes}]` plus `distanceMi`.
- **`NOTE#<exerciseId>#<date>#<id>`**: the technique log. `text`, `date` (first written),
  `lastSeen`, `sessions` (how many workouts repeat it). Imported cues are the ones written in 2+
  sessions plus hand-picked ones; per-session comments stay on the workout entry.
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
- `parse` applies `private/corrections.json` (git-ignored): `start`, per-message rewrites keyed by
  `"YYYY-MM-DD HH:MM:SS"` (string = new text, `null` = drop, `{entries: [...]}` = given
  directly), `photos` (drop / attach), `textFixes` (typo fixes applied to every message first), `technique` (extra cues), `notTechnique` (repeated
  comments that aren't cues), `routines` (the eras, written by the agent from the chat and the
  2-week rotation photo). Fix parser rules for patterns, corrections for one-offs.
- Check `private/import/review.html` (chat next to result) after any parser change.
- Writing to production (stage 7) is `load --profile gym --table fit --bucket <photos bucket>`;
  it asks for "yes". Re-running replaces earlier `source: whatsapp` rows and never touches
  `source: app` rows.

### API (all under `/api`)

| Area | Endpoints |
|---|---|
| Health | `GET /health` |
| Exercises | `GET /exercises` (catalog + custom, with `lastDone`, `timesDone`) · `POST /exercises` · `GET /exercises/{id}/summary[?exclude=workoutId]` (cues, last, streak) |
| Cues | `POST /exercises/{id}/notes {text, date}` · `PATCH /exercises/{id}/notes/{noteId} {text?, hidden?}` · `DELETE` (same path) |
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
- `backend/.env` (git-ignored) will hold `PASSCODE_HASH` and `SESSION_SECRET` (stage 5a). **Never
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
  bottom tabs. Until stage 4c, wider screens show that same phone layout, centered (fine for
  testing, not the final desktop). Stage 4c builds a separate desktop experience from `lg:`
  (1024px) up, designed from scratch for visitors and reviewers looking at progress: its own
  navigation and page structure, a dashboard home, charts with room to breathe. Tablets
  (768-1023px) keep the phone layout, comfortably widened. Keep data logic in `src/lib/` and
  hooks so both layouts share it and only the views differ.
- Inputs are 16px on touch screens (`index.css`) so iOS doesn't zoom. Big tap targets: this is
  used between sets with sweaty hands. Hover states are only extras (touch has none).
- **Dark mode** mirrors the Tailwind palette with CSS variables in `index.css` (copied from the
  pantry); it applies before first paint (inline script in `index.html`, localStorage key
  `gym.theme`). Use stone/emerald/amber/sky/red classes and dark mode comes for free.
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
