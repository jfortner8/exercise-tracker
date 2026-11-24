import "server-only";
import { addDays, differenceInCalendarDays, format, parseISO, startOfWeek } from "date-fns";
import { ulid } from "ulid";
import {
  copyTimes,
  day,
  id,
  quickDoneInput,
  repeatInput,
  resolveInput,
  routineName,
  workoutInput,
  type RepeatInput,
  type WorkoutInput,
} from "@et/core/schemas";
import { repeatDates, validTimeZone } from "@et/core/domain";
import { cleanExercises, findRoutineByName } from "@et/core/routines";
import { quickActual, type ExtraAs } from "@et/core/quick-done";
import { autoTitle, DISTANCE_TYPES } from "@et/core/activities";
import * as repo from "@/lib/db/repo";
import { sportMeta } from "@et/core/sports";
import type { Workout, WorkoutDetails } from "@et/core/types";
import { ApiError, notFound } from "@/lib/api-error";
import { syncAfterChange } from "./sync";

/*
 * Workouts on the calendar: create, edit, repeat, move, swap, copy, log and delete.
 * Plain functions of the user id: the website's server actions and the /api/v1 routes both call them.
 */

export async function noteSport(sub: string, w: Pick<Workout, "type" | "status">) {
  if (w.type === "sport" && (w.status === "completed" || w.status === "partial")) await repo.markHasSports(sub);
}

/**
 * Save a workout. With `repeat` (new planned workouts only) it is created on each matching day,
 * as separate workouts sharing a seriesId, so each one can be logged, moved or edited on its own.
 */
export async function saveWorkout(sub: string, raw: WorkoutInput, rawRepeat?: RepeatInput, rawRoutine?: { name: string }) {
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
  if (repeat && (parsed.id || parsed.status !== "planned")) throw new ApiError(400, "Only new planned workouts can repeat");
  // Sport details only belong on sport workouts; a session must be one the sport offers.
  const sportDef = parsed.type === "sport" ? sportMeta(parsed.sport) : undefined;
  const input = {
    ...parsed,
    // A start time keeps the zone it was entered in; one without falls back to the profile's.
    startZone: parsed.startTime
      ? validTimeZone(parsed.startZone)
        ? parsed.startZone
        : (await repo.getProfile(sub))?.timeZone
      : undefined,
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
    if (!strength) throw new ApiError(400, "Only strength workouts have routines");
    const list = input.actual?.exercises?.length ? input.actual.exercises : (input.planned?.exercises ?? []);
    if (!list.length) throw new ApiError(400, "Add at least one exercise to save a routine");
    if (findRoutineByName(await repo.listRoutines(sub), newRoutine)) throw new ApiError(400, `You already have a routine called "${newRoutine}"`);
    const routine = { id: ulid(), name: newRoutine, exercises: list, createdAt: now, updatedAt: now };
    await repo.saveRoutine(sub, routine);
    await repo.setHasRoutines(sub, true);
    input.routineId = routine.id;
    input.routineName = routine.name;
  }

  if (input.id && input.originalDate) {
    const existing = await repo.getWorkout(sub, input.originalDate, input.id);
    if (!existing) throw notFound("Workout");
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
    if (!dates.length) throw new ApiError(400, "None of the chosen days fall in that range");
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
  await syncAfterChange(sub);
}

export async function deleteWorkout(sub: string, date: string, workoutId: string) {
  await repo.deleteWorkout(sub, day.parse(date), id.parse(workoutId));
  await syncAfterChange(sub);
}

/**
 * Delete a repeating workout and the rest of its series dated on or after it. Only workouts still
 * planned go; ones already logged (done, missed, skipped…) stay as history. Returns how many went.
 */
export async function deleteSeriesFrom(sub: string, date: string, workoutId: string) {
  const w = await repo.getWorkout(sub, day.parse(date), id.parse(workoutId));
  if (!w) throw notFound("Workout");
  if (!w.seriesId) {
    await repo.deleteWorkout(sub, w.date, w.id);
    await syncAfterChange(sub);
    return { deleted: 1 };
  }
  const later = (await repo.listWorkouts(sub, w.date, "9999-12-31")).filter(
    (o) => o.seriesId === w.seriesId && (o.id === w.id || o.status === "planned"),
  );
  await repo.deleteWorkouts(sub, later);
  await syncAfterChange(sub);
  return { deleted: later.length };
}

export async function moveWorkout(sub: string, date: string, workoutId: string, toDate: string) {
  const w = await repo.getWorkout(sub, day.parse(date), id.parse(workoutId));
  if (!w) throw notFound("Workout");
  if (w.date !== day.parse(toDate)) await repo.moveWorkout(sub, w, toDate);
  await syncAfterChange(sub);
}

/** Mark a planned workout done, copying the plan into "actual" so only differences need editing. */
/**
 * The quick "Done" panel: log a planned workout as done with its real time and distance. The plan's
 * details carry over; time past the intervals goes to the warm-up or cool-down (see lib/quick-done.ts).
 */
export async function quickDone(
  sub: string,
  date: string,
  workoutId: string,
  raw: { timeSec?: number; distanceM?: number; extraAs: ExtraAs },
) {
  const input = quickDoneInput.parse(raw);
  const w = await repo.getWorkout(sub, day.parse(date), id.parse(workoutId));
  if (!w) throw notFound("Workout");
  const done: Workout = {
    ...w,
    status: "completed",
    actual: quickActual(w.actual ?? w.planned, {
      ...input,
      // Distance only where you cover ground.
      distanceM: DISTANCE_TYPES.has(w.type) && input.distanceM ? Math.round(input.distanceM) : undefined,
    }),
    reason: undefined,
    updatedAt: new Date().toISOString(),
  };
  // A generated title follows what was really done: a planned "10 km Run" done as 12 km.
  if (w.autoTitle) done.title = autoTitle(done, (await repo.getProfile(sub))?.units);
  await repo.saveWorkout(sub, done);
  await noteSport(sub, { type: w.type, status: "completed" });
  await syncAfterChange(sub);
}

/** Mark a day as an intentional rest day. `today` is the client's local date. */
export async function markRestDay(sub: string, date: string, today: string) {
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
  await syncAfterChange(sub);
}

/** One-tap outcome for a planned workout: done as planned, missed, or skipped with a reason. */
export async function resolveWorkout(
  sub: string,
  date: string,
  workoutId: string,
  status: "completed" | "missed" | "skipped",
  reason?: string,
) {
  const input = resolveInput.parse({ status, reason });
  const w = await repo.getWorkout(sub, day.parse(date), id.parse(workoutId));
  if (!w) throw notFound("Workout");
  await repo.saveWorkout(sub, {
    ...w,
    status: input.status,
    actual: input.status === "completed" ? (w.actual ?? w.planned) : undefined,
    reason: input.status === "skipped" ? input.reason : undefined,
    updatedAt: new Date().toISOString(),
  });
  await noteSport(sub, { type: w.type, status: input.status });
  await syncAfterChange(sub);
}

/**
 * Swap days: move the dragged workout to `toDate` and that day's planned workouts to its old day.
 * Both sides keep `originalDate`, so the calendar shows "moved from …".
 */
export async function swapDays(sub: string, fromDate: string, workoutId: string, toDate: string) {
  const [from, to] = [day.parse(fromDate), day.parse(toDate)];
  if (from === to) return;
  const w = await repo.getWorkout(sub, from, id.parse(workoutId));
  if (!w) throw notFound("Workout");
  const others = (await repo.listWorkouts(sub, to, to)).filter((o) => o.status === "planned");
  await repo.moveWorkout(sub, w, to);
  for (const o of others) await repo.moveWorkout(sub, o, from);
  await syncAfterChange(sub);
}

/** Copy a week's workouts (as planned, without results) to the week starting `toStart`, repeated `times` weeks. */
export async function copyWeek(sub: string, fromStart: string, toStart: string, times: number) {
  const from = parseISO(day.parse(fromStart));
  const weekStartsOn = (await repo.getProfile(sub))?.weekStartsOn ?? 1;
  // Snap the target to the start of its week so weekdays line up.
  const to = startOfWeek(parseISO(day.parse(toStart)), { weekStartsOn });
  const n = copyTimes.parse(times);
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
        startZone: w.startZone,
        type: w.type,
        title: w.title,
        autoTitle: w.autoTitle,
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
  await syncAfterChange(sub);
  return { copied: copies.length };
}

/** Workouts on one day, for the benchmark form's "Part of workout" picker. */
export async function workoutsOnDay(sub: string, date: string) {
  const d = day.parse(date);
  return repo.listWorkouts(sub, d, d);
}
