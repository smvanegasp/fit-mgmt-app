import { ArrowsMerge, CaretRight, PencilSimple } from "@phosphor-icons/react";
import { useState } from "react";

import type { Exercise, Group } from "../api";
import { useExerciseHistory, useExerciseProgress, useExerciseSummary, useExercises, useMergeExercise, useUpdateExercise } from "../hooks";
import { summarizeSets, weightText } from "../lib/sets";
import { friendlyDate, localIso } from "../lib/time";
import { BottomSheet } from "./BottomSheet";
import { GameLegend, StrengthChart, groupColor } from "./Charts";
import { CueManager } from "./Cues";
import { Ladder, TargetGame } from "./EntryCard";
import { ExercisePicker, GROUP_NAMES } from "./ExercisePicker";
import { PhotoStrip } from "./Photos";
import { Screen } from "./Screen";
import { useScreens } from "./Screens";

/** Everything about one exercise: target, best set, technique cues, photos, every session. */
export function ExercisePage({ exerciseId, onClose }: { exerciseId: string; onClose: () => void }) {
  const exercises = useExercises();
  const summary = useExerciseSummary(exerciseId);
  const history = useExerciseHistory(exerciseId);
  const lift = useExerciseProgress(exerciseId);
  const screens = useScreens();
  const [managing, setManaging] = useState(false);
  const exercise = (exercises.data ?? []).find((e) => e.id === exerciseId) ?? summary.data?.exercise;
  const sessions = history.data?.sessions ?? [];
  const best = history.data?.best;

  return (
    <Screen
      title={exercise?.name ?? "Exercise"}
      subtitle={exercise ? GROUP_NAMES[exercise.group] : undefined}
      onBack={onClose}
      actions={
        exercise && (
          <button type="button" onClick={() => setManaging(true)} className="rounded-full p-2 text-stone-600" aria-label="Rename or merge">
            <PencilSimple size={20} weight="fill" aria-hidden />
          </button>
        )
      }
    >
      {exercise && (
        <div className="space-y-3">
          <dl className="grid grid-cols-3 gap-2 text-center">
            <Tile label="Sessions" value={String(sessions.length)} />
            <Tile label="Since" value={sessions.length ? monthYear(sessions.at(-1)!.date) : "-"} />
            <Tile
              label="Best set"
              value={best ? `${best.set.seconds ? `${best.set.seconds}s` : `${best.set.reps}`}${weightText(best.set, exercise.load) ? ` × ${weightText(best.set, exercise.load)}` : ""}` : "-"}
              hint={best ? friendlyDate(best.date) : undefined}
            />
          </dl>

          {summary.data?.streak && <TargetGame streak={summary.data.streak} load={exercise.load} today={[]} />}
          {(lift.data?.sessions.length ?? 0) >= 2 && (
            <section className="rounded-2xl border border-stone-200 bg-white p-4">
              <h2 className="font-semibold">{lift.data!.unit === "lb" ? "Top set" : lift.data!.unit === "s" ? "Longest set" : "Most reps"} over time</h2>
              <div className="mt-1.5"><GameLegend /></div>
              <div className="mt-2">
                <StrengthChart lift={lift.data!} color={groupColor(exercise.group)} from={lift.data!.sessions[0].date}
                  to={localIso().slice(0, 10)} onOpenWorkout={screens.openWorkout} />
              </div>
            </section>
          )}
          {summary.data?.bestDrop && (
            <div className="rounded-xl bg-sky-50 px-3 py-2 text-sm">
              <div className="text-xs font-semibold tracking-wide text-sky-800 uppercase">
                Best drop set · {friendlyDate(summary.data.bestDrop.date)}
              </div>
              <div className="mt-1"><Ladder sets={summary.data.bestDrop.sets} /></div>
            </div>
          )}

          <section className="rounded-2xl border border-stone-200 bg-white p-4">
            <h2 className="mb-1 font-semibold">Keep in mind</h2>
            <CueManager exerciseId={exercise.id} cues={summary.data?.cues ?? []} />
          </section>

          {(history.data?.photos.length ?? 0) > 0 && (
            <section className="rounded-2xl border border-stone-200 bg-white p-4">
              <h2 className="font-semibold">Photos</h2>
              <PhotoStrip grid photos={history.data!.photos.map((p) => ({ ...p, caption: p.caption ?? friendlyDate(p.date) }))} />
            </section>
          )}

          <section className="rounded-2xl border border-stone-200 bg-white p-4">
            <h2 className="font-semibold">Every session</h2>
            {history.isLoading && <p className="py-3 text-sm text-stone-500">Loading...</p>}
            {!history.isLoading && sessions.length === 0 && <p className="py-3 text-sm text-stone-500">Not done yet.</p>}
            <ul className="mt-1 divide-y divide-stone-100">
              {sessions.map((s) => {
                const work = (s.entry.sets ?? []).filter((x) => !x.drop);
                const drop = (s.entry.sets ?? []).filter((x) => x.drop);
                return (
                  <li key={s.workoutId}>
                    <button type="button" onClick={() => screens.openWorkout(s.workoutId)} className="flex w-full items-center gap-3 py-2.5 text-left">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">
                          {friendlyDate(s.date)} <span className="font-normal text-stone-500">· {s.label}</span>
                        </div>
                        <div className="text-sm text-stone-600">
                          {work.length > 0 && summarizeSets(work, exercise.load)}
                          {(s.entry.problems ?? []).length > 0 && s.entry.problems!.map((p) => p.grade).join(", ")}
                          {s.entry.distanceMi ? `${s.entry.distanceMi} mi` : ""}
                        </div>
                        {drop.length > 0 && <div className="mt-1"><Ladder sets={drop} /></div>}
                      </div>
                      <CaretRight size={16} className="shrink-0 text-stone-400" aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      )}
      {managing && exercise && <ManageSheet exercise={exercise} onClose={() => setManaging(false)} onMerged={onClose} />}
    </Screen>
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Sep 2025" */
function monthYear(day: string): string {
  return `${MONTHS[Number(day.slice(5, 7)) - 1]} ${day.slice(0, 4)}`;
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl bg-white px-2 py-3 ring-1 ring-stone-200">
      <dt className="text-xs text-stone-500">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
      {hint && <dd className="text-xs text-stone-500">{hint}</dd>}
    </div>
  );
}

const GROUPS: Group[] = ["push", "pull", "legs", "core", "cardio"];

/** Rename, change category, or merge a duplicate into another exercise. */
function ManageSheet({ exercise, onClose, onMerged }: { exercise: Exercise; onClose: () => void; onMerged: () => void }) {
  const update = useUpdateExercise();
  const merge = useMergeExercise();
  const [name, setName] = useState(exercise.name);
  const [picking, setPicking] = useState(false);
  const [into, setInto] = useState<Exercise | null>(null);

  if (picking) {
    return (
      <ExercisePicker
        title={`Merge ${exercise.name} into...`}
        allowCreate={false}
        inWorkout={[exercise.id]}
        onClose={() => setPicking(false)}
        onPick={(e) => {
          setPicking(false);
          if (e.id !== exercise.id) setInto(e);
        }}
      />
    );
  }

  return (
    <BottomSheet title="Edit exercise" onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (name.trim() && name.trim() !== exercise.name) await update.mutateAsync({ id: exercise.id, patch: { name: name.trim() } });
          onClose();
        }}
        className="space-y-4"
      >
        <label className="block">
          <span className="text-sm font-medium text-stone-600">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80}
            className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2" />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-stone-600">Category</span>
          <select
            value={exercise.group === "skill" ? "core" : exercise.group === "climbing" ? "pull" : exercise.group === "posterior" ? "legs" : exercise.group}
            onChange={(e) => update.mutate({ id: exercise.id, patch: { group: e.target.value as Group } })}
            className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-3 py-2"
          >
            {GROUPS.map((g) => <option key={g} value={g}>{GROUP_NAMES[g]}</option>)}
          </select>
        </label>
        {update.error && <p className="text-sm text-red-600">{update.error.message}</p>}
        <button disabled={update.isPending} className="w-full rounded-xl bg-blue-600 py-3 font-semibold text-white">Save</button>
      </form>

      <div className="mt-6 border-t border-stone-200 pt-4">
        <h3 className="font-semibold">Duplicate?</h3>
        <p className="mt-1 text-sm text-stone-500">
          Merge it into another exercise: all its sessions and cues move there, and this one disappears from lists.
        </p>
        {into ? (
          <div className="mt-3 space-y-2">
            <p className="text-sm">
              Move everything from <b>{exercise.name}</b> into <b>{into.name}</b>?
            </p>
            {merge.error && <p className="text-sm text-red-600">{merge.error.message}</p>}
            <button
              type="button"
              disabled={merge.isPending}
              onClick={async () => {
                await merge.mutateAsync({ id: exercise.id, into: into.id });
                onClose();
                onMerged();
              }}
              className="w-full rounded-xl bg-stone-900 py-3 font-medium text-white"
            >
              Yes, merge into {into.name}
            </button>
            <button type="button" onClick={() => setInto(null)} className="w-full py-2 text-sm text-stone-500">Cancel</button>
          </div>
        ) : (
          <button type="button" onClick={() => setPicking(true)}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-stone-300 py-3 font-medium">
            <ArrowsMerge size={18} weight="fill" aria-hidden /> Merge into another exercise
          </button>
        )}
      </div>
    </BottomSheet>
  );
}
