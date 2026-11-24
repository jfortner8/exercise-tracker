import { z } from "zod";
import { DANCE_SESSIONS, DANCE_STYLES } from "./dance";
import { START_TIME_RE } from "./domain";
import { GOAL_NAME_MAX, MAX_GOALS } from "./goals";
import { HABIT_KINDS, HABITS } from "./habits";
import { MAX_EXERCISES } from "./routines";
import { SPORTS } from "./sports";
import {
  BENCHMARK_CATEGORIES,
  DISTANCE_UNITS,
  METRIC_KINDS,
  SHARE_LEVELS,
  WEIGHT_UNITS,
  WORKOUT_STATUSES,
  WORKOUT_TYPES,
} from "./types";

/*
 * Every input the server accepts, in one place. The website's server actions, the /api/v1 route
 * handlers and the phone app's forms all validate with these, so the rules can't drift apart.
 */

// ---------- Building blocks ----------
export const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const id = z.string().min(1).max(64);
export const timeZoneName = z.string().max(64).regex(/^[A-Za-z0-9/_+-]+$/);
const secs = z.number().nonnegative().max(60 * 60 * 48).optional();
const SPORT_KEYS = SPORTS.map((s) => s.key) as [string, ...string[]];
const DANCE_STYLE_KEYS = DANCE_STYLES.map((s) => s.key) as [string, ...string[]];
const DANCE_SESSION_KEYS = DANCE_SESSIONS.map((s) => s.key) as [string, ...string[]];

// ---------- Auth ----------
export const emailField = z.string().trim().email("Enter a valid email address.").max(254);
export const passwordField = z.string().min(1, "Enter your password.").max(256);
export const newPasswordField = passwordField.min(10, "Use at least 10 characters.");
export const codeField = z.string().trim().regex(/^\d{4,8}$/, "Enter the code from the email.");
export const signInInput = z.object({ email: emailField, password: passwordField });
export const signUpInput = z.object({ name: z.string().trim().max(80), email: emailField, password: newPasswordField });
export const confirmInput = z.object({ email: emailField, password: passwordField, code: codeField });
export const emailOnlyInput = z.object({ email: emailField });
export const resetPasswordInput = z.object({ email: emailField, code: codeField, password: newPasswordField });

// ---------- Workouts ----------
export const exerciseInput = z.object({
  name: z.string().trim().min(1).max(80),
  sets: z.number().int().min(1).max(50).optional(),
  reps: z.string().trim().max(20).optional(),
  weightKg: z.number().positive().max(1000).optional(),
});
export const exercisesInput = z.array(exerciseInput).max(MAX_EXERCISES);
export const detailsInput = z
  .object({
    exercises: exercisesInput.optional(),
    durationSec: secs,
    distanceM: z.number().nonnegative().max(1_000_000).optional(),
    intervals: z
      .object({
        workSec: secs,
        restSec: secs,
        reps: z.number().int().nonnegative().max(500).optional(),
        warmupSec: secs,
        cooldownSec: secs,
      })
      .optional(),
    description: z.string().max(2000).optional(),
    avgHeartRate: z.number().int().min(30).max(250).optional(),
  })
  .optional();

export const workoutInput = z.object({
  id: id.optional(),
  date: day,
  startTime: z.string().regex(START_TIME_RE).optional(),
  startZone: z.string().max(64).optional(),
  originalDate: day.optional(), // the workout's current key date when editing
  type: z.enum(WORKOUT_TYPES),
  title: z.string().trim().min(1).max(200),
  autoTitle: z.boolean().optional(),
  location: z.string().trim().max(200).optional(),
  sport: z.enum(SPORT_KEYS).optional(),
  sportName: z.string().trim().max(60).optional(),
  sportSession: z.string().max(40).optional(),
  danceStyle: z.enum(DANCE_STYLE_KEYS).optional(),
  danceStyleName: z.string().trim().max(60).optional(),
  danceSession: z.enum(DANCE_SESSION_KEYS).optional(),
  routineId: z.string().max(64).optional(),
  routineName: z.string().trim().max(60).optional(),
  status: z.enum(WORKOUT_STATUSES),
  planned: detailsInput,
  actual: detailsInput,
  reason: z.string().max(1000).optional(),
  painLevel: z.number().int().min(0).max(10).optional(),
  injuryId: z.string().max(64).optional(),
  rpe: z.number().int().min(1).max(10).optional(),
  notes: z.string().max(5000).optional(),
});
export type WorkoutInput = z.infer<typeof workoutInput>;

export const repeatInput = z.object({
  weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  every: z.number().int().min(1).max(4),
  weeks: z.number().int().min(1).max(52),
});
export type RepeatInput = z.infer<typeof repeatInput>;

export const quickDoneInput = z.object({
  timeSec: z.number().int().positive().max(48 * 3600).optional(),
  distanceM: z.number().positive().max(1_000_000).optional(),
  extraAs: z.enum(["warmup", "cooldown"]),
});
export type QuickDoneInput = z.infer<typeof quickDoneInput>;

export const resolveInput = z.discriminatedUnion("status", [
  z.object({ status: z.literal("completed") }),
  z.object({ status: z.literal("missed") }),
  z.object({ status: z.literal("skipped"), reason: z.string().trim().min(1).max(1000) }),
]);
export type ResolveInput = z.infer<typeof resolveInput>;

export const copyTimes = z.number().int().min(1).max(52);

// ---------- Routines ----------
export const routineName = z.string().trim().min(1, "Give the routine a name").max(60);
export const routineInput = z.object({ id: id.optional(), name: routineName, exercises: exercisesInput });
export type RoutineInput = z.input<typeof routineInput>;

// ---------- Days ----------
export const dayPatchInput = z.object({
  notes: z.string().max(5000).nullable().optional(),
  drinks: z.number().min(0).max(HABITS.alcohol.max).nullable().optional(),
  sugaryDrinks: z.number().min(0).max(HABITS.sugary.max).nullable().optional(),
  tobacco: z.number().min(0).max(HABITS.tobacco.max).nullable().optional(),
  weightKg: z.number().positive().max(500).nullable().optional(),
});
export type DayPatchInput = z.infer<typeof dayPatchInput>;

// ---------- Profile / settings ----------
export const profileInput = z.object({
  displayName: z.string().trim().min(1).max(80),
  units: z.object({ distance: z.enum(DISTANCE_UNITS), weight: z.enum(WEIGHT_UNITS) }),
  weekStartsOn: z.union([z.literal(0), z.literal(1)]),
  clock: z.enum(["12h", "24h"]),
  habits: z.array(z.enum(HABIT_KINDS)).max(HABIT_KINDS.length),
  habitOnCalendar: z.enum(HABIT_KINDS).optional(),
  goals: z
    .array(
      z.object({
        id: z.string().regex(/^[A-Za-z0-9]{1,40}$/),
        name: z.string().max(GOAL_NAME_MAX * 2),
        emoji: z.string().max(16).optional(),
        off: z.boolean().optional(),
      }),
    )
    .max(MAX_GOALS * 4),
  goalOnCalendar: z.string().max(40).optional(),
  share: z.enum(SHARE_LEVELS),
  shareConsistency: z.boolean().optional(),
  trackWeight: z.boolean(),
  timeZone: z.string().max(64).optional(),
});
export type ProfileInput = z.infer<typeof profileInput>;

// ---------- Injuries ----------
export const injuryInput = z.object({
  id: id.optional(),
  name: z.string().trim().min(1).max(120),
  bodyPart: z.string().max(80).optional(),
  startDate: day,
  endDate: day.optional(),
  status: z.enum(["active", "recovering", "healed"]),
  notes: z.string().max(5000).optional(),
});
export type InjuryInput = z.infer<typeof injuryInput>;

// ---------- Benchmarks ----------
export const benchmarkInput = z.object({
  name: z.string().trim().min(1).max(120),
  category: z.enum(BENCHMARK_CATEGORIES),
  metricKind: z.enum(METRIC_KINDS),
  direction: z.enum(["lower", "higher"]),
  unit: z.string().trim().max(20).optional(),
});
export type BenchmarkInput = z.infer<typeof benchmarkInput>;

export const resultInput = z.object({
  benchmarkId: id,
  date: day,
  value: z.number().finite().nonnegative(),
  reps: z.number().int().min(1).max(1000).optional(),
  workoutId: z.string().max(64).optional(),
  notes: z.string().max(2000).optional(),
});
export type ResultInput = z.infer<typeof resultInput>;

// ---------- Social ----------
export const clubName = z.string().trim().min(1, "Give the club a name").max(60, "Keep the name under 60 characters");
export const joinCode = z.string().max(40);

// ---------- Calendar feed ----------
export const calendarOptionsInput = z.object({ includeNotes: z.boolean(), plannedOnly: z.boolean() });
