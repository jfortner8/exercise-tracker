import "server-only";
import type { LeaderboardsResponse } from "@et/core/api-types";
import { everyoneBoard } from "@et/core/social";
import type { ConsistencyRow, LeaderboardEntry } from "@et/core/types";
import { ApiError } from "@/lib/api-error";
import { getBoardsFor, getLeaderboards, listClubMembers, listMyClubs } from "@/lib/db/repo";
import { friendsCircle } from "@/lib/social-server";

/** A board you can look at: your friends, one of your clubs, or everyone who shares with everyone. */
export type BoardGroup = { key: string; label: string };

/**
 * The leaderboards for one group (`friends`, a club id, or `everyone`): every built-in benchmark's
 * entries, keyed by catalog key, plus the Consistency rows (friends and clubs only).
 * Membership is checked before any board is read: a club you're not in is a 404.
 * The views (best, this season, improvement) are worked out from these with @et/core/leaderboard-views.
 */
export async function leaderboardData(sub: string, groupKey: string): Promise<LeaderboardsResponse> {
  const [circle, myClubs] = await Promise.all([friendsCircle(sub), listMyClubs(sub)]);
  const clubs = [...myClubs].sort((a, b) => a.name.localeCompare(b.name));
  const groups: BoardGroup[] = [
    { key: "friends", label: "Friends" },
    ...clubs.map((c) => ({ key: c.clubId, label: c.name })),
    { key: "everyone", label: "Everyone" },
  ];
  if (!groups.some((g) => g.key === groupKey)) throw new ApiError(404, "That board isn't one of yours.");
  const club = clubs.find((c) => c.clubId === groupKey);
  // Friends and clubs read just their people's PB rows. Everyone reads the shared cached board
  // (invalidated when someone's PB row changes), minus people who share with friends & clubs only.
  const { boards, consistency }: { boards: Record<string, LeaderboardEntry[]>; consistency: ConsistencyRow[] } =
    groupKey === "everyone"
      ? {
          boards: Object.fromEntries(Object.entries(await getLeaderboards()).map(([k, entries]) => [k, everyoneBoard(entries)])),
          consistency: [],
        }
      : await getBoardsFor(club ? (await listClubMembers(club.clubId)).map((m) => m.sub) : circle.people);
  return {
    groups,
    group: groupKey,
    boards,
    consistency,
    /** Consistency is for friends and clubs only. */
    hasConsistency: groupKey !== "everyone",
    friendCount: circle.friends.length,
  };
}
