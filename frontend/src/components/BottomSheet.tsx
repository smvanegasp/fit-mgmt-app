import { X } from "@phosphor-icons/react";
import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { DESKTOP } from "../hooks";
import { useCoverApp, useScrollLock, useVisibleArea } from "../lib/scrollLock";

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** A fixed height, for sheets whose content changes size (the exercise search: Sergio,
   * 2026-11-21, the sheet jumped as results filtered). */
  tall?: boolean;
  /** Fixed under the title, never scrolled away (the exercise search, Sergio 2026-11-23). */
  top?: ReactNode;
}

/**
 * A sheet from the bottom (a dialog on wider screens). The title and `top` stay fixed and only
 * the content scrolls, without the iPhone's rubber band; the page behind stays put.
 */
export function BottomSheet({ title, onClose, children, tall = false, top }: Props) {
  useScrollLock();
  // Fit the part of the screen above the keyboard, so the title and search never leave view.
  const area = useVisibleArea();
  const room = area ? area.height - 12 : null;
  // Typing on a phone (the keyboard takes a good part of the screen): the sheet fills what's left,
  // its header below the clock, over an opaque layer that runs down behind the keyboard, and the
  // app underneath is hidden (Sergio, 2026-11-24: the feedback sheet overlapped the clock and the
  // tabs showed above the keyboard). iOS changes the viewport sizes there, hence the screen height.
  const full = Math.max(window.innerHeight, window.screen?.height ?? 0);
  const typing = Boolean(area) && !window.matchMedia(DESKTOP).matches && full - area!.top - area!.height > 150;
  useCoverApp(typing);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Rendered at the end of <body> so sheets never inherit styles from where they're opened.
  return createPortal(
    <div className={`fixed inset-x-0 z-40 flex justify-center ${typing ? "items-start bg-white" : "items-end sm:items-center"}`}
      style={typing ? { top: area!.top, height: full } : area ? { top: area.top, height: area.height } : { top: 0, bottom: 0 }}>
      {!typing && <div className="absolute inset-0 bg-black/40 lg:bg-black/60 lg:backdrop-blur-md" onClick={onClose} aria-hidden />}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={typing
          ? "relative flex w-full max-w-lg flex-col bg-white pt-[env(safe-area-inset-top)]"
          : `relative flex ${tall ? "h-[85dvh]" : ""} max-h-[92dvh] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl`}
        style={typing ? { height: area!.height } : room ? { maxHeight: room, ...(tall ? { height: Math.min(room, window.innerHeight * 0.85) } : {}) } : undefined}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-stone-200 px-4 py-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="-mr-2 rounded-full p-2 text-stone-500 hover:bg-stone-100"
            aria-label="Close"
          >
            <X size={20} weight="bold" aria-hidden />
          </button>
        </div>
        {top && <div className="shrink-0 border-b border-stone-200 px-4 pt-3 pb-2">{top}</div>}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-none px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
