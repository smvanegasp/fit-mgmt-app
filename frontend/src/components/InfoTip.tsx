import { Info } from "@phosphor-icons/react";
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

interface Props {
  /** Short name of the feature, used as the popover title and the button label. */
  title: string;
  children: ReactNode;
}

const MARGIN = 12; // minimum gap between the popover and the screen edge
const GAP = 8; // gap between the button and the popover
const MAX_WIDTH = 288;

/**
 * A small (i) button that explains a feature in a popover. Tap again or tap outside to close.
 * The popover is positioned against the viewport so it never runs off screen.
 */
export function InfoTip({ title, children }: Props) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<CSSProperties>({ visibility: "hidden" });
  const wrapper = useRef<HTMLSpanElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const popover = useRef<HTMLSpanElement>(null);
  const id = useId();

  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      const anchor = button.current?.getBoundingClientRect();
      const box = popover.current;
      if (!anchor || !box) return;
      const width = Math.min(MAX_WIDTH, window.innerWidth - 2 * MARGIN);
      box.style.width = `${width}px`;
      const height = box.offsetHeight;
      const centered = anchor.left + anchor.width / 2 - width / 2;
      const left = Math.min(Math.max(centered, MARGIN), window.innerWidth - width - MARGIN);
      const below = anchor.bottom + GAP;
      const fitsBelow = below + height <= window.innerHeight - MARGIN;
      const top = fitsBelow ? below : Math.max(MARGIN, anchor.top - GAP - height);
      setStyle({ left, top, width, visibility: "visible" });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (!wrapper.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={wrapper} className="inline-flex align-middle">
      <button
        ref={button}
        type="button"
        onClick={() => {
          setStyle({ visibility: "hidden" });
          setOpen((o) => !o);
        }}
        aria-label={`About ${title}`}
        aria-expanded={open}
        aria-controls={id}
        className="-m-1.5 rounded-full p-1.5 text-stone-400 hover:text-emerald-700 aria-expanded:text-emerald-700"
      >
        <Info size={18} weight="fill" aria-hidden />
      </button>
      {open && (
        <span
          ref={popover}
          id={id}
          role="tooltip"
          style={style}
          className="fixed z-50 block rounded-xl bg-stone-900 p-3 text-left text-sm font-normal tracking-normal text-stone-100 normal-case shadow-xl"
        >
          <span className="mb-1 block font-semibold text-white">{title}</span>
          {children}
        </span>
      )}
    </span>
  );
}
