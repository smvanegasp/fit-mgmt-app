import type { Entry, Exercise, Workout } from "../api";
import { useExercises } from "../hooks";
import { summarizeSets, workoutTitle } from "../lib/sets";
import { friendlyDate, minutesText, workoutMinutes } from "../lib/time";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** The main thing done for one exercise: its heaviest sets, best boulder, or distance. */
export function highlight(entry: Entry, exercise: Exercise | undefined): string | null {
  if (!exercise) return null;
  if (entry.problems?.length) {
    const sent = entry.problems.filter((p) => p.result === "sent").map((p) => Number(p.grade.slice(1)));
    return sent.length ? `${exercise.name} up to V${Math.max(...sent)}` : exercise.name;
  }
  if (entry.distanceMi || entry.peloton?.outputKj !== undefined) {
    // "Peloton ride 18.51 mi · 526 kJ"
    const parts = [entry.distanceMi && `${entry.distanceMi} mi`, entry.peloton?.outputKj !== undefined && `${entry.peloton.outputKj} kJ`];
    return `${exercise.name} ${parts.filter(Boolean).join(" · ")}`;
  }
  const sets = (entry.sets ?? []).filter((s) => !s.drop);
  if (!sets.length) return exercise.name;
  const top = Math.max(...sets.map((s) => s.weightLb ?? 0));
  const main = summarizeSets(sets.filter((s) => (s.weightLb ?? 0) === top), exercise.load);
  return `${exercise.name} ${main}`;
}

export function WorkoutCard({ workout, onClick }: { workout: Workout; onClick: () => void }) {
  const exercises = useExercises();
  const byId = new Map((exercises.data ?? []).map((e) => [e.id, e]));
  const names = new Map((exercises.data ?? []).map((e) => [e.id, e.name]));
  const minutes = workoutMinutes(workout);
  const day = new Date(`${workout.date}T12:00:00`);
  // The warm-up isn't a highlight (its time shows on the workout page).
  const entries = (workout.entries ?? []).filter((e) => byId.get(e.exerciseId)?.measure !== "time");
  const lines = entries.slice(0, 3).map((e) => highlight(e, byId.get(e.exerciseId))).filter(Boolean);
  const more = entries.length - lines.length;

  return (
    <button type="button" onClick={onClick} className="flex w-full items-start gap-4 rounded-2xl border border-stone-200 bg-white p-3 text-left">
      <div className="flex size-12 shrink-0 flex-col items-center justify-center rounded-xl bg-stone-100">
        <span className="text-[11px] leading-none font-medium text-stone-500 uppercase">{WEEKDAYS[day.getDay()]}</span>
        <span className="mt-0.5 font-display text-2xl leading-none font-bold">{day.getDate()}</span>
      </div>
      <div className="min-w-0 flex-1 py-0.5">
        {/* The name gets the whole line ("Push · Weighted dips"); when and how long under it. */}
        <div className="font-semibold">{workoutTitle(workout, names)}</div>
        <div className="text-xs text-stone-500">
          {friendlyDate(workout.date)}
          {minutes ? ` · ${workout.durationEstimated ? "~" : ""}${minutesText(minutes)}` : ""}
        </div>
        {exercises.data && (
          <ul className="mt-1 space-y-0.5 text-sm text-stone-600">
            {lines.map((line) => (
              <li key={line} className="flex items-baseline gap-2">
                <span className="size-1.5 shrink-0 translate-y-[-2px] rounded-full bg-stone-400" aria-hidden />
                <span className="min-w-0 truncate">{line}</span>
              </li>
            ))}
            {more > 0 && <li className="pl-3.5 text-xs text-stone-500">+{more} more</li>}
          </ul>
        )}
      </div>
    </button>
  );
}
