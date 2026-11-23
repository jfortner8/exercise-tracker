import { api } from "@/lib/api";
import { removeFriend } from "@/lib/services/social";

/** DELETE /api/v1/friends/:sub — ends the friendship on both sides. */
export const DELETE = api<{ sub: string }>(({ sub, params }) => removeFriend(sub, params.sub));
