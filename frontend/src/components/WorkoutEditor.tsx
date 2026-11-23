import { CaretRight, CaretUp, CheckCircle, Plus } from "@phosphor-icons/react";
import { useState } from "react";

import type { Entry, Exercise, WorkoutBody } from "../api";
import { useExercises } from "../hooks";
import { currentIndex } from "../lib/plan";
import { summarizeSets } from "../lib/sets";
import { EntryCard } from "./EntryCard";
import { ExercisePicker } from "./ExercisePicker";

interface Props {
  body: WorkoutBody;
  onChange: (body: WorkoutBody) => void;
  /** Set when editing a saved workout. */
  workoutId?: string;
  /** A set was logged ("Set 2 · Weighted dips"). */
  onSetLogged?: (label: string) => void;
  /**
   * The workout in progress: only the exercise being done is open; done ones fold into a line and
   * the rest wait as "Up next" (Sergio, 2026-11-07: more room for the current exercise).
   */
  focus?: boolean;
}

const isLift = (exercise: Exercise | undefined) => exercise?.measure === "reps" || exercise?.measure === "seconds";

/** The exercises of one workout, used both for the workout in progress and for saved ones. */
export function WorkoutEditor({ body, onChange, workoutId, onSetLogged, focus = false }: Props) {
  const exercises = useExercises();
  const [picking, setPicking] = useState(false);
  // An exercise opened by tapping it; otherwise the first one not done is open.
  const [picked, setPicked] = useState<number | null>(null);
  const entries = body.entries ?? [];
  const byId = new Map((exercises.data ?? []).map((e) => [e.id, e]));
  const open = focus ? (picked !== null && picked < entries.length ? picked : currentIndex(entries)) : null;

  const setEntries = (next: Entry[]) => onChange({ ...body, entries: next });
  // Today's first lift: the first one with sets, else the one open now (or the first in the list).
  // A warm-up, run or climbing doesn't count; the server judges saved workouts the same way.
  const withSets = entries.findIndex((e) => isLift(byId.get(e.exerciseId)) && e.sets?.length);
  const firstLift = withSets >= 0 ? withSets
    : open !== null && open >= 0 && isLift(byId.get(entries[open]?.exerciseId)) ? open
      : entries.findIndex((e) => isLift(byId.get(e.exerciseId)));

  function add(exercise: Exercise) {
    setPicking(false);
    setEntries([...entries, { exerciseId: exercise.id }]);
    if (focus) {
      setPicked(entries.length); // picked to do now
      showCurrent();
    } else {
      // Bring the new card into view once it renders.
      requestAnimationFrame(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }));
    }
  }

  /** Scroll the exercise open now to just under the stopwatch, once it renders. */
  function showCurrent() {
    requestAnimationFrame(() => requestAnimationFrame(() =>
      document.querySelector("[data-current]")?.scrollIntoView({ behavior: "smooth", block: "start" })));
  }

  function change(i: number, next: Entry) {
    // Marked done: the next exercise not done opens.
    if (next.done && !entries[i].done) {
      setPicked(null);
      showCurrent();
    }
    setEntries(entries.map((e, j) => (j === i ? next : e)));
  }

  const upNext = focus ? entries.map((e, i) => ({ e, i })).filter(({ e, i }) => !e.done && i !== open) : [];

  return (
    <div className="space-y-3">
      {entries.map((entry, i) => {
        const exercise = byId.get(entry.exerciseId);
        if (!exercise) return null;
        if (focus && i !== open) {
          return entry.done ? <DoneRow key={`${entry.exerciseId}-${i}`} entry={entry} exercise={exercise} onOpen={() => { setPicked(i); showCurrent(); }} /> : null;
        }
        return (
          <div key={`${entry.exerciseId}-${i}`} data-current={focus || undefined} className="scroll-mt-28">
          <EntryCard
            entry={entry}
            exercise={exercise}
            excludeWorkoutId={workoutId}
            role={i === firstLift ? "first" : "later"}
            draftKey={`${workoutId ?? body.startedAt}|${i}|${entry.exerciseId}`}
            startedAt={body.startedAt}
            focus={focus}
            onChange={(next) => change(i, next)}
            onRemove={() => {
              setPicked(null);
              setEntries(entries.filter((_, j) => j !== i));
            }}
            onSetLogged={(label) => onSetLogged?.(label)}
          />
          {/* A finished exercise opened again folds back with one tap (Sergio, 2026-11-21). */}
          {focus && entry.done && (
            <button type="button" onClick={() => { setPicked(null); showCurrent(); }}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-stone-300 py-3 font-semibold text-stone-700">
              <CaretUp size={18} weight="bold" aria-hidden /> Close {exercise.name}
            </button>
          )}
          </div>
        );
      })}

      {upNext.length > 0 && (
        <section aria-label="Up next">
          <h2 className="mt-5 mb-1.5 text-sm font-semibold tracking-wide text-stone-500 uppercase">Up next</h2>
          <ul className="divide-y divide-stone-200 overflow-hidden rounded-2xl border border-stone-200 bg-white">
            {upNext.map(({ e, i }) => (
              <li key={`${e.exerciseId}-${i}`}>
                <button type="button" onClick={() => { setPicked(i); showCurrent(); }} className="flex w-full items-center gap-2 px-4 py-3.5 text-left">
                  <span className="flex-1 font-medium">{byId.get(e.exerciseId)?.name ?? e.exerciseId}</span>
                  {e.sets?.length ? <span className="text-sm text-stone-500">{e.sets.length} sets</span> : null}
                  <CaretRight size={16} className="text-stone-400" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <button
        type="button"
        onClick={() => setPicking(true)}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-stone-300 py-4 text-lg font-semibold text-blue-700"
      >
        <Plus size={22} weight="bold" aria-hidden /> Add exercise
      </button>


      {picking && (
        <ExercisePicker onPick={add} onClose={() => setPicking(false)} inWorkout={entries.map((e) => e.exerciseId)} plan={body.plan} />
      )}
    </div>
  );
}

/** A finished exercise, folded to one line; tap to open it again. */
function DoneRow({ entry, exercise, onOpen }: { entry: Entry; exercise: Exercise; onOpen: () => void }) {
  const detail = exercise.measure === "time"
    ? `${Math.round(entry.minutes ?? 0)} min`
    : entry.sets?.length ? summarizeSets(entry.sets, exercise.load) : entry.problems?.length ? `${entry.problems.length} problems` : "";
  return (
    <button type="button" onClick={onOpen}
      className="flex w-full items-center gap-2.5 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-left">
      <CheckCircle size={20} weight="fill" className="shrink-0 text-blue-600" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{exercise.name}</span>
        {detail && <span className="block truncate text-sm text-stone-500">{detail}</span>}
      </span>
      <CaretRight size={16} className="shrink-0 text-stone-400" aria-hidden />
    </button>
  );
}
