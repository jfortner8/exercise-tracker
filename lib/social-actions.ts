"use server";

import { refresh } from "next/cache";
import { ulid } from "ulid";
import { z } from "zod";
import { requireUser } from "@/lib/dal";
import * as repo from "@/lib/db/repo";
import { CODE_FAILURES_PER_DAY, CODE_LENGTH, newCode, nextAdmin, normalizeCode } from "@/lib/social";
import type { Club } from "@/lib/types";

/*
 * Friends and clubs. Every action checks on the server that the signed-in user may do it:
 * only members can leave, and only the club's admin can rename, reset the code, remove
 * members, hand over admin or delete. Failures come back as { error } with a message to show.
 */

export type SocialResult = { error: string } | { ok: true; message?: string; href?: string };

const id = z.string().min(1).max(64);
const clubName = z.string().trim().min(1, "Give the club a name").max(60, "Keep the name under 60 characters");
const now = () => new Date().toISOString();

async function me() {
  const user = await requireUser();
  const profile = await repo.getProfile(user.sub);
  return { sub: user.sub, displayName: profile?.displayName ?? user.name ?? user.email.split("@")[0], profile };
}

/** One box for both kinds of code: a friend's code adds them, a club's code joins it. */
export async function joinWithCodeAction(raw: string): Promise<SocialResult> {
  const { sub, displayName } = await me();
  const code = normalizeCode(z.string().max(40).parse(raw));
  if (code.length !== CODE_LENGTH) return { error: "Codes are 8 letters and numbers, like ABCD-EFGH." };
  // After too many wrong codes today, every attempt fails with a generic error (see CODE_FAILURES_PER_DAY).
  const today = new Date().toISOString().slice(0, 10);
  if ((await repo.getCodeFailures(sub, today)) >= CODE_FAILURES_PER_DAY) return { error: "An error occurred." };
  const target = await repo.getCode(code);
  if (!target) {
    await repo.addCodeFailure(sub, today);
    return { error: "No friend or club has that code. Check it and try again." };
  }

  if (target.kind === "friend") {
    if (target.sub === sub) return { error: "That's your own code. Send it to a friend instead." };
    const them = await repo.getProfile(target.sub);
    if (!them) {
      await repo.addCodeFailure(sub, today);
      return { error: "No friend or club has that code. Check it and try again." };
    }
    const since = now();
    const added = await repo.addFriendship({ sub, displayName, since }, { sub: target.sub, displayName: them.displayName, since });
    if (!added) return { error: `You and ${them.displayName} are already friends.` };
    refresh();
    return { ok: true, message: `You and ${them.displayName} are now friends.` };
  }

  const club = await repo.getClub(target.clubId);
  if (!club) return { error: "That club no longer exists." };
  const joined = await repo.joinClub(club, { sub, displayName, joinedAt: now() });
  if (!joined) return { error: `You're already in ${club.name}.` };
  refresh();
  return { ok: true, message: `You joined ${club.name}.`, href: `/clubs/${club.id}` };
}

export async function removeFriendAction(friendSub: string): Promise<SocialResult> {
  const { sub } = await me();
  await repo.removeFriendship(sub, id.parse(friendSub));
  refresh();
  return { ok: true };
}

/** A new friend code; the old one stops working. Existing friends stay friends. */
export async function resetFriendCodeAction(): Promise<SocialResult> {
  const { sub, profile } = await me();
  let current = profile?.friendCode;
  for (let i = 0; i < 5; i++) {
    if (await repo.setFriendCode(sub, newCode(), current)) {
      refresh();
      return { ok: true, message: "New code ready. The old one no longer works." };
    }
    current = (await repo.getProfile(sub))?.friendCode;
  }
  return { error: "Couldn't make a new code. Try again." };
}

export async function createClubAction(rawName: string): Promise<SocialResult> {
  const { sub, displayName } = await me();
  const parsed = clubName.safeParse(rawName);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const createdAt = now();
  for (let i = 0; i < 5; i++) {
    const club: Club = { id: ulid(), name: parsed.data, adminSub: sub, code: newCode(), createdAt };
    if (await repo.createClub(club, { sub, displayName, joinedAt: createdAt })) {
      refresh();
      return { ok: true, href: `/clubs/${club.id}` };
    }
  }
  return { error: "Couldn't create the club. Try again." };
}

/** Leaving as admin passes admin to whoever joined first; the last one out deletes the club. */
export async function leaveClubAction(clubId: string): Promise<SocialResult> {
  const { sub } = await me();
  const club = await repo.getClub(id.parse(clubId));
  if (!club) return { error: "That club no longer exists." };
  const members = await repo.listClubMembers(club.id);
  if (!members.some((m) => m.sub === sub)) return { error: "You're not in this club." };

  const heir = nextAdmin(members, sub);
  if (!heir) {
    await repo.deleteClub(club);
  } else if (club.adminSub === sub) {
    if (!(await repo.removeClubMember(club.id, sub, heir))) return { error: "The club changed while you were leaving. Try again." };
  } else {
    await repo.removeClubMember(club.id, sub);
  }
  refresh();
  const heirName = members.find((m) => m.sub === heir)?.displayName;
  return {
    ok: true,
    href: "/friends",
    message: !heir
      ? `You left ${club.name}. You were the last member, so it was deleted.`
      : club.adminSub === sub
        ? `You left ${club.name}. ${heirName} is the admin now.`
        : `You left ${club.name}.`,
  };
}

/** The club, if the signed-in user is its admin. */
async function asAdmin(clubId: string): Promise<{ sub: string; club: Club } | { error: string }> {
  const { sub } = await me();
  const club = await repo.getClub(id.parse(clubId));
  if (!club) return { error: "That club no longer exists." };
  if (club.adminSub !== sub) return { error: "Only the club's admin can do that." };
  return { sub, club };
}

export async function renameClubAction(clubId: string, rawName: string): Promise<SocialResult> {
  const a = await asAdmin(clubId);
  if ("error" in a) return a;
  const parsed = clubName.safeParse(rawName);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await repo.renameClub(a.club.id, parsed.data, await repo.listClubMembers(a.club.id));
  refresh();
  return { ok: true };
}

export async function resetClubCodeAction(clubId: string): Promise<SocialResult> {
  const a = await asAdmin(clubId);
  if ("error" in a) return a;
  for (let i = 0; i < 5; i++) {
    if (await repo.resetClubCode(a.club, newCode())) {
      refresh();
      return { ok: true, message: "New code ready. The old one no longer works; members stay in." };
    }
  }
  return { error: "Couldn't make a new code. Try again." };
}

export async function removeMemberAction(clubId: string, memberSub: string): Promise<SocialResult> {
  const a = await asAdmin(clubId);
  if ("error" in a) return a;
  const target = id.parse(memberSub);
  if (target === a.sub) return { error: "To go yourself, use Leave club." };
  await repo.removeClubMember(a.club.id, target);
  refresh();
  return { ok: true };
}

export async function makeAdminAction(clubId: string, memberSub: string): Promise<SocialResult> {
  const a = await asAdmin(clubId);
  if ("error" in a) return a;
  const target = id.parse(memberSub);
  if (target === a.sub) return { ok: true };
  if (!(await repo.setClubAdmin(a.club.id, a.sub, target))) return { error: "They're no longer in the club." };
  refresh();
  return { ok: true };
}

export async function deleteClubAction(clubId: string): Promise<SocialResult> {
  const a = await asAdmin(clubId);
  if ("error" in a) return a;
  await repo.deleteClub(a.club);
  refresh();
  return { ok: true, href: "/friends", message: `${a.club.name} was deleted.` };
}
