import { describe, expect, it } from "vitest";

import type { SessionType } from "../api";
import { currentIndex, isLogged, startingEntries, usualFor } from "./plan";

const types: SessionType[] = [
  { label: "Push", exercises: ["dips", "bench-press", "warm-up"], lastDate: "2026-11-09", sessions: 20 },
  { label: "Legs", exercises: ["squat", "deadlift", "calf-raises"], lastDate: "2026-11-11", sessions: 20 },
];
const lastLegs = [{ date: "2026-11-11", label: "Legs", entries: [{ exerciseId: "deadlift" }, { exerciseId: "squat" }] }];

describe("plan", () => {
  it("starts with the warm-up, then the day's usual exercises", () => {
    const known = new Set(["warm-up", "dips", "bench-press"]);
    expect(startingEntries("Push", types, [], known).map((e) => e.exerciseId)).toEqual(["warm-up", "dips", "bench-press"]);
    expect(startingEntries(undefined, types, [], known).map((e) => e.exerciseId)).toEqual(["warm-up"]);
  });

  it("puts the heavy lift first on a Legs day", () => {
    expect(usualFor("Legs", types, lastLegs)).toEqual(["squat", "deadlift", "calf-raises"]);
    const lastHeavySquat = [{ ...lastLegs[0], entries: [{ exerciseId: "squat" }, { exerciseId: "deadlift" }] }];
    expect(usualFor("Legs", types, lastHeavySquat)).toEqual(["deadlift", "squat", "calf-raises"]);
  });

  it("knows what's logged and what's being done now", () => {
    expect(isLogged({ exerciseId: "dips" })).toBe(false);
    expect(isLogged({ exerciseId: "warm-up", minutes: 10 })).toBe(true);
    expect(currentIndex([{ exerciseId: "warm-up", done: true }, { exerciseId: "dips" }])).toBe(1);
    expect(currentIndex([{ exerciseId: "dips", done: true }])).toBe(-1);
  });
});
