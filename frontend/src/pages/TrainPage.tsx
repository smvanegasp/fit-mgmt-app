import { ArrowLeft, Barbell, CaretRight, CheckCircle, Flag, Play, Trash } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { api, type Workout, type WorkoutBody } from "../api";
import { BottomSheet } from "../components/BottomSheet";
import { InfoTip } from "../components/InfoTip";
import { RestBar } from "../components/RestBar";
import { WorkoutEditor } from "../components/WorkoutEditor";
import {
  useActive,
  useAutosave,
  useDeleteWorkout,
  useDiscardWorkout,
  useExercises,
  useFinishWorkout,
  useSaveActive,
  useSaveWorkout,
  useStartWorkout,
  useWorkouts,
} from "../hooks";
import { formatDuration } from "../lib/duration";
import { useRestTimer } from "../lib/restTimer";
import { nextUp, setCount } from "../lib/sets";
import { friendlyDate, localIso, secondsBetween } from "../lib/time";

export function TrainPage() {
  const active = useActive();
  const [editing, setEditing] = useState<Workout | null>(null);

  if (active.isLoading) return null;
  if (active.error) return <p className="mt-16 text-center text-red-600">Couldn't load: {active.error.message}</p>;
  return (
    <>
      {active.data ? <ActiveWorkout initial={active.data} /> : <Idle onEdit={setEditing} />}
      {editing && <EditWorkout workout={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

// ------------------------------------------------------------------ before starting

function Idle({ onEdit }: { onEdit: (w: Workout) => void }) {
  const start = useStartWorkout();
  const workouts = useWorkouts(30);
  const today = localIso().slice(0, 10);
  const suggestion = workouts.data ? nextUp(workouts.data, today) : null;
  const recent = (workouts.data ?? []).slice(0, 6);

  return (
    <div className="pb-28">
      <section className="mt-6 text-center">
        <Barbell size={44} weight="fill" className="mx-auto text-emerald-600" aria-hidden />
        <h2 className="mt-3 text-2xl font-semibold">Ready to train</h2>
        {suggestion && (
          <p className="mt-1 flex items-center justify-center gap-1 text-stone-600">
            Next up: <span className="font-semibold text-stone-900">{suggestion.label}</span>
            <span className="text-stone-500">(last {friendlyDate(suggestion.lastDate)})</span>
            <InfoTip title="Next up">
              The type of session you've gone longest without in the last three weeks, following your rotation.
            </InfoTip>
          </p>
        )}
        <button
          type="button"
          onClick={() => start.mutate(localIso())}
          disabled={start.isPending}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-5 text-xl font-semibold text-white shadow-sm active:bg-emerald-700"
        >
          <Play size={26} weight="fill" aria-hidden /> Start workout
        </button>
        <p className="mt-2 text-sm text-stone-500">The stopwatch starts now and keeps running if you lock the phone.</p>
        {start.error && <p className="mt-2 text-sm text-red-600">{start.error.message}</p>}
      </section>

      {recent.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-2 text-sm font-semibold tracking-wide text-stone-500 uppercase">Recent</h2>
          <ul className="space-y-2">
            {recent.map((w) => (
              <li key={w.id}>
                <RecentCard workout={w} onClick={() => onEdit(w)} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function RecentCard({ workout, onClick }: { workout: Workout; onClick: () => void }) {
  const exercises = useExercises();
  const names = new Map((exercises.data ?? []).map((e) => [e.id, e.name]));
  const minutes = workout.endedAt ? Math.round(secondsBetween(workout.startedAt, workout.endedAt) / 60) : null;
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-2xl border border-stone-200 bg-white p-4 text-left">
      <div className="flex-1">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold">{workout.label}</span>
          <span className="text-sm text-stone-500">
            {friendlyDate(workout.date)}
            {minutes ? ` · ${workout.durationEstimated ? "~" : ""}${minutes} min` : ""}
          </span>
        </div>
        <p className="mt-0.5 line-clamp-1 min-h-5 text-sm text-stone-600">
          {exercises.data && (workout.entries ?? []).map((e) => names.get(e.exerciseId) ?? "Exercise").join(", ")}
        </p>
      </div>
      <CaretRight size={18} className="text-stone-400" aria-hidden />
    </button>
  );
}

// ------------------------------------------------------------------ the workout in progress

function Stopwatch({ startedAt }: { startedAt: string }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  return <span className="tabular-nums">{formatDuration(secondsBetween(startedAt))}</span>;
}

function ActiveWorkout({ initial }: { initial: WorkoutBody }) {
  const [body, setBody] = useState(initial);
  const autosave = useAutosave(useSaveActive());
  const rest = useRestTimer();
  const [finishing, setFinishing] = useState(false);

  const change = (next: WorkoutBody) => {
    setBody(next);
    autosave(next);
  };

  return (
    <div className="pb-44">
      <header className="sticky top-0 z-10 -mx-4 mb-3 flex items-center gap-3 border-b border-stone-200 bg-stone-50/95 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur">
        <div className="flex-1">
          <div className="text-xs font-medium tracking-wide text-stone-500 uppercase">Workout</div>
          <div className="text-3xl font-semibold" aria-label="Elapsed time">
            <Stopwatch startedAt={body.startedAt} />
          </div>
        </div>
        <button
          type="button"
          onClick={() => setFinishing(true)}
          className="flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-3 font-semibold text-white"
        >
          <Flag size={20} weight="fill" aria-hidden /> Finish
        </button>
      </header>

      <WorkoutEditor body={body} onChange={change} onSetLogged={() => rest.start()} />
      <RestBar timer={rest} />
      {finishing && (
        <FinishSheet
          body={body}
          onClose={() => setFinishing(false)}
          onDone={() => rest.stop()}
          // Make sure the last edit reached the server before finishing.
          beforeFinish={async () => {
            await api.saveActive(body);
          }}
        />
      )}
    </div>
  );
}

function FinishSheet({ body, onClose, onDone, beforeFinish }: {
  body: WorkoutBody; onClose: () => void; onDone: () => void; beforeFinish: () => Promise<void>;
}) {
  const finish = useFinishWorkout();
  const discard = useDiscardWorkout();
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const entries = body.entries ?? [];
  const seconds = secondsBetween(body.startedAt);

  return (
    <BottomSheet title="Finish workout" onClose={onClose}>
      <dl className="grid grid-cols-3 gap-2 text-center">
        <Stat label="Time" value={formatDuration(seconds)} />
        <Stat label="Exercises" value={String(entries.length)} />
        <Stat label="Sets" value={String(setCount(entries))} />
      </dl>
      {finish.error && <p className="mt-3 text-sm text-red-600">{finish.error.message}</p>}
      <button
        type="button"
        disabled={finish.isPending || entries.length === 0}
        onClick={async () => {
          await beforeFinish();
          await finish.mutateAsync(localIso());
          onDone();
        }}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-lg font-semibold text-white disabled:opacity-50"
      >
        <CheckCircle size={22} weight="fill" aria-hidden /> Save workout
      </button>
      {entries.length === 0 && <p className="mt-2 text-center text-sm text-stone-500">Add an exercise first, or discard.</p>}
      <button type="button" onClick={onClose} className="mt-2 w-full rounded-xl border border-stone-300 py-3 font-medium">
        Keep training
      </button>
      {confirmDiscard ? (
        <button type="button" onClick={async () => { await discard.mutateAsync(); onDone(); }}
          className="mt-2 w-full rounded-xl bg-red-600 py-3 font-medium text-white">
          Yes, discard this workout
        </button>
      ) : (
        <button type="button" onClick={() => setConfirmDiscard(true)} className="mt-2 w-full py-3 text-sm font-medium text-red-600">
          Discard workout
        </button>
      )}
    </BottomSheet>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-stone-100 py-3">
      <dt className="text-xs text-stone-500">{label}</dt>
      <dd className="text-xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

// ------------------------------------------------------------------ editing a saved workout

function EditWorkout({ workout, onClose }: { workout: Workout; onClose: () => void }) {
  const [body, setBody] = useState<WorkoutBody>(workout);
  const autosave = useAutosave(useSaveWorkout(workout.id));
  const remove = useDeleteWorkout();
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-30 overflow-y-auto bg-stone-50">
      <div className="mx-auto max-w-lg px-4 pb-16">
        <header className="sticky top-0 z-10 -mx-4 mb-3 flex items-center gap-2 border-b border-stone-200 bg-stone-50/95 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur">
          <button type="button" onClick={onClose} className="rounded-full p-2 text-stone-700" aria-label="Back">
            <ArrowLeft size={22} weight="bold" aria-hidden />
          </button>
          <div className="flex-1">
            <div className="font-semibold">{workout.label}</div>
            <div className="text-sm text-stone-500">
              {friendlyDate(workout.date)} · changes save automatically
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl bg-emerald-600 px-4 py-2 font-semibold text-white">Done</button>
        </header>
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
            <button type="button" onClick={async () => { await remove.mutateAsync(workout.id); onClose(); }}
              className="w-full rounded-xl bg-red-600 py-3 font-medium text-white">
              Yes, delete this workout
            </button>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 py-3 font-medium text-red-600">
              <Trash size={18} weight="fill" aria-hidden /> Delete workout
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
