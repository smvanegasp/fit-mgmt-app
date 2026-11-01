import { useState } from "react";

import type { PublicSummary } from "../api";
import { Heatmap } from "../components/Heatmap";
import { Logo } from "../components/Logo";
import { PasscodeSheet } from "../components/PasscodeSheet";
import { GameDots, SetGlyph, TypeLegend, groupColor } from "../components/Progression";
import { TutorialStrip, type Tutorial } from "../components/TutorialStrip";
import { useDesktop, usePublicSummary, useSession, useStartGuest } from "../hooks";
import { streaks } from "../lib/progress";
import { schemeText } from "../lib/sets";
import { localIso } from "../lib/time";

const TUTORIALS: Tutorial[] = [
  {
    id: "log",
    title: "Log a workout in a few taps",
    text: "Start the stopwatch, add an exercise, and every set is filled in from last time.",
  },
  {
    id: "progress",
    title: "See the progress add up",
    text: "Weeks in a row, and each lift's targets: more sets, more reps, then more weight.",
  },
  {
    id: "history",
    title: "Every workout, by month",
    text: "Filter by day type and open any workout, back to the first one.",
  },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// The lifts shown under "In training now", in this order.
const SHOWN = ["squat", "deadlift", "dips"];

/** The first screen without a session: the training log itself up front (live stats, the year of
 * training days, current targets), then who made it and how it works. Continue and I'm Sergio stay
 * in a bar at the bottom on phones; on computers, two columns. */
export function WelcomePage() {
  const session = useSession();
  const start = useStartGuest();
  const summary = usePublicSummary();
  const desktop = useDesktop();
  const [loggingIn, setLoggingIn] = useState(false);
  const today = localIso().slice(0, 10);
  const data = summary.data && summary.data.days.length > 0 ? summary.data : null;

  const header = (
    <header>
      <div className="flex items-center gap-3">
        <Logo size={48} />
        <h1 className="font-display text-5xl leading-none font-bold">Gym</h1>
      </div>
      <p className="mt-2 text-stone-600">Sergio's training log, every workout since September 2025.</p>
    </header>
  );
  const note = (
    <div className="flex items-start gap-3 rounded-2xl border border-stone-200 bg-white p-3">
      <img src="/sergio.jpg" alt="Sergio" width={48} height={48} className="h-12 w-12 shrink-0 rounded-full object-cover" />
      <p className="text-sm text-stone-700">
        <b>Hi, I'm Sergio!</b> For 12 years, calisthenics and weightlifting have been one of the big rocks in my life.
        I use this app to log every workout and see my progress. Take a look!
      </p>
    </div>
  );
  const actions = (
    <Actions start={start} loginEnabled={!!session.data?.ownerLoginEnabled} onLogin={() => setLoggingIn(true)} />
  );
  const clips = (
    <section>
      <h2 className="mb-3 font-display text-2xl font-bold">How it works</h2>
      <TutorialStrip tutorials={TUTORIALS} />
    </section>
  );

  return (
    <div className="min-h-dvh pb-44 lg:pb-12">
      {desktop ? (
        <div className="mx-auto grid max-w-6xl grid-cols-[24rem_1fr] gap-14 px-12 pt-14">
          <div className="space-y-6">
            {header}
            {data && <Stats data={data} today={today} />}
            {note}
            <div className="space-y-3">{actions}</div>
          </div>
          <div className="min-w-0 space-y-8">
            {data && <TrainingDays data={data} today={today} />}
            {data && <InTraining data={data} />}
            {clips}
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-lg space-y-6 px-6 pt-[max(1.5rem,env(safe-area-inset-top))]">
          {header}
          {data && <Stats data={data} today={today} />}
          {data && <TrainingDays data={data} today={today} />}
          {data && <InTraining data={data} />}
          {note}
          {clips}
        </div>
      )}
      {!desktop && (
        // Always in reach on a phone, however far down the page is.
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 bg-stone-50/95 px-6 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
          <div className="mx-auto max-w-lg space-y-2">{actions}</div>
        </div>
      )}
      {loggingIn && <PasscodeSheet onClose={() => setLoggingIn(false)} />}
    </div>
  );
}

function Stats({ data, today }: { data: PublicSummary; today: string }) {
  const streak = streaks(data.days, today);
  const first = data.days[0].date;
  const stats: [string, string][] = [
    [String(data.days.length), "workouts"],
    [String(streak.current), "week streak"],
    [`${MONTHS[Number(first.slice(5, 7)) - 1]} '${first.slice(2, 4)}`, "since"],
  ];
  return (
    <dl className="grid grid-cols-3 gap-2">
      {stats.map(([value, label]) => (
        // Label first for screen readers, number on top on screen.
        <div key={label} className="flex flex-col-reverse rounded-2xl border border-stone-200 bg-white px-2.5 py-3">
          <dt className="mt-1 text-xs text-stone-500">{label}</dt>
          <dd className="font-display text-[1.7rem] leading-none font-bold whitespace-nowrap lg:text-4xl">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function TrainingDays({ data, today }: { data: PublicSummary; today: string }) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-2xl font-bold">Training days</h2>
        <TypeLegend />
      </div>
      <Heatmap days={data.days} today={today} />
    </section>
  );
}

function InTraining({ data }: { data: PublicSummary }) {
  const lifts = SHOWN.map((id) => data.lifts.find((l) => l.exerciseId === id)).filter((l) => l !== undefined);
  if (lifts.length === 0) return null;
  const max = Math.max(...lifts.flatMap((l) => l.scheme.sets));
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-4">
      <h2 className="font-display text-2xl font-bold">In training now</h2>
      <p className="text-sm text-stone-500">The current target for each lift: columns are sets, squares are reps.</p>
      <ul className="mt-3 space-y-3">
        {lifts.map((lift) => (
          <li key={lift.exerciseId} className="flex items-center gap-3">
            <div className="flex w-12 shrink-0 justify-center"><SetGlyph sets={lift.scheme.sets} max={max} color={groupColor(lift.group)} /></div>
            <div className="min-w-0 flex-1">
              <div className="text-sm text-stone-500">{lift.name}</div>
              <div className="font-display text-xl font-semibold">{schemeText(lift.scheme, lift.load)}</div>
            </div>
            <GameDots times={lift.times} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function Actions({ start, loginEnabled, onLogin }: {
  start: ReturnType<typeof useStartGuest>; loginEnabled: boolean; onLogin: () => void;
}) {
  return (
    <>
      <p className="text-center text-sm text-stone-500 lg:text-left">
        Look around a copy of my real log. Your changes stay private and reset after 24 hours.
      </p>
      {start.error && <p className="text-center text-sm text-red-600">{start.error.message}</p>}
      <div className="flex gap-2 lg:flex-col">
        <button type="button" onClick={() => start.mutate()} disabled={start.isPending}
          className="flex-1 rounded-xl bg-blue-600 py-3.5 text-lg font-semibold text-white active:bg-blue-700 disabled:opacity-60">
          {start.isPending ? "Setting up…" : "Continue"}
        </button>
        {loginEnabled && (
          <button type="button" onClick={onLogin}
            className="rounded-xl border border-stone-300 px-5 py-3.5 text-lg font-semibold text-stone-700 lg:w-full">
            I'm Sergio
          </button>
        )}
      </div>
    </>
  );
}
