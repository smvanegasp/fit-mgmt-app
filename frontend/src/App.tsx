import { Barbell, ChartLineUp, ClockCounterClockwise, GearSix, type Icon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

import { SESSION_EXPIRED, type SessionInfo } from "./api";
import { DemoBanner } from "./components/DemoBanner";
import { NavContext, type Tab } from "./components/Nav";
import { ScreensProvider } from "./components/Screens";
import { DESKTOP, useRefreshSession, useSession } from "./hooks";
import { HistoryPage } from "./pages/HistoryPage";
import { ProgressPage } from "./pages/ProgressPage";
import { SettingsPage } from "./pages/SettingsPage";
import { WelcomePage } from "./pages/WelcomePage";
import { TrainPage } from "./pages/TrainPage";

const TABS: readonly { id: Tab; label: string; icon: Icon }[] = [
  { id: "train", label: "Train", icon: Barbell },
  { id: "history", label: "History", icon: ClockCounterClockwise },
  { id: "progress", label: "Progress", icon: ChartLineUp },
  { id: "settings", label: "Settings", icon: GearSix },
];

const PAGES: Record<Tab, () => React.JSX.Element | null> = {
  train: TrainPage,
  history: HistoryPage,
  progress: ProgressPage,
  settings: SettingsPage,
};

// On a computer, History and Progress use the width; Train and Settings stay one column.
const WIDE: Record<Tab, string> = {
  train: "lg:max-w-lg",
  history: "lg:max-w-5xl",
  progress: "lg:max-w-6xl",
  settings: "lg:max-w-lg",
};

export function App() {
  const session = useSession();
  const refresh = useRefreshSession();

  // A 401 from any request means the session ended (e.g. the demo expired): check it again.
  useEffect(() => {
    window.addEventListener(SESSION_EXPIRED, refresh);
    return () => window.removeEventListener(SESSION_EXPIRED, refresh);
  }, [refresh]);

  if (session.isLoading) return null;
  if (session.error) return <p className="p-6 text-center text-red-600">Couldn't reach the app: {session.error.message}</p>;
  if (!session.data?.role) return <WelcomePage />;
  return <MainApp session={session.data} />;
}

function MainApp({ session }: { session: SessionInfo }) {
  // Phones open on Train (logging); computers on Progress (what visitors come to see).
  const [tab, setTab] = useState<Tab>(() => (window.matchMedia(DESKTOP).matches ? "progress" : "train"));
  const current = TABS.find((t) => t.id === tab)!;
  const Page = PAGES[tab];

  return (
    <NavContext.Provider value={setTab}>
      <ScreensProvider>
        <div className="min-h-dvh lg:pl-56">
          <main className={`mx-auto max-w-lg px-4 pt-[max(1rem,env(safe-area-inset-top))] lg:px-10 lg:pt-8 ${WIDE[tab]}`}>
            {/* The tab bar shows where you are; the heading is for screen readers. */}
            <h1 className="sr-only">{current.label}</h1>
            {session.role === "guest" && session.expiresAt && (
              <DemoBanner expiresAt={session.expiresAt} ownerLoginEnabled={session.ownerLoginEnabled} />
            )}
            <Page />
          </main>

          {/* Bottom tabs on phones and tablets; a sidebar on computers. */}
          <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white pb-[env(safe-area-inset-bottom)] lg:inset-y-0 lg:right-auto lg:w-56 lg:border-t-0 lg:border-r lg:pb-0">
            <div className="hidden px-6 pt-8 pb-6 text-lg font-semibold lg:block">Gym</div>
            <div className="mx-auto grid max-w-lg grid-cols-4 lg:mx-0 lg:flex lg:max-w-none lg:flex-col lg:gap-1 lg:px-3">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  aria-current={tab === t.id ? "page" : undefined}
                  className={`flex flex-col items-center py-2 text-xs font-medium lg:flex-row lg:gap-3 lg:rounded-xl lg:px-3 lg:py-2.5 lg:text-sm ${
                    tab === t.id ? "text-blue-700 lg:bg-blue-50" : "text-stone-500 lg:hover:bg-stone-100"
                  }`}
                >
                  <t.icon size={24} weight="fill" aria-hidden className="lg:size-5" />
                  {t.label}
                </button>
              ))}
            </div>
          </nav>
        </div>
      </ScreensProvider>
    </NavContext.Provider>
  );
}
