// Where the user last was (outside Settings), so feedback opened from Settings or the demo banner
// can say what it's about without asking.

export const PLACES = ["Train", "History", "Progress", "Workout", "Exercise", "Welcome", "Other"] as const;
export type Place = (typeof PLACES)[number];

let last: Place = "Train";

/** Called on tab changes and when a workout or exercise page opens; Settings doesn't count. */
export function rememberPlace(place: string): void {
  const match = PLACES.find((p) => p.toLowerCase() === place.toLowerCase());
  if (match) last = match;
}

export function lastPlace(): Place {
  return last;
}
