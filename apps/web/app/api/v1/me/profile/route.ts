import type { ProfileInput } from "@et/core/schemas";
import { api } from "@/lib/api";
import { me } from "@/lib/services/me";
import { saveProfile } from "@/lib/services/profile";

/** PUT /api/v1/me/profile — the settings form (ProfileInput) → the same as GET /me, with the saved settings. */
export const PUT = api(async ({ sub, email, name, body, today }) => {
  await saveProfile(sub, email, body as ProfileInput);
  return me(sub, email, name, await today());
});
