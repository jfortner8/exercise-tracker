import { BENCHMARK_CATALOG } from "./catalog";
import { detailsDurationSec, DONE_STATUSES, formatDistance, formatDuration } from "../domain";
import type { BenchmarkDef, Units, Workout, WorkoutType } from "../types";

/**
 * Linking a benchmark result to the workout it happened in (e.g. a 10K PB inside an 11K run).
 * Linking is optional; these rules decide which workouts are offered and when to warn.
 */
export interface LinkRule {
  /** Workout types the result can belong to. Empty = standalone only (e.g. resting heart rate). */
  types: WorkoutType[] | "any";
  /** The workout should cover at least this distance. */
  distanceM?: number;
  /** The workout should last at least this long. */
  minDurationSec?: number;
}

/** Benchmarks on the built-in list use the catalog's rule; custom ones can link to any workout. */
export function linkRule(def: Pick<BenchmarkDef, "catalogKey">): LinkRule {
  const entry = def.catalogKey ? BENCHMARK_CATALOG.find((c) => c.key === def.catalogKey) : undefined;
  return entry?.link ?? { types: "any" };
}

export const workoutDistanceM = (w: Workout) => w.actual?.distanceM ?? w.planned?.distanceM;
export const workoutDurationSec = (w: Workout) => detailsDurationSec(w.actual ?? w.planned);

/** Workouts this result could be part of. Rest days never qualify. */
export function linkableWorkouts(def: Pick<BenchmarkDef, "catalogKey">, workouts: Workout[]): Workout[] {
  const { types } = linkRule(def);
  return workouts.filter((w) => w.type !== "rest" && (types === "any" || types.includes(w.type)));
}

/** Small allowance so a watch-measured 9.98 km still counts as a 10K. */
const TOLERANCE = 0.99;

/** A warning (not a block) when the workout looks too short for the benchmark. */
export function linkWarning(def: Pick<BenchmarkDef, "catalogKey">, w: Workout, units: Units): string | undefined {
  const rule = linkRule(def);
  const dist = workoutDistanceM(w);
  if (rule.distanceM && dist != null && dist < rule.distanceM * TOLERANCE) {
    return `This workout was ${formatDistance(dist, units)}, shorter than ${formatDistance(rule.distanceM, units)}.`;
  }
  const dur = workoutDurationSec(w);
  if (rule.minDurationSec && dur != null && dur < rule.minDurationSec) {
    return `This workout was ${formatDuration(dur)}, shorter than ${formatDuration(rule.minDurationSec)}.`;
  }
  return undefined;
}

/** The workout to pre-select: a done one that fits without warnings, else any that fits. */
export function suggestLink(def: Pick<BenchmarkDef, "catalogKey">, workouts: Workout[], units: Units) {
  const options = linkableWorkouts(def, workouts);
  const ok = options.filter((w) => !linkWarning(def, w, units));
  return ok.find((w) => DONE_STATUSES.has(w.status)) ?? ok[0] ?? options[0];
}

/** "Intervals · 11.0 km" for pickers. */
export function workoutLabel(w: Workout, units: Units) {
  const dist = workoutDistanceM(w);
  const dur = workoutDurationSec(w);
  const extra = dist ? formatDistance(dist, units) : dur ? formatDuration(dur) : "";
  return extra ? `${w.title} · ${extra}` : w.title;
}
