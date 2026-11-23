import { api } from "@/lib/api";
import { trackCatalogBenchmark } from "@/lib/services/benchmarks";

/** POST /api/v1/benchmarks/catalog/:key — track a built-in benchmark → { id } (the existing one if already tracked). */
export const POST = api<{ key: string }>(async ({ sub, params }) => ({ id: await trackCatalogBenchmark(sub, params.key) }));
