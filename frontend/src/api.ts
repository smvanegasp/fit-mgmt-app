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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // FormData bodies set their own multipart Content-Type.
  const isForm = init?.body instanceof FormData;
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: isForm ? init?.headers : { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
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

  listExercises: () => request<Exercise[]>("/exercises"),
  createExercise: (body: Pick<Exercise, "name" | "group" | "load" | "measure">) =>
    request<Exercise>("/exercises", json("POST", body)),
  updateExercise: (id: string, patch: { name?: string; group?: Group }) =>
    request<Exercise>(`/exercises/${id}`, json("PATCH", patch)),
  mergeExercise: (id: string, into: string) => request<Exercise>(`/exercises/${id}/merge`, json("POST", { into })),
  exerciseHistory: (id: string) => request<ExerciseHistory>(`/exercises/${id}/history`),
  exerciseSummary: (id: string, exclude?: string) =>
    request<ExerciseSummary>(`/exercises/${id}/summary${exclude ? `?exclude=${encodeURIComponent(exclude)}` : ""}`),
  addNote: (exerciseId: string, text: string, date: string) =>
    request<Note>(`/exercises/${exerciseId}/notes`, json("POST", { text, date })),
  updateNote: (exerciseId: string, noteId: string, patch: { text?: string; hidden?: boolean }) =>
    request<Note>(`/exercises/${exerciseId}/notes/${noteId}`, json("PATCH", patch)),
  deleteNote: (exerciseId: string, noteId: string) =>
    request<void>(`/exercises/${exerciseId}/notes/${noteId}`, { method: "DELETE" }),

  sessionTypes: () => request<SessionType[]>("/session-types"),

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
