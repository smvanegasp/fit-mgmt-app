import { describe, expect, it } from "vitest";

import { dayType, heavyNext, ladderWeights, nextSet, nextUp, reachesTarget, schemeText, summarizeSets, volume, weightText } from "./sets";

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
    expect(schemeText({ sets: [5, 5, 5, 5, 5], weightLb: 170, each: false, seconds: false }, "barbell")).toBe("5×5 @ 170");
    expect(schemeText({ sets: [4, 4, 4, 3], weightLb: 90, each: false, seconds: false }, "added")).toBe("3×4, 1×3 @ 90");
    expect(schemeText({ sets: [7, 7], each: false, seconds: true }, "bodyweight")).toBe("2×7s");
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

  it("starts from the target when last time was a light day", () => {
    const target = { sets: [4, 4, 4, 4, 4], weightLb: 180, each: false, seconds: false };
    const lightDay = [{ reps: 6, weightLb: 155 }, { reps: 6, weightLb: 155 }];
    expect(nextSet([], lightDay, barbell, target)).toEqual({ reps: 4, weightLb: 180 });
    expect(nextSet([], [{ reps: 4, weightLb: 180 }], barbell, target)).toEqual({ reps: 4, weightLb: 180 });
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
    // Squat and Deadlift days are Legs (last 10-28); Front lever and Climb days are Pull (last 10-29).
    expect(nextUp(workouts, "2026-10-30")).toEqual({ label: "Push", lastDate: "2026-10-26" });
  });

  it("needs some history", () => {
    expect(nextUp([{ date: "2026-10-29", label: "Pull" }], "2026-10-30")).toBeNull();
  });
});

describe("reachesTarget", () => {
  const target = { sets: [4, 4, 4, 3], weightLb: 90, each: false, seconds: false };

  it("counts total reps at the target weight or more", () => {
    expect(reachesTarget([{ reps: 4, weightLb: 90 }, { reps: 4, weightLb: 90 }, { reps: 4, weightLb: 90 }], target)).toBe(false);
    expect(reachesTarget(Array(4).fill({ reps: 4, weightLb: 90 }), target)).toBe(true);
    expect(reachesTarget(Array(4).fill({ reps: 4, weightLb: 70 }), target)).toBe(false);
  });

  it("ignores drop sets", () => {
    expect(reachesTarget([...Array(3).fill({ reps: 4, weightLb: 90 }), { reps: 6, weightLb: 90, drop: true }], target)).toBe(false);
  });
});

describe("Legs days", () => {
  it("counts old Squat and Deadlift days as Legs", () => {
    expect(dayType("Squat + Climb")).toBe("Legs");
    expect(dayType("Deadlift")).toBe("Legs");
    expect(dayType("Push")).toBe("Push");
    expect(dayType("Front lever + Climb")).toBe("Pull");
    expect(dayType("Climb")).toBe("Pull");
    expect(dayType("Run")).toBe("Cardio");
  });

  it("alternates the heavy lift", () => {
    const deadliftFirst = { date: "2026-10-28", label: "Deadlift", entries: [{ exerciseId: "deadlift" }, { exerciseId: "squat" }] };
    const squatFirst = { date: "2026-10-30", label: "Legs", entries: [{ exerciseId: "squat" }, { exerciseId: "deadlift" }] };
    const push = { date: "2026-10-31", label: "Push", entries: [{ exerciseId: "dips" }] };
    expect(heavyNext([deadliftFirst])).toBe("squat");
    expect(heavyNext([deadliftFirst, squatFirst, push])).toBe("deadlift");
    expect(heavyNext([push])).toBeNull();
  });
});
