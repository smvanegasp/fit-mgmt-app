import { MagnifyingGlass, Plus } from "@phosphor-icons/react";
import { useMemo, useState } from "react";

import type { Exercise, Group, Load } from "../api";
import { useCreateExercise, useExercises } from "../hooks";
import { fuzzyMatch } from "../lib/search";
import { friendlyDate } from "../lib/time";
import { BottomSheet } from "./BottomSheet";

export const GROUP_NAMES: Record<Group, string> = {
  push: "Push",
  pull: "Pull",
  legs: "Legs",
  posterior: "Posterior chain",
  core: "Core",
  skill: "Skills",
  cardio: "Cardio",
  climbing: "Climbing",
};

const LOAD_NAMES: Record<Load, string> = {
  barbell: "Barbell (plates + 45 lb bar)",
  dumbbell: "Dumbbells (per hand)",
  machine: "Machine or cable",
  added: "Body weight + added weight",
  bodyweight: "Body weight",
  none: "No weight",
};

interface Props {
  onPick: (exercise: Exercise) => void;
  onClose: () => void;
  /** Already in this workout: listed, but marked. */
  inWorkout: string[];
}

export function ExercisePicker({ onPick, onClose, inWorkout }: Props) {
  const exercises = useExercises();
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);

  const all = exercises.data ?? [];
  const matches = useMemo(
    () => all.filter((e) => fuzzyMatch(query, e.name, ...e.aliases)),
    [all, query],
  );
  const recent = useMemo(
    () =>
      query
        ? []
        : all.filter((e) => e.lastDone).sort((a, b) => (b.lastDone ?? "").localeCompare(a.lastDone ?? "")).slice(0, 8),
    [all, query],
  );
  const byGroup = useMemo(() => {
    const groups = new Map<Group, Exercise[]>();
    for (const e of matches) groups.set(e.group, [...(groups.get(e.group) ?? []), e]);
    return [...groups.entries()].sort(
      (a, b) => Object.keys(GROUP_NAMES).indexOf(a[0]) - Object.keys(GROUP_NAMES).indexOf(b[0]),
    );
  }, [matches]);

  const row = (e: Exercise) => (
    <li key={e.id}>
      <button
        type="button"
        onClick={() => onPick(e)}
        className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-3 text-left active:bg-stone-100"
      >
        <span className="font-medium">{e.name}</span>
        <span className="shrink-0 text-xs text-stone-500">
          {inWorkout.includes(e.id) ? "In this workout" : e.lastDone ? friendlyDate(e.lastDone) : ""}
        </span>
      </button>
    </li>
  );

  return (
    <BottomSheet title="Add exercise" onClose={onClose}>
      {creating ? (
        <CreateExercise name={query} onCreated={onPick} onCancel={() => setCreating(false)} />
      ) : (
        <>
          <div className="relative">
            <MagnifyingGlass size={18} className="absolute top-1/2 left-3 -translate-y-1/2 text-stone-400" aria-hidden />
            <input
              type="search"
              aria-label="Search exercises"
              placeholder="Search (bench, press banca, dips...)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-xl border border-stone-200 bg-white py-2.5 pr-3 pl-9"
            />
          </div>
          {exercises.isLoading && <p className="py-6 text-center text-stone-500">Loading...</p>}
          {recent.length > 0 && (
            <section className="mt-4">
              <h3 className="px-2 text-xs font-semibold tracking-wide text-stone-500 uppercase">Recent</h3>
              <ul>{recent.map(row)}</ul>
            </section>
          )}
          {byGroup.map(([group, list]) => (
            <section key={group} className="mt-4">
              <h3 className="px-2 text-xs font-semibold tracking-wide text-stone-500 uppercase">{GROUP_NAMES[group]}</h3>
              <ul>{list.map(row)}</ul>
            </section>
          ))}
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-stone-300 py-3 font-medium text-emerald-700"
          >
            <Plus size={18} weight="bold" aria-hidden />
            {query.trim() ? `Create "${query.trim()}"` : "Create an exercise"}
          </button>
        </>
      )}
    </BottomSheet>
  );
}

function CreateExercise({ name: initial, onCreated, onCancel }: { name: string; onCreated: (e: Exercise) => void; onCancel: () => void }) {
  const create = useCreateExercise();
  const [name, setName] = useState(initial.trim());
  const [group, setGroup] = useState<Group>("push");
  const [load, setLoad] = useState<Load>("machine");

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        onCreated(await create.mutateAsync({ name, group, load, measure: "reps" }));
      }}
      className="space-y-4"
    >
      <label className="block">
        <span className="text-sm font-medium text-stone-600">Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required
          className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2" />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-stone-600">Group</span>
        <select value={group} onChange={(e) => setGroup(e.target.value as Group)} className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-3 py-2">
          {Object.entries(GROUP_NAMES).filter(([g]) => g !== "cardio" && g !== "climbing").map(([g, label]) => (
            <option key={g} value={g}>{label}</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-sm font-medium text-stone-600">Weight</span>
        <select value={load} onChange={(e) => setLoad(e.target.value as Load)} className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-3 py-2">
          {Object.entries(LOAD_NAMES).filter(([l]) => l !== "none").map(([l, label]) => (
            <option key={l} value={l}>{label}</option>
          ))}
        </select>
      </label>
      {create.error && <p className="text-sm text-red-600">{create.error.message}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="flex-1 rounded-xl border border-stone-300 py-3 font-medium">Back</button>
        <button disabled={!name.trim() || create.isPending} className="flex-1 rounded-xl bg-emerald-600 py-3 font-medium text-white disabled:opacity-50">
          Create and add
        </button>
      </div>
    </form>
  );
}
