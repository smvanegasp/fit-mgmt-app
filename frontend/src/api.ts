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

/** The workout in progress, or the editable part of a saved one. Times are local, no zone. */
export interface WorkoutBody {
  startedAt: string;
  endedAt?: string;
  label?: string;
  notes?: string[];
  photos?: Photo[];
  entries?: Entry[];
}

export interface Workout extends WorkoutBody {
  id: string;
  date: string;
  label: string;
  durationEstimated?: boolean;
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
}

export interface Scheme {
  count: number;
  reps?: number;
  seconds?: number;
  weightLb?: number;
  each: boolean;
}

export interface ExerciseSummary {
  exercise: Exercise;
  cues: Note[];
  last?: { workoutId: string; date: string; entry: Entry };
  streak?: { scheme: Scheme; times: number };
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
  exerciseSummary: (id: string, exclude?: string) =>
    request<ExerciseSummary>(`/exercises/${id}/summary${exclude ? `?exclude=${encodeURIComponent(exclude)}` : ""}`),
  addNote: (exerciseId: string, text: string, date: string) =>
    request<Note>(`/exercises/${exerciseId}/notes`, json("POST", { text, date })),
  updateNote: (exerciseId: string, noteId: string, patch: { text?: string; hidden?: boolean }) =>
    request<Note>(`/exercises/${exerciseId}/notes/${noteId}`, json("PATCH", patch)),
  deleteNote: (exerciseId: string, noteId: string) =>
    request<void>(`/exercises/${exerciseId}/notes/${noteId}`, { method: "DELETE" }),

  listWorkouts: (limit = 20) => request<Workout[]>(`/workouts?limit=${limit}`),
  getWorkout: (id: string) => request<Workout>(`/workouts/${id}`),
  updateWorkout: (id: string, body: WorkoutBody) => request<Workout>(`/workouts/${id}`, json("PUT", body)),
  deleteWorkout: (id: string) => request<void>(`/workouts/${id}`, { method: "DELETE" }),

  getActive: () => request<WorkoutBody | null>("/active"),
  startWorkout: (startedAt: string) => request<WorkoutBody>("/active", json("POST", { startedAt })),
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
