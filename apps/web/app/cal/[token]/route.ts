import { addDays, format, parseISO } from "date-fns";
import type { NextRequest } from "next/server";
import * as repo from "@/lib/db/repo";
import { validTimeZone } from "@et/core/domain";
import { buildCalendar } from "@/lib/ical";

/**
 * The private calendar feed. Public on purpose (calendar apps can't sign in): the long random
 * token in the URL is the only key. /cal/<token>.ics — the ".ics" is optional.
 */
export async function GET(req: NextRequest, ctx: RouteContext<"/cal/[token]">) {
  const token = (await ctx.params).token.replace(/\.ics$/, "");
  const notFound = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  if (!/^[A-Za-z0-9_-]{32}$/.test(token)) return notFound();
  const sub = await repo.getCalendarFeedOwner(token);
  if (!sub) return notFound();
  const profile = await repo.getProfile(sub);
  // The pointer outlived a reset that didn't finish: only the profile's current token counts.
  if (!profile || profile.calendarToken !== token) return notFound();

  const timeZone = validTimeZone(profile.timeZone) ? profile.timeZone : undefined;
  const now = new Date();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: timeZone ?? "UTC" }).format(now); // yyyy-MM-dd
  const ymd = (n: number) => format(addDays(parseISO(today), n), "yyyy-MM-dd");
  let workouts = await repo.listWorkouts(sub, ymd(-60), ymd(365));
  if (profile.calendarPlannedOnly) workouts = workouts.filter((w) => w.status === "planned");

  const body = buildCalendar(workouts, {
    units: profile.units,
    timeZone,
    includeNotes: profile.calendarIncludeNotes === true,
    host: req.nextUrl.host,
    origin: req.nextUrl.origin,
    now,
    name: "Workouts",
  });
  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="workouts.ics"',
      "Cache-Control": "private, max-age=300",
      "X-Robots-Tag": "noindex",
    },
  });
}
