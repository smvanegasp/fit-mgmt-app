import { CaretRight, ChartLineUp, Check, ShieldCheck } from "@phosphor-icons/react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";

import type { ProgressDay } from "../api";
import { ComingSoon } from "../components/ComingSoon";
import { Heatmap } from "../components/Heatmap";
import { InfoTip } from "../components/InfoTip";
import { GradePyramid, LiftCard, TYPE_COLOR, TypeLegend, groupColor, typeColor } from "../components/Progression";
import { useGoTo } from "../components/Nav";
import { useScreens } from "../components/Screens";
import { BodyWeightCard } from "../components/BodyWeightCard";
import { LineChart } from "../components/LineChart";
import { WorkoutCard } from "../components/WorkoutCard";
import { useDesktop, useExerciseHistory, useExercises, useProgress, useWorkouts } from "../hooks";
import { climbing } from "../lib/kinds";
import { topSeries } from "../lib/series";
import { SHIELD_EVERY, shortDate, streaks, weekCounts, weekRows, weekState, weekText } from "../lib/progress";
import { TiersCard } from "../components/Tiers";
import { weekNeedText, weekProgress } from "../lib/streak";
import { localIso } from "../lib/time";
import { longDate } from "../lib/weeks";

/** The climbing card on Progress, hidden for now (Sergio, 2026-11-23: not climbing lately, it was noise).
 * The log and the bouldering page keep everything; set to true when climbing comes back. */
const SHOW_CLIMBING = false;

export function ProgressPage() {
  const progress = useProgress();
  const exercises = useExercises();
  const screens = useScreens();
  const today = localIso().slice(0, 10);
  const days = progress.data?.days ?? [];
  const desktop = useDesktop();

  if (progress.isLoading) return <p className="py-10 text-center text-stone-500">Loading...</p>;
  if (progress.isError) return <p className="py-10 text-center text-red-700">Couldn't load your progress.</p>;
  if (days.length === 0) {
    return <ComingSoon icon={ChartLineUp} title="Progress">Finish a workout and your consistency and strength show up here.</ComingSoon>;
  }

  return (
    // Phones: one column. Computers: a dashboard (the year at a glance, lifts in a grid, the
    // routine next to the last workouts).
    <div className="space-y-3 pb-28 lg:space-y-6 lg:pb-12">
      {desktop ? <YearConsistency days={days} today={today} /> : <Consistency days={days} today={today} />}
      <Tiers days={days} today={today} />

      <section className="space-y-3 lg:space-y-0">
        <h2 className="flex items-center gap-1 px-1 pt-3 font-semibold lg:pt-0 lg:pb-3">
          Strength
          <InfoTip title="Strength">
            Your recent targets: columns are sets, squares are reps, the weight below. Tap a lift for more.
          </InfoTip>
        </h2>
        <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0 xl:grid-cols-3">
          {(progress.data?.lifts ?? []).map((lift) => {
            const exercise = exercises.data?.find((e) => e.id === lift.exerciseId);
            return (
              <LiftCard key={lift.exerciseId} lift={lift} load={lift.load} color={groupColor(exercise?.group)}
                onOpen={() => screens.openExercise(lift.exerciseId)} />
            );
          })}
          {SHOW_CLIMBING && <ClimbingCard />}
          <PelotonCard />
        </div>
      </section>

      {/* Phones: body weight after the lifts. Computers: the last workouts next to body weight. The
          routine timeline is gone (Sergio, 2026-11-23: it didn't add value). */}
      {desktop ? (
        <div className="grid grid-cols-2 items-start gap-6">
          <LastWorkouts />
          <BodyWeightCard headingOutside />
        </div>
      ) : <BodyWeightCard />}
    </div>
  );
}

/** Workouts ever and the streak, as tiers (Sergio, 2026-11-23). */
function Tiers({ days, today }: { days: ProgressDay[]; today: string }) {
  const streak = useMemo(() => streaks(days, today), [days, today]);
  return <TiersCard workouts={days.length} current={streak.current} longest={streak.longest} />;
}

/** Computers: the last workouts next to the routine (on phones they're on Train). */
function LastWorkouts() {
  const workouts = useWorkouts(3);
  const screens = useScreens();
  const goTo = useGoTo();
  return (
    <section>
      <h2 className="flex items-center px-1 pb-3 font-semibold">
        Last workouts
        <button type="button" onClick={() => goTo("history")} className="ml-auto text-sm font-medium text-blue-700">All in History</button>
      </h2>
      <div className="space-y-2">
        {(workouts.data ?? []).map((w) => <WorkoutCard key={w.id} workout={w} onClick={() => screens.openWorkout(w.id)} />)}
      </div>
    </section>
  );
}

/** Computers: the streak next to a year of training days (weeks as columns, Monday on top), with a
 * mark under each week that reached the goal. Same data as the phone's weeks view, laid wide. */
function YearConsistency({ days, today }: { days: ProgressDay[]; today: string }) {
  const screens = useScreens();
  const counts = useMemo(() => weekCounts(days), [days]);
  const streak = useMemo(() => streaks(days, today), [days, today]);
  const monday = weekRows(today, 1)[0].monday;
  const thisYear = days.filter((d) => d.date.startsWith(today.slice(0, 4))).length;

  return (
    <section className="flex gap-8 rounded-2xl border border-stone-200 bg-white p-6">
      <div className="w-44 shrink-0">
        <div className="font-display text-6xl font-bold">{streak.current}</div>
        <div className="flex items-center gap-1 text-sm text-stone-500">
          week streak
          <InfoTip title="Streak">
            4 training days in a week grow it, 2 keep it. Fewer uses a shield; you earn one every {SHIELD_EVERY} weeks it grows.
          </InfoTip>
        </div>
        <dl className="mt-5 space-y-3 text-sm">
          <div><dt className="text-stone-500">Longest</dt><dd className="font-semibold">{streak.longest} weeks</dd></div>
          <div><dt className="text-stone-500">Shields</dt><dd className="flex items-center gap-1 font-semibold"><ShieldCheck size={14} weight="fill" className={streak.shields ? "text-sky-600" : "text-stone-300"} aria-hidden />{streak.shields} <span className="font-normal text-stone-500">· next in {streak.toShield} week{streak.toShield === 1 ? "" : "s"}</span></dd></div>
          <div><dt className="text-stone-500">This week</dt><dd className="font-semibold">{counts.get(monday)?.workouts ?? 0} days · {weekNeedText(weekProgress(days, today))}</dd></div>
          <div><dt className="text-stone-500">In {today.slice(0, 4)}</dt><dd className="font-semibold">{thisYear} workouts</dd></div>
        </dl>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Consistency</h2>
          <TypeLegend />
        </div>
        <div className="mt-4"><Heatmap days={days} today={today} onOpen={screens.openWorkout} /></div>
        <p className="mt-2 text-xs text-stone-500">Under each week: red grew the streak (4+ days), gray held it (2 or 3). Click a day to open it.</p>
      </div>
    </section>
  );
}

/** Climbing on Progress: the hardest send and the grade pyramid; the full page has the rest. */
function ClimbingCard() {
  const history = useExerciseHistory("bouldering");
  const screens = useScreens();
  const sessions = history.data?.sessions ?? [];
  const { hardest, grades } = climbing(sessions);
  if (grades.length === 0) return null;
  const sends = grades.reduce((n, g) => n + g.sent, 0);
  return (
    <button type="button" onClick={() => screens.openExercise("bouldering")} className="flex w-full flex-col rounded-2xl border border-stone-200 bg-white p-4 text-left">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 font-semibold">Climbing</span>
        <CaretRight size={14} className="shrink-0 text-stone-400" aria-hidden />
      </div>
      <div className="mt-0.5 text-sm text-stone-600">
        Hardest send {hardest?.grade ?? "none yet"} · {sends} sends in {sessions.length} sessions
      </div>
      <div className="mt-3"><GradePyramid sessions={sessions} color={TYPE_COLOR.Pull} /></div>
    </button>
  );
}

/** Peloton rides (Sergio, 2026-11-17): each ride's total output, read from its screenshot. The
 * ride's page has every session; this card links there. */
function PelotonCard() {
  const history = useExerciseHistory("peloton-ride");
  const screens = useScreens();
  const series = topSeries(history.data?.sessions ?? [], { load: "none", measure: "run", barLb: 0 });
  if (!series) return null;
  const values = series.points.map((p) => p.value);
  const last = series.points.at(-1)!;
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-4">
      <button type="button" onClick={() => screens.openExercise("peloton-ride")} className="flex w-full items-center gap-2 text-left">
        <span className="min-w-0 flex-1 font-semibold">Peloton rides</span>
        <CaretRight size={14} className="shrink-0 text-stone-400" aria-hidden />
      </button>
      <div className="mt-0.5 text-sm text-stone-600">
        {series.points.length} {series.points.length === 1 ? "ride" : "rides"} · last {series.format(last.value)} · best {series.format(Math.max(...values))}
      </div>
      {series.points.length >= 2 && (
        <div className="mt-2">
          <LineChart points={series.points} format={series.format} color={TYPE_COLOR.Cardio} label={series.title} noun="rides"
            onOpen={screens.openWorkout} />
        </div>
      )}
    </section>
  );
}

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

/** The streak, and the last weeks as rows of 7 days (training days in their day type's color) with
 * each week's count: one view for the calendar, workouts per week and the streak. */
function Consistency({ days, today }: { days: ProgressDay[]; today: string }) {
  const screens = useScreens();
  const [count, setCount] = useState(12);
  const byDate = useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);
  const counts = useMemo(() => weekCounts(days), [days]);
  const streak = useMemo(() => streaks(days, today), [days, today]);
  const first = days[0].date;
  // No empty weeks from before the first workout.
  const rows = weekRows(today, count).filter((row) => row.days[6] >= first);
  const more = rows.at(-1)!.monday > first;

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-4">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-display text-3xl font-bold">{streak.current}-week streak</div>
          <div className="flex items-center gap-1 text-sm text-stone-500">Longest {streak.longest} weeks ·{" "}
            <ShieldCheck size={14} weight="fill" className={streak.shields ? "text-sky-600" : "text-stone-300"} aria-hidden />
            {streak.shields} shield{streak.shields === 1 ? "" : "s"}
          </div>
        </div>
        <InfoTip title="Streak">
          4 training days in a week grow it, 2 keep it. Fewer uses a shield; you earn one every {SHIELD_EVERY} weeks it grows. Tap a day to open it.
        </InfoTip>
      </div>
      <div className="mt-3"><TypeLegend /></div>

      <div className="mt-3 grid grid-cols-[2.25rem_repeat(7,1fr)_2.5rem] items-center gap-x-1 gap-y-1 text-xs">
        <span />
        {WEEKDAYS.map((d, i) => <span key={i} className="text-center text-stone-400">{d}</span>)}
        <span />
        {rows.map((row, r) => {
          const week = counts.get(row.monday);
          const n = week?.workouts ?? 0;
          const state = weekState(n);
          const covered = streak.shielded.includes(row.monday);
          // Newest first: the month shows on its newest week (weeks go by their Monday).
          const month = r === 0 || row.monday.slice(0, 7) !== rows[r - 1].monday.slice(0, 7);
          return [
            <span key={`${row.monday}-m`} className="text-stone-500">{month ? shortDate(row.monday, today).split(" ")[0] : ""}</span>,
            ...row.days.map((day) => {
              const workout = byDate.get(day);
              const ring = day === today ? "ring-2 ring-stone-400" : "";
              if (workout) {
                return (
                  <button key={day} type="button" onClick={() => screens.openWorkout(workout.workoutId)}
                    aria-label={`${longDate(day, today)}: ${workout.label}`}
                    className={`h-6 rounded-md ${ring}`} style={{ background: typeColor(workout.type) }} />
                );
              }
              return <span key={day} className={`h-6 rounded-md ${day > today || day < first ? "" : "bg-stone-100"} ${ring}`} />;
            }),
            <span key={`${row.monday}-n`} title={weekText(n)} className={`flex items-center justify-end gap-0.5 tabular-nums ${state === "grow" ? "font-semibold text-stone-800" : state === "hold" ? "text-stone-600" : "text-stone-400"}`}>
              {n > 0 && n}
              {state === "grow" && <Check size={12} weight="bold" aria-label="grew the streak" />}
              {covered && <ShieldCheck size={12} weight="fill" className="text-sky-600" aria-label="covered by a shield" />}
            </span>,
          ];
        })}
      </div>
      {more && (
        <button type="button" onClick={() => setCount(count + 12)} className="mt-2 w-full py-2 text-sm font-medium text-blue-700">
          Show earlier weeks
        </button>
      )}
    </section>
  );
}
