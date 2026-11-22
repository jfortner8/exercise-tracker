import type { Metadata } from "next";
import { Suspense } from "react";
import { BenchmarkBoard } from "@/components/benchmarks/board";
import { PageHeader } from "@/components/ui";
import { requireProfile } from "@/lib/dal";
import { listAllResults, listBenchmarks } from "@/lib/db/repo";

export const metadata: Metadata = { title: "Benchmarks" };

async function Board() {
  const { user, profile } = await requireProfile();
  const [benchmarks, results] = await Promise.all([listBenchmarks(user.sub), listAllResults(user.sub)]);
  return <BenchmarkBoard benchmarks={benchmarks} results={results} units={profile.units} />;
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
