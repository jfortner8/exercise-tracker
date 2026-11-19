import type { Goal } from "./goals";
import type { HabitKind } from "./habits";

export const WORKOUT_TYPES = [
  "run",
  "walk",
  "swim",
  "bike",
  "row",
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

/** One exercise in a strength routine. Reps is free text: "8", "8–12", "60 s", "to failure". */
export interface Exercise {
  name: string;
  sets?: number;
  reps?: string;
  weightKg?: number;
}

/** A named list of exercises the user saved, to fill in Strength workouts. */
export interface Routine {
  id: string;
  name: string;
  exercises: Exercise[];
  createdAt: string;
  updatedAt: string;
}

/** Shape shared by a workout's plan and what was actually done. All optional. */
export interface WorkoutDetails {
  /** Strength only: the exercises (planned, or done). */
  exercises?: Exercise[];
  durationSec?: number;
  distanceM?: number;
  intervals?: Intervals;
  description?: string;
  /** Average heart rate during the workout (bpm). Recorded on what was actually done. */
  avgHeartRate?: number;
}

export interface Workout {
  id: string;
  date: string; // yyyy-MM-dd
  /** Optional start time, "HH:mm" (24 h) in the user's own time zone. Untimed workouts are all-day. */
  startTime?: string;
  originalDate?: string; // set when a planned workout is moved
  /** Shared by the workouts created together by one weekly repeat. */
  seriesId?: string;
  type: WorkoutType;
  title: string;
  location?: string; // e.g. "Piedmont Park", "YMCA pool", "Treadmill"
  /** For type "sport": key from lib/sports.ts ("soccer", "roller-derby", "other"). */
  sport?: string;
  /** Name typed in when sport is "other". */
  sportName?: string;
  /** Session key from the sport's list ("match", "practice", "bout"…). */
  sportSession?: string;
  /** For type "dance": style key from lib/dance.ts ("salsa", "bachata", "other"…). */
  danceStyle?: string;
  /** Style typed in when danceStyle is "other". */
  danceStyleName?: string;
  /** "practice", "class", "show" or "social". */
  danceSession?: string;
  /** Strength only: the saved routine this was filled from, unchanged. A copy of the name, not a live link. */
  routineId?: string;
  routineName?: string;
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
  /** Alcoholic drinks (the original counter, so the field keeps its name). */
  drinks?: number;
  sugaryDrinks?: number;
  /** Cigarettes, vapes, pouches… */
  tobacco?: number;
  /** Ids of the daily goals checked off this day (see lib/goals.ts). */
  goalsDone?: string[];
  /** One bodyweight per day, stored in kg. */
  weightKg?: number;
}

export const DISTANCE_UNITS = ["km", "mi"] as const;
export const WEIGHT_UNITS = ["kg", "lb"] as const;
export type DistanceUnit = (typeof DISTANCE_UNITS)[number];
export type WeightUnit = (typeof WEIGHT_UNITS)[number];
export interface Units {
  distance: DistanceUnit;
  weight: WeightUnit;
}

/** How start times are shown: "6:30 PM" or "18:30". */
export type Clock = "12h" | "24h";

export interface Profile {
  displayName: string;
  email: string;
  units: Units;
  weekStartsOn: 0 | 1; // 0 Sunday, 1 Monday
  /** Start-time format; absent means 12-hour. */
  clock?: Clock;
  /** Legacy "Track drinks" switch; read only to fill in `habits` for old profiles. */
  trackDrinks: boolean;
  /** Daily counters the user opted into (see lib/habits.ts). */
  habits?: HabitKind[];
  /** The one counter shown on the calendar; falls back to the first in `habits`. */
  habitOnCalendar?: HabitKind;
  /** The day each counter was first turned on; unlogged days before it stay blank. */
  habitStarts?: Partial<Record<HabitKind, string>>;
  /** Yes/no daily goals ("Stretched"). */
  goals?: Goal[];
  /** The goal shown on the calendar; falls back to the first. */
  goalOnCalendar?: string;
  /** Who sees this user's PBs on built-in benchmarks. See SHARE_LEVELS. */
  share: Share;
  /** Code others enter to become friends. Created the first time it's needed. */
  friendCode?: string;
  /** Opt-in: log one bodyweight per day; shown on the calendar on days it's logged. */
  trackWeight: boolean;
  /** Set once the user completes a sport workout; shows the Sports tab. Not a setting. */
  hasSports?: boolean;
  /** Set while the user has at least one saved routine; shows the Routines tab. Not a setting. */
  hasRoutines?: boolean;
  /** IANA zone from the browser ("America/New_York"); says what a workout's start time means in the calendar feed. */
  timeZone?: string;
  /** Secret token in the private calendar-feed link. Absent while the feed is off. */
  calendarToken?: string;
  /** Feed options: include workout notes, and include only planned (upcoming) workouts. */
  calendarIncludeNotes?: boolean;
  calendarPlannedOnly?: boolean;
}

/**
 * Who sees a user's PBs on leaderboards: nobody, their friends and clubs, or also everyone
 * with an account (the Everyone board).
 */
export const SHARE_LEVELS = ["off", "circle", "everyone"] as const;
export type Share = (typeof SHARE_LEVELS)[number];

/** One side of a mutual friendship, stored under the user who sees it. */
export interface Friend {
  sub: string;
  displayName: string;
  since: string;
}

/** A group whose members all see the same leaderboard. Joined with its invite code. */
export interface Club {
  id: string;
  name: string;
  /** The one member who can rename, reset the code, remove members, hand over admin and delete. */
  adminSub: string;
  code: string;
  createdAt: string;
}

export interface ClubMember {
  sub: string;
  displayName: string;
  joinedAt: string;
}

/** A club as listed under one of its members. */
export interface MyClub {
  clubId: string;
  name: string;
}

/** One user's best result on a built-in benchmark, as shown on its leaderboard. */
export interface LeaderboardEntry {
  sub: string;
  catalogKey: string;
  displayName: string;
  value: number;
  reps?: number;
  date: string;
  score: number;
  /** Dates this user set a new PB and the score each time, oldest first (for % improvement). */
  history: { date: string; score: number }[];
  /** The owner's share level when written. Rows from before share levels are "everyone". */
  share?: Share;
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

/** A benchmark result as shown on the calendar, flagged if it set a new PB at the time. */
export interface DayResult extends BenchmarkResult {
  benchmarkName: string;
  metricKind: MetricKind;
  unit?: string;
  isPb: boolean;
}
