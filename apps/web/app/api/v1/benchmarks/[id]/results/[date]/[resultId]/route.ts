import type { ResultInput } from "@et/core/schemas";
import { api } from "@/lib/api";
import { deleteResult, updateResult } from "@/lib/services/benchmarks";

type Params = { id: string; date: string; resultId: string };

/**
 * PUT /api/v1/benchmarks/:id/results/:date/:resultId — the whole result again:
 * { date, value, reps?, workoutId?, notes? }. A field left out is cleared; a new `date` moves it.
 */
export const PUT = api<Params>(({ sub, params, body }) =>
  updateResult(sub, { ...(body as ResultInput), benchmarkId: params.id, id: params.resultId, originalDate: params.date }),
);

/** DELETE /api/v1/benchmarks/:id/results/:date/:resultId */
export const DELETE = api<Params>(({ sub, params }) => deleteResult(sub, params.id, params.date, params.resultId));
