import { Backspace } from "@phosphor-icons/react";
import { useState } from "react";

import { useOwnerLogin, useRefreshSession, useSession } from "../hooks";
import { BottomSheet } from "./BottomSheet";

const LENGTH = 6;
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"];

/** Number pad for the owner's 6-digit passcode; submits as soon as 6 digits are entered. */
export function PasscodeSheet({ onClose }: { onClose: () => void }) {
  const [digits, setDigits] = useState("");
  const login = useOwnerLogin();
  const refreshSession = useRefreshSession();
  // After 3 wrong tries the server pauses owner login on this network (and hides the button).
  const paused = useSession().data?.ownerLoginEnabled === false;

  function press(key: string) {
    if (login.isPending || paused) return;
    if (key === "back") {
      setDigits((d) => d.slice(0, -1));
      return;
    }
    const next = (digits + key).slice(0, LENGTH);
    setDigits(next);
    if (next.length === LENGTH) {
      login.mutate(next, {
        onSuccess: onClose,
        onError: () => {
          setDigits("");
          refreshSession();
        },
      });
    } else {
      login.reset();
    }
  }

  return (
    <BottomSheet title="Welcome back" onClose={onClose}>
      <div className="mx-auto max-w-xs pb-2 text-center">
        <p className="text-stone-600">Enter your passcode</p>
        <div className="my-5 flex justify-center gap-4" aria-label={`${digits.length} of ${LENGTH} digits entered`}>
          {Array.from({ length: LENGTH }, (_, i) => (
            <span
              key={i}
              className={`h-4 w-4 rounded-full border-2 ${
                i < digits.length ? "border-blue-600 bg-blue-600" : "border-stone-300"
              }`}
            />
          ))}
        </div>
        <p className="mb-3 min-h-5 text-sm text-red-600" aria-live="assertive">
          {paused ? "Too many wrong passcodes. Owner login is paused here for up to an hour." : login.error?.message}
        </p>
        <div className="grid grid-cols-3 gap-3">
          {KEYS.map((key, i) =>
            key === "" ? (
              <span key={i} />
            ) : (
              <button
                key={i}
                type="button"
                onClick={() => press(key)}
                disabled={paused}
                aria-label={key === "back" ? "Delete digit" : key}
                className="flex h-16 items-center justify-center rounded-2xl bg-stone-100 text-2xl font-semibold text-stone-800 active:bg-stone-200 disabled:opacity-40"
              >
                {key === "back" ? <Backspace size={26} weight="fill" aria-hidden /> : key}
              </button>
            ),
          )}
        </div>
      </div>
    </BottomSheet>
  );
}
