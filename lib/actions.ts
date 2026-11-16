"use server";

import { addDays, differenceInCalendarDays, format, parseISO, startOfWeek } from "date-fns";
import { refresh } from "next/cache";
import { ulid } from "ulid";
import { z } from "zod";
import { BENCHMARK_CATALOG } from "@/lib/benchmarks/catalog";
import { requireUser } from "@/lib/dal";
import * as repo from "@/lib/db/repo";
import {
  BENCHMARK_CATEGORIES,
  DISTANCE_UNITS,
  METRIC_KINDS,
  WORKOUT_STATUSES,
  WEIGHT_UNITS,
  WORKOUT_TYPES,
  type Units,
  type Workout,
} from "@/lib/types";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const id = z.string().min(1).max(64);
const secs = z.number().nonnegative().max(60 * 60 * 48).optional();
const details = z
  .object({
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
  })
  .optional();

const workoutInput = z.object({
  id: id.optional(),
  date: day,
  originalDate: day.optional(), // the workout's current key date when editing
  type: z.enum(WORKOUT_TYPES),
  title: z.string().trim().min(1).max(200),
  location: z.string().trim().max(200).optional(),
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

export async function saveWorkoutAction(raw: WorkoutInput) {
  const { sub } = await requireUser();
  const input = workoutInput.parse(raw);
  const now = new Date().toISOString();

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
      createdAt: existing.createdAt,
      updatedAt: now,
    };
    if (input.date !== keyDate) await repo.moveWorkout(sub, updated, input.date);
    else await repo.saveWorkout(sub, updated);
  } else {
    const { originalDate: _ignored, ...rest } = input;
    void _ignored;
    await repo.saveWorkout(sub, { ...rest, id: ulid(), createdAt: now, updatedAt: now });
  }
  refresh();
}

export async function deleteWorkoutAction(date: string, workoutId: string) {
  const { sub } = await requireUser();
  await repo.deleteWorkout(sub, day.parse(date), id.parse(workoutId));
  refresh();
}

export async function moveWorkoutAction(date: string, workoutId: string, toDate: string) {
  const { sub } = await requireUser();
  const w = await repo.getWorkout(sub, day.parse(date), id.parse(workoutId));
  if (!w) throw new Error("Workout not found");
  if (w.date !== day.parse(toDate)) await repo.moveWorkout(sub, w, toDate);
  refresh();
}

/** Mark a planned workout done, copying the plan into "actual" so only differences need editing. */
export async function logAsDoneAction(date: string, workoutId: string) {
  return resolveWorkoutAction(date, workoutId, "completed");
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
        type: w.type,
        title: w.title,
        location: w.location,
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
export async function saveDayAction(date: string, notes: string | undefined, drinks: number | undefined) {
  const { sub } = await requireUser();
  await repo.saveDay(sub, {
    date: day.parse(date),
    notes: z.string().max(5000).optional().parse(notes)?.trim() || undefined,
    drinks: z.number().min(0).max(50).optional().parse(drinks) || undefined,
  });
  refresh();
}

// ---------- Profile ----------
export async function saveProfileAction(raw: {
  displayName: string;
  units: Units;
  weekStartsOn: 0 | 1;
  trackDrinks: boolean;
}) {
  const { sub, email } = await requireUser();
  const p = z
    .object({
      displayName: z.string().trim().min(1).max(80),
      units: z.object({ distance: z.enum(DISTANCE_UNITS), weight: z.enum(WEIGHT_UNITS) }),
      weekStartsOn: z.union([z.literal(0), z.literal(1)]),
      trackDrinks: z.boolean(),
    })
    .parse(raw);
  await repo.saveProfile(sub, { ...p, email });
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
export async function addResultAction(raw: z.infer<typeof resultInput>) {
  const { sub } = await requireUser();
  const r = resultInput.parse(raw);
  if (!(await repo.getBenchmark(sub, r.benchmarkId))) throw new Error("Benchmark not found");
  await repo.saveResult(sub, { ...r, id: ulid() });
  refresh();
}

export async function deleteResultAction(benchmarkId: string, date: string, resultId: string) {
  const { sub } = await requireUser();
  await repo.deleteResult(sub, { benchmarkId: id.parse(benchmarkId), date: day.parse(date), id: id.parse(resultId) });
  refresh();
}
