import { CaretDown, EyeSlash, Eye, Lightbulb, PencilSimple, Plus, Trash } from "@phosphor-icons/react";
import { useState, type FormEvent } from "react";

import type { CueSection, Note } from "../api";
import { useAddNote, useDeleteNote, useUpdateNote } from "../hooks";
import { friendlyDate, localIso } from "../lib/time";
import { SECTIONS, groupCues, orderCues } from "../lib/cues";
import { BottomSheet } from "./BottomSheet";

/**
 * The technique checklist on an exercise while training, quiet at the bottom of the card: the
 * most important cue of each section, the rest one tap away. Add a cue here; edit in the sheet.
 */
export function CueList({ exerciseId, exerciseName, cues }: { exerciseId: string; exerciseName: string; cues: Note[] }) {
  const [expanded, setExpanded] = useState(false);
  const [managing, setManaging] = useState(false);
  const [adding, setAdding] = useState(false);
  const groups = groupCues(cues.filter((c) => !c.hidden));
  const total = groups.reduce((n, g) => n + g.cues.length, 0);
  const shown = expanded ? groups : groups.map((g) => ({ ...g, cues: g.cues.slice(0, 1) }));

  return (
    <div className="mt-3 border-t border-stone-100 pt-2">
      <div className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-stone-400 uppercase">
        <Lightbulb size={14} weight="fill" aria-hidden />
        Keep in mind
        <button type="button" onClick={() => setManaging(true)} className="ml-auto rounded p-1 text-stone-400" aria-label={`Edit cues for ${exerciseName}`}>
          <PencilSimple size={16} weight="fill" aria-hidden />
        </button>
      </div>
      {total === 0 && !adding && <p className="py-1 text-sm text-stone-500">No cues yet. Add what helps you lift better.</p>}
      {shown.map((g) => (
        <div key={g.label ?? "all"} className="mt-1">
          {g.label && <div className="text-[11px] font-medium text-stone-400">{g.label}</div>}
          <ul className="list-disc space-y-0.5 pl-5 marker:text-stone-300">
            {g.cues.map((cue) => <li key={cue.id} className="text-sm leading-snug text-stone-600">{cue.text}</li>)}
          </ul>
        </div>
      ))}
      <div className="mt-1 flex items-center gap-3">
        {total > shown.reduce((n, g) => n + g.cues.length, 0) || expanded ? (
          <button type="button" onClick={() => setExpanded(!expanded)} className="flex items-center gap-1 py-1 text-xs font-medium text-stone-500">
            <CaretDown size={12} weight="bold" className={expanded ? "rotate-180" : ""} aria-hidden />
            {expanded ? "Only the key ones" : `All ${total}`}
          </button>
        ) : null}
        {!adding && (
          <button type="button" onClick={() => setAdding(true)} className="flex items-center gap-1 py-1 text-xs font-medium text-stone-500">
            <Plus size={12} weight="bold" aria-hidden /> Add cue
          </button>
        )}
      </div>
      {adding && <AddCue exerciseId={exerciseId} onDone={() => setAdding(false)} />}
      {managing && <CueSheet exerciseName={exerciseName} exerciseId={exerciseId} cues={cues} onClose={() => setManaging(false)} />}
    </div>
  );
}

function SectionSelect({ value, onChange }: { value: CueSection | undefined; onChange: (s: CueSection) => void }) {
  return (
    <select aria-label="Section" value={value ?? "lift"} onChange={(e) => onChange(e.target.value as CueSection)}
      className="rounded-lg border border-stone-200 bg-white px-2 py-2 text-sm">
      {SECTIONS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
    </select>
  );
}

function AddCue({ exerciseId, onDone }: { exerciseId: string; onDone: () => void }) {
  const add = useAddNote();
  const [text, setText] = useState("");
  const [section, setSection] = useState<CueSection>("lift");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (text.trim()) await add.mutateAsync({ exerciseId, text: text.trim(), date: localIso().slice(0, 10), section });
    onDone();
  }

  return (
    <form onSubmit={submit} className="mt-1 flex flex-wrap gap-2 pb-1">
      <input
        aria-label="New cue"
        placeholder="e.g. Hands firm on the grip"
        maxLength={300}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="min-w-0 flex-1 basis-40 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"
      />
      <SectionSelect value={section} onChange={setSection} />
      <button disabled={add.isPending} className="rounded-lg bg-blue-600 px-3 text-sm font-medium text-white">Save</button>
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

/** Every cue by section with edit / hide / delete, and a box to add one. */
export function CueManager({ exerciseId, cues }: { exerciseId: string; cues: Note[] }) {
  return (
    <>
      <p className="mb-2 text-sm text-stone-500">
        In the order they matter while training, most important first. Hidden cues stay in the log but don't show while
        training.
      </p>
      {cues.length === 0 && <p className="py-2 text-sm text-stone-500">No cues yet.</p>}
      {groupCues(cues).map((g) => (
        <section key={g.label ?? "all"}>
          {g.label && <h3 className="mt-2 text-xs font-semibold tracking-wide text-stone-500 uppercase">{g.label}</h3>}
          <ul className="divide-y divide-stone-100">
            {g.cues.map((cue) => <CueRow key={cue.id} cue={cue} />)}
          </ul>
        </section>
      ))}
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
  const [section, setSection] = useState<CueSection>(cue.section ?? "lift");

  if (editing) {
    return (
      <li className="py-2">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const patch = {
              ...(text.trim() && text.trim() !== cue.text ? { text: text.trim() } : {}),
              ...(section !== cue.section ? { section } : {}),
            };
            if (Object.keys(patch).length) await update.mutateAsync({ note: cue, patch });
            setEditing(false);
          }}
          className="flex flex-wrap gap-2"
        >
          <input aria-label="Cue" value={text} onChange={(e) => setText(e.target.value)} maxLength={300}
            className="min-w-0 flex-1 basis-40 rounded-lg border border-stone-200 px-3 py-2 text-sm" />
          <SectionSelect value={section} onChange={setSection} />
          <button className="rounded-lg bg-blue-600 px-3 text-sm font-medium text-white">Save</button>
        </form>
      </li>
    );
  }
  return (
    <li className={`flex items-start gap-2 py-2.5 ${cue.hidden ? "opacity-50" : ""}`}>
      <div className="flex-1">
        <p className="text-sm">{cue.text}</p>
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
