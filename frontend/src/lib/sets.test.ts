import { describe, expect, it } from "vitest";

import { ladderWeights, nextSet, nextUp, schemeText, summarizeSets, volume, weightText } from "./sets";

const barbell = { load: "barbell" as const, measure: "reps" as const, barLb: 45 };
const added = { load: "added" as const, measure: "reps" as const, barLb: 0 };
const dumbbell = { load: "dumbbell" as const, measure: "reps" as const, barLb: 0 };

describe("summarizeSets", () => {
  it("groups identical sets", () => {
    const sets = [...Array(5).fill({ reps: 5, weightLb: 170 }), ...Array(3).fill({ reps: 8, weightLb: 150 }), { reps: 6, weightLb: 150 }];
    expect(summarizeSets(sets, "barbell")).toBe("5×5 @ 170, 3×8 @ 150, 1×6 @ 150");
  });

  it("shows drop ladders, body weight, holds and per-hand weights", () => {
    const dips = [
      { reps: 4, weightLb: 115 }, { reps: 4, weightLb: 115 },
      { reps: 4, weightLb: 90, drop: true }, { reps: 3, weightLb: 70, drop: true }, { reps: 6, weightLb: 0, drop: true },
      { reps: 8, weightLb: 0 },
    ];
    expect(summarizeSets(dips, "added")).toBe("2×4 @ 115, drop 90-70-0: 4-3-6, 1×8 @ BW");
    expect(summarizeSets([{ seconds: 7 }, { seconds: 7 }], "bodyweight")).toBe("2×7s");
    expect(summarizeSets([{ reps: 8, weightLb: 30, each: true }], "dumbbell")).toBe("1×8 @ 30 each");
  });

  it("writes complexes with their detail", () => {
    expect(summarizeSets([{ reps: 12, detail: "3 pull + 3 muscle" }], "bodyweight")).toBe("1×12 (3 pull + 3 muscle)");
  });
});

describe("weightText and schemeText", () => {
  it("formats by load type", () => {
    expect(weightText({ weightLb: 170 }, "barbell")).toBe("170");
    expect(weightText({ weightLb: 0 }, "added")).toBe("BW");
    expect(weightText({ weightLb: 10 }, "bodyweight")).toBe("");
    expect(schemeText({ count: 5, reps: 5, weightLb: 170, each: false }, "barbell")).toBe("5×5 @ 170");
  });
});

describe("nextSet", () => {
  const lastTime = [{ reps: 5, weightLb: 170 }, { reps: 5, weightLb: 170 }, { reps: 8, weightLb: 150 }];

  it("starts from last time's first set", () => {
    expect(nextSet([], lastTime, barbell)).toEqual({ reps: 5, weightLb: 170 });
  });

  it("repeats the set just logged", () => {
    expect(nextSet([{ reps: 4, weightLb: 175 }], lastTime, barbell)).toEqual({ reps: 4, weightLb: 175 });
  });

  it("moves to last time's next weight when the workout reaches that set", () => {
    const today = [{ reps: 5, weightLb: 170 }, { reps: 5, weightLb: 170 }];
    expect(nextSet(today, lastTime, barbell)).toEqual({ reps: 8, weightLb: 150 });
  });

  it("defaults for a first time, per hand for dumbbells, no weight for body weight", () => {
    expect(nextSet([], undefined, added)).toEqual({ reps: 5, weightLb: 0 });
    expect(nextSet([], undefined, dumbbell)).toEqual({ reps: 5, weightLb: 0, each: true });
    expect(nextSet([], undefined, { load: "bodyweight", measure: "seconds" })).toEqual({ seconds: 10 });
  });

  it("ignores drop sets", () => {
    expect(nextSet([{ reps: 4, weightLb: 115 }, { reps: 4, weightLb: 90, drop: true }], undefined, added)).toEqual({ reps: 4, weightLb: 115 });
  });
});

describe("ladderWeights and volume", () => {
  it("suggests last time's ladder or the usual one", () => {
    expect(ladderWeights([{ reps: 4, weightLb: 70, drop: true }, { reps: 4, weightLb: 0, drop: true }])).toEqual([70, 0]);
    expect(ladderWeights(undefined)).toEqual([90, 70, 45, 25, 0]);
  });

  it("counts the bar and both hands", () => {
    expect(volume([{ reps: 5, weightLb: 170 }], barbell)).toBe(5 * 215);
    expect(volume([{ reps: 8, weightLb: 30, each: true }], dumbbell)).toBe(480);
    expect(volume([{ reps: 8 }], added)).toBe(0);
  });
});

describe("nextUp", () => {
  it("suggests the session type done longest ago in the last three weeks", () => {
    const workouts = [
      { date: "2026-10-22", label: "Push" },
      { date: "2026-10-23", label: "Squat" },
      { date: "2026-10-24", label: "Front lever + Climb" },
      { date: "2026-10-26", label: "Push" },
      { date: "2026-10-28", label: "Deadlift" },
      { date: "2026-10-29", label: "Pull" },
      { date: "2026-10-25", label: "Climb" },
    ];
    expect(nextUp(workouts, "2026-10-30")).toEqual({ label: "Squat", lastDate: "2026-10-23" });
  });

  it("needs some history", () => {
    expect(nextUp([{ date: "2026-10-29", label: "Pull" }], "2026-10-30")).toBeNull();
  });
});
