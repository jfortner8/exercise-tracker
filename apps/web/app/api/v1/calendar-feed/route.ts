import { api, field } from "@/lib/api";
import { disableFeed, enableFeed, feedInfo } from "@/lib/services/calendar-feed";

/**
 * GET /api/v1/calendar-feed — → { enabled, url, webcalUrl, includeNotes, plannedOnly }. `url` is the
 * private .ics link calendar apps subscribe to; `webcalUrl` opens the system's subscribe flow.
 */
export const GET = api(({ sub, req }) => feedInfo(sub, req.nextUrl.origin));

/**
 * POST /api/v1/calendar-feed — turns the feed on (no change if it's already on) → the same as GET.
 * Start times in the feed are written in { timeZone } if sent, else the X-Time-Zone header.
 */
export const POST = api(async ({ sub, req, body }) => {
  await enableFeed(sub, field<string>(body, "timeZone") ?? req.headers.get("x-time-zone") ?? undefined, false);
  return feedInfo(sub, req.nextUrl.origin);
});

/** DELETE /api/v1/calendar-feed — turns it off: the link stops working. */
export const DELETE = api(({ sub }) => disableFeed(sub));
