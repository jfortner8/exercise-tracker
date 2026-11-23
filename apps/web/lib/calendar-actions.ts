"use server";

import { randomBytes } from "node:crypto";
import { refresh } from "next/cache";
import { z } from "zod";
import { calendarOptionsInput } from "@et/core/schemas";
import { requireUser } from "@/lib/dal";
import * as repo from "@/lib/db/repo";
import { validTimeZone } from "@et/core/domain";

/** 192 random bits, URL-safe: the link is the only thing protecting the feed. */
const newToken = () => randomBytes(24).toString("base64url");

/** Turns the feed on (or gives it a new link, retiring the old one). Remembers the browser's time zone. */
async function setToken(timeZone: string | undefined, replace: boolean) {
  const { sub } = await requireUser();
  const tz = z.string().max(64).optional().parse(timeZone);
  const profile = await repo.getProfile(sub);
  const old = profile?.calendarToken;
  if (old && !replace) return;
  // Older start times were entered in the saved zone: pin them there before it changes.
  if (validTimeZone(profile?.timeZone) && validTimeZone(tz) && tz !== profile.timeZone) await repo.stampStartZones(sub, profile.timeZone);
  const ok = await repo.setCalendarToken(sub, newToken(), old, validTimeZone(tz) ? tz : undefined);
  if (!ok) throw new Error("Your calendar link changed in another tab. Reload and try again.");
  refresh();
}

export async function enableCalendarFeedAction(timeZone?: string) {
  await setToken(timeZone, false);
}

export async function resetCalendarFeedAction(timeZone?: string) {
  await setToken(timeZone, true);
}

export async function disableCalendarFeedAction() {
  const { sub } = await requireUser();
  const old = (await repo.getProfile(sub))?.calendarToken;
  if (old) await repo.clearCalendarToken(sub, old);
  refresh();
}

export async function saveCalendarOptionsAction(raw: { includeNotes: boolean; plannedOnly: boolean }) {
  const { sub } = await requireUser();
  const o = calendarOptionsInput.parse(raw);
  await repo.setCalendarOptions(sub, { calendarIncludeNotes: o.includeNotes, calendarPlannedOnly: o.plannedOnly });
  refresh();
}
