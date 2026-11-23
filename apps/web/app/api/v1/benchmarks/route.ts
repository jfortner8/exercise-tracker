import type { BenchmarkInput } from "@et/core/schemas";
import { api } from "@/lib/api";
import { listAllResults, listBenchmarks } from "@/lib/db/repo";
import { createBenchmark } from "@/lib/services/benchmarks";

/**
 * GET /api/v1/benchmarks — → { benchmarks, results }: everything tracked and every result, as the
 * website's Benchmarks page loads it. PBs and trends are worked out on the phone with @et/core, and the
 * built-in catalog is @et/core/benchmarks/catalog, so neither needs an endpoint.
 */
export const GET = api(async ({ sub }) => {
  const [benchmarks, results] = await Promise.all([listBenchmarks(sub), listAllResults(sub)]);
  return { benchmarks, results };
});

/** POST /api/v1/benchmarks — a custom benchmark: { name, category, metricKind, direction, unit? } → { id }. */
export const POST = api(async ({ sub, body }) => ({ id: await createBenchmark(sub, body as BenchmarkInput) }));
