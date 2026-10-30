import { ArrowsDownUp, Check, Images, NotePencil, Target, Trash, X } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

import type { Entry, Exercise, Photo, Problem, Scheme, SetData, Streak } from "../api";
import { useExerciseSummary } from "../hooks";
import { ladderWeights, nextSet, reachesTarget, schemeText, summarizeSets, weightText } from "../lib/sets";
import { friendlyDate } from "../lib/time";
import { BottomSheet } from "./BottomSheet";
import { CueList } from "./Cues";
import { InfoTip } from "./InfoTip";
import { PhotoButton, PhotoStrip } from "./Photos";
import { Stepper } from "./Stepper";

interface Props {
  entry: Entry;
  exercise: Exercise;
  /** The saved workout being edited, so "last time" means the one before it. */
  excludeWorkoutId?: string;
  onChange: (entry: Entry) => void;
  onRemove: () => void;
  /** A set was logged ("Set 2 · Weighted dips"): starts a new lap. */
  onSetLogged: (label: string) => void;
}

export function EntryCard({ entry, exercise, excludeWorkoutId, onChange, onRemove, onSetLogged }: Props) {
  const summary = useExerciseSummary(exercise.id, excludeWorkoutId);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const last = summary.data?.last;
  const streak = summary.data?.streak;

  return (
    <article className="rounded-2xl border border-stone-200 bg-white p-4">
      <header className="flex items-start gap-2">
        <h2 className="flex-1 text-lg leading-tight font-semibold">{exercise.name}</h2>
        {confirmRemove ? (
          <span className="flex items-center gap-1">
            <button type="button" onClick={onRemove} className="rounded-lg bg-stone-900 px-2.5 py-1 text-sm font-medium text-white">Remove</button>
            <button type="button" onClick={() => setConfirmRemove(false)} className="rounded p-1 text-stone-500" aria-label="Keep exercise">
              <X size={18} weight="bold" aria-hidden />
            </button>
          </span>
        ) : (
          <button type="button" onClick={() => setConfirmRemove(true)} className="rounded p-1 text-stone-400" aria-label={`Remove ${exercise.name}`}>
            <Trash size={18} weight="fill" aria-hidden />
          </button>
        )}
      </header>

      {summary.data && <CueList exerciseId={exercise.id} exerciseName={exercise.name} cues={summary.data.cues} />}

      {last && exercise.measure !== "climb" && exercise.measure !== "run" && (
        <LastTime date={last.date} sets={last.entry.sets ?? []} load={exercise.load} best={summary.data?.bestDrop} />
      )}
      {streak && <TargetGame streak={streak} load={exercise.load} today={entry.sets ?? []} />}
      {summary.data && summary.data.photos.length > 0 && (
        <div className="mt-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-stone-500 uppercase">
            <Images size={14} weight="fill" aria-hidden /> Your photos
          </div>
          <PhotoStrip photos={summary.data.photos.map((p) => ({ ...p, caption: p.caption ?? friendlyDate(p.date) }))} />
        </div>
      )}

      {exercise.measure === "climb" ? (
        <ClimbLog entry={entry} onChange={onChange} />
      ) : exercise.measure === "run" ? (
        <RunLog entry={entry} onChange={onChange} />
      ) : (
        <SetLog entry={entry} exercise={exercise} lastSets={last?.entry.sets} bestDrop={summary.data?.bestDrop} target={streak?.scheme}
          onChange={onChange} onSetLogged={onSetLogged} />
      )}

      <EntryNotes entry={entry} onChange={onChange} />
    </article>
  );
}

// ------------------------------------------------------------------ last time and drop sets

/** A drop ladder as weight×reps steps: 90×4 · 70×5 · 45×8 · 25×8 · BW×18. */
export function Ladder({ sets }: { sets: SetData[] }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      {sets.map((s, i) => (
        <span key={i} className="rounded bg-sky-100 px-1.5 py-0.5 text-xs font-medium text-sky-900 tabular-nums">
          {s.weightLb ? s.weightLb : "BW"}×{s.reps ?? 0}
        </span>
      ))}
    </span>
  );
}

/** Last session, with the working sets and the drop set on separate rows, and the best drop set so far. */
function LastTime({ date, sets, load, best }: { date: string; sets: SetData[]; load: Exercise["load"]; best?: { date: string; sets: SetData[] } }) {
  const work = sets.filter((s) => !s.drop);
  const drop = sets.filter((s) => s.drop);
  const lastIsBest = best !== undefined && best.date === date;
  return (
    <div className="mt-2 rounded-xl bg-stone-50 px-3 py-2 text-sm">
      <div className="text-xs font-semibold tracking-wide text-stone-500 uppercase">Last time · {friendlyDate(date)}</div>
      <dl className="mt-1 grid grid-cols-[4.5rem_1fr] gap-x-2 gap-y-1">
        <dt className="text-stone-500">Sets</dt>
        <dd className="text-stone-800">{summarizeSets(work, load) || "none"}</dd>
        {drop.length > 0 && (
          <>
            <dt className="text-stone-500">Drop set</dt>
            <dd><Ladder sets={drop} />{lastIsBest && <span className="ml-1 text-xs font-semibold text-sky-800">best</span>}</dd>
          </>
        )}
        {best && !lastIsBest && (
          <>
            <dt className="text-stone-500">Best drop</dt>
            <dd>
              <Ladder sets={best.sets} /> <span className="text-xs text-stone-500">{friendlyDate(best.date)}</span>
            </dd>
          </>
        )}
      </dl>
    </div>
  );
}

// ------------------------------------------------------------------ the target game

/** Sergio's game: reach the target 3 sessions in a row (a miss takes one away), then go up. */
function TargetGame({ streak, load, today }: { streak: Streak; load: Exercise["load"]; today: SetData[] }) {
  const reachedToday = today.length > 0 && reachesTarget(today, streak.scheme);
  const done = streak.times >= streak.goal;
  return (
    <div className="mt-2 flex items-center gap-3 rounded-xl bg-blue-50 px-3 py-2 text-blue-900">
      <Target size={20} weight="fill" className="shrink-0 text-blue-700" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">Target {schemeText(streak.scheme, load)}</div>
        <div className="text-xs">
          {done ? `${streak.times} in a row: time to go up` : `${streak.times} of ${streak.goal} in a row`}
          {reachedToday && <span className="font-semibold"> · reached today</span>}
        </div>
      </div>
      <div className="flex gap-1" aria-label={`${streak.times} of ${streak.goal}`}>
        {Array.from({ length: streak.goal }, (_, i) => (
          <span
            key={i}
            className={`size-3 rounded-full ${
              i < streak.times ? "bg-blue-600" : i === streak.times && reachedToday ? "bg-blue-300" : "border-2 border-blue-300"
            }`}
          />
        ))}
      </div>
      <InfoTip title="Target">
        Reach these sets 3 sessions in a row, then go up. A session that misses takes one away. Reaching it means the same
        total reps at this weight or more.
      </InfoTip>
    </div>
  );
}

// ------------------------------------------------------------------ lifting


function SetLog({ entry, exercise, lastSets, bestDrop, target, onChange, onSetLogged }: {
  entry: Entry; exercise: Exercise; lastSets?: SetData[]; bestDrop?: { date: string; sets: SetData[] }; target?: Scheme;
  onChange: (e: Entry) => void; onSetLogged: (label: string) => void;
}) {
  const sets = entry.sets ?? [];
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState<SetData>(() => nextSet(sets, lastSets, exercise, target));
  const [dropOpen, setDropOpen] = useState(false);
  const hasWeight = exercise.load !== "bodyweight" && exercise.load !== "none";
  const seconds = exercise.measure === "seconds";

  // When "last time" arrives (or a set is logged), suggest the next set.
  useEffect(() => {
    if (editing === null) setDraft(nextSet(sets, lastSets, exercise, target));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastSets, target, sets.length, editing]);

  function save() {
    const next = [...sets];
    if (editing === null) next.push(draft);
    else next[editing] = { ...next[editing], ...draft };
    // Save the set first, then start the lap (the lap builds on the saved workout).
    onChange({ ...entry, sets: next });
    if (editing === null) onSetLogged(`Set ${next.length} · ${exercise.name}`);
    setEditing(null);
  }

  function remove(index: number) {
    onChange({ ...entry, sets: sets.filter((_, i) => i !== index) });
    setEditing(null);
  }

  const weightUnit =
    exercise.load === "barbell" ? `lb plates + ${exercise.barLb} bar`
      : exercise.load === "added" ? "lb added (0 = body weight)"
        : draft.each ? "lb each hand" : "lb";

  return (
    <div className="mt-3">
      {sets.length > 0 && (
        <ol className="mb-3 space-y-1">
          {sets.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => {
                  setEditing(editing === i ? null : i);
                  setDraft(s);
                }}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left tabular-nums ${
                  editing === i ? "bg-blue-50 ring-1 ring-blue-600" : "bg-stone-50"
                }`}
              >
                <span className="w-5 text-sm text-stone-500">{i + 1}</span>
                <span className="flex-1 font-medium">
                  {seconds ? `${s.seconds ?? 0} s` : `${s.reps ?? 0} reps`}
                  {hasWeight && s.weightLb !== undefined && (
                    <span className="text-stone-600"> × {weightText(s, exercise.load) || "0"}</span>
                  )}
                  {s.detail && <span className="block text-xs font-normal text-stone-500">{s.detail}</span>}
                </span>
                {s.drop && <span className="rounded bg-sky-100 px-1.5 py-0.5 text-xs font-medium text-sky-800">drop</span>}
              </button>
            </li>
          ))}
        </ol>
      )}

      <div className="rounded-xl border border-stone-200 p-3">
        <div className="space-y-2">
          {hasWeight && (
            <Stepper
              layout="row"
              label="Weight"
              value={draft.weightLb ?? 0}
              onChange={(weightLb) => setDraft({ ...draft, weightLb })}
              step={exercise.load === "dumbbell" ? 2.5 : 5}
              unit={weightUnit}
              decimals
            />
          )}
          <Stepper
            layout="row"
            label={seconds ? "Seconds" : "Reps"}
            value={(seconds ? draft.seconds : draft.reps) ?? 0}
            onChange={(v) => setDraft(seconds ? { ...draft, seconds: v } : { ...draft, reps: v })}
            step={1}
          />
        </div>
        <div className="mt-3 flex gap-2">
          {editing !== null && (
            <button type="button" onClick={() => remove(editing)} className="rounded-xl border border-red-200 px-4 font-medium text-red-600">
              Delete
            </button>
          )}
          <button
            type="button"
            onClick={save}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-lg font-semibold text-white active:bg-blue-700"
          >
            <Check size={22} weight="bold" aria-hidden />
            {editing === null ? `Log set ${sets.length + 1}` : `Update set ${editing + 1}`}
          </button>
        </div>
        {exercise.load === "added" && editing === null && (
          <button type="button" onClick={() => setDropOpen(true)}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-stone-200 py-2.5 text-sm font-medium text-stone-700">
            <ArrowsDownUp size={18} weight="fill" aria-hidden /> Drop set
          </button>
        )}
      </div>
      {dropOpen && (
        <DropSetSheet
          weights={ladderWeights(lastSets)}
          lastReps={(lastSets ?? []).filter((s) => s.drop).map((s) => s.reps ?? 0)}
          best={bestDrop}
          onClose={() => setDropOpen(false)}
          onLog={(ladder) => {
            onChange({ ...entry, sets: [...sets, ...ladder] });
            setDropOpen(false);
            onSetLogged(`Drop set · ${exercise.name}`);
          }}
        />
      )}
    </div>
  );
}

function DropSetSheet({ weights: initial, lastReps, best, onClose, onLog }: {
  weights: number[]; lastReps: number[]; best?: { date: string; sets: SetData[] }; onClose: () => void; onLog: (sets: SetData[]) => void;
}) {
  const [steps, setSteps] = useState(() => initial.map((weightLb, i) => ({ weightLb, reps: lastReps[i] ?? 0 })));
  const total = steps.reduce((sum, s) => sum + s.reps, 0);
  const bestTotal = best ? best.sets.reduce((sum, s) => sum + (s.reps ?? 0), 0) : 0;
  return (
    <BottomSheet title="Drop set" onClose={onClose}>
      <p className="mb-2 text-sm text-stone-500">No rest between steps. Reps at each weight{lastReps.length ? "; last time's are filled in" : ""}.</p>
      {best && (
        <div className="mb-3 rounded-xl bg-sky-50 px-3 py-2 text-sm">
          <div className="text-xs font-semibold tracking-wide text-sky-800 uppercase">
            Best so far · {friendlyDate(best.date)} · {bestTotal} reps
          </div>
          <div className="mt-1"><Ladder sets={best.sets} /></div>
        </div>
      )}
      <ul className="space-y-3">
        {steps.map((step, i) => (
          <li key={i} className="flex items-center gap-3">
            <input
              aria-label={`Weight for step ${i + 1}`}
              inputMode="decimal"
              value={step.weightLb}
              onChange={(e) => setSteps(steps.map((s, j) => (j === i ? { ...s, weightLb: Number(e.target.value) || 0 } : s)))}
              className="w-20 rounded-lg border border-stone-200 px-2 py-2 text-center tabular-nums"
            />
            <span className="text-sm text-stone-500">lb</span>
            <Stepper label={`Reps at ${step.weightLb || "BW"}`} value={step.reps} step={1}
              onChange={(reps) => setSteps(steps.map((s, j) => (j === i ? { ...s, reps } : s)))} />
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => onLog(steps.filter((s) => s.reps > 0).map((s) => ({ ...s, drop: true })))}
        className="mt-4 w-full rounded-xl bg-blue-600 py-3.5 text-lg font-semibold text-white"
      >
        Log drop set{best ? ` · ${total} reps${total > bestTotal ? " (new best)" : ""}` : ""}
      </button>
    </BottomSheet>
  );
}

// ------------------------------------------------------------------ climbing and running

const GRADES = ["V0", "V1", "V2", "V3", "V4", "V5", "V6", "V7"];
/** Hold colors are real-world colors, so they're fixed (not themed). */
export const HOLD_COLORS: Record<string, string> = {
  black: "#1c1917", white: "#f5f5f4", yellow: "#facc15", orange: "#f97316", red: "#dc2626",
  pink: "#ec4899", purple: "#9333ea", blue: "#2563eb", green: "#16a34a",
};

function ClimbLog({ entry, onChange }: { entry: Entry; onChange: (e: Entry) => void }) {
  const problems = entry.problems ?? [];
  const [draft, setDraft] = useState<Problem>({ grade: "V3", result: "sent", count: 1 });

  return (
    <div className="mt-3">
      {problems.length > 0 && (
        <ul className="mb-3 space-y-1">
          {problems.map((p, i) => (
            <li key={i} className="flex items-center gap-2 rounded-lg bg-stone-50 px-3 py-2">
              <span className="font-semibold">{p.grade}</span>
              {p.color && <span className="size-4 rounded-full border border-stone-300" style={{ background: HOLD_COLORS[p.color] ?? "#a8a29e" }} aria-label={p.color} />}
              <span className="flex-1 text-sm text-stone-600">
                {p.result === "sent" ? `sent${p.count && p.count > 1 ? ` ×${p.count}` : ""}` : `attempted${p.attempts ? ` ×${p.attempts}` : ""}`}
                {p.note ? ` · ${p.note}` : ""}
              </span>
              <button type="button" onClick={() => onChange({ ...entry, problems: problems.filter((_, j) => j !== i) })}
                className="rounded p-1 text-stone-400" aria-label={`Remove ${p.grade}`}>
                <Trash size={16} weight="fill" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="rounded-xl border border-stone-200 p-3">
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Grade">
          {GRADES.map((g) => (
            <button key={g} type="button" role="radio" aria-checked={draft.grade === g} onClick={() => setDraft({ ...draft, grade: g })}
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${draft.grade === g ? "bg-blue-600 text-white" : "bg-stone-100"}`}>
              {g}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Hold color">
          {Object.entries(HOLD_COLORS).map(([name, hex]) => (
            <button key={name} type="button" role="radio" aria-checked={draft.color === name} aria-label={name}
              onClick={() => setDraft({ ...draft, color: draft.color === name ? undefined : name })}
              className={`size-9 rounded-full border-2 ${draft.color === name ? "border-blue-600 ring-2 ring-blue-600" : "border-stone-300"}`}
              style={{ background: hex }} />
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-1 rounded-lg bg-stone-100 p-1" role="radiogroup" aria-label="Result">
          {(["sent", "attempted"] as const).map((r) => (
            <button key={r} type="button" role="radio" aria-checked={draft.result === r}
              onClick={() => setDraft(r === "sent" ? { ...draft, result: r, count: 1, attempts: undefined } : { ...draft, result: r, attempts: 1, count: undefined })}
              className={`rounded-md py-2 text-sm font-medium capitalize ${draft.result === r ? "bg-white shadow-sm" : "text-stone-500"}`}>
              {r === "sent" ? "Sent" : "Tried"}
            </button>
          ))}
        </div>
        <div className="mt-3">
          <Stepper
            layout="row"
            label={draft.result === "sent" ? "Sent" : "Attempts"}
            value={(draft.result === "sent" ? draft.count : draft.attempts) ?? 1}
            min={1}
            step={1}
            onChange={(n) => setDraft(draft.result === "sent" ? { ...draft, count: n } : { ...draft, attempts: n })}
          />
        </div>
        <button type="button" onClick={() => onChange({ ...entry, problems: [...problems, draft] })}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-lg font-semibold text-white">
          <Check size={22} weight="bold" aria-hidden /> Add {draft.grade}
        </button>
      </div>
    </div>
  );
}

function RunLog({ entry, onChange }: { entry: Entry; onChange: (e: Entry) => void }) {
  const segments = entry.segments ?? [];
  const minutes = entry.minutes ?? segments.reduce((sum, s) => sum + s.minutes, 0);
  return (
    <div className="mt-3 space-y-2 rounded-xl border border-stone-200 p-3">
      <Stepper layout="row" label="Distance" unit="miles" value={entry.distanceMi ?? 0} step={0.25} decimals
        onChange={(distanceMi) => onChange({ ...entry, distanceMi })} />
      <Stepper layout="row" label="Time" unit="minutes" value={Math.round(minutes)} step={1}
        onChange={(m) => onChange({ ...entry, minutes: m })} />
    </div>
  );
}

// ------------------------------------------------------------------ notes and photos for this exercise today

function EntryNotes({ entry, onChange }: { entry: Entry; onChange: (e: Entry) => void }) {
  const [writing, setWriting] = useState(false);
  const [text, setText] = useState("");
  const notes = entry.notes ?? [];
  const photos = entry.photos ?? [];

  return (
    <div className="mt-3 border-t border-stone-100 pt-2">
      {notes.length > 0 && (
        <ul className="mb-1 space-y-0.5">
          {notes.map((n, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-stone-600">
              <span className="flex-1">{n}</span>
              <button type="button" onClick={() => onChange({ ...entry, notes: notes.filter((_, j) => j !== i) })}
                className="rounded p-0.5 text-stone-400" aria-label="Remove note">
                <X size={14} weight="bold" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <PhotoStrip photos={photos} onRemove={(p: Photo) => onChange({ ...entry, photos: photos.filter((x) => x.key !== p.key) })} />
      {writing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) onChange({ ...entry, notes: [...notes, text.trim()] });
            setText("");
            setWriting(false);
          }}
          className="mt-2 flex gap-2"
        >
          <input autoFocus aria-label="Note for today" placeholder="How it went today" value={text} maxLength={1000}
            onChange={(e) => setText(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-stone-200 px-3 py-2 text-sm" />
          <button className="rounded-lg bg-blue-600 px-3 text-sm font-medium text-white">Save</button>
        </form>
      ) : (
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setWriting(true)}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-stone-600 active:bg-stone-100">
            <NotePencil size={18} weight="fill" aria-hidden /> Note
          </button>
          <PhotoButton onAdded={(p) => onChange({ ...entry, photos: [...photos, p] })} />
        </div>
      )}
    </div>
  );
}
