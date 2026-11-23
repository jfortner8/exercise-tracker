import { api } from "@/lib/api";
import { leaderboardData } from "@/lib/services/leaderboards";

/**
 * GET /api/v1/leaderboards?g=friends|everyone|<clubId> — → { groups, group, boards, consistency,
 * hasConsistency, friendCount }. `boards[catalogKey]` is that benchmark's entries; work out the views
 * (best, this season, improvement, consistency ranking) with @et/core/leaderboard-views and
 * @et/core/domain. A club you're not in is a 404. Defaults to friends.
 */
export const GET = api(({ sub, req }) => leaderboardData(sub, req.nextUrl.searchParams.get("g") || "friends"));
