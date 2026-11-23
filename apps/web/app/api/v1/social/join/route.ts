import { api, field } from "@/lib/api";
import { displayNameOf, joinWithCode } from "@/lib/services/social";

/**
 * POST /api/v1/social/join — { code }: a friend's code adds them, a club's code joins it.
 * → { kind: "friend", friend, message } | { kind: "club", club, message }.
 * 404 for an unknown code, 409 when already friends or in the club, and 429 after too many wrong
 * codes in a day.
 */
export const POST = api(async ({ sub, email, name, body }) =>
  joinWithCode(sub, await displayNameOf(sub, email, name), field<string>(body, "code") ?? ""),
);
