import { ArrowDown, ArrowUp, Plus, X } from "@phosphor-icons/react";
import { useState } from "react";

import type { DayPlan } from "../api";
import { useExercises, useSavePlans } from "../hooks";
import { weekName } from "../lib/plan";
import { ExercisePicker } from "./ExercisePicker";
import { Screen } from "./Screen";

/**
 * Edit the training plans (Sergio, 2026-11-21): each week type's days, their names and exercises
 * in order. What a planned workout starts with comes from here. A page of its own with Save fixed
 * at the bottom (Sergio, 2026-11-23: as a sheet over Train it scrolled past Save).
 */
export function PlanEditor({ plans, week: initialWeek, today, onClose }: {
  plans: DayPlan[]; week: "A" | "B"; today: string; onClose: () => void;
}) {
  const save = useSavePlans(today);
  const exercises = useExercises();
  const names = new Map((exercises.data ?? []).map((e) => [e.id, e.name]));
  const [draft, setDraft] = useState(plans);
  const [week, setWeek] = useState(initialWeek);
  const [adding, setAdding] = useState<string | null>(null);

  const change = (id: string, next: Partial<DayPlan>) => setDraft(draft.map((p) => (p.id === id ? { ...p, ...next } : p)));
  const move = (plan: DayPlan, i: number, by: number) => {
    const list = [...plan.exercises];
    [list[i], list[i + by]] = [list[i + by], list[i]];
    change(plan.id, { exercises: list });
  };
  const order = ["Push", "Legs", "Pull"];
  const shown = draft.filter((p) => p.week === week).sort((a, b) => order.indexOf(a.dayType) - order.indexOf(b.dayType));
  const addingTo = draft.find((p) => p.id === adding);

  return (
    <Screen title="Training plans" onBack={onClose}
      footer={
        <>
          {save.error && <p className="mb-2 text-sm text-red-600">{save.error.message}</p>}
          <button type="button" disabled={save.isPending || draft.some((p) => !p.name.trim())}
            onClick={async () => { await save.mutateAsync(draft.map((p) => ({ ...p, name: p.name.trim() }))); onClose(); }}
            className="w-full rounded-xl bg-blue-600 py-3.5 text-lg font-semibold text-white disabled:opacity-50">
            {save.isPending ? "Saving…" : "Save plans"}
          </button>
        </>
      }>
      <p className="text-sm text-stone-600">
        Two week types that alternate. A workout of the day starts with these exercises, in this order.
      </p>
      {/* The week tabs in the accent red (Sergio, 2026-11-23: make them obvious). */}
      <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl border border-blue-600 p-1" role="tablist" aria-label="Week type">
        {(["A", "B"] as const).map((w) => (
          <button key={w} type="button" role="tab" aria-selected={week === w} onClick={() => setWeek(w)}
            className={`rounded-lg px-2 py-2.5 text-sm font-semibold ${week === w ? "bg-blue-600 text-white" : "text-blue-700"}`}>
            {weekName(draft, w)}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-4">
        {shown.map((plan) => (
          <section key={plan.id} className="rounded-xl border border-stone-200 p-3">
            <label className="block">
              <span className="text-xs font-medium tracking-wide text-stone-500 uppercase">{plan.dayType} day</span>
              <input value={plan.name} maxLength={40} onChange={(e) => change(plan.id, { name: e.target.value })}
                aria-label={`Name of the ${plan.dayType} day`}
                className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 font-semibold" />
            </label>
            <ol className="mt-2 divide-y divide-stone-100">
              {plan.exercises.map((id, i) => (
                <li key={id} className="flex items-center gap-1 py-1.5">
                  <span className="w-5 text-sm text-stone-400 tabular-nums">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate">{names.get(id) ?? id}</span>
                  <button type="button" disabled={i === 0} onClick={() => move(plan, i, -1)} aria-label={`Move ${names.get(id) ?? id} up`}
                    className="rounded p-2 text-stone-500 disabled:opacity-30"><ArrowUp size={16} weight="bold" aria-hidden /></button>
                  <button type="button" disabled={i === plan.exercises.length - 1} onClick={() => move(plan, i, 1)} aria-label={`Move ${names.get(id) ?? id} down`}
                    className="rounded p-2 text-stone-500 disabled:opacity-30"><ArrowDown size={16} weight="bold" aria-hidden /></button>
                  <button type="button" onClick={() => change(plan.id, { exercises: plan.exercises.filter((x) => x !== id) })}
                    aria-label={`Remove ${names.get(id) ?? id}`} className="rounded p-2 text-stone-500"><X size={16} weight="bold" aria-hidden /></button>
                </li>
              ))}
            </ol>
            <button type="button" onClick={() => setAdding(plan.id)}
              className="mt-1 flex items-center gap-1.5 rounded-lg px-1 py-1.5 text-sm font-medium text-blue-700">
              <Plus size={16} weight="bold" aria-hidden /> Add exercise
            </button>
          </section>
        ))}
      </div>


      {addingTo && (
        <ExercisePicker title={`Add to ${addingTo.name}`} plan={addingTo.dayType} inWorkout={addingTo.exercises}
          onClose={() => setAdding(null)}
          onPick={(e) => {
            if (!addingTo.exercises.includes(e.id)) change(addingTo.id, { exercises: [...addingTo.exercises, e.id] });
            setAdding(null);
          }} />
      )}
    </Screen>
  );
}
