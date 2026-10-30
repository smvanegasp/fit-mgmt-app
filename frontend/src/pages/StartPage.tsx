import { Barbell, Eye, SignIn } from "@phosphor-icons/react";
import { useState } from "react";

import { PasscodeSheet } from "../components/PasscodeSheet";
import { useSession, useStartGuest } from "../hooks";

/** The first screen without a session: look around (a private copy of the log) or log in.
 * Stage 5b turns this into the welcome page with Sergio's note and photo. */
export function StartPage() {
  const session = useSession().data;
  const start = useStartGuest();
  const [loggingIn, setLoggingIn] = useState(false);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-10">
      <Barbell size={40} weight="fill" className="text-blue-600" aria-hidden />
      <h1 className="mt-4 text-3xl font-semibold">Sergio's gym log</h1>
      <p className="mt-3 text-stone-600">
        Every workout since September 2025: consistency, strength over time, technique notes and photos. Look around in
        your own private copy: try logging a workout, nothing you change reaches the real log.
      </p>
      <button type="button" onClick={() => start.mutate()} disabled={start.isPending}
        className="mt-8 inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 text-lg font-semibold text-white active:bg-blue-700">
        <Eye size={22} weight="fill" aria-hidden /> Look around
      </button>
      {start.error && <p className="mt-2 text-sm text-red-600">{start.error.message}</p>}
      {session?.ownerLoginEnabled && (
        <button type="button" onClick={() => setLoggingIn(true)}
          className="mt-3 inline-flex items-center justify-center gap-2 rounded-2xl py-3 font-medium text-stone-700 ring-1 ring-stone-200">
          <SignIn size={20} weight="fill" aria-hidden /> I'm Sergio
        </button>
      )}
      {loggingIn && <PasscodeSheet onClose={() => setLoggingIn(false)} />}
    </main>
  );
}
