import type { SetData } from "../api";

/**
 * The set being dialed in (weight and reps not logged yet), kept on the phone so switching tabs or
 * apps doesn't lose it (Sergio, 2026-11-07). Keyed by workout, entry position and exercise; a
 * draft only applies while the entry has the same number of sets as when it was typed.
 */
export interface Draft {
  set: SetData;
  /** Sets already logged when the draft was typed. */
  logged: number;
}

const KEY = "gym.setDrafts";
const KEEP = 30;
// Also in memory, for when storage is blocked (private mode).
let memory: Record<string, Draft> = {};

function read(): Record<string, Draft> {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) memory = JSON.parse(raw) as Record<string, Draft>;
  } catch {
    // keep what's in memory
  }
  return memory;
}

function write(all: Record<string, Draft>): void {
  // Oldest drafts go first once there are many (they belong to past workouts).
  const keys = Object.keys(all);
  memory = Object.fromEntries(keys.slice(Math.max(0, keys.length - KEEP)).map((k) => [k, all[k]]));
  try {
    localStorage.setItem(KEY, JSON.stringify(memory));
  } catch {
    // memory only
  }
}

export function loadDraft(key: string, logged: number): SetData | null {
  const draft = read()[key];
  return draft && draft.logged === logged ? draft.set : null;
}

export function saveDraft(key: string, set: SetData, logged: number): void {
  const all = { ...read() };
  delete all[key];
  write({ ...all, [key]: { set, logged } });
}

export function clearDraft(key: string): void {
  const all = { ...read() };
  if (!(key in all)) return;
  delete all[key];
  write(all);
}
