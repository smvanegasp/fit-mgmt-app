import { NotePencil, Plus, X } from "@phosphor-icons/react";
import { useState } from "react";

import type { Entry, Exercise, WorkoutBody } from "../api";
import { useExercises } from "../hooks";
import { EntryCard } from "./EntryCard";
import { ExercisePicker } from "./ExercisePicker";
import { PhotoButton, PhotoStrip } from "./Photos";

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

      <WorkoutNotes body={body} onChange={onChange} />

      {picking && (
        <ExercisePicker onPick={add} onClose={() => setPicking(false)} inWorkout={entries.map((e) => e.exerciseId)} plan={body.plan} />
      )}
    </div>
  );
}

function WorkoutNotes({ body, onChange }: { body: WorkoutBody; onChange: (body: WorkoutBody) => void }) {
  const [writing, setWriting] = useState(false);
  const [text, setText] = useState("");
  const notes = body.notes ?? [];
  const photos = body.photos ?? [];

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-4">
      <h2 className="text-sm font-semibold tracking-wide text-stone-500 uppercase">Workout notes</h2>
      {notes.length === 0 && photos.length === 0 && !writing && (
        <p className="mt-1 text-sm text-stone-500">How you felt, energy, anything about the whole session.</p>
      )}
      <ul className="mt-1 space-y-0.5">
        {notes.map((n, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-stone-700">
            <span className="flex-1">{n}</span>
            <button type="button" onClick={() => onChange({ ...body, notes: notes.filter((_, j) => j !== i) })}
              className="rounded p-0.5 text-stone-400" aria-label="Remove note">
              <X size={14} weight="bold" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <PhotoStrip photos={photos} onRemove={(p) => onChange({ ...body, photos: photos.filter((x) => x.key !== p.key) })} />
      {writing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) onChange({ ...body, notes: [...notes, text.trim()] });
            setText("");
            setWriting(false);
          }}
          className="mt-2 flex gap-2"
        >
          <input autoFocus aria-label="Workout note" value={text} maxLength={1000} onChange={(e) => setText(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-stone-200 px-3 py-2 text-sm" />
          <button className="rounded-lg bg-blue-600 px-3 text-sm font-medium text-white">Save</button>
        </form>
      ) : (
        <div className="mt-1 flex items-center gap-1">
          <button type="button" onClick={() => setWriting(true)}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-stone-600 active:bg-stone-100">
            <NotePencil size={18} weight="fill" aria-hidden /> Note
          </button>
          <PhotoButton onAdded={(p) => onChange({ ...body, photos: [...photos, p] })} />
        </div>
      )}
    </section>
  );
}
