import { api } from "@/lib/api";
import { notFound } from "@/lib/api-error";
import { getBenchmark, listResults } from "@/lib/db/repo";
import { deleteBenchmark } from "@/lib/services/benchmarks";

/** GET /api/v1/benchmarks/:id — → { benchmark, results }, as the benchmark's page shows them. */
export const GET = api<{ id: string }>(async ({ sub, params }) => {
  const [benchmark, results] = await Promise.all([getBenchmark(sub, params.id), listResults(sub, params.id)]);
  if (!benchmark) throw notFound("Benchmark");
  return { benchmark, results };
});

/** DELETE /api/v1/benchmarks/:id — the benchmark and all its results. */
export const DELETE = api<{ id: string }>(({ sub, params }) => deleteBenchmark(sub, params.id));
