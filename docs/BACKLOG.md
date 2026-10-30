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

Stages 0-3 merged (#1, #3, #4, #5, #6, #7). **Stage 4a (Progress) is in review** on
`stage-4a-progress`: Sergio tests it on their phone. Then 4b (volume, drop sets, climbing, routine timeline, time), 4c (separate
desktop design), 5a guests and passcode, 5b welcome page, 6a-6c AWS, 7 production import.

## Stage 4a: what's in it

- **Tiles:** current and longest streak in **weeks** (a week counts with 3+ workouts; this week
  doesn't break it while it's going), and workouts this year. The goal of 3 is `WEEKLY_GOAL` in
  `lib/progress.ts` (Sergio to confirm).
- **Range chips** (3 months, 6 months, 1 year, all time; default 6 months) scope everything below.
- **Consistency:** a small calendar per month, newest first, training days colored by day type
  (Push blue, Legs orange, Pull aqua, Cardio gray; tap a day to open the workout); workouts per
  week as stacked bars with the goal line; tap or drag to read a week.
- **Strength:** squat, deadlift, bench, dips, chin-ups. Line = top working set per session as
  written (plates; the readout adds the bar; added weight for dips and chin-ups); ringed dots are
  PRs; light days are gray dots off the line. Under it, one target-game dot per session (reached,
  new target, missed, light day). A readout row shows the picked session (latest by default) and
  opens it. The name opens the exercise page, which has the same chart for any exercise
  (body-weight work plots the most reps in a set).
- Charts are plain SVG, not Recharts (shared x scale for the line and the dots, touch readouts,
  no dependency).

## Stage 3: what's in it

- History tab, **Workouts**: weeks ("This week", "Last week", "Oct 12 – 18") with counts, cards with
  the main sets; filters by day type (Push, Legs, Pull, Cardio) and by exercise.
- **Workout detail** (read view): date, time, duration, each exercise (sets and drop set apart,
  boulders, distance), notes, photos, laps (folded); Edit opens the editor; tap an exercise to open
  its page. The Train tab's "Last workouts" open the same view.
- **Exercise page**: sessions, since, best set; the target game; best drop set; the full cue list
  (edit, hide, add; originals shown); all photos; every session (tap to open it). Pencil: rename,
  change category, or merge a duplicate into another exercise (sessions and cues move over).

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
  lift go better, shown when they start the exercise; top 3 by how often they were written, more
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
| Stopwatch laps, they use them a lot; logging a set should start a lap (rests 4-5 min) | Lap button + running lap; each set ends a lap labeled with it; lap list; saved with the workout |
| "Recent" on the first page isn't clear | Day-type chips ("next up" preselected) + "Start Squat workout"; "Last workouts" cards with date, type, duration, main sets |
| Keep in mind: bullets, all in English | Bullets; 50 cues translated (original kept, shown in the edit sheet) |
| Target: goal is 3 in a row; a miss takes one away | The target game, replayed over history and synced to their written counts |
| Adding exercises is too complex; better categories | Picker opens on "Usual on <day> days" in usual order; chips: Recent, Push, Pull, Legs, Hips & hamstrings, Core, Skills, Climb & run |
| See the photos taken for an exercise (setups) | "Your photos" on each exercise card |
| Rest: keep the countdown, up to 5 min, default 5 min | Choices 1-5 min, default 5:00 |

## Feedback round 2 on stage 2 (Sergio, 2026-10-30)

| What Sergio said | Done |
|---|---|
| Laps in a toggle, to see how much they rested | Tap the running lap under the stopwatch: the lap list opens in place, newest first |
| Remove the rest timer; they manage rest with laps | Removed |
| "Last" doesn't separate the target sets from the drop set | "Last time" box: Sets and Drop set rows; ladders as weight×reps chips |
| See the best drop set so far | Best drop (most total reps) on the card and in the drop-set sheet, with the running total and "new best" |

## Feedback round 3 on stage 2 (Sergio, 2026-10-30)

| What Sergio said | Done |
|---|---|
| From now on legs is one day: heavy squat + lighter deadlift, alternating with heavy deadlift + light squats | One "Legs" day type (old Squat / Deadlift days count as Legs for the rotation, but keep their names); "Heavy squat today" from the last Legs day; heavy lift first in the picker; the first set starts from the target when last time was light; new routine era "One legs day" from 2026-10-30 |
| Red instead of green, a shade that looks good | Tried red; replaced by blue in round 4 |

## Feedback round 4 on stage 2 (Sergio, 2026-10-30)

| What Sergio said | Done |
|---|---|
| Front lever is pull; climbing is pull | Front lever exercises, the muscle-up complex and bouldering are in Pull; old Front lever and Climb days count as Pull days |
| Run is cardio; weekly cardio from now on (Peloton run or walk) | Cardio day type and category; new exercises Peloton run and Walk (distance + minutes) |
| Red isn't good; try blue | Blue accent (light and dark), red only for errors and delete |
| Notes weren't translated, and editing showed a mismatch | All 171 imported texts translated (notes, captions, climbing notes) via a private table; editing a past workout now shows its target and "last time" as of that date |

## Feedback round 1 on stage 3 (Sergio, 2026-10-30)

| What Sergio said | Done |
|---|---|
| One workout per day; exercises from the same day weren't merged | Import groups by day (177 workouts); in the app, a second session the same day joins the first; training time adds the sessions, not the hours between |
| Bullets for the exercises on the cards | Done |
| Date boxes grew with the card | Fixed size |
| Unclear times; estimate better: ~20 min warm-up before any message, first message after the first exercise (~40 min, 5 min rests) | Each session starts ~60 min before its first message, ends at the last; shown as "~5:37 PM · ~1 h 28 min" with a one-line explanation |
| Still some Spanish | All imported text checked (0 left); three non-training messages that had joined a day dropped; Spanish originals no longer shown under cues; two Spanish UI examples replaced |
| Wants plots | Belong in Progress (stage 4); proposal below |
| Bullets not visible; pills cut on top; drop the exercise filter pill; "Hips & hamstrings" is legs | Bullets drawn inside the line; pill rows get room for their outline; filter removed; deadlift, RDL, leg curl, back extension are Legs |

## Stage 4: plot plan (proposed 2026-10-30)

| Question | Plot | Stage |
|---|---|---|
| Am I consistent? | Calendar heatmap of training days (a year, colored by day type) + current / longest streak + workouts per week bars with a goal line | 4a |
| Am I getting stronger? | Per exercise: top-set weight over time (line, PR dots); body-weight work: reps; small multiples for the main lifts (squat, deadlift, bench, dips, chin-ups) | 4a |
| How is the target game going? | Per lift: one dot per session (reached / missed / light day) under the strength line | 4a |
| How much work? | Weekly volume (weight x reps), stacked by day type | 4b |
| Drop sets | Total reps per ladder over time | 4b |
| Climbing | Hardest grade sent per session (step line) + grade pyramid | 4b |
| Routine evolution | Timeline of routine eras with session dots | 4b |
| Time | Session length and rest (from laps) trend | 4b |

## Ideas and improvements

None yet; add as they come up.

## Done

- 2026-10-30: Stage 3 History merged (#6), after two feedback rounds.
- 2026-10-30: Stage 2 Train tab merged (#5), after four feedback rounds.
- 2026-10-29: Stage 1 WhatsApp import merged (#4).
- 2026-10-29: Stage 1 decisions: bar = plates + 45 lb; weighted dips/chin-ups track added weight
  only; English exercise names; bouldering and treadmill included.
- 2026-10-29: Plan updates: phone first with a separate desktop design in stage 4c, exercise
  notes and photos (#3).
- 2026-10-29: Stage 0 skeleton, local stack, CI/CD and docs (#1). The ngrok tunnel has no
  password, by Sergio's choice.
- 2026-10-29: AWS profile `gym` (IAM user `gym-deployer`) created by Sergio; public repo
  `smvanegasp/fit-mgmt-app` created with `private/` git-ignored from the first commit.
