import "server-only";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import type { CalendarFeedResponse } from "@et/core/api-types";
import { validTimeZone } from "@et/core/domain";
import { calendarOptionsInput } from "@et/core/schemas";
import { ApiError } from "@/lib/api-error";
import * as repo from "@/lib/db/repo";

/*
 * The private calendar feed (/cal/<token>.ics) that calendar apps subscribe to.
 * Plain functions of the user id: the website's actions (lib/calendar-actions.ts) and /api/v1 both call them.
 */

/** 192 random bits, URL-safe: the link is the only thing protecting the feed. */
const newToken = () => randomBytes(24).toString("base64url");

/**
 * Turns the feed on, or with `replace` gives it a new link and retires the old one. Remembers the
 * device's time zone, which the feed's start times are written in. → the token.
 */
export async function enableFeed(sub: string, timeZone: string | undefined, replace: boolean) {
  const tz = z.string().max(64).optional().parse(timeZone);
  const profile = await repo.getProfile(sub);
  const old = profile?.calendarToken;
  if (old && !replace) return old;
  // Older start times were entered in the saved zone: pin them there before it changes.
  if (validTimeZone(profile?.timeZone) && validTimeZone(tz) && tz !== profile.timeZone) await repo.stampStartZones(sub, profile.timeZone);
  const token = newToken();
  const ok = await repo.setCalendarToken(sub, token, old, validTimeZone(tz) ? tz : undefined);
  if (!ok) throw new ApiError(409, "Your calendar link changed in another tab. Reload and try again.");
  return token;
}

/** Turns the feed off: the link stops working. */
export async function disableFeed(sub: string) {
  const old = (await repo.getProfile(sub))?.calendarToken;
  if (old) await repo.clearCalendarToken(sub, old);
}

export async function saveFeedOptions(sub: string, raw: { includeNotes: boolean; plannedOnly: boolean }) {
  const o = calendarOptionsInput.parse(raw);
  await repo.setCalendarOptions(sub, { calendarIncludeNotes: o.includeNotes, calendarPlannedOnly: o.plannedOnly });
}

/** The feed's state, with its links on `origin` when it's on. */
export async function feedInfo(sub: string, origin: string): Promise<CalendarFeedResponse> {
  const p = await repo.getProfile(sub);
  const url = p?.calendarToken ? `${origin}/cal/${p.calendarToken}.ics` : null;
  return {
    enabled: url != null,
    url,
    /** Opens the system's "subscribe to calendar" flow on iOS and macOS. */
    webcalUrl: url?.replace(/^https?:/, "webcal:") ?? null,
    includeNotes: p?.calendarIncludeNotes === true,
    plannedOnly: p?.calendarPlannedOnly === true,
  };
}
