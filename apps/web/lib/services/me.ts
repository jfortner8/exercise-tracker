import "server-only";
import { showInjuriesTab } from "@et/core/injuries";
import type { NavFlags } from "@et/core/nav-flags";
import type { Profile } from "@et/core/types";
import { ApiError } from "@/lib/api-error";
import { deleteCognitoUser } from "@/lib/auth/cognito-admin";
import * as repo from "@/lib/db/repo";
import { expireBoards } from "@/lib/leaderboard";
import { leaveClub } from "./social";

/*
 * The signed-in user: their settings with the tabs they've earned, and deleting the account.
 */

/** The optional tabs (see NavFlags), shown once the user starts using each feature. */
export async function navFlags(sub: string, profile: Profile, today: string): Promise<NavFlags> {
  return {
    showSports: profile.hasSports === true,
    showWeight: profile.trackWeight,
    showRoutines: profile.hasRoutines === true,
    showInjuries: showInjuriesTab(await repo.listInjuries(sub), today),
  };
}

/** Who's signed in, their settings, which tabs to show, and today where they are. */
export async function me(sub: string, email: string, name: string | undefined, today: string) {
  const profile = { ...((await repo.getProfile(sub)) ?? repo.defaultProfile(email, name)), email };
  return { user: { sub, email }, profile, navFlags: await navFlags(sub, profile, today), today };
}

/**
 * Deletes the account for good. It leaves every club (handing admin on, or deleting a club they
 * were the last one in), ends every friendship on both sides, retires their friend code and
 * calendar-feed link, deletes everything under their key (leaderboard rows included), and finally
 * the sign-in. The sign-in goes last so that if a step fails they can sign in and try again.
 */
export async function deleteAccount(sub: string) {
  const [profile, clubs, friends] = await Promise.all([repo.getProfile(sub), repo.listMyClubs(sub), repo.listFriends(sub)]);
  for (const c of clubs) {
    try {
      await leaveClub(sub, c.clubId);
    } catch (e) {
      // The club is already gone, or they weren't in it after all: nothing to leave.
      if (!(e instanceof ApiError) || (e.status !== 404 && e.status !== 403)) throw e;
    }
  }
  await Promise.all(friends.map((f) => repo.removeFriendship(sub, f.sub)));
  if (profile?.friendCode) await repo.deleteFriendCode(profile.friendCode);
  if (profile?.calendarToken) await repo.deleteCalendarLink(profile.calendarToken);
  const deleted = await repo.deleteUserItems(sub);
  expireBoards();
  await deleteCognitoUser(sub);
  return { deleted };
}
