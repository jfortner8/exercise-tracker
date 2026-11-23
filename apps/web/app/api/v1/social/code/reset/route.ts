import { api } from "@/lib/api";
import { resetFriendCode } from "@/lib/services/social";

/** POST /api/v1/social/code/reset — a new friend code → { friendCode }. The old one stops working; friends stay. */
export const POST = api(async ({ sub }) => ({ friendCode: await resetFriendCode(sub) }));
