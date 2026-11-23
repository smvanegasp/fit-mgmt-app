import { CheckCircle, PencilSimple } from "@phosphor-icons/react";
import { useState } from "react";

import type { Feedback, Photo } from "../api";
import { useEditFeedback, useSendFeedback } from "../hooks";
import { PLACES, lastPlace, type Place } from "../lib/place";
import { BottomSheet } from "./BottomSheet";
import { PhotoButton, PhotoStrip } from "./Photos";

const MAX_SCREENSHOTS = 3;

/**
 * Leave feedback (owner or guest): what it's about (the last screen, preselected), a note and up
 * to three screenshots (Sergio, 2026-11-21). Once sent, the text can still be fixed.
 */
export function FeedbackSheet({ onClose }: { onClose: () => void }) {
  const send = useSendFeedback();
  const edit = useEditFeedback();
  const [place, setPlace] = useState<Place>(lastPlace());
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [sent, setSent] = useState<Feedback | null>(null);
  const [editing, setEditing] = useState(false);

  if (sent && !editing) {
    return (
      <BottomSheet title="Feedback" onClose={onClose}>
        <div className="py-6 text-center">
          <CheckCircle size={40} weight="fill" className="mx-auto text-blue-600" aria-hidden />
          <p className="mt-2 font-semibold">Thanks! Sergio will read it.</p>
          <div className="mt-4 flex justify-center gap-2">
            <button type="button" onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 rounded-xl px-4 py-2 font-medium text-stone-600 ring-1 ring-stone-200">
              <PencilSimple size={16} weight="fill" aria-hidden /> Edit
            </button>
            <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 font-medium text-blue-700">Close</button>
          </div>
        </div>
      </BottomSheet>
    );
  }

  const busy = send.isPending || edit.isPending;
  const error = send.error ?? edit.error;

  return (
    <BottomSheet title={editing ? "Edit feedback" : "Feedback"} onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!text.trim()) return;
          if (sent) {
            setSent(await edit.mutateAsync({ id: sent.id, text: text.trim() }));
            setEditing(false);
          } else {
            setSent(await send.mutateAsync({ text: text.trim(), page: place, photos: photos.map((p) => p.key) }));
          }
        }}
      >
        {!sent && (
          <>
            <p className="text-sm text-stone-600">What would make the app better? Anything that confused you, broke, or is missing.</p>
            <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none]" role="radiogroup" aria-label="About which screen">
              {PLACES.map((p) => (
                <button key={p} type="button" role="radio" aria-checked={place === p} onClick={() => setPlace(p)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${place === p ? "bg-blue-600 text-white" : "bg-white text-stone-700 ring-1 ring-stone-200"}`}>
                  {p}
                </button>
              ))}
            </div>
          </>
        )}
        <textarea
          aria-label="Your feedback"
          autoFocus
          rows={5}
          maxLength={2000}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. I couldn't find where to add a drop set"
          className="mt-3 w-full rounded-xl border border-stone-200 bg-white px-3 py-2"
        />
        {!sent && (
          <div className="flex items-center gap-2">
            <PhotoStrip photos={photos} onRemove={(p) => setPhotos(photos.filter((x) => x.key !== p.key))} />
            {photos.length < MAX_SCREENSHOTS && (
              <PhotoButton label="Screenshot" onAdded={(p) => setPhotos((now) => [...now, { ...p, kind: "screenshot" }])} />
            )}
          </div>
        )}
        {error && <p className="mt-1 text-sm text-red-600">{error.message}</p>}
        <button type="submit" disabled={!text.trim() || busy}
          className="mt-3 w-full rounded-xl bg-blue-600 py-3 font-semibold text-white disabled:opacity-50">
          {busy ? "Sending…" : sent ? "Save" : "Send"}
        </button>
      </form>
    </BottomSheet>
  );
}
