export const WORKOUT_TYPES = [
  "run",
  "walk",
  "swim",
  "bike",
  "strength",
  "plyo",
  "yoga",
  "mobility",
  "sport",
  "dance",
  "rest",
  "other",
] as const;
export type WorkoutType = (typeof WORKOUT_TYPES)[number];

export const WORKOUT_STATUSES = [
  "planned",
  "completed",
  "partial",
  "skipped",
  "missed",
  "substituted",
] as const;
export type WorkoutStatus = (typeof WORKOUT_STATUSES)[number];

/** Run/walk style intervals: warmup + reps × (work + rest) + cooldown, all in seconds. */
export interface Intervals {
  workSec?: number;
  restSec?: number;
  reps?: number;
  warmupSec?: number;
  cooldownSec?: number;
}

/** Shape shared by a workout's plan and what was actually done. All optional. */
export interface WorkoutDetails {
  durationSec?: number;
  distanceM?: number;
  intervals?: Intervals;
  description?: string;
}

export interface Workout {
  id: string;
  date: string; // yyyy-MM-dd
  originalDate?: string; // set when a planned workout is moved
  type: WorkoutType;
  title: string;
  status: WorkoutStatus;
  planned?: WorkoutDetails;
  actual?: WorkoutDetails;
  reason?: string; // why skipped / missed / substituted
  painLevel?: number; // 0–10
  injuryId?: string;
  rpe?: number; // 1–10
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DayLog {
  date: string;
  notes?: string;
  drinks?: number;
}

export const DISTANCE_UNITS = ["km", "mi"] as const;
export const WEIGHT_UNITS = ["kg", "lb"] as const;
export type DistanceUnit = (typeof DISTANCE_UNITS)[number];
export type WeightUnit = (typeof WEIGHT_UNITS)[number];
export interface Units {
  distance: DistanceUnit;
  weight: WeightUnit;
}

export interface Profile {
  displayName: string;
  email: string;
  units: Units;
  weekStartsOn: 0 | 1; // 0 Sunday, 1 Monday
  trackDrinks: boolean;
}

export type InjuryStatus = "active" | "recovering" | "healed";
export interface Injury {
  id: string;
  name: string;
  bodyPart?: string;
  startDate: string;
  endDate?: string;
  status: InjuryStatus;
  notes?: string;
}

export const BENCHMARK_CATEGORIES = ["cardio", "swim", "strength", "mobility", "custom"] as const;
export type BenchmarkCategory = (typeof BENCHMARK_CATEGORIES)[number];

/**
 * time        – seconds, e.g. 5K time (lower is better)
 * duration    – seconds held, e.g. plank (higher is better)
 * distance    – meters, e.g. 12‑min Cooper test
 * weight_reps – kg × reps, scored by estimated 1RM
 * reps        – count, e.g. max pull-ups
 * number      – anything else, with a custom unit label
 */
export const METRIC_KINDS = ["time", "duration", "distance", "weight_reps", "reps", "number"] as const;
export type MetricKind = (typeof METRIC_KINDS)[number];
export type Direction = "lower" | "higher";

export interface BenchmarkDef {
  id: string;
  name: string;
  category: BenchmarkCategory;
  metricKind: MetricKind;
  direction: Direction;
  unit?: string; // for "number"
  catalogKey?: string;
  createdAt: string;
}

export interface BenchmarkResult {
  id: string;
  benchmarkId: string;
  date: string;
  value: number; // canonical: seconds, meters, kg, count, or custom number
  reps?: number; // for weight_reps
  workoutId?: string;
  notes?: string;
}
