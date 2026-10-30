import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { ExercisePage } from "./ExercisePage";
import { WorkoutDetail } from "./WorkoutDetail";

type ScreenRef = { kind: "workout"; id: string } | { kind: "exercise"; id: string };

interface Screens {
  openWorkout: (id: string) => void;
  openExercise: (id: string) => void;
}

const ScreensContext = createContext<Screens>({ openWorkout: () => undefined, openExercise: () => undefined });

/** Open a workout or an exercise page from anywhere; pages stack (a workout, then one of its exercises). */
export function useScreens(): Screens {
  return useContext(ScreensContext);
}

export function ScreensProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<ScreenRef[]>([]);
  const openWorkout = useCallback((id: string) => setStack((s) => [...s, { kind: "workout", id }]), []);
  const openExercise = useCallback((id: string) => setStack((s) => [...s, { kind: "exercise", id }]), []);
  const close = useCallback(() => setStack((s) => s.slice(0, -1)), []);
  const value = useMemo(() => ({ openWorkout, openExercise }), [openWorkout, openExercise]);

  return (
    <ScreensContext.Provider value={value}>
      {children}
      {stack.map((screen, i) =>
        screen.kind === "workout" ? (
          <WorkoutDetail key={i} workoutId={screen.id} onClose={close} />
        ) : (
          <ExercisePage key={i} exerciseId={screen.id} onClose={close} />
        ),
      )}
    </ScreensContext.Provider>
  );
}
