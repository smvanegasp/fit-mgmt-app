import { CheckCircle } from "@phosphor-icons/react";
import { useState } from "react";

import { useSendFeedback } from "../hooks";
import { PLACES, lastPlace, type Place } from "../lib/place";
import { BottomSheet } from "./BottomSheet";

/** Leave feedback (owner or guest): what it's about (the last screen, preselected) and a note. */
export function FeedbackSheet({ onClose }: { onClose: () => void }) {
  const send = useSendFeedback();
  const [place, setPlace] = useState<Place>(lastPlace());
  const [text, setText] = useState("");

  return (
    <BottomSheet title="Feedback" onClose={onClose}>
      {send.isSuccess ? (
        <div className="py-6 text-center">
          <CheckCircle size={40} weight="fill" className="mx-auto text-blue-600" aria-hidden />
          <p className="mt-2 font-semibold">Thanks! Sergio will read it.</p>
          <button type="button" onClick={onClose} className="mt-4 rounded-xl px-4 py-2 font-medium text-blue-700">Close</button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) send.mutate({ text: text.trim(), page: place });
          }}
        >
          <p className="text-sm text-stone-600">What would make the app better? Anything that confused you, broke, or is missing.</p>
          <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none]" role="radiogroup" aria-label="About which screen">
            {PLACES.map((p) => (
              <button key={p} type="button" role="radio" aria-checked={place === p} onClick={() => setPlace(p)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${place === p ? "bg-blue-600 text-white" : "bg-white text-stone-700 ring-1 ring-stone-200"}`}>
                {p}
              </button>
            ))}
          </div>
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
          {send.error && <p className="mt-1 text-sm text-red-600">{send.error.message}</p>}
          <button type="submit" disabled={!text.trim() || send.isPending}
            className="mt-3 w-full rounded-xl bg-blue-600 py-3 font-semibold text-white disabled:opacity-50">
            {send.isPending ? "Sending…" : "Send"}
          </button>
        </form>
      )}
    </BottomSheet>
  );
}
