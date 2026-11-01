import { ChatCircleText, Check, Desktop, Moon, SignOut, Sun, type Icon } from "@phosphor-icons/react";
import { useState } from "react";

import { FeedbackSheet } from "../components/FeedbackSheet";
import { useFeedback, useLogout, useMarkFeedback, useSession } from "../hooks";
import { friendlyDate } from "../lib/time";
import { useTheme, type Theme } from "../lib/theme";

export function SettingsPage() {
  return (
    <div className="space-y-4 pb-24">
      <FeedbackSettings />
      <AppearanceSettings />
      <Account />
    </div>
  );
}

const THEMES: { value: Theme; label: string; icon: Icon }[] = [
  { value: "system", label: "Automatic", icon: Desktop },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

function AppearanceSettings() {
  const [theme, setTheme] = useTheme();
  return (
    <section className="rounded-xl border border-stone-200 bg-white p-4">
      <h2 className="text-lg font-semibold">Appearance</h2>
      <p className="mb-3 text-sm text-stone-500">Automatic follows your phone's light or dark setting.</p>
      <div className="grid grid-cols-3 gap-1 rounded-lg bg-stone-100 p-1" role="radiogroup" aria-label="Appearance">
        {THEMES.map((t) => (
          <button
            key={t.value}
            type="button"
            role="radio"
            aria-checked={theme === t.value}
            onClick={() => setTheme(t.value)}
            className={`flex items-center justify-center gap-1.5 rounded-md py-2 text-sm font-medium ${
              theme === t.value ? "bg-white shadow-sm" : "text-stone-500"
            }`}
          >
            <t.icon size={16} weight="fill" aria-hidden /> {t.label}
          </button>
        ))}
      </div>
    </section>
  );
}

/** Log out (the owner) or leave the demo (a guest; the copy stays until it expires). */
function Account() {
  const session = useSession().data;
  const logout = useLogout();
  if (!session?.role) return null;
  const owner = session.role === "owner";
  return (
    <section className="rounded-xl border border-stone-200 bg-white p-4">
      <h2 className="text-lg font-semibold">{owner ? "Account" : "Demo"}</h2>
      <p className="mb-3 text-sm text-stone-500">
        {owner ? "You're logged in as Sergio on this device." : "You're looking at a private copy of Sergio's log."}
      </p>
      <button type="button" onClick={() => logout.mutate()} disabled={logout.isPending}
        className="flex items-center gap-2 rounded-lg px-3 py-2 font-medium text-stone-700 ring-1 ring-stone-200">
        <SignOut size={18} weight="fill" aria-hidden /> {owner ? "Log out" : "Leave the demo"}
      </button>
    </section>
  );
}

/** Send feedback (everyone); the owner also sees the inbox, newest first. */
function FeedbackSettings() {
  const session = useSession().data;
  const owner = session?.role === "owner";
  const inbox = useFeedback(owner);
  const mark = useMarkFeedback();
  const [writing, setWriting] = useState(false);
  const fresh = (inbox.data ?? []).filter((f) => f.status === "new").length;
  return (
    <section className="rounded-xl border border-stone-200 bg-white p-4">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        Feedback
        {owner && fresh > 0 && <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs font-semibold text-white">{fresh} new</span>}
      </h2>
      <p className="mb-3 text-sm text-stone-500">
        {owner ? "Notes for the next round of changes, yours and your guests'." : "Something confusing, broken or missing? Sergio reads every note."}
      </p>
      <button type="button" onClick={() => setWriting(true)}
        className="flex items-center gap-2 rounded-lg px-3 py-2 font-medium text-stone-700 ring-1 ring-stone-200">
        <ChatCircleText size={18} weight="fill" aria-hidden /> Send feedback
      </button>
      {owner && (inbox.data ?? []).length > 0 && (
        <ul className="mt-4 divide-y divide-stone-100">
          {inbox.data!.map((f) => (
            <li key={f.id} className={`flex items-start gap-2 py-2.5 ${f.status === "done" ? "opacity-50" : ""}`}>
              <div className="min-w-0 flex-1">
                <p className="text-sm whitespace-pre-wrap">{f.text}</p>
                <p className="text-xs text-stone-500">
                  {friendlyDate(f.createdAt.slice(0, 10))} · {f.role === "guest" ? "a guest" : "you"}{f.page ? ` · ${f.page}` : ""}
                </p>
              </div>
              <button type="button" onClick={() => mark.mutate({ id: f.id, status: f.status === "new" ? "done" : "new" })}
                className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-stone-600 ring-1 ring-stone-200"
                aria-label={f.status === "new" ? "Mark done" : "Mark new"}>
                {f.status === "new" ? <span className="inline-flex items-center gap-1"><Check size={12} weight="bold" aria-hidden /> Done</span> : "Reopen"}
              </button>
            </li>
          ))}
        </ul>
      )}
      {writing && <FeedbackSheet onClose={() => setWriting(false)} />}
    </section>
  );
}
