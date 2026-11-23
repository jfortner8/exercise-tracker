import { api } from "@/lib/api";
import { markRestDay } from "@/lib/services/workouts";

/** POST /api/v1/days/:date/rest — mark a rest day (done if today or past, planned if later, where the user is). */
export const POST = api<{ date: string }>(async ({ sub, params, today }) => markRestDay(sub, params.date, await today()));
