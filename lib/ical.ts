/**
 * The private calendar feed (iCalendar, RFC 5545) that Google Calendar, Outlook and Apple Calendar subscribe to.
 * They download it on their own schedule; each workout's UID stays the same, so changes update events in place.
 */
import { addDays, format, parseISO } from "date-fns";
import { autoTitle, workoutCategory } from "./activities";
import { describeDuration, describeIntervals, detailsDurationSec, DONE_STATUSES, formatDistance, validTimeZone } from "./domain";
import { describeExercise } from "./routines";
import { zonedTimeToUtc } from "./start-time";
import type { Units, Workout, WorkoutDetails } from "./types";

export { zonedTimeToUtc } from "./start-time";

/** Length of a timed event when the workout has no duration. */
export const DEFAULT_EVENT_SEC = 60 * 60;

/** Escapes a TEXT value: backslash, semicolon, comma and newlines. */
export function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Folds a content line to at most 75 octets per line (UTF-8), without splitting a character. */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  const out: string[] = [];
  let cur = "";
  let bytes = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    // Continuation lines start with a space, which counts toward their 75.
    const limit = out.length ? 74 : 75;
    if (bytes + n > limit) {
      out.push(cur);
      cur = "";
      bytes = 0;
    }
    cur += ch;
    bytes += n;
  }
  out.push(cur);
  return out.join("\r\n ");
}

const utcStamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const dateValue = (iso: string) => iso.replace(/-/g, "");

/** Seconds the event lasts: what was done once logged, otherwise the plan; an hour if neither says. */
export function eventDurationSec(w: Pick<Workout, "status" | "planned" | "actual">): number {
  const d = DONE_STATUSES.has(w.status) ? (w.actual ?? w.planned) : w.planned;
  return detailsDurationSec(d) || DEFAULT_EVENT_SEC;
}

const STATUS_PREFIX: Partial<Record<Workout["status"], string>> = {
  completed: "✓ ",
  partial: "✓ ",
  substituted: "✓ ",
  skipped: "Skipped: ",
  missed: "Missed: ",
};

function detailLine(label: string, d: WorkoutDetails | undefined, units: Units): string | undefined {
  if (!d) return undefined;
  const dur = d.durationSec;
  const parts = [
    dur ? describeDuration(dur) : "",
    d.distanceM ? formatDistance(d.distanceM, units) : "",
    describeIntervals(d.intervals) ?? "",
  ].filter(Boolean);
  const head = parts.length ? `${label}: ${parts.join(" · ")}` : "";
  const exercises = (d.exercises ?? []).map((e) => `• ${describeExercise(e, units)}`);
  const lines = [head || (exercises.length ? `${label}:` : ""), ...exercises, d.description?.trim()];
  return lines.filter(Boolean).join("\n") || undefined;
}

export interface FeedOptions {
  units: Units;
  /** IANA zone for start times saved without their own; with neither, timed events float in the viewer's zone. */
  timeZone?: string;
  includeNotes?: boolean;
  /** Host used in UIDs and links, e.g. "exercise.example.com". */
  host: string;
  /** Site origin for the link back to the day, e.g. "https://exercise.example.com". Defaults to https://host. */
  origin?: string;
  now: Date;
}

/** One VEVENT's content lines (unfolded). */
export function workoutEventLines(w: Workout, o: FeedOptions): string[] {
  const title = w.title?.trim() || autoTitle(w, o.units);
  const cat = workoutCategory(w);
  const lines = [
    "BEGIN:VEVENT",
    `UID:${w.id}@${o.host}`,
    `DTSTAMP:${utcStamp(o.now)}`,
    `LAST-MODIFIED:${utcStamp(new Date(w.updatedAt))}`,
    // Grows with each edit so calendars that check it take the new version.
    `SEQUENCE:${Math.max(0, Math.floor(Date.parse(w.updatedAt) / 1000) - 1_700_000_000)}`,
  ];
  if (w.startTime) {
    const sec = eventDurationSec(w);
    // The zone it was entered in, so 8am Eastern stays that moment after a drive to Alabama.
    const zone = validTimeZone(w.startZone) ? w.startZone : o.timeZone;
    if (zone) {
      const start = zonedTimeToUtc(w.date, w.startTime, zone);
      lines.push(`DTSTART:${utcStamp(start)}`, `DTEND:${utcStamp(new Date(start.getTime() + sec * 1000))}`);
    } else {
      // Floating time: same wall-clock time wherever the calendar is.
      const start = new Date(`${w.date}T${w.startTime}:00Z`);
      const floating = (d: Date) => utcStamp(d).replace(/Z$/, "");
      lines.push(`DTSTART:${floating(start)}`, `DTEND:${floating(new Date(start.getTime() + sec * 1000))}`);
    }
  } else {
    lines.push(
      `DTSTART;VALUE=DATE:${dateValue(w.date)}`,
      `DTEND;VALUE=DATE:${dateValue(format(addDays(parseISO(w.date), 1), "yyyy-MM-dd"))}`,
    );
  }
  lines.push(`SUMMARY:${escapeText(`${STATUS_PREFIX[w.status] ?? ""}${title}`)}`);
  if (w.location) lines.push(`LOCATION:${escapeText(w.location)}`);
  const done = DONE_STATUSES.has(w.status);
  const description = [
    `${cat.emoji} ${cat.label}`,
    detailLine("Plan", w.planned, o.units),
    done ? detailLine("Done", w.actual, o.units) : undefined,
    o.includeNotes && w.notes?.trim() ? `Notes: ${w.notes.trim()}` : undefined,
  ].filter(Boolean);
  lines.push(`DESCRIPTION:${escapeText(description.join("\n"))}`);
  lines.push(`URL:${o.origin ?? `https://${o.host}`}/?d=${w.date}`);
  // A timed workout shows you as busy; an all-day one doesn't block the day.
  lines.push(`TRANSP:${w.startTime ? "OPAQUE" : "TRANSPARENT"}`, "END:VEVENT");
  return lines;
}

/** The whole feed, CRLF line endings, folded. */
export function buildCalendar(workouts: Workout[], o: FeedOptions & { name?: string }): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Exercise Tracker//Workouts//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(o.name ?? "Workouts")}`,
    ...(o.timeZone ? [`X-WR-TIMEZONE:${o.timeZone}`] : []),
    // A hint; Google and Outlook pick their own refresh schedule.
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
    ...workouts.flatMap((w) => workoutEventLines(w, o)),
    "END:VCALENDAR",
  ];
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
