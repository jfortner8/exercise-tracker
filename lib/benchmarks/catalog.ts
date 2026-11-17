import type { BenchmarkCategory, Direction, MetricKind, WorkoutType } from "../types";

export interface CatalogEntry {
  key: string;
  name: string;
  category: BenchmarkCategory;
  metricKind: MetricKind;
  direction: Direction;
  unit?: string;
  hint?: string;
  /** Which workouts a result can be "part of" (see lib/benchmarks/linking.ts). Types [] = standalone. */
  link?: { types: WorkoutType[]; distanceM?: number; minDurationSec?: number };
}

const RUN: WorkoutType[] = ["run", "walk"];
const LIFT: WorkoutType[] = ["strength"];
const BODYWEIGHT: WorkoutType[] = ["strength", "plyo", "other"];

/** Built-in suggestions. Users copy these into their account with "Track this". */
export const BENCHMARK_CATALOG: CatalogEntry[] = [
  // Cardio
  { key: "run-1mi", name: "1 mile run", category: "cardio", metricKind: "time", direction: "lower", link: { types: RUN, distanceM: 1609.344 } },
  { key: "run-5k", name: "5K run", category: "cardio", metricKind: "time", direction: "lower", link: { types: RUN, distanceM: 5000 } },
  { key: "run-10k", name: "10K run", category: "cardio", metricKind: "time", direction: "lower", link: { types: RUN, distanceM: 10000 } },
  { key: "run-half", name: "Half marathon", category: "cardio", metricKind: "time", direction: "lower", link: { types: RUN, distanceM: 21097.5 } },
  { key: "run-marathon", name: "Marathon", category: "cardio", metricKind: "time", direction: "lower", link: { types: RUN, distanceM: 42195 } },
  {
    key: "cooper-12",
    name: "12‑minute Cooper test",
    category: "cardio",
    metricKind: "distance",
    direction: "higher",
    hint: "Distance covered in 12 minutes",
    link: { types: RUN, minDurationSec: 720 },
  },
  { key: "row-2k", name: "2K row", category: "cardio", metricKind: "time", direction: "lower", link: { types: ["row", "other"], distanceM: 2000 } },
  { key: "bike-20k", name: "20K bike", category: "cardio", metricKind: "time", direction: "lower", link: { types: ["bike"], distanceM: 20000 } },
  { key: "resting-hr", name: "Resting heart rate", category: "cardio", metricKind: "number", direction: "lower", unit: "bpm", link: { types: [] } },
  // Swim
  { key: "swim-50-free", name: "50 m freestyle", category: "swim", metricKind: "time", direction: "lower", link: { types: ["swim"], distanceM: 50 } },
  { key: "swim-50-back", name: "50 m backstroke", category: "swim", metricKind: "time", direction: "lower", link: { types: ["swim"], distanceM: 50 } },
  { key: "swim-50-breast", name: "50 m breaststroke", category: "swim", metricKind: "time", direction: "lower", link: { types: ["swim"], distanceM: 50 } },
  { key: "swim-50-fly", name: "50 m butterfly", category: "swim", metricKind: "time", direction: "lower", link: { types: ["swim"], distanceM: 50 } },
  { key: "swim-100-free", name: "100 m freestyle", category: "swim", metricKind: "time", direction: "lower", link: { types: ["swim"], distanceM: 100 } },
  { key: "swim-400-free", name: "400 m freestyle", category: "swim", metricKind: "time", direction: "lower", link: { types: ["swim"], distanceM: 400 } },
  // Strength
  { key: "bench", name: "Bench press", category: "strength", metricKind: "weight_reps", direction: "higher", link: { types: LIFT } },
  { key: "squat", name: "Back squat", category: "strength", metricKind: "weight_reps", direction: "higher", link: { types: LIFT } },
  { key: "deadlift", name: "Deadlift", category: "strength", metricKind: "weight_reps", direction: "higher", link: { types: LIFT } },
  { key: "ohp", name: "Overhead press", category: "strength", metricKind: "weight_reps", direction: "higher", link: { types: LIFT } },
  { key: "bss", name: "Bulgarian split squat", category: "strength", metricKind: "weight_reps", direction: "higher", link: { types: LIFT } },
  { key: "lat-pulldown", name: "Lat pulldown", category: "strength", metricKind: "weight_reps", direction: "higher", link: { types: LIFT } },
  { key: "pullups", name: "Max pull‑ups", category: "strength", metricKind: "reps", direction: "higher", link: { types: BODYWEIGHT } },
  { key: "pushups", name: "Max push‑ups", category: "strength", metricKind: "reps", direction: "higher", link: { types: BODYWEIGHT } },
  { key: "dead-hang", name: "Dead hang", category: "strength", metricKind: "duration", direction: "higher", link: { types: BODYWEIGHT } },
  { key: "plank", name: "Plank hold", category: "strength", metricKind: "duration", direction: "higher", link: { types: BODYWEIGHT } },
  { key: "vertical", name: "Vertical jump", category: "strength", metricKind: "number", direction: "higher", unit: "in", link: { types: ["plyo", "strength", "sport", "other"] } },
  // Mobility
  { key: "sit-reach", name: "Sit and reach", category: "mobility", metricKind: "number", direction: "higher", unit: "cm", link: { types: ["mobility", "yoga", "strength"] } },
  { key: "deep-squat", name: "Deep squat hold", category: "mobility", metricKind: "duration", direction: "higher", link: { types: ["mobility", "yoga", "strength"] } },
];

export const CATEGORY_LABEL: Record<BenchmarkCategory, string> = {
  cardio: "Cardio",
  swim: "Swim",
  strength: "Strength",
  mobility: "Mobility",
  custom: "Custom",
};

export const METRIC_LABEL: Record<MetricKind, string> = {
  time: "Time (faster is better)",
  duration: "Duration held",
  distance: "Distance",
  weight_reps: "Weight × reps (est. 1RM)",
  reps: "Reps",
  number: "Number (custom unit)",
};
