"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { syncTimeZoneAction } from "@/lib/actions";
import { TZ_COOKIE } from "@et/core/domain";

/**
 * Keeps the server told where the user is. The server runs in UTC, so it reads "today" from the tz
 * cookie set here. When the cookie was missing or out of date (first visit, or the user has travelled)
 * the page is refreshed so server-chosen days (the calendar's opening week, the weight chart) match.
 * A zone that differs from the profile's is saved too, for the calendar feed and leaderboards.
 */
export function ZoneSync({ profileZone }: { profileZone?: string }) {
  const router = useRouter();
  useEffect(() => {
    let zone: string;
    try {
      zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return;
    }
    if (!zone) return;
    const current = document.cookie.match(new RegExp(`(?:^|; )${TZ_COOKIE}=([^;]*)`))?.[1];
    const stale = current !== zone;
    if (stale) document.cookie = `${TZ_COOKIE}=${zone}; path=/; max-age=31536000; samesite=lax`;
    if (zone !== profileZone) {
      // Saving the zone refreshes the page itself.
      syncTimeZoneAction(zone).catch(() => stale && router.refresh());
    } else if (stale) {
      router.refresh();
    }
  }, [profileZone, router]);
  return null;
}
