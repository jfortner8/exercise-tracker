import { api, field } from "@/lib/api";
import { moveWorkout } from "@/lib/services/workouts";

/** POST /api/v1/workouts/:date/:id/move — body { toDate }. Keeps "moved from". */
export const POST = api<{ date: string; id: string }>(({ sub, params, body }) =>
  moveWorkout(sub, params.date, params.id, field<string>(body, "toDate") ?? ""),
);
