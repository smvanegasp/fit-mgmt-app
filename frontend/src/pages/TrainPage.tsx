import { CaretDown, CheckCircle, Flag, Play, Timer, X } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

import { api, type Workout, type WorkoutBody } from "../api";
import { BottomSheet } from "../components/BottomSheet";
import { InfoTip } from "../components/InfoTip";
import { StreakCard, StreakCelebration } from "../components/Streak";
import { WorkoutCard } from "../components/WorkoutCard";
import { useScreens } from "../components/Screens";
import { WorkoutEditor } from "../components/WorkoutEditor";
import {
  useActive,
  useAutosave,
  useDiscardWorkout,
  useExercises,
  useFinishWorkout,
  useProgress,
  useSaveActive,
  useSessionTypes,
  useStartWorkout,
  useWorkouts,
} from "../hooks";
import { formatDuration } from "../lib/duration";
import { abandonedAt, currentLap, lapRows } from "../lib/laps";
import { cardioOptions, isLogged, lastCardio, startingEntries } from "../lib/plan";
import { streaks } from "../lib/progress";
import { dayType, heavyNext, nextUp, setCount } from "../lib/sets";
import { streakNews } from "../lib/streak";
import { clockTime, friendlyDate, localIso, secondsBetween } from "../lib/time";

export function TrainPage() {
  const active = useActive();
  const screens = useScreens();
  const [ended, dismiss] = useAutoFinish(active.data);
  const progress = useProgress();
  // The congrats for crossing a streak milestone or earning a shield: fired once, when it happens.
  const [news, setNews] = useState<{ weeks: number; shield: boolean } | null>(null);
  const seen = useRef<{ current: number; shields: number } | null>(null);

  useEffect(() => {
    const days = progress.data?.days;
    if (!days) return;
    const now = streaks(days, localIso().slice(0, 10));
    const was = seen.current;
    seen.current = now;
    if (!was) return;
    const { milestone, shield } = streakNews(was, now);
    if (milestone) setNews({ weeks: milestone, shield: false });
    else if (shield) setNews({ weeks: now.current, shield: true });
  }, [progress.data]);

  const congrats = news ? <StreakCelebration weeks={news.weeks} shield={news.shield} onClose={() => setNews(null)} /> : null;

  if (active.isLoading) return null;
  if (active.error) return <p className="mt-16 text-center text-red-600">Couldn't load: {active.error.message}</p>;
  if (active.data) {
    return (
      <>
        <ActiveWorkout initial={active.data} />
        {congrats}
      </>
    );
  }
  return (
    <>
      {ended && (
        <div role="status" className="mt-4 flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-3 text-sm">
          <p className="flex-1 text-stone-700">
            Your workout was left running, so it was saved for you, ending at your last set ({clockTime(ended.endedAt ?? ended.startedAt)}).{" "}
            <button type="button" onClick={() => screens.openWorkout(ended.id)} className="font-semibold text-blue-700 underline">
              Open it
            </button>
          </p>
          <button type="button" onClick={dismiss} aria-label="Dismiss" className="rounded p-1 text-stone-500">
            <X size={16} weight="bold" aria-hidden />
          </button>
        </div>
      )}
      <Idle onOpen={(w) => screens.openWorkout(w.id)} />
      {congrats}
    </>
  );
}

/**
 * A workout left running (2 hours without a set, Sergio 2026-11-09: one ran 46 hours) is finished
 * by itself, ending at its last set; one with nothing logged is dropped. Checked on opening Train
 * and every minute while it's open. Returns the saved workout, for a notice.
 */
function useAutoFinish(body: WorkoutBody | null | undefined): [Workout | null, () => void] {
  const finish = useFinishWorkout();
  const discard = useDiscardWorkout();
  const [ended, setEnded] = useState<Workout | null>(null);
  const [minute, setMinute] = useState(0);
  const busy = useRef(false);

  useEffect(() => {
    const id = setInterval(() => setMinute((m) => m + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!body || busy.current) return;
    const end = abandonedAt(body.startedAt, body.laps ?? []);
    if (!end) return;
    busy.current = true;
    if (body.entries?.some(isLogged)) {
      finish.mutateAsync(end).then(setEnded).finally(() => { busy.current = false; });
    } else if (!body.notes?.length && !body.photos?.length) {
      discard.mutateAsync().finally(() => { busy.current = false; });
    }
    // Only notes or photos and no exercises: left for Sergio to save or discard.
  }, [body, minute]); // the mutations aren't dependencies: re-check on new data or each minute

  return [ended, () => setEnded(null)];
}

// ------------------------------------------------------------------ before starting

/** Day types offered at the start: the ones trained at least 3 times, and always Cardio (it's part
 * of the weekly goal, Sergio 2026-11-17). */
function useDayTypes() {
  const types = useSessionTypes();
  const labels = (types.data ?? []).filter((t) => t.sessions >= 3).map((t) => t.label);
  return types.data && !labels.includes("Cardio") ? [...labels, "Cardio"] : labels;
}

/** Cardio choices when there's no Cardio history yet. */
const CARDIO_FALLBACK = ["peloton-ride", "peloton-run", "walk", "treadmill"];

function Idle({ onOpen }: { onOpen: (w: Workout) => void }) {
  const start = useStartWorkout();
  const workouts = useWorkouts(30);
  const types = useSessionTypes();
  const exercises = useExercises();
  const progress = useProgress();
  const dayTypes = useDayTypes();
  const today = localIso().slice(0, 10);
  const suggestion = workouts.data ? nextUp(workouts.data, today) : null;
  const [picked, setPicked] = useState<string | null>(null);
  const plan = picked ?? suggestion?.label ?? null;
  const heavy = workouts.data ? heavyNext(workouts.data) : null;
  // A Cardio day is one activity (Sergio, 2026-11-17): pick it, last time's preselected.
  const byId = new Map((exercises.data ?? []).map((e) => [e.id, e]));
  const cardioIds = new Set((exercises.data ?? []).filter((e) => e.group === "cardio" && e.id !== "warm-up").map((e) => e.id));
  const usualCardio = cardioOptions(types.data ?? [], cardioIds);
  const cardioChoices = usualCardio.length > 0 ? usualCardio : CARDIO_FALLBACK.filter((id) => cardioIds.has(id));
  const [cardioPicked, setCardioPicked] = useState<string | null>(null);
  const cardio = cardioPicked ?? lastCardio(workouts.data ?? [], cardioChoices);
  // The last two of the chosen day type (Sergio, 2026-11-03), else the last two of any.
  const all = workouts.data ?? [];
  const ofType = plan ? all.filter((w) => dayType(w.label) === plan) : [];
  const last = (ofType.length > 0 ? ofType : all).slice(0, 2);

  return (
    <div className="pb-28">
      {progress.data && (
        <div className="mt-6">
          <StreakCard days={progress.data.days} today={today} />
        </div>
      )}
      <section className="mt-6">
        <h2 className="font-display text-3xl font-bold">Ready to train</h2>
        <p className="mt-1 flex items-center gap-1 text-stone-600">
          What are you training today?
          <InfoTip title="Day type">
            Preselected: the day you've gone longest without in the last three weeks, following your rotation. It
            decides which exercises the app suggests first.
          </InfoTip>
        </p>
        {dayTypes.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Day type">
            {dayTypes.map((label) => (
              <button
                key={label}
                type="button"
                role="radio"
                aria-checked={plan === label}
                onClick={() => setPicked(label)}
                className={`rounded-full px-4 py-2 font-medium ${plan === label ? "bg-blue-600 text-white" : "bg-white text-stone-700 ring-1 ring-stone-200"}`}
              >
                {label}
                {suggestion?.label === label && <span className="ml-1.5 text-xs opacity-80">next up</span>}
              </button>
            ))}
          </div>
        )}
        {plan === "Legs" && heavy && (
          <p className="mt-3 flex items-center gap-1 text-sm text-stone-700">
            <span className="font-semibold">Heavy {heavy} today</span>
            <span className="text-stone-500">· {heavy === "squat" ? "deadlift" : "squats"} lighter</span>
            <InfoTip title="Legs day">
              Squats and deadlifts share one day: one goes heavy, the other lighter, and they swap each time. Last
              Legs day was heavy {heavy === "squat" ? "deadlift" : "squat"}. Done second and lighter, a lift has its own target.
            </InfoTip>
          </p>
        )}
        {plan === "Cardio" && cardioChoices.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Cardio">
            {cardioChoices.map((id) => (
              <button key={id} type="button" role="radio" aria-checked={cardio === id} onClick={() => setCardioPicked(id)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${cardio === id ? "bg-stone-900 text-white" : "bg-white text-stone-700 ring-1 ring-stone-200"}`}>
                {byId.get(id)?.name ?? id}
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => start.mutate({
            startedAt: localIso(),
            plan: plan ?? undefined,
            entries: startingEntries(plan ?? undefined, types.data ?? [], workouts.data ?? [], new Set(byId.keys()), cardio),
          })}
          disabled={start.isPending}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-5 text-xl font-semibold text-white shadow-sm active:bg-blue-700"
        >
          <Play size={26} weight="fill" aria-hidden /> {plan ? `Start ${plan} workout` : "Start workout"}
        </button>
        <p className="mt-2 text-center text-sm text-stone-500">The stopwatch starts now and keeps running if you lock the phone.</p>
        {start.error && <p className="mt-2 text-sm text-red-600">{start.error.message}</p>}
      </section>

      {last.length > 0 && (
        <section className="mt-10 space-y-2">
          <h2 className="pt-2 text-sm font-semibold tracking-wide text-stone-500 uppercase">{ofType.length > 0 ? `Last ${plan} workouts` : "Last workouts"}</h2>
          {last.map((w) => <WorkoutCard key={w.id} workout={w} onClick={() => onOpen(w)} />)}
        </section>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ the workout in progress

function useTick() {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
}

/** Total time, the running lap (tap to open the lap list), and a Lap button, like the phone's stopwatch. */
function Stopwatch({ body, onLap, lapsOpen, onToggleLaps }: {
  body: WorkoutBody; onLap: () => void; lapsOpen: boolean; onToggleLaps: () => void;
}) {
  useTick();
  const laps = body.laps ?? [];
  return (
    <>
      <div className="min-w-0 flex-1">
        <div className="ember-text font-display text-5xl tabular-nums" aria-label="Elapsed time">
          {formatDuration(secondsBetween(body.startedAt))}
        </div>
        <button
          type="button"
          onClick={onToggleLaps}
          aria-expanded={lapsOpen}
          className="-ml-1 flex items-center gap-1 rounded-md px-1 text-sm font-medium text-stone-700 tabular-nums"
        >
          Lap {laps.length + 1} · {formatDuration(currentLap(body.startedAt, laps))}
          <CaretDown size={14} weight="bold" className={lapsOpen ? "rotate-180" : ""} aria-hidden />
        </button>
      </div>
      <button type="button" onClick={onLap} className="flex items-center gap-1.5 rounded-xl bg-white px-4 py-3 font-semibold text-stone-800 ring-1 ring-stone-300">
        <Timer size={20} weight="fill" aria-hidden /> Lap
      </button>
    </>
  );
}

/** The laps, newest first, opened from the stopwatch: each set starts a lap, so the running lap is the rest. */
function LapList({ body }: { body: WorkoutBody }) {
  useTick();
  const laps = body.laps ?? [];
  return (
    <div className="mt-2 max-h-64 overflow-y-auto rounded-xl bg-white px-3 ring-1 ring-stone-200">
      <ol className="divide-y divide-stone-100 tabular-nums">
        <li className="flex items-center gap-3 py-2.5 font-semibold text-blue-700">
          <span className="w-14">Lap {laps.length + 1}</span>
          <span className="flex-1 text-sm font-normal">running</span>
          <span>{formatDuration(currentLap(body.startedAt, laps))}</span>
        </li>
        {lapRows(body.startedAt, laps).map((row) => (
          <li key={row.number} className="flex items-center gap-3 py-2.5">
            <span className="w-14 text-stone-500">Lap {row.number}</span>
            <span className="min-w-0 flex-1 truncate text-sm text-stone-600">{row.label ?? ""}</span>
            <span className="font-medium">{formatDuration(row.seconds)}</span>
          </li>
        ))}
      </ol>
      {laps.length === 0 && <p className="pb-2.5 text-sm text-stone-500">Logging a set (or tapping Lap) starts a new lap.</p>}
    </div>
  );
}

function ActiveWorkout({ initial }: { initial: WorkoutBody }) {
  const [body, setBody] = useState(initial);
  // The latest version, so a set and its lap logged in the same tap build on each other.
  const latest = useRef(initial);
  // Once finishing or discarding starts, a late autosave must not recreate the workout.
  const ending = useRef(false);
  const saveActive = useSaveActive();
  const autosave = useAutosave((next) => (ending.current ? Promise.resolve() : saveActive(next)));
  const [finishing, setFinishing] = useState(false);
  const [lapsOpen, setLapsOpen] = useState(false);

  const change = (next: WorkoutBody) => {
    latest.current = next;
    setBody(next);
    autosave(next);
  };

  const lap = (label?: string) => {
    const now = latest.current;
    change({ ...now, laps: [...(now.laps ?? []), { at: localIso(), ...(label ? { label } : {}) }] });
  };

  return (
    <div className="pb-28">
      <header className="sticky top-0 z-10 -mx-4 mb-3 border-b border-stone-200 bg-stone-50/95 px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-3 backdrop-blur land:pt-2 land:pb-2">
        <div className="flex items-center gap-2">
          <Stopwatch body={body} onLap={() => lap()} lapsOpen={lapsOpen} onToggleLaps={() => setLapsOpen(!lapsOpen)} />
          <button
            type="button"
            onClick={() => setFinishing(true)}
            className="flex items-center gap-1.5 rounded-xl bg-stone-900 px-4 py-3 font-semibold text-white"
          >
            <Flag size={20} weight="fill" aria-hidden /> Finish
          </button>
        </div>
        {lapsOpen && <LapList body={body} />}
      </header>

      {body.plan && <LastOfType plan={body.plan} />}
      <WorkoutEditor
        body={body}
        onChange={change}
        onSetLogged={(label) => lap(label)}
        focus
      />
      {finishing && (
        <FinishSheet
          body={body}
          onClose={() => setFinishing(false)}
          // Save the last edit, then stop autosaving before the workout is finished or discarded.
          onEnding={async (keep) => {
            if (keep) await api.saveActive(latest.current);
            ending.current = true;
          }}
        />
      )}
    </div>
  );
}

/** "Push day" with the last two Push workouts one tap away (folded), to see what was done (Sergio, 2026-11-11). */
function LastOfType({ plan }: { plan: string }) {
  const workouts = useWorkouts(30);
  const screens = useScreens();
  const [open, setOpen] = useState(false);
  const last = (workouts.data ?? []).filter((w) => dayType(w.label) === plan).slice(0, 2);
  if (last.length === 0) return <p className="mb-2 text-sm font-medium text-stone-500">{plan} day</p>;
  return (
    <div className="mb-3">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
        className="flex w-full items-center gap-1.5 py-1 text-left text-sm font-medium text-stone-500">
        {plan} day · last {last.length === 2 ? "two" : "one"} {last.map((w) => friendlyDate(w.date)).join(", ")}
        <CaretDown size={14} className={`ml-auto ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && (
        <div className="mt-1 space-y-2">
          {last.map((w) => <WorkoutCard key={w.id} workout={w} onClick={() => screens.openWorkout(w.id)} />)}
        </div>
      )}
    </div>
  );
}

function FinishSheet({ body, onClose, onEnding }: {
  body: WorkoutBody; onClose: () => void; onEnding: (keep: boolean) => Promise<void>;
}) {
  const finish = useFinishWorkout();
  const discard = useDiscardWorkout();
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  // The filled-in exercises not done aren't saved.
  const entries = (body.entries ?? []).filter(isLogged);
  const seconds = secondsBetween(body.startedAt);

  return (
    <BottomSheet title="Finish workout" onClose={onClose}>
      <dl className="grid grid-cols-3 gap-2 text-center">
        <Stat label="Time" value={formatDuration(seconds)} />
        <Stat label="Exercises" value={String(entries.length)} />
        <Stat label="Sets" value={String(setCount(entries))} />
      </dl>
      {finish.error && <p className="mt-3 text-sm text-red-600">{finish.error.message}</p>}
      <button
        type="button"
        disabled={finish.isPending || entries.length === 0}
        onClick={async () => {
          await onEnding(true);
          await finish.mutateAsync(localIso());
        }}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-lg font-semibold text-white disabled:opacity-50"
      >
        <CheckCircle size={22} weight="fill" aria-hidden /> Save workout
      </button>
      {entries.length === 0 && <p className="mt-2 text-center text-sm text-stone-500">Log a set first, or discard.</p>}
      <button type="button" onClick={onClose} className="mt-2 w-full rounded-xl border border-stone-300 py-3 font-medium">
        Keep training
      </button>
      {confirmDiscard ? (
        <button type="button" onClick={async () => { await onEnding(false); await discard.mutateAsync(); }}
          className="mt-2 w-full rounded-xl bg-stone-900 py-3 font-medium text-white">
          Yes, discard this workout
        </button>
      ) : (
        <button type="button" onClick={() => setConfirmDiscard(true)} className="mt-2 w-full py-3 text-sm font-medium text-red-600">
          Discard workout
        </button>
      )}
    </BottomSheet>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-stone-100 py-3">
      <dt className="text-xs text-stone-500">{label}</dt>
      <dd className="text-xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
