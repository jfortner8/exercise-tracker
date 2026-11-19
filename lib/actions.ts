"use server";

import { addDays, differenceInCalendarDays, format, parseISO, startOfWeek } from "date-fns";
import { refresh } from "next/cache";
import { ulid } from "ulid";
import { z } from "zod";
import { BENCHMARK_CATALOG } from "@/lib/benchmarks/catalog";
import { requireUser } from "@/lib/dal";
import { repeatDates, START_TIME_RE, validTimeZone } from "@/lib/domain";
import { activeGoals, cleanGoals, GOAL_NAME_MAX, MAX_GOALS } from "@/lib/goals";
import { HABIT_KINDS, HABIT_SINCE_FIRST_DAY, HABITS, profileHabits, type HabitKind } from "@/lib/habits";
import { cleanExercises, findRoutineByName, MAX_EXERCISES } from "@/lib/routines";
import { quickActual, type ExtraAs } from "@/lib/quick-done";
import { DISTANCE_TYPES } from "@/lib/activities";
import { linkableWorkouts } from "@/lib/benchmarks/linking";
import * as repo from "@/lib/db/repo";
import { syncLeaderboard } from "@/lib/leaderboard";
import { DANCE_SESSIONS, DANCE_STYLES } from "@/lib/dance";
import { SPORTS, sportMeta } from "@/lib/sports";
import {
  BENCHMARK_CATEGORIES,
  DISTANCE_UNITS,
  METRIC_KINDS,
  SHARE_LEVELS,
  WORKOUT_STATUSES,
  WEIGHT_UNITS,
  WORKOUT_TYPES,
  type Clock,
  type Share,
  type Units,
  type Workout,
  type WorkoutDetails,
} from "@/lib/types";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const SPORT_KEYS = SPORTS.map((s) => s.key) as [string, ...string[]];
const DANCE_STYLE_KEYS = DANCE_STYLES.map((s) => s.key) as [string, ...string[]];
const DANCE_SESSION_KEYS = DANCE_SESSIONS.map((s) => s.key) as [string, ...string[]];

/** The Sports tab appears once a sport workout has been completed. */
async function noteSport(sub: string, w: Pick<Workout, "type" | "status">) {
  if (w.type === "sport" && (w.status === "completed" || w.status === "partial")) await repo.markHasSports(sub);
}
const id = z.string().min(1).max(64);
const secs = z.number().nonnegative().max(60 * 60 * 48).optional();
const exercise = z.object({
  name: z.string().trim().min(1).max(80),
  sets: z.number().int().min(1).max(50).optional(),
  reps: z.string().trim().max(20).optional(),
  weightKg: z.number().positive().max(1000).optional(),
});
const exercises = z.array(exercise).max(MAX_EXERCISES);
const details = z
  .object({
    exercises: exercises.optional(),
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

const workoutInput = z.object({
  id: id.optional(),
  date: day,
  startTime: z.string().regex(START_TIME_RE).optional(),
  originalDate: day.optional(), // the workout's current key date when editing
  type: z.enum(WORKOUT_TYPES),
  title: z.string().trim().min(1).max(200),
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
  planned: details,
  actual: details,
  reason: z.string().max(1000).optional(),
  painLevel: z.number().int().min(0).max(10).optional(),
  injuryId: z.string().max(64).optional(),
  rpe: z.number().int().min(1).max(10).optional(),
  notes: z.string().max(5000).optional(),
});
export type WorkoutInput = z.infer<typeof workoutInput>;

const repeatInput = z.object({
  weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  every: z.number().int().min(1).max(4),
  weeks: z.number().int().min(1).max(52),
});
export type RepeatInput = z.infer<typeof repeatInput>;

const routineName = z.string().trim().min(1, "Give the routine a name").max(60);

// ---------- Routines (the Routines tab) ----------
export async function saveRoutineAction(raw: { id?: string; name: string; exercises: z.input<typeof exercises> }) {
  const { sub } = await requireUser();
  const p = z.object({ id: id.optional(), name: routineName, exercises }).parse(raw);
  const list = cleanExercises(p.exercises);
  if (!list.length) return { error: "Add at least one exercise." };
  const all = await repo.listRoutines(sub);
  const clash = findRoutineByName(all, p.name);
  if (clash && clash.id !== p.id) return { error: `You already have a routine called "${clash.name}".` };
  const existing = p.id ? all.find((r) => r.id === p.id) : undefined;
  if (p.id && !existing) return { error: "That routine no longer exists." };
  const now = new Date().toISOString();
  await repo.saveRoutine(sub, { id: existing?.id ?? ulid(), name: p.name, exercises: list, createdAt: existing?.createdAt ?? now, updatedAt: now });
  await repo.setHasRoutines(sub, true);
  refresh();
  return { ok: true as const };
}

export async function deleteRoutineAction(routineId: string) {
  const { sub } = await requireUser();
  await repo.deleteRoutine(sub, id.parse(routineId));
  if (!(await repo.listRoutines(sub)).length) await repo.setHasRoutines(sub, false);
  refresh();
}

/**
 * Save a workout. With `repeat` (new planned workouts only) it is created on each matching day,
 * as separate workouts sharing a seriesId, so each one can be logged, moved or edited on its own.
 */
export async function saveWorkoutAction(raw: WorkoutInput, rawRepeat?: RepeatInput, rawRoutine?: { name: string }) {
  const { sub } = await requireUser();
  const parsed = workoutInput.parse(raw);
  const repeat = rawRepeat ? repeatInput.parse(rawRepeat) : undefined;
  const newRoutine = rawRoutine ? routineName.parse(rawRoutine.name) : undefined;
  const strength = parsed.type === "strength";
  // Exercises and routines only belong on strength workouts.
  const keepExercises = (d: typeof parsed.planned): WorkoutDetails | undefined => {
    if (!d) return d;
    const list = strength ? cleanExercises(d.exercises) : [];
    const { exercises: _e, ...rest } = d;
    void _e;
    return list.length ? { ...rest, exercises: list } : Object.keys(rest).length ? rest : undefined;
  };
  if (repeat && (parsed.id || parsed.status !== "planned")) throw new Error("Only new planned workouts can repeat");
  // Sport details only belong on sport workouts; a session must be one the sport offers.
  const sportDef = parsed.type === "sport" ? sportMeta(parsed.sport) : undefined;
  const input = {
    ...parsed,
    sport: sportDef?.key,
    sportName: sportDef?.key === "other" ? parsed.sportName || undefined : undefined,
    sportSession: sportDef?.sessions.some((s) => s.key === parsed.sportSession) ? parsed.sportSession : undefined,
    // Dance style and session only belong on dance workouts.
    danceStyle: parsed.type === "dance" ? parsed.danceStyle : undefined,
    danceStyleName: parsed.type === "dance" && parsed.danceStyle === "other" ? parsed.danceStyleName || undefined : undefined,
    danceSession: parsed.type === "dance" ? parsed.danceSession : undefined,
    planned: keepExercises(parsed.planned),
    actual: keepExercises(parsed.actual),
    routineId: strength ? parsed.routineId || undefined : undefined,
    routineName: strength && parsed.routineId ? parsed.routineName || undefined : undefined,
  };
  const now = new Date().toISOString();

  // "Save as a routine": created from what was done once logged, otherwise the plan.
  if (newRoutine) {
    if (!strength) throw new Error("Only strength workouts have routines");
    const list = input.actual?.exercises?.length ? input.actual.exercises : (input.planned?.exercises ?? []);
    if (!list.length) throw new Error("Add at least one exercise to save a routine");
    if (findRoutineByName(await repo.listRoutines(sub), newRoutine)) throw new Error(`You already have a routine called "${newRoutine}"`);
    const routine = { id: ulid(), name: newRoutine, exercises: list, createdAt: now, updatedAt: now };
    await repo.saveRoutine(sub, routine);
    await repo.setHasRoutines(sub, true);
    input.routineId = routine.id;
    input.routineName = routine.name;
  }

  if (input.id && input.originalDate) {
    const existing = await repo.getWorkout(sub, input.originalDate, input.id);
    if (!existing) throw new Error("Workout not found");
    const { originalDate: keyDate, ...rest } = input;
    // The form always sends the whole workout, so replace rather than merge:
    // a field cleared in the form arrives as absent and must not keep its old value.
    const updated: Workout = {
      ...rest,
      id: existing.id,
      date: existing.date,
      originalDate: existing.originalDate,
      seriesId: existing.seriesId,
      createdAt: existing.createdAt,
      updatedAt: now,
    };
    if (input.date !== keyDate) await repo.moveWorkout(sub, updated, input.date);
    else await repo.saveWorkout(sub, updated);
  } else if (repeat) {
    const { originalDate: _ignored, ...rest } = input;
    void _ignored;
    const weekStartsOn = (await repo.getProfile(sub))?.weekStartsOn ?? 1;
    const dates = repeatDates(input.date, repeat.weekdays, repeat.every, repeat.weeks, weekStartsOn);
    if (!dates.length) throw new Error("None of the chosen days fall in that range");
    const seriesId = ulid();
    await repo.saveWorkouts(
      sub,
      dates.map((date) => ({ ...rest, date, seriesId, id: ulid(), createdAt: now, updatedAt: now })),
    );
  } else {
    const { originalDate: _ignored, ...rest } = input;
    void _ignored;
    await repo.saveWorkout(sub, { ...rest, id: ulid(), createdAt: now, updatedAt: now });
  }
  await noteSport(sub, input);
  refresh();
}

export async function deleteWorkoutAction(date: string, workoutId: string) {
  const { sub } = await requireUser();
  await repo.deleteWorkout(sub, day.parse(date), id.parse(workoutId));
  refresh();
}

/**
 * Delete a repeating workout and the rest of its series dated on or after it. Only workouts still
 * planned go; ones already logged (done, missed, skipped…) stay as history. Returns how many went.
 */
export async function deleteSeriesFromAction(date: string, workoutId: string) {
  const { sub } = await requireUser();
  const w = await repo.getWorkout(sub, day.parse(date), id.parse(workoutId));
  if (!w) throw new Error("Workout not found");
  if (!w.seriesId) {
    await repo.deleteWorkout(sub, w.date, w.id);
    refresh();
    return { deleted: 1 };
  }
  const later = (await repo.listWorkouts(sub, w.date, "9999-12-31")).filter(
    (o) => o.seriesId === w.seriesId && (o.id === w.id || o.status === "planned"),
  );
  await repo.deleteWorkouts(sub, later);
  refresh();
  return { deleted: later.length };
}

export async function moveWorkoutAction(date: string, workoutId: string, toDate: string) {
  const { sub } = await requireUser();
  const w = await repo.getWorkout(sub, day.parse(date), id.parse(workoutId));
  if (!w) throw new Error("Workout not found");
  if (w.date !== day.parse(toDate)) await repo.moveWorkout(sub, w, toDate);
  refresh();
}

/** Mark a planned workout done, copying the plan into "actual" so only differences need editing. */
/**
 * The quick "Done" panel: log a planned workout as done with its real time and distance. The plan's
 * details carry over; time past the intervals goes to the warm-up or cool-down (see lib/quick-done.ts).
 */
export async function quickDoneAction(
  date: string,
  workoutId: string,
  raw: { timeSec?: number; distanceM?: number; extraAs: ExtraAs },
) {
  const { sub } = await requireUser();
  const input = z
    .object({
      timeSec: z.number().int().positive().max(48 * 3600).optional(),
      distanceM: z.number().positive().max(1_000_000).optional(),
      extraAs: z.enum(["warmup", "cooldown"]),
    })
    .parse(raw);
  const w = await repo.getWorkout(sub, day.parse(date), id.parse(workoutId));
  if (!w) throw new Error("Workout not found");
  await repo.saveWorkout(sub, {
    ...w,
    status: "completed",
    actual: quickActual(w.actual ?? w.planned, {
      ...input,
      // Distance only where you cover ground.
      distanceM: DISTANCE_TYPES.has(w.type) && input.distanceM ? Math.round(input.distanceM) : undefined,
    }),
    reason: undefined,
    updatedAt: new Date().toISOString(),
  });
  await noteSport(sub, { type: w.type, status: "completed" });
  refresh();
}

/** Mark a day as an intentional rest day. `today` is the client's local date. */
export async function markRestDayAction(date: string, today: string) {
  const { sub } = await requireUser();
  const d = day.parse(date);
  const now = new Date().toISOString();
  await repo.saveWorkout(sub, {
    id: ulid(),
    date: d,
    type: "rest",
    title: "Rest",
    status: d <= day.parse(today) ? "completed" : "planned",
    createdAt: now,
    updatedAt: now,
  });
  refresh();
}

/** One-tap outcome for a planned workout: done as planned, missed, or skipped with a reason. */
export async function resolveWorkoutAction(
  date: string,
  workoutId: string,
  status: "completed" | "missed" | "skipped",
  reason?: string,
) {
  const { sub } = await requireUser();
  const input = z
    .discriminatedUnion("status", [
      z.object({ status: z.literal("completed") }),
      z.object({ status: z.literal("missed") }),
      z.object({ status: z.literal("skipped"), reason: z.string().trim().min(1).max(1000) }),
    ])
    .parse({ status, reason });
  const w = await repo.getWorkout(sub, day.parse(date), id.parse(workoutId));
  if (!w) throw new Error("Workout not found");
  await repo.saveWorkout(sub, {
    ...w,
    status: input.status,
    actual: input.status === "completed" ? (w.actual ?? w.planned) : undefined,
    reason: input.status === "skipped" ? input.reason : undefined,
    updatedAt: new Date().toISOString(),
  });
  await noteSport(sub, { type: w.type, status: input.status });
  refresh();
}

/**
 * Swap days: move the dragged workout to `toDate` and that day's planned workouts to its old day.
 * Both sides keep `originalDate`, so the calendar shows "moved from …".
 */
export async function swapDaysAction(fromDate: string, workoutId: string, toDate: string) {
  const { sub } = await requireUser();
  const [from, to] = [day.parse(fromDate), day.parse(toDate)];
  if (from === to) return;
  const w = await repo.getWorkout(sub, from, id.parse(workoutId));
  if (!w) throw new Error("Workout not found");
  const others = (await repo.listWorkouts(sub, to, to)).filter((o) => o.status === "planned");
  await repo.moveWorkout(sub, w, to);
  for (const o of others) await repo.moveWorkout(sub, o, from);
  refresh();
}

/** Copy a week's workouts (as planned, without results) to the week starting `toStart`, repeated `times` weeks. */
export async function copyWeekAction(fromStart: string, toStart: string, times: number) {
  const { sub } = await requireUser();
  const from = parseISO(day.parse(fromStart));
  const weekStartsOn = (await repo.getProfile(sub))?.weekStartsOn ?? 1;
  // Snap the target to the start of its week so weekdays line up.
  const to = startOfWeek(parseISO(day.parse(toStart)), { weekStartsOn });
  const n = z.number().int().min(1).max(52).parse(times);
  const source = await repo.listWorkouts(sub, fromStart, format(addDays(from, 6), "yyyy-MM-dd"));
  if (!source.length) return { copied: 0 };
  const now = new Date().toISOString();
  const copies: Workout[] = [];
  for (let k = 0; k < n; k++) {
    const offset = differenceInCalendarDays(to, from) + k * 7;
    for (const w of source) {
      copies.push({
        id: ulid(),
        date: format(addDays(parseISO(w.date), offset), "yyyy-MM-dd"),
        startTime: w.startTime,
        type: w.type,
        title: w.title,
        location: w.location,
        sport: w.sport,
        sportName: w.sportName,
        sportSession: w.sportSession,
        danceStyle: w.danceStyle,
        danceStyleName: w.danceStyleName,
        danceSession: w.danceSession,
        status: "planned",
        planned: w.planned ?? w.actual,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
  await repo.saveWorkouts(sub, copies);
  refresh();
  return { copied: copies.length };
}

// ---------- Day logs ----------
/**
 * Update a day's notes, drinks and/or bodyweight. A field left out keeps its saved value;
 * null clears it. (So saving notes never wipes drinks or weight hidden by settings.)
 */
export async function saveDayAction(
  date: string,
  patch: {
    notes?: string | null;
    drinks?: number | null;
    sugaryDrinks?: number | null;
    tobacco?: number | null;
    weightKg?: number | null;
  },
) {
  const { sub } = await requireUser();
  const d = day.parse(date);
  const p = z
    .object({
      notes: z.string().max(5000).nullable().optional(),
      drinks: z.number().min(0).max(HABITS.alcohol.max).nullable().optional(),
      sugaryDrinks: z.number().min(0).max(HABITS.sugary.max).nullable().optional(),
      tobacco: z.number().min(0).max(HABITS.tobacco.max).nullable().optional(),
      weightKg: z.number().positive().max(500).nullable().optional(),
    })
    .parse(patch);
  const existing = (await repo.getDay(sub, d)) ?? { date: d };
  const pick = <K extends keyof typeof p>(k: K, old: unknown) => (p[k] === undefined ? old : (p[k] ?? undefined));
  await repo.saveDay(sub, {
    date: d,
    notes: (pick("notes", existing.notes) as string | undefined)?.trim() || undefined,
    drinks: (pick("drinks", existing.drinks) as number | undefined) || undefined,
    sugaryDrinks: (pick("sugaryDrinks", existing.sugaryDrinks) as number | undefined) || undefined,
    tobacco: (pick("tobacco", existing.tobacco) as number | undefined) || undefined,
    weightKg: pick("weightKg", existing.weightKg) as number | undefined,
  });
  refresh();
}

/** Check a daily goal off for a day, or un-check it. Leaves the day's other fields alone. */
export async function setGoalDoneAction(date: string, goalId: string, done: boolean) {
  const { sub } = await requireUser();
  const d = day.parse(date);
  const profile = await repo.getProfile(sub);
  if (!profile || !activeGoals(profile).some((g) => g.id === goalId)) throw new Error("Unknown goal");
  const existing = (await repo.getDay(sub, d)) ?? { date: d };
  const rest = (existing.goalsDone ?? []).filter((id) => id !== goalId);
  const goalsDone = done ? [...rest, goalId] : rest;
  await repo.saveDay(sub, { ...existing, date: d, goalsDone: goalsDone.length ? goalsDone : undefined });
  refresh();
}

// ---------- Profile ----------
export async function saveProfileAction(raw: {
  displayName: string;
  units: Units;
  weekStartsOn: 0 | 1;
  clock: Clock;
  habits: HabitKind[];
  habitOnCalendar?: HabitKind;
  goals: { id: string; name: string; emoji?: string; off?: boolean }[];
  goalOnCalendar?: string;
  share: Share;
  trackWeight: boolean;
  timeZone?: string;
}) {
  const { sub, email } = await requireUser();
  const p = z
    .object({
      displayName: z.string().trim().min(1).max(80),
      units: z.object({ distance: z.enum(DISTANCE_UNITS), weight: z.enum(WEIGHT_UNITS) }),
      weekStartsOn: z.union([z.literal(0), z.literal(1)]),
      clock: z.enum(["12h", "24h"]),
      habits: z.array(z.enum(HABIT_KINDS)).max(HABIT_KINDS.length),
      habitOnCalendar: z.enum(HABIT_KINDS).optional(),
      goals: z
        .array(z.object({ id: z.string().regex(/^[A-Za-z0-9]{1,40}$/), name: z.string().max(GOAL_NAME_MAX * 2), emoji: z.string().max(16).optional(), off: z.boolean().optional() }))
        .max(MAX_GOALS * 4),
      goalOnCalendar: z.string().max(40).optional(),
      share: z.enum(SHARE_LEVELS),
      trackWeight: z.boolean(),
      timeZone: z.string().max(64).optional(),
    })
    .parse(raw);
  const existing = await repo.getProfile(sub);
  const habits = profileHabits({ habits: p.habits });
  // A counter's start is the first day it was turned on; turning it off and on again keeps it.
  const habitStarts = { ...existing?.habitStarts };
  const wasOn = existing ? profileHabits(existing) : [];
  // "Today" where the user is (the server runs in UTC); en-CA formats as YYYY-MM-DD.
  const tz = validTimeZone(p.timeZone) ? p.timeZone : validTimeZone(existing?.timeZone) ? existing.timeZone : "UTC";
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
  // Counters already on with no start (alcohol from the old "Track drinks") count from the first day.
  for (const k of wasOn) habitStarts[k] ??= HABIT_SINCE_FIRST_DAY;
  for (const k of habits) habitStarts[k] ??= today;
  const goals = cleanGoals(p.goals, existing?.goals, today);
  // Keep internal fields that aren't part of the settings form.
  await repo.saveProfile(sub, {
    ...p,
    goals,
    goalOnCalendar: activeGoals({ goals }).some((g) => g.id === p.goalOnCalendar) ? p.goalOnCalendar : activeGoals({ goals })[0]?.id,
    habits,
    habitOnCalendar: p.habitOnCalendar && habits.includes(p.habitOnCalendar) ? p.habitOnCalendar : habits[0],
    habitStarts,
    trackDrinks: habits.includes("alcohol"),
    email,
    timeZone: validTimeZone(p.timeZone) ? p.timeZone : existing?.timeZone,
    hasSports: existing?.hasSports,
    hasRoutines: existing?.hasRoutines,
    friendCode: existing?.friendCode,
    calendarToken: existing?.calendarToken,
    calendarIncludeNotes: existing?.calendarIncludeNotes,
    calendarPlannedOnly: existing?.calendarPlannedOnly,
  });
  // Opting in/out or renaming changes what others see on leaderboards.
  await syncLeaderboard(sub);
  if (existing && existing.displayName !== p.displayName) await repo.updateSocialName(sub, p.displayName);
  refresh();
}

// ---------- Injuries ----------
const injuryInput = z.object({
  id: id.optional(),
  name: z.string().trim().min(1).max(120),
  bodyPart: z.string().max(80).optional(),
  startDate: day,
  endDate: day.optional(),
  status: z.enum(["active", "recovering", "healed"]),
  notes: z.string().max(5000).optional(),
});
export async function saveInjuryAction(raw: z.infer<typeof injuryInput>) {
  const { sub } = await requireUser();
  const i = injuryInput.parse(raw);
  await repo.saveInjury(sub, { ...i, id: i.id ?? ulid() });
  refresh();
}
export async function deleteInjuryAction(injuryId: string) {
  const { sub } = await requireUser();
  await repo.deleteInjury(sub, id.parse(injuryId));
  refresh();
}

// ---------- Benchmarks ----------
export async function trackCatalogBenchmarkAction(key: string) {
  const { sub } = await requireUser();
  const entry = BENCHMARK_CATALOG.find((c) => c.key === key);
  if (!entry) throw new Error("Unknown benchmark");
  const existing = await repo.listBenchmarks(sub);
  if (existing.some((b) => b.catalogKey === key)) return;
  await repo.saveBenchmark(sub, {
    id: ulid(),
    name: entry.name,
    category: entry.category,
    metricKind: entry.metricKind,
    direction: entry.direction,
    unit: entry.unit,
    catalogKey: entry.key,
    createdAt: new Date().toISOString(),
  });
  refresh();
}

const benchmarkInput = z.object({
  name: z.string().trim().min(1).max(120),
  category: z.enum(BENCHMARK_CATEGORIES),
  metricKind: z.enum(METRIC_KINDS),
  direction: z.enum(["lower", "higher"]),
  unit: z.string().trim().max(20).optional(),
});
export async function createBenchmarkAction(raw: z.infer<typeof benchmarkInput>) {
  const { sub } = await requireUser();
  const b = benchmarkInput.parse(raw);
  const newId = ulid();
  await repo.saveBenchmark(sub, { ...b, unit: b.unit || undefined, id: newId, createdAt: new Date().toISOString() });
  refresh();
  return newId;
}

export async function deleteBenchmarkAction(benchmarkId: string) {
  const { sub } = await requireUser();
  await repo.deleteBenchmark(sub, id.parse(benchmarkId));
  await syncLeaderboard(sub);
  refresh();
}

const resultInput = z.object({
  benchmarkId: id,
  date: day,
  value: z.number().finite().nonnegative(),
  reps: z.number().int().min(1).max(1000).optional(),
  workoutId: z.string().max(64).optional(),
  notes: z.string().max(2000).optional(),
});
/** Loads the benchmark and checks a linked workout: this user's, on the result's day, of a fitting type. */
async function checkResult(sub: string, r: z.infer<typeof resultInput>) {
  const bm = await repo.getBenchmark(sub, r.benchmarkId);
  if (!bm) throw new Error("Benchmark not found");
  if (r.workoutId) {
    const w = await repo.getWorkout(sub, r.date, r.workoutId);
    if (!w) throw new Error("That workout isn't on the result's date");
    if (!linkableWorkouts(bm, [w]).length) throw new Error(`${bm.name} can't be part of a ${w.type} workout`);
  }
  return bm;
}

export async function addResultAction(raw: z.infer<typeof resultInput>) {
  const { sub } = await requireUser();
  const r = resultInput.parse(raw);
  const bm = await checkResult(sub, r);
  await repo.saveResult(sub, { ...r, id: ulid() });
  if (bm.catalogKey) await syncLeaderboard(sub, bm.catalogKey);
  refresh();
}

/** Edit a result (value, reps, date, notes, workout link). Changing the date moves it. */
export async function updateResultAction(raw: z.infer<typeof resultInput> & { id: string; originalDate: string }) {
  const { sub } = await requireUser();
  const r = resultInput.parse(raw);
  const resultId = id.parse(raw.id);
  const old = await repo.getResult(sub, { benchmarkId: r.benchmarkId, date: day.parse(raw.originalDate), id: resultId });
  if (!old) throw new Error("Result not found");
  const bm = await checkResult(sub, r);
  // The form sends the whole result, so cleared fields (notes, link) are dropped rather than kept.
  await repo.replaceResult(sub, old, { ...r, id: resultId });
  // An edited value or date can change the PB and its history on the leaderboards.
  if (bm.catalogKey) await syncLeaderboard(sub, bm.catalogKey);
  refresh();
}

export async function deleteResultAction(benchmarkId: string, date: string, resultId: string) {
  const { sub } = await requireUser();
  await repo.deleteResult(sub, { benchmarkId: id.parse(benchmarkId), date: day.parse(date), id: id.parse(resultId) });
  const bm = await repo.getBenchmark(sub, benchmarkId);
  if (bm?.catalogKey) await syncLeaderboard(sub, bm.catalogKey);
  refresh();
}

/** Workouts on one day, for the benchmark form's "Part of workout" picker. */
export async function workoutsOnDayAction(date: string) {
  const { sub } = await requireUser();
  const d = day.parse(date);
  return repo.listWorkouts(sub, d, d);
}
