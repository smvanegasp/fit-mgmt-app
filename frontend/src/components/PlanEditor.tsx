import { ArrowDown, ArrowUp, CaretRight, CopySimple, Plus, Trash, X } from "@phosphor-icons/react";
import { useState } from "react";

import type { DayKind, DayPlan, TrainingPlans, WeekPlan } from "../api";
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

/**
 * The training plans (Sergio, 2026-11-21; reworked 11-23: "not intuitive"). This page is the
 * rotation: the week types in the order they repeat, one per week, moved with the arrows. Tapping
 * one opens it on its own page to edit its days. Nothing is stored until Save.
 */
export function PlanEditor({ plans, today, onClose }: { plans: TrainingPlans; today: string; onClose: () => void }) {
  const save = useSavePlans(today);
  const [weeks, setWeeks] = useState<WeekPlan[]>(plans.weeks);
  const [openId, setOpen] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const history = usePlanHistory(showHistory);
  const open = weeks.find((w) => w.id === openId);

  function addWeek(from?: WeekPlan) {
    const id = newId();
    const days = from ? from.days.map((d) => ({ ...d, id: `${id}-${newId()}` })) : [];
    setWeeks([...weeks, { id, name: from ? `${from.name} (copy)` : `Week ${weeks.length + 1}`, days }]);
    setOpen(id);
  }

  const valid = weeks.length > 0 && weeks.every((w) => w.name.trim() && w.days.every((d) => d.name.trim()));

  return (
    <Screen title="Training plans" onBack={onClose}
      footer={
        <>
          {save.error && <p className="mb-2 text-sm text-red-600">{save.error.message}</p>}
          <button type="button" disabled={save.isPending || !valid}
            onClick={async () => {
              await save.mutateAsync({
                weeks: weeks.map((w) => ({ ...w, name: w.name.trim(), days: w.days.map((d) => ({ ...d, name: d.name.trim() })) })),
              });
              onClose();
            }}
            className="w-full rounded-xl bg-blue-600 py-3.5 text-lg font-semibold text-white disabled:opacity-50">
            {save.isPending ? "Saving…" : "Save plans"}
          </button>
        </>
      }>
      <h2 className="flex items-center gap-1 text-sm font-semibold tracking-wide text-stone-500 uppercase">
        Your days, in order
        <InfoTip title="Your days">The week types' days repeat in this order, then start over. Tap one to edit its days.</InfoTip>
      </h2>

      {weeks.length === 0 ? (
        <p className="mt-3 text-sm text-stone-500">No week types yet: add one to start.</p>
      ) : (
        <ol className="mt-2 divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white">
          {weeks.map((w, i) => (
            <li key={w.id} className="flex items-center gap-1 pr-1">
              <button type="button" onClick={() => setOpen(w.id)} className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-3 text-left">
                <span className="w-5 shrink-0 text-center font-display text-xl leading-none text-stone-400 tabular-nums">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-semibold">{w.name || "Untitled"}</span>
                  </span>
                  <span className="block truncate text-sm text-stone-500">
                    {w.days.length ? w.days.map((d) => d.name).join(", ") : "No days yet"}
                  </span>
                </span>
                <CaretRight size={16} weight="bold" className="shrink-0 text-stone-400" aria-hidden />
              </button>
              {weeks.length > 1 && (
                <span className="flex shrink-0 flex-col">
                  <button type="button" disabled={i === 0} onClick={() => setWeeks(shift(weeks, i, -1))}
                    aria-label={`Move ${w.name} earlier`} className="rounded p-1.5 text-stone-500 disabled:opacity-25">
                    <ArrowUp size={16} weight="bold" aria-hidden />
                  </button>
                  <button type="button" disabled={i === weeks.length - 1} onClick={() => setWeeks(shift(weeks, i, 1))}
                    aria-label={`Move ${w.name} later`} className="rounded p-1.5 text-stone-500 disabled:opacity-25">
                    <ArrowDown size={16} weight="bold" aria-hidden />
                  </button>
                </span>
              )}
            </li>
          ))}
        </ol>
      )}
      <button type="button" onClick={() => addWeek()}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-stone-300 py-3 font-semibold text-stone-700">
        <Plus size={18} weight="bold" aria-hidden /> Add week type
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
                  {history.data!.map((v) => (
                    <li key={v.savedAt + v.start} className="flex items-center gap-2 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">From the week of {friendlyDate(v.start)}</div>
                        <div className="truncate text-xs text-stone-500">
                          {v.weeks.map((w) => `${w.name} (${w.days.length} days)`).join(" · ")}
                        </div>
                      </div>
                      <button type="button" onClick={() => setWeeks(v.weeks)}
                        className="shrink-0 rounded-lg px-2.5 py-1.5 text-sm font-medium text-stone-700 ring-1 ring-stone-300">
                        Restore
                      </button>
                    </li>
                  ))}
                </ul>
              )
        )}
        {showHistory && <p className="mt-2 text-xs text-stone-500">Restore loads it here; Save makes it the plan.</p>}
      </section>

      {open && (
        <WeekEditor
          week={open}
          canDelete={weeks.length > 1}
          onChange={(next) => setWeeks(weeks.map((w) => (w.id === open.id ? { ...w, ...next } : w)))}
          onDuplicate={() => addWeek(open)}
          onDelete={() => {
            const rest = weeks.filter((w) => w.id !== open.id);
            setWeeks(rest);
            setOpen(null);
          }}
          onClose={() => setOpen(null)}
        />
      )}
    </Screen>
  );
}

/** One week type on its own page: its name, whether it's this week, and its days. */
function WeekEditor({ week, canDelete, onChange, onDuplicate, onDelete, onClose }: {
  week: WeekPlan; canDelete: boolean;
  onChange: (next: Partial<WeekPlan>) => void;
  onDuplicate: () => void; onDelete: () => void; onClose: () => void;
}) {
  const exercises = useExercises();
  const names = new Map((exercises.data ?? []).map((e) => [e.id, e.name]));
  const [adding, setAdding] = useState<string | null>(null);
  // Copying or deleting a week type asks first (Sergio, 2026-11-23).
  const [confirm, setConfirm] = useState<"copy" | "delete" | null>(null);
  const setDay = (id: string, next: Partial<DayPlan>) => onChange({ days: week.days.map((d) => (d.id === id ? { ...d, ...next } : d)) });
  const addingTo = week.days.find((d) => d.id === adding);

  return (
    <Screen title={week.name || "Week type"} onBack={onClose}
      actions={<button type="button" onClick={onClose} className="rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white">Done</button>}>
      <label className="block">
        <span className="text-xs font-semibold tracking-wide text-stone-500 uppercase">Name</span>
        <input value={week.name} maxLength={60} onChange={(e) => onChange({ name: e.target.value })}
          className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 font-semibold" />
      </label>

      <h2 className="mt-6 text-xs font-semibold tracking-wide text-stone-500 uppercase">Days</h2>
      <div className="mt-2 space-y-3">
        {week.days.map((day, di) => (
          <section key={day.id} className="rounded-xl border border-stone-200 bg-white p-3">
            <div className="flex gap-2">
              <input value={day.name} maxLength={40} onChange={(e) => setDay(day.id, { name: e.target.value })}
                aria-label={`Name of day ${di + 1}`}
                className="min-w-0 flex-1 rounded-lg border border-stone-200 bg-white px-3 py-2 font-semibold" />
              <select value={day.kind} onChange={(e) => setDay(day.id, { kind: e.target.value as DayKind })}
                aria-label={`Kind of day ${di + 1}`}
                className="rounded-lg border border-stone-200 bg-white px-2 py-2">
                {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <ol className="mt-2 divide-y divide-stone-100">
              {day.exercises.map((id, i) => (
                <li key={id} className="flex items-center gap-1 py-1">
                  <span className="w-5 text-sm text-stone-400 tabular-nums">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate">{names.get(id) ?? id}</span>
                  <button type="button" disabled={i === 0} onClick={() => setDay(day.id, { exercises: shift(day.exercises, i, -1) })}
                    aria-label={`Move ${names.get(id) ?? id} up`} className={ICON}><ArrowUp size={16} weight="bold" aria-hidden /></button>
                  <button type="button" disabled={i === day.exercises.length - 1} onClick={() => setDay(day.id, { exercises: shift(day.exercises, i, 1) })}
                    aria-label={`Move ${names.get(id) ?? id} down`} className={ICON}><ArrowDown size={16} weight="bold" aria-hidden /></button>
                  <button type="button" onClick={() => setDay(day.id, { exercises: day.exercises.filter((x) => x !== id) })}
                    aria-label={`Remove ${names.get(id) ?? id}`} className={ICON}><X size={16} weight="bold" aria-hidden /></button>
                </li>
              ))}
            </ol>
            {day.kind === "Cardio" && day.exercises.length === 0 && (
              <p className="mt-1 text-sm text-stone-500">Asks for the ride or the treadmill when it starts.</p>
            )}
            <button type="button" onClick={() => setAdding(day.id)}
              className="mt-1 flex items-center gap-1.5 rounded-lg py-2 text-sm font-medium text-stone-700">
              <Plus size={16} weight="bold" aria-hidden /> Add exercise
            </button>
            <div className="mt-2 flex items-center gap-1 border-t border-stone-100 pt-2">
              <label className="flex flex-1 items-center gap-2 text-sm text-stone-600">
                <input type="checkbox" checked={Boolean(day.optional)} onChange={(e) => setDay(day.id, { optional: e.target.checked })}
                  className="size-4 accent-[var(--color-stone-700)]" />
                Optional (never next up first)
              </label>
              <button type="button" disabled={di === 0} onClick={() => onChange({ days: shift(week.days, di, -1) })}
                aria-label={`Move ${day.name} earlier`} className={ICON}><ArrowUp size={16} weight="bold" aria-hidden /></button>
              <button type="button" disabled={di === week.days.length - 1} onClick={() => onChange({ days: shift(week.days, di, 1) })}
                aria-label={`Move ${day.name} later`} className={ICON}><ArrowDown size={16} weight="bold" aria-hidden /></button>
              <button type="button" onClick={() => onChange({ days: week.days.filter((d) => d.id !== day.id) })}
                aria-label={`Remove ${day.name}`} className={ICON}><Trash size={16} weight="fill" aria-hidden /></button>
            </div>
          </section>
        ))}
        <button type="button"
          onClick={() => onChange({ days: [...week.days, { id: `${week.id}-${newId()}`, name: "New day", kind: "Push", exercises: [] }] })}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-stone-300 py-3 font-semibold text-stone-700">
          <Plus size={18} weight="bold" aria-hidden /> Add day
        </button>
      </div>

      <div className="mt-8 flex gap-2 border-t border-stone-200 pt-4">
        <button type="button" onClick={() => setConfirm("copy")}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-stone-300 py-3 text-sm font-medium text-stone-700">
          <CopySimple size={16} weight="bold" aria-hidden /> Duplicate
        </button>
        {canDelete && (
          <button type="button" onClick={() => setConfirm("delete")}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-stone-300 py-3 text-sm font-medium text-red-600">
            <Trash size={16} weight="fill" aria-hidden /> Delete
          </button>
        )}
      </div>

      {confirm && (
        <BottomSheet title={confirm === "copy" ? `Duplicate ${week.name}?` : `Delete ${week.name}?`} onClose={() => setConfirm(null)}>
          <p className="text-stone-700">
            {confirm === "copy"
              ? "Adds a copy with the same days to the end of your rotation, and opens it."
              : "Removes it and its days from your rotation once you save."}
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

      {addingTo && (
        <ExercisePicker title={`Add to ${addingTo.name}`} plan={addingTo.kind} inWorkout={addingTo.exercises}
          onClose={() => setAdding(null)}
          onPick={(e) => {
            if (!addingTo.exercises.includes(e.id)) setDay(addingTo.id, { exercises: [...addingTo.exercises, e.id] });
            setAdding(null);
          }} />
      )}
    </Screen>
  );
}
