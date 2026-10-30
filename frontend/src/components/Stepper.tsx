import { Minus, Plus } from "@phosphor-icons/react";

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
}

/** Big − / number / + control for the gym: large targets, the number is also typeable. */
export function Stepper({ label, value, onChange, step, min = 0, unit, decimals, layout = "column" }: Props) {
  const set = (v: number) => onChange(Math.max(min, Math.round(v * 4) / 4));
  const controls = (
    <div className="flex min-w-0 flex-1 items-center justify-between gap-1">
      <button
        type="button"
        onClick={() => set(value - step)}
        className="flex size-12 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-700 active:bg-stone-200"
        aria-label={`Less ${label.toLowerCase()}`}
      >
        <Minus size={22} weight="bold" aria-hidden />
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
        className="w-full min-w-0 bg-transparent text-center text-3xl font-semibold tabular-nums outline-none"
      />
      <button
        type="button"
        onClick={() => set(value + step)}
        className="flex size-12 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-700 active:bg-stone-200"
        aria-label={`More ${label.toLowerCase()}`}
      >
        <Plus size={22} weight="bold" aria-hidden />
      </button>
    </div>
  );

  if (layout === "row") {
    return (
      <div className="flex items-center gap-3">
        <div className="w-24 shrink-0">
          <div className="text-xs font-medium tracking-wide text-stone-500 uppercase">{label}</div>
          {unit && <div className="text-xs leading-tight text-stone-500">{unit}</div>}
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
