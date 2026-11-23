import { api, field } from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import { setGoalDone } from "@/lib/services/days";

/** PUT /api/v1/days/:date/goals/:goalId — body { done: boolean }. */
export const PUT = api<{ date: string; goalId: string }>(({ sub, params, body }) => {
  const done = field(body, "done");
  if (typeof done !== "boolean") throw new ApiError(400, "done must be true or false");
  return setGoalDone(sub, params.date, params.goalId, done);
});
