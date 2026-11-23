import { api } from "@/lib/api";
import { quickDone } from "@/lib/services/workouts";
import type { QuickDoneInput } from "@et/core/schemas";

/** POST /api/v1/workouts/:date/:id/quick-done — body { timeSec?, distanceM?, extraAs: "warmup" | "cooldown" }. */
export const POST = api<{ date: string; id: string }>(({ sub, params, body }) =>
  quickDone(sub, params.date, params.id, body as QuickDoneInput),
);
