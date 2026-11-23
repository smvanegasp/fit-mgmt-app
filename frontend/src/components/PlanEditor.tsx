import { ArrowDown, ArrowUp, CaretRight, CopySimple, Plus, Trash, X } from "@phosphor-icons/react";
import { useState } from "react";

import type { DayKind, DayPlan, TrainingPlans } from "../api";
import { useExercises, usePlanHistory, useSavePlans } from "../hooks";
import { friendlyDate } from "../lib/time";
import { KINDS } from "../lib/progress";
import { BottomSheet } from "./BottomSheet";
import { ExercisePicker } from "./ExercisePicker";
import { InfoTip } from "./InfoTip";
import { Screen } from "./Screen";

const newId = () => Math.random().toString(36).slice(2, 10);

/** Move an item one place within a list. */
function shift<T>(list: T[], i: number, by: number): T[] {
  const next = [...list];
  [next[i], next[i + by]] = [next[i + by], next[i]];
  return next;
}

/** A quiet icon button (Sergio, 2026-11-23: the red highlights looked cheap). */
const ICON = "rounded-lg p-2 text-stone-500 disabled:opacity-25";

/** How a day reads in the list: "4 exercises", "Cardio", "optional · 2 exercises". */
function dayInfo(d: DayPlan): string {
  const what = d.exercises.length ? `${d.exercises.length} exercise${d.exercises.length === 1 ? "" : "s"}` : d.kind;
  return `${d.optional ? "optional · " : ""}${what}`;
}

/**
 * The plan: one list of days that repeats in order (Sergio, 2026-11-23: a day rotation, not week
 * types). Add days, move them, tap one to edit it on its own page. Saved as a single week type, so
 * the days keep their ids and Train keeps its place. Nothing is stored until Save.
 */
export function PlanEditor({ plans, today, onClose }: { plans: TrainingPlans; today: string; onClose: () => void }) {
  const save = useSavePlans(today);
  const [days, setDays] = useState<DayPlan[]>(() => plans.weeks.flatMap((w) => w.days));
  const [openId, setOpen] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const history = usePlanHistory(showHistory);
  const open = days.find((d) => d.id === openId);
  const keepId = plans.weeks[0]?.id ?? "days";

  function addDay(from?: DayPlan) {
    const id = `${keepId}-${newId()}`;
    const day: DayPlan = from ? { ...from, id, name: `${from.name} (copy)` } : { id, name: "New day", kind: "Push", exercises: [] };
    setDays([...days, day]);
    setOpen(id);
  }

  const valid = days.length > 0 && days.every((d) => d.name.trim());

  return (
    <Screen title="Your plan" onBack={onClose}
      footer={
        <>
          {save.error && <p className="mb-2 text-sm text-red-600">{save.error.message}</p>}
          <button type="button" disabled={save.isPending || !valid}
            onClick={async () => {
              await save.mutateAsync({ weeks: [{ id: keepId, name: "Days", days: days.map((d) => ({ ...d, name: d.name.trim() })) }] });
              onClose();
            }}
            className="w-full rounded-xl bg-blue-600 py-3.5 text-lg font-semibold text-white disabled:opacity-50">
            {save.isPending ? "Saving…" : "Save plan"}
          </button>
        </>
      }>
      <h2 className="flex items-center gap-1 text-sm font-semibold tracking-wide text-stone-500 uppercase">
        Your days, in order
        <InfoTip title="Your days">You train them in this order, then start over. Tap a day to edit it.</InfoTip>
      </h2>

      {days.length === 0 ? (
        <p className="mt-3 text-sm text-stone-500">No days yet: add one to start.</p>
      ) : (
        <ol className="mt-2 divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white">
          {days.map((d, i) => (
            <li key={d.id} className="flex items-center gap-1 pr-1">
              <button type="button" onClick={() => setOpen(d.id)} className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-3 text-left">
                <span className="w-5 shrink-0 text-center text-sm text-stone-400 tabular-nums">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{d.name}</span>
                  <span className="block truncate text-xs text-stone-500">{dayInfo(d)}</span>
                </span>
                <CaretRight size={14} weight="bold" className="shrink-0 text-stone-400" aria-hidden />
              </button>
              <button type="button" disabled={i === 0} onClick={() => setDays(shift(days, i, -1))}
                aria-label={`Move ${d.name} earlier`} className={ICON}><ArrowUp size={16} weight="bold" aria-hidden /></button>
              <button type="button" disabled={i === days.length - 1} onClick={() => setDays(shift(days, i, 1))}
                aria-label={`Move ${d.name} later`} className={ICON}><ArrowDown size={16} weight="bold" aria-hidden /></button>
            </li>
          ))}
        </ol>
      )}
      <button type="button" onClick={() => addDay()} disabled={days.length >= 20}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-stone-300 py-3 font-semibold text-stone-700 disabled:opacity-50">
        <Plus size={18} weight="bold" aria-hidden /> Add day
      </button>

      {/* Every saved version (Sergio, 2026-11-23): look back, or bring one back and save it. */}
      <section className="mt-8 border-t border-stone-200 pt-4">
        <button type="button" onClick={() => setShowHistory(!showHistory)} aria-expanded={showHistory}
          className="text-sm font-semibold tracking-wide text-stone-500 uppercase">
          {showHistory ? "Hide earlier versions" : "Earlier versions"}
        </button>
        {showHistory && (
          history.isLoading ? <p className="mt-2 text-sm text-stone-500">Loading…</p>
            : (history.data ?? []).length === 0 ? <p className="mt-2 text-sm text-stone-500">Nothing saved yet: each save is kept here.</p>
              : (
                <ul className="mt-2 divide-y divide-stone-200">
                  {history.data!.map((v) => {
                    const vDays = v.weeks.flatMap((w) => w.days);
                    return (
                      <li key={v.savedAt + v.start} className="flex items-center gap-2 py-2.5">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium">From the week of {friendlyDate(v.start)}</div>
                          <div className="truncate text-xs text-stone-500">{vDays.length} days: {vDays.map((d) => d.name).join(", ")}</div>
                        </div>
                        <button type="button" onClick={() => setDays(vDays)}
                          className="shrink-0 rounded-lg px-2.5 py-1.5 text-sm font-medium text-stone-700 ring-1 ring-stone-300">
                          Restore
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )
        )}
        {showHistory && <p className="mt-2 text-xs text-stone-500">Restore loads it here; Save makes it the plan.</p>}
      </section>

      {open && (
        <DayEditor
          day={open}
          number={days.indexOf(open) + 1}
          onChange={(next) => setDays(days.map((d) => (d.id === open.id ? { ...d, ...next } : d)))}
          onDuplicate={() => addDay(open)}
          onDelete={() => { setDays(days.filter((d) => d.id !== open.id)); setOpen(null); }}
          onClose={() => setOpen(null)}
        />
      )}
    </Screen>
  );
}

/** One day on its own page: name, kind, exercises in order, optional; duplicate or delete it. */
function DayEditor({ day, number, onChange, onDuplicate, onDelete, onClose }: {
  day: DayPlan; number: number;
  onChange: (next: Partial<DayPlan>) => void; onDuplicate: () => void; onDelete: () => void; onClose: () => void;
}) {
  const exercises = useExercises();
  const names = new Map((exercises.data ?? []).map((e) => [e.id, e.name]));
  const [adding, setAdding] = useState(false);
  // Copying or deleting a day asks first (Sergio, 2026-11-23).
  const [confirm, setConfirm] = useState<"copy" | "delete" | null>(null);

  return (
    <Screen title={`Day ${number}: ${day.name || "New day"}`} onBack={onClose}
      actions={<button type="button" onClick={onClose} className="rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white">Done</button>}>
      <div className="flex gap-2">
        <label className="min-w-0 flex-1">
          <span className="text-xs font-semibold tracking-wide text-stone-500 uppercase">Name</span>
          <input value={day.name} maxLength={40} onChange={(e) => onChange({ name: e.target.value })}
            className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 font-semibold" />
        </label>
        <label>
          <span className="text-xs font-semibold tracking-wide text-stone-500 uppercase">Kind</span>
          <select value={day.kind} onChange={(e) => onChange({ kind: e.target.value as DayKind })}
            className="mt-1 block rounded-lg border border-stone-200 bg-white px-2 py-2.5">
            {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </label>
      </div>

      <h2 className="mt-6 text-xs font-semibold tracking-wide text-stone-500 uppercase">Exercises, in order</h2>
      <div className="mt-2 rounded-xl border border-stone-200 bg-white px-3 py-1">
        {day.exercises.length === 0 && (
          <p className="py-2 text-sm text-stone-500">
            {day.kind === "Cardio" ? "None: asks for the ride or the treadmill when it starts." : "None yet."}
          </p>
        )}
        <ol className="divide-y divide-stone-100">
          {day.exercises.map((id, i) => (
            <li key={id} className="flex items-center gap-1 py-1">
              <span className="w-5 text-sm text-stone-400 tabular-nums">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate">{names.get(id) ?? id}</span>
              <button type="button" disabled={i === 0} onClick={() => onChange({ exercises: shift(day.exercises, i, -1) })}
                aria-label={`Move ${names.get(id) ?? id} up`} className={ICON}><ArrowUp size={16} weight="bold" aria-hidden /></button>
              <button type="button" disabled={i === day.exercises.length - 1} onClick={() => onChange({ exercises: shift(day.exercises, i, 1) })}
                aria-label={`Move ${names.get(id) ?? id} down`} className={ICON}><ArrowDown size={16} weight="bold" aria-hidden /></button>
              <button type="button" onClick={() => onChange({ exercises: day.exercises.filter((x) => x !== id) })}
                aria-label={`Remove ${names.get(id) ?? id}`} className={ICON}><X size={16} weight="bold" aria-hidden /></button>
            </li>
          ))}
        </ol>
        <button type="button" onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 rounded-lg py-2.5 text-sm font-medium text-stone-700">
          <Plus size={16} weight="bold" aria-hidden /> Add exercise
        </button>
      </div>

      <label className="mt-4 flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-3 py-3 text-sm">
        <input type="checkbox" checked={Boolean(day.optional)} onChange={(e) => onChange({ optional: e.target.checked })}
          className="size-5 accent-[var(--color-stone-700)]" />
        <span>
          <span className="font-medium">Optional</span>
          <span className="block text-stone-500">Never picked as next when another day follows.</span>
        </span>
      </label>

      <div className="mt-8 flex gap-2 border-t border-stone-200 pt-4">
        <button type="button" onClick={() => setConfirm("copy")}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-stone-300 py-3 text-sm font-medium text-stone-700">
          <CopySimple size={16} weight="bold" aria-hidden /> Duplicate
        </button>
        <button type="button" onClick={() => setConfirm("delete")}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-stone-300 py-3 text-sm font-medium text-red-600">
          <Trash size={16} weight="fill" aria-hidden /> Delete
        </button>
      </div>

      {confirm && (
        <BottomSheet title={confirm === "copy" ? `Duplicate ${day.name}?` : `Delete ${day.name}?`} onClose={() => setConfirm(null)}>
          <p className="text-stone-700">
            {confirm === "copy" ? "Adds a copy at the end of your days, and opens it." : "Removes it from your days once you save."}
          </p>
          <button type="button" onClick={() => { setConfirm(null); (confirm === "copy" ? onDuplicate : onDelete)(); }}
            className={`mt-4 w-full rounded-xl py-3.5 text-lg font-semibold ${confirm === "copy" ? "bg-blue-600 text-white" : "bg-red-600 text-[#f6f1e7]"}`}>
            {confirm === "copy" ? "Duplicate" : "Delete"}
          </button>
          <button type="button" onClick={() => setConfirm(null)} className="mt-2 w-full rounded-xl border border-stone-300 py-3 font-medium">
            Cancel
          </button>
        </BottomSheet>
      )}

      {adding && (
        <ExercisePicker title={`Add to ${day.name}`} plan={day.kind} inWorkout={day.exercises}
          onClose={() => setAdding(false)}
          onPick={(e) => {
            if (!day.exercises.includes(e.id)) onChange({ exercises: [...day.exercises, e.id] });
            setAdding(false);
          }} />
      )}
    </Screen>
  );
}
