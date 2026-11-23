import { useSyncExternalStore } from "react";
import type { Workout } from "@et/core/types";

/*
 * The planned workout being moved to another day, if any. Set by a long press on the calendar or
 * "Move…" in the day sheet; the calendar's next tap on a day says where it goes.
 */
let moving: Workout | null = null;
const listeners = new Set<() => void>();

export function setMoving(w: Workout | null) {
  moving = w;
  listeners.forEach((l) => l());
}

export const useMoving = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => moving,
  );
