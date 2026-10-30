const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parse(day: string): Date {
  return new Date(`${day}T12:00:00`);
}

function iso(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The Monday that starts the week of a day ("2026-10-29" -> "2026-10-26"). */
export function weekStart(day: string): string {
  const date = parse(day);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return iso(date);
}

/** "This week", "Last week", "Oct 19 – 25", "Sep 29 – Oct 5", "Dec 29, 2025 – Jan 4". */
export function weekLabel(monday: string, today: string): string {
  const thisWeek = weekStart(today);
  const last = parse(thisWeek);
  last.setDate(last.getDate() - 7);
  if (monday === thisWeek) return "This week";
  if (monday === iso(last)) return "Last week";
  const start = parse(monday);
  const end = parse(monday);
  end.setDate(end.getDate() + 6);
  const year = start.getFullYear() !== parse(today).getFullYear() ? `, ${start.getFullYear()}` : "";
  const from = `${MONTHS[start.getMonth()]} ${start.getDate()}${year}`;
  const to = end.getMonth() === start.getMonth() ? String(end.getDate()) : `${MONTHS[end.getMonth()]} ${end.getDate()}`;
  return `${from} – ${to}`;
}

/** Workouts (newest first) grouped by week, newest week first. */
export function groupByWeek<T extends { date: string }>(workouts: T[], today: string): { label: string; monday: string; items: T[] }[] {
  const groups: { label: string; monday: string; items: T[] }[] = [];
  for (const w of [...workouts].sort((a, b) => b.date.localeCompare(a.date))) {
    const monday = weekStart(w.date);
    const group = groups.at(-1);
    if (group?.monday === monday) group.items.push(w);
    else groups.push({ label: weekLabel(monday, today), monday, items: [w] });
  }
  return groups;
}

/** "Monday, Oct 26" (and the year when it isn't this year). */
export function longDate(day: string, today: string): string {
  const date = parse(day);
  const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
  const year = date.getFullYear() !== parse(today).getFullYear() ? `, ${date.getFullYear()}` : "";
  return `${weekday}, ${MONTHS[date.getMonth()]} ${date.getDate()}${year}`;
}
