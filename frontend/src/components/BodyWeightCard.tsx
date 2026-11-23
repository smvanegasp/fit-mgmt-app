import { Plus, Scales } from "@phosphor-icons/react";
import { useState } from "react";

import { useBodyWeights, useLogBodyWeight } from "../hooks";
import { friendlyDate, localIso } from "../lib/time";
import { BottomSheet } from "./BottomSheet";
import { LineChart } from "./LineChart";
import { Stepper } from "./Stepper";

const lb = (v: number) => `${v} lbs`;

/**
 * Body weight (Sergio, 2026-11-03): its home is Progress. The latest weigh-in, the change since the
 * first one, the line once there are two, and logging (one weight per day; logging a day again
 * replaces it).
 */
export function BodyWeightCard() {
  const weights = useBodyWeights();
  const [logging, setLogging] = useState(false);
  const points = (weights.data ?? []).map((w) => ({ date: w.date, value: w.weightLb }));
  const latest = points.at(-1);
  const change = latest && points.length > 1 ? Math.round((latest.value - points[0].value) * 10) / 10 : null;

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">Body weight</h2>
          {latest ? (
            <p className="text-sm text-stone-500">
              <span className="font-display text-2xl font-semibold text-stone-900">{latest.value}</span> lb · {friendlyDate(latest.date)}
              {change !== null && ` · ${change > 0 ? "+" : ""}${change} lbs since ${friendlyDate(points[0].date)}`}
            </p>
          ) : (
            <p className="text-sm text-stone-500">Log a weigh-in to start the line.</p>
          )}
        </div>
        <button type="button" onClick={() => setLogging(true)}
          className="flex shrink-0 items-center gap-1.5 rounded-xl border border-stone-300 px-3 py-2 text-sm font-semibold">
          <Plus size={16} weight="bold" aria-hidden /> Log
        </button>
      </div>
      {points.length >= 2 && <div className="mt-3"><LineChart points={points} format={lb} color="var(--color-blue-600)" label="Body weight" noun="weigh-ins" /></div>}
      {logging && <LogSheet last={latest?.value} onClose={() => setLogging(false)} />}
    </section>
  );
}

function LogSheet({ last, onClose }: { last?: number; onClose: () => void }) {
  const log = useLogBodyWeight();
  const [date, setDate] = useState(localIso().slice(0, 10));
  const [weight, setWeight] = useState(last ?? 160);

  return (
    <BottomSheet title="Log body weight" onClose={onClose}>
      <div className="space-y-4">
        <Stepper layout="row" label="Weight" unit="lb" value={weight} step={0.5} decimals onChange={setWeight} />
        <label className="flex items-center gap-3">
          <span className="w-20 text-xs font-medium tracking-wide text-stone-500 uppercase">Date</span>
          <input type="date" value={date} max={localIso().slice(0, 10)} onChange={(e) => setDate(e.target.value)}
            className="flex-1 rounded-xl border border-stone-300 bg-white px-3 py-2.5" />
        </label>
        {log.error && <p className="text-sm text-red-600">{log.error.message}</p>}
        <button type="button" disabled={log.isPending || !date || !(weight > 50)}
          onClick={async () => { await log.mutateAsync({ date, weightLb: weight }); onClose(); }}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-lg font-semibold text-white disabled:opacity-50">
          <Scales size={22} weight="fill" aria-hidden /> Save {weight} lbs
        </button>
      </div>
    </BottomSheet>
  );
}
