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
- **Units:** pounds (lb). No AI in the app.
- **Owner:** Sergio (GitHub `smvanegasp`). Repo <https://github.com/smvanegasp/fit-mgmt-app>
  (**public**). Target URL `https://gym.sergiovanegas.com`. Sergio develops on Windows 11 (Git
  Bash, VS Code, Node 24, uv, Docker Desktop, Terraform, ngrok).

## 2. How we work (follow this)

- **Small stages, each ending at a gate:** tests pass, the agent checks the UI in a phone-sized
  browser (390x844, light and dark), Sergio tests on their phone through ngrok, then a PR. **Don't
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
| 0 | Skeleton: FastAPI + React/Vite, Docker Compose, CI (tests, build, Docker, secret scan), deploy workflow (off until 6b), Dependabot, docs | open |

Next: **stage 1, WhatsApp import** (needs the chat export in `private/`). Full plan in
[docs/BACKLOG.md](docs/BACKLOG.md).

## 4. Architecture

```
Phone ─ HTTPS ─▶ (local) ngrok ─▶ Vite dev server :5180 ─ /api proxy ─▶ FastAPI :8090
                                                                        └─ DynamoDB Local :8010
(AWS, stage 6) CloudFront ─┬─ /*     → S3 (built frontend)
                           └─ /api/* → API Gateway → Lambda (same Docker image) → DynamoDB
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
docker-compose.yml          api (FastAPI), dynamodb (DynamoDB Local), web (node:22 Vite)
.github/workflows/ci.yml    pytest, vitest + build, docker build --target app, gitleaks
.github/workflows/deploy.yml  after CI on main: image -> ECR, Lambda, frontend -> S3 (needs
                            repo variable DEPLOY_ENABLED=true; off until stage 6b)
.github/dependabot.yml      weekly grouped updates
.mcp.json                   Playwright, AWS docs, Terraform MCP servers
ngrok-policy.example.yml    copy to ngrok-policy.yml (git-ignored) for a password on the tunnel
scripts/upload_frontend.sh  frontend/dist -> S3 + CloudFront invalidation
private/                    git-ignored: the WhatsApp export and anything parsed from it
backend/
  app/main.py               app, /api/health, CloudFront-only middleware on AWS, creates the
                            table locally (AUTO_CREATE_TABLE=1)
  app/config.py             env config
  app/ssm.py                SSM /fit/* -> environment variables at startup (SSM_PREFIX)
  app/db.py                 DynamoDB single table: put/get/query/delete; Decimal <-> int/float
  tests/                    pytest with moto (in-memory AWS)
frontend/
  src/App.tsx               tabs Train / History / Progress / Settings
  src/api.ts, hooks.ts      API client and TanStack Query hooks
  src/pages/                TrainPage, HistoryPage, ProgressPage, SettingsPage
  src/components/           ComingSoon (placeholder)
  src/lib/                  pure logic + tests: duration (stopwatch text), theme
```

### Data model (DynamoDB, one table `fit`, `pk`/`sk`; draft, finalized in stage 1)

- `pk = SPACE#main` is Sergio's log; `SPACE#sb-<unixExpiry>-<hex>` is a guest sandbox (stage 5a;
  rows carry `ttl`).
- `sk`: `EXERCISE#<id>` (name, muscle group, type, chat aliases) · `WORKOUT#<yyyy-mm-dd>#<id>`
  (start/end, day label, notes, entries with sets `{weightLb, reps}` or `{seconds}`, source
  `whatsapp`/`app`) · `ROUTINE#<id>` (split, from/to dates) · `ACTIVE` (workout in progress,
  server-side `startedAt`) · `SETTINGS`.
- Numbers: `db.py` stores floats as Decimals and returns whole numbers as ints, others as floats
  (22.5 lb).

### API (all under `/api`)

| Area | Endpoints |
|---|---|
| Health | `GET /health` |

## 5. Run, test, preview

```sh
docker compose up -d --build          # app at http://localhost:5180 (API docs :8090/api/docs)
ngrok http 5180 --traffic-policy-file ngrok-policy.yml   # phone URL, password-protected
cd backend && uv run pytest -q
cd frontend && npm test && npm run build
```

- Hot reload works through file polling (Docker on Windows doesn't forward file events).
  Rebuild the API after backend dependency changes (`docker compose up -d --build api`), restart
  `web` after frontend dependency changes.
- Phone-sized screenshots without the MCP server: a small Node script can load Playwright from
  the pantry's `frontend/node_modules` (`createRequire`) and shoot 390x844 in both color schemes.

## 6. Secrets, privacy and safety rules (important)

- **The repo is public.** Never commit keys, tokens, passwords, `.env` files, Terraform state or
  `*.tfvars`. `.gitignore` covers them; CI runs **gitleaks** on every push and PR. Always check
  `git status` and the staged diff before committing, and never commit files you didn't create.
- **`private/` holds Sergio's WhatsApp export and must never be committed** (git-ignored). Only
  code (the import script and tests with synthetic lines) goes in the repo; parsed workouts go
  straight into DynamoDB, never into a seed file in git.
- `backend/.env` (git-ignored) will hold `PASSCODE_HASH` and `SESSION_SECRET` (stage 5a). **Never
  print, cat or paste secrets.** Never ask Sergio to paste a key or passcode into chat; they run
  the scripts or edits `.env` themself. On AWS they are SSM SecureStrings under `/fit/`.
- AWS access: profile **`gym`** (IAM user `gym-deployer`, AdministratorAccess, same account
  816940506502 as the pantry but a fully separate stack). Sergio created its keys themself;
  they live only in `~/.aws/credentials`. GitHub Actions never gets AWS keys (OIDC role).
- **Never touch the pantry's AWS resources** (profile `pantry`, anything named `pantry-*`).
- Once their real history is in production (stage 7), **never change or delete `SPACE#main`**
  without Sergio's explicit OK. Test in sample guest sandboxes.

## 7. UI conventions and gotchas

- **Mobile first**, 390x844 reference. Inputs are 16px on touch screens (`index.css`) so iOS
  doesn't zoom. Big tap targets: this is used between sets with sweaty hands.
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
