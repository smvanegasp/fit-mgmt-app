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
| 1 | `stage-1-import` | **WhatsApp import:** read the export in `private/`, report every exercise and its spellings, routine eras, formats, **technique notes and photos**, oddities. Sergio approves the exercise list and schema. `scripts/import_whatsapp.py` (code only): parse workouts, exercise notes and photos (matched to exercises by message and time), dry-run report, idempotent (deterministic ids). Photos go to S3 (S3Mock locally, added to Compose). Load into **local** DynamoDB. Tests use synthetic chat lines. | Sergio confirms a sample of parsed sessions and notes matches the chat |
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

Stage 2 PR open (Train tab). Waiting for Sergio to try it at the gym through ngrok. Next is
stage 3 (History). Stage 1 is merged (#4): 179 imported sessions (2025-09-05 to 2026-10-29),
1,783 sets, 51 technique cues, 15 photos, 3 routine eras, in the local stack.

### Stage 1: interpretations Sergio confirmed

- Dip and chin-up drop sets are always 90-70-45-25-0 lb; the other line is the reps. The
  2026-01-02 one reads 6-2-2-2-3.
- 2026-09-07 squats "50 lbs" is 150. 2026-05-11 "Bench press 40 lbs 5x8" was dumbbells (40 each).
- "Pull up muscle up intercaladas N": alternating muscle-up, pull-up, muscle-up, pull-up (N
  muscle-ups).
- "Bar dips" = "Wide bar dips"; "Close ups" = close-grip chin-ups; Smith machine bar = 45 lb.
- "Psychosis Dope" is a song Sergio paces sets to: a set, rest during the second scream, a set.
  Kept as a chin-up cue.
- Typos are standardized through `textFixes` in the private corrections (Sergio's OK).
- Imported session times run from the first to the last message (warm-up not included).
- 2025-11-11 "Chin ups 1x5 45 lbs" sent the day after the pull session: kept on 2025-11-11.

## Stage 2: what's in it

- Start: stopwatch from a server-side start time (survives locking and reloads), "Next up" from
  the rotation, recent workouts (tap to edit or delete).
- Each exercise: **technique cues** (Sergio, 2026-10-29: the checklist of things that make the
  lift go better, shown when he starts the exercise; top 3 by how often they were written, more
  on tap, add / edit / hide), "Last" session, **target streak** computed from history ("Target
  5×5 @ 170, done 2 times in a row": the last session's first group of working sets and how many
  sessions in a row reached it), set logger with big steppers pre-filled from the last set or
  last session, drop-set ladder (last time's weights and reps filled in), notes and photos.
- Bouldering (grade, hold color, sent / tried, count) and treadmill (distance, minutes).
- Autosave, finish or discard. Rest is timed with laps (no rest timer, Sergio's choice).
- Not in this stage: History tab, exercise pages, charts (stages 3 and 4).

## Needs Sergio

- Done: **WhatsApp export** for stage 1: open the chat, tap its name, **Export chat**, **Include
  media** (the photos are part of the technique log); put the `.zip` (or the `.txt` plus media
  files) in `private/` at the repo root. Android caps exports with media at the most recent
  ~10,000 messages; if the chat is longer, also export **Without media** for the full text.
- Later: alert email (6a), passcode via `set_passcode.py` (5a), Hostinger access (6c), welcome
  note text and photo (5b).

## Feedback round 1 on stage 2 (Sergio, 2026-10-30), done on the same PR

| What Sergio said | Done |
|---|---|
| Stopwatch laps, he uses them a lot; logging a set should start a lap (rests 4-5 min) | Lap button + running lap; each set ends a lap labeled with it; lap list; saved with the workout |
| "Recent" on the first page isn't clear | Day-type chips ("next up" preselected) + "Start Squat workout"; "Last workouts" cards with date, type, duration, main sets |
| Keep in mind: bullets, all in English | Bullets; 50 cues translated (original kept, shown in the edit sheet) |
| Target: goal is 3 in a row; a miss takes one away | The target game, replayed over history and synced to his written counts |
| Adding exercises is too complex; better categories | Picker opens on "Usual on <day> days" in usual order; chips: Recent, Push, Pull, Legs, Hips & hamstrings, Core, Skills, Climb & run |
| See the photos taken for an exercise (setups) | "Your photos" on each exercise card |
| Rest: keep the countdown, up to 5 min, default 5 min | Choices 1-5 min, default 5:00 |

## Feedback round 2 on stage 2 (Sergio, 2026-10-30)

| What Sergio said | Done |
|---|---|
| Laps in a toggle, to see how much he rested | Tap the running lap under the stopwatch: the lap list opens in place, newest first |
| Remove the rest timer; he manages rest with laps | Removed |
| "Last" doesn't separate the target sets from the drop set | "Last time" box: Sets and Drop set rows; ladders as weight×reps chips |
| See the best drop set so far | Best drop (most total reps) on the card and in the drop-set sheet, with the running total and "new best" |

## Ideas and improvements

None yet; add as they come up.

## Done

- 2026-10-29: Stage 1 WhatsApp import merged (#4).
- 2026-10-29: Stage 1 decisions: bar = plates + 45 lb; weighted dips/chin-ups track added weight
  only; English exercise names; bouldering and treadmill included.
- 2026-10-29: Plan updates: phone first with a separate desktop design in stage 4c, exercise
  notes and photos (#3).
- 2026-10-29: Stage 0 skeleton, local stack, CI/CD and docs (#1). The ngrok tunnel has no
  password, by Sergio's choice.
- 2026-10-29: AWS profile `gym` (IAM user `gym-deployer`) created by Sergio; public repo
  `smvanegasp/fit-mgmt-app` created with `private/` git-ignored from the first commit.
