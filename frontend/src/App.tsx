import { Barbell, ChartLineUp, ClockCounterClockwise, GearSix, type Icon } from "@phosphor-icons/react";
import { useState } from "react";

import { HistoryPage } from "./pages/HistoryPage";
import { ProgressPage } from "./pages/ProgressPage";
import { SettingsPage } from "./pages/SettingsPage";
import { TrainPage } from "./pages/TrainPage";

const TABS: readonly { id: "train" | "history" | "progress" | "settings"; label: string; icon: Icon }[] = [
  { id: "train", label: "Train", icon: Barbell },
  { id: "history", label: "History", icon: ClockCounterClockwise },
  { id: "progress", label: "Progress", icon: ChartLineUp },
  { id: "settings", label: "Settings", icon: GearSix },
];

type Tab = (typeof TABS)[number]["id"];

const PAGES: Record<Tab, () => React.JSX.Element | null> = {
  train: TrainPage,
  history: HistoryPage,
  progress: ProgressPage,
  settings: SettingsPage,
};

export function App() {
  const [tab, setTab] = useState<Tab>("train");
  const current = TABS.find((t) => t.id === tab)!;
  const Page = PAGES[tab];

  return (
    <div className="mx-auto min-h-dvh max-w-lg">
      <main className="px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        {/* The tab bar shows where you are; the heading is for screen readers. */}
        <h1 className="sr-only">{current.label}</h1>
        <Page />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto grid max-w-lg grid-cols-4">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? "page" : undefined}
              className={`flex flex-col items-center py-2 text-xs font-medium ${
                tab === t.id ? "text-blue-700" : "text-stone-500"
              }`}
            >
              <t.icon size={24} weight="fill" aria-hidden />
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
