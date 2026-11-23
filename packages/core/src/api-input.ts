import { differenceInCalendarDays, isValid, parseISO } from "date-fns";

/*
 * Request parsing for the /api/v1 endpoints the phone app calls. Pure, so it's unit-tested.
 */

/** The token from an "Authorization: Bearer <token>" header, if there is one. */
export function bearerToken(header: string | null | undefined): string | undefined {
  const m = header?.match(/^Bearer[ \t]+([A-Za-z0-9._~+/=-]+)[ \t]*$/i);
  return m?.[1];
}

/** Longest range one calendar call returns: a month grid is at most 42 days. */
export const MAX_RANGE_DAYS = 62;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** `from`/`to` query values (yyyy-MM-dd, inclusive) checked for shape, order and size. */
export function parseRange(from: string | null, to: string | null): { from: string; to: string } | { error: string } {
  if (!from || !to) return { error: "from and to are required (yyyy-MM-dd)" };
  if (!DAY_RE.test(from) || !DAY_RE.test(to) || !isValid(parseISO(from)) || !isValid(parseISO(to))) {
    return { error: "from and to must be dates (yyyy-MM-dd)" };
  }
  const days = differenceInCalendarDays(parseISO(to), parseISO(from)) + 1;
  if (days < 1) return { error: "to must not be before from" };
  if (days > MAX_RANGE_DAYS) return { error: `at most ${MAX_RANGE_DAYS} days at a time` };
  return { from, to };
}

/** Start (epoch seconds) of the fixed rate-limit window that `nowMs` falls in. */
export function rateWindow(nowMs: number, windowSec: number): number {
  const now = Math.floor(nowMs / 1000);
  return now - (now % windowSec);
}

/** The caller's IP from Vercel's x-forwarded-for (first hop), for limiting sign-in attempts. */
export function clientIp(forwardedFor: string | null | undefined): string {
  return forwardedFor?.split(",")[0]?.trim() || "unknown";
}
