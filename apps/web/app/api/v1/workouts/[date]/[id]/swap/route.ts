import { api, field } from "@/lib/api";
import { swapDays } from "@/lib/services/workouts";

/** POST /api/v1/workouts/:date/:id/swap — body { toDate }: move it there and that day's planned workouts here. */
export const POST = api<{ date: string; id: string }>(({ sub, params, body }) =>
  swapDays(sub, params.date, params.id, field<string>(body, "toDate") ?? ""),
);
