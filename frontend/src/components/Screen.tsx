import { ArrowLeft } from "@phosphor-icons/react";
import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { DESKTOP } from "../hooks";
import { useCoverApp, useScrollLock, useVisibleArea } from "../lib/scrollLock";

interface Props {
  title: string;
  subtitle?: ReactNode;
  onBack: () => void;
  /** Buttons on the right of the header (Edit, Done). */
  actions?: ReactNode;
  /** A bar fixed at the bottom (Save). */
  footer?: ReactNode;
  /** Fixed under the header, never scrolled away (the exercise search). */
  top?: ReactNode;
  /** Fit the part of the screen above the iPhone keyboard (pages with a search field). */
  fitKeyboard?: boolean;
  children: ReactNode;
}

/**
 * A full-screen page over the tabs, with a back button. Screens can stack (detail, then edit).
 *
 * The header (and footer) stay fixed and only the middle scrolls, without the iPhone's rubber
 * band (Sergio, 2026-11-23: the whole page used to bounce, header included). The page behind
 * stays put.
 */
export function Screen({ title, subtitle, onBack, actions, footer, top, fitKeyboard = false, children }: Props) {
  useScrollLock();
  const phone = !window.matchMedia(DESKTOP).matches;
  useCoverApp(phone);
  const area = useVisibleArea();
  // With the keyboard open, the page follows iOS's pan (top) but always runs down behind the
  // keyboard, so nothing of the page below shows or scrolls in a gap (Sergio, 2026-11-23); the
  // list gets the keyboard's height as extra room at the bottom instead.
  // The full height, even if iOS shrinks the window along with the keyboard.
  const full = Math.max(window.innerHeight, window.screen?.height ?? 0);
  const keyboard = phone && fitKeyboard && area ? Math.max(0, full - area.top - area.height) : 0;
  const fit = phone && fitKeyboard && area ? { top: area.top, height: full, bottom: "auto" } : undefined;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onBack();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onBack]);

  // Phones: a full-screen page. Computers: a panel on the right over a dimmed, blurred page (click
  // outside to close), so the dashboard or list stays in view but the panel has the focus.
  return createPortal(
    <div
      className="fixed inset-0 z-30 flex bg-stone-50 lg:justify-end lg:bg-black/60 lg:backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={fit}
      onClick={(e) => e.target === e.currentTarget && window.matchMedia(DESKTOP).matches && onBack()}
    >
      <div className="flex h-full w-full flex-col bg-stone-50 lg:w-[36rem] lg:border-l lg:border-stone-200 lg:shadow-2xl">
        <header className="shrink-0 border-b border-stone-200 bg-stone-50 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-3">
          <div className="mx-auto flex max-w-lg items-center gap-2 px-4 lg:max-w-none lg:px-6">
            <button type="button" onClick={onBack} className="rounded-full p-2 text-stone-700" aria-label="Back">
              <ArrowLeft size={22} weight="bold" aria-hidden />
            </button>
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{title}</div>
              {subtitle && <div className="truncate text-sm text-stone-500">{subtitle}</div>}
            </div>
            {actions}
          </div>
        </header>
        {top && (
          <div className="shrink-0 border-b border-stone-200 bg-stone-50 pt-3 pb-2">
            <div className="mx-auto max-w-lg px-4 lg:max-w-none lg:px-6">{top}</div>
          </div>
        )}
        <div data-screen-scroll className="min-h-0 flex-1 overflow-y-auto overscroll-none">
          <div className={`mx-auto max-w-lg px-4 pt-3 lg:max-w-none lg:px-6 ${footer ? "pb-6" : "pb-[calc(env(safe-area-inset-bottom)+4rem)]"}`}
            style={keyboard ? { paddingBottom: keyboard + 24 } : undefined}>
            {children}
          </div>
        </div>
        {footer && (
          <footer className="shrink-0 border-t border-stone-200 bg-stone-50 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="mx-auto max-w-lg px-4 lg:max-w-none lg:px-6">{footer}</div>
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}
