import { formatStartTime, validTimeZone } from "./domain";
import type { Clock, Workout } from "./types";

/*
 * A start time is a moment: "08:00" in the zone it was entered in (Workout.startZone). Dates stay
 * floating, so a Tuesday run is Tuesday wherever you are; only the clock time is converted.
 */

/** Milliseconds `timeZone` is ahead of UTC at instant `ms`. */
export function zoneOffsetMs(ms: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(ms));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")) - ms;
}

/** The UTC instant of wall-clock `date` + `hhmm` in `timeZone` (DST-aware). */
export function zonedTimeToUtc(date: string, hhmm: string, timeZone: string): Date {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  // Two passes settle the offset on the right side of a DST change.
  let ms = wall - zoneOffsetMs(wall, timeZone);
  ms = wall - zoneOffsetMs(ms, timeZone);
  return new Date(ms);
}

/** The date (yyyy-MM-dd) and "HH:mm" on the wall in `timeZone` at instant `at`. */
function wallClock(at: Date, timeZone: string): { date: string; time: string } {
  const w = new Date(at.getTime() + zoneOffsetMs(at.getTime(), timeZone)).toISOString();
  return { date: w.slice(0, 10), time: w.slice(11, 16) };
}

/** "EST", "CDT", or "GMT+9" where the zone has no common short name. */
export function zoneAbbr(timeZone: string, at: Date): string {
  const part = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" }).formatToParts(at);
  return part.find((p) => p.type === "timeZoneName")?.value ?? timeZone;
}

type Timed = Pick<Workout, "date" | "startTime" | "startZone">;

/** True when the start time reads differently in `zone` than where it was entered. */
export function zoneDiffers(w: Timed, zone?: string): w is Timed & { startTime: string; startZone: string } {
  if (!w.startTime || !validTimeZone(w.startZone) || !validTimeZone(zone)) return false;
  const at = zonedTimeToUtc(w.date, w.startTime, w.startZone).getTime();
  return zoneOffsetMs(at, w.startZone) !== zoneOffsetMs(at, zone);
}

/**
 * The same moment as "HH:mm" in `zone`, when it's still on the workout's date there. Undefined when
 * it would land on another day (a late run seen from far away).
 */
export function startTimeIn(w: Timed, zone: string): string | undefined {
  if (!w.startTime) return undefined;
  if (!zoneDiffers(w, zone)) return w.startTime;
  const here = wallClock(zonedTimeToUtc(w.date, w.startTime, w.startZone), zone);
  return here.date === w.date ? here.time : undefined;
}

/**
 * A start time for display where the user is now (`zone`): "8:00 AM" when the zones agree,
 * "7:00 AM (8:00 AM EST)" after driving from Atlanta to Alabama, and just "8:00 PM EST" when the
 * moment falls on another day there.
 */
export function startTimeLabel(w: Timed, zone: string | undefined, clock?: Clock): string | undefined {
  if (!w.startTime) return undefined;
  const entered = formatStartTime(w.startTime, clock);
  if (!zoneDiffers(w, zone)) return entered;
  const there = `${entered} ${zoneAbbr(w.startZone, zonedTimeToUtc(w.date, w.startTime, w.startZone))}`;
  const here = startTimeIn(w, zone!);
  return here ? `${formatStartTime(here, clock)} (${there})` : there;
}
