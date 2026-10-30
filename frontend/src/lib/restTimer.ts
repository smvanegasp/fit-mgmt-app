import { useCallback, useEffect, useState } from "react";

const KEY = "gym.rest";
const LENGTH_KEY = "gym.restLength";
export const REST_CHOICES = [60, 90, 120, 180, 240];

interface RestState {
  /** Epoch ms when the rest ends; kept in localStorage so it survives a reload or lock. */
  endsAt: number;
  length: number;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable: the timer still works until the page closes.
  }
}

/** The rest timer between sets: start (after logging a set), change the length, stop. */
export function useRestTimer() {
  const [state, setState] = useState<RestState | null>(() => read<RestState | null>(KEY, null));
  const [length, setLengthState] = useState<number>(() => read<number>(LENGTH_KEY, 120));
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!state) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [state]);

  const remaining = state ? Math.round((state.endsAt - now) / 1000) : 0;

  // Buzz once when the rest is over (phones that support it).
  useEffect(() => {
    if (state && remaining === 0) navigator.vibrate?.([200, 100, 200]);
  }, [state, remaining]);

  const start = useCallback(
    (seconds = length) => {
      const next = { endsAt: Date.now() + seconds * 1000, length: seconds };
      write(KEY, next);
      setNow(Date.now());
      setState(next);
    },
    [length],
  );

  const stop = useCallback(() => {
    write(KEY, null);
    setState(null);
  }, []);

  const setLength = useCallback(
    (seconds: number) => {
      write(LENGTH_KEY, seconds);
      setLengthState(seconds);
      if (state) start(seconds);
    },
    [state, start],
  );

  return { running: state !== null, remaining, length, start, stop, setLength };
}
