import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, CopySimple, Plus, Trash, X } from "@phosphor-icons/react";
import { useState } from "react";

import type { DayKind, DayPlan, TrainingPlans, WeekPlan } from "../api";
import { useExercises, usePlanHistory, useSavePlans } from "../hooks";
import { friendlyDate } from "../lib/time";
import { KINDS } from "../lib/progress";
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

/**
 * The training plans as a page (Sergio, 2026-11-21; flexible from 11-23): week types that repeat
 * in order, each with its own name and days, each day a name, a kind (Push, Legs, Pull, Upper,
 * Lower, Full body or Cardio) and its exercises. "This week" restarts the rotation from today.
 */
export function PlanEditor({ plans, today, onClose }: { plans: TrainingPlans; today: string; onClose: () => void }) {
  const save = useSavePlans(today);
  const exercises = useExercises();
  const names = new Map((exercises.data ?? []).map((e) => [e.id, e.name]));
  const [weeks, setWeeks] = useState<WeekPlan[]>(plans.weeks);
  const [current, setCurrent] = useState(plans.current);
  const [shownId, setShown] = useState(plans.current ?? plans.weeks[0]?.id ?? null);
  const [adding, setAdding] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const history = usePlanHistory(showHistory);

  const wi = Math.max(0, weeks.findIndex((w) => w.id === shownId));
  const week = weeks[wi] as WeekPlan | undefined;
  const setWeek = (next: Partial<WeekPlan>) => setWeeks(weeks.map((w, i) => (i === wi ? { ...w, ...next } : w)));
  const setDay = (id: string, next: Partial<DayPlan>) => week && setWeek({ days: week.days.map((d) => (d.id === id ? { ...d, ...next } : d)) });
  const addingTo = week?.days.find((d) => d.id === adding);

  function addWeek(copy: boolean) {
    const id = newId();
    const days = copy && week
      ? week.days.map((d) => ({ ...d, id: `${id}-${newId()}` }))
      : [];
    setWeeks([...weeks, { id, name: copy && week ? `${week.name} (copy)` : `Week ${weeks.length + 1}`, days }]);
    setShown(id);
    if (!current) setCurrent(id);
    setConfirmDelete(false);
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
                current: current !== plans.current ? current ?? undefined : undefined,
              });
              onClose();
            }}
            className="w-full rounded-xl bg-blue-600 py-3.5 text-lg font-semibold text-white disabled:opacity-50">
            {save.isPending ? "Saving…" : "Save plans"}
          </button>
        </>
      }>
      <p className="flex items-start gap-1 text-sm text-stone-600">
        <span className="flex-1">
          Week types repeat in this order, one per week{weeks.length > 1 ? `: ${weeks.map((w) => w.name).join(" → ")}, then again` : ""}.
        </span>
        <InfoTip title="Training plans">
          Each week type has its own days. A workout of a day starts with its exercises, in order; a Cardio day without
          exercises asks for the ride or the treadmill. Mixed kinds (Upper, Lower, Full body) count as strength days for
          the streak. "This week" starts the rotation from this week; the arrows change the order.
        </InfoTip>
      </p>

      {/* The week types, in rotation order, in the accent red (Sergio, 2026-11-23). */}
      <div className="-mx-4 mt-3 flex gap-1.5 overflow-x-auto overscroll-none px-4 pb-1" role="tablist" aria-label="Week types">
        {weeks.map((w) => (
          <button key={w.id} type="button" role="tab" aria-selected={w.id === week?.id}
            onClick={() => { setShown(w.id); setConfirmDelete(false); }}
            className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold ${w.id === week?.id ? "border-blue-600 bg-blue-600 text-[#f6f1e7]" : "border-blue-600 text-blue-700"}`}>
            {w.id === current && <Check size={14} weight="bold" aria-label="this week" />}
            {w.name || "Untitled"}
          </button>
        ))}
        <button type="button" onClick={() => addWeek(false)}
          className="flex shrink-0 items-center gap-1 rounded-lg border border-dashed border-stone-400 px-3 py-2 text-sm font-semibold text-stone-600">
          <Plus size={14} weight="bold" aria-hidden /> Week type
        </button>
      </div>

      {!week ? (
        <p className="mt-6 text-center text-sm text-stone-500">No week types yet: add one to start.</p>
      ) : (
        <>
          <section className="mt-3 rounded-xl border border-blue-600 p-3">
            <label className="block">
              <span className="text-xs font-medium tracking-wide text-stone-500 uppercase">Week type name</span>
              <input value={week.name} maxLength={60} onChange={(e) => setWeek({ name: e.target.value })}
                className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 font-semibold" />
            </label>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <button type="button" onClick={() => setCurrent(week.id)} aria-pressed={week.id === current}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium ${week.id === current ? "bg-blue-600 text-[#f6f1e7]" : "text-stone-700 ring-1 ring-stone-300"}`}>
                <Check size={14} weight="bold" aria-hidden /> {week.id === current ? "This week" : "Make this week"}
              </button>
              <button type="button" disabled={wi === 0} onClick={() => setWeeks(shift(weeks, wi, -1))} aria-label="Earlier in the rotation"
                className="rounded-lg p-2 text-stone-600 ring-1 ring-stone-300 disabled:opacity-30"><ArrowLeft size={16} weight="bold" aria-hidden /></button>
              <button type="button" disabled={wi === weeks.length - 1} onClick={() => setWeeks(shift(weeks, wi, 1))} aria-label="Later in the rotation"
                className="rounded-lg p-2 text-stone-600 ring-1 ring-stone-300 disabled:opacity-30"><ArrowRight size={16} weight="bold" aria-hidden /></button>
              <button type="button" onClick={() => addWeek(true)} aria-label="Copy this week type"
                className="rounded-lg p-2 text-stone-600 ring-1 ring-stone-300"><CopySimple size={16} weight="bold" aria-hidden /></button>
              {weeks.length > 1 && (confirmDelete ? (
                <button type="button" onClick={() => {
                  const rest = weeks.filter((w) => w.id !== week.id);
                  setWeeks(rest);
                  setShown(rest[0].id);
                  if (current === week.id) setCurrent(rest[0].id);
                  setConfirmDelete(false);
                }} className="ml-auto rounded-lg bg-stone-900 px-2.5 py-1.5 text-sm font-medium text-white">Delete week type</button>
              ) : (
                <button type="button" onClick={() => setConfirmDelete(true)} aria-label="Delete this week type"
                  className="ml-auto rounded-lg p-2 text-red-600"><Trash size={16} weight="fill" aria-hidden /></button>
              ))}
            </div>
          </section>

          <div className="mt-4 space-y-4">
            {week.days.map((day, di) => (
              <section key={day.id} className="rounded-xl border border-stone-200 p-3">
                <div className="flex items-center gap-1">
                  <span className="flex-1 text-xs font-medium tracking-wide text-stone-500 uppercase">Day {di + 1}</span>
                  <button type="button" disabled={di === 0} onClick={() => setWeek({ days: shift(week.days, di, -1) })} aria-label={`Move ${day.name} earlier`}
                    className="rounded p-1.5 text-stone-500 disabled:opacity-30"><ArrowUp size={16} weight="bold" aria-hidden /></button>
                  <button type="button" disabled={di === week.days.length - 1} onClick={() => setWeek({ days: shift(week.days, di, 1) })} aria-label={`Move ${day.name} later`}
                    className="rounded p-1.5 text-stone-500 disabled:opacity-30"><ArrowDown size={16} weight="bold" aria-hidden /></button>
                  <button type="button" onClick={() => setWeek({ days: week.days.filter((d) => d.id !== day.id) })} aria-label={`Remove ${day.name}`}
                    className="rounded p-1.5 text-red-600"><Trash size={16} weight="fill" aria-hidden /></button>
                </div>
                <div className="mt-1 flex gap-2">
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
                    <li key={id} className="flex items-center gap-1 py-1.5">
                      <span className="w-5 text-sm text-stone-400 tabular-nums">{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate">{names.get(id) ?? id}</span>
                      <button type="button" disabled={i === 0} onClick={() => setDay(day.id, { exercises: shift(day.exercises, i, -1) })} aria-label={`Move ${names.get(id) ?? id} up`}
                        className="rounded p-2 text-stone-500 disabled:opacity-30"><ArrowUp size={16} weight="bold" aria-hidden /></button>
                      <button type="button" disabled={i === day.exercises.length - 1} onClick={() => setDay(day.id, { exercises: shift(day.exercises, i, 1) })} aria-label={`Move ${names.get(id) ?? id} down`}
                        className="rounded p-2 text-stone-500 disabled:opacity-30"><ArrowDown size={16} weight="bold" aria-hidden /></button>
                      <button type="button" onClick={() => setDay(day.id, { exercises: day.exercises.filter((x) => x !== id) })}
                        aria-label={`Remove ${names.get(id) ?? id}`} className="rounded p-2 text-stone-500"><X size={16} weight="bold" aria-hidden /></button>
                    </li>
                  ))}
                </ol>
                <label className="mt-2 flex items-center gap-2 text-sm text-stone-600">
                  <input type="checkbox" checked={Boolean(day.optional)} onChange={(e) => setDay(day.id, { optional: e.target.checked })}
                    className="size-4 accent-[var(--color-blue-600)]" />
                  Optional: doesn't count toward the week's goal
                </label>
                {day.kind === "Cardio" && day.exercises.length === 0 && (
                  <p className="mt-1 text-sm text-stone-500">Asks for the ride or the treadmill when it starts.</p>
                )}
                <button type="button" onClick={() => setAdding(day.id)}
                  className="mt-1 flex items-center gap-1.5 rounded-lg px-1 py-1.5 text-sm font-medium text-blue-700">
                  <Plus size={16} weight="bold" aria-hidden /> Add exercise
                </button>
              </section>
            ))}
            <button type="button"
              onClick={() => setWeek({ days: [...week.days, { id: `${week.id}-${newId()}`, name: "New day", kind: "Push", exercises: [] }] })}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-stone-300 py-3 font-semibold text-blue-700">
              <Plus size={18} weight="bold" aria-hidden /> Add day
            </button>
          </div>
        </>
      )}

      {/* Every saved version (Sergio, 2026-11-23): look back, or bring one back and save it. */}
      <section className="mt-6 border-t border-stone-200 pt-4">
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
                      <button type="button" onClick={() => { setWeeks(v.weeks); setShown(v.weeks[0]?.id ?? null); }}
                        className="shrink-0 rounded-lg px-2.5 py-1.5 text-sm font-medium text-blue-700 ring-1 ring-stone-300">
                        Restore
                      </button>
                    </li>
                  ))}
                </ul>
              )
        )}
        {showHistory && <p className="mt-2 text-xs text-stone-500">Restore loads a version here; Save makes it the plan from this week.</p>}
      </section>

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
