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
