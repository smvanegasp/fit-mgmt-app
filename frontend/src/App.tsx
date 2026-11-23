import { Barbell, ChartLineUp, ClockCounterClockwise, GearSix, type Icon } from "@phosphor-icons/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { SESSION_EXPIRED, type SessionInfo } from "./api";
import { DemoBanner } from "./components/DemoBanner";
import { Logo } from "./components/Logo";
import { NavContext, type Tab } from "./components/Nav";
import { ScreensProvider } from "./components/Screens";
import { DESKTOP, useRefreshSession, useSession } from "./hooks";
import { rememberPlace } from "./lib/place";
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
  const [tab, showTab] = useState<Tab>(() => (window.matchMedia(DESKTOP).matches ? "progress" : "train"));
  const current = TABS.find((t) => t.id === tab)!;
  // Each tab comes back where it was left (Sergio, 2026-11-20: back on Train mid-workout, at the
  // same exercise). The page re-renders from cached data, so the height may take a few frames.
  const scrolls = useRef<Partial<Record<Tab, number>>>({});
  const setTab = useCallback((next: Tab) => {
    scrolls.current[tab] = window.scrollY;
    showTab(next);
  }, [tab]);
  useLayoutEffect(() => {
    const target = scrolls.current[tab] ?? 0;
    let frames = 0;
    let id = 0;
    const restore = () => {
      window.scrollTo(0, target);
      if (Math.abs(window.scrollY - target) > 2 && frames++ < 30) id = requestAnimationFrame(restore);
    };
    restore();
    return () => cancelAnimationFrame(id);
  }, [tab]);
  const Page = PAGES[tab];
  // What feedback is about by default: the last tab other than Settings.
  useEffect(() => {
    if (tab !== "settings") rememberPlace(tab);
  }, [tab]);

  return (
    <NavContext.Provider value={setTab}>
      <ScreensProvider>
        <div className="min-h-dvh land:pl-[calc(4.5rem+env(safe-area-inset-left)*0.75)] lg:pl-56">
          <main className={`mx-auto max-w-lg px-4 pt-[calc(env(safe-area-inset-top)+1rem)] land:pr-[max(1rem,env(safe-area-inset-right))] lg:px-10 lg:pt-8 ${WIDE[tab]}`}>
            {/* The tab bar shows where you are; the heading is for screen readers. */}
            <h1 className="sr-only">{current.label}</h1>
            {session.role === "guest" && session.expiresAt && (
              <DemoBanner expiresAt={session.expiresAt} ownerLoginEnabled={session.ownerLoginEnabled} />
            )}
            <Page />
          </main>

          {/* Bottom tabs on phones and tablets; a rail on a phone turned sideways; a sidebar on computers. */}
          <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-stone-50/90 backdrop-blur pb-[env(safe-area-inset-bottom)] land:inset-y-0 land:right-auto land:w-[calc(4.5rem+env(safe-area-inset-left)*0.75)] land:border-t-0 land:border-r land:pb-0 land:pl-[calc(env(safe-area-inset-left)*0.75)] lg:inset-y-0 lg:right-auto lg:w-56 lg:border-t-0 lg:border-r lg:pb-0">
            <div className="hidden px-5 pt-8 pb-6 lg:block">
              <div className="flex items-center gap-3"><Logo size={36} /><span className="font-display text-3xl leading-none text-stone-950">Gym</span></div>
            </div>
            <div className="mx-auto grid max-w-lg grid-cols-4 land:flex land:h-full land:flex-col land:justify-center land:gap-1 lg:mx-0 lg:flex lg:h-auto lg:max-w-none lg:flex-col lg:justify-start lg:gap-1 lg:px-3">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  aria-current={tab === t.id ? "page" : undefined}
                  className={`relative flex flex-col items-center py-2 text-[0.7rem] font-semibold tracking-[0.15em] uppercase transition-colors land:border-l-2 land:text-[0.6rem] land:tracking-[0.06em] lg:flex-row lg:gap-3 lg:border-l-2 lg:px-3 lg:py-2.5 lg:text-xs ${
                    tab === t.id ? "text-stone-950 land:border-stone-950 lg:border-stone-950 lg:bg-stone-100" : "text-stone-500 land:border-transparent lg:border-transparent lg:hover:bg-stone-100 lg:hover:text-stone-800"
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
