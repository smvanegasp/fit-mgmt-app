import type { Lap } from "../api";
import { secondsBetween } from "./time";

export interface LapRow {
  number: number;
  label?: string;
  /** Length of this lap in seconds. */
  seconds: number;
  /** Time since the workout started when the lap ended. */
  total: number;
}

/** Each lap's length (from the previous lap, or the start, to its end), newest first like a phone stopwatch. */
export function lapRows(startedAt: string, laps: Lap[]): LapRow[] {
  let previous = startedAt;
  const rows = laps.map((lap, i) => {
    const row = { number: i + 1, label: lap.label, seconds: secondsBetween(previous, lap.at), total: secondsBetween(startedAt, lap.at) };
    previous = lap.at;
    return row;
  });
  return rows.reverse();
}

/** Seconds into the lap running now. */
export function currentLap(startedAt: string, laps: Lap[], now = new Date()): number {
  return secondsBetween(laps.at(-1)?.at ?? startedAt, now);
}
