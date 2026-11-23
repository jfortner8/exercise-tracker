import { describe, expect, it } from "vitest";
import { extraBeyondIntervals, formatPace, plannedTimeSec, quickActual } from "./quick-done";

// 9 × (3 min on, 1 min off) = 36:00
const intervals = { reps: 9, workSec: 180, restSec: 60 };
const plan = { intervals };
const km = { distance: "km", weight: "kg" } as const;

describe("quick Done", () => {
  it("prefills the plan's time from its intervals", () => {
    expect(plannedTimeSec(plan)).toBe(2160);
    expect(plannedTimeSec({ durationSec: 2700 })).toBe(2700);
  });
  it("spots time past the intervals", () => {
    expect(extraBeyondIntervals(plan, 2167)).toBe(7);
    expect(extraBeyondIntervals(plan, 2100)).toBe(0);
    expect(extraBeyondIntervals({ durationSec: 2700 }, 2800)).toBe(0);
  });
  it("adds the extra to the cool-down by default, keeping the intervals", () => {
    expect(quickActual(plan, { timeSec: 2167, distanceM: 5140, extraAs: "cooldown" })).toEqual({
      intervals: { ...intervals, cooldownSec: 7 },
      durationSec: 2167,
      distanceM: 5140,
    });
  });
  it("or to the warm-up, on top of any planned warm-up", () => {
    const withWu = { intervals: { ...intervals, warmupSec: 300 } };
    expect(quickActual(withWu, { timeSec: 2467, extraAs: "warmup" })?.intervals?.warmupSec).toBe(307);
  });
  it("keeps the plan as is when nothing changed", () => {
    expect(quickActual({ durationSec: 2700, description: "Easy" }, { extraAs: "cooldown" })).toEqual({
      durationSec: 2700,
      description: "Easy",
    });
    expect(quickActual(undefined, { extraAs: "cooldown" })).toBeUndefined();
  });
  it("formats pace", () => {
    expect(formatPace(2167, 5140, km)).toBe("7:02 /km");
    expect(formatPace(2167, undefined, km)).toBeUndefined();
    expect(formatPace(4000, 1000, km)).toBe("1:06:40 /km");
  });
});
