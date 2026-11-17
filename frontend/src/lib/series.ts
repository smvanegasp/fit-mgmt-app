import type { Entry, Exercise } from "../api";

export interface Point {
  /** yyyy-mm-dd */
  date: string;
  value: number;
  workoutId?: string;
}

export interface Series {
  /** What's plotted: "Top weight", "Most reps", "Longest hold". */
  title: string;
  /** How a value reads: "145 lb plates", "12 reps", "30 s". */
  format: (value: number) => string;
  points: Point[];
}

const WEIGHTED = new Set<Exercise["load"]>(["barbell", "dumbbell", "machine", "added"]);

/**
 * One point per session, oldest first (Sergio, 2026-11-05: a plot of the whole history): the top
 * working weight as logged (plates for barbell lifts, added weight for dips and chin-ups); for
 * body-weight work the most reps in a set, or the longest hold. Sessions without that (a weighted
 * lift done at body weight, drop sets only) are left out.
 */
export function topSeries(sessions: { date: string; workoutId: string; entry: Entry }[], exercise: Pick<Exercise, "load" | "measure" | "barLb">): Series | null {
  if (exercise.measure !== "reps" && exercise.measure !== "seconds") return null;
  const weighted = WEIGHTED.has(exercise.load);
  const seconds = exercise.measure === "seconds";
  const points: Point[] = [];
  for (const s of [...sessions].sort((a, b) => a.date.localeCompare(b.date))) {
    const work = (s.entry.sets ?? []).filter((x) => !x.drop && !x.detail);
    const value = Math.max(0, ...work.map((x) => (weighted ? x.weightLb : seconds ? x.seconds : x.reps) ?? 0));
    if (value > 0) points.push({ date: s.date, value, workoutId: s.workoutId });
  }
  if (points.length === 0) return null;
  if (weighted) {
    const unit = exercise.load === "barbell" ? `lb plates (+${exercise.barLb} bar)` : exercise.load === "added" ? "lb added" : exercise.load === "dumbbell" ? "lb each" : "lb";
    return { title: "Top weight", format: (v) => `${v} ${unit}`, points };
  }
  return seconds
    ? { title: "Longest hold", format: (v) => `${v} s`, points }
    : { title: "Most reps in a set", format: (v) => `${v} reps`, points };
}
