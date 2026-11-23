import { ArrowsDownUp, CaretDown, CaretRight, Check, CircleNotch, Images, Lightbulb, NotePencil, Trash, X } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { api, type CueSection, type Entry, type Exercise, type Note, type Photo, type Problem, type Role, type Scheme, type SetData, type Streak } from "../api";
import { useAddNote, useExerciseSummary, useUpdateExercise, useUpdateNote } from "../hooks";
import { congratsFor, goUpText, ladderWeights, nextSet, reachesTarget, schemeText, summarizeSets, weightText, type Congrats } from "../lib/sets";
import { clearDraft, loadDraft, saveDraft } from "../lib/drafts";
import { pelotonStats } from "../lib/kinds";
import { formatDuration } from "../lib/duration";
import { friendlyDate, localIso, secondsBetween } from "../lib/time";
import { BottomSheet } from "./BottomSheet";
import { Celebration } from "./Celebration";
import { CueList } from "./Cues";
import { InfoTip } from "./InfoTip";
import { PhotoButton, PhotoStrip } from "./Photos";
import { GameDots, SetGlyph } from "./Progression";
import { useScreens } from "./Screens";
import { Stepper } from "./Stepper";

interface Props {
  entry: Entry;
  exercise: Exercise;
  /** The saved workout being edited, so "last time" means the one before it. */
  excludeWorkoutId?: string;
  /** Today's first lift or a later one: its target and "last time" follow (squat after deadlift is lighter). */
  role?: Role;
  /** Where the set being dialed in is kept on the phone: workout, position and exercise. */
  draftKey: string;
  onChange: (entry: Entry) => void;
  onRemove: () => void;
  /** A set was logged ("Set 2 · Weighted dips"): starts a new lap. */
  onSetLogged: (label: string) => void;
  /** The workout's start, for the warm-up's running time. */
  startedAt?: string;
  /** The workout in progress: offer "Done" to fold the exercise away. */
  focus?: boolean;
}

export function EntryCard({ entry, exercise, excludeWorkoutId, role, draftKey, onChange, onRemove, onSetLogged, startedAt, focus }: Props) {
  const summary = useExerciseSummary(exercise.id, excludeWorkoutId, role);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [celebrate, setCelebrate] = useState<Congrats | null>(null);
  const screens = useScreens();
  const last = summary.data?.last;
  const streak = summary.data?.streak;

  if (exercise.measure === "time") {
    return (
      <article className="rounded-2xl border border-stone-200 bg-white p-4">
        <h2 className="text-lg leading-tight font-semibold">{exercise.name}</h2>
        <WarmUpLog entry={entry} startedAt={startedAt} onChange={onChange} onSetLogged={onSetLogged} focus={focus} />
      </article>
    );
  }

  return (
    <article className="rounded-2xl border border-stone-200 bg-white p-4">
      <header className="flex items-start gap-2">
        {/* Everything else about the exercise (its progression, all cues, every session) is one tap away. */}
        <button type="button" onClick={() => screens.openExercise(exercise.id)} className="flex min-w-0 flex-1 items-center gap-1 text-left">
          <h2 className="text-lg leading-tight font-semibold">{exercise.name}</h2>
          <CaretRight size={14} className="shrink-0 text-stone-400" aria-hidden />
        </button>
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

      {last && exercise.measure !== "climb" && exercise.measure !== "run" && (
        <LastTime date={last.date} sets={last.entry.sets ?? []} load={exercise.load} best={summary.data?.bestDrop} />
      )}
      {streak && <TargetGame streak={streak} load={exercise.load} today={entry.sets ?? []} />}

      {exercise.measure === "climb" ? (
        <ClimbLog entry={entry} onChange={onChange} />
      ) : exercise.measure === "run" ? (
        <RunLog entry={entry} exercise={exercise} onChange={onChange} />
      ) : (
        <SetLog entry={entry} exercise={exercise} draftKey={draftKey} lastSets={last?.entry.sets} bestDrop={summary.data?.bestDrop} target={streak?.scheme}
          onChange={onChange} onSetLogged={onSetLogged}
          onLogged={focus && streak ? (before, after) => setCelebrate(congratsFor(before, after, streak.scheme, streak.times, streak.goal, streak.style)) : undefined} />
      )}

      <EntryNotes entry={entry} exercise={exercise} cues={summary.data?.cues ?? []} setupPhotos={summary.data?.photos ?? []} onChange={onChange} />
      {summary.data && <CueList exerciseId={exercise.id} exerciseName={exercise.name} cues={summary.data.cues} />}
      {focus && !entry.done && <DoneButton name={exercise.name} onDone={() => onChange({ ...entry, done: true })} />}
      {celebrate && streak && (
        celebrate.kind === "up"
          ? <Celebration up scheme={celebrate.scheme} load={exercise.load} times={1} goal={streak.goal} onClose={() => setCelebrate(null)} />
          : <Celebration scheme={streak.scheme} load={exercise.load} times={streak.times + 1} goal={streak.goal} onClose={() => setCelebrate(null)} />
      )}
    </article>
  );
}

/** Folds the exercise away so the next one gets the screen. */
function DoneButton({ name, onDone }: { name: string; onDone: () => void }) {
  return (
    <button type="button" onClick={onDone}
      className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-stone-300 py-3 font-semibold text-stone-800">
      <Check size={20} weight="bold" aria-hidden /> Done with {name}
    </button>
  );
}

/**
 * The warm-up (Sergio, 2026-11-05: every workout starts with one, and its time counts): its time
 * runs from the start of the workout until "Done warming up", then it can be adjusted.
 */
function WarmUpLog({ entry, startedAt, onChange, onSetLogged, focus }: {
  entry: Entry; startedAt?: string; onChange: (e: Entry) => void; onSetLogged: (label: string) => void; focus?: boolean;
}) {
  const [, tick] = useState(0);
  const running = entry.minutes === undefined && startedAt !== undefined;
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  if (running) {
    const seconds = secondsBetween(startedAt);
    return (
      <div className="mt-2">
        <p className="font-display text-5xl font-semibold tabular-nums">{formatDuration(seconds)}</p>
        <p className="text-sm text-stone-500">Take your time: it counts.</p>
        <button type="button"
          onClick={() => {
            onChange({ ...entry, minutes: Math.max(1, Math.round(seconds / 60)), ...(focus ? { done: true } : {}) });
            onSetLogged("Warm-up");
          }}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-lg font-semibold text-white">
          <Check size={22} weight="bold" aria-hidden /> Done warming up
        </button>
      </div>
    );
  }
  return (
    <div className="mt-3 space-y-3">
      <Stepper layout="row" label="Time" unit="minutes" value={Math.round(entry.minutes ?? 0)} step={1}
        onChange={(m) => onChange({ ...entry, minutes: m })} />
      {focus && !entry.done && <DoneButton name="the warm-up" onDone={() => onChange({ ...entry, done: true })} />}
    </div>
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
export function TargetGame({ streak, load, today }: { streak: Streak; load: Exercise["load"]; today: SetData[] }) {
  const reachedToday = today.length > 0 && reachesTarget(today, streak.scheme);
  const done = streak.times >= streak.goal;
  return (
    <div className="mt-2 flex items-center gap-3 rounded-xl bg-blue-50 px-3 py-2 text-blue-900">
      <SetGlyph sets={streak.scheme.sets} max={Math.max(...streak.scheme.sets)} color="var(--color-blue-600)" />
      <div className="min-w-0 flex-1">
        <div className="font-display text-xl font-semibold">Target {schemeText(streak.scheme, load)}</div>
        <div className="text-xs">
          {done ? `${streak.times} in a row: ${goUpText(streak.scheme, streak.style ?? "heavy", load)}` : `${streak.times} of ${streak.goal} in a row`}
          {reachedToday && <span className="font-semibold"> · reached today</span>}
        </div>
      </div>
      <GameDots times={streak.times + (reachedToday && !done ? 1 : 0)} goal={streak.goal} />
      <InfoTip title="Target">
        {streak.style === "reps"
          ? "Hit these sets 3 sessions in a row, then one more rep: 3x6 up to 3x10, then more weight. A miss takes one away."
          : "Hit these sets 3 sessions in a row, then go up: 3x2, 4x2, 5x2, 3x3 ... up to 5x5, then more weight. A miss takes one away."}
      </InfoTip>
    </div>
  );
}

// ------------------------------------------------------------------ lifting


/** The weight stepper's step: the exercise's own, else 2.5 for dumbbells and 5 for the rest. */
export function weightStep(exercise: Pick<Exercise, "load" | "stepLb">): number {
  return exercise.stepLb ?? (exercise.load === "dumbbell" ? 2.5 : 5);
}

/**
 * The weight step, 2.5 or 5 lb, as a small switch under the Weight label, next to the − and + it
 * changes (Sergio, 2026-11-19; clearer 11-23: the "use 2.5" link wasn't obvious). It changes at
 * once and is kept for the exercise next time.
 */
function StepSwitch({ exercise, step, onStep }: { exercise: Exercise; step: number; onStep: (step: number) => void }) {
  const update = useUpdateExercise();
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[0.65rem] font-medium tracking-wide text-stone-500 uppercase">Step</span>
      <div role="radiogroup" aria-label="Weight step in lb" className="flex rounded-md bg-stone-100 p-0.5">
        {[2.5, 5].map((s) => (
          <button key={s} type="button" role="radio" aria-checked={step === s}
            onClick={() => {
              if (step === s) return;
              onStep(s);
              update.mutate({ id: exercise.id, patch: { stepLb: s } });
            }}
            className={`rounded px-2.5 py-1 text-sm font-semibold tabular-nums ${step === s ? "bg-blue-600 text-[#f6f1e7]" : "text-stone-500"}`}>
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function SetLog({ entry, exercise, draftKey, lastSets, bestDrop, target, onChange, onSetLogged, onLogged }: {
  entry: Entry; exercise: Exercise; draftKey: string; lastSets?: SetData[]; bestDrop?: { date: string; sets: SetData[] }; target?: Scheme;
  onChange: (e: Entry) => void; onSetLogged: (label: string) => void;
  /** A set was saved: the sets before and after, to judge the congrats. */
  onLogged?: (before: SetData[], after: SetData[]) => void;
}) {
  const sets = entry.sets ?? [];
  const [editing, setEditing] = useState<number | null>(null);
  // What was dialed in before switching screens comes back; otherwise the suggestion.
  const kept = useRef(loadDraft(draftKey, sets.length));
  const [draft, setDraft] = useState<SetData>(() => kept.current ?? nextSet(sets, lastSets, exercise, target));
  const [dropOpen, setDropOpen] = useState(false);
  const hasWeight = exercise.load !== "bodyweight" && exercise.load !== "none";
  const seconds = exercise.measure === "seconds";
  // The step shown at once on a tap; the exercise's saved one otherwise.
  const [stepPicked, setStep] = useState<number | null>(null);
  const step = stepPicked ?? weightStep(exercise);

  // When "last time" arrives (or a set is logged), suggest the next set, unless Sergio already dialed one in.
  useEffect(() => {
    if (editing === null && !kept.current) setDraft(nextSet(sets, lastSets, exercise, target));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastSets, target, sets.length, editing]);

  /** A stepper changed the set: keep it on the phone until it's logged. */
  function dial(next: SetData) {
    setDraft(next);
    if (editing !== null) return;
    kept.current = next;
    saveDraft(draftKey, next, sets.length);
  }

  function save() {
    const next = [...sets];
    if (editing === null) {
      next.push(draft);
      kept.current = null;
      clearDraft(draftKey);
    } else next[editing] = { ...next[editing], ...draft };
    // Save the set first, then start the lap (the lap builds on the saved workout).
    onChange({ ...entry, sets: next });
    if (editing === null) onSetLogged(`Set ${next.length} · ${exercise.name}`);
    if (target && editing === null) onLogged?.(sets, next);
    setEditing(null);
  }

  function remove(index: number) {
    onChange({ ...entry, sets: sets.filter((_, i) => i !== index) });
    setEditing(null);
  }

  const weightUnit =
    exercise.load === "barbell" ? `lbs plates + ${exercise.barLb} bar`
      : exercise.load === "added" ? "lb added (0 = body weight)"
        : draft.each ? "lbs each hand" : "lbs";

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
              onChange={(weightLb) => dial({ ...draft, weightLb })}
              step={step}
              unit={weightUnit}
              decimals
              extra={<StepSwitch exercise={exercise} step={step} onStep={setStep} />}
            />
          )}
          <Stepper
            layout="row"
            label={seconds ? "Seconds" : "Reps"}
            value={(seconds ? draft.seconds : draft.reps) ?? 0}
            onChange={(v) => dial(seconds ? { ...draft, seconds: v } : { ...draft, reps: v })}
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

function RunLog({ entry, exercise, onChange }: { entry: Entry; exercise: Exercise; onChange: (e: Entry) => void }) {
  const segments = entry.segments ?? [];
  const minutes = entry.minutes ?? segments.reduce((sum, s) => sum + s.minutes, 0);
  return (
    <div className="mt-3 space-y-2 rounded-xl border border-stone-200 p-3">
      <Stepper layout="row" label="Distance" unit="miles" value={entry.distanceMi ?? 0} step={0.25} decimals
        onChange={(distanceMi) => onChange({ ...entry, distanceMi })} />
      <Stepper layout="row" label="Time" unit="minutes" value={Math.round(minutes)} step={1}
        onChange={(m) => onChange({ ...entry, minutes: m })} />
      {exercise.id.startsWith("peloton") && <PelotonScreenshot entry={entry} onChange={onChange} />}
    </div>
  );
}

/**
 * A Peloton class is its summary screenshot (Sergio, 2026-11-17: no typing). The photo is attached
 * right away; then the stats are read from it (in demos too: visitors get the same app) and fill in the
 * distance and time when those are still empty.
 */
function PelotonScreenshot({ entry, onChange }: { entry: Entry; onChange: (e: Entry) => void }) {
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The card may re-render while the screenshot is read: build on its latest version.
  const latest = useRef({ entry, onChange });
  latest.current = { entry, onChange };
  const stats = entry.peloton;

  async function added(photo: Photo) {
    // A record of the ride, kept apart from the setup photos (Sergio, 2026-11-17).
    const withPhoto = { ...latest.current.entry, photos: [...(latest.current.entry.photos ?? []), { ...photo, kind: "screenshot" as const }] };
    latest.current.onChange(withPhoto);
    setReading(true);
    setError(null);
    try {
      const read = await api.readPeloton(photo.key);
      const now = latest.current.entry;
      latest.current.onChange({
        ...now,
        peloton: read,
        distanceMi: now.distanceMi || read.distanceMi,
        minutes: now.minutes || read.minutes,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read the screenshot; the photo is saved");
    } finally {
      setReading(false);
    }
  }

  return (
    <div className="space-y-2 border-t border-stone-200 pt-2">
      {stats && (
        <div>
          {(stats.title || stats.instructor) && (
            <p className="text-sm"><span className="font-semibold">{stats.title}</span>{stats.instructor ? ` · ${stats.instructor}` : ""}</p>
          )}
          <dl className="mt-1.5 grid grid-cols-3 gap-x-3 gap-y-1.5">
            {pelotonStats(stats).map((s) => (
              <div key={s.label}>
                <dt className="text-[11px] font-medium tracking-wide text-stone-500 uppercase">{s.label}</dt>
                <dd className="font-display text-lg font-semibold tabular-nums">{s.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      {reading ? (
        <p className="flex items-center gap-2 py-1 text-sm text-stone-600" role="status">
          <CircleNotch size={16} className="animate-spin" aria-hidden /> Reading the screenshot...
        </p>
      ) : (
        <PhotoButton label={stats ? "Add another screenshot" : "Add the Peloton screenshot"} onAdded={(p) => void added(p)} />
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

// ------------------------------------------------------------------ notes and photos for this exercise today

/** A quiet row of tools under the sets: a note or photo for today, and the setup photos taken
 * before (folded). A new note goes through the cue check, which may suggest updating the cues. */
function EntryNotes({ entry, exercise, cues, setupPhotos, onChange }: {
  entry: Entry; exercise: Exercise; cues: Note[]; setupPhotos: (Photo & { date: string })[]; onChange: (e: Entry) => void;
}) {
  const [writing, setWriting] = useState(false);
  const [photosOpen, setPhotosOpen] = useState(false);
  const [text, setText] = useState("");
  const [checking, setChecking] = useState<string | null>(null);
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
      {checking && <CueCheckCard exercise={exercise} cues={cues} note={checking} onDone={() => setChecking(null)} />}
      {writing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) {
              onChange({ ...entry, notes: [...notes, text.trim()] });
              setChecking(text.trim());
            }
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
        <div className="flex flex-wrap items-center gap-1">
          <button type="button" onClick={() => setWriting(true)}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-stone-600 active:bg-stone-100">
            <NotePencil size={18} weight="fill" aria-hidden /> Note
          </button>
          <PhotoButton onAdded={(p) => onChange({ ...entry, photos: [...photos, p] })} />
          {setupPhotos.length > 0 && (
            <button type="button" onClick={() => setPhotosOpen(!photosOpen)} aria-expanded={photosOpen}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-stone-600 active:bg-stone-100">
              <Images size={18} weight="fill" aria-hidden /> Setup photos ({setupPhotos.length})
              <CaretDown size={12} className={photosOpen ? "rotate-180" : ""} aria-hidden />
            </button>
          )}
        </div>
      )}
      {photosOpen && <PhotoStrip photos={setupPhotos.map((p) => ({ ...p, caption: p.caption ?? friendlyDate(p.date) }))} />}
    </div>
  );
}

const SECTION_NAMES: Record<CueSection, string> = { setup: "Setup", brace: "Brace & breathe", lift: "Lift" };

/** Asks the cue check about a note just written and offers its suggestion: add a cue or reword
 * one. Shows nothing when there's nothing to change or the check is off. */
function CueCheckCard({ exercise, cues, note, onDone }: { exercise: Exercise; cues: Note[]; note: string; onDone: () => void }) {
  const check = useQuery({
    queryKey: ["cue-check", exercise.id, note],
    queryFn: () => api.checkCue(exercise.id, note),
    retry: false,
    staleTime: Infinity,
  });
  const add = useAddNote();
  const update = useUpdateNote();
  const suggestion = check.data;
  const old = suggestion?.action === "update" ? cues.find((c) => c.id === suggestion.noteId) : undefined;

  if (check.isLoading) return <p className="mt-1 text-xs text-stone-400">Checking your cues...</p>;
  if (!suggestion || suggestion.action === "none" || !suggestion.text || (suggestion.action === "update" && !old)) return null;

  async function accept() {
    if (!suggestion?.text) return;
    if (old) await update.mutateAsync({ note: old, patch: { text: suggestion.text, ...(suggestion.section ? { section: suggestion.section } : {}) } });
    else await add.mutateAsync({ exerciseId: exercise.id, text: suggestion.text, date: localIso().slice(0, 10), section: suggestion.section ?? undefined });
    onDone();
  }

  return (
    <div className="mt-2 rounded-xl border border-stone-200 px-3 py-2 text-sm">
      <div className="flex items-center gap-1.5 text-xs font-medium text-stone-500">
        <Lightbulb size={14} weight="fill" aria-hidden />
        {old ? "Update a cue?" : "Add to Keep in mind?"}
        {suggestion.section && <span className="text-stone-400">· {SECTION_NAMES[suggestion.section]}</span>}
      </div>
      {old && <p className="mt-1 text-stone-400 line-through">{old.text}</p>}
      <p className="mt-0.5 text-stone-800">{suggestion.text}</p>
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={accept} disabled={add.isPending || update.isPending}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white">{old ? "Update" : "Add"}</button>
        <button type="button" onClick={onDone} className="rounded-lg px-3 py-1.5 text-sm font-medium text-stone-600">No thanks</button>
      </div>
    </div>
  );
}
