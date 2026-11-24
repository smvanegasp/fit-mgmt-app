import { Minus, Plus } from "@phosphor-icons/react";
import type { ReactNode } from "react";

interface Props {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step: number;
  min?: number;
  /** Shown with the label, e.g. "lbs each hand" or "lbs plates + 45 bar". */
  unit?: string;
  decimals?: boolean;
  /** "row": label on the left and a wide number (weights like 147.5 fit at phone width). */
  layout?: "column" | "row";
  /** Under the label in the row layout (the weight step switch). */
  extra?: ReactNode;
}

/**
 * One size for every number, 52 px: the largest at which a 5-character weight (147.5) fits between
 * − and + at phone width (box ~118 px). Sergio, 2026-11-23: sizes by length made the weight jump
 * when stepping between 145 and 147.5; they preferred the smaller one for all. `stepper-number`
 * exempts it from the 16 px rule for touch screens in index.css, which had kept it at 16 px on the phone.
 */
const NUMBER_SIZE = "text-[3.25rem]";

/** Big − / number / + control for the gym: large targets, the number is also typeable. */
export function Stepper({ label, value, onChange, step, min = 0, unit, decimals, layout = "column", extra }: Props) {
  const set = (v: number) => onChange(Math.max(min, Math.round(v * 4) / 4));
  const controls = (
    <div className="flex min-w-0 flex-1 items-center justify-between gap-1">
      <button
        type="button"
        onClick={() => set(value - step)}
        className="flex size-12 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-700 active:bg-stone-200"
        aria-label={`Less ${label.toLowerCase()}`}
      >
        <Minus size={24} weight="bold" aria-hidden />
      </button>
      <input
        aria-label={label}
        inputMode={decimals ? "decimal" : "numeric"}
        value={value}
        onFocus={(e) => e.target.select()}
        onChange={(e) => {
          const n = Number(e.target.value.replace(",", "."));
          if (!Number.isNaN(n)) onChange(Math.max(min, n));
        }}
        className={`stepper-number w-full min-w-0 bg-transparent text-center font-display font-semibold leading-none tabular-nums outline-none ${NUMBER_SIZE}`}
      />
      <button
        type="button"
        onClick={() => set(value + step)}
        className="flex size-12 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-700 active:bg-stone-200"
        aria-label={`More ${label.toLowerCase()}`}
      >
        <Plus size={24} weight="bold" aria-hidden />
      </button>
    </div>
  );

  if (layout === "row") {
    // Label on the left, − number + on the right (Sergio, 2026-11-23: better than the label on top).
    return (
      <div className="flex items-center gap-2">
        <div className="w-16 shrink-0">
          <div className="text-xs font-medium tracking-wide text-stone-500 uppercase">{label}</div>
          {unit && <div className="text-xs leading-tight text-stone-500">{unit}</div>}
          {extra}
        </div>
        {controls}
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
