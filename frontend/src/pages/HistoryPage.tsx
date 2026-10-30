import { CaretDown, CaretRight, MagnifyingGlass } from "@phosphor-icons/react";
import { useMemo, useState } from "react";

import type { Exercise, Group } from "../api";
import { GROUP_NAMES } from "../components/ExercisePicker";
import { useScreens } from "../components/Screens";
import { WorkoutCard } from "../components/WorkoutCard";
import { useExercises, useWorkouts } from "../hooks";
import { fuzzyMatch } from "../lib/search";
import { dayType } from "../lib/sets";
import { friendlyDate, localIso } from "../lib/time";
import { groupByWeek } from "../lib/weeks";

type View = "workouts" | "exercises";
const DAY_TYPES = ["Push", "Legs", "Pull", "Cardio"];

export function HistoryPage() {
  const [view, setView] = useState<View>("workouts");
  return (
    <div className="pb-28">
      <div className="mt-2 grid grid-cols-2 gap-1 rounded-xl bg-stone-100 p-1" role="tablist" aria-label="History">
        {(["workouts", "exercises"] as const).map((v) => (
          <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)}
            className={`rounded-lg py-2 font-medium capitalize ${view === v ? "bg-white shadow-sm" : "text-stone-500"}`}>
            {v}
          </button>
        ))}
      </div>
      {view === "workouts" ? <Workouts /> : <Exercises />}
    </div>
  );
}

// ------------------------------------------------------------------ workouts by week

function Workouts() {
  const workouts = useWorkouts(1000);
  const screens = useScreens();
  const [type, setType] = useState<string | null>(null);
  const today = localIso().slice(0, 10);

  const all = workouts.data ?? [];
  const shown = all.filter((w) => !type || dayType(w.label) === type);
  const weeks = groupByWeek(shown, today);
  const first = all.at(-1)?.date;

  return (
    <>
      <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 py-1.5" role="radiogroup" aria-label="Day type">
        {[null, ...DAY_TYPES].map((t) => (
          <button key={t ?? "all"} type="button" role="radio" aria-checked={type === t} onClick={() => setType(t)}
            className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-medium ${type === t ? "bg-blue-600 text-white" : "bg-white text-stone-700 ring-1 ring-stone-200"}`}>
            {t ?? "All"}
          </button>
        ))}
      </div>

      {workouts.isLoading && <p className="py-10 text-center text-stone-500">Loading...</p>}
      {workouts.data && (
        <p className="mt-3 text-sm text-stone-500">
          {shown.length} {shown.length === 1 ? "workout" : "workouts"}
          {first && !type ? ` since ${friendlyDate(first)}` : ""}
        </p>
      )}
      {workouts.data && shown.length === 0 && <p className="py-10 text-center text-stone-500">No workouts match.</p>}

      {weeks.map((week) => (
        <section key={week.monday} className="mt-5">
          <h2 className="mb-2 flex items-baseline justify-between">
            <span className="font-semibold">{week.label}</span>
            <span className="text-sm text-stone-500">{week.items.length} {week.items.length === 1 ? "workout" : "workouts"}</span>
          </h2>
          <ul className="space-y-2">
            {week.items.map((w) => (
              <li key={w.id}>
                <WorkoutCard workout={w} onClick={() => screens.openWorkout(w.id)} />
              </li>
            ))}
          </ul>
        </section>
      ))}

    </>
  );
}

// ------------------------------------------------------------------ exercises

const ORDER: Group[] = ["push", "pull", "climbing", "legs", "posterior", "core", "skill", "cardio"];


function Exercises() {
  const exercises = useExercises();
  const screens = useScreens();
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  // Categories fold so the list is quick to scroll; searching opens them all.
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (name: string) => setOpen((o) => new Set(o.has(name) ? [...o].filter((x) => x !== name) : [...o, name]));

  const groups = useMemo(() => {
    const list = (exercises.data ?? []).filter(
      (e) => (showAll || e.timesDone > 0 || query) && fuzzyMatch(query, e.name, ...e.aliases),
    );
    const byName = new Map<string, Exercise[]>();
    for (const g of ORDER) {
      const items = list.filter((e) => e.group === g).sort((a, b) => b.timesDone - a.timesDone || a.name.localeCompare(b.name));
      if (items.length) byName.set(GROUP_NAMES[g], [...(byName.get(GROUP_NAMES[g]) ?? []), ...items]);
    }
    return [...byName.entries()];
  }, [exercises.data, query, showAll]);

  return (
    <>
      <div className="relative mt-3">
        <MagnifyingGlass size={18} className="absolute top-1/2 left-3 -translate-y-1/2 text-stone-400" aria-hidden />
        <input type="search" aria-label="Search exercises" placeholder="Search exercises" value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-xl border border-stone-200 bg-white py-2.5 pr-3 pl-9" />
      </div>
      {exercises.isLoading && <p className="py-10 text-center text-stone-500">Loading...</p>}
      {groups.map(([name, items]) => (
        <section key={name} className="mt-3">
          <h2>
            <button type="button" onClick={() => toggle(name)} aria-expanded={!!query || open.has(name)}
              className="flex w-full items-center gap-2 py-2 text-left text-sm font-semibold tracking-wide text-stone-500 uppercase">
              {name}
              <span className="font-normal normal-case">· {items.length}</span>
              <CaretDown size={14} className={`ml-auto ${query || open.has(name) ? "rotate-180" : ""}`} aria-hidden />
            </button>
          </h2>
          {(query || open.has(name)) && (
            <ul className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
              {items.map((e) => (
                <li key={e.id}>
                  <button type="button" onClick={() => screens.openExercise(e.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{e.name}</span>
                      <span className="text-xs text-stone-500">
                        {e.timesDone ? `${e.timesDone} ${e.timesDone === 1 ? "session" : "sessions"} · last ${friendlyDate(e.lastDone!)}` : "Not done yet"}
                      </span>
                    </span>
                    <CaretRight size={16} className="text-stone-400" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
      {!query && (
        <button type="button" onClick={() => setShowAll(!showAll)} className="mt-4 w-full py-2 text-sm font-medium text-blue-700">
          {showAll ? "Only exercises I've done" : "Show every exercise"}
        </button>
      )}
    </>
  );
}
