import { api, field } from "@/lib/api";
import { syncTimeZone } from "@/lib/services/profile";

/**
 * POST /api/v1/me/time-zone — { timeZone } (IANA). The app sends it when the phone's zone differs
 * from the profile's (travelling, or moved), as the website does from the browser.
 */
export const POST = api(async ({ sub, body }) => syncTimeZone(sub, field<string>(body, "timeZone") ?? ""));
