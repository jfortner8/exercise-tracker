import { weightSeries } from "@et/core/weight";
import { api } from "@/lib/api";
import { getProfile, listAllDays } from "@/lib/db/repo";

/**
 * GET /api/v1/weight — → { trackWeight, today, series }: every weigh-in in kg, oldest first, with its
 * 7-day average (see WeightPoint in @et/core/weight). Empty while bodyweight tracking is off.
 * Weigh-ins are saved with PUT /days/:date { weightKg }.
 */
export const GET = api(async ({ sub, today }) => {
  const trackWeight = (await getProfile(sub))?.trackWeight === true;
  return { trackWeight, today: await today(), series: trackWeight ? weightSeries(await listAllDays(sub)) : [] };
});
