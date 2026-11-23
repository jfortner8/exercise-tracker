import { api } from "@/lib/api";
import { workoutsOnDay } from "@/lib/services/workouts";

/** GET /api/v1/days/:date/workouts — that day's workouts (e.g. for linking a benchmark result). → { workouts } */
export const GET = api<{ date: string }>(async ({ sub, params }) => ({ workouts: await workoutsOnDay(sub, params.date) }));
