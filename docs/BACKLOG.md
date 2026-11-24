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

Stages 11a to 12b (#42-#48) are merged. Open: 12c (seven notes left in the app on 2026-11-23: plan
editor, tab tops, delete a workout, the picker as a page, shorter info pop-ups, the welcome note's years).

## Stage 11: feedback round 2 (2026-11-22)

Sergio: "I'm really interested in gamifying the experience with streak. But implement all of the feedback."

### 11a: streak and going up (`stage-11a-streak`)

| Feedback | Done |
|---|---|
| Week progress showed 2 after one day (Nov 18); the streak "not complete" and "what do 4 bars signal"; do weeks start on Monday? | Weeks already ran Monday to Sunday. Both notes came from the milestone ladder (2 of 4 squares at a 10-week streak, 3 of 4 at 11) being read as this week's days, plus "2 strength days" meaning *still needed*. The card now shows **this week as four slots** (Push, Legs, Pull, Cardio; filled in the day type's color as they're trained), labeled "This week Mon–Sun" with the days left; the ladder below is labeled "Next: 12 weeks · 1 week to go"; a week that reaches a milestone keeps that band full until it ends. An InfoTip explains it all. |
| Every ten weeks of streak, one week off: shields on the streak. | **Shields** (`lib/progress.ts` `streaks`, `SHIELD_EVERY = 10`): every 10 weeks of the run earn one; a missed week uses one up automatically when it ends (the run stays, without adding), and with none left the run and its shields end. No cap. Shown on the Train card (count, "n more weeks to a shield"), on Progress (phone and desktop), and covered weeks get a shield in the week rows. Earning one while the app is open gets its own congrats. Replayed over the history, so it's computed, never stored; Sergio's current run (11 weeks from Sep 7) doesn't change. |
| 3x5 should be the progressive overload of 5x4 (one more rep); the ladder is 3x2, 4x2, 5x2, 3x3, ... 4x5, 5x5. | Going up follows the ladder (`rung` / `goes_up` in `app/history.py`, same in `lib/sets.ts`): the most reps reached by 3+ sets, then how many sets. A higher rung at the same weight is the new target; "more total reps" no longer is (4x4 after 3x5 is below it). Replayed on the real log: squat is now 3x5 @ 180 (Nov 20), bar dips and skull crushers keep their targets. Once a target is reached 3 times, the target line suggests the next rung ("try 3x5 @ 180 or more weight"). |
| Going up said "4 in a row"; congratulate going up, not completing the sets once it's time to go up. | `congratsFor` in `lib/sets.ts`: a heavier working set or a higher rung gets **"Went up"** with the new target; reaching the target still gets "Target crushed", but not once it's time to go up. Each fires once per exercise. |
| The wide pull-up target is wrong (no more drop sets there). | The target was a Dec 24, 2025 session of 8, 10, 12, 7 (most likely a drop set logged as straight sets), and a miss never reset it, so 11 months of sessions counted as misses. Now a target not reached in 60 days gives way to what's done now (reaching it after a long break still counts). Wide pull-ups: 3x9. Also changes two rarely done exercises (close chin-ups, leg raises). A separate drop-set category isn't needed for this: drop sets are already marked per set in the logger. |

Checked: backend and frontend tests (new ones for shields, slots, ladder, congrats, stale targets), every
exercise's target replayed on the real log before and after (read-only), screenshots in a sample demo.
Not tested: the shield congrats and "Went up" in a browser (unit tests only), Sergio's phone.

### 11b: the rest (`stage-11b-train`, stacked on 11a)

| Feedback | Done |
|---|---|
| The day's exercises came out wrong: make day plans (heavy and light push and pull, legs with squat or deadlift) in two alternating week types (push, legs, pull, cardio each week), inferred from the log and editable. | **Training plans** (`app/plans.py`, `GET/PUT /api/plans`, one `SETTINGS#plans` row once saved). Until saved they're read off the log: the last two weeks with strength days are the two week types; a weighted first lift names a day Heavy, the other Light; Legs by its first lift. On the real log: "Squat week" (Heavy push: dips...; Legs · Squat; Light pull: front lever...) and "Deadlift week" (Light push: bench, OHP; Legs · Deadlift; Heavy pull: chin-ups...). This week's type comes from the newest workout matching a plan, flipping weekly: Nov 23 is a Deadlift week. Train shows the week's days in order with done ones checked, the first not done as next up, the exercises it starts with, "<other> week instead", and **Edit plans** (rename, reorder, add, remove). Cardio is still one activity picked at the start. |
| Make the numbers between + and - bigger. | Stepper numbers a size up (6xl, 5xl for long weights like 112.5). |
| 2.5 lb increments for some exercises. | Per exercise (`stepLb` on the exercise, `PATCH /exercises/{id}`): "Steps of 5 lb · use 2.5" under the weight stepper; kept for next time. Dumbbells still default to 2.5. |
| Lap timer a bit bigger, total a bit smaller (total still more important). | Total 2.6rem (was 3rem), lap time in the display font at 1.5rem next to its label. |
| Scroll memory when changing tabs. | Each tab comes back where it was left (`App.tsx`). |
| Don't scroll past the top (the stopwatch) or the bottom. | `overscroll-behavior: none` on the page. Needs Sergio's phone to confirm (iOS rubber-band). |
| The exercise search jumps as results filter. | The picker sheet has a fixed height (85% of the screen). |
| A finished exercise opened again needs a way to close it. | "Close <exercise>" under it folds it back. |
| Edit feedback. | Whoever wrote it can fix the text right after sending (Edit on the thanks screen); the owner can edit any note in the Settings inbox. `PATCH /feedback/{id} {text}`; edited ones say so. |
| Attach screenshots to feedback. | Up to 3, copied to `feedback/<id>-<n>` in the photos bucket (outliving demo photos), shown to the owner in the inbox; `scripts/feedback.py` saves them to `private/feedback/` to look at. |
| A Peloton workout logged from its screenshot should take the class's time. | On finishing (and saving an edited app workout), a workout shorter than its Peloton classes starts that many minutes before it ended. The Nov 22 ride on AWS was corrected by hand with Sergio's OK (2026-11-23): 20:15:59 to 20:45:59 (was 22 seconds). |

#### Feedback round 1 on 11 (Sergio, 2026-11-23)

| Item | Done |
|---|---|
| The plans should be more obvious on Train. | A "This week's plan" card replaces the chips: the week's name, one row per day with its exercises, Done or Next on the right, the chosen one marked in red; Edit plans and the other week at the bottom. |
| Some inferred plans were wrong; infer them from the last workouts. | Each day's exercises now come from its last 3 sessions (kept if done in 2 of them, or new in the latest; usual order), not the single latest one, which had dropped close-grip pull-ups from heavy push. Variants are each day type's two latest first lifts; the newest full week is week A. On the real log every plan matches it (heavy push: dips, bar dips, skull crushers, close-grip pull-ups, triceps extension, lateral raise). The ngrok copy runs on the older local log, so it can still differ there. |
| The numbers between + and - are still small. | Up to 3 characters (115, reps) at 7xl, 4 (22.5) at 6xl, 5 (112.5) at 5xl so it fits; the +/- buttons are a little smaller (52 px) to make room. |
| Fix the Nov 22 ride on AWS. | Done (see above); only its `startedAt` changed, with a condition on the old value. |

Checked: backend 116 and frontend 97 tests, build, plans inferred from the real log (read-only),
screenshots in a sample demo (Train, plan editor, a workout in progress, discarded). Not tested: the
plan editor's save, feedback screenshots and scroll memory in a browser (API tests only), the iPhone
overscroll, Sergio's phone. Note for the agent: run vitest from `C:` (PowerShell `Set-Location
C:/Users/...`); from the harness's lowercase `c:` working directory it loads two copies of vitest
and every suite fails with "reading 'config'".

### 11c: follow-ups from the phone (`stage-11c-polish`, Sergio 2026-11-23)

| Item | Done |
|---|---|
| Shields every 8 weeks instead of 10, after a replay of the whole log (current 11 and longest 11 under every interval from 4 to 10: the June-August run ended with three missed weeks in a row; with 8 the next shield comes in 5 weeks, and the sample demo earns one). | `SHIELD_EVERY = 8`. |
| Hide the scroll bars. | Hidden everywhere (`index.css`); scrolling unchanged. |
| A day chosen in "Ready to train" can't be unchosen. | Tapping the chosen day again clears it ("Start workout" with just the warm-up). |
| Only the Peloton ride and the treadmill as cardio (no Peloton run, no walk). | The Cardio day offers those two; the usual Cardio exercises too. Old runs and walks stay in the log and the catalog. |
| Better week names. | "Squat & heavy push week" and "Deadlift & heavy pull week" (the week's Legs lift and its heavy day). |
| Just the day's name in the plan, not its exercises. | Rows show the name, Done or Next. |
| During a workout, pulling the page down still moved the stopwatch. | The stopwatch bar is fixed to the top (a spacer keeps its place) instead of sticky, so the iPhone's pull no longer drags it. |
| "Lap" as big as the lap time. | Same display font and size. |
| The page behind Feedback (any sheet) scrolled. | Sheets pin the page in place while open (iOS ignores `overflow: hidden`) and keep their own scrolling inside. |
| The exercise search could scroll out of view. | Search and categories stay pinned at the top of the picker. |

Checked: backend 116 and frontend 97 tests, build, screenshots in a sample demo (the plan card,
deselecting, a workout scrolled with the bar in place, the picker scrolled; the workout discarded).
Not tested: the iPhone's pull-down and the sheets' scroll lock on the phone itself.

### 11d: scrolling everywhere, plans as a page (`stage-11d-scrolling`, Sergio 2026-11-23)

| Item | Done |
|---|---|
| Scrolling off on pages opened from History or Progress (exercise, workout); make it consistent everywhere, fixed at the top and the bottom. | Every full-screen page (`Screen`) and sheet (`BottomSheet`) is now a fixed header (and footer) with only the middle scrolling, without the iPhone's rubber band (`overscroll-behavior: none`); before, the whole page scrolled with a sticky header and bounced, header included. The page behind is pinned while one is open (`lib/scrollLock.ts`, counted so stacked ones unlock once) and comes back where it was. On the tabs, a fixed strip behind the clock in the Home Screen app, so the page scrolls out of sight at the top like it does under the tabs. |
| The exercise search still scrolled. | It's fixed above the list (the sheet's new `top` slot), not sticky inside it. |
| Editing plans scrolled past Save and above the intro; make it a page of its own. | The plan editor is a full page: fixed header, Save fixed at the bottom, only the days scroll. |
| Make the week tabs in the plans obvious with the red. | Red outline, the chosen week filled red. |
| The feedback inbox showed everything at once. | Tabs New / Done with counts, 5 at a time with "Show more". |
| Generalize the week structure (more week types, custom names, mixed days like upper body). | Built in stage 12a (below). |

**11e (`stage-11e-search-keyboard`):** the exercise search still scrolled away on the iPhone. Cause: with the
keyboard open, iOS pans the whole screen to keep the field in view, carrying the fixed sheet with it.
Sheets now size and place themselves to the visible area above the keyboard (`useVisibleArea` in
`lib/scrollLock.ts`, from `window.visualViewport`). Only testable on the phone.

Checked: frontend 97 and backend 116 tests, build, screenshots in a sample demo (the plan page at the
top and scrolled to the end, an exercise page scrolled, the page behind kept at its place). Not tested:
the owner's feedback inbox (owner only; the demo has none), the iPhone itself.

## Stage 12a: flexible weeks and a loading screen (`stage-12a-flexible-weeks`, Sergio 2026-11-23)

| Item | Done |
|---|---|
| "How can I add another type of week? Decide how to rotate weeks?" | **Week types** instead of A/B: any number (up to 8), each with its own name and days, repeating in their order one per calendar week. Each day: a name, a **kind** (Push, Legs, Pull, Upper, Lower, Full body or Cardio) and its exercises. The plan page has the week types as red tabs, "+ Week type", copy, delete, ← → to change the rotation order, and **Make this week** (anchors the rotation: it counts on from this week). Days: add, remove, reorder, rename, pick the kind. A Cardio day with no exercises still asks for the ride or the treadmill. |
| Mixed days in the log. | A workout started from an Upper, Lower or Full body day is labeled with that kind (its exercises would read as Push or Pull), counts as a strength day for the streak and the week's slots, gets the plum chart color (#a0459a light, #a855a2 dark; dataviz validator, all pairs: CVD worst 8.9 / 8.6, the only failure the known gray-amber pair) and a History filter once one exists. |
| Sergio's saved plans. | Production already holds plans saved in the first shape; they're read as two week types ("Squat & heavy push week", "Deadlift & heavy pull week") and saved in the new shape on the next save. Nothing was written on AWS. |
| The first load looked broken (half-drawn page, odd tabs). | A splash (the mark and a running bar over a blurred page, tabs included) until the first data and the fonts are in, then it fades out. |
| No plans yet. | "Set up a training plan" on Train opens the same page. |

Checked: backend 119 and frontend 96 tests, build, screenshots in a sample demo (the splash with the
API slowed, the plan card, the plan page with a third week type and an Upper day, not saved), the
real plans read from AWS (read-only). Not tested: saving a new structure in a browser (API tests only),
the iPhone.

## Stage 12b: the goal follows the plan (`stage-12b-plan-goals`, Sergio 2026-11-23: "I want all of what I asked")

| Item | Done |
|---|---|
| The weekly goal was fixed at 3 strength + 1 cardio, whatever the plan. | From the first plan saved after this ships, each week's goal is its week type's days: every day that isn't optional, strength = all kinds but Cardio. Past weeks are judged by the version in force then, and weeks before any saved version keep the fixed goal, so Sergio's streak (11 weeks) doesn't change. The streak card's slots are the planned days by name (as many as the plan has), and "what's left" counts from the plan. A planned week of only optional days is a rest week. |
| Optional days. | A day can be marked optional in the plan page: it stays in the plan (tagged "optional" on Train, never next up while a counted day is left) but not in the goal. |
| A history of the plans. | Every save is kept (`PLANS#...`); the plan page lists earlier versions ("From the week of ...") with Restore, which loads one to save again. `GET /api/plans/history`. |

Checked: backend 121 and frontend 100 tests, build, the real log (read-only: no versions yet, so no plan
goals and the streak unchanged), screenshots in a sample demo with an Upper/Lower plan saved in that
sandbox (five named slots, the goal of 4 strength days). Not tested: Restore in a browser (API tests only), the iPhone.

## Stage 13b: tiers on the welcome page, the focus lifts (`stage-13b-welcome-tiers`, Sergio 2026-11-23)

| Item | Done |
|---|---|
| Visitors should see the tier icons next to the workouts count and the week streak. | The welcome stats show each tier's icon next to the number and "<name> tier" under the label (none before the first tier). |
| Weighted chin-ups and pull-ups belong with the main lifts; the four focus lifts are, in order, weighted dips, weighted chin-ups, deadlift, back squat. | "In training now" on the welcome page shows those four in that order. Progress (`MAIN_LIFTS`) shows them first, then weighted pull-ups and bench press. |

Checked: backend 121 and frontend 92 tests, the welcome page logged out at 390x844 (dark and light) and
1440x900 on the local log (older than production: its streak reads 0 there). Not tested: the live numbers.

## Stage 16c: desktop feedback (`stage-16c-desktop-feedback`, in-app feedback from guests, 2026-11-24)

| Feedback | Done |
|---|---|
| Computers: the right-side panels are good, but the page behind should blur so the panel has the focus. | From `lg:` the page behind a panel (and a sheet) is dimmed more and blurred; the panel has a thin left edge. Phones unchanged. |
| Computers, Progress: "Last workouts" and "Body weight" didn't line up (one heading outside a card, one inside). | On computers Body weight's title and Log sit above its card, like "Last workouts", so both cards start at the same height. The phone card is unchanged. |

Checked: frontend 99 tests and build; Progress and a workout panel at 1440x900 and 390x844 (touch), dark and
light, in a sample demo. Not tested: Sergio's computer.

## Stage 16b: a calmer weight row (`stage-16b-weight-step`, Sergio 2026-11-24)

| Feedback | Done |
|---|---|
| "lbs plates + 45 bar", "0 = body weight" under Weight: not relevant, crowded. | The set logger's Weight label is just "WEIGHT" (time and distance keep their units). |
| The 2.5 / 5 step's place still wasn't intuitive (options shown; Sergio picked "under the number"). | A small "±2.5 \| ±5" pill right under the weight, between the − and + it changes (picked one red); `Stepper` has a `below` slot (replaces `extra`). |

Checked: frontend 99 tests and build; a touch-screen phone emulation in dark and light (demo workout,
discarded): ±2.5 picked, + went 145 → 147.5. Not tested: Sergio's phone.

## Stage 16a: sheets while typing, a way back to sergiovanegas.com (`stage-16a-sheet-keyboard`, Sergio 2026-11-24)

| Feedback | Done |
|---|---|
| (In-app, with a screenshot) The feedback sheet with the keyboard open: its header under the clock and the tabs showing above the keyboard. | Every sheet (`BottomSheet`) has a typing mode on phones: when the keyboard takes 150+ px, the sheet fills the visible area with its header below the clock, over an opaque layer that runs down behind the keyboard, and the app underneath is hidden (`useCoverApp`, as full-screen pages do since 13a). Keyboard closed: the usual sheet. |
| A link to https://sergiovanegas.com/projects/ for visitors (they come from there), in a new tab. | The welcome page has "sergiovanegas.com ↗" at the top right of the photo; in the app, the demo banner has "Site ↗" (title and label say sergiovanegas.com projects; the banner's spacing tightened so "Demo · 24h" still fits at 375 px). `lib/site.ts` `SITE_URL`. |

Checked: frontend 99 tests and build; a touch-screen phone emulation (dark): both links (href, new tab,
noopener), the banner at 375 and 390 px with nothing cut, the feedback sheet with the keyboard simulated
(the visible area shrunk to 420 px): full screen, the app hidden, back to normal when it "closes". Not
tested: the real iPhone keyboard.

## Stage 15e: the stepper numbers big on the phone (`stage-15e-stepper-phone`, Sergio 2026-11-23, in-app feedback with a screenshot)

Sergio didn't like 15c's label-on-top layout: on the iPhone the numbers between − and + were tiny, the − and
+ far apart, and the 2.5 / 5 switch overlapped its box. **Root cause, there since stage 0:** the touch-screen
rule that keeps inputs at 16 px (so iOS doesn't zoom on focus) is unlayered and beat the stepper's
`text-7xl`, so on the phone the number was always 16 px. The desktop test browser isn't a touch screen, so
every check showed 72 px; that's why "bigger numbers" kept coming back (11b, 11 round 1, today).

| Item | Done |
|---|---|
| The 16 px rule | Skips the stepper's number (`input:not(.stepper-number)`); everything else keeps it. |
| Layout | Back to the label on the left (64 px column: label, unit, the Step switch stacked under it, picked one red) and − number + on the right, buttons 48 px. |
| Fitting long weights | Fixed sizes by length instead of measuring in code (it misread on the iPhone): 72 px up to 3 characters, 60 px for 4, 52 px for 5. **15f** (Sergio: the weight jumped size stepping 145 → 147.5; keep the smaller): one size, 52 px, for every number (weight and reps); checked in the touch emulation, 145 → 147.5 → 150 all 52 px, 1000 and 147.5 fit. **15g:** 25% smaller, 39 px (Sergio). |

Checked: frontend 99 tests and build; **a touch-screen phone emulation** (390x844, `pointer: coarse`, dark)
in a demo workout (discarded): 45 and 145 at 72 px, 22.5 and 1000 at 60, 147.5 and 112.5 at 52, none
clipped (122 px box); other inputs still 16 px. Not tested: the iPhone itself. **For the agent:** check
input sizes in a context with `hasTouch: true, isMobile: true`; plain desktop emulation misses touch-only CSS.

## Stage 15c: lbs everywhere, a red step (`stage-15c-lbs`, Sergio 2026-11-23)

| Feedback | Done |
|---|---|
| In dark mode the step switch didn't show which of 2.5 / 5 was picked. | The picked one is the red accent with bone text, in both modes. |
| "4x4 @ 115" needs "lbs", everywhere, especially on the welcome page. | `weightText` adds it, so every target, set summary, best set, celebration and the welcome page's "In training now" read "4×4 @ 115 lbs" ("30 lbs each", drop ladders "90-70-0 lbs"; Anton shows it in caps). The hand-written units (body weight, the stepper's "lbs plates + 45 bar", the chart, the barbell option) say "lbs" too. The small weight labels under the ladder columns stay bare numbers (no room). |

| The numbers between − and + still looked small: long weights like 147.5 shrank to fit next to the label column (to ~42 px). | Steppers put their label (and unit) on a line above, with the Step switch at the right of the Weight line ("STEP 2.5 / 5", bigger taps), so the number has the full width: every value is 72 px now (measured 45 to 147.5 at phone width, nothing clipped); the shrink-to-fit stays as a safety net. Applies to every stepper (sets, warm-up, run, drop sets, body weight). |

Checked: frontend 99 tests (expectations updated) and type-check; a demo workout (discarded): the step
switch in dark and light, the target "5×5 @ 145 lbs", the new stepper layout; the welcome page logged
out. Not tested: Sergio's phone.

## Stage 15b: cues folded, a clearer weight step (`stage-15b-cues-step`, Sergio 2026-11-23)

| Feedback | Done |
|---|---|
| "Keep in mind" during training should stay fully collapsed, to keep the workout focused. | One folded line ("Keep in mind · 3 cues") until tapped; open, every cue by section, Add cue and the edit pencil. The exercise page keeps its full list. |
| The 5 / 2.5 lb step is great but not intuitive ("Steps of 5 lb · use 2.5" link). | A "Step 2.5 / 5" switch under the Weight label, next to the − and + it changes; it switches at once and is kept for the exercise. |
| (Found on the way) Weights like 147.5, 22.5 or even 145 were cut off in the stepper. | The number shrinks only as much as it needs to fit (measured: 45 stays 72 px, 147.5 goes to 42 px); before, 145 and every 4-5 character weight overflowed the 94 px box at phone width. |

Checked: frontend 99 tests and build; a demo workout (started and discarded): the cues folded then opened
(3), the step switched to 2.5 and + went 145 → 147.5, weights from 45 to 147.5 measured fitting. Not tested:
Sergio's phone.

## Stage 15a: two progression ladders (`stage-15a-progression`, Sergio 2026-11-23)

Sergio: heavy exercises climb 3x2, 4x2, 5x2, 3x3, 4x3, 5x3 ... 5x5; secondary ones 3x6, 3x7 ... 3x10. Infer
each exercise's, let them pick it (also when creating one), and tailor the progression messages.

| Item | Done |
|---|---|
| Two ladders | `goes_up` (server) / `goesUp` (app) take a style. Heavy: as before, topping out at 5x5. Reps: only more reps at 3 sets is a step (4x8 after 3x8 isn't); a target under 3 sets steps up when 3 sets are done. After 5x5 or 3x10, the next step is more weight. |
| Inferred, or set | `progression` on the exercise (stored only when Sergio picks one); else the last 6 sessions' working sets: a typical set of 5 reps or fewer is heavy, more is reps. Holds, runs, climbs stay heavy. Sent as `style` with the target (`/summary`) and the ladder (`/progress`). |
| On the real log (read-only) | Heavy: back squat, deadlift, weighted dips, bench press, weighted chin-ups, the skills. Reps: Romanian deadlift, dumbbell OHP, calf raises, weighted pull-ups (done at body weight lately, 3x9), bar dips, front lever raises, the pull-up variations, skull crushers, the rest. Only the Romanian deadlift's target changes: 4x8 @ 155 reached 5 times (it was 5x8 @ 155, 2), so it says go up to 3x9. |
| Picking it | "Aiming for" on the exercise page (Heavy 3x2 → 5x5 / Reps 3x6 → 3x10, "automatic" or "set by you", Back to automatic: `PATCH {progression: heavy|reps|auto}`); the create form has the same choice (Heavy for barbell and weighted, Reps otherwise, until picked). |
| Messages | The target line: "3 in a row: go up: try 3x9 @ 155 or more weight", "go up: more weight, back to 3x6" after 3x10, "go up: more weight" after 5x5; its InfoTip shows the ladder; "Went up" only fires for a real step on that ladder. |
| The plan page's "Earlier versions" | Removed (saves are still kept on the server). |

Checked: backend 126 and frontend 99 tests (both ladders, inference, the API set/reset), the real replay
above, a sample demo (bench press: inferred Heavy, set to Reps, back to automatic; the create form's
defaults). Not tested: a "Went up" on the reps ladder in a browser, Sergio's phone.

## Stage 14d: Progress lifts in order, climbing hidden (`stage-14d-progress-order`, Sergio 2026-11-23)

| Feedback | Done |
|---|---|
| Strength on Progress was out of order: push, then pull, then legs. | `MAIN_LIFTS`: weighted dips, bench press, weighted chin-ups, weighted pull-ups, deadlift, back squat. The welcome page keeps its own four (dips, chin-ups, deadlift, squat). |
| Hide climbing on Progress for now (keep the record). | The Climbing card is off (`SHOW_CLIMBING` in `ProgressPage.tsx`); the log, History and the bouldering page keep everything. |

Checked: backend progress tests, the order and no Climbing card in a sample demo. Not tested: Sergio's phone.

## Stage 14c: Start in the row, a plain list of days (`stage-14c-day-list`, Sergio 2026-11-23)

| Feedback | Done |
|---|---|
| Start should sit in the selected row, like the Next tag, not as a big button. | The selected day's row has a compact Start on the right (the ride/treadmill choice under it on a Cardio day); the next day, when not selected, keeps a quiet Next tag. Without a plan, the big button stays under the day chips. |
| "Other days" should read "View more days", and the numbers stopped after 4. | "View more days" / "View fewer days"; the extra days carry on in cycle order from the next four, numbered 5, 6, 7... |
| No week types: it's a day rotation. | The plan page ("Your plan") is one numbered list of days with up/down arrows and Add day; a day opens its own page (name, kind, exercises in order, optional, Duplicate and Delete with a confirm). Saved as a single week type (up to 20 days, was 10 per week type), so the day ids, `planDays` and Train's place carry over; Sergio's two saved week types flatten into one list on the next save. Earlier versions list their days. |

Checked: backend 122 and frontend 98 tests; a sample demo at 390x844: two days added and saved in the
demo, "View more days" numbered 1-6, a Cardio day picked (the choice under its row) and started from its
row (`planDays` saved, the demo workout discarded). Not tested: Sergio's phone, saving his real plan
(flattens two week types).

## Stage 14b: feedback after the cycle (`stage-14b-feedback`, Sergio 2026-11-23)

| Feedback | Done |
|---|---|
| Put Start inside "Ready to train". | The Start button (and the ride/treadmill choice on a Cardio day) sits inside the plan card, under the days. Without a plan it stays under the day chips. |
| Drop the "Last Push workouts" on Train: the plan card already shows the last two. | Removed. (The folded "last two" of the day type during a workout stays.) |
| The plan page said "Your days, in order" but listed only the week types. | It lists the days, numbered through the whole cycle (1-8), grouped under each week type with Edit and the up/down arrows; each row shows how many exercises it has (or the kind). |
| History's "Show every exercise" only added the Peloton run and the walk, which aren't exercises Sergio does; the warm-up isn't an exercise and isn't cardio. | The toggle is gone: the list shows the exercises done (search still finds the whole catalog). The warm-up has its own group (`warmup`, catalog; follows the code, no data change) and is left out of History's exercises and the picker. |
| Remove the Routine section on Progress. | Removed (phone and computer; on a computer the last workouts now sit next to body weight). The API still sends the routines. |

Checked: backend 122 and frontend 98 tests, a sample demo at 390x844 (the card with Start, the plan page,
History's exercises: Cardio is only the ride, no toggle; Progress without Routine). Not tested: a
two-week-type plan page in a browser (the sample has one), Sergio's phone.

## Stage 14a: the plan as a cycle of days (`stage-14a-day-cycle`, Sergio 2026-11-23)

Week types were tied to calendar weeks, so a short week (light push and deadlift legs only) jumped to
the other week type on Monday while Sergio carries on with heavy pull and cardio. Agreed: the week
types' days form **one cycle**, and the next day is the one after the last workout, whatever the week.
Sergio: keep it simple, "always the next 4 trainings and the last two".

| Item | Done |
|---|---|
| Where Sergio is | `cyclePlace` / `cycleView` in `lib/plan.ts`: workouts replayed oldest first; one started from a plan day is that day (new `planDays` on the workout, joined when a second session merges into the day); older ones match by day type, then the day's exercises they have, then the nearest such day after the last one (tells the two Cardio days apart). A ride after lifting also takes the Cardio day right after. On the real log (read-only) the last 8 workouts land on the right days; next is light push, deadlift legs, heavy pull, cardio. |
| Train | "Your plan": the last two workouts (done, with the day they were and the date; tap opens it), then the next four days numbered, the first marked Next and preselected. Tap another to switch, again for none; "Other days" shows the rest of the cycle. Starting saves the day in `planDays`. |
| Plan page | "Current week" and the "This week" tag are gone (the place comes from the workouts); the list is "Your days, in order". The server's anchor and `current` stay but aren't used by Train. |

Checked: backend 122 and frontend 98 tests (the cycle: carry-over, wrap, two Cardio days, a ride after
lifting), the real replay above, a sample demo at 390x844 and 1440x900 (dark and light), starting from a
picked day (it saved `planDays`; the demo workout was discarded). Not tested: Sergio's phone.

## Stage 13a: the streak counts training days, tiers (`stage-13a-streak-tiers`, Sergio 2026-11-23)

Sergio's request: grow the streak with 4 training days a week, hold it with 2 or 3 (any kind), and use a
shield under 2; replay it over the whole history; plus tiers for workouts (50, 100, 200, 300, 400...)
and streaks (4, 8, 16, 32... weeks), each with its own icon, and their current and best tier.

**Analysis** (the real log on AWS, read-only, 190 workout days from Sep 2025, 64 finished weeks): 27
weeks had 4 days, 4 had 5, 13 had 3, 9 had 2, 5 had 1 and 6 had 0. So 4 days is reached about half the
time, and 2+ in 83% of weeks: the hold band is what keeps a run alive. Replayed with shields every 8
growing weeks:

| Rule | Current | Longest | Shields |
|---|---|---|---|
| **Sergio's: 4 grow, 2-3 hold, 0-1 shield** (built) | **9** | **10** (Jun-Aug 2026) | 1 |
| Same, shield every 4 weeks | 19 | 19 | 2 (too forgiving) |
| 3 grow, 2 hold | 11 | 11 | 1 |
| 4 grow, no hold | 4 | 7 | 0 (too harsh: the summer run breaks twice) |

The card showed 11 under the old goal; it now reads 9, honest to "4 days a week". Recommendation
taken: Sergio's rule as is, shields unchanged (every 8 growing weeks; held weeks don't earn).

| Item | Done |
|---|---|
| The rule | `weekState` / `streaks` in `lib/progress.ts`; any kind of day counts, one per date. The plan no longer sets the goal (12b's plan goals are ignored); optional days only affect next up. |
| Train card | Four day slots filled in the order trained (day-type colors), "keeps" under the second and "grows" under the fourth, "1 more day keeps it" / "2 more days grow it"; amber late in the week under 2 days. |
| Streak tiers | Spark 4, Ember 8, Flame 16, Blaze 24, Inferno 32, Forged 52, Eternal 104 weeks, then every 52 (Sergio suggested doubling or multiples of 8; doubling leaves 32 to 64 as a 32-week gap, so after 32 it goes to a year, then two). Current tier next to the streak, the next one on the ladder, the congrats shows the new tier. |
| Workout tiers | Iron 50, Bronze 100, Silver 200, Gold 300, Platinum 400, Diamond 500, Titan 750, Legend 1000, then every 250. Sergio is at 190 (Bronze, 10 to Silver). Line on the Train card, congrats on reaching one. |
| Progress | A Tiers card: workouts and streak, each a row of tier badges (earned in brass, the next outlined, the best ever streak tier faded in). Week rows and the heatmap mark weeks that grew (red, check) and held (gray). |
| (In-app feedback) The picker still showed the page behind above the iPhone keyboard after #50. | iOS shrinks the window with the keyboard in the Home Screen app, so sizing the page wasn't enough. Full-screen pages now hide the app underneath on phones while open (`useCoverApp` in `lib/scrollLock.ts`, counted), and size from the larger of the window and the screen. |

Checked: frontend 92 tests (the goal tests replaced by ones for the rule, tiers and news), build, the
replay above, a sample demo at 390x844 dark and light and 1440x900 (the card, the Tiers card, the
heatmap marks), the app hidden under a page and back at its scroll on close. Not tested: the tier and
shield congrats in a browser (unit tests only), the iPhone keyboard.

## Stage 12c: in-app feedback (`stage-12c-feedback`, 7 notes from Sergio, 2026-11-23)

| Feedback | Done |
|---|---|
| The welcome note's "12 years" will go stale: count from August 2014, rounded up. | `yearsSince("2014-08")` in `lib/time.ts` (always rounds up), so it reads **13** today. |
| Info pop-ups are too long to be read. | Every InfoTip cut to one or two short sentences. |
| Editing plans isn't intuitive, and the red highlights look cheap. | Rebuilt as list then detail: the plan page is **the rotation** (week types in order, numbered, with their days, a quiet "This week" tag, up/down arrows), and tapping one opens it on its **own page** (name, "Current week", days, Duplicate, Delete). No red outlines or fills; neutral borders and stone icons. Save stays on the plan page. |
| Copying a week should confirm first; week types should be reorderable. | Duplicate and Delete each ask in a sheet first. Reordering is up/down on each row of the rotation. |
| Tabs start at different heights. | Each page had its own top margin (Train 24 px, History and Progress 8, Settings 0); all removed, so every tab starts its first block at the same spot. |
| A way to delete a workout logged by mistake. | It existed only at the bottom of Edit. The workout page header now has a trash button with a confirm sheet. |
| Adding an exercise felt odd: a sheet over the workout that moved once typing. | The picker is a full page (`Screen`, new `top` slot and `fitKeyboard`, sized to the area above the keyboard) with the search fixed at the top. |
| (Found on the way) Saving plans didn't refresh the streak's goals. | `useSavePlans` invalidated a `["progress"]` key that doesn't exist; now `["workouts", "progress"]`. |

**12d (`stage-12d-picker-cover`, Sergio 2026-11-23 from the phone):** with the keyboard open, the picker page
ended above the keyboard too early, leaving a strip where the workout behind showed and scrolled. The page
now always runs down behind the keyboard (it still follows iOS's pan at the top); the list gets the
keyboard's height as bottom room instead. Only testable on the iPhone.

Checked: frontend 101 tests, build, a sample demo at 390x844 (dark and light) and 1440x900: tab tops
measured equal, the plan page and a week type's page, Duplicate's confirm, the picker page with a search,
the delete sheet (Keep it; nothing deleted). Not tested: the picker with the iPhone keyboard, saving a
reordered rotation in a browser, Sergio's phone.

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
  `#0b0909`. Welcome page header on a grayscale gym photo (`src/assets/bw-dream-gym.jpg`; later replaced by Sergio's
  pick, `hardcore-gym.jpg`).
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
| In the Home Screen app on the iPhone, an exercise opened from Progress, or from a workout opened in History, left the strip behind the clock showing the page under it (fine in a browser tab, so not reproducible in emulation). | iOS paints that strip from the topmost fixed layer at the top edge; the grain (fixed, see-through, over everything) was that layer. The grain now sits under full-screen pages, the tabs bar, sheets and celebrations (z-25), so an open page is topmost again. Also dropped: the grain's blend mode and the fixed background (both iOS-sensitive). Sergio confirmed it on the phone; #33. |
| Phone turned sideways: the rail's tab labels were cut off (the redesign's tracked uppercase labels are wider than the 60 px rail). | The rail is 72 px; in landscape the labels are 0.6rem with lighter tracking (still uppercase), and the current tab has the desktop sidebar's left marker. |
| Welcome page, training days: only every other weekday was labeled, and the red line under weeks wasn't explained. | All seven weekday letters (also on the desktop Progress heatmap, same component). The goal line is gone from the welcome chart (Sergio, after trying a caption: confusing there); Progress keeps it with its caption. |
| Welcome page: use Sergio's own pick for the header photo. | `frontend/src/assets/hardcore-gym.jpg` (their PNG as a 1600 px grayscale JPEG, 294 KB) replaces the Lovable photo; crop and fade unchanged; #36. |
| Home Screen app: the welcome photo stopped below the clock (a black band on top). | Status bar `black-translucent`: the page runs under the clock and the photo reaches the top edge; top edges now pad with the clock's height plus their usual gap (`calc(env(safe-area-inset-top) + ...)`), same spacing as before. Needs the icon re-added; the clock is white in light mode too. |

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
