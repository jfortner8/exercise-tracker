import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BenchmarkDetail } from "@/components/benchmarks/detail";
import { requireProfile } from "@/lib/dal";
import { getBenchmark, listResults } from "@/lib/db/repo";

async function Detail({ params }: { params: PageProps<"/benchmarks/[id]">["params"] }) {
  const { id } = await params;
  const { user, profile } = await requireProfile();
  const [def, results] = await Promise.all([getBenchmark(user.sub, id), listResults(user.sub, id)]);
  if (!def) notFound();
  return <BenchmarkDetail def={def} results={results} units={profile.units} />;
}

export default function BenchmarkPage({ params }: PageProps<"/benchmarks/[id]">) {
  return (
    <div className="max-w-4xl">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-surface-2" />}>
        <Detail params={params} />
      </Suspense>
    </div>
  );
}
