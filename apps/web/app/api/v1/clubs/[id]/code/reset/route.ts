import { api } from "@/lib/api";
import { resetClubCode } from "@/lib/services/social";

/** POST /api/v1/clubs/:id/code/reset — a new invite code → { code }. Admin only; members stay in. */
export const POST = api<{ id: string }>(async ({ sub, params }) => ({ code: await resetClubCode(sub, params.id) }));
