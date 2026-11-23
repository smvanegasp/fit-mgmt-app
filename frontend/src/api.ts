import { localIso } from "./lib/time";

export type Group = "push" | "pull" | "legs" | "posterior" | "core" | "skill" | "cardio" | "climbing";
/** How a set's weight reads: barbell = plates (bar added for totals), dumbbell = per hand with
 * `each`, added = on top of body weight, bodyweight / none = no weight. */
export type Load = "barbell" | "dumbbell" | "machine" | "added" | "bodyweight" | "none";
export type Measure = "reps" | "seconds" | "run" | "climb" | "time";
/** An exercise's place in a workout: the first lift, or a later one (done second, a lift is lighter). */
export type Role = "first" | "later";

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
  /** The weight stepper's step (2.5 or 5 lb); unset = 2.5 for dumbbells, else 5. */
  stepLb?: number | null;
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
  /** "screenshot": a record of the workout itself (a Peloton summary), not a setup photo. */
  kind?: "screenshot";
}

/** A Peloton class as read from its summary screenshot (all optional: whatever the screen showed). */
export interface Peloton {
  discipline?: string;
  title?: string;
  instructor?: string;
  minutes?: number;
  outputKj?: number;
  distanceMi?: number;
  calories?: number;
  avgWatts?: number;
  avgCadence?: number;
  avgResistance?: number;
  avgSpeedMph?: number;
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
  /** A Peloton class read from the screenshot in photos. */
  peloton?: Peloton;
  /** Marked done during the workout (it folds away); dropped when it's saved. */
  done?: boolean;
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

/** One weigh-in (one per day). */
export interface BodyWeight {
  date: string;
  weightLb: number;
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
  /** The day's first lift, or done later (and lighter: squat after deadlift). */
  role?: Role;
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
  /** A ride, run or walk that day (the weekly goal counts it). */
  cardio?: boolean;
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
  /** Each week's goal from the plans, from the first saved one on (oldest first). */
  goals?: WeekGoal[];
}

/** A week's goal from its week type (Sergio, 2026-11-23): the days that count, as strength and cardio days. */
export interface WeekGoal {
  monday: string;
  week: string;
  strength: number;
  cardio: number;
  days: { name: string; kind: string }[];
}

/** A saved version of the plans; it's in force from the Monday `start`. */
export interface PlanVersion {
  savedAt: string;
  start: string;
  weeks: WeekPlan[];
}

/** What a planned day is (Sergio, 2026-11-23: mixed days too, like an upper-body day). */
export type DayKind = "Push" | "Legs" | "Pull" | "Upper" | "Lower" | "Full body" | "Cardio";

/** One day of a week type: "Heavy push", its kind and exercises in order (a Cardio day with none
 * picks its activity at the start). */
export interface DayPlan {
  id: string;
  name: string;
  kind: DayKind;
  exercises: string[];
  /** In the plan but not part of the week's goal. */
  optional?: boolean;
}

/** A week type ("Squat & heavy push week"); week types repeat in their order. */
export interface WeekPlan {
  id: string;
  name: string;
  days: DayPlan[];
}

export interface TrainingPlans {
  weeks: WeekPlan[];
  /** This week's type (a week id). */
  current: string | null;
  /** False while the plans are read off the log. */
  saved: boolean;
}

/** Feedback left in the app; the owner reads it in Settings, the agent with scripts/feedback.py. */
export interface Feedback {
  id: string;
  text: string;
  page: string;
  role: "owner" | "guest";
  createdAt: string;
  status: "new" | "done";
  /** Screenshots, readable by the owner. */
  photos?: string[];
  editedAt?: string;
}

/** The welcome page's live stats, public: training days and current targets only. */
export interface PublicSummary {
  days: { date: string; type: string; cardio?: boolean }[];
  lifts: { exerciseId: string; name: string; group: Group; load: Load; scheme: Scheme; times: number }[];
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
  publicSummary: () => request<PublicSummary>("/public/summary"),
  startGuest: () => request<SessionInfo>("/session/guest", { method: "POST" }),
  resetGuest: () => request<SessionInfo>("/session/guest/reset", { method: "POST" }),
  ownerLogin: (passcode: string) => request<SessionInfo>("/session/owner", json("POST", { passcode })),
  logout: () => request<SessionInfo>("/session", { method: "DELETE" }),

  sendFeedback: (text: string, page: string, photos: string[] = []) => request<Feedback>("/feedback", json("POST", { text, page, photos })),
  editFeedback: (id: string, text: string) => request<Feedback>(`/feedback/${id}`, json("PATCH", { text })),
  listFeedback: () => request<Feedback[]>("/feedback"),
  markFeedback: (id: string, status: Feedback["status"]) => request<Feedback>(`/feedback/${id}`, json("PATCH", { status })),

  listExercises: () => request<Exercise[]>("/exercises"),
  createExercise: (body: Pick<Exercise, "name" | "group" | "load" | "measure">) =>
    request<Exercise>("/exercises", json("POST", body)),
  updateExercise: (id: string, patch: { name?: string; group?: Group; stepLb?: number }) =>
    request<Exercise>(`/exercises/${id}`, json("PATCH", patch)),
  mergeExercise: (id: string, into: string) => request<Exercise>(`/exercises/${id}/merge`, json("POST", { into })),
  exerciseHistory: (id: string) => request<ExerciseHistory>(`/exercises/${id}/history`),
  exerciseSummary: (id: string, exclude?: string, role?: Role) => {
    const query = new URLSearchParams({ ...(exclude ? { exclude } : {}), ...(role ? { role } : {}) }).toString();
    return request<ExerciseSummary>(`/exercises/${id}/summary${query ? `?${query}` : ""}`);
  },
  addNote: (exerciseId: string, text: string, date: string, section?: CueSection) =>
    request<Note>(`/exercises/${exerciseId}/notes`, json("POST", { text, date, section })),
  updateNote: (exerciseId: string, noteId: string, patch: NotePatch) =>
    request<Note>(`/exercises/${exerciseId}/notes/${noteId}`, json("PATCH", patch)),
  deleteNote: (exerciseId: string, noteId: string) =>
    request<void>(`/exercises/${exerciseId}/notes/${noteId}`, { method: "DELETE" }),
  checkCue: (exerciseId: string, note: string) =>
    request<CueSuggestion>(`/exercises/${exerciseId}/cue-check`, json("POST", { note })),

  sessionTypes: () => request<SessionType[]>("/session-types"),
  plans: (today: string) => request<TrainingPlans>(`/plans?today=${today}`),
  /** `current`: "this week is ..." (the rotation counts on from this week). */
  savePlans: (weeks: WeekPlan[], current: string | undefined, today: string) =>
    request<TrainingPlans>(`/plans?today=${today}`, json("PUT", { weeks, current })),

  progress: () => request<Progress>(`/progress?today=${localIso().slice(0, 10)}`),
  planHistory: () => request<PlanVersion[]>("/plans/history"),
  bodyWeights: () => request<BodyWeight[]>("/body"),
  logBodyWeight: (date: string, weightLb: number) => request<BodyWeight>(`/body/${date}`, json("PUT", { weightLb })),
  deleteBodyWeight: (date: string) => request<void>(`/body/${date}`, { method: "DELETE" }),
  exerciseProgress: (id: string) => request<Lift>(`/exercises/${id}/progress`),

  listWorkouts: (limit = 20) => request<Workout[]>(`/workouts?limit=${limit}`),
  getWorkout: (id: string) => request<Workout>(`/workouts/${id}`),
  updateWorkout: (id: string, body: WorkoutBody) => request<Workout>(`/workouts/${id}`, json("PUT", body)),
  deleteWorkout: (id: string) => request<void>(`/workouts/${id}`, { method: "DELETE" }),

  getActive: () => request<WorkoutBody | null>("/active"),
  startWorkout: (body: WorkoutBody) => request<WorkoutBody>("/active", json("POST", body)),
  saveActive: (body: WorkoutBody) => request<WorkoutBody>("/active", json("PUT", body)),
  finishWorkout: (endedAt: string) => request<Workout>("/active/finish", json("POST", { endedAt })),
  discardWorkout: () => request<void>("/active", { method: "DELETE" }),

  readPeloton: (key: string) => request<Peloton>("/peloton/read", json("POST", { key })),
  uploadPhoto: (photo: Blob, thumb: Blob) => {
    const form = new FormData();
    form.append("photo", photo, "photo.jpg");
    form.append("thumb", thumb, "thumb.jpg");
    return request<{ key: string }>("/photos", { method: "POST", body: form });
  },
};
