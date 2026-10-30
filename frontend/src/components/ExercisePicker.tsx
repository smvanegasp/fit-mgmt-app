import { Check, MagnifyingGlass, Plus } from "@phosphor-icons/react";
import { useMemo, useState } from "react";

import type { Exercise, Group, Load } from "../api";
import { useCreateExercise, useExercises, useSessionTypes, useWorkouts } from "../hooks";
import { heavyNext } from "../lib/sets";
import { fuzzyMatch } from "../lib/search";
import { friendlyDate } from "../lib/time";
import { BottomSheet } from "./BottomSheet";

/** Categories as chips. Climbing and cardio share one ("Climb & run"). */
const CATEGORIES: { id: string; label: string; groups: Group[] }[] = [
  { id: "push", label: "Push", groups: ["push"] },
  { id: "pull", label: "Pull", groups: ["pull"] },
  { id: "legs", label: "Legs", groups: ["legs"] },
  { id: "hips", label: "Hips & hamstrings", groups: ["posterior"] },
  { id: "core", label: "Core", groups: ["core"] },
  { id: "skills", label: "Skills", groups: ["skill"] },
  { id: "climb", label: "Climb & run", groups: ["climbing", "cardio"] },
];

export const GROUP_NAMES: Record<Group, string> = {
  push: "Push", pull: "Pull", legs: "Legs", posterior: "Hips & hamstrings", core: "Core",
  skill: "Skills", cardio: "Climb & run", climbing: "Climb & run",
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
  /** Already in this workout: marked, and left out of "Usual". */
  inWorkout: string[];
  /** The day type chosen at the start ("Squat"): opens on its usual exercises. */
  plan?: string;
}

export function ExercisePicker({ onPick, onClose, inWorkout, plan }: Props) {
  const exercises = useExercises();
  const types = useSessionTypes();
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);

  const all = exercises.data ?? [];
  const byId = useMemo(() => new Map(all.map((e) => [e.id, e])), [all]);
  const workouts = useWorkouts(30);
  let usual = (types.data ?? []).find((t) => t.label === plan)?.exercises ?? [];
  // On a Legs day the heavy lift goes first, then the lighter one.
  const heavy = plan === "Legs" && workouts.data ? heavyNext(workouts.data) : null;
  if (heavy) {
    const light = heavy === "squat" ? "deadlift" : "squat";
    usual = [heavy, light, ...usual.filter((id) => id !== heavy && id !== light)];
  }
  const usualLeft = usual.filter((id) => !inWorkout.includes(id) && byId.has(id));
  const [tab, setTab] = useState<string>(usualLeft.length > 0 ? "usual" : "recent");

  const list = useMemo(() => {
    if (query.trim()) return all.filter((e) => fuzzyMatch(query, e.name, ...e.aliases));
    if (tab === "usual") return usualLeft.map((id) => byId.get(id)!);
    if (tab === "recent")
      return all.filter((e) => e.lastDone).sort((a, b) => (b.lastDone ?? "").localeCompare(a.lastDone ?? "")).slice(0, 12);
    const groups = CATEGORIES.find((c) => c.id === tab)?.groups ?? [];
    // Most used first within a category.
    return all.filter((e) => groups.includes(e.group)).sort((a, b) => b.timesDone - a.timesDone || a.name.localeCompare(b.name));
  }, [all, byId, query, tab, usualLeft]);

  const tabs = [
    ...(usual.length > 0 ? [{ id: "usual", label: `Usual on ${plan} days` }] : []),
    { id: "recent", label: "Recent" },
    ...CATEGORIES,
  ];

  if (creating) {
    return (
      <BottomSheet title="New exercise" onClose={onClose}>
        <CreateExercise name={query} onCreated={onPick} onCancel={() => setCreating(false)} />
      </BottomSheet>
    );
  }

  return (
    <BottomSheet title="Add exercise" onClose={onClose}>
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

      {!query.trim() && (
        <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist" aria-label="Categories">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-medium whitespace-nowrap ${
                tab === t.id ? "bg-red-600 text-white" : "bg-stone-100 text-stone-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {exercises.isLoading && <p className="py-6 text-center text-stone-500">Loading...</p>}
      {tab === "usual" && !query.trim() && usualLeft.length === 0 && (
        <p className="py-4 text-center text-sm text-stone-500">All your usual {plan} exercises are in. Pick from another tab.</p>
      )}
      <ul className="mt-2 divide-y divide-stone-100">
        {list.map((e) => (
          <li key={e.id}>
            <button
              type="button"
              onClick={() => onPick(e)}
              className="flex w-full items-center gap-3 px-1 py-3.5 text-left active:bg-stone-100"
            >
              <span className="flex-1">
                <span className="block font-medium">{e.name}</span>
                {query.trim() && <span className="text-xs text-stone-500">{GROUP_NAMES[e.group]}</span>}
              </span>
              {inWorkout.includes(e.id) ? (
                <span className="flex items-center gap-1 text-xs text-red-700">
                  <Check size={14} weight="bold" aria-hidden /> Added
                </span>
              ) : (
                <span className="text-xs text-stone-500">{e.lastDone ? friendlyDate(e.lastDone) : "New"}</span>
              )}
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => setCreating(true)}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-stone-300 py-3 font-medium text-red-700"
      >
        <Plus size={18} weight="bold" aria-hidden />
        {query.trim() ? `Create "${query.trim()}"` : "Create an exercise"}
      </button>
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
        <span className="text-sm font-medium text-stone-600">Category</span>
        <select value={group} onChange={(e) => setGroup(e.target.value as Group)} className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-3 py-2">
          {CATEGORIES.filter((c) => c.id !== "climb").map((c) => (
            <option key={c.id} value={c.groups[0]}>{c.label}</option>
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
        <button disabled={!name.trim() || create.isPending} className="flex-1 rounded-xl bg-red-600 py-3 font-medium text-white disabled:opacity-50">
          Create and add
        </button>
      </div>
    </form>
  );
}
