import { describe, expect, it } from "vitest";

import { currentLap, lapRows } from "./laps";

describe("laps", () => {
  const start = "2026-10-30T18:00:00";
  const laps = [
    { at: "2026-10-30T18:03:00", label: "Set 1 · Weighted dips" },
    { at: "2026-10-30T18:07:30", label: "Set 2 · Weighted dips" },
  ];

  it("measures each lap from the one before, newest first", () => {
    expect(lapRows(start, laps)).toEqual([
      { number: 2, label: "Set 2 · Weighted dips", seconds: 270, total: 450 },
      { number: 1, label: "Set 1 · Weighted dips", seconds: 180, total: 180 },
    ]);
  });

  it("runs the current lap from the last one, or from the start", () => {
    expect(currentLap(start, laps, new Date("2026-10-30T18:08:00"))).toBe(30);
    expect(currentLap(start, [], new Date("2026-10-30T18:01:00"))).toBe(60);
  });
});
