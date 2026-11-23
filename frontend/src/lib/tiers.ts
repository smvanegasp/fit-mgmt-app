/**
 * Tiers (Sergio, 2026-11-23: "tiers of workouts and tiers of streaks", for the rest of their
 * training life). Each tier is a threshold with a name and its own icon (the icon is a Phosphor
 * name, drawn by components/Tiers.tsx). Past the last tier, the ladder keeps going at a steady
 * step so there's always a next one.
 */
export interface Tier {
  at: number;
  name: string;
  icon: TierIcon;
}

export type TierIcon =
  | "Sparkle" | "Fire" | "Flame" | "Sun" | "Meteor" | "Hammer" | "Infinity"
  | "Barbell" | "Medal" | "MedalMilitary" | "Trophy" | "Crown" | "Diamond" | "Mountains" | "ShootingStar";

/** Weeks of streak: quick first steps, then a year and two. Every 52 weeks after that. */
export const STREAK_TIERS: Tier[] = [
  { at: 4, name: "Spark", icon: "Sparkle" },
  { at: 8, name: "Ember", icon: "Fire" },
  { at: 16, name: "Flame", icon: "Flame" },
  { at: 24, name: "Blaze", icon: "Sun" },
  { at: 32, name: "Inferno", icon: "Meteor" },
  { at: 52, name: "Forged", icon: "Hammer" },
  { at: 104, name: "Eternal", icon: "Infinity" },
];

/** Workouts logged, ever (Sergio's own steps: 50, 100, then every 100; further out, wider). Every
 * 250 after 1,000. */
export const WORKOUT_TIERS: Tier[] = [
  { at: 50, name: "Iron", icon: "Barbell" },
  { at: 100, name: "Bronze", icon: "Medal" },
  { at: 200, name: "Silver", icon: "MedalMilitary" },
  { at: 300, name: "Gold", icon: "Trophy" },
  { at: 400, name: "Platinum", icon: "Crown" },
  { at: 500, name: "Diamond", icon: "Diamond" },
  { at: 750, name: "Titan", icon: "Mountains" },
  { at: 1000, name: "Legend", icon: "ShootingStar" },
];

const BEYOND = new Map<Tier[], number>([[STREAK_TIERS, 52], [WORKOUT_TIERS, 250]]);

/** The highest tier reached, or null before the first. Past the list, the last tier's name. */
export function tierAt(tiers: Tier[], n: number): Tier | null {
  let hit: Tier | null = null;
  for (const t of tiers) if (n >= t.at) hit = t;
  if (!hit || hit !== tiers.at(-1)) return hit;
  const step = BEYOND.get(tiers) ?? hit.at;
  return { ...hit, at: hit.at + Math.floor((n - hit.at) / step) * step };
}

/** The next tier above n: from the list, then one every step with the last tier's name and icon. */
export function nextTier(tiers: Tier[], n: number): Tier {
  for (const t of tiers) if (t.at > n) return t;
  const last = tiers.at(-1)!;
  const step = BEYOND.get(tiers) ?? last.at;
  return { ...last, at: last.at + (Math.floor((n - last.at) / step) + 1) * step };
}

/** The tier passed on the way from `from` to `to`, or null. */
export function tierCrossed(tiers: Tier[], from: number, to: number): Tier | null {
  if (to <= from) return null;
  const next = nextTier(tiers, from);
  return next.at <= to ? next : null;
}
