"use server";

import { refresh } from "next/cache";
import { ApiError } from "@/lib/api-error";
import { requireUser } from "@/lib/dal";
import * as social from "@/lib/services/social";

/*
 * Friends and clubs: the website's actions. Each is the signed-in user, then the shared service
 * (lib/services/social.ts, which the /api/v1 routes call too), then a re-render. A service's ApiError
 * comes back as { error } with its message to show.
 */

export type SocialResult = { error: string } | { ok: true; message?: string; href?: string };

async function me() {
  const user = await requireUser();
  return { sub: user.sub, displayName: await social.displayNameOf(user.sub, user.email, user.name) };
}

async function run(fn: (me: { sub: string; displayName: string }) => Promise<SocialResult>): Promise<SocialResult> {
  try {
    const result = await fn(await me());
    refresh();
    return result;
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e;
  }
}

/** One box for both kinds of code: a friend's code adds them, a club's code joins it. */
export async function joinWithCodeAction(raw: string): Promise<SocialResult> {
  return run(async ({ sub, displayName }) => {
    const r = await social.joinWithCode(sub, displayName, raw);
    return r.kind === "club" ? { ok: true, message: r.message, href: `/clubs/${r.club.id}` } : { ok: true, message: r.message };
  });
}

export async function removeFriendAction(friendSub: string): Promise<SocialResult> {
  return run(async ({ sub }) => {
    await social.removeFriend(sub, friendSub);
    return { ok: true };
  });
}

/** A new friend code; the old one stops working. Existing friends stay friends. */
export async function resetFriendCodeAction(): Promise<SocialResult> {
  return run(async ({ sub }) => {
    await social.resetFriendCode(sub);
    return { ok: true, message: "New code ready. The old one no longer works." };
  });
}

export async function createClubAction(rawName: string): Promise<SocialResult> {
  return run(async ({ sub, displayName }) => {
    const club = await social.createClub(sub, displayName, rawName);
    return { ok: true, href: `/clubs/${club.id}` };
  });
}

/** Leaving as admin passes admin to whoever joined first; the last one out deletes the club. */
export async function leaveClubAction(clubId: string): Promise<SocialResult> {
  return run(async ({ sub }) => {
    const { message } = await social.leaveClub(sub, clubId);
    return { ok: true, href: "/friends", message };
  });
}

export async function renameClubAction(clubId: string, rawName: string): Promise<SocialResult> {
  return run(async ({ sub }) => {
    await social.renameClub(sub, clubId, rawName);
    return { ok: true };
  });
}

export async function resetClubCodeAction(clubId: string): Promise<SocialResult> {
  return run(async ({ sub }) => {
    await social.resetClubCode(sub, clubId);
    return { ok: true, message: "New code ready. The old one no longer works; members stay in." };
  });
}

export async function removeMemberAction(clubId: string, memberSub: string): Promise<SocialResult> {
  return run(async ({ sub }) => {
    await social.removeMember(sub, clubId, memberSub);
    return { ok: true };
  });
}

export async function makeAdminAction(clubId: string, memberSub: string): Promise<SocialResult> {
  return run(async ({ sub }) => {
    await social.makeAdmin(sub, clubId, memberSub);
    return { ok: true };
  });
}

export async function deleteClubAction(clubId: string): Promise<SocialResult> {
  return run(async ({ sub }) => {
    const club = await social.deleteClub(sub, clubId);
    return { ok: true, href: "/friends", message: `${club.name} was deleted.` };
  });
}
