import "server-only";
import { updateTag } from "next/cache";
import { BENCHMARK_CATALOG } from "@et/core/benchmarks/catalog";
import * as repo from "@/lib/db/repo";
import { addDays, format, parseISO } from "date-fns";
import { markRunningPBs, personalBest, resultScore, todayIn } from "@et/core/domain";
import { CONSISTENCY_DAYS, consistencyDays, seasonBests } from "@et/core/leaderboard-views";
import type { ConsistencyRow, LeaderboardEntry } from "@et/core/types";

/**
 * Bring this user's leaderboard rows in line with their results and opt-in setting.
 * Pass a catalog key to sync just that benchmark (after adding/deleting a result);
 * omit it to sync everything (after changing settings or deleting a benchmark).
 */
export async function syncLeaderboard(sub: string, onlyKey?: string) {
  const [profile, benchmarks, existing] = await Promise.all([
    repo.getProfile(sub),
    repo.listBenchmarks(sub),
    repo.listOwnLeaderboardEntries(sub),
  ]);
  // Rows exist unless sharing is off; each carries the share level so boards can filter.
  const share = profile?.share ?? "off";
  const optedIn = share !== "off";
  const tracked = benchmarks.filter((b) => b.catalogKey && (!onlyKey || b.catalogKey === onlyKey));

  // Work out each tracked benchmark's entry in parallel (one results query each).
  const wanted: LeaderboardEntry[] = [];
  if (optedIn && profile) {
    const entries = await Promise.all(
      tracked.map(async (b): Promise<LeaderboardEntry | null> => {
        const entry = BENCHMARK_CATALOG.find((c) => c.key === b.catalogKey);
        if (!entry) return null;
        // Rank with the catalog's definition so everyone is scored the same way.
        const def = { metricKind: entry.metricKind, direction: entry.direction };
        const results = (await repo.listResults(sub, b.id)).sort((x, y) => x.date.localeCompare(y.date));
        const pb = personalBest(def, results);
        if (!pb) return null;
        return {
          sub,
          catalogKey: entry.key,
          displayName: profile.displayName,
          value: pb.value,
          reps: pb.reps,
          date: pb.date,
          score: resultScore(def, pb),
          share,
          history: markRunningPBs(def, results)
            .filter((r) => r.isPb)
            .map((r) => ({ date: r.date, score: r.score })),
          seasons: seasonBests(def, results),
        };
      }),
    );
    for (const e of entries) if (e) wanted.push(e);
  }

  // Only write what changed, so the shared leaderboard cache is invalidated only when needed.
  const same = (a: LeaderboardEntry, b: LeaderboardEntry) =>
    JSON.stringify([a.displayName, a.value, a.reps, a.date, a.score, a.history, a.share ?? "everyone", a.seasons ?? null]) ===
    JSON.stringify([b.displayName, b.value, b.reps, b.date, b.score, b.history, b.share ?? "everyone", b.seasons ?? null]);
  const toPut = wanted.filter((w) => {
    const old = existing.find((e) => e.catalogKey === w.catalogKey);
    return !old || !same(old, w);
  });
  const keep = new Set(wanted.map((w) => w.catalogKey));
  const toDelete = existing
    .map((e) => e.catalogKey)
    .filter((k) => !keep.has(k) && (!onlyKey || k === onlyKey));

  await Promise.all([
    ...toPut.map((e) => repo.putLeaderboardEntry(e)),
    ...toDelete.map((k) => repo.deleteLeaderboardEntry(sub, k)),
  ]);
  if (toPut.length || toDelete.length) updateTag(repo.LEADERBOARD_TAG);
}

/**
 * Bring this user's Consistency row in line with their workouts and settings: written while they
 * share at all and opted in to sharing consistency, removed otherwise. Call after anything that
 * changes which days were on track (workouts, injuries, benchmark results) or the settings.
 */
export async function syncConsistency(sub: string) {
  const [profile, existing] = await Promise.all([repo.getProfile(sub), repo.getConsistencyRow(sub)]);
  if (!profile || profile.share === "off" || !profile.shareConsistency) {
    if (existing) await repo.deleteConsistencyRow(sub);
    return;
  }
  const today = todayIn(profile.timeZone);
  const shift = (n: number) => format(addDays(parseISO(today), n), "yyyy-MM-dd");
  const [from, through] = [shift(-CONSISTENCY_DAYS), shift(CONSISTENCY_DAYS)];
  const [workouts, injuries, startDate, results] = await Promise.all([
    repo.listWorkouts(sub, from, through),
    repo.listInjuries(sub),
    repo.firstEntryDate(sub),
    repo.listAllResults(sub),
  ]);
  const row: ConsistencyRow = {
    sub,
    displayName: profile.displayName,
    share: profile.share,
    syncedOn: today,
    through,
    startDate,
    days: consistencyDays(workouts, injuries, new Set(results.map((r) => r.date)), startDate, today, from, through),
  };
  const key = (r: ConsistencyRow) => JSON.stringify([r.displayName, r.share, r.syncedOn, r.through, r.startDate, r.days]);
  if (!existing || key(existing) !== key(row)) await repo.putConsistencyRow(row);
}
