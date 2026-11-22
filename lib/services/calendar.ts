import "server-only";
import { calendarResults } from "@/lib/domain";
import { listAllResults, listBenchmarks, listDays, listInjuries, listWorkouts } from "@/lib/db/repo";

/**
 * Everything a calendar range shows: workouts, day logs, injuries, and the benchmark results in
 * range marked with whether each was a PB. Used by the website's calendar page and by the app's
 * GET /api/v1/calendar, so both see the same data.
 */
export async function calendarRange(sub: string, from: string, to: string) {
  const [workouts, days, injuries, benchmarks, allResults] = await Promise.all([
    listWorkouts(sub, from, to),
    listDays(sub, from, to),
    listInjuries(sub),
    listBenchmarks(sub),
    // All results (one small query): earlier history decides whether a result in view was a PB.
    listAllResults(sub),
  ]);
  return { workouts, days, injuries, benchmarks, results: calendarResults(benchmarks, allResults, from, to) };
}
