import { describe, expect, it } from "vitest";

import { addDays, streaks } from "./progress";
import {
  daysLeftText,
  milestoneAt,
  milestoneBand,
  milestoneCrossed,
  nextMilestone,
  streakAtRisk,
  streakNews,
  streakStatus,
  weekNeedText,
  weekProgress,
  weekSlots,
} from "./streak";
import { STREAK_TIERS, WORKOUT_TIERS, nextTier, tierAt, tierCrossed } from "./tiers";
import { weekStart } from "./weeks";

const MONDAY = weekStart("2026-11-18");

/** `n` training days from a Monday. */
const week = (monday: string, n: number, type = "Push") => Array.from({ length: n }, (_, i) => ({ date: addDays(monday, i), type }));
/** `count` weeks of `n` days each, ending the week before `MONDAY`. */
const weeks = (count: number, n = 4) => Array.from({ length: count }, (_, i) => week(addDays(MONDAY, -7 * (count - i)), n)).flat();

describe("streak milestones are the tiers", () => {
  it("steps 4, 8, 16, 24, 32, 52, 104, then every 52", () => {
    expect(STREAK_TIERS.map((t) => t.at)).toEqual([4, 8, 16, 24, 32, 52, 104]);
    expect(milestoneAt(9)).toBe(8);
    expect(nextMilestone(9)).toBe(16);
    expect(nextMilestone(104)).toBe(156);
    expect(milestoneAt(160)).toBe(156);
  });

  it("shows the band being climbed", () => {
    expect(milestoneBand(9)).toEqual({ filled: 1, total: 8, to: 16 });
    expect(milestoneBand(0)).toEqual({ filled: 0, total: 4, to: 4 });
  });

  it("fires once, for the milestone actually crossed", () => {
    expect(milestoneCrossed(7, 8)).toBe(8);
    expect(milestoneCrossed(8, 9)).toBeNull();
    expect(milestoneCrossed(9, 9)).toBeNull();
  });
});

describe("workout tiers", () => {
  it("50, 100, 200, 300, 400, 500, 750, 1000, then every 250", () => {
    expect(tierAt(WORKOUT_TIERS, 49)).toBeNull();
    expect(tierAt(WORKOUT_TIERS, 190)?.name).toBe("Bronze");
    expect(nextTier(WORKOUT_TIERS, 190)).toMatchObject({ at: 200, name: "Silver" });
    expect(nextTier(WORKOUT_TIERS, 1000).at).toBe(1250);
    expect(tierCrossed(WORKOUT_TIERS, 199, 200)?.name).toBe("Silver");
    expect(tierCrossed(WORKOUT_TIERS, 200, 201)).toBeNull();
  });
});

describe("this week", () => {
  it("counts days and says what's next", () => {
    const w = weekProgress(week(MONDAY, 1), addDays(MONDAY, 2));
    expect(w).toEqual({ days: 1, state: "miss", daysLeft: 4 });
    expect(weekNeedText(w)).toBe("1 more day keeps it");
    expect(weekNeedText(weekProgress(week(MONDAY, 2), addDays(MONDAY, 2)))).toBe("2 more days grow it");
    expect(weekNeedText(weekProgress(week(MONDAY, 4), addDays(MONDAY, 4)))).toBe("Grew the streak");
  });

  it("runs out of days on Sunday", () => {
    expect(weekProgress([], addDays(MONDAY, 6)).daysLeft).toBe(0);
    expect(daysLeftText(0)).toBe("today is the last day");
    expect(daysLeftText(1)).toBe("1 day left");
  });

  it("warns only when under 2 days late in the week", () => {
    expect(streakAtRisk(week(MONDAY, 1), addDays(MONDAY, 3))).toBe(false);
    expect(streakAtRisk(week(MONDAY, 1), addDays(MONDAY, 4))).toBe(true);
    expect(streakAtRisk(week(MONDAY, 2), addDays(MONDAY, 6))).toBe(false);
  });

  it("fills four slots in the order trained, any kind, and counts days past four", () => {
    const days = [{ date: addDays(MONDAY, 1), type: "Legs" }, { date: MONDAY, type: "Cardio" }];
    const { slots, extra } = weekSlots(days, addDays(MONDAY, 2));
    expect(slots).toEqual([{ type: "Cardio", done: true }, { type: "Legs", done: true }, { type: "", done: false }, { type: "", done: false }]);
    expect(extra).toBe(0);
    expect(weekSlots(week(MONDAY, 6), addDays(MONDAY, 6)).extra).toBe(2);
    expect(weekSlots(week(addDays(MONDAY, -7), 4), MONDAY).slots.every((s) => !s.done)).toBe(true);
  });
});

describe("shields", () => {
  it("earn one every 8 weeks that grow it; held weeks don't earn", () => {
    expect(streaks(weeks(8), MONDAY)).toMatchObject({ current: 8, shields: 1, toShield: 8 });
    expect(streaks([...weeks(7), ...week(MONDAY, 3)], addDays(MONDAY, 6))).toMatchObject({ current: 7, shields: 0, toShield: 1 });
  });

  it("a week under 2 days uses one up and keeps the streak", () => {
    const days = [...weeks(9).slice(0, 32), ...week(addDays(MONDAY, -7), 1)];
    expect(streaks(days, MONDAY)).toMatchObject({ current: 8, shields: 0 });
  });

  it("this week can't use a shield before it ends", () => {
    expect(streaks(weeks(8), addDays(MONDAY, 6))).toMatchObject({ current: 8, shields: 1 });
  });

  it("tells the congrats what happened", () => {
    expect(streakNews({ current: 7, shields: 0 }, { current: 8, shields: 1 })).toEqual({ milestone: 8, shield: true, workouts: null });
    expect(streakNews({ current: 9, shields: 1, workouts: 199 }, { current: 9, shields: 1, workouts: 200 }).workouts?.name).toBe("Silver");
  });

  it("keeps a just-reached milestone's band full for the rest of the week", () => {
    const s = streakStatus([...weeks(7), ...week(MONDAY, 4)], addDays(MONDAY, 4));
    expect(s.current).toBe(8);
    expect(s.onMilestone).toBe(true);
    expect(s.tier?.name).toBe("Ember");
    expect(s.next.name).toBe("Flame");
  });
});
