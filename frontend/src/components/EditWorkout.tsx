import { Trash } from "@phosphor-icons/react";
import { useState } from "react";

import type { Workout, WorkoutBody } from "../api";
import { useAutosave, useDeleteWorkout, useSaveWorkout } from "../hooks";
import { friendlyDate } from "../lib/time";
import { Screen } from "./Screen";
import { WorkoutEditor } from "./WorkoutEditor";

/** Fix a saved workout: same editor as training, changes save automatically. */
export function EditWorkout({ workout, onClose, onDeleted }: { workout: Workout; onClose: () => void; onDeleted?: () => void }) {
  const [body, setBody] = useState<WorkoutBody>(workout);
  const autosave = useAutosave(useSaveWorkout(workout.id));
  const remove = useDeleteWorkout();
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <Screen
      title={`Edit ${workout.label}`}
      subtitle={`${friendlyDate(workout.date)} · changes save automatically`}
      onBack={onClose}
      actions={<button type="button" onClick={onClose} className="rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white">Done</button>}
    >
      <WorkoutEditor
        body={body}
        workoutId={workout.id}
        onChange={(next) => {
          setBody(next);
          autosave(next);
        }}
      />
      <div className="mt-6">
        {confirmDelete ? (
          <button
            type="button"
            onClick={async () => {
              await remove.mutateAsync(workout.id);
              (onDeleted ?? onClose)();
            }}
            className="w-full rounded-xl bg-stone-900 py-3 font-medium text-white"
          >
            Yes, delete this workout
          </button>
        ) : (
          <button type="button" onClick={() => setConfirmDelete(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 py-3 font-medium text-red-600">
            <Trash size={18} weight="fill" aria-hidden /> Delete workout
          </button>
        )}
      </div>
    </Screen>
  );
}
