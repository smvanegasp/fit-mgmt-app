import { describe, expect, it } from "vitest";

import { addDays } from "./progress";
import { weekStart } from "./weeks";
import {
  daysLeftText,
  milestoneAt,
  milestoneBand,
  milestoneCrossed,
  nextMilestone,
  streakAtRisk,
  weekRemaining,
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
