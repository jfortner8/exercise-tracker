"use server";

import { refresh } from "next/cache";
import { requireUser } from "@/lib/dal";
import * as feed from "@/lib/services/calendar-feed";

/*
 * The calendar feed: the website's actions. Each is the signed-in user, then the shared service
 * (lib/services/calendar-feed.ts, which the /api/v1 routes call too), then a re-render.
 */

/** Turns the feed on. Remembers the browser's time zone. */
export async function enableCalendarFeedAction(timeZone?: string) {
  const { sub } = await requireUser();
  await feed.enableFeed(sub, timeZone, false);
  refresh();
}

/** A new link; the old one stops working. */
export async function resetCalendarFeedAction(timeZone?: string) {
  const { sub } = await requireUser();
  await feed.enableFeed(sub, timeZone, true);
  refresh();
}

export async function disableCalendarFeedAction() {
  const { sub } = await requireUser();
  await feed.disableFeed(sub);
  refresh();
}

export async function saveCalendarOptionsAction(raw: { includeNotes: boolean; plannedOnly: boolean }) {
  const { sub } = await requireUser();
  await feed.saveFeedOptions(sub, raw);
  refresh();
}
