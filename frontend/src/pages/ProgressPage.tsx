import { ChartLineUp, Check } from "@phosphor-icons/react";
import { useMemo, useState } from "react";

import type { ProgressDay } from "../api";
import { ComingSoon } from "../components/ComingSoon";
import { InfoTip } from "../components/InfoTip";
import { LiftCard, TypeLegend, groupColor, typeColor } from "../components/Progression";
import { useScreens } from "../components/Screens";
import { useExercises, useProgress } from "../hooks";
import { WEEKLY_GOAL, shortDate, streaks, weekCounts, weekRows } from "../lib/progress";
import { localIso } from "../lib/time";
import { longDate } from "../lib/weeks";

export function ProgressPage() {
  const progress = useProgress();
  const exercises = useExercises();
  const screens = useScreens();
  const today = localIso().slice(0, 10);
  const days = progress.data?.days ?? [];

  if (progress.isLoading) return <p className="py-10 text-center text-stone-500">Loading...</p>;
  if (progress.isError) return <p className="py-10 text-center text-red-700">Couldn't load your progress.</p>;
  if (days.length === 0) {
    return <ComingSoon icon={ChartLineUp} title="Progress">Finish a workout and your consistency and strength show up here.</ComingSoon>;
  }

  return (
    <div className="mt-2 space-y-3 pb-28">
      <Consistency days={days} today={today} />

      <h2 className="flex items-center gap-1 px-1 pt-3 font-semibold">
        Strength
        <InfoTip title="Strength">
          Your last targets, oldest to newest: columns are sets and squares are reps, the number under each is the weight.
          Tap a lift for its full progression. Every exercise has one on its page (History, Exercises).
        </InfoTip>
      </h2>
      {(progress.data?.lifts ?? []).map((lift) => {
        const exercise = exercises.data?.find((e) => e.id === lift.exerciseId);
        return (
          <LiftCard key={lift.exerciseId} lift={lift} load={lift.load} color={groupColor(exercise?.group)}
            onOpen={() => screens.openExercise(lift.exerciseId)} />
        );
      })}
    </div>
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
  const rows = weekRows(today, count);
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
