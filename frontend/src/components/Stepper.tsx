import { Minus, Plus } from "@phosphor-icons/react";
import { useLayoutEffect, useRef, type ReactNode } from "react";

interface Props {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step: number;
  min?: number;
  /** Shown with the label, e.g. "lb each hand" or "lb plates + 45 bar". */
  unit?: string;
  decimals?: boolean;
  /** "row": label on the left and a wide number (weights like 112.5 fit at phone width). */
  layout?: "column" | "row";
  /** Under the label in the row layout (the weight step switch). */
  extra?: ReactNode;
}

/** Big − / number / + control for the gym: large targets, the number is also typeable. */
export function Stepper({ label, value, onChange, step, min = 0, unit, decimals, layout = "column", extra }: Props) {
  const set = (v: number) => onChange(Math.max(min, Math.round(v * 4) / 4));
  // The number shrinks only as much as it must to fit its box (Sergio, 2026-11-23: 147.5 was cut off).
  const input = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.fontSize = "";
    if (el.scrollWidth > el.clientWidth) {
      el.style.fontSize = `${Math.floor(parseFloat(getComputedStyle(el).fontSize) * (el.clientWidth / el.scrollWidth) * 0.96)}px`;
    }
  }, [value]);
  const controls = (
    <div className="flex min-w-0 flex-1 items-center justify-between gap-1">
      <button
        type="button"
        onClick={() => set(value - step)}
        className="flex size-13 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-700 active:bg-stone-200"
        aria-label={`Less ${label.toLowerCase()}`}
      >
        <Minus size={24} weight="bold" aria-hidden />
      </button>
      <input
        ref={input}
        aria-label={label}
        inputMode={decimals ? "decimal" : "numeric"}
        value={value}
        onFocus={(e) => e.target.select()}
        onChange={(e) => {
          const n = Number(e.target.value.replace(",", "."));
          if (!Number.isNaN(n)) onChange(Math.max(min, n));
        }}
        // Big (Sergio, 2026-11-03, bigger 11-19 and 11-23): 72 px for every value now that the label sits
        // above; the effect above shrinks it only if it still doesn't fit.
        className={`w-full min-w-0 bg-transparent text-center font-display font-semibold leading-none tabular-nums outline-none text-7xl`}
      />
      <button
        type="button"
        onClick={() => set(value + step)}
        className="flex size-13 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-700 active:bg-stone-200"
        aria-label={`More ${label.toLowerCase()}`}
      >
        <Plus size={24} weight="bold" aria-hidden />
      </button>
    </div>
  );

  if (layout === "row") {
    // The label on its own line above, so the number has the full width between − and + and stays
    // big even for 147.5 (Sergio, 2026-11-23: it shrank to fit next to a label column).
    return (
      <div>
        <div className="flex min-h-7 items-center gap-2">
          <span className="text-xs font-medium tracking-wide text-stone-500 uppercase">{label}</span>
          {unit && <span className="min-w-0 truncate text-xs text-stone-500">{unit}</span>}
          {extra && <div className="ml-auto shrink-0">{extra}</div>}
        </div>
        <div className="flex">{controls}</div>
      </div>
    );
  }
  return (
    <div className="flex flex-1 flex-col items-center">
      <span className="text-xs font-medium tracking-wide text-stone-500 uppercase">{label}</span>
      <div className="mt-1 flex w-full">{controls}</div>
      {unit && <span className="text-xs text-stone-500">{unit}</span>}
    </div>
  );
}
