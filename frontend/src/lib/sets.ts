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

/** "5×4 @ 180" or "3×4, 1×3 @ 90" for a target. */
export function schemeText(scheme: Scheme, load: Load): string {
  const sets: SetData[] = scheme.sets.map((n) =>
    scheme.seconds ? { seconds: n, weightLb: scheme.weightLb, each: scheme.each } : { reps: n, weightLb: scheme.weightLb, each: scheme.each },
  );
  const parts = summarizeSets(sets, load).split(", ");
  // Same weight on every group: say it once at the end.
  const weight = parts[0].includes(" @ ") ? parts[0].split(" @ ")[1] : "";
  return parts.map((p) => p.split(" @ ")[0]).join(", ") + (weight ? ` @ ${weight}` : "");
}

/** Whether today's sets already reach the target: as many total reps (or seconds) at its weight or more. */
export function reachesTarget(sets: SetData[], scheme: Scheme): boolean {
  const done = sets
    .filter((s) => !s.drop && !s.detail && (s.weightLb ?? 0) >= (scheme.weightLb ?? 0))
    .reduce((sum, s) => sum + ((scheme.seconds ? s.seconds : s.reps) ?? 0), 0);
  return done >= scheme.sets.reduce((a, b) => a + b, 0);
}

/**
 * What the set logger starts with: the last set logged today, otherwise the set at the same
 * position last time (so the 4th set suggests last time's 4th), otherwise empty. When the target
 * is heavier than last time (last time was a light day), the first set starts from the target.
 */
export function nextSet(
  today: SetData[],
  lastTime: SetData[] | undefined,
  exercise: Pick<Exercise, "load" | "measure">,
  target?: Scheme,
): SetData {
  const work = today.filter((s) => !s.drop);
  const lastTop = Math.max(0, ...(lastTime ?? []).filter((s) => !s.drop).map((s) => s.weightLb ?? 0));
  const fromTarget: SetData[] | undefined = target && (target.weightLb ?? 0) > lastTop
    ? target.sets.map((n) => (target.seconds ? { seconds: n, weightLb: target.weightLb } : { reps: n, weightLb: target.weightLb }))
    : undefined;
  const previous = (fromTarget ?? lastTime ?? []).filter((s) => !s.drop);
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

/** Since 2026-10-30 squats and deadlifts share one Legs day; old Squat / Deadlift days count as Legs. */
export function dayType(label: string): string {
  const main = label.split(" + ")[0];
  return main === "Squat" || main === "Deadlift" ? "Legs" : main;
}

/**
 * Which lift goes heavy on the next Legs day: the one that was light last time. On a Legs day the
 * heavy lift comes first, so the last Legs day's first squat or deadlift was its heavy one.
 */
export function heavyNext(workouts: Pick<Workout, "date" | "label" | "entries">[]): "squat" | "deadlift" | null {
  const lastLegs = [...workouts].sort((a, b) => b.date.localeCompare(a.date)).find((w) => dayType(w.label) === "Legs");
  const first = lastLegs?.entries?.find((e) => e.exerciseId === "squat" || e.exerciseId === "deadlift");
  if (!first) return null;
  return first.exerciseId === "squat" ? "deadlift" : "squat";
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
    const main = dayType(w.label);
    if (w.date < cutoff || main === "Climb" || main === "Run") continue;
    if (!last.has(main) || last.get(main)! < w.date) last.set(main, w.date);
  }
  if (last.size < 2) return null;
  const [label, lastDate] = [...last.entries()].sort((a, b) => a[1].localeCompare(b[1]))[0];
  return { label, lastDate };
}
