# Backlog

Open work for the gym tracker. Context, conventions and status are in [AGENTS.md](../AGENTS.md).
Move an item to "Done" (with its PR) when it ships, and add new requests here as they come up.
Each stage ends at the usual gate: tests, a 390x844 check (light and dark), Sergio's phone test
through ngrok, then a PR that Sergio merges.

## The plan (agreed 2026-10-29)

| Stage | Branch | What | Gate |
|---|---|---|---|
| 0 | `stage-0-skeleton` | Skeleton, Compose, CI/CD, docs | `docker compose up` works, CI green |
| 1 | `stage-1-import` | **WhatsApp analysis:** read `private/*.txt`, report every exercise and its spellings, routine eras, formats, oddities. Sergio approves the exercise list and schema. `scripts/import_whatsapp.py` (code only): parse to the model, dry-run report, idempotent (deterministic ids). Load into **local** DynamoDB. Tests use synthetic chat lines. | Sergio confirms a sample of parsed sessions matches the chat |
| 2 | `stage-2-train` | **Logging:** start workout (stopwatch), pick or create exercises, add sets with quick taps pre-filled from last time, rest timer, finish (duration saved); edit or delete a workout. | Tests, phone test at the gym |
| 3 | `stage-3-history` | History grouped by week, workout detail, filter by exercise, exercise catalog with merge and rename. | Same |
| 4a | `stage-4a-progress` | Consistency calendar heatmap, streaks, sessions per week; strength chart per exercise with PRs (Recharts). | Same |
| 4b | `stage-4b-progress` | Volume and time charts; routine evolution timeline. | Same |
| 5a | `stage-5a-guests` | Guest sandboxes (copy of owner data, 24h TTL) and owner passcode login, ported from the pantry; sample data if the owner has none. | Guests can't reach owner data (tests) |
| 5b | `stage-5b-welcome` | Welcome page with Sergio's note and photo, tutorial clips, PWA manifest and icons, desktop QR. | Same |
| 6a | `stage-6a-aws` | Terraform on profile `gym`: Lambda, API Gateway, DynamoDB, CloudFront, SSM, alarms; terraform CI job and Dependabot entry. | `/api/health` on the CloudFront URL |
| 6b | `stage-6b-deploy` | GitHub OIDC deploy role; set `DEPLOY_ENABLED`, `DISTRIBUTION_ID`, `SITE_URL` repo variables. | A merge deploys automatically |
| 6c | `stage-6c-domain` | ACM for `gym.sergiovanegas.com`; Sergio adds 2 CNAMEs at Hostinger. | Site loads on the domain |
| 7 | `stage-7-prod-import` | `import_whatsapp.py --profile gym --table fit --space main`: dry run, then real. Verify counts and dates; guests see the history. PITR on before writing. | Sergio checks Progress on their phone |

## Now

Stage 0 PR open. Next: stage 1.

## Needs Sergio

- **WhatsApp export** for stage 1: open the chat, tap its name, **Export chat**, **Without
  media**; put the `.txt` (or the iPhone `.zip`) in `private/` at the repo root.
- Later: alert email (6a), passcode via `set_passcode.py` (5a), Hostinger access (6c), welcome
  note text and photo (5b).

## Ideas and improvements

None yet; add as they come up.

## Done

- 2026-10-29: AWS profile `gym` (IAM user `gym-deployer`) created by Sergio; public repo
  `smvanegasp/fit-mgmt-app` created with `private/` git-ignored from the first commit.
