import { CaretDown, CaretRight, ChartLineUp, Check } from "@phosphor-icons/react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";

import type { ProgressDay, Routine } from "../api";
import { ComingSoon } from "../components/ComingSoon";
import { InfoTip } from "../components/InfoTip";
import { PhotoStrip } from "../components/Photos";
import { GradePyramid, LiftCard, TYPE_COLOR, TypeLegend, groupColor, typeColor } from "../components/Progression";
import { useGoTo } from "../components/Nav";
import { useScreens } from "../components/Screens";
import { WorkoutCard } from "../components/WorkoutCard";
import { useDesktop, useExerciseHistory, useExercises, useProgress, useWorkouts } from "../hooks";
import { climbing } from "../lib/kinds";
import { WEEKLY_GOAL, shortDate, streaks, weekCounts, weekRows } from "../lib/progress";
import { localIso } from "../lib/time";
import { longDate } from "../lib/weeks";

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
    <div className="mt-2 space-y-3 pb-28 lg:mt-0 lg:space-y-6 lg:pb-12">
      {desktop ? <YearConsistency days={days} today={today} /> : <Consistency days={days} today={today} />}

      <section className="space-y-3 lg:space-y-0">
        <h2 className="flex items-center gap-1 px-1 pt-3 font-semibold lg:pt-0 lg:pb-3">
          Strength
          <InfoTip title="Strength">
            Your last targets, oldest to newest: columns are sets and squares are reps, the number under each is the weight.
            Tap a lift for its full progression. Every exercise has one on its page (History, Exercises).
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
          <ClimbingCard />
        </div>
      </section>

      <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
        {(progress.data?.routines ?? []).length > 0 && <Routines routines={progress.data!.routines} today={today} />}
        {desktop && <LastWorkouts />}
      </div>
    </div>
  );
}

/** Computers: the last workouts next to the routine (on phones they're on Train). */
function LastWorkouts() {
  const workouts = useWorkouts(3);
  const screens = useScreens();
  const goTo = useGoTo();
  return (
    <section>
      <h2 className="flex items-center px-1 pt-3 pb-2 font-semibold">
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
  const byDate = useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);
  const counts = useMemo(() => weekCounts(days), [days]);
  const streak = useMemo(() => streaks(days, today), [days, today]);
  // As many recent weeks as fit at full size (a year on a wide screen).
  const grid = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(52);
  useLayoutEffect(() => {
    const el = grid.current;
    if (!el) return;
    const measure = () => setFit(Math.max(8, Math.min(52, Math.floor((el.clientWidth - 24) / 17))));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const weeks = weekRows(today, fit).reverse();
  const thisWeek = counts.get(weeks.at(-1)!.monday) ?? 0;
  const thisYear = days.filter((d) => d.date.startsWith(today.slice(0, 4))).length;
  const first = days[0].date;

  return (
    <section className="flex gap-8 rounded-2xl border border-stone-200 bg-white p-6">
      <div className="w-44 shrink-0">
        <div className="text-4xl font-semibold">{streak.current}</div>
        <div className="flex items-center gap-1 text-sm text-stone-500">
          week streak
          <InfoTip title="Streak">
            Weeks in a row with at least {WEEKLY_GOAL} workouts. This week doesn't break the streak while it's still going.
          </InfoTip>
        </div>
        <dl className="mt-5 space-y-3 text-sm">
          <div><dt className="text-stone-500">Longest</dt><dd className="font-semibold">{streak.longest} weeks</dd></div>
          <div><dt className="text-stone-500">This week</dt><dd className="font-semibold">{thisWeek} of {WEEKLY_GOAL}</dd></div>
          <div><dt className="text-stone-500">In {today.slice(0, 4)}</dt><dd className="font-semibold">{thisYear} workouts</dd></div>
        </dl>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Consistency</h2>
          <TypeLegend />
        </div>
        <div ref={grid} className="mt-4 flex gap-[3px]">
          <div className="mr-1 flex flex-col gap-[3px] pt-5 text-[10px] text-stone-500">
            {WEEKDAYS.map((d, i) => <span key={i} className="h-3.5 leading-[14px]">{i % 2 === 0 ? d : ""}</span>)}
          </div>
          {weeks.map((week, w) => {
            const month = w === 0 || week.monday.slice(0, 7) !== weeks[w - 1].monday.slice(0, 7);
            const n = counts.get(week.monday) ?? 0;
            return (
              <div key={week.monday} className="flex min-w-3.5 flex-1 flex-col gap-[3px]">
                <span className="h-4 text-[10px] whitespace-nowrap text-stone-500">{month ? shortDate(week.monday).split(" ")[0] : ""}</span>
                {week.days.map((day) => {
                  const workout = byDate.get(day);
                  if (workout) {
                    return (
                      <button key={day} type="button" onClick={() => screens.openWorkout(workout.workoutId)}
                        title={`${longDate(day, today)}: ${workout.label}`} aria-label={`${longDate(day, today)}: ${workout.label}`}
                        className={`h-3.5 rounded-[3px] hover:opacity-80 ${day === today ? "ring-2 ring-stone-400" : ""}`}
                        style={{ background: typeColor(workout.type) }} />
                    );
                  }
                  return <span key={day} className={`h-3.5 rounded-[3px] ${day > today || day < first ? "" : "bg-stone-100"}`} />;
                })}
                {/* The week reached the goal. */}
                <span className={`mt-1 h-1 rounded-full ${n >= WEEKLY_GOAL ? "bg-blue-600" : ""}`} title={`${n} workouts`} />
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-stone-500">The blue marks under the weeks reached {WEEKLY_GOAL} workouts. Click a day to open it.</p>
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

/** How the routine evolved: the eras newest first; the current one open, past ones on tap. */
function Routines({ routines, today }: { routines: Routine[]; today: string }) {
  const [open, setOpen] = useState<string | null>(routines[0]?.id ?? null);
  return (
    <section>
      <h2 className="flex items-center gap-1 px-1 pt-3 pb-2 font-semibold">
        Routine
        <InfoTip title="Routine">The plans you followed, newest first, with the workouts logged in each. Tap one to see its days.</InfoTip>
      </h2>
      <ol className="rounded-2xl border border-stone-200 bg-white px-4 py-2">
        {routines.map((r, i) => {
          const isOpen = open === r.id;
          return (
            <li key={r.id} className="relative pl-6">
              {/* The timeline: a dot per era on a line. */}
              <span className={`absolute top-4 left-[5px] size-2.5 rounded-full ${i === 0 ? "bg-blue-600" : "bg-stone-400"}`} aria-hidden />
              {i < routines.length - 1 && <span className="absolute top-7 bottom-0 left-[9px] w-px bg-stone-200" aria-hidden />}
              <button type="button" onClick={() => setOpen(isOpen ? null : r.id)} aria-expanded={isOpen}
                className="flex w-full items-start gap-2 py-2.5 text-left">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{r.name}</span>
                  <span className="text-xs text-stone-500">
                    {shortDate(r.from, today)} – {r.to ? shortDate(r.to, today) : "now"} · {r.sessions} {r.sessions === 1 ? "workout" : "workouts"}
                  </span>
                </span>
                <CaretDown size={14} className={`mt-1 shrink-0 text-stone-400 ${isOpen ? "rotate-180" : ""}`} aria-hidden />
              </button>
              {isOpen && (
                <div className="pb-3 text-sm">
                  <ul className="list-disc space-y-0.5 pl-5 text-stone-700 marker:text-stone-400">
                    {r.days.map((d) => <li key={d}>{d}</li>)}
                  </ul>
                  {r.notes && <p className="mt-2 text-stone-600">{r.notes}</p>}
                  {r.photos.length > 0 && <PhotoStrip photos={r.photos} />}
                </div>
              )}
            </li>
          );
        })}
      </ol>
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
          <div className="text-2xl font-semibold">{streak.current}-week streak</div>
          <div className="text-sm text-stone-500">Longest {streak.longest} weeks</div>
        </div>
        <InfoTip title="Streak">
          Weeks in a row with at least {WEEKLY_GOAL} workouts. This week doesn't break the streak while it's still going; it
          adds one as soon as it reaches {WEEKLY_GOAL}. Tap a day to open that workout.
        </InfoTip>
      </div>
      <div className="mt-3"><TypeLegend /></div>

      <div className="mt-3 grid grid-cols-[2.25rem_repeat(7,1fr)_2.5rem] items-center gap-x-1 gap-y-1 text-xs">
        <span />
        {WEEKDAYS.map((d, i) => <span key={i} className="text-center text-stone-400">{d}</span>)}
        <span />
        {rows.map((row, r) => {
          const n = counts.get(row.monday) ?? 0;
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
            <span key={`${row.monday}-n`} className={`flex items-center justify-end gap-0.5 tabular-nums ${n >= WEEKLY_GOAL ? "font-semibold text-stone-800" : "text-stone-400"}`}>
              {n > 0 && n}
              {n >= WEEKLY_GOAL && <Check size={12} weight="bold" aria-label="goal reached" />}
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
