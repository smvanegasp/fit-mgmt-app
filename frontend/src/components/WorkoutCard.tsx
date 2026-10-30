import type { Entry, Exercise, Workout } from "../api";
import { useExercises } from "../hooks";
import { summarizeSets } from "../lib/sets";
import { friendlyDate, minutesText, workoutMinutes } from "../lib/time";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** The main thing done for one exercise: its heaviest sets, best boulder, or distance. */
export function highlight(entry: Entry, exercise: Exercise | undefined): string | null {
  if (!exercise) return null;
  if (entry.problems?.length) {
    const sent = entry.problems.filter((p) => p.result === "sent").map((p) => Number(p.grade.slice(1)));
    return sent.length ? `${exercise.name} up to V${Math.max(...sent)}` : exercise.name;
  }
  if (entry.distanceMi) return `${exercise.name} ${entry.distanceMi} mi`;
  const sets = (entry.sets ?? []).filter((s) => !s.drop);
  if (!sets.length) return exercise.name;
  const top = Math.max(...sets.map((s) => s.weightLb ?? 0));
  const main = summarizeSets(sets.filter((s) => (s.weightLb ?? 0) === top), exercise.load);
  return `${exercise.name} ${main}`;
}

export function WorkoutCard({ workout, onClick }: { workout: Workout; onClick: () => void }) {
  const exercises = useExercises();
  const byId = new Map((exercises.data ?? []).map((e) => [e.id, e]));
  const minutes = workoutMinutes(workout);
  const day = new Date(`${workout.date}T12:00:00`);
  const lines = (workout.entries ?? []).slice(0, 3).map((e) => highlight(e, byId.get(e.exerciseId))).filter(Boolean);
  const more = (workout.entries?.length ?? 0) - lines.length;

  return (
    <button type="button" onClick={onClick} className="flex w-full items-start gap-4 rounded-2xl border border-stone-200 bg-white p-3 text-left">
      <div className="flex size-12 shrink-0 flex-col items-center justify-center rounded-xl bg-stone-100">
        <span className="text-[11px] leading-none font-medium text-stone-500 uppercase">{WEEKDAYS[day.getDay()]}</span>
        <span className="mt-0.5 text-lg leading-none font-semibold">{day.getDate()}</span>
      </div>
      <div className="min-w-0 flex-1 py-0.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-semibold">{workout.label}</span>
          <span className="shrink-0 text-xs text-stone-500">
            {friendlyDate(workout.date)}
            {minutes ? ` · ${workout.durationEstimated ? "~" : ""}${minutesText(minutes)}` : ""}
          </span>
        </div>
        {exercises.data && (
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm text-stone-600 marker:text-stone-400">
            {lines.map((line) => <li key={line} className="truncate">{line}</li>)}
            {more > 0 && <li className="list-none text-xs text-stone-500">+{more} more</li>}
          </ul>
        )}
      </div>
    </button>
  );
}
