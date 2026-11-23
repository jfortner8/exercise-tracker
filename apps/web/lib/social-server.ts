import "server-only";
import * as repo from "@/lib/db/repo";
import { newCode } from "@et/core/social";
import type { Profile } from "@et/core/types";

/** This user's friend code, created the first time it's asked for. */
export async function ensureFriendCode(sub: string, profile: Profile): Promise<string> {
  if (profile.friendCode) return profile.friendCode;
  for (let i = 0; i < 5; i++) {
    if (await repo.setFriendCode(sub, newCode())) return (await repo.getProfile(sub, true))?.friendCode ?? "";
    // Taken, or another request just made one: use theirs if so. A consistent read, or a code
    // written a moment ago can be missed and every retry fails.
    const now = await repo.getProfile(sub, true);
    if (now?.friendCode) return now.friendCode;
  }
  throw new Error("Could not create a friend code");
}

/** The people on a friends board: you and your friends. */
export async function friendsCircle(sub: string) {
  const friends = await repo.listFriends(sub);
  return { friends, people: new Set([sub, ...friends.map((f) => f.sub)]) };
}
