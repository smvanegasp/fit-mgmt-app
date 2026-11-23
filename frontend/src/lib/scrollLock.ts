import { useEffect, useState } from "react";

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

/**
 * While a full-screen page is open on a phone, the app underneath is hidden (Sergio, 2026-11-23:
 * with the keyboard up in the Home Screen app, the page behind kept showing in a strip above the
 * keyboard, however the page was sized; iOS changes the viewport sizes there). Nothing to show
 * through then. Counted, so stacked pages unhide once all are closed.
 */
let covers = 0;

export function useCoverApp(on: boolean): void {
  useEffect(() => {
    const root = document.getElementById("root");
    if (!on || !root) return;
    if (covers++ === 0) root.style.visibility = "hidden";
    return () => {
      if (--covers === 0) root.style.visibility = "";
    };
  }, [on]);
}

/**
 * The part of the screen actually visible: on the iPhone the keyboard covers the bottom and iOS
 * pans the page to keep a focused field in view, which carried the exercise search off the top
 * (Sergio, 2026-11-23). Sheets size and place themselves to this instead of the full screen.
 */
export function useVisibleArea(): { top: number; height: number } | null {
  const [area, setArea] = useState<{ top: number; height: number } | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setArea({ top: vv.offsetTop, height: vv.height });
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  return area;
}
