import { Plus } from "@phosphor-icons/react";
import { useState } from "react";

import type { Entry, Exercise, WorkoutBody } from "../api";
import { useExercises } from "../hooks";
import { EntryCard } from "./EntryCard";
import { ExercisePicker } from "./ExercisePicker";

interface Props {
  body: WorkoutBody;
  onChange: (body: WorkoutBody) => void;
  /** Set when editing a saved workout. */
  workoutId?: string;
  /** A set was logged ("Set 2 · Weighted dips"). */
  onSetLogged?: (label: string) => void;
}

/** The exercises of one workout, used both for the workout in progress and for saved ones. */
export function WorkoutEditor({ body, onChange, workoutId, onSetLogged }: Props) {
  const exercises = useExercises();
  const [picking, setPicking] = useState(false);
  const entries = body.entries ?? [];
  const byId = new Map((exercises.data ?? []).map((e) => [e.id, e]));

  const setEntries = (next: Entry[]) => onChange({ ...body, entries: next });

  function add(exercise: Exercise) {
    setPicking(false);
    setEntries([...entries, { exerciseId: exercise.id }]);
    // Bring the new card into view once it renders.
    requestAnimationFrame(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }));
  }

  return (
    <div className="space-y-3">
      {entries.map((entry, i) => {
        const exercise = byId.get(entry.exerciseId);
        if (!exercise) return null;
        return (
          <EntryCard
            key={`${entry.exerciseId}-${i}`}
            entry={entry}
            exercise={exercise}
            excludeWorkoutId={workoutId}
            onChange={(next) => setEntries(entries.map((e, j) => (j === i ? next : e)))}
            onRemove={() => setEntries(entries.filter((_, j) => j !== i))}
            onSetLogged={(label) => onSetLogged?.(label)}
          />
        );
      })}

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
