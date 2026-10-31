import { Barbell } from "@phosphor-icons/react";
import { useState } from "react";

import { PasscodeSheet } from "../components/PasscodeSheet";
import { TutorialStrip, type Tutorial } from "../components/TutorialStrip";
import { useSession, useStartGuest } from "../hooks";

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

/** The first screen without a session (adapted from the pantry): who made this and why, the
 * clips, and the way in. Phones: one column that fits the screen; computers: two columns. */
export function WelcomePage() {
  const session = useSession();
  const start = useStartGuest();
  const [loggingIn, setLoggingIn] = useState(false);

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] lg:max-w-6xl lg:flex-row lg:items-center lg:gap-16 lg:px-12">
      <div className="flex flex-col lg:w-96 lg:shrink-0">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white">
            <Barbell size={28} weight="fill" aria-hidden />
          </span>
          <h1 className="text-3xl font-bold">Gym log</h1>
        </div>
        {/* A personal hello instead of a tagline: who made this and why. */}
        <div className="mt-4 flex items-start gap-3 rounded-2xl bg-blue-50 p-3">
          <img src="/sergio.jpg" alt="Sergio" width={48} height={48}
            className="h-12 w-12 shrink-0 rounded-full object-cover ring-2 ring-white" />
          <p className="text-sm text-stone-700">
            <b>Hi, I'm Sergio!</b> For over a year I logged every set in a WhatsApp chat with myself. This app turns
            those messages into a log I can learn from: what I lifted, what's next, and the cues that make each lift go
            better.
          </p>
        </div>

        <div className="mt-auto hidden space-y-3 pt-8 lg:block">
          <Actions start={start} loginEnabled={!!session.data?.ownerLoginEnabled} onLogin={() => setLoggingIn(true)} />
        </div>
      </div>

      <div className="mt-5 lg:mt-0 lg:flex-1">
        <TutorialStrip tutorials={TUTORIALS} />
      </div>

      <div className="mt-auto space-y-3 pt-5 lg:hidden">
        <Actions start={start} loginEnabled={!!session.data?.ownerLoginEnabled} onLogin={() => setLoggingIn(true)} />
      </div>

      {loggingIn && <PasscodeSheet onClose={() => setLoggingIn(false)} />}
    </div>
  );
}

function Actions({ start, loginEnabled, onLogin }: {
  start: ReturnType<typeof useStartGuest>; loginEnabled: boolean; onLogin: () => void;
}) {
  return (
    <>
      <p className="text-center text-sm text-stone-500 lg:text-left">
        Look around a copy of my real training log. Your changes stay private and reset after 24 hours.
      </p>
      {start.error && <p className="text-center text-sm text-red-600">{start.error.message}</p>}
      <button type="button" onClick={() => start.mutate()} disabled={start.isPending}
        className="w-full rounded-xl bg-blue-600 py-3.5 text-lg font-semibold text-white active:bg-blue-700 disabled:opacity-60">
        {start.isPending ? "Setting up your copy…" : "Continue"}
      </button>
      {loginEnabled && (
        <button type="button" onClick={onLogin}
          className="w-full rounded-xl border border-stone-300 py-3.5 text-lg font-semibold text-stone-700">
          I'm Sergio
        </button>
      )}
    </>
  );
}
