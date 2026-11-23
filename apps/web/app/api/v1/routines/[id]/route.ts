import type { RoutineInput } from "@et/core/schemas";
import { api } from "@/lib/api";
import { ApiError, notFound } from "@/lib/api-error";
import { listRoutines } from "@/lib/db/repo";
import { deleteRoutine, saveRoutine } from "@/lib/services/routines";

/**
 * PUT /api/v1/routines/:id — { name, exercises }. Workouts already on the calendar keep their own
 * copy of the exercises; the change applies the next time the routine is used.
 */
export const PUT = api<{ id: string }>(async ({ sub, params, body }) => {
  if (!(await listRoutines(sub)).some((r) => r.id === params.id)) throw notFound("Routine");
  const res = await saveRoutine(sub, { ...(body as RoutineInput), id: params.id });
  if ("error" in res) throw new ApiError(400, res.error);
});

/** DELETE /api/v1/routines/:id — the Routines tab goes away with the last one (see GET /me's navFlags). */
export const DELETE = api<{ id: string }>(({ sub, params }) => deleteRoutine(sub, params.id));
