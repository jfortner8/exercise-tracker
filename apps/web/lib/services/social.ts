import "server-only";
import { id } from "@et/core/schemas";
import { nextAdmin } from "@et/core/social";
import { ApiError } from "@/lib/api-error";
import * as repo from "@/lib/db/repo";

/*
 * Friends and clubs as plain functions of the user id. The rest of social-actions moves here
 * with the social endpoints.
 */

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
  return { club, deleted: !heir, wasAdmin, heirName: members.find((m) => m.sub === heir)?.displayName };
}
