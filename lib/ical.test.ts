import { describe, expect, it } from "vitest";
import { buildCalendar, escapeText, eventDurationSec, foldLine, workoutEventLines, zonedTimeToUtc } from "./ical";
import type { Workout } from "./types";

const base: Workout = {
  id: "01HXYZ",
  date: "2026-11-18",
  type: "run",
  title: "Easy run",
  status: "planned",
  planned: { durationSec: 45 * 60, distanceM: 8000 },
  createdAt: "2026-11-01T10:00:00.000Z",
  updatedAt: "2026-11-02T10:00:00.000Z",
};
const opts = { units: { distance: "km", weight: "kg" } as const, host: "app.test", now: new Date("2026-11-17T12:00:00Z") };
const ev = (w: Partial<Workout>, o: Partial<typeof opts & { timeZone: string; includeNotes: boolean }> = {}) =>
  workoutEventLines({ ...base, ...w }, { ...opts, ...o });
const field = (lines: string[], name: string) => lines.find((l) => l.startsWith(name))?.slice(name.length);

describe("escapeText", () => {
  it("escapes the special characters", () => {
    expect(escapeText("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne");
  });
});

describe("foldLine", () => {
  it("leaves short lines alone", () => {
    expect(foldLine("SUMMARY:Run")).toBe("SUMMARY:Run");
  });
  it("folds at 75 octets with a leading space", () => {
    const folded = foldLine("X".repeat(200));
    const parts = folded.split("\r\n");
    expect(parts[0]).toHaveLength(75);
    expect(parts.slice(1).every((p) => p.startsWith(" ") && new TextEncoder().encode(p).length <= 75)).toBe(true);
    expect(parts.map((p, i) => (i ? p.slice(1) : p)).join("")).toBe("X".repeat(200));
  });
  it("never splits a multi-byte character", () => {
    const line = "SUMMARY:" + "💃".repeat(40);
    const parts = foldLine(line).split("\r\n");
    expect(parts.every((p) => new TextEncoder().encode(p).length <= 75)).toBe(true);
    expect(parts.map((p, i) => (i ? p.slice(1) : p)).join("")).toBe(line);
  });
});

describe("zonedTimeToUtc", () => {
  it("handles standard and daylight time", () => {
    expect(zonedTimeToUtc("2026-11-18", "06:30", "America/New_York").toISOString()).toBe("2026-11-18T11:30:00.000Z");
    expect(zonedTimeToUtc("2026-07-01", "06:30", "America/New_York").toISOString()).toBe("2026-07-01T10:30:00.000Z");
    expect(zonedTimeToUtc("2026-07-01", "18:00", "Europe/London").toISOString()).toBe("2026-07-01T17:00:00.000Z");
  });
  it("gets the day after a DST change right", () => {
    // US clocks fall back on 2026-11-01.
    expect(zonedTimeToUtc("2026-11-01", "09:00", "America/New_York").toISOString()).toBe("2026-11-01T14:00:00.000Z");
  });
});

describe("eventDurationSec", () => {
  it("uses the plan, then what was done once logged", () => {
    expect(eventDurationSec(base)).toBe(45 * 60);
    expect(eventDurationSec({ ...base, status: "completed", actual: { durationSec: 50 * 60 } })).toBe(50 * 60);
  });
  it("adds up intervals", () => {
    expect(eventDurationSec({ ...base, planned: { intervals: { warmupSec: 600, reps: 6, workSec: 60, restSec: 60, cooldownSec: 600 } } })).toBe(
      32 * 60,
    );
  });
  it("falls back to an hour", () => {
    expect(eventDurationSec({ ...base, planned: undefined })).toBe(3600);
  });
});

describe("workoutEventLines", () => {
  it("makes an untimed workout all-day", () => {
    const l = ev({});
    expect(field(l, "DTSTART;VALUE=DATE:")).toBe("20261118");
    expect(field(l, "DTEND;VALUE=DATE:")).toBe("20261119");
    expect(field(l, "TRANSP:")).toBe("TRANSPARENT");
  });
  it("keeps the UID stable across edits", () => {
    expect(field(ev({ title: "A" }), "UID:")).toBe(field(ev({ title: "B", updatedAt: "2026-11-10T00:00:00Z" }), "UID:"));
    expect(field(ev({}), "UID:")).toBe("01HXYZ@app.test");
  });
  it("raises SEQUENCE when edited", () => {
    expect(Number(field(ev({ updatedAt: "2026-11-10T00:00:00Z" }), "SEQUENCE:"))).toBeGreaterThan(Number(field(ev({}), "SEQUENCE:")));
  });
  it("times an event from the start time plus duration", () => {
    const l = ev({ startTime: "06:30" }, { timeZone: "America/New_York" });
    expect(field(l, "DTSTART:")).toBe("20261118T113000Z");
    expect(field(l, "DTEND:")).toBe("20261118T121500Z");
    expect(field(l, "TRANSP:")).toBe("OPAQUE");
  });
  it("keeps a start time in the zone it was entered in, wherever the profile's zone has moved", () => {
    // 8am Eastern, fetched after the profile moved to Alabama: still 13:00Z, so 7am there.
    const l = ev({ startTime: "08:00", startZone: "America/New_York" }, { timeZone: "America/Chicago" });
    expect(field(l, "DTSTART:")).toBe("20261118T130000Z");
    // Without its own zone it uses the profile's.
    expect(field(ev({ startTime: "08:00" }, { timeZone: "America/Chicago" }), "DTSTART:")).toBe("20261118T140000Z");
  });
  it("runs past midnight into the next day", () => {
    const l = ev({ startTime: "23:30", planned: { durationSec: 90 * 60 } }, { timeZone: "UTC" });
    expect(field(l, "DTSTART:")).toBe("20261118T233000Z");
    expect(field(l, "DTEND:")).toBe("20261119T010000Z");
  });
  it("floats without a time zone", () => {
    const l = ev({ startTime: "06:30" });
    expect(field(l, "DTSTART:")).toBe("20261118T063000");
    expect(field(l, "DTEND:")).toBe("20261118T071500");
  });
  it("marks logged, skipped and missed workouts", () => {
    expect(field(ev({ status: "completed" }), "SUMMARY:")).toBe("✓ Easy run");
    expect(field(ev({ status: "skipped" }), "SUMMARY:")).toBe("Skipped: Easy run");
    expect(field(ev({ status: "missed" }), "SUMMARY:")).toBe("Missed: Easy run");
    expect(field(ev({}), "SUMMARY:")).toBe("Easy run");
  });
  it("describes the plan and only includes notes when asked", () => {
    const w = { notes: "Felt good, legs ok" };
    expect(field(ev(w), "DESCRIPTION:")).toMatch(/^.+ Run\\nPlan: 45 min · 8\.00 km$/);
    expect(field(ev(w), "DESCRIPTION:")).not.toContain("Notes");
    expect(field(ev(w, { includeNotes: true }), "DESCRIPTION:")).toContain("Notes: Felt good\\, legs ok");
  });
  it("adds location and a link back", () => {
    const l = ev({ location: "Piedmont Park" });
    expect(field(l, "LOCATION:")).toBe("Piedmont Park");
    expect(field(l, "URL:")).toBe("https://app.test/?d=2026-11-18");
  });
});

describe("buildCalendar", () => {
  it("wraps events in a VCALENDAR with CRLF endings", () => {
    const ics = buildCalendar([base, { ...base, id: "2" }], { ...opts, timeZone: "America/New_York" });
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics.replace(/\r\n/g, "")).not.toContain("\n");
  });
});

describe("exercises in the feed", () => {
  it("lists a strength workout's exercises", () => {
    const l = workoutEventLines(
      { ...base, type: "strength", title: "Push day", planned: { exercises: [{ name: "Bench press", sets: 3, reps: "8", weightKg: 100 }, { name: "Plank", reps: "60 s" }] } },
      opts,
    );
    expect(l.find((x) => x.startsWith("DESCRIPTION:"))).toContain("Plan:\\n• Bench press 3×8 @ 100 kg\\n• Plank ×60 s");
  });
});
