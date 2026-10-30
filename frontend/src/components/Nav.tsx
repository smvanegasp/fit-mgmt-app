import { createContext, useContext } from "react";

export type Tab = "train" | "history" | "progress" | "settings";

/** Switch tabs from inside a page, so one place can link to another instead of repeating it. */
export const NavContext = createContext<(tab: Tab) => void>(() => undefined);

export function useGoTo() {
  return useContext(NavContext);
}
