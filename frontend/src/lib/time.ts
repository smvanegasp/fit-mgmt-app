/** The phone's local time as stored by the app: "2026-10-29T13:44:06" (no zone, like the import). */
export function localIso(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

/** Seconds between two stored local times (or from one until now). */
export function secondsBetween(start: string, end?: string | Date): number {
  const to = end === undefined ? new Date() : typeof end === "string" ? new Date(end) : end;
  return Math.max(0, Math.round((to.getTime() - new Date(start).getTime()) / 1000));
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Today", "Yesterday", "Oct 23", or "Oct 23, 2025" for other years. */
export function friendlyDate(day: string, today = localIso().slice(0, 10)): string {
  if (day === today) return "Today";
  const yesterday = new Date(`${today}T12:00:00`);
  yesterday.setDate(yesterday.getDate() - 1);
  if (day === localIso(yesterday).slice(0, 10)) return "Yesterday";
  const [y, m, d] = day.split("-").map(Number);
  const short = `${MONTHS[m - 1]} ${d}`;
  return y === Number(today.slice(0, 4)) ? short : `${short}, ${y}`;
}

/** "5:37 PM" from a stored local time. */
export function clockTime(iso: string): string {
  const [h, m] = iso.slice(11, 16).split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** "45 min", "1 h", "1 h 28 min". */
export function minutesText(minutes: number): string {
  const m = Math.round(minutes);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}`;
}

/** How long a workout was: its training minutes, or start to end; null while unknown. */
export function workoutMinutes(w: { startedAt: string; endedAt?: string; durationMin?: number }): number | null {
  if (w.durationMin !== undefined) return w.durationMin;
  return w.endedAt ? secondsBetween(w.startedAt, w.endedAt) / 60 : null;
}
