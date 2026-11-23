import { api, field } from "@/lib/api";
import { enableFeed, feedInfo } from "@/lib/services/calendar-feed";

/**
 * POST /api/v1/calendar-feed/reset — a new link; the old one stops working, so calendars subscribed
 * to it stop updating. → the same as GET /calendar-feed. 409 if it changed meanwhile.
 */
export const POST = api(async ({ sub, req, body }) => {
  await enableFeed(sub, field<string>(body, "timeZone") ?? req.headers.get("x-time-zone") ?? undefined, true);
  return feedInfo(sub, req.nextUrl.origin);
});
