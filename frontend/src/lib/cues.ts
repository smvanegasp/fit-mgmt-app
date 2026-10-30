import type { CueSection, Note } from "../api";

/** In the order they matter while training. */
export const SECTIONS: { id: CueSection; label: string }[] = [
  { id: "setup", label: "Setup" },
  { id: "brace", label: "Brace & breathe" },
  { id: "lift", label: "Lift" },
];

/** By section (setup, brace, lift, then unplaced), then importance, then the most repeated and newest. */
export function orderCues(cues: Note[]): Note[] {
  const at = (c: Note) => (c.section ? SECTIONS.findIndex((s) => s.id === c.section) : SECTIONS.length);
  return [...cues].sort(
    (a, b) => at(a) - at(b) || (a.rank ?? 99) - (b.rank ?? 99) || b.sessions - a.sessions || (b.lastSeen ?? b.date).localeCompare(a.lastSeen ?? a.date),
  );
}

/** Ordered cues in their sections ("Other" for cues not placed yet, when some are). */
export function groupCues(cues: Note[]): { label: string | null; cues: Note[] }[] {
  const ordered = orderCues(cues);
  const groups = SECTIONS.map((s) => ({ label: s.label as string | null, cues: ordered.filter((c) => c.section === s.id) }));
  const other = ordered.filter((c) => !c.section);
  const placed = groups.some((g) => g.cues.length);
  return [...groups, { label: placed ? "Other" : null, cues: other }].filter((g) => g.cues.length);
}
