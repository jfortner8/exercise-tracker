import "server-only";
import { updateTag } from "next/cache";
import { BENCHMARK_CATALOG } from "@/lib/benchmarks/catalog";
import * as repo from "@/lib/db/repo";
import { markRunningPBs, personalBest, resultScore } from "@/lib/domain";
import type { LeaderboardEntry } from "@/lib/types";

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
  const optedIn = profile?.leaderboard === true;
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
          history: markRunningPBs(def, results)
            .filter((r) => r.isPb)
            .map((r) => ({ date: r.date, score: r.score })),
        };
      }),
    );
    for (const e of entries) if (e) wanted.push(e);
  }

  // Only write what changed, so the shared leaderboard cache is invalidated only when needed.
  const same = (a: LeaderboardEntry, b: LeaderboardEntry) =>
    JSON.stringify([a.displayName, a.value, a.reps, a.date, a.score, a.history]) ===
    JSON.stringify([b.displayName, b.value, b.reps, b.date, b.score, b.history]);
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
