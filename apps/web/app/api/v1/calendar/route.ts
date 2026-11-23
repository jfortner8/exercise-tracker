import { parseRange } from "@et/core/api-input";
import type { CalendarResponse } from "@et/core/api-types";
import { recentActivities } from "@et/core/activities";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import { firstEntryDate, listRoutines, recentWorkouts } from "@/lib/db/repo";
import { calendarRange } from "@/lib/services/calendar";

/**
 * GET /api/v1/calendar?from=yyyy-MM-dd&to=yyyy-MM-dd — one calendar screen's data for the app.
 * → { from, to, today, startDate, workouts, days, injuries, benchmarks, results, routines, recent }
 * The app sends its time zone as X-Time-Zone so "today" is the user's day, not the server's.
 */
export const GET = api(async ({ req, sub, today }) => {
  const range = parseRange(req.nextUrl.searchParams.get("from"), req.nextUrl.searchParams.get("to"));
  if ("error" in range) throw new ApiError(400, range.error);
  const t = await today();
  const [startDate, data, routines, recent] = await Promise.all([
    firstEntryDate(sub),
    calendarRange(sub, range.from, range.to),
    listRoutines(sub),
    recentWorkouts(sub, t),
  ]);
  return { ...range, today: t, startDate, ...data, routines, recent: recentActivities(recent) } satisfies CalendarResponse;
});
