import { api, field } from "@/lib/api";
import { clubDetail, deleteClub, renameClub } from "@/lib/services/social";

type Params = { id: string };

/**
 * GET /api/v1/clubs/:id — → { club, members, isAdmin, heir }, for members only (404 to anyone else).
 * Members come admin first, then by when they joined; `heir` becomes admin if the admin leaves.
 */
export const GET = api<Params>(({ sub, params }) => clubDetail(sub, params.id));

/** PATCH /api/v1/clubs/:id — { name }. Admin only. */
export const PATCH = api<Params>(({ sub, params, body }) => renameClub(sub, params.id, field<string>(body, "name") ?? ""));

/** DELETE /api/v1/clubs/:id — deletes it for everyone. Admin only. */
export const DELETE = api<Params>(async ({ sub, params }) => {
  await deleteClub(sub, params.id);
});
