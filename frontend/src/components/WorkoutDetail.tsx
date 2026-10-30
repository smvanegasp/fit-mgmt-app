import { CaretDown, CaretRight, PencilSimple } from "@phosphor-icons/react";
import { useState } from "react";

import type { Entry, Exercise, Workout } from "../api";
import { useExercises, useWorkout } from "../hooks";
import { formatDuration } from "../lib/duration";
import { lapRows } from "../lib/laps";
import { summarizeSets } from "../lib/sets";
import { clockTime, localIso, minutesText, workoutMinutes } from "../lib/time";
import { longDate } from "../lib/weeks";
import { EditWorkout } from "./EditWorkout";
import { HOLD_COLORS, Ladder } from "./EntryCard";
import { PhotoStrip } from "./Photos";
import { Screen } from "./Screen";
import { useScreens } from "./Screens";

/** A saved workout to read: what was done, notes, photos and laps. Edit from the header. */
export function WorkoutDetail({ workoutId, onClose }: { workoutId: string; onClose: () => void }) {
  const workout = useWorkout(workoutId);
  const exercises = useExercises();
  const [editing, setEditing] = useState(false);
  const byId = new Map((exercises.data ?? []).map((e) => [e.id, e]));
  const w = workout.data;

  return (
    <Screen
      title={w?.label ?? "Workout"}
      subtitle={w ? <WorkoutWhen workout={w} /> : undefined}
      onBack={onClose}
      actions={
        w && (
          <button type="button" onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 font-semibold text-stone-800 ring-1 ring-stone-300">
            <PencilSimple size={18} weight="fill" aria-hidden /> Edit
          </button>
        )
      }
    >
      {workout.isLoading && <p className="py-8 text-center text-stone-500">Loading...</p>}
      {workout.error && <p className="py-8 text-center text-stone-500">This workout no longer exists.</p>}
      {w && (
        <div className="space-y-3">
          {w.durationEstimated && (
            <p className="text-xs text-stone-500">
              Times estimated from the WhatsApp log: about 20 min of warm-up and 40 min for the first exercise before the
              first message; it ends with the last one.
            </p>
          )}
          {(w.entries ?? []).map((entry, i) => (
            <EntryView key={i} entry={entry} exercise={byId.get(entry.exerciseId)} />
          ))}
          {((w.notes?.length ?? 0) > 0 || (w.photos?.length ?? 0) > 0) && (
            <section className="rounded-2xl border border-stone-200 bg-white p-4">
              <h2 className="text-sm font-semibold tracking-wide text-stone-500 uppercase">Workout notes</h2>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-stone-700">
                {(w.notes ?? []).map((n, i) => <li key={i}>{n}</li>)}
              </ul>
              <PhotoStrip photos={w.photos ?? []} />
            </section>
          )}
          <Laps workout={w} />
        </div>
      )}
      {editing && w && <EditWorkout workout={w} onClose={() => setEditing(false)} onDeleted={onClose} />}
    </Screen>
  );
}

function WorkoutWhen({ workout }: { workout: Workout }) {
  const minutes = workoutMinutes(workout);
  const approx = workout.durationEstimated ? "~" : "";
  return (
    <>
      {longDate(workout.date, localIso().slice(0, 10))} · {approx}{clockTime(workout.startedAt)}
      {minutes ? ` · ${approx}${minutesText(minutes)}` : ""}
    </>
  );
}

function EntryView({ entry, exercise }: { entry: Entry; exercise?: Exercise }) {
  const screens = useScreens();
  const sets = entry.sets ?? [];
  const work = sets.filter((s) => !s.drop);
  const drop = sets.filter((s) => s.drop);

  return (
    <article className="rounded-2xl border border-stone-200 bg-white p-4">
      <button type="button" onClick={() => exercise && screens.openExercise(exercise.id)}
        className="flex w-full items-center gap-2 text-left">
        <h2 className="flex-1 text-lg font-semibold">{exercise?.name ?? "Exercise"}</h2>
        <CaretRight size={18} className="text-stone-400" aria-hidden />
      </button>
      {(work.length > 0 || drop.length > 0) && (
        <dl className="mt-2 grid grid-cols-[4.5rem_1fr] gap-x-2 gap-y-1 text-sm">
          {work.length > 0 && (
            <>
              <dt className="text-stone-500">Sets</dt>
              <dd>{summarizeSets(work, exercise?.load ?? "machine")}</dd>
            </>
          )}
          {drop.length > 0 && (
            <>
              <dt className="text-stone-500">Drop set</dt>
              <dd><Ladder sets={drop} /></dd>
            </>
          )}
        </dl>
      )}
      {(entry.problems ?? []).length > 0 && (
        <ul className="mt-2 space-y-1 text-sm">
          {entry.problems!.map((p, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="font-semibold">{p.grade}</span>
              {p.color && <span className="size-3.5 rounded-full border border-stone-300" style={{ background: HOLD_COLORS[p.color] ?? "#a8a29e" }} />}
              <span className="text-stone-600">
                {p.result === "sent" ? `sent${p.count && p.count > 1 ? ` ×${p.count}` : ""}` : `tried${p.attempts ? ` ×${p.attempts}` : ""}`}
                {p.note ? ` · ${p.note}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
      {(entry.distanceMi || entry.minutes || (entry.segments ?? []).length > 0) && (
        <p className="mt-2 text-sm text-stone-700">
          {entry.distanceMi ? `${entry.distanceMi} mi` : ""}
          {entry.distanceMi && (entry.minutes || entry.segments?.length) ? " · " : ""}
          {entry.minutes
            ? `${entry.minutes} min`
            : entry.segments?.length
              ? `${entry.segments.reduce((m, s) => m + s.minutes, 0)} min, up to ${Math.max(...entry.segments.map((s) => s.mph))} mph`
              : ""}
        </p>
      )}
      {(entry.notes ?? []).length > 0 && (
        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-stone-600">
          {entry.notes!.map((n, i) => <li key={i}>{n}</li>)}
        </ul>
      )}
      <PhotoStrip photos={entry.photos ?? []} />
    </article>
  );
}

function Laps({ workout }: { workout: Workout }) {
  const [open, setOpen] = useState(false);
  const laps = workout.laps ?? [];
  if (laps.length === 0) return null;
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-4">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-2">
        <h2 className="flex-1 text-left text-sm font-semibold tracking-wide text-stone-500 uppercase">Laps ({laps.length})</h2>
        <CaretDown size={16} className={open ? "rotate-180" : ""} aria-hidden />
      </button>
      {open && (
        <ol className="mt-2 divide-y divide-stone-100 text-sm tabular-nums">
          {lapRows(workout.startedAt, laps).map((row) => (
            <li key={row.number} className="flex items-center gap-3 py-2">
              <span className="w-14 text-stone-500">Lap {row.number}</span>
              <span className="min-w-0 flex-1 truncate text-stone-600">{row.label ?? ""}</span>
              <span className="font-medium">{formatDuration(row.seconds)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
