import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

import { api, type CueSection, type Group, type Note, type NotePatch, type WorkoutBody } from "./api";

export function useHealth() {
  return useQuery({ queryKey: ["health"], queryFn: api.health });
}

export function useExercises() {
  return useQuery({ queryKey: ["exercises"], queryFn: api.listExercises, staleTime: 5 * 60_000 });
}

export function useCreateExercise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createExercise,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["exercises"] }),
  });
}

export function useExerciseHistory(exerciseId: string) {
  return useQuery({ queryKey: ["history", exerciseId], queryFn: () => api.exerciseHistory(exerciseId) });
}

/** Rename / recategorize or merge: names, sessions and cues can change everywhere. */
function useExerciseChange<T>(fn: (vars: T) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      for (const key of ["exercises", "summary", "history", "workouts", "session-types"]) {
        qc.invalidateQueries({ queryKey: [key] });
      }
    },
  });
}

export function useUpdateExercise() {
  return useExerciseChange((v: { id: string; patch: { name?: string; group?: Group } }) => api.updateExercise(v.id, v.patch));
}

export function useMergeExercise() {
  return useExerciseChange((v: { id: string; into: string }) => api.mergeExercise(v.id, v.into));
}

/** Cues, last time and streak for an exercise; `exclude` = the saved workout being edited. */
export function useExerciseSummary(exerciseId: string, exclude?: string) {
  return useQuery({
    queryKey: ["summary", exerciseId, exclude ?? null],
    queryFn: () => api.exerciseSummary(exerciseId, exclude),
  });
}

export function useSessionTypes() {
  return useQuery({ queryKey: ["session-types"], queryFn: api.sessionTypes, staleTime: 5 * 60_000 });
}

export function useWorkouts(limit = 20) {
  return useQuery({ queryKey: ["workouts", limit], queryFn: () => api.listWorkouts(limit) });
}

// Under "workouts" so every save, delete, rename or merge that refreshes workouts refreshes these.
export function useProgress() {
  return useQuery({ queryKey: ["workouts", "progress"], queryFn: api.progress });
}

export function useExerciseProgress(exerciseId: string) {
  return useQuery({ queryKey: ["workouts", "progress", exerciseId], queryFn: () => api.exerciseProgress(exerciseId) });
}

export function useWorkout(id: string) {
  return useQuery({ queryKey: ["workouts", "one", id], queryFn: () => api.getWorkout(id), retry: false });
}

export function useActive() {
  return useQuery({ queryKey: ["active"], queryFn: api.getActive });
}

export function useStartWorkout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.startWorkout,
    onSuccess: (active) => qc.setQueryData(["active"], active),
  });
}

export function useFinishWorkout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.finishWorkout,
    onSuccess: () => {
      qc.setQueryData(["active"], null);
      qc.invalidateQueries({ queryKey: ["workouts"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
      qc.invalidateQueries({ queryKey: ["exercises"] });
    },
  });
}

export function useDiscardWorkout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.discardWorkout,
    onSuccess: () => qc.setQueryData(["active"], null),
  });
}

export function useDeleteWorkout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteWorkout,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workouts"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
      qc.invalidateQueries({ queryKey: ["exercises"] });
    },
  });
}

/**
 * Save edits shortly after they stop (and right away when the app is hidden or the editor
 * closes), so nothing is lost if the phone locks between sets.
 */
export function useAutosave(save: (body: WorkoutBody) => Promise<unknown>, delay = 600) {
  const pending = useRef<WorkoutBody | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const saveRef = useRef(save);
  saveRef.current = save;

  const flush = useCallback(() => {
    window.clearTimeout(timer.current);
    const body = pending.current;
    pending.current = null;
    if (body) void saveRef.current(body);
  }, []);

  const schedule = useCallback(
    (body: WorkoutBody) => {
      pending.current = body;
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(flush, delay);
    },
    [delay, flush],
  );

  useEffect(() => {
    const onHide = () => document.visibilityState === "hidden" && flush();
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      flush();
    };
  }, [flush]);

  return schedule;
}

export function useSaveActive() {
  const qc = useQueryClient();
  return useCallback(
    (body: WorkoutBody) => {
      // The screen already shows the edit; keep the cache in step for when it remounts.
      qc.setQueryData(["active"], (old: WorkoutBody | null | undefined) => (old ? { ...body, startedAt: old.startedAt } : old));
      return api.saveActive(body);
    },
    [qc],
  );
}

export function useSaveWorkout(workoutId: string) {
  const qc = useQueryClient();
  return useCallback(
    async (body: WorkoutBody) => {
      const saved = await api.updateWorkout(workoutId, body);
      qc.invalidateQueries({ queryKey: ["workouts"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
      qc.invalidateQueries({ queryKey: ["history"] });
      return saved;
    },
    [qc, workoutId],
  );
}

function useNoteMutation<T>(fn: (vars: T) => Promise<unknown>, exerciseOf: (vars: T) => string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["summary", exerciseOf(vars)] }),
  });
}

export function useAddNote() {
  return useNoteMutation(
    (v: { exerciseId: string; text: string; date: string; section?: CueSection }) => api.addNote(v.exerciseId, v.text, v.date, v.section),
    (v) => v.exerciseId,
  );
}

export function useUpdateNote() {
  return useNoteMutation(
    (v: { note: Note; patch: NotePatch }) => api.updateNote(v.note.exerciseId, v.note.id, v.patch),
    (v) => v.note.exerciseId,
  );
}

export function useDeleteNote() {
  return useNoteMutation((note: Note) => api.deleteNote(note.exerciseId, note.id), (note) => note.exerciseId);
}

/** The desktop layout (Tailwind's lg, 1024px and up): its own navigation and dashboard. */
export const DESKTOP = "(min-width: 1024px)";

export function useDesktop(): boolean {
  const [desktop, setDesktop] = useState(() => window.matchMedia(DESKTOP).matches);
  useEffect(() => {
    const query = window.matchMedia(DESKTOP);
    const onChange = () => setDesktop(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return desktop;
}
