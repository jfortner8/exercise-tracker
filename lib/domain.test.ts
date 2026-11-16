import { describe, expect, it } from "vitest";
import type { Workout } from "./types";
import {
  displayStatus,
  isMissedDay,
  weekAdherence,
  epley1RM,
  formatClock,
  formatDuration,
  intervalTotalSec,
  monthGridRange,
  parseClock,
  personalBest,
  ymd,
} from "./domain";

describe("intervals", () => {
  it("matches the spreadsheet's hand-computed totals", () => {
    // "Seventeen 126/30 intervals (44'12" total)"
    expect(formatDuration(intervalTotalSec({ reps: 17, workSec: 126, restSec: 30 })!)).toBe(`44'12"`);
    // "5min WU, six 126/60 intervals, 5min CD" -> 18'36" of intervals + 10'
    expect(
      intervalTotalSec({ reps: 6, workSec: 126, restSec: 60, warmupSec: 300, cooldownSec: 300 }),
    ).toBe(300 + 1116 + 300);
  });
  it("returns undefined when empty", () => {
    expect(intervalTotalSec({})).toBeUndefined();
    expect(intervalTotalSec(undefined)).toBeUndefined();
  });
});

describe("clock parsing", () => {
  it("parses common formats", () => {
    expect(parseClock("25:31")).toBe(1531);
    expect(parseClock("1:02:05")).toBe(3725);
    expect(parseClock("42.5")).toBe(42.5);
    expect(parseClock(`44'12"`)).toBe(2652);
    expect(parseClock("abc")).toBeNaN();
    expect(parseClock("")).toBeNaN();
  });
  it("round trips", () => {
    expect(formatClock(1531)).toBe("25:31");
    expect(formatClock(3725)).toBe("1:02:05");
    expect(formatClock(42.5)).toBe("0:42.5");
  });
});

describe("personal bests", () => {
  it("lower is better for times", () => {
    const pb = personalBest({ metricKind: "time", direction: "lower" }, [
      { value: 1600 },
      { value: 1531 },
      { value: 1700 },
    ]);
    expect(pb?.value).toBe(1531);
  });
  it("higher is better for reps", () => {
    const pb = personalBest({ metricKind: "reps", direction: "higher" }, [{ value: 8 }, { value: 12 }]);
    expect(pb?.value).toBe(12);
  });
  it("weight×reps uses Epley e1RM", () => {
    expect(epley1RM(100, 1)).toBe(100);
    expect(epley1RM(100, 10)).toBeCloseTo(133.33, 1);
    const pb = personalBest({ metricKind: "weight_reps", direction: "higher" }, [
      { value: 110, reps: 1 }, // 110
      { value: 100, reps: 8 }, // 126.7
    ]);
    expect(pb?.reps).toBe(8);
  });
});

describe("status", () => {
  it("flags past planned workouts as needs review", () => {
    expect(displayStatus({ type: "run", status: "planned", date: "2026-11-10" }, "2026-11-16")).toBe("needs_review");
    expect(displayStatus({ type: "run", status: "planned", date: "2026-11-16" }, "2026-11-16")).toBe("planned");
    expect(displayStatus({ type: "run", status: "completed", date: "2026-11-10" }, "2026-11-16")).toBe("completed");
  });
});

describe("month grid", () => {
  it("starts on Monday and covers whole weeks", () => {
    const { start, end } = monthGridRange(new Date(2026, 10, 1), 1); // Nov 2026
    expect(ymd(start)).toBe("2026-10-26");
    expect(ymd(end)).toBe("2026-12-06");
  });
  it("supports Sunday start", () => {
    const { start } = monthGridRange(new Date(2026, 10, 1), 0);
    expect(ymd(start)).toBe("2026-11-01");
  });
});

describe("units", () => {
  it("migrates the old single setting and allows mixed units", async () => {
    const { normalizeUnits, formatDistance, kgToDisplay } = await import("./domain");
    expect(normalizeUnits("imperial")).toEqual({ distance: "mi", weight: "lb" });
    expect(normalizeUnits("metric")).toEqual({ distance: "km", weight: "kg" });
    const mixed = normalizeUnits({ distance: "km", weight: "lb" });
    expect(formatDistance(5000, mixed)).toBe("5.00 km");
    expect(Math.round(kgToDisplay(100, mixed))).toBe(220);
  });
});

describe("intentional days", () => {
  const w = (p: Partial<Workout> & Pick<Workout, "date">): Workout => ({
    id: Math.random().toString(36),
    type: "run",
    title: "Run",
    status: "planned",
    createdAt: "",
    updatedAt: "",
    ...p,
  });

  it("counts a planned rest day as done once its day arrives", () => {
    expect(displayStatus({ status: "planned", type: "rest", date: "2026-11-10" }, "2026-11-16")).toBe("completed");
    expect(displayStatus({ status: "planned", type: "rest", date: "2026-11-16" }, "2026-11-16")).toBe("completed");
    expect(displayStatus({ status: "planned", type: "rest", date: "2026-11-17" }, "2026-11-16")).toBe("planned");
    expect(displayStatus({ status: "planned", type: "run", date: "2026-11-10" }, "2026-11-16")).toBe("needs_review");
  });

  it("only treats empty past days after the start date, outside injuries, as missed", () => {
    const today = "2026-11-16";
    expect(isMissedDay("2026-11-12", today, "2026-11-10", [], false)).toBe(true);
    expect(isMissedDay("2026-11-09", today, "2026-11-10", [], false)).toBe(false); // before start
    expect(isMissedDay("2026-11-12", today, "2026-11-10", [], true)).toBe(false); // injured
    expect(isMissedDay("2026-11-16", today, "2026-11-10", [], false)).toBe(false); // today
    expect(isMissedDay("2026-11-18", today, "2026-11-10", [], false)).toBe(false); // future
    expect(isMissedDay("2026-11-12", today, null, [], false)).toBe(false); // no entries yet
    expect(isMissedDay("2026-11-12", today, "2026-11-10", [{}], false)).toBe(false); // has a workout
  });

  it("summarizes a week against the plan", () => {
    const today = "2026-11-15";
    const ws = [
      w({ date: "2026-11-09", status: "completed" }),
      w({ date: "2026-11-10", status: "planned", type: "rest" }),
      w({ date: "2026-11-11", status: "completed", originalDate: "2026-11-10" }),
      w({ date: "2026-11-12", status: "substituted" }),
      w({ date: "2026-11-12", status: "skipped" }),
      w({ date: "2026-11-13", status: "missed" }),
      w({ date: "2026-11-14", status: "planned" }), // needs review: not on track, not counted
      // 15th: empty and today -> not missed yet, and not counted until it's on track
    ];
    const byDay = new Map<string, Workout[]>();
    for (const x of ws) byDay.set(x.date, [...(byDay.get(x.date) ?? []), x]);
    const days = ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15"];
    expect(weekAdherence(days, byDay, today, "2026-11-09", () => false)).toEqual({
      onTrack: 4,
      elapsed: 6,
      asPlanned: 1,
      rest: 1,
      moved: 1,
      substituted: 1,
      skipped: 1,
      missed: 1,
    });
  });
});
