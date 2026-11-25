import { useCallback, useEffect, useRef, useState } from "react";

export type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * Saves a value shortly after the last change (the same hook is in the website). One save runs
 * at a time; a change made meanwhile is saved right after, so the newest value always wins.
 * `save` gets `latest()`: false once another change is waiting, so it can skip resetting the
 * form to the server's copy. A change still waiting when the screen closes is saved anyway.
 */
export function useAutosave<T>(save: (value: T, latest: () => boolean) => Promise<void>, delay = 600) {
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const saveRef = useRef(save);
  const pending = useRef<{ value: T } | null>(null);
  const running = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  const run = useCallback(async () => {
    if (running.current || !pending.current) return;
    running.current = true;
    setState("saving");
    setError(null);
    let failed: string | null = null;
    while (pending.current) {
      const { value } = pending.current;
      pending.current = null;
      try {
        await saveRef.current(value, () => !pending.current);
        failed = null;
      } catch (e) {
        failed = e instanceof Error && e.message ? e.message : "Couldn't save.";
      }
    }
    running.current = false;
    setError(failed);
    setState(failed ? "error" : "saved");
  }, []);

  const schedule = useCallback(
    (value: T, now = false) => {
      pending.current = { value };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void run(), now ? 0 : delay);
    },
    [delay, run],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      void run();
    },
    [run],
  );

  return { schedule, state, error };
}
