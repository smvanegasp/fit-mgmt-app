import { describe, expect, it } from "vitest";

import { addDays, streaks } from "./progress";
import { weekStart } from "./weeks";
import {
  daysLeftText,
  milestoneAt,
  milestoneBand,
  milestoneCrossed,
  nextMilestone,
  streakAtRisk,
  weekRemaining,
  weekSlots,
  streakNews,
  streakStatus,
} from "./streak";

const MONDAY = weekStart("2026-11-18"); // the week of the demo's "today"
const SUNDAY = addDays(MONDAY, 6);

describe("streak milestones", () => {
  it("counts weeks in a row against the goal", () => {
    expect(milestoneAt(0)).toBe(0);
    expect(milestoneAt(3)).toBe(0);
    expect(milestoneAt(4)).toBe(4);
    expect(milestoneAt(11)).toBe(8);
    expect(milestoneAt(52)).toBe(52);
  });

  it("aims at the next milestone, and at a new one every year past 52", () => {
    expect(nextMilestone(0)).toBe(4);
    expect(nextMilestone(4)).toBe(8);
    expect(nextMilestone(52)).toBe(104);
    expect(nextMilestone(104)).toBe(156);
  });

  it("shows the band being climbed", () => {
    expect(milestoneBand(0)).toEqual({ filled: 0, total: 4, to: 4 });
    expect(milestoneBand(1)).toEqual({ filled: 1, total: 4, to: 4 });
    expect(milestoneBand(5)).toEqual({ filled: 1, total: 4, to: 8 });
    // Standing on a milestone means the next band starts empty.
    expect(milestoneBand(12)).toEqual({ filled: 0, total: 4, to: 16 });
    expect(milestoneBand(52)).toEqual({ filled: 0, total: 52, to: 104 });
  });

  it("fires once, for the milestone actually crossed", () => {
    expect(milestoneCrossed(3, 4)).toBe(4);
    expect(milestoneCrossed(3, 5)).toBe(4);
    expect(milestoneCrossed(4, 5)).toBeNull();
    expect(milestoneCrossed(5, 5)).toBeNull();
    expect(milestoneCrossed(5, 4)).toBeNull();
    expect(milestoneCrossed(11, 12)).toBe(12);
    expect(milestoneCrossed(51, 52)).toBe(52);
  });
});

describe("what this week still needs", () => {
  const day = (offset: number, type: string) => ({ date: addDays(MONDAY, offset), type });

  it("names the strength and cardio days still missing", () => {
    const days = [day(0, "Push"), day(1, "Legs")]; // 2 strength, no cardio yet
    const r = weekRemaining(days, MONDAY);
    expect(r.met).toBe(false);
    expect(r.text).toBe("1 strength day and 1 cardio day");
    expect(r.daysLeft).toBe(6);
  });

  it("is met once 3 strength days and 1 cardio day are in", () => {
    const days = [day(0, "Push"), day(1, "Legs"), day(2, "Pull"), day(3, "Cardio")];
    const r = weekRemaining(days, MONDAY);
    expect(r.met).toBe(true);
    expect(r.text).toBe("Week's goal reached");
  });

  it("treats a cardio ride that same day as counting", () => {
    const days = [day(0, "Push"), day(1, "Legs"), day(2, "Pull"), { date: addDays(MONDAY, 2), type: "Cardio" }];
    expect(weekRemaining(days, MONDAY).met).toBe(true);
  });

  it("runs out of days on Sunday", () => {
    const r = weekRemaining([day(0, "Push")], SUNDAY);
    expect(r.daysLeft).toBe(0);
    expect(daysLeftText(r.daysLeft)).toBe("today is the last day");
    expect(daysLeftText(1)).toBe("1 day left");
    expect(daysLeftText(3)).toBe("3 days left");
  });

  it("warns only when the week is short on days", () => {
    const days = [day(0, "Push")];
    expect(streakAtRisk(days, MONDAY)).toBe(false); // 6 days left
    expect(streakAtRisk(days, addDays(MONDAY, 4))).toBe(true); // 2 days left
    expect(streakAtRisk(days, SUNDAY)).toBe(true);
    // The same week, goal met, is never at risk.
    expect(streakAtRisk([day(0, "Push"), day(1, "Legs"), day(2, "Pull"), day(3, "Cardio")], SUNDAY)).toBe(false);
  });
});

describe("this week's slots", () => {
  const day = (offset: number, type: string, cardio = false) => ({ date: addDays(MONDAY, offset), type, cardio });

  it("starts as the rotation and a cardio day, all to do", () => {
    expect(weekSlots([], MONDAY)).toEqual([
      { type: "Push", done: false }, { type: "Legs", done: false }, { type: "Pull", done: false }, { type: "Cardio", done: false },
    ]);
  });

  it("fills the days trained in order, the rest show what's missing", () => {
    expect(weekSlots([day(1, "Legs")], MONDAY)).toEqual([
      { type: "Legs", done: true }, { type: "Push", done: false }, { type: "Pull", done: false }, { type: "Cardio", done: false },
    ]);
    // Two Push days still count as two strength days.
    expect(weekSlots([day(0, "Push"), day(2, "Push"), day(3, "Legs", true)], MONDAY)).toEqual([
      { type: "Push", done: true }, { type: "Push", done: true }, { type: "Legs", done: true }, { type: "Cardio", done: true },
    ]);
  });

  it("ignores last week", () => {
    expect(weekSlots([{ date: addDays(MONDAY, -1), type: "Push" }], MONDAY).every((s) => !s.done)).toBe(true);
  });
});

describe("shields", () => {
  // Weeks of the new goal from GOAL_FROM: Push, Legs, Pull and a ride.
  const full = (monday: string) => ["Push", "Legs", "Pull", "Cardio"].map((type, i) => ({ date: addDays(monday, i), type }));
  const weeks = (from: string, n: number) => Array.from({ length: n }, (_, i) => full(addDays(from, 7 * i))).flat();
  const START = "2026-10-26";

  it("earns one every 10 weeks of the streak", () => {
    const s = streaks(weeks(START, 9), addDays(START, 7 * 8 + 6));
    expect(s).toMatchObject({ current: 9, shields: 0, toShield: 1 });
    const t = streaks(weeks(START, 10), addDays(START, 7 * 9 + 6));
    expect(t).toMatchObject({ current: 10, shields: 1, toShield: 10 });
  });

  it("a missed week uses one up and keeps the streak", () => {
    const days = [...weeks(START, 10), ...weeks(addDays(START, 7 * 11), 2)]; // week 11 missed
    const s = streaks(days, addDays(START, 7 * 12 + 6));
    expect(s).toMatchObject({ current: 12, longest: 12, shields: 0, shielded: [addDays(START, 70)] });
  });

  it("without a shield a missed week ends the streak", () => {
    const days = [...weeks(START, 5), ...weeks(addDays(START, 7 * 6), 1)];
    expect(streaks(days, addDays(START, 7 * 6 + 6))).toMatchObject({ current: 1, shields: 0, toShield: 9 });
  });

  it("this week can't use a shield before it ends", () => {
    const s = streaks(weeks(START, 10), addDays(START, 7 * 10 + 2));
    expect(s).toMatchObject({ current: 10, shields: 1, shielded: [] });
  });

  it("tells the congrats what happened", () => {
    expect(streakNews({ current: 11, shields: 1 }, { current: 12, shields: 1 })).toEqual({ milestone: 12, shield: false });
    expect(streakNews({ current: 9, shields: 0 }, { current: 10, shields: 1 })).toEqual({ milestone: null, shield: true });
    expect(streakNews({ current: 10, shields: 1 }, { current: 10, shields: 1 })).toEqual({ milestone: null, shield: false });
  });

  it("keeps a just-reached milestone's band full for the rest of the week", () => {
    expect(streakStatus(weeks(START, 4), addDays(START, 7 * 3 + 4)).onMilestone).toBe(true);
    expect(streakStatus(weeks(START, 4), addDays(START, 7 * 4 + 1)).onMilestone).toBe(false);
  });
});
