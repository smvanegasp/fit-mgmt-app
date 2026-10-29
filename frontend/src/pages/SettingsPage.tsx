import { Desktop, Moon, Sun, type Icon } from "@phosphor-icons/react";

import { useTheme, type Theme } from "../lib/theme";

export function SettingsPage() {
  return (
    <div className="space-y-4 pb-24">
      <AppearanceSettings />
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
