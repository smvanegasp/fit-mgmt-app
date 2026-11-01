import { ArrowCounterClockwise, ChatCircleText, SignIn } from "@phosphor-icons/react";
import { useState } from "react";

import { useResetGuest } from "../hooks";
import { FeedbackSheet } from "./FeedbackSheet";
import { InfoTip } from "./InfoTip";
import { PasscodeSheet } from "./PasscodeSheet";

function timeLeft(expiresAt: number): string {
  const hours = Math.max(0, Math.round((expiresAt * 1000 - Date.now()) / 3_600_000));
  return hours >= 1 ? `${hours}h` : "<1h";
}

/** Shown to guests: they're in a private sandbox, with ways to reset or log in. */
export function DemoBanner({ expiresAt, ownerLoginEnabled }: { expiresAt: number; ownerLoginEnabled: boolean }) {
  const reset = useResetGuest();
  const [loggingIn, setLoggingIn] = useState(false);
  const [feedback, setFeedback] = useState(false);

  function confirmReset() {
    if (confirm("Start the demo over? Your changes will be replaced with a fresh copy.")) reset.mutate();
  }

  return (
    <div
      data-demo-banner
      className="mb-4 flex items-center gap-1 rounded-xl bg-sky-50 px-2.5 py-1.5 text-sm text-sky-900"
    >
      <span className="flex min-w-0 flex-1 items-center gap-1">
        <span className="truncate">Demo · {timeLeft(expiresAt)}</span>
        <InfoTip title="Demo mode">
          You're looking at a private copy of Sergio's real training log. Log a workout, edit
          anything you like: nobody else sees it, and it's deleted after 24 hours. Reset starts over
          from a fresh copy.
        </InfoTip>
      </span>
      <button
        type="button"
        onClick={confirmReset}
        disabled={reset.isPending}
        aria-label="Reset the demo"
        title="Reset the demo"
        className="inline-flex shrink-0 items-center rounded-lg p-1.5 text-sky-800 active:bg-sky-100"
      >
        <ArrowCounterClockwise size={16} weight="bold" aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => setFeedback(true)}
        className="inline-flex shrink-0 items-center gap-1 rounded-lg px-1.5 py-1 font-medium text-sky-800 active:bg-sky-100"
      >
        <ChatCircleText size={14} weight="bold" aria-hidden /> Feedback
      </button>
      {ownerLoginEnabled && (
        <button
          type="button"
          onClick={() => setLoggingIn(true)}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg px-1.5 py-1 font-medium text-sky-800 active:bg-sky-100"
        >
          <SignIn size={14} weight="bold" aria-hidden /> Log in
        </button>
      )}
      {loggingIn && <PasscodeSheet onClose={() => setLoggingIn(false)} />}
      {feedback && <FeedbackSheet onClose={() => setFeedback(false)} />}
    </div>
  );
}
