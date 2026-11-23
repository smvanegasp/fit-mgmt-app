import { useEffect } from "react";

/**
 * While a sheet or a full-screen page is open, the page behind stays exactly where it was
 * (Sergio, 2026-11-23). iOS ignores `overflow: hidden` on the body, so the body is pinned with
 * `position: fixed` at its scroll offset and put back when the last one closes. Counted, so a
 * picker over the plan page over Train only unlocks once all are closed.
 */
let locks = 0;
let saved: { y: number; position: string; top: string; width: string; overflow: string } | null = null;

export function lockScroll(): () => void {
  if (locks++ === 0) {
    const style = document.body.style;
    saved = { y: window.scrollY, position: style.position, top: style.top, width: style.width, overflow: style.overflow };
    Object.assign(style, { position: "fixed", top: `-${saved.y}px`, width: "100%", overflow: "hidden" });
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--locks === 0 && saved) {
      const { y, ...style } = saved;
      Object.assign(document.body.style, style);
      window.scrollTo(0, y);
      saved = null;
    }
  };
}

export function useScrollLock(): void {
  useEffect(() => lockScroll(), []);
}
