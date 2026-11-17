import type { ExerciseSession, Problem, SetData } from "../api";

/** Every drop-set ladder of an exercise, newest first, with its total reps (the best is marked). */
export function dropLadders(sessions: ExerciseSession[]): { date: string; workoutId: string; sets: SetData[]; total: number; best: boolean }[] {
  const ladders = sessions
    .map((s) => {
      const sets = (s.entry.sets ?? []).filter((x) => x.drop);
      return { date: s.date, workoutId: s.workoutId, sets, total: sets.reduce((n, x) => n + (x.reps ?? 0), 0), best: false };
    })
    .filter((l) => l.sets.length > 0);
  // The best: most total reps; a tie goes to the newest (they come newest first).
  const best = ladders.reduce<(typeof ladders)[number] | null>((b, l) => (!b || l.total > b.total ? l : b), null);
  if (best) best.best = true;
  return ladders;
}

const gradeNumber = (grade: string) => Number(grade.slice(1));
const howMany = (p: Problem) => p.count ?? 1;

/** Sends and attempts per grade, hardest first, and the hardest send (its first date). */
export function climbing(sessions: ExerciseSession[]): {
  grades: { grade: string; sent: number; attempted: number }[];
  hardest: { grade: string; date: string } | null;
} {
  const byGrade = new Map<string, { grade: string; sent: number; attempted: number }>();
  let hardest: { grade: string; date: string } | null = null;
  for (const s of [...sessions].sort((a, b) => a.date.localeCompare(b.date))) {
    for (const p of s.entry.problems ?? []) {
      const row = byGrade.get(p.grade) ?? { grade: p.grade, sent: 0, attempted: 0 };
      row[p.result === "sent" ? "sent" : "attempted"] += howMany(p);
      byGrade.set(p.grade, row);
      if (p.result === "sent" && (!hardest || gradeNumber(p.grade) > gradeNumber(hardest.grade))) hardest = { grade: p.grade, date: s.date };
    }
  }
  const grades = [...byGrade.values()].sort((a, b) => gradeNumber(b.grade) - gradeNumber(a.grade));
  return { grades, hardest };
}
