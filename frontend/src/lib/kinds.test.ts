import { describe, expect, it } from "vitest";

import type { Entry, ExerciseSession } from "../api";
import { climbing, dropLadders } from "./kinds";

const session = (date: string, entry: Partial<Entry>): ExerciseSession => ({
  workoutId: date, date, label: "Push", entry: { exerciseId: "x", ...entry },
});

describe("drop ladders", () => {
  it("total the reps of each ladder and mark the best", () => {
    const ladders = dropLadders([
      session("2026-10-20", { sets: [{ reps: 4, weightLb: 90 }, { reps: 5, weightLb: 70, drop: true }, { reps: 10, weightLb: 0, drop: true }] }),
      session("2026-10-10", { sets: [{ reps: 4, weightLb: 90 }] }),
      session("2026-10-01", { sets: [{ reps: 6, weightLb: 70, drop: true }, { reps: 9, weightLb: 0, drop: true }] }),
    ]);
    expect(ladders.map((l) => [l.date, l.total, l.best])).toEqual([["2026-10-20", 15, true], ["2026-10-01", 15, false]]);
  });
});

describe("climbing", () => {
  it("counts sends and attempts per grade, hardest first", () => {
    const got = climbing([
      session("2026-10-20", { problems: [{ grade: "V4", result: "sent" }, { grade: "V3", result: "sent", count: 3 }] }),
      session("2026-10-01", { problems: [{ grade: "V4", result: "sent" }, { grade: "V5", result: "attempted", count: 2 }] }),
    ]);
    expect(got.grades).toEqual([
      { grade: "V5", sent: 0, attempted: 2 },
      { grade: "V4", sent: 2, attempted: 0 },
      { grade: "V3", sent: 3, attempted: 0 },
    ]);
    expect(got.hardest).toEqual({ grade: "V4", date: "2026-10-01" });
  });
});
