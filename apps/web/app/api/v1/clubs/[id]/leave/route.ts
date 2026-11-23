import { api } from "@/lib/api";
import { leaveClub } from "@/lib/services/social";

/**
 * POST /api/v1/clubs/:id/leave — → { deleted, message }. Leaving as admin passes admin to the
 * longest-standing member; the last one out deletes the club.
 */
export const POST = api<{ id: string }>(async ({ sub, params }) => {
  const { deleted, message } = await leaveClub(sub, params.id);
  return { deleted, message };
});
