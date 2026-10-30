import { CaretDown, EyeSlash, Eye, Lightbulb, PencilSimple, Plus, Trash } from "@phosphor-icons/react";
import { useState, type FormEvent } from "react";

import type { Note } from "../api";
import { useAddNote, useDeleteNote, useUpdateNote } from "../hooks";
import { friendlyDate, localIso } from "../lib/time";
import { BottomSheet } from "./BottomSheet";

const SHOWN = 3;

/** Most useful first: cues repeated in many sessions, then the newest. */
export function orderCues(cues: Note[]): Note[] {
  return [...cues].sort((a, b) => b.sessions - a.sessions || (b.lastSeen ?? b.date).localeCompare(a.lastSeen ?? a.date));
}

/**
 * The technique checklist shown when an exercise is added: one line per cue, the top three,
 * the rest one tap away. Add a cue right here; edit or hide in the sheet.
 */
export function CueList({ exerciseId, exerciseName, cues }: { exerciseId: string; exerciseName: string; cues: Note[] }) {
  const [expanded, setExpanded] = useState(false);
  const [managing, setManaging] = useState(false);
  const [adding, setAdding] = useState(false);
  const visible = orderCues(cues.filter((c) => !c.hidden));
  const shown = expanded ? visible : visible.slice(0, SHOWN);

  return (
    <div className="mt-2 rounded-xl bg-amber-50 px-3 py-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-amber-800 uppercase">
        <Lightbulb size={14} weight="fill" aria-hidden />
        Keep in mind
        <button type="button" onClick={() => setManaging(true)} className="ml-auto rounded p-1 text-amber-800" aria-label={`Edit cues for ${exerciseName}`}>
          <PencilSimple size={16} weight="fill" aria-hidden />
        </button>
      </div>
      {shown.length === 0 && !adding && <p className="py-1 text-sm text-amber-900/70">No cues yet. Add what helps you lift better.</p>}
      <ul className="list-disc space-y-1 py-1 pl-5 marker:text-amber-600">
        {shown.map((cue) => (
          <li key={cue.id} className="text-sm leading-snug text-amber-950">
            {cue.text}
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-3 pb-1">
        {visible.length > SHOWN && (
          <button type="button" onClick={() => setExpanded(!expanded)} className="flex items-center gap-1 text-sm font-medium text-amber-800">
            <CaretDown size={14} weight="bold" className={expanded ? "rotate-180" : ""} aria-hidden />
            {expanded ? "Less" : `${visible.length - SHOWN} more`}
          </button>
        )}
        {!adding && (
          <button type="button" onClick={() => setAdding(true)} className="flex items-center gap-1 text-sm font-medium text-amber-800">
            <Plus size={14} weight="bold" aria-hidden /> Add cue
          </button>
        )}
      </div>
      {adding && <AddCue exerciseId={exerciseId} onDone={() => setAdding(false)} />}
      {managing && <CueSheet exerciseName={exerciseName} exerciseId={exerciseId} cues={cues} onClose={() => setManaging(false)} />}
    </div>
  );
}

function AddCue({ exerciseId, onDone }: { exerciseId: string; onDone: () => void }) {
  const add = useAddNote();
  const [text, setText] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (text.trim()) await add.mutateAsync({ exerciseId, text: text.trim(), date: localIso().slice(0, 10) });
    onDone();
  }

  return (
    <form onSubmit={submit} className="flex gap-2 pb-1">
      <input
        aria-label="New cue"
        placeholder="e.g. Manos firmes en el agarre"
        maxLength={300}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="min-w-0 flex-1 rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm"
      />
      <button disabled={add.isPending} className="rounded-lg bg-amber-600 px-3 text-sm font-medium text-white">Save</button>
    </form>
  );
}

function CueSheet({ exerciseName, exerciseId, cues, onClose }: { exerciseName: string; exerciseId: string; cues: Note[]; onClose: () => void }) {
  return (
    <BottomSheet title={`Cues: ${exerciseName}`} onClose={onClose}>
      <CueManager exerciseId={exerciseId} cues={cues} />
    </BottomSheet>
  );
}

/** Every cue with edit / hide / delete, and a box to add one. */
export function CueManager({ exerciseId, cues }: { exerciseId: string; cues: Note[] }) {
  return (
    <>
      <p className="mb-2 text-sm text-stone-500">
        Hidden cues stay in the log but don't show while training. The most repeated come first.
      </p>
      {cues.length === 0 && <p className="py-2 text-sm text-stone-500">No cues yet.</p>}
      <ul className="divide-y divide-stone-100">
        {orderCues(cues).map((cue) => <CueRow key={cue.id} cue={cue} />)}
      </ul>
      <div className="mt-3">
        <AddCue exerciseId={exerciseId} onDone={() => undefined} />
      </div>
    </>
  );
}

function CueRow({ cue }: { cue: Note }) {
  const update = useUpdateNote();
  const remove = useDeleteNote();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(cue.text);

  if (editing) {
    return (
      <li className="py-2">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (text.trim() && text.trim() !== cue.text) await update.mutateAsync({ note: cue, patch: { text: text.trim() } });
            setEditing(false);
          }}
          className="flex gap-2"
        >
          <input aria-label="Cue" value={text} onChange={(e) => setText(e.target.value)} maxLength={300}
            className="min-w-0 flex-1 rounded-lg border border-stone-200 px-3 py-2 text-sm" />
          <button className="rounded-lg bg-blue-600 px-3 text-sm font-medium text-white">Save</button>
        </form>
      </li>
    );
  }
  return (
    <li className={`flex items-start gap-2 py-2.5 ${cue.hidden ? "opacity-50" : ""}`}>
      <div className="flex-1">
        <p className="text-sm">{cue.text}</p>
        {cue.original && <p className="text-xs text-stone-500 italic">“{cue.original}”</p>}
        <p className="text-xs text-stone-500">
          Since {friendlyDate(cue.date)}
          {cue.sessions > 1 ? ` · written in ${cue.sessions} sessions` : ""}
        </p>
      </div>
      <button type="button" onClick={() => setEditing(true)} className="rounded p-1.5 text-stone-500" aria-label="Edit cue">
        <PencilSimple size={18} weight="fill" aria-hidden />
      </button>
      <button type="button" onClick={() => update.mutate({ note: cue, patch: { hidden: !cue.hidden } })}
        className="rounded p-1.5 text-stone-500" aria-label={cue.hidden ? "Show cue" : "Hide cue"}>
        {cue.hidden ? <Eye size={18} weight="fill" aria-hidden /> : <EyeSlash size={18} weight="fill" aria-hidden />}
      </button>
      {cue.source === "app" && (
        <button type="button" onClick={() => remove.mutate(cue)} className="rounded p-1.5 text-red-600" aria-label="Delete cue">
          <Trash size={18} weight="fill" aria-hidden />
        </button>
      )}
    </li>
  );
}
