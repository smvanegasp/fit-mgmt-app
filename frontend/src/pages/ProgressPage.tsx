import { CaretRight, ChartLineUp } from "@phosphor-icons/react";
import { useMemo, useState } from "react";

import type { Lift, ProgressDay } from "../api";
import { GameLegend, StrengthChart, TypeLegend, WeeklyBars, groupColor, typeColor } from "../components/Charts";
import { ComingSoon } from "../components/ComingSoon";
import { InfoTip } from "../components/InfoTip";
import { useScreens } from "../components/Screens";
import { useExercises, useProgress } from "../hooks";
import { RANGES, WEEKLY_GOAL, calendarMonths, rangeStart, shortDate, streaks, weeklyCounts, type Range } from "../lib/progress";
import { localIso } from "../lib/time";
import { longDate } from "../lib/weeks";

export function ProgressPage() {
  const progress = useProgress();
  const [range, setRange] = useState<Range>("6M");
  const today = localIso().slice(0, 10);
  const days = progress.data?.days ?? [];
  const from = rangeStart(range, today, days[0]?.date ?? today);
  const streak = useMemo(() => streaks(days, today), [days, today]);
  const thisYear = days.filter((d) => d.date.startsWith(today.slice(0, 4))).length;

  if (progress.isLoading) return <p className="py-10 text-center text-stone-500">Loading...</p>;
  if (progress.isError) return <p className="py-10 text-center text-red-700">Couldn't load your progress.</p>;
  if (days.length === 0) {
    return <ComingSoon icon={ChartLineUp} title="Progress">Finish a workout and your consistency and strength show up here.</ComingSoon>;
  }

  return (
    <div className="mt-2 space-y-3 pb-28">
      <dl className="grid grid-cols-3 gap-2 text-center">
        <Tile label="Streak" value={weeks(streak.current)} />
        <Tile label="Longest" value={weeks(streak.longest)} />
        <Tile label={`In ${today.slice(0, 4)}`} value={`${thisYear}`} hint="workouts" />
      </dl>
      <p className="-mt-1 flex items-center gap-1 text-xs text-stone-500">
        Streak: weeks in a row with {WEEKLY_GOAL}+ workouts
        <InfoTip title="Streak">
          A week counts when it has at least {WEEKLY_GOAL} workouts. This week doesn't break the streak while it's still
          going; it adds one as soon as it reaches {WEEKLY_GOAL}.
        </InfoTip>
      </p>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 py-1.5" role="radiogroup" aria-label="Range">
        {RANGES.map((r) => (
          <button key={r} type="button" role="radio" aria-checked={range === r} onClick={() => setRange(r)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium ${range === r ? "bg-blue-600 text-white" : "bg-white text-stone-700 ring-1 ring-stone-200"}`}>
            {r === "All" ? "All time" : r === "1Y" ? "1 year" : `${r.slice(0, -1)} months`}
          </button>
        ))}
      </div>

      <section className="rounded-2xl border border-stone-200 bg-white p-4">
        <h2 className="font-semibold">Consistency</h2>
        <div className="mt-1.5"><TypeLegend /></div>
        <Calendar days={days} from={from} today={today} />
        <h3 className="mt-5 flex items-center gap-1 text-sm font-semibold">
          Workouts per week
          <InfoTip title="Workouts per week">
            Each bar is a week, split by day type. The line is the goal of {WEEKLY_GOAL} a week. Tap or drag across the
            bars to see a week.
          </InfoTip>
        </h3>
        <div className="mt-1"><WeeklyBars weeks={weeklyCounts(days, from, today)} today={today} /></div>
      </section>

      <section className="space-y-3">
        <div className="px-1">
          <h2 className="flex items-center gap-1 font-semibold">
            Strength
            <InfoTip title="Strength">
              The line is the heaviest working set of each session, as you write it: plates for barbell lifts (the
              row under the chart adds the 45 lb bar), added weight for dips and chin-ups.
              Ringed dots are PRs; gray dots are light days, kept off the line. The dots under it are the target game: reached adds one, a miss takes one away, a light
              day doesn't count, and a new target starts at one. Tap or drag across a chart to see a session.
            </InfoTip>
          </h2>
          <div className="mt-1.5"><GameLegend /></div>
        </div>
        {(progress.data?.lifts ?? []).map((lift) => <StrengthCard key={lift.exerciseId} lift={lift} from={from} today={today} />)}
      </section>
    </div>
  );
}

function weeks(n: number): string {
  return `${n} ${n === 1 ? "week" : "weeks"}`;
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl bg-white px-2 py-3 ring-1 ring-stone-200">
      <dt className="text-xs text-stone-500">{label}</dt>
      <dd className="mt-0.5 font-semibold">{value}</dd>
      {hint && <dd className="text-xs text-stone-500">{hint}</dd>}
    </div>
  );
}

/** A small calendar per month (newest first); training days wear their day type's color. */
function Calendar({ days, from, today }: { days: ProgressDay[]; from: string; today: string }) {
  const screens = useScreens();
  const byDate = useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);
  return (
    <div className="mt-3 grid grid-cols-3 gap-x-3 gap-y-3 sm:grid-cols-4">
      {calendarMonths(from, today).map((month) => (
        <div key={month.key}>
          <div className="mb-1 text-xs font-medium text-stone-600">{month.label}</div>
          <div className="grid grid-cols-7 gap-[2px]">
            {month.weeks.flat().map((day, i) => {
              if (!day) return <span key={i} aria-hidden />;
              const workout = byDate.get(day);
              const ring = day === today ? "ring-1 ring-stone-500 ring-offset-1 ring-offset-white" : "";
              if (workout) {
                return (
                  <button key={day} type="button" onClick={() => screens.openWorkout(workout.workoutId)}
                    aria-label={`${longDate(day, today)}: ${workout.label}`}
                    className={`aspect-square rounded-[3px] ${ring}`} style={{ background: typeColor(workout.type) }} />
                );
              }
              return <span key={day} className={`aspect-square rounded-[3px] ${day > today ? "" : "bg-stone-100"} ${ring}`} />;
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function StrengthCard({ lift, from, today }: { lift: Lift; from: string; today: string }) {
  const screens = useScreens();
  const exercises = useExercises();
  const group = exercises.data?.find((e) => e.id === lift.exerciseId)?.group;
  const best = lift.sessions.reduce<Lift["sessions"][number] | null>((b, p) => (!b || p.value > b.value ? p : b), null);
  const added = lift.load === "added";
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-4">
      <div className="flex items-start gap-2">
        <button type="button" onClick={() => screens.openExercise(lift.exerciseId)} className="flex min-w-0 flex-1 items-center gap-1 text-left font-semibold">
          {lift.name}
          <CaretRight size={14} className="shrink-0 text-stone-400" aria-hidden />
        </button>
        {best && (
          <div className="text-right text-xs text-stone-500">
            Best <span className="text-sm font-semibold text-stone-900">{added ? "+" : ""}{best.value} {lift.unit}</span>
            <div>{shortDate(best.date)}{best.date.slice(0, 4) !== today.slice(0, 4) ? `, ${best.date.slice(0, 4)}` : ""}</div>
          </div>
        )}
      </div>
      <div className="mt-2">
        <StrengthChart lift={lift} color={groupColor(group)} from={from} to={today} onOpenWorkout={screens.openWorkout} />
      </div>
    </section>
  );
}
