import { api, field } from "@/lib/api";
import { resolveWorkout } from "@/lib/services/workouts";

/** POST /api/v1/workouts/:date/:id/resolve — body { status: "completed" | "missed" | "skipped", reason? (needed for skipped) }. */
export const POST = api<{ date: string; id: string }>(({ sub, params, body }) =>
  resolveWorkout(sub, params.date, params.id, field(body, "status") as "completed" | "missed" | "skipped", field<string>(body, "reason")),
);
