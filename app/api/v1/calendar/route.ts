import { NextResponse, type NextRequest } from "next/server";
import { userFromRequest } from "@/lib/api-auth";
import { parseRange } from "@/lib/api-input";
import { firstEntryDate, getProfile } from "@/lib/db/repo";
import { todayIn, userZone } from "@/lib/domain";
import { calendarRange } from "@/lib/services/calendar";

const noStore = { "Cache-Control": "private, no-store" };

/**
 * GET /api/v1/calendar?from=yyyy-MM-dd&to=yyyy-MM-dd — one calendar screen's data for the app.
 * The app sends its time zone as X-Time-Zone so "today" is the user's day, not the server's.
 */
export async function GET(req: NextRequest) {
  const user = await userFromRequest(req);
  if (!user) return NextResponse.json({ error: "Sign in again." }, { status: 401, headers: noStore });
  const range = parseRange(req.nextUrl.searchParams.get("from"), req.nextUrl.searchParams.get("to"));
  if ("error" in range) return NextResponse.json({ error: range.error }, { status: 400, headers: noStore });

  const [profile, startDate, data] = await Promise.all([
    getProfile(user.sub),
    firstEntryDate(user.sub),
    calendarRange(user.sub, range.from, range.to),
  ]);
  const today = todayIn(userZone(req.headers.get("x-time-zone") ?? undefined, profile?.timeZone));
  return NextResponse.json({ ...range, today, startDate, ...data }, { headers: noStore });
}
