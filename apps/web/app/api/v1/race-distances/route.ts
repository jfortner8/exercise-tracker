import { raceTallies } from "@et/core/race-distances";
import { api } from "@/lib/api";
import { listAllWorkouts } from "@/lib/db/repo";

/**
 * GET /api/v1/race-distances — → { year, sports }: how many times each common race distance was
 * covered, per sport (see raceTallies in @et/core/race-distances). Worked out on the server so the
 * phone doesn't download every workout for it.
 */
export const GET = api(async ({ sub, today }) => {
  const year = (await today()).slice(0, 4);
  return { year, sports: raceTallies(await listAllWorkouts(sub), year) };
});
