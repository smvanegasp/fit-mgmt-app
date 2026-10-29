# Backlog

Open work for the gym tracker. Context, conventions and status are in [AGENTS.md](../AGENTS.md).
Move an item to "Done" (with its PR) when it ships, and add new requests here as they come up.
Each stage ends at the usual gate: tests, a check in light and dark at phone 390x844 (main
target), tablet 820x1180 and desktop 1440x900, Sergio's phone test through ngrok, then a PR that
Sergio merges.

## The plan (agreed 2026-10-29; updated the same day for screen sizes and notes/photos)

| Stage | Branch | What | Gate |
|---|---|---|---|
| 0 | `stage-0-skeleton` | Skeleton, Compose, CI/CD, docs | `docker compose up` works, CI green |
| 1 | `stage-1-import` | **WhatsApp analysis:** read the export in `private/`, report every exercise and its spellings, routine eras, formats, **technique notes and photos**, oddities. Sergio approves the exercise list and schema. `scripts/import_whatsapp.py` (code only): parse workouts, exercise notes and photos (matched to exercises by message and time), dry-run report, idempotent (deterministic ids). Photos go to S3 (S3Mock locally, added to Compose). Load into **local** DynamoDB. Tests use synthetic chat lines. | Sergio confirms a sample of parsed sessions and notes matches the chat |
| 2 | `stage-2-train` | **Logging:** start workout (stopwatch), pick or create exercises, add sets with quick taps pre-filled from last time, rest timer, add a note or photo to an exercise or the workout, finish (duration saved); edit or delete a workout. | Tests, phone test at the gym |
| 3 | `stage-3-history` | History grouped by week, workout detail, filter by exercise. **Exercise page:** technique log (dated notes and photos, add/edit), last sessions, catalog with merge and rename. | Same |
| 4a | `stage-4a-progress` | Consistency calendar heatmap, streaks, sessions per week; strength chart per exercise with PRs (Recharts). | Same |
| 4b | `stage-4b-progress` | Volume and time charts; routine evolution timeline. | Same |
| 4c | `stage-4c-desktop` | **Desktop experience, designed separately** (from 1024px), not the phone layout stretched. First a short design proposal (mockup screenshots) for Sergio to approve, then build: its own navigation, a dashboard home (streak, sessions, PRs, calendar, key charts at a glance), history and exercise pages with room for charts, notes and photos side by side. Phone layout untouched. | Sergio approves the desktop design on a computer |
| 5a | `stage-5a-guests` | Guest sandboxes (copy of owner data incl. notes and photos, 24h TTL) and owner passcode login, ported from the pantry; sample data if the owner has none. | Guests can't reach owner data (tests) |
| 5b | `stage-5b-welcome` | Welcome page with Sergio's note and photo (phone and desktop versions), tutorial clips, PWA manifest and icons. No "made for your phone" QR popup: desktop is a first-class view. | Same |
| 6a | `stage-6a-aws` | Terraform on profile `gym`: Lambda, API Gateway, DynamoDB, CloudFront, SSM, alarms; terraform CI job and Dependabot entry. | `/api/health` on the CloudFront URL |
| 6b | `stage-6b-deploy` | GitHub OIDC deploy role; set `DEPLOY_ENABLED`, `DISTRIBUTION_ID`, `SITE_URL` repo variables. | A merge deploys automatically |
| 6c | `stage-6c-domain` | ACM for `gym.sergiovanegas.com`; Sergio adds 2 CNAMEs at Hostinger. | Site loads on the domain |
| 7 | `stage-7-prod-import` | `import_whatsapp.py --profile gym --table fit --space main`: dry run, then real. Verify counts and dates; guests see the history. PITR on before writing. | Sergio checks Progress on their phone |

## Now

Stage 0 merged (#1). The export (with media) is in `private/` (2026-10-29). Next: stage 1.

## Needs Sergio

- Done: **WhatsApp export** for stage 1: open the chat, tap its name, **Export chat**, **Include
  media** (the photos are part of the technique log); put the `.zip` (or the `.txt` plus media
  files) in `private/` at the repo root. Android caps exports with media at the most recent
  ~10,000 messages; if the chat is longer, also export **Without media** for the full text.
- Later: alert email (6a), passcode via `set_passcode.py` (5a), Hostinger access (6c), welcome
  note text and photo (5b).

## Ideas and improvements

None yet; add as they come up.

## Done

- 2026-10-29: Stage 0 skeleton, local stack, CI/CD and docs (#1). The ngrok tunnel has no
  password, by Sergio's choice.
- 2026-10-29: AWS profile `gym` (IAM user `gym-deployer`) created by Sergio; public repo
  `smvanegasp/fit-mgmt-app` created with `private/` git-ignored from the first commit.
