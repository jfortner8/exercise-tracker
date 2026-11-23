import { api } from "@/lib/api";
import { makeAdmin } from "@/lib/services/social";

/** POST /api/v1/clubs/:id/members/:sub/admin — hands admin to that member. Admin only. */
export const POST = api<{ id: string; sub: string }>(({ sub, params }) => makeAdmin(sub, params.id, params.sub));
