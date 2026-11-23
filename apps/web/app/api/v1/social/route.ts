import { api } from "@/lib/api";
import { defaultProfile, getProfile } from "@/lib/db/repo";
import { socialOverview } from "@/lib/services/social";

/**
 * GET /api/v1/social — → { friendCode, friends, clubs }. The friend code is made the first time it's
 * asked for. `clubs` is [{ club, memberCount, isAdmin }], by name.
 */
export const GET = api(async ({ sub, email, name }) =>
  socialOverview(sub, (await getProfile(sub)) ?? defaultProfile(email, name)),
);
