import type { Entry, Exercise, Load, Scheme, SetData, Workout } from "../api";

/** Weight as Sergio writes it: "170" (plates, for barbells), "25 each", "BW" for none. */
export function weightText(set: SetData, load: Load): string {
  if (load === "bodyweight" || load === "none") return "";
  if (set.weightLb === undefined) return "";
  if (load === "added" && set.weightLb === 0) return "BW";
  return `${set.weightLb}${set.each ? " each" : ""}`;
}

function amount(set: SetData): string {
  return set.seconds !== undefined ? `${set.seconds}s` : `${set.reps ?? 0}`;
}

/** "5×5 @ 170, 3×8 @ 150" — consecutive identical sets grouped; drop ladders as "drop 90-70-45: 4-3-3". */
export function summarizeSets(sets: SetData[], load: Load): string {
  const parts: string[] = [];
  let i = 0;
  while (i < sets.length) {
    const set = sets[i];
    if (set.drop) {
      const ladder: SetData[] = [];
      while (i < sets.length && sets[i].drop) ladder.push(sets[i++]);
      parts.push(`drop ${ladder.map((s) => s.weightLb ?? 0).join("-")}: ${ladder.map(amount).join("-")}`);
      continue;
    }
    let n = 1;
    while (
      i + n < sets.length &&
      !sets[i + n].drop &&
      amount(sets[i + n]) === amount(set) &&
      sets[i + n].weightLb === set.weightLb &&
      sets[i + n].detail === set.detail
    )
      n++;
    const weight = weightText(set, load);
    parts.push(`${n}×${amount(set)}${weight ? ` @ ${weight}` : ""}${set.detail ? ` (${set.detail})` : ""}`);
    i += n;
  }
  return parts.join(", ");
}

/** "5×5 @ 170" for a streak's scheme. */
export function schemeText(scheme: Scheme, load: Load): string {
  const set: SetData = { reps: scheme.reps, seconds: scheme.seconds, weightLb: scheme.weightLb, each: scheme.each };
  return summarizeSets([set], load).replace(/^1×/, `${scheme.count}×`);
}

/**
 * What the set logger starts with: the last set logged today, otherwise the set at the same
 * position last time (so the 4th set suggests last time's 4th), otherwise empty.
 */
export function nextSet(today: SetData[], lastTime: SetData[] | undefined, exercise: Pick<Exercise, "load" | "measure">): SetData {
  const work = today.filter((s) => !s.drop);
  const previous = (lastTime ?? []).filter((s) => !s.drop);
  const source = work.at(-1) ?? previous[0];
  // Where last session changed weight (heavy sets -> volume sets), follow it.
  const fromLast = previous[work.length];
  const changed = work.length > 0 && fromLast && fromLast.weightLb !== previous[work.length - 1]?.weightLb;
  const pick = changed ? fromLast : source;
  const base: SetData = exercise.measure === "seconds" ? { seconds: pick?.seconds ?? 10 } : { reps: pick?.reps ?? 5 };
  if (exercise.load !== "bodyweight" && exercise.load !== "none") {
    base.weightLb = pick?.weightLb ?? 0;
    if (exercise.load === "dumbbell" && (pick?.each ?? true)) base.each = true;
  }
  return base;
}

/** The drop ladder to suggest: last time's weights, else Sergio's usual 90-70-45-25-0. */
export function ladderWeights(lastTime: SetData[] | undefined): number[] {
  const drops = (lastTime ?? []).filter((s) => s.drop).map((s) => s.weightLb ?? 0);
  return drops.length > 1 ? drops : [90, 70, 45, 25, 0];
}

/** Total lifted, counting the bar for barbell lifts and both hands for "each" (drop sets too). */
export function volume(sets: SetData[], exercise: Pick<Exercise, "load" | "barLb">): number {
  return sets.reduce((sum, s) => {
    if (s.reps === undefined || s.weightLb === undefined) return sum;
    const weight = (s.weightLb + (exercise.load === "barbell" ? exercise.barLb : 0)) * (s.each ? 2 : 1);
    return sum + weight * s.reps;
  }, 0);
}

export function setCount(entries: Entry[]): number {
  return entries.reduce((n, e) => n + (e.sets?.length ?? 0) + (e.problems?.length ?? 0) + (e.segments?.length ? 1 : 0), 0);
}

/**
 * The rotation day due next: among the main session types of the last few weeks ("Push",
 * "Squat", ...), the one done longest ago. Climbing and runs ride along, so they're ignored.
 */
export function nextUp(workouts: Pick<Workout, "date" | "label">[], today: string): { label: string; lastDate: string } | null {
  const since = new Date(`${today}T12:00:00`);
  since.setDate(since.getDate() - 21);
  const cutoff = since.toISOString().slice(0, 10);
  const last = new Map<string, string>();
  for (const w of workouts) {
    const main = w.label.split(" + ")[0];
    if (w.date < cutoff || main === "Climb" || main === "Run") continue;
    if (!last.has(main) || last.get(main)! < w.date) last.set(main, w.date);
  }
  if (last.size < 2) return null;
  const [label, lastDate] = [...last.entries()].sort((a, b) => a[1].localeCompare(b[1]))[0];
  return { label, lastDate };
}
