"use server";

import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { requireUser } from "@/lib/dal";
import * as benchmarks from "@/lib/services/benchmarks";
import * as days from "@/lib/services/days";
import * as injuries from "@/lib/services/injuries";
import { deleteAccount } from "@/lib/services/me";
import * as profile from "@/lib/services/profile";
import * as routines from "@/lib/services/routines";
import * as workouts from "@/lib/services/workouts";
import type { BenchmarkInput, DayPatchInput, InjuryInput, ProfileInput, RepeatInput, ResultInput, RoutineInput, WorkoutInput } from "@et/core/schemas";
import type { ExtraAs } from "@et/core/quick-done";

/*
 * The website's server actions: sign-in check, the shared service (lib/services), then re-render.
 * The phone app reaches the same services through /api/v1.
 */

/** Runs `fn` for the signed-in user, then re-renders the page. */
async function act<T>(fn: (sub: string) => Promise<T>): Promise<T> {
  const { sub } = await requireUser();
  const result = await fn(sub);
  refresh();
  return result;
}

// ---------- Profile ----------
export async function syncTimeZoneAction(timeZone: string) {
  return act((sub) => profile.syncTimeZone(sub, timeZone));
}
export async function saveProfileAction(raw: ProfileInput) {
  const { email } = await requireUser();
  return act((sub) => profile.saveProfile(sub, email, raw));
}

/** Deletes the account and everything in it (see deleteAccount), then signs out. */
export async function deleteAccountAction() {
  const { sub } = await requireUser();
  await deleteAccount(sub);
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

// ---------- Routines ----------
export async function saveRoutineAction(raw: RoutineInput) {
  return act((sub) => routines.saveRoutine(sub, raw));
}
export async function deleteRoutineAction(routineId: string) {
  return act((sub) => routines.deleteRoutine(sub, routineId));
}

// ---------- Workouts ----------
export async function saveWorkoutAction(raw: WorkoutInput, rawRepeat?: RepeatInput, rawRoutine?: { name: string }) {
  return act((sub) => workouts.saveWorkout(sub, raw, rawRepeat, rawRoutine));
}
export async function deleteWorkoutAction(date: string, workoutId: string) {
  return act((sub) => workouts.deleteWorkout(sub, date, workoutId));
}
export async function deleteSeriesFromAction(date: string, workoutId: string) {
  return act((sub) => workouts.deleteSeriesFrom(sub, date, workoutId));
}
export async function moveWorkoutAction(date: string, workoutId: string, toDate: string) {
  return act((sub) => workouts.moveWorkout(sub, date, workoutId, toDate));
}
export async function quickDoneAction(date: string, workoutId: string, raw: { timeSec?: number; distanceM?: number; extraAs: ExtraAs }) {
  return act((sub) => workouts.quickDone(sub, date, workoutId, raw));
}
export async function markRestDayAction(date: string, today: string) {
  return act((sub) => workouts.markRestDay(sub, date, today));
}
export async function resolveWorkoutAction(date: string, workoutId: string, status: "completed" | "missed" | "skipped", reason?: string) {
  return act((sub) => workouts.resolveWorkout(sub, date, workoutId, status, reason));
}
export async function swapDaysAction(fromDate: string, workoutId: string, toDate: string) {
  return act((sub) => workouts.swapDays(sub, fromDate, workoutId, toDate));
}
export async function copyWeekAction(fromStart: string, toStart: string, times: number) {
  return act((sub) => workouts.copyWeek(sub, fromStart, toStart, times));
}
/** Workouts on one day, for the benchmark form's "Part of workout" picker. Read-only, so no re-render. */
export async function workoutsOnDayAction(date: string) {
  const { sub } = await requireUser();
  return workouts.workoutsOnDay(sub, date);
}

// ---------- Day logs ----------
export async function saveDayAction(date: string, patch: DayPatchInput) {
  return act((sub) => days.saveDay(sub, date, patch));
}
export async function setGoalDoneAction(date: string, goalId: string, done: boolean) {
  return act((sub) => days.setGoalDone(sub, date, goalId, done));
}

// ---------- Injuries ----------
export async function saveInjuryAction(raw: InjuryInput) {
  await act((sub) => injuries.saveInjury(sub, raw));
}
export async function deleteInjuryAction(injuryId: string) {
  return act((sub) => injuries.deleteInjury(sub, injuryId));
}

// ---------- Benchmarks ----------
export async function trackCatalogBenchmarkAction(key: string) {
  await act((sub) => benchmarks.trackCatalogBenchmark(sub, key));
}
export async function createBenchmarkAction(raw: BenchmarkInput) {
  return act((sub) => benchmarks.createBenchmark(sub, raw));
}
export async function deleteBenchmarkAction(benchmarkId: string) {
  return act((sub) => benchmarks.deleteBenchmark(sub, benchmarkId));
}
export async function addResultAction(raw: ResultInput) {
  return act((sub) => benchmarks.addResult(sub, raw));
}
export async function updateResultAction(raw: ResultInput & { id: string; originalDate: string }) {
  return act((sub) => benchmarks.updateResult(sub, raw));
}
export async function deleteResultAction(benchmarkId: string, date: string, resultId: string) {
  return act((sub) => benchmarks.deleteResult(sub, benchmarkId, date, resultId));
}
