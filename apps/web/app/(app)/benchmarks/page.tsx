import type { Metadata } from "next";
import { Suspense } from "react";
import { BenchmarkBoard } from "@/components/benchmarks/board";
import { RaceDistances } from "@/components/benchmarks/race-distances";
import { raceTallies } from "@et/core/race-distances";
import { PageHeader } from "@/components/ui";
import { requireProfile, requireToday } from "@/lib/dal";
import { listAllResults, listAllWorkouts, listBenchmarks } from "@/lib/db/repo";

export const metadata: Metadata = { title: "Benchmarks" };

async function Board() {
  const { user, profile } = await requireProfile();
  const [benchmarks, results, workouts, today] = await Promise.all([
    listBenchmarks(user.sub),
    listAllResults(user.sub),
    listAllWorkouts(user.sub),
    requireToday(),
  ]);
  const year = today.slice(0, 4);
  return (
    <div className="space-y-8">
      <RaceDistances sports={raceTallies(workouts, year)} units={profile.units} year={year} />
      <BenchmarkBoard benchmarks={benchmarks} results={results} units={profile.units} />
    </div>
  );
}

export default function BenchmarksPage() {
  return (
    <div className="max-w-6xl">
      <PageHeader
        title="Benchmarks"
        subtitle="Personal bests for anything you can measure: running, swimming, lifting, mobility, or your own."
      />
      <Suspense fallback={<div className="h-80 animate-pulse rounded-xl bg-surface-2" />}>
        <Board />
      </Suspense>
    </div>
  );
}
