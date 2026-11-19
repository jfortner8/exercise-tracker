import { detailsDurationSec, intervalTotalSec, metersToDisplay, distanceUnit } from "./domain";
import type { Units, WorkoutDetails } from "./types";

/** Where time beyond the planned intervals goes. */
export type ExtraAs = "warmup" | "cooldown";

/** Seconds the logged time runs past the intervals, or 0 (no intervals, no time, or not over). */
export function extraBeyondIntervals(base: WorkoutDetails | undefined, timeSec: number | undefined): number {
  const total = intervalTotalSec(base?.intervals);
  if (!total || !timeSec) return 0;
  return Math.max(0, Math.round(timeSec - total));
}

/** The time to prefill: the plan's duration, or its interval total. */
export const plannedTimeSec = (base: WorkoutDetails | undefined) => detailsDurationSec(base);

/**
 * What was actually done, from the plan plus the quick "Done" fields: the plan's details (intervals,
 * exercises, description) with the logged time and distance. Time past the intervals is added to the
 * warm-up or cool-down so the intervals still add up.
 */
export function quickActual(
  base: WorkoutDetails | undefined,
  input: { timeSec?: number; distanceM?: number; extraAs: ExtraAs },
): WorkoutDetails | undefined {
  const extra = extraBeyondIntervals(base, input.timeSec);
  const iv = base?.intervals;
  const intervals =
    iv && extra > 0
      ? input.extraAs === "warmup"
        ? { ...iv, warmupSec: (iv.warmupSec ?? 0) + extra }
        : { ...iv, cooldownSec: (iv.cooldownSec ?? 0) + extra }
      : iv;
  const out: WorkoutDetails = {
    ...base,
    intervals,
    durationSec: input.timeSec ?? base?.durationSec,
    // The panel always shows distance where it applies, so an empty box means none.
    distanceM: input.distanceM,
  };
  const clean = Object.fromEntries(Object.entries(out).filter(([, v]) => v != null)) as WorkoutDetails;
  return Object.keys(clean).length ? clean : undefined;
}

/** "7:01 /km" from a time and distance, or undefined when either is missing. */
export function formatPace(timeSec: number | undefined, distanceM: number | undefined, units: Units): string | undefined {
  if (!timeSec || !distanceM) return undefined;
  const perUnit = Math.round(timeSec / metersToDisplay(distanceM, units));
  if (!isFinite(perUnit) || perUnit <= 0) return undefined;
  const h = Math.floor(perUnit / 3600);
  const m = Math.floor((perUnit % 3600) / 60);
  const s = String(perUnit % 60).padStart(2, "0");
  return `${h ? `${h}:${String(m).padStart(2, "0")}` : m}:${s} /${distanceUnit(units)}`;
}
