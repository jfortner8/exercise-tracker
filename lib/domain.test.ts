import { describe, expect, it } from "vitest";
import {
  displayStatus,
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
    expect(displayStatus({ status: "planned", date: "2026-11-10" }, "2026-11-16")).toBe("needs_review");
    expect(displayStatus({ status: "planned", date: "2026-11-16" }, "2026-11-16")).toBe("planned");
    expect(displayStatus({ status: "completed", date: "2026-11-10" }, "2026-11-16")).toBe("completed");
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
