import "server-only";
import { ulid } from "ulid";
import type { ClubResponse, JoinResponse, SocialResponse } from "@et/core/api-types";
import { clubName, id, joinCode } from "@et/core/schemas";
import { CODE_FAILURES_PER_DAY, CODE_LENGTH, newCode, nextAdmin, normalizeCode } from "@et/core/social";
import type { Club, Profile } from "@et/core/types";
import { ApiError } from "@/lib/api-error";
import * as repo from "@/lib/db/repo";
import { ensureFriendCode, friendsCircle } from "@/lib/social-server";

/*
 * Friends and clubs as plain functions of the user id: the website's actions (lib/social-actions.ts)
 * and the /api/v1 routes both call them. Every function checks that the user may do it: only members
 * see or leave a club, and only its admin can rename it, reset its code, remove members, hand over
 * admin or delete it. Failures throw ApiError with a message to show.
 */

const now = () => new Date().toISOString();
const NO_CODE = "No friend or club has that code. Check it and try again.";

/** The name friends and clubmates see: the profile's, else the sign-up name, else the email's first part. */
export async function displayNameOf(sub: string, email: string, name?: string) {
  return (await repo.getProfile(sub))?.displayName ?? name ?? email.split("@")[0];
}

// ---------- Reads ----------

/** The Friends & clubs screen: your friend code, your friends, your clubs with member counts. */
export async function socialOverview(sub: string, profile: Profile): Promise<SocialResponse> {
  const [code, circle, myClubs] = await Promise.all([ensureFriendCode(sub, profile), friendsCircle(sub), repo.listMyClubs(sub)]);
  const clubs = (
    await Promise.all(
      myClubs.map(async (c) => {
        const [club, members] = await Promise.all([repo.getClub(c.clubId), repo.listClubMembers(c.clubId)]);
        return club ? { club, memberCount: members.length, isAdmin: club.adminSub === sub } : null;
      }),
    )
  )
    .filter((c) => c != null)
    .sort((a, b) => a.club.name.localeCompare(b.club.name));
  const friends = [...circle.friends].sort((a, b) => a.displayName.localeCompare(b.displayName));
  return { friendCode: code, friends, clubs };
}

/**
 * One club, for its members only: to anyone else it doesn't exist. Members come admin first, then by
 * when they joined. `heir` is who becomes admin if the admin leaves.
 */
export async function clubDetail(sub: string, clubId: string): Promise<ClubResponse> {
  const [club, members] = await Promise.all([repo.getClub(clubId), repo.listClubMembers(clubId)]);
  if (!club || !members.some((m) => m.sub === sub)) throw new ApiError(404, "That club no longer exists.");
  const sorted = [...members].sort(
    (a, b) => Number(b.sub === club.adminSub) - Number(a.sub === club.adminSub) || a.joinedAt.localeCompare(b.joinedAt),
  );
  const heirSub = nextAdmin(members, sub);
  const heir = heirSub ? (members.find((m) => m.sub === heirSub) ?? null) : null;
  return { club, members: sorted, isAdmin: club.adminSub === sub, heir };
}

// ---------- Codes and friends ----------

/**
 * One box for both kinds of code: a friend's code adds them, a club's code joins it.
 * → what happened, with a message to show.
 */
export async function joinWithCode(
  sub: string,
  displayName: string,
  raw: string,
): Promise<JoinResponse> {
  const code = normalizeCode(joinCode.parse(raw));
  if (code.length !== CODE_LENGTH) throw new ApiError(400, "Codes are 16 letters and numbers, like ABCD-EFGH-JKMN-PQRS.");
  // After too many wrong codes today, every attempt fails with a generic error (see CODE_FAILURES_PER_DAY).
  const today = now().slice(0, 10);
  if ((await repo.getCodeFailures(sub, today)) >= CODE_FAILURES_PER_DAY) throw new ApiError(429, "An error occurred.", "RATE_LIMITED");
  const target = await repo.getCode(code);
  if (!target) {
    await repo.addCodeFailure(sub, today);
    throw new ApiError(404, NO_CODE);
  }

  if (target.kind === "friend") {
    if (target.sub === sub) throw new ApiError(400, "That's your own code. Send it to a friend instead.");
    const them = await repo.getProfile(target.sub);
    if (!them) {
      await repo.addCodeFailure(sub, today);
      throw new ApiError(404, NO_CODE);
    }
    const since = now();
    const added = await repo.addFriendship({ sub, displayName, since }, { sub: target.sub, displayName: them.displayName, since });
    if (!added) throw new ApiError(409, `You and ${them.displayName} are already friends.`);
    return { kind: "friend", friend: { sub: target.sub, displayName: them.displayName }, message: `You and ${them.displayName} are now friends.` };
  }

  const club = await repo.getClub(target.clubId);
  if (!club) throw new ApiError(404, "That club no longer exists.");
  const joined = await repo.joinClub(club, { sub, displayName, joinedAt: now() });
  if (!joined) throw new ApiError(409, `You're already in ${club.name}.`);
  return { kind: "club", club: { id: club.id, name: club.name }, message: `You joined ${club.name}.` };
}

export async function removeFriend(sub: string, friendSub: string) {
  await repo.removeFriendship(sub, id.parse(friendSub));
}

/** A new friend code; the old one stops working. Existing friends stay friends. → the new code. */
export async function resetFriendCode(sub: string) {
  let current = (await repo.getProfile(sub))?.friendCode;
  for (let i = 0; i < 5; i++) {
    const code = newCode();
    if (await repo.setFriendCode(sub, code, current)) return code;
    current = (await repo.getProfile(sub))?.friendCode;
  }
  throw new ApiError(503, "Couldn't make a new code. Try again.");
}

// ---------- Clubs ----------

/** A new club with you as its admin and first member. → the club. */
export async function createClub(sub: string, displayName: string, rawName: string): Promise<Club> {
  const parsed = clubName.safeParse(rawName);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);
  const createdAt = now();
  for (let i = 0; i < 5; i++) {
    const club: Club = { id: ulid(), name: parsed.data, adminSub: sub, code: newCode(), createdAt };
    if (await repo.createClub(club, { sub, displayName, joinedAt: createdAt })) return club;
  }
  throw new ApiError(503, "Couldn't create the club. Try again.");
}

/**
 * Leaves a club. Leaving as admin passes admin to whoever joined first; the last one out deletes it.
 */
export async function leaveClub(sub: string, clubId: string) {
  const club = await repo.getClub(id.parse(clubId));
  if (!club) throw new ApiError(404, "That club no longer exists.");
  const members = await repo.listClubMembers(club.id);
  if (!members.some((m) => m.sub === sub)) throw new ApiError(403, "You're not in this club.");

  const heir = nextAdmin(members, sub);
  const wasAdmin = club.adminSub === sub;
  if (!heir) {
    await repo.deleteClub(club);
  } else if (wasAdmin) {
    if (!(await repo.removeClubMember(club.id, sub, heir))) throw new ApiError(409, "The club changed while you were leaving. Try again.");
  } else {
    await repo.removeClubMember(club.id, sub);
  }
  const heirName = members.find((m) => m.sub === heir)?.displayName;
  const message = !heir
    ? `You left ${club.name}. You were the last member, so it was deleted.`
    : wasAdmin
      ? `You left ${club.name}. ${heirName} is the admin now.`
      : `You left ${club.name}.`;
  return { club, deleted: !heir, wasAdmin, heirName, message };
}

/** The club, if `sub` is its admin. */
async function asAdmin(sub: string, clubId: string): Promise<Club> {
  const club = await repo.getClub(id.parse(clubId));
  if (!club) throw new ApiError(404, "That club no longer exists.");
  if (club.adminSub !== sub) throw new ApiError(403, "Only the club's admin can do that.");
  return club;
}

export async function renameClub(sub: string, clubId: string, rawName: string) {
  const club = await asAdmin(sub, clubId);
  const parsed = clubName.safeParse(rawName);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);
  await repo.renameClub(club.id, parsed.data, await repo.listClubMembers(club.id));
}

/** A new invite code; the old one stops working, members stay in. → the new code. */
export async function resetClubCode(sub: string, clubId: string) {
  const club = await asAdmin(sub, clubId);
  for (let i = 0; i < 5; i++) {
    const code = newCode();
    if (await repo.resetClubCode(club, code)) return code;
  }
  throw new ApiError(503, "Couldn't make a new code. Try again.");
}

export async function removeMember(sub: string, clubId: string, memberSub: string) {
  const club = await asAdmin(sub, clubId);
  const target = id.parse(memberSub);
  if (target === sub) throw new ApiError(400, "To go yourself, use Leave club.");
  await repo.removeClubMember(club.id, target);
}

export async function makeAdmin(sub: string, clubId: string, memberSub: string) {
  const club = await asAdmin(sub, clubId);
  const target = id.parse(memberSub);
  if (target === sub) return;
  if (!(await repo.setClubAdmin(club.id, sub, target))) throw new ApiError(409, "They're no longer in the club.");
}

/** Deletes the club for everyone. → the deleted club. */
export async function deleteClub(sub: string, clubId: string) {
  const club = await asAdmin(sub, clubId);
  await repo.deleteClub(club);
  return club;
}

