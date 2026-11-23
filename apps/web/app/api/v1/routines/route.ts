import type { RoutineInput } from "@et/core/schemas";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import { listRoutines } from "@/lib/db/repo";
import { saveRoutine } from "@/lib/services/routines";

/** GET /api/v1/routines — → { routines }: saved exercise lists for Strength workouts. */
export const GET = api(async ({ sub }) => ({ routines: await listRoutines(sub) }));

/** POST /api/v1/routines — { name, exercises } → { id }. Names are unique (ignoring case). */
export const POST = api(async ({ sub, body }) => {
  const res = await saveRoutine(sub, { ...(body as RoutineInput), id: undefined });
  if ("error" in res) throw new ApiError(400, res.error);
  return { id: res.id };
});
