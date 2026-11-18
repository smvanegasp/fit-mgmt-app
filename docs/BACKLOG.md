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
| 7 | (no branch: data only) | `import_whatsapp.py --profile gym --table fit --space main`: dry run, then real. Verify counts and dates; guests see the history. PITR on before writing. | Sergio checks Progress on their phone |

## Now

**Stage 10a** is merged and live (#32). Open: #33 (`fix-ios-full-screen`), full-screen pages on the
iPhone, waiting for Sergio's phone check.

## Stage 10a: the Lovable redesign (2026-11-17)

Sergio designed a new frontend in Lovable ("the soul of the app") on a copy of `frontend/src` with mock
data, and asked for it to be integrated, frontend first. The Lovable code changed only a handful of
components; the rest of the look is a token remap in its `styles.css`.

- **Theme ("Iron & Ember")** in `index.css`: Tailwind's stone, blue, sky, amber, red, emerald and
  white tokens remapped (blue is now the blood-red accent, so component classes stay), sharp radii,
  film grain, ember glow on the running stopwatch, a flash-and-shake celebration. Lovable's shadcn
  tokens, `tw-animate-css` and the unused blackletter font were left out.
- **Fonts:** Anton (display) and Archivo (body), self-hosted with `@fontsource` like Barlow Condensed
  was (Lovable loaded them from Google Fonts); Barlow is removed.
- **Logo:** the barbell on a bone square; favicon, app icons (`make-icons.mjs` updated), theme color
  `#0b0909`. Welcome page header on a grayscale gym photo (`src/assets/bw-dream-gym.jpg`).
- **Streak card on Train** (replaces the "This week" link): streak, longest, a ladder to the next
  milestone (4/8/12/16/24/36/52 weeks, then yearly), what the week still needs and the days left,
  amber when 2 or fewer days are left and the goal isn't met. A milestone crossed while the app is
  open gets its own congrats. Frontend only, from `/api/progress` days: no backend needed.
- **Main lifts chart only their first-lift sessions:** Lovable had the same change; it shipped first in
  #31, so this PR takes main's version.
- **Chart colors re-stepped:** Lovable's Pull (steel teal) was too close to Cardio gray (dE ~10) and
  its light Legs had 2:1 contrast; now Push #c4202f / #cc2536, Legs #b07d1e / #bf8a2e, Pull #2a6fc9 /
  #3a7fe6 (light / dark), passing the dataviz validator except the deliberate gray.
- **Sample log** gets a Saturday Peloton ride, so sample demos meet the 3 + 1 goal and show a streak
  (Lovable's roadmap noted the samples looked off). **Clips re-recorded** in the new look (tap marker
  red; the History poster now uses the clip's first frame instead of a loading screen).
- Checked: backend 104 and frontend 81 tests, build; screenshots in a sample demo at 390x844,
  820x1180 and 1440x900 in dark and light (welcome, Train, History, Progress, Settings, an exercise
  page, a workout in progress). Not tested: the milestone congrats in a real browser (unit-tested
  only), Sergio's phone.

### Feedback round 1 on 10a (Sergio, 2026-11-17)

| Item | Done |
|---|---|
| On the iPhone (Chrome, so WebKit), an exercise opened from Progress, or from a workout opened in History, didn't cover the screen: the page under it still showed. Not reproduced in Chromium or WebKit emulation. | The two iOS-sensitive pieces of the redesign are gone: the grain no longer uses `mix-blend-mode: overlay` (plain gray noise at lower opacity, same look in screenshots) and the body gradient no longer uses `background-attachment: fixed`. Waiting for Sergio's phone check. |

### Stage 9 (done): the first round of in-app feedback

19 notes from Sergio, 2026-11-02 to 11-17, agreed 2026-11-17, in four PRs.

| Stage | Branch | What |
|---|---|---|
| 9a | `stage-9a-fixes` | **Bugs.** (1) The pull-up target showed the old scheme after Sergio went up in weight; find the cause by replaying the history and fix the target game. (2) Legs: squat and deadlift use different weights as the main lift and as the second lift, so the target breaks; keep one target per role (main = first lift of the day, second). (3) A workout left open ran 46 hours: auto-finish 2 hours after the start, ending at the last logged set; correct that workout on AWS (Sergio's OK, 2026-11-17). (4) Reps typed in the logger are lost when switching screens: keep the draft in the autosaved workout. (5) The phone in landscape looks broken. |
| 9b | `stage-9b-train` | **Train flow.** Bigger numbers in the steppers; "Done" on an exercise folds it so the current one gets the room; the start screen shows the last two workouts and their day types; the exercise picker opens filtered to today's day type; today's usual exercises pre-filled in order, always starting with a timed warm-up; a short congrats when a target is reached (mainly the first, heavy lift). |
| 9c | `stage-9c-history` | **History and progress.** Consistent workout names: day type plus the first exercise ("Legs · Squat"); a top-weight-over-time chart on each exercise page; log body weight (and add 159.4 lb on 2026-11-03). |
| 9d | `stage-9d-peloton` | **Peloton** (cardio): the class summary screenshot from the Peloton app, attached to the entry. Sergio, 2026-11-17, after trying a typed form: no typing, just the photo, from the photo library. Then, after trying it: the stats are read from the screenshot after all (see 9d below). |

## Stage 9d: what's in it (2026-11-17)

- **Photos from the library:** the photo input had `capture="environment"`, which makes an iPhone
  open the camera only. Without it the phone offers the photo library, the camera or files, for
  every photo in the app (setup photos, notes, Peloton).
- **Peloton:** a Peloton entry (distance and time, as before) gets "Add the Peloton screenshot";
  the summary is stored as the entry's photo. A typed form (class, output, calories, heart rate) was
  built first and dropped at Sergio's request: no typing, just the screenshot.
- **Feedback round 1 on 9d (Sergio, same day):** the stats should be saved from the photo, Peloton
  progress should show, the weekly goal becomes 3 strength + 1 cardio, and their three rides
  (screenshots in the workspace) should be added. Done:
  - **Reading the screenshot** (the second AI feature, now wanted): qwen/qwen3.8-27b on Groq (the only
    vision model on the account's key; Llama vision models aren't offered) reads the class, instructor,
    length, output, distance, calories, watts, cadence, resistance and speed. Tested on the three real
    screenshots: every stat right, but one date misread (11/1 as 11/12), so dates aren't read. Owner
    only; ~1 s; the photo is saved even if reading fails. Distance and time fill in when empty.
  - **Peloton ride** in the catalog (Sergio rides the bike; Cardio days start with it).
  - **Progress:** the ride's page charts total output per ride (distance for runs without output);
    a "Peloton rides" card on Progress (rides, last, best, the line).
  - **Weekly goal:** 3 strength days + 1 cardio day, from the week of 2026-10-26; older weeks keep 3
    workouts, so the streak carries over. Days carry `cardio` (a ride/run/walk entry, a Cardio day,
    or an old "+ Run"); Train, Progress (both layouts), the heatmap marks and the welcome page use it.
  - **The three rides** (Nov 1 Metal Ride 291 kJ, Nov 8 Reggaeton 274 kJ, Nov 15 Reggaeton 526 kJ):
    new Cardio workouts on days that had none, with the screenshot as the photo. Added locally; on AWS
    after the merge (the live app needs the new code to show them).
- **Feedback round 2 on 9d (Sergio, same day):**
  - **Screenshots aren't setup photos:** photos carry an optional `kind`; a Peloton screenshot is
    `"screenshot"`. The setup photos shown while training leave screenshots out; the exercise page
    shows "Photos" (setup) and "Screenshots" apart.
  - **A Cardio day is one activity:** choosing Cardio shows the choices (Peloton ride, run, walk,
    treadmill; last time's preselected) and the workout starts with the warm-up and that one, not all
    of them. Other day types keep their full usual list (Sergio likes it there). Cardio is always
    offered as a day type now (part of the weekly goal).
- **Feedback round 3 on 9d (Sergio, same day):** a screenshot didn't get read because their phone had
  logged out and was in a visitor demo, where reading was off. Sergio: visitors should get the same
  experience. Both AI features (screenshot reading and the cue check) are now on in demos, capped at
  20 calls a day per demo and 300 a day across all demos (`app/ai_limits.py`); the owner has no cap.
  Tested end to end in a demo: upload, read, stats shown, distance and time filled in.

## Fix after stage 9 (Sergio, 2026-11-17)

- **Top-weight charts showed low points** for squat: sessions where it was done second (after
  deadlift, lighter) were plotted. Now a main lift (the day's first lift in at least a quarter of its
  sessions) plots only its first-lift sessions; accessories keep every session. On the real log this
  drops squat's two second-lift days and bench's and pull-ups' lighter later sessions; RDL, overhead
  press and other accessories are unchanged. The history API gives each session its `role`. A first-lift
  comeback session after a break (squat 140 on 2026-03-30) still shows: it's real.

## Stage 9c: what's in it (2026-11-17)

- **Data first (Sergio's OK):** the 11-14 Pull workout's end on AWS corrected to its last set (15:25,
  so 1 h 15 min); a scan found no other outliers (the three imported days over 3 hours had two
  sessions and already show their training minutes). The 11-03 weigh-in (159.4 lb) added.
- **Workout names:** "day type · first exercise" ("Legs · Deadlift", the warm-up aside), computed in
  the app from the stored label and entries, so nothing in the log changes. Cards put the name on
  its own line with the date and time under it; exercise pages list sessions by day type.
- **Exercise page chart:** each session's top working weight as logged (plates for barbell lifts,
  added weight for dips and chin-ups; body-weight sessions of a weighted lift left out), most reps
  in a set for body-weight work, longest hold for holds; in the exercise's group color. Tap a point
  to open that workout.
- **Body weight on Progress:** the latest weigh-in, the change since the first, the line, and "Log"
  (weight and date; one per day, logging a day again replaces it). `GET/PUT/DELETE /api/body`. The
  sample demo log has weekly weigh-ins.
- **`LineChart`:** one series over time, built to the dataviz skill (2px line, recessive grid, the
  last value labeled, crosshair and tooltip that snap to the nearest point, arrow keys, a table
  view); the series blue passes the palette validator on both card surfaces.

## Stage 9b: what's in it (2026-11-17)

- **The day is filled in:** starting a workout adds the warm-up and the day type's usual exercises in
  their usual order (Legs: the heavy lift first). Ones never done are dropped when it's saved; the
  finish sheet counts only what was logged.
- **Warm-up, timed:** a catalog exercise (`warm-up`, measure `time`); its time runs from the start
  until "Done warming up" (a lap), then can be adjusted. Not shown as a highlight on workout cards.
- **Room for the current exercise:** only the exercise being done is open; "Done with ..." folds it
  into a one-line summary (tap to reopen) and opens the next, scrolled to just under the stopwatch;
  the rest wait in "Up next" (tap to do one now). Editing a saved workout is unchanged.
- **Last two:** the start screen lists the last two workouts of the chosen day type; in a workout,
  "Push day · last two" folds out both.
- **Exercise picker:** opens on "Usual on <day> days" even when those load after it opens (it fell
  back to Recent before).
- **Bigger steppers:** numbers 48px (36px for long weights like 112.5, so they fit a phone), 56px
  buttons.
- **Congrats:** the set that reaches the target shows the logo's ladder building, "Target reached"
  (or "3 in a row") and the dots, for ~3 s (tap to close; vibrates on Android; still with reduce
  motion).
- **Landscape rail** narrower (Sergio, after 9a): 60px plus three quarters of the side safe area
  (enough to clear the notch) instead of 72px plus all of it.

## Stage 9a: what's in it (2026-11-17)

- **Pull-ups (weighted chin-ups):** on 10-29 Sergio did 4x4 at 90 over a 3x4+1x3 target, but the game
  only moved to more reps after a count of 3, so it kept the old target and counted 11-14's 4-4-4-3
  as reached. Now more reps than the target is the new target at any count: chin-ups show 4x4 @ 90,
  0 of 3. Checked against Sergio's own written targets: the new rule agrees with them where the old
  one didn't (high pull-ups in September, deadlift 3x3 on 09-19).
- **Legs, the lift done second:** squat after deadlift (3x6 @ 155) was a "light day" against the
  main 5x4 @ 180, so it never had a target and the card pre-filled 180. Sessions >10% lighter now
  play a second track; the Train card passes its role (first lift or later) and gets that role's
  target and last time (squat second: 3x6 @ 155, 2 of 3).
- **Left running:** 2 hours without a set or lap finishes the workout at its last set (Train checks
  on open and every minute; an empty one is discarded) with a notice linking to it. The 11-07 Pull
  workout's end on AWS was corrected to its last set (12:54) with Sergio's OK; the 11-14 one (ended
  11-17) is the same case and waits for their OK.
- **Dialed-in set kept:** the weight and reps being set up stay on the phone (`lib/drafts.ts`) until
  logged, so switching tabs or apps doesn't reset them to the suggestion.
- **Landscape:** on a phone turned sideways the bottom tabs took ~45% of the height; now a slim left
  rail (safe-area aware) and a compact stopwatch bar.

## Feedback on stage 8b (Sergio, 2026-10-31)

| What Sergio said | Done |
|---|---|
| The intro is too long: more natural, training as a foundation of life, short, end with something like "Take a look!" | Three options offered; Sergio picked the first and tailored it ("one of the big rocks in my life") |

## Stage 8b: the gym's own identity (2026-10-31)

Sergio: "awesome, but too similar to the pantry"; same UX, own look.

- **Logo** from the set glyph: three columns of squares growing 2-3-4, the past ones faded (the
  progression ladder), replacing the Phosphor barbell tile (the pantry's style). Favicon, app icons,
  sidebar, welcome page.
- **Barlow Condensed** for big numbers and headings (stopwatch, steppers, targets, streak, stats,
  titles); body text unchanged.
- **Dark by default** for anyone who hasn't chosen (Sergio loves the dark look). Considered and left
  as is: dark text on blue buttons in dark mode (it's the intended calmer style).
- **Welcome page** rebuilt around the real log: Gym + "Sergio's training log", three stats
  (workouts, week streak, since), the training-days heatmap, "In training now" (squat, deadlift,
  dips with their set glyph and count), then the note and "How it works" clips; Continue / I'm
  Sergio in a bar fixed at the bottom on phones; two columns on computers. Data from a new public
  endpoint (days and targets only). The heatmap is now one shared component (Progress and Welcome).
- Clips re-recorded (dark).

## Stage 8a: in-app feedback (2026-10-31)

- Anyone with a session (Sergio or a guest) leaves feedback from **Settings** or the **guest banner**:
  a note plus the screen it's about (the last one visited, preselected).
- Stored outside every sandbox (`SPACE#feedback`, no TTL), rate-limited; Sergio's **inbox** in
  Settings (new count, mark done). A guest's feedback **emails Sergio** (alarm
  `fit-guest-feedback`, at most one email per 15 min).
- The agent reads it at the start of each session with `scripts/feedback.py` (AGENTS.md section 2).
- The demo banner got tighter to fit Feedback: Reset is now an icon.

## Stage 7: the production import (2026-10-31, with Sergio's OK)

- Dry run: a fresh parse (177 sessions, 1,780 sets, 50 cues with sections, 4 routines, 15 photos,
  1 body-weight entry). PITR confirmed on and the owner space empty first.
- `import_whatsapp.py load --profile gym --table fit --bucket fit-photos-816940506502`.
- Checked: AWS and local match row by row (workouts, routines, body weight identical; cues differ
  only by an explicit `hidden: false`; 4 exercise rows only by the old `posterior` group name, which
  the app ignores). A visitor demo on the domain shows the real log, cues and photos.

## Stage 6c: what's in it (2026-10-31)

- `infra/domain.tf`: an ACM certificate for gym.sergiovanegas.com, validated by DNS, and CloudFront
  serving the domain (in place, no downtime). Sergio added two CNAMEs at Hostinger (validation and
  `gym` -> CloudFront). Applied with Sergio's OK: 2 additions, 1 in-place change.
- `SITE_URL` (the deploy check) is now the domain. Checked: HTTPS, certificate until May 2027 (renews
  itself), security headers, the cloudfront.net address still works.

## Stage 6b: what's in it (2026-10-30)

- `infra/github.tf`: IAM role `fit-github-deploy` that only workflows on `main` of this repo can
  assume (GitHub OIDC, immutable subject); it reads the account's existing OIDC provider (the
  pantry's). Applied with Sergio's OK (2 additions).
- Repo variables `DEPLOY_ENABLED=true`, `DISTRIBUTION_ID`, `SITE_URL`; a manual Deploy run passed
  (image, Lambda, frontend, health check).
- Expected cost of the whole stack: about $0.10-0.25 a month at this usage (mostly free tier).

## Stage 6a: what's in it (deployed 2026-10-30)

- Terraform ported from the pantry, all `fit-*` on profile `gym`: state bucket (`infra/bootstrap`),
  DynamoDB `fit` (PITR, deletion protection, TTL), photo and web buckets, ECR + Lambda `fit-api`
  behind an HTTP API, CloudFront (origin secret; direct API Gateway calls get 403), SSM `/fit/`
  secrets, SNS email alarms (wrong passcode, cue check failing, API 5xx, Lambda errors).
- `scripts/deploy.sh` and `scripts/set_aws_secrets.py`; terraform fmt/validate in CI; Dependabot.
- Checked live: health, 401 without a session, API docs hidden, a sample demo, the welcome page
  and clips.

## Feedback round 1 on stage 5b (Sergio, 2026-10-30)

| What Sergio said | Done |
|---|---|
| Call it just "Gym" | Welcome page, sidebar, browser title and the installed app name |
| Use the photo in private/ | Cropped around the face, 256 px, metadata (location) stripped |
| The note: 12 years of calisthenics and weightlifting, then the last year logged | Rewritten in their words; the clips shrink a little so the page still fits a phone |

## Stage 5b: what's in it

- **Welcome page** (adapted from the pantry) instead of the plain start screen: Sergio's photo and a
  short note, three looping clips (log a workout, the progress, history by month), Continue (a copy
  of the log) and I'm Sergio. Fits a 390x844 phone without scrolling; on computers, two columns
  with the clips side by side.
- **Clips** recorded with Playwright in sample demos (`npm run record-tutorials`, ~460 KB in all).
  The sample log gained deadlifts.
- **App icon** (the barbell on blue, maskable) and `manifest.json` for Add to Home Screen.

## Stage 5a: what's in it

- Ported from the pantry: signed session cookie (owner 90 days, guest until the demo expires),
  sandboxes `sb-<expiry>-<id>` with TTL on every row, scrypt passcode, DynamoDB rate limits,
  `set_passcode.py`.
- A demo copies the owner's log without the workout in progress (`ACTIVE`); with no workouts yet
  (production before stage 7) it gets a sample log: 8 weeks of Push / Legs / Pull, cues, a routine.
- A simple start screen (Look around / I'm Sergio; 5b makes it the welcome page), the demo banner
  (time left, reset, log in), Settings: Log out or Leave the demo.
- The cue check is off for guests (each call costs).

## Feedback on stage 4c (Sergio, 2026-10-30)

| What Sergio said | Done |
|---|---|
| Desktop approved; the History toggles were missing | History, Workouts: weeks grouped by month; months fold (the newest open) with their workout count |

## Stage 4c: what's in it (desktop, 2026-10-30)

- From 1024px: a left sidebar replaces the bottom tabs; the app opens on **Progress**.
- **Progress as a dashboard:** the streak, longest, this week and workouts this year next to a
  year heatmap (weeks as columns, a blue mark under weeks that reached 3; click a day to open it);
  the five lifts and Climbing in a grid; the routine timeline next to the last three workouts.
- **Workout and exercise pages** open as a panel on the right over the dimmed page.
- **History:** workout cards two per row, exercise categories in two columns.
- Train and Settings: one centered column. Phone and tablet layouts unchanged.
- Built as a working prototype for Sergio to judge on a computer (instead of static mockups).

## Stage 4b: what's in it (re-scoped for simplicity, 2026-10-30)

- **Routine** on Progress: the eras as a timeline, newest first, with dates and workouts logged; the
  current one open (days, notes), past ones on tap (and the rotation photo).
- **Drop sets** on the dips and chin-ups pages: the best ladder in full, then each ladder's total
  reps as a bar, newest first (tap to open the workout). Replaces the "best drop set" box.
- **Climbing** on the bouldering page: hardest send and the grade pyramid (sent solid, tried light);
  a Climbing card on Progress links there.
- Left out on purpose (in Ideas): weekly volume (repeats the ladders and weeks) and session time /
  rest (no workout has laps yet; imported times are estimates).

## Stage 4a: what's in it

- **Consistency** (one view): the streak in weeks (a week counts with 3+ workouts; this week
  doesn't break it while it's going; `WEEKLY_GOAL` in `lib/progress.ts`, Sergio to confirm), then
  the last 12 weeks as rows of 7 days colored by day type (Push blue, Legs orange, Pull aqua,
  Cardio gray; tap a day to open it) with the count and a check per week; "Show earlier weeks".
- **Strength:** squat, deadlift, bench, dips, chin-ups as **progression ladders**: each target is a
  set glyph (columns = sets, squares = reps, weight under it), so more sets, more reps and more
  weight all show. Tap a lift for its page.
- **Exercise page:** a summary line (sessions, since, best set), the full ladder (current target on
  top with its count; past targets with dates, one dot per session that opens it, "3 of 3"), drop
  set, cues, photos, the last 5 sessions (show all).
- **Elsewhere:** Train shows "This week: N of 3 · streak" (opens Progress) and only the last
  workout; the workout card's exercise name opens its page; its photos fold away; the target there
  uses the same set glyph and dots.
- Plain SVG/HTML, no chart library.

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
- Done: Groq API key in `backend/.env` (2026-10-30).
- Done: owner passcode (2026-10-30).
- Done: welcome note and photo (5b, 2026-10-30); alert email for 6a (given in chat; it goes only in the
  git-ignored `infra/terraform.tfvars`, never in the repo).
- Done: OK on the 6a deploy (2026-10-30).
- Done: alarm email confirmed; Sergio checked the live site end to end (owner login, the feedback
  email, the new icon) on 2026-10-31.
- Done: OK on the 6b apply (2026-10-30).
- Done: the two CNAMEs at Hostinger (2026-10-31); keep the validation one for renewals.
- Done: OK on the production import (2026-10-31).

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

## Feedback round 2 on stage 4a (Sergio, 2026-10-30)

| What Sergio said | Done |
|---|---|
| Show the last two workouts on the first page | Train: "Last workouts" with the two newest |
| When a workout starts, see the last one of the same type (a toggle) | "Push day · last one Oct 23" under the stopwatch opens the last workout of that day type |
| Notes and photos too prominent; a toggle or buttons | One quiet row under the sets: Note, Photo, Setup photos (folded) |
| History: toggle categories to scroll faster | Exercises: categories fold (with counts); searching opens them |
| Keep in mind: subtler colors, at the bottom | Gray, at the bottom of each exercise card |
| Remove workout notes and photos | Gone from the editor; old ones still show on the workout |
| An LLM (gpt-oss-120b on Groq) to see if a note should update the cues | The cue check: after a note, a suggestion to add or reword a cue (accept / no thanks); needs `GROQ_API_KEY` |
| Group the cues and order them by importance, only with the cues they have | Sections Setup, Brace & breathe, Lift; ranked by the agent (50 cues, none new or reworded); the key cue of each section shows, the rest on tap |
| Light mode too light, hard to read; dark is great | Light-mode grays a step darker (muted labels 4.8:1, secondary text ~7:1 on white; borders and empty days visible), past targets less faded; dark unchanged |

## Feedback round 1 on stage 4a (Sergio, 2026-10-30)

| What Sergio said | Done |
|---|---|
| Charts are too complex; progress in sets and reps doesn't show | Line charts replaced by progression ladders: each target as a set glyph (columns = sets, squares = reps) |
| The same information in several places; link instead, keep it simple, don't repeat | One home per thing: exercise page (progression, cues, photos, sessions), Progress (consistency), History (workouts); Train and the workout card link there. Calendar, weekly bars, tiles and range chips merged into one weeks view |

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

- Session time and rest per set from laps, once there are app-logged workouts with laps (stage 4b
  left it out: no data yet). Weekly volume if it turns out useful.

- Check the real AWS cost (Cost Explorer, profile `gym`) after a few weeks; estimate ~$0.10-0.25 a
  month.
- Dependabot opens weekly update PRs; merging one deploys it (CI must be green). Order that worked
  (2026-11-17): backend, then frontend (wait for each deploy), then the Terraform provider last
  (deploys nothing; run `terraform plan` after, expect "No changes").
- An email alarm for "Peloton read failed" like the cue check's (needs a `terraform apply`); for now
  the photo is kept and the error shows in the app.
- Progress: the Peloton card sits in the "Strength" section next to Climbing; a "Cardio" heading
  could fit if more cardio cards come.
- The Peloton reader uses qwen/qwen3.8-27b, the only vision model on the account's Groq key
  (2026-11-17); if Groq retires it, set `PELOTON_MODEL` (SSM) to another vision model.
- Local frontend tests in the agent's Git Bash sometimes fail every file with "Cannot read properties
  of undefined (reading 'config')" (flaky, environment only); rerun, or run `npx vitest run` from
  PowerShell, where they pass.

## Done

- 2026-10-31: Intro shortened (#19). Sergio verified the live site: owner login, feedback email,
  icon.
- 2026-10-31: Stage 8b own identity (#18) and 8a in-app feedback (#17).
- 2026-10-31: Stage 6c gym.sergiovanegas.com and stage 7 production import (#16).
- 2026-10-30: Stage 6b merges deploy (#15), stage 6a AWS (#14).
- 2026-10-30: Stages 5b welcome page (#13) and 5a guests and passcode (#12).
- 2026-10-30: Stage 4c desktop (#10, History months #11), 4b (#9), 4a Progress (#8).
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
