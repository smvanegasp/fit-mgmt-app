import { describe, expect, it } from "vitest";

import { congratsFor, dayType, goesUp, heavyNext, ladderWeights, nextRung, nextSet, nextUp, reachesTarget, schemeText, summarizeSets, volume, weightText, workoutTitle, goUpText } from "./sets";

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

describe("workoutTitle", () => {
  const names = new Map([["deadlift", "Deadlift"], ["squat", "Back squat"], ["bouldering", "Bouldering"], ["warm-up", "Warm-up"]]);
  it("is the day type and the first exercise, warm-up aside", () => {
    expect(workoutTitle({ label: "Squat + Climb", entries: [{ exerciseId: "squat" }, { exerciseId: "bouldering" }] }, names)).toBe("Legs · Back squat");
    expect(workoutTitle({ label: "Legs", entries: [{ exerciseId: "warm-up" }, { exerciseId: "deadlift" }] }, names)).toBe("Legs · Deadlift");
    expect(workoutTitle({ label: "Climb", entries: [{ exerciseId: "bouldering" }] }, names)).toBe("Pull · Bouldering");
    expect(workoutTitle({ label: "Push", entries: [] }, names)).toBe("Push");
  });
});

describe("going up", () => {
  const target = { sets: [4, 4, 4, 4, 4], weightLb: 180, each: false, seconds: false };
  const reps = (n: number, r: number, w = 180) => Array.from({ length: n }, () => ({ reps: r, weightLb: w }));

  it("follows Sergio's ladder", () => {
    expect(goesUp([5, 5, 5], [4, 4, 4, 4, 4])).toBe(true);
    expect(goesUp([5, 4, 4, 4], [4, 4, 4, 4])).toBe(false);
    expect(goesUp([4, 4, 4, 4], [5, 5, 5])).toBe(false);
    expect(nextRung({ ...target, sets: [4, 4, 4] })?.sets).toEqual([4, 4, 4, 4]);
    expect(nextRung(target)?.sets).toEqual([5, 5, 5]);
    expect(nextRung({ ...target, sets: [5, 5, 5, 5, 5] })).toBeNull(); // 5x5: more weight
  });

  it("the reps ladder: one more rep at 3 sets, 3x6 to 3x10, then more weight", () => {
    expect(goesUp([7, 7, 7], [6, 6, 6], "reps")).toBe(true);
    expect(goesUp([6, 6, 6, 6], [6, 6, 6], "reps")).toBe(false); // an extra set isn't a step
    expect(goesUp([8, 8, 8], [10, 10], "reps")).toBe(true); // reaching 3 sets is
    expect(nextRung({ ...target, sets: [8, 8, 8] }, "reps")?.sets).toEqual([9, 9, 9]);
    expect(nextRung({ ...target, sets: [10, 10, 10] }, "reps")).toBeNull();
    expect(goUpText({ ...target, sets: [10, 10, 10] }, "reps", "machine")).toBe("go up: more weight, back to 3x6");
    expect(congratsFor(reps(2, 7), reps(3, 7), { ...target, sets: [6, 6, 6] }, 1, 3, "reps")?.kind).toBe("up");
    expect(congratsFor(reps(3, 6), reps(4, 6), { ...target, sets: [6, 6, 6] }, 3, 3, "reps")).toBeNull();
  });

  it("congratulates going up the moment it happens, once", () => {
    expect(congratsFor(reps(2, 5), reps(3, 5), target, 3, 3)).toEqual({ kind: "up", scheme: { ...target, sets: [5, 5, 5] } });
    expect(congratsFor(reps(3, 5), reps(4, 5), target, 3, 3)).toBeNull();
    expect(congratsFor([], reps(1, 3, 185), target, 1, 3)).toEqual({ kind: "up", scheme: { ...target, weightLb: 185, sets: [3] } });
  });

  it("congratulates reaching the target, but not once it's time to go up", () => {
    expect(congratsFor(reps(4, 4), reps(5, 4), target, 1, 3)).toEqual({ kind: "reached" });
    expect(congratsFor(reps(4, 4), reps(5, 4), target, 3, 3)).toBeNull();
    // A drop set after the heavy sets isn't going up.
    expect(congratsFor(reps(5, 4), [...reps(5, 4), { reps: 8, weightLb: 135, drop: true }], target, 1, 3)).toBeNull();
  });
});
