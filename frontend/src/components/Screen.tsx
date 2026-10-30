import { ArrowLeft } from "@phosphor-icons/react";
import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { DESKTOP } from "../hooks";

interface Props {
  title: string;
  subtitle?: ReactNode;
  onBack: () => void;
  /** Buttons on the right of the header (Edit, Done). */
  actions?: ReactNode;
  children: ReactNode;
}

/** A full-screen page over the tabs, with a back button. Screens can stack (detail, then edit). */
export function Screen({ title, subtitle, onBack, actions, children }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onBack();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onBack]);

  // Phones: a full-screen page. Computers: a panel on the right over a dimmed page (click outside
  // to close), so the dashboard or list stays in view.
  return createPortal(
    <div
      className="fixed inset-0 z-30 overflow-y-auto bg-stone-50 lg:flex lg:justify-end lg:overflow-hidden lg:bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => e.target === e.currentTarget && window.matchMedia(DESKTOP).matches && onBack()}
    >
      <div className="mx-auto max-w-lg px-4 pb-16 lg:mx-0 lg:h-full lg:w-[36rem] lg:max-w-none lg:overflow-y-auto lg:bg-stone-50 lg:px-6 lg:shadow-2xl">
        <header className="sticky top-0 z-10 -mx-4 mb-3 flex items-center gap-2 border-b border-stone-200 bg-stone-50/95 px-4 lg:-mx-6 lg:px-6 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur">
          <button type="button" onClick={onBack} className="rounded-full p-2 text-stone-700" aria-label="Back">
            <ArrowLeft size={22} weight="bold" aria-hidden />
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold">{title}</div>
            {subtitle && <div className="truncate text-sm text-stone-500">{subtitle}</div>}
          </div>
          {actions}
        </header>
        {children}
      </div>
    </div>,
    document.body,
  );
}
