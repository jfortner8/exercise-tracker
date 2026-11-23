import { api, field } from "@/lib/api";
import { createClub, displayNameOf } from "@/lib/services/social";

/** POST /api/v1/clubs — { name } → { club }, with you as its admin and first member. */
export const POST = api(async ({ sub, email, name, body }) => ({
  club: await createClub(sub, await displayNameOf(sub, email, name), field<string>(body, "name") ?? ""),
}));
