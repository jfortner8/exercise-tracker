import type { BenchmarkCategory, Direction, MetricKind } from "@/lib/types";

export interface CatalogEntry {
  key: string;
  name: string;
  category: BenchmarkCategory;
  metricKind: MetricKind;
  direction: Direction;
  unit?: string;
  hint?: string;
}

/** Built-in suggestions. Users copy these into their account with "Track this". */
export const BENCHMARK_CATALOG: CatalogEntry[] = [
  // Cardio
  { key: "run-1mi", name: "1 mile run", category: "cardio", metricKind: "time", direction: "lower" },
  { key: "run-5k", name: "5K run", category: "cardio", metricKind: "time", direction: "lower" },
  { key: "run-10k", name: "10K run", category: "cardio", metricKind: "time", direction: "lower" },
  { key: "run-half", name: "Half marathon", category: "cardio", metricKind: "time", direction: "lower" },
  { key: "run-marathon", name: "Marathon", category: "cardio", metricKind: "time", direction: "lower" },
  {
    key: "cooper-12",
    name: "12‑minute Cooper test",
    category: "cardio",
    metricKind: "distance",
    direction: "higher",
    hint: "Distance covered in 12 minutes",
  },
  { key: "row-2k", name: "2K row", category: "cardio", metricKind: "time", direction: "lower" },
  { key: "bike-20k", name: "20K bike", category: "cardio", metricKind: "time", direction: "lower" },
  { key: "resting-hr", name: "Resting heart rate", category: "cardio", metricKind: "number", direction: "lower", unit: "bpm" },
  // Swim
  { key: "swim-50-free", name: "50 m freestyle", category: "swim", metricKind: "time", direction: "lower" },
  { key: "swim-50-back", name: "50 m backstroke", category: "swim", metricKind: "time", direction: "lower" },
  { key: "swim-50-breast", name: "50 m breaststroke", category: "swim", metricKind: "time", direction: "lower" },
  { key: "swim-50-fly", name: "50 m butterfly", category: "swim", metricKind: "time", direction: "lower" },
  { key: "swim-100-free", name: "100 m freestyle", category: "swim", metricKind: "time", direction: "lower" },
  { key: "swim-400-free", name: "400 m freestyle", category: "swim", metricKind: "time", direction: "lower" },
  // Strength
  { key: "bench", name: "Bench press", category: "strength", metricKind: "weight_reps", direction: "higher" },
  { key: "squat", name: "Back squat", category: "strength", metricKind: "weight_reps", direction: "higher" },
  { key: "deadlift", name: "Deadlift", category: "strength", metricKind: "weight_reps", direction: "higher" },
  { key: "ohp", name: "Overhead press", category: "strength", metricKind: "weight_reps", direction: "higher" },
  { key: "bss", name: "Bulgarian split squat", category: "strength", metricKind: "weight_reps", direction: "higher" },
  { key: "lat-pulldown", name: "Lat pulldown", category: "strength", metricKind: "weight_reps", direction: "higher" },
  { key: "pullups", name: "Max pull‑ups", category: "strength", metricKind: "reps", direction: "higher" },
  { key: "pushups", name: "Max push‑ups", category: "strength", metricKind: "reps", direction: "higher" },
  { key: "dead-hang", name: "Dead hang", category: "strength", metricKind: "duration", direction: "higher" },
  { key: "plank", name: "Plank hold", category: "strength", metricKind: "duration", direction: "higher" },
  { key: "vertical", name: "Vertical jump", category: "strength", metricKind: "number", direction: "higher", unit: "in" },
  // Mobility
  { key: "sit-reach", name: "Sit and reach", category: "mobility", metricKind: "number", direction: "higher", unit: "cm" },
  { key: "deep-squat", name: "Deep squat hold", category: "mobility", metricKind: "duration", direction: "higher" },
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
