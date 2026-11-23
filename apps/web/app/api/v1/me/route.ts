import { api, field } from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import { deleteAccount, me } from "@/lib/services/me";

/** GET /api/v1/me — → { user, profile, navFlags, today }. The app's settings and which optional tabs to show. */
export const GET = api(async ({ sub, email, name, today }) => me(sub, email, name, await today()));

/**
 * DELETE /api/v1/me — body { confirm: true } → { deleted }. Deletes the account and everything in it,
 * for good. The confirm field guards against a stray request; the app asks the user first.
 */
export const DELETE = api(async ({ sub, body }) => {
  if (field(body, "confirm") !== true) throw new ApiError(400, "Send { confirm: true } to delete the account.");
  return deleteAccount(sub);
});
