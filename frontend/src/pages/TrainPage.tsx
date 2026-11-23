import { CaretDown, Check, CheckCircle, Flag, PencilSimple, Play, Timer, X } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

import { api, type Workout, type WorkoutBody } from "../api";
import { BottomSheet } from "../components/BottomSheet";
import { InfoTip } from "../components/InfoTip";
import { PlanEditor } from "../components/PlanEditor";
import { StreakCard, StreakCelebration } from "../components/Streak";
import { WorkoutTierCelebration } from "../components/Tiers";
import { WorkoutCard } from "../components/WorkoutCard";
import { useScreens } from "../components/Screens";
import { WorkoutEditor } from "../components/WorkoutEditor";
import {
  useActive,
  useAutosave,
  useDiscardWorkout,
  useExercises,
  useFinishWorkout,
  usePlans,
  useProgress,
  useSaveActive,
  useSessionTypes,
  useStartWorkout,
  useWorkouts,
} from "../hooks";
import { formatDuration } from "../lib/duration";
import { abandonedAt, currentLap, lapRows } from "../lib/laps";
import { cycleView, isLogged, lastCardio, planEntries, startingEntries, type CycleDay, type DayOption } from "../lib/plan";
import { streaks } from "../lib/progress";
import type { Tier } from "../lib/tiers";
import { dayType, heavyNext, nextUp, setCount, workoutTitle } from "../lib/sets";
import { streakNews } from "../lib/streak";
import { clockTime, friendlyDate, localIso, secondsBetween } from "../lib/time";

export function TrainPage() {
  const active = useActive();
  const screens = useScreens();
  const [ended, dismiss] = useAutoFinish(active.data);
  const progress = useProgress();
  // The congrats for a new streak tier, a shield or a workout tier: fired once, when it happens.
  const [news, setNews] = useState<{ weeks: number; shield: boolean } | { workouts: Tier } | null>(null);
  const seen = useRef<{ current: number; shields: number; workouts: number } | null>(null);

  useEffect(() => {
    const days = progress.data?.days;
    if (!days) return;
    const now = { ...streaks(days, localIso().slice(0, 10)), workouts: days.length };
    const was = seen.current;
    seen.current = now;
    if (!was) return;
    const { milestone, shield, workouts } = streakNews(was, now);
    if (milestone) setNews({ weeks: milestone, shield: false });
    else if (shield) setNews({ weeks: now.current, shield: true });
    else if (workouts) setNews({ workouts });
  }, [progress.data]);

  const congrats = !news ? null : "workouts" in news
    ? <WorkoutTierCelebration tier={news.workouts} onClose={() => setNews(null)} />
    : <StreakCelebration weeks={news.weeks} shield={news.shield} onClose={() => setNews(null)} />;

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
        <div role="status" className="mb-6 flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-3 text-sm">
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

/** The cardio that counts (Sergio, 2026-11-23: just the Peloton ride and the treadmill). */
const CARDIO = ["peloton-ride", "treadmill"];

function Idle({ onOpen }: { onOpen: (w: Workout) => void }) {
  const start = useStartWorkout();
  const workouts = useWorkouts(30);
  const types = useSessionTypes();
  const exercises = useExercises();
  const progress = useProgress();
  const dayTypes = useDayTypes();
  const today = localIso().slice(0, 10);
  const plans = usePlans(today);
  const [editing, setEditing] = useState(false);
  const cardioIds = new Set((exercises.data ?? []).filter((e) => e.group === "cardio" && e.id !== "warm-up").map((e) => e.id));
  // The plan as one cycle of days (Sergio, 2026-11-23): the last two workouts and the next four days
  // from where they are, whatever the calendar week. "Other days" shows the rest of the cycle.
  const weeks = plans.data?.weeks ?? [];
  const view = workouts.data ? cycleView(weeks, workouts.data, cardioIds) : null;
  const planned = view && view.cycle.length > 0 ? view : null;
  const [more, setMore] = useState(false);
  const shown = planned ? [...planned.next, ...(more ? planned.cycle.filter((d) => !planned.next.includes(d)) : [])] : [];
  const toOption = (d: CycleDay): DayOption => ({
    key: d.key, label: d.day.name, dayType: d.day.kind, done: false, optional: d.day.optional,
    exercises: d.day.exercises.length ? d.day.exercises : undefined,
  });

  // The choices: the cycle's days, or the day types when there's no plan yet.
  const suggestion = workouts.data ? nextUp(workouts.data, today) : null;
  const options: DayOption[] = planned
    ? shown.map(toOption)
    : dayTypes.map((label) => ({ key: label, label, dayType: label, done: false }));
  // Next up: the next day of the cycle (skipping an optional one when a counted day follows).
  const next = planned ? (planned.next.find((d) => !d.day.optional) ?? planned.next[0])?.key ?? null : suggestion?.label ?? null;
  // undefined: the suggestion; null: nothing (tapping the chosen day again clears it, Sergio 2026-11-23).
  const [picked, setPicked] = useState<string | null | undefined>(undefined);
  const chosen = options.find((o) => o.key === (picked === undefined ? next : picked)) ?? null;
  const toggle = (key: string) => setPicked(chosen?.key === key ? null : key);
  const plan = chosen?.dayType ?? null;
  const heavy = workouts.data ? heavyNext(workouts.data) : null;
  // A Cardio day is one activity (Sergio, 2026-11-17): pick it, last time's preselected.
  const byId = new Map((exercises.data ?? []).map((e) => [e.id, e]));
  const names = new Map((exercises.data ?? []).map((e) => [e.id, e.name]));
  const cardioChoices = CARDIO.filter((id) => cardioIds.has(id));
  const [cardioPicked, setCardioPicked] = useState<string | null>(null);
  const cardio = cardioPicked ?? lastCardio(workouts.data ?? [], cardioChoices);
  const known = new Set(byId.keys());

  const entries = chosen?.exercises
    ? planEntries(chosen.exercises, known)
    : startingEntries(plan ?? undefined, types.data ?? [], workouts.data ?? [], known, cardio);

  // The ride or the treadmill for a Cardio day, then Start.
  const startBlock = (
    <>
      {plan === "Cardio" && !chosen?.exercises && cardioChoices.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Cardio">
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
        onClick={() => start.mutate({ startedAt: localIso(), plan: plan ?? undefined, entries, ...(planned && chosen ? { planDays: [chosen.key] } : {}) })}
        disabled={start.isPending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-4 text-xl font-semibold text-white shadow-sm active:bg-blue-700"
      >
        <Play size={24} weight="fill" aria-hidden /> {chosen ? `Start ${chosen.label}` : "Start workout"}
      </button>
      {start.error && <p className="mt-2 text-sm text-red-600">{start.error.message}</p>}
    </>
  );

  return (
    // Every tab starts its first block at the same height (Sergio, 2026-11-23): no margin on top.
    <div className="pb-28 [&>*:first-child]:mt-0">
      {progress.data && (
        <div className="mt-6">
          <StreakCard days={progress.data.days} today={today} />
        </div>
      )}
      <section className="mt-6">
        <h2 className="font-display text-3xl font-bold">Ready to train</h2>
        {planned ? (
          // Where Sergio is in the plan (Sergio, 2026-11-23: "the next 4 trainings and the last two,
          // always"): the last two workouts, done, then the next four days to pick from.
          <div className="mt-3 overflow-hidden rounded-2xl border border-stone-200 bg-white">
            <div className="flex items-center gap-1 border-b border-stone-200 px-4 py-3">
              <div className="min-w-0 flex-1 text-xs font-semibold tracking-wide text-stone-500 uppercase">Your plan</div>
              <InfoTip title="Your plan">
                Your days repeat in order. You pick up after your last workout, whatever the week. Tap a day to switch.
              </InfoTip>
            </div>
            <ol aria-label="Last workouts" className="divide-y divide-stone-200 border-b border-stone-200">
              {planned.last.map(({ workout, days }) => (
                <li key={workout.id}>
                  <button type="button" onClick={() => onOpen(workout)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left">
                    <Check size={16} weight="bold" className="shrink-0 text-stone-400" aria-hidden />
                    <span className="min-w-0 flex-1 truncate font-medium text-stone-500">
                      {days.length ? days.map((d) => d.day.name).join(" + ") : workoutTitle(workout, names)}
                    </span>
                    <span className="shrink-0 text-xs text-stone-500">{friendlyDate(workout.date)}</span>
                  </button>
                </li>
              ))}
            </ol>
            <div role="radiogroup" aria-label="Up next" className="divide-y divide-stone-200">
              {options.map((o, i) => {
                const on = chosen?.key === o.key;
                return (
                  <button key={o.key} type="button" role="radio" aria-checked={on} onClick={() => toggle(o.key)}
                    className={`relative flex w-full items-center gap-3 px-4 py-3.5 text-left ${on ? "bg-stone-100" : ""}`}>
                    {on && <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-blue-600" />}
                    <span className="w-4 shrink-0 text-center text-sm text-stone-400 tabular-nums">{i < planned.next.length ? i + 1 : ""}</span>
                    <span className="min-w-0 flex-1 text-lg font-semibold">
                      {o.label}
                      {o.optional && <span className="ml-2 text-xs font-medium text-stone-500">optional</span>}
                    </span>
                    {next === o.key && <span className="shrink-0 rounded-[3px] bg-blue-600 px-1.5 py-0.5 text-xs font-semibold text-white">Next</span>}
                  </button>
                );
              })}
            </div>
            {/* Start inside the card, under the days it starts (Sergio, 2026-11-23: better use of the space). */}
            <div className="border-t border-stone-200 p-3">{startBlock}</div>
            <div className="flex items-center border-t border-stone-200 px-2 py-1">
              <button type="button" onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm font-medium text-stone-600">
                <PencilSimple size={16} weight="fill" aria-hidden /> Edit plans
              </button>
              {planned.cycle.length > planned.next.length && (
                <button type="button" onClick={() => setMore(!more)} aria-expanded={more}
                  className="ml-auto rounded-lg px-2 py-2 text-sm font-medium text-stone-600">
                  {more ? "Fewer days" : "Other days"}
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            <p className="mt-1 flex items-center gap-1 text-stone-600">
              What are you training today?
              <InfoTip title="Day type">
                Picked for you: the day you've gone longest without. It sets the suggested exercises.
              </InfoTip>
            </p>
            {options.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Day">
                {options.map((o) => (
                  <button key={o.key} type="button" role="radio" aria-checked={chosen?.key === o.key} onClick={() => toggle(o.key)}
                    className={`rounded-full px-4 py-2 font-medium ${chosen?.key === o.key ? "bg-blue-600 text-white" : "bg-white text-stone-700 ring-1 ring-stone-200"}`}>
                    {o.label}
                    {next === o.key && <span className="ml-1.5 text-xs opacity-80">next up</span>}
                  </button>
                ))}
              </div>
            )}
            {plans.data && (
              <button type="button" onClick={() => setEditing(true)}
                className="mt-3 flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm font-medium text-blue-700">
                <PencilSimple size={16} weight="fill" aria-hidden /> Set up a training plan
              </button>
            )}
          </>
        )}
        {!planned && plan === "Legs" && heavy && (
          <p className="mt-3 flex items-center gap-1 text-sm text-stone-700">
            <span className="font-semibold">Heavy {heavy} today</span>
            <span className="text-stone-500">· {heavy === "squat" ? "deadlift" : "squats"} lighter</span>
            <InfoTip title="Legs day">
              Squat and deadlift take turns going heavy. Last time was heavy {heavy === "squat" ? "deadlift" : "squat"}.
            </InfoTip>
          </p>
        )}
        {!planned && <div className="mt-5">{startBlock}</div>}
      </section>
      {editing && <PlanEditor plans={plans.data!} today={today} onClose={() => setEditing(false)} />}
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
        {/* The total stays first and biggest; the lap is read often too, so it's big enough to
            catch at a glance (Sergio, 2026-11-20). */}
        <div className="ember-text font-display text-[2.6rem] leading-none tabular-nums" aria-label="Elapsed time">
          {formatDuration(secondsBetween(body.startedAt))}
        </div>
        <button
          type="button"
          onClick={onToggleLaps}
          aria-expanded={lapsOpen}
          className="-ml-1 mt-1 flex items-baseline gap-1.5 rounded-md px-1 text-stone-700 tabular-nums"
        >
          <span className="font-display text-2xl leading-none text-stone-500">Lap {laps.length + 1}</span>
          <span className="font-display text-2xl leading-none text-stone-900">{formatDuration(currentLap(body.startedAt, laps))}</span>
          <CaretDown size={14} weight="bold" className={`self-center ${lapsOpen ? "rotate-180" : ""}`} aria-hidden />
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

  // The fixed bar's height (it grows with the lap list), for the spacer under it.
  const bar = useRef<HTMLElement>(null);
  const [barHeight, setBarHeight] = useState(0);
  useEffect(() => {
    const el = bar.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setBarHeight(el.offsetHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const lap = (label?: string) => {
    const now = latest.current;
    change({ ...now, laps: [...(now.laps ?? []), { at: localIso(), ...(label ? { label } : {}) }] });
  };

  return (
    // Starts at the top of the screen: the stopwatch bar is fixed there and the spacer takes its place.
    <div className="-mt-[calc(env(safe-area-inset-top)+1rem)] pb-28 lg:-mt-8">
      {/* Fixed, not sticky (Sergio, 2026-11-23): on the iPhone, pulling the page down dragged a
          sticky bar with it. Above the grain (z-25) so iOS paints the clock strip from it. */}
      <header ref={bar}
        className="fixed inset-x-0 top-0 z-[26] border-b border-stone-200 bg-stone-50 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-3 land:pt-2 land:pb-2 land:pl-[calc(4.5rem+env(safe-area-inset-left)*0.75)] lg:pl-56">
        <div className="mx-auto max-w-lg px-4 land:pr-[max(1rem,env(safe-area-inset-right))] lg:px-10">
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
        </div>
      </header>
      <div aria-hidden style={{ height: barHeight }} className="mb-3" />

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
