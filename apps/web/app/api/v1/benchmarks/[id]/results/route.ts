import type { ResultInput } from "@et/core/schemas";
import { api } from "@/lib/api";
import { addResult } from "@/lib/services/benchmarks";

/**
 * POST /api/v1/benchmarks/:id/results — { date, value, reps?, workoutId?, notes? } → { id }.
 * `value` is canonical: seconds, meters, kg, a count, or the custom number. A `workoutId` must be on
 * the same date and of a fitting type.
 */
export const POST = api<{ id: string }>(async ({ sub, params, body }) => ({
  id: await addResult(sub, { ...(body as ResultInput), benchmarkId: params.id }),
}));
