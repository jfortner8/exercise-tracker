import { sportTallies } from "@et/core/sports";
import { api } from "@/lib/api";
import { listAllWorkouts } from "@/lib/db/repo";

/**
 * GET /api/v1/sports — → { year, tallies }: completed sessions per sport (see SportTally in
 * @et/core/sports), most played first. `year` is this year where the user is, which `thisYear` counts.
 * Worked out on the server so the phone doesn't download every workout for it.
 */
export const GET = api(async ({ sub, today }) => {
  const year = (await today()).slice(0, 4);
  return { year, tallies: sportTallies(await listAllWorkouts(sub), year) };
});
