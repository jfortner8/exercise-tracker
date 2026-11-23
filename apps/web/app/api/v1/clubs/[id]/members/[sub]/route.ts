import { api } from "@/lib/api";
import { removeMember } from "@/lib/services/social";

/** DELETE /api/v1/clubs/:id/members/:sub — removes a member. Admin only; to go yourself, leave. */
export const DELETE = api<{ id: string; sub: string }>(({ sub, params }) => removeMember(sub, params.id, params.sub));
