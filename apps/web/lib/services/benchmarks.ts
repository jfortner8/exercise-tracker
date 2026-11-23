import "server-only";
import { ulid } from "ulid";
import { day, id, benchmarkInput, resultInput, type BenchmarkInput, type ResultInput } from "@et/core/schemas";
import { BENCHMARK_CATALOG } from "@et/core/benchmarks/catalog";
import { linkableWorkouts } from "@et/core/benchmarks/linking";
import * as repo from "@/lib/db/repo";
import { syncLeaderboard } from "@/lib/leaderboard";
import { ApiError, notFound } from "@/lib/api-error";
import { syncAfterChange } from "./sync";

/*
 * Benchmarks and their results (PBs), kept in sync with the leaderboards.
 * Plain functions of the user id: the website's server actions and the /api/v1 routes both call them.
 */

export async function trackCatalogBenchmark(sub: string, key: string) {
  const entry = BENCHMARK_CATALOG.find((c) => c.key === key);
  if (!entry) throw new ApiError(400, "Unknown benchmark");
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
}

export async function createBenchmark(sub: string, raw: BenchmarkInput) {
  const b = benchmarkInput.parse(raw);
  const newId = ulid();
  await repo.saveBenchmark(sub, { ...b, unit: b.unit || undefined, id: newId, createdAt: new Date().toISOString() });
  return newId;
}

export async function deleteBenchmark(sub: string, benchmarkId: string) {
  await repo.deleteBenchmark(sub, id.parse(benchmarkId));
  await syncLeaderboard(sub);
  await syncAfterChange(sub);
}

/** Loads the benchmark and checks a linked workout: this user's, on the result's day, of a fitting type. */
async function checkResult(sub: string, r: ResultInput) {
  const bm = await repo.getBenchmark(sub, r.benchmarkId);
  if (!bm) throw notFound("Benchmark");
  if (r.workoutId) {
    const w = await repo.getWorkout(sub, r.date, r.workoutId);
    if (!w) throw new ApiError(400, "That workout isn't on the result's date");
    if (!linkableWorkouts(bm, [w]).length) throw new ApiError(400, `${bm.name} can't be part of a ${w.type} workout`);
  }
  return bm;
}

export async function addResult(sub: string, raw: ResultInput) {
  const r = resultInput.parse(raw);
  const bm = await checkResult(sub, r);
  await repo.saveResult(sub, { ...r, id: ulid() });
  if (bm.catalogKey) await syncLeaderboard(sub, bm.catalogKey);
  await syncAfterChange(sub);
}

/** Edit a result (value, reps, date, notes, workout link). Changing the date moves it. */
export async function updateResult(sub: string, raw: ResultInput & { id: string; originalDate: string }) {
  const r = resultInput.parse(raw);
  const resultId = id.parse(raw.id);
  const old = await repo.getResult(sub, { benchmarkId: r.benchmarkId, date: day.parse(raw.originalDate), id: resultId });
  if (!old) throw notFound("Result");
  const bm = await checkResult(sub, r);
  // The form sends the whole result, so cleared fields (notes, link) are dropped rather than kept.
  await repo.replaceResult(sub, old, { ...r, id: resultId });
  // An edited value or date can change the PB and its history on the leaderboards.
  if (bm.catalogKey) await syncLeaderboard(sub, bm.catalogKey);
  await syncAfterChange(sub);
}

export async function deleteResult(sub: string, benchmarkId: string, date: string, resultId: string) {
  await repo.deleteResult(sub, { benchmarkId: id.parse(benchmarkId), date: day.parse(date), id: id.parse(resultId) });
  const bm = await repo.getBenchmark(sub, benchmarkId);
  if (bm?.catalogKey) await syncLeaderboard(sub, bm.catalogKey);
  await syncAfterChange(sub);
}
