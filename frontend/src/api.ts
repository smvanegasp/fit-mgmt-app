export type Group = "push" | "pull" | "legs" | "posterior" | "core" | "skill" | "cardio" | "climbing";
/** How a set's weight reads: barbell = plates (bar added for totals), dumbbell = per hand with
 * `each`, added = on top of body weight, bodyweight / none = no weight. */
export type Load = "barbell" | "dumbbell" | "machine" | "added" | "bodyweight" | "none";
export type Measure = "reps" | "seconds" | "run" | "climb";

export interface Exercise {
  id: string;
  name: string;
  group: Group;
  load: Load;
  measure: Measure;
  barLb: number;
  aliases: string[];
  source: "catalog" | "app";
  lastDone: string | null;
  timesDone: number;
  hidden?: boolean;
  mergedInto?: string;
}

export interface SetData {
  reps?: number;
  weightLb?: number;
  each?: boolean;
  seconds?: number;
  drop?: boolean;
  detail?: string;
}

export interface Problem {
  grade: string;
  color?: string;
  result: "sent" | "attempted";
  count?: number;
  attempts?: number;
  note?: string;
}

export interface Segment {
  mph: number;
  minutes: number;
}

export interface Target {
  text: string;
  times?: number;
}

export interface Photo {
  key: string;
  caption?: string;
}

export interface Entry {
  exerciseId: string;
  sets?: SetData[];
  targets?: Target[];
  notes?: string[];
  photos?: Photo[];
  problems?: Problem[];
  segments?: Segment[];
  distanceMi?: number;
  minutes?: number;
}

/** A stopwatch lap: when it ended and what it was ("Set 2 · Weighted dips"). */
export interface Lap {
  at: string;
  label?: string;
}

/** The workout in progress, or the editable part of a saved one. Times are local, no zone. */
export interface WorkoutBody {
  startedAt: string;
  endedAt?: string;
  label?: string;
  /** The day type chosen at the start ("Squat"). */
  plan?: string;
  laps?: Lap[];
  notes?: string[];
  photos?: Photo[];
  entries?: Entry[];
}

export interface Workout extends WorkoutBody {
  id: string;
  date: string;
  label: string;
  durationEstimated?: boolean;
  /** Training minutes when the day had separate sessions. */
  durationMin?: number;
  source: "whatsapp" | "app";
}

export interface Note {
  id: string;
  exerciseId: string;
  text: string;
  date: string;
  lastSeen?: string;
  sessions: number;
  hidden: boolean;
  source: "whatsapp" | "app";
  /** What Sergio wrote, when `text` is a translation. */
  original?: string;
  /** Where it fits while training, and its importance there (1 = most important). */
  section?: CueSection;
  rank?: number;
}

/** Setup (warm-up, equipment, position), then brace and breathe, then the lift itself. */
export type CueSection = "setup" | "brace" | "lift";

export type NotePatch = { text?: string; hidden?: boolean; section?: CueSection; rank?: number };

/** The cue check's proposal for a note written today; nothing changes until it's accepted. */
export interface CueSuggestion {
  action: "add" | "update" | "none";
  noteId?: string | null;
  text?: string | null;
  section?: CueSection | null;
}

/** A target: reps (or seconds) of each working set at one weight, e.g. [4, 4, 4, 3] @ 90. */
export interface Scheme {
  sets: number[];
  weightLb?: number;
  each: boolean;
  seconds: boolean;
}

export interface Streak {
  scheme: Scheme;
  /** +1 per session that reached it, -1 per miss; at `goal` it's time to go up. */
  times: number;
  goal: number;
}

export interface SessionType {
  label: string;
  /** Usual exercises, in the usual order. */
  exercises: string[];
  lastDate: string;
  sessions: number;
}

export interface ExerciseSummary {
  exercise: Exercise;
  cues: Note[];
  last?: { workoutId: string; date: string; entry: Entry };
  streak?: Streak;
  /** Photos taken for this exercise (setups), newest first. */
  photos: (Photo & { date: string })[];
  /** The drop-set ladder with the most total reps so far. */
  bestDrop?: { date: string; sets: SetData[] };
}

export interface ExerciseSession {
  workoutId: string;
  date: string;
  label: string;
  entry: Entry;
}

/** Everything for an exercise page: every session (newest first), all photos, the best set. */
export interface ExerciseHistory {
  sessions: ExerciseSession[];
  photos: (Photo & { date: string })[];
  best?: { date: string; set: SetData };
}

/** A training day for the consistency calendar; `type` is today's day type (Push, Legs, Pull, Cardio). */
export interface ProgressDay {
  date: string;
  workoutId: string;
  label: string;
  type: string;
}

/** One rung of an exercise's progression ladder: a target and the sessions spent on it ("new" is
 * the session that set it). Light days aren't listed. */
export interface Step {
  scheme: Scheme;
  sessions: { date: string; workoutId: string; result: "new" | "reached" | "missed" }[];
  /** The count when the step ended (or now, for the current one); 3 = done. */
  times: number;
}

export interface Lift {
  exerciseId: string;
  name: string;
  load: Load;
  /** The bar for barbell lifts: weights are plates as written. */
  barLb: number;
  /** Oldest first; the last one is the current target. */
  steps: Step[];
}

/** A routine era: the plan followed from one date to another (no `to` = the current one). */
export interface Routine {
  id: string;
  name: string;
  from: string;
  to?: string;
  days: string[];
  notes: string;
  photos: Photo[];
  /** Workouts logged in the era. */
  sessions: number;
}

export interface Progress {
  days: ProgressDay[];
  lifts: Lift[];
  /** Newest first. */
  routines: Routine[];
}

export interface SessionInfo {
  role: "owner" | "guest" | null;
  /** Unix seconds when a guest sandbox expires. */
  expiresAt: number | null;
  ownerLoginEnabled: boolean;
}

/** Fired when the API says the session is gone (e.g. the 24h demo expired). */
export const SESSION_EXPIRED = "gym:session-expired";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // FormData bodies set their own multipart Content-Type.
  const isForm = init?.body instanceof FormData;
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: isForm ? init?.headers : { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith("/session")) {
      window.dispatchEvent(new Event(SESSION_EXPIRED));
    }
    let message = res.statusText;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") message = body.detail;
    } catch {
      // Non-JSON error body; keep the status text.
    }
    throw new Error(message);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

export function photoUrl(key: string, size: "full" | "thumb" = "full"): string {
  return `/api/photos/${key}${size === "thumb" ? "?size=thumb" : ""}`;
}

export const api = {
  health: () => request<{ status: string }>("/health"),

  getSession: () => request<SessionInfo>("/session"),
  startGuest: () => request<SessionInfo>("/session/guest", { method: "POST" }),
  resetGuest: () => request<SessionInfo>("/session/guest/reset", { method: "POST" }),
  ownerLogin: (passcode: string) => request<SessionInfo>("/session/owner", json("POST", { passcode })),
  logout: () => request<SessionInfo>("/session", { method: "DELETE" }),

  listExercises: () => request<Exercise[]>("/exercises"),
  createExercise: (body: Pick<Exercise, "name" | "group" | "load" | "measure">) =>
    request<Exercise>("/exercises", json("POST", body)),
  updateExercise: (id: string, patch: { name?: string; group?: Group }) =>
    request<Exercise>(`/exercises/${id}`, json("PATCH", patch)),
  mergeExercise: (id: string, into: string) => request<Exercise>(`/exercises/${id}/merge`, json("POST", { into })),
  exerciseHistory: (id: string) => request<ExerciseHistory>(`/exercises/${id}/history`),
  exerciseSummary: (id: string, exclude?: string) =>
    request<ExerciseSummary>(`/exercises/${id}/summary${exclude ? `?exclude=${encodeURIComponent(exclude)}` : ""}`),
  addNote: (exerciseId: string, text: string, date: string, section?: CueSection) =>
    request<Note>(`/exercises/${exerciseId}/notes`, json("POST", { text, date, section })),
  updateNote: (exerciseId: string, noteId: string, patch: NotePatch) =>
    request<Note>(`/exercises/${exerciseId}/notes/${noteId}`, json("PATCH", patch)),
  deleteNote: (exerciseId: string, noteId: string) =>
    request<void>(`/exercises/${exerciseId}/notes/${noteId}`, { method: "DELETE" }),
  checkCue: (exerciseId: string, note: string) =>
    request<CueSuggestion>(`/exercises/${exerciseId}/cue-check`, json("POST", { note })),

  sessionTypes: () => request<SessionType[]>("/session-types"),

  progress: () => request<Progress>("/progress"),
  exerciseProgress: (id: string) => request<Lift>(`/exercises/${id}/progress`),

  listWorkouts: (limit = 20) => request<Workout[]>(`/workouts?limit=${limit}`),
  getWorkout: (id: string) => request<Workout>(`/workouts/${id}`),
  updateWorkout: (id: string, body: WorkoutBody) => request<Workout>(`/workouts/${id}`, json("PUT", body)),
  deleteWorkout: (id: string) => request<void>(`/workouts/${id}`, { method: "DELETE" }),

  getActive: () => request<WorkoutBody | null>("/active"),
  startWorkout: (body: { startedAt: string; plan?: string }) => request<WorkoutBody>("/active", json("POST", body)),
  saveActive: (body: WorkoutBody) => request<WorkoutBody>("/active", json("PUT", body)),
  finishWorkout: (endedAt: string) => request<Workout>("/active/finish", json("POST", { endedAt })),
  discardWorkout: () => request<void>("/active", { method: "DELETE" }),

  uploadPhoto: (photo: Blob, thumb: Blob) => {
    const form = new FormData();
    form.append("photo", photo, "photo.jpg");
    form.append("thumb", thumb, "thumb.jpg");
    return request<{ key: string }>("/photos", { method: "POST", body: form });
  },
};
