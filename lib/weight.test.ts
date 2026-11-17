import { describe, expect, it } from "vitest";
import { weightChange, weightSeries } from "./weight";

describe("weight trend", () => {
  const days = [
    { date: "2026-08-01", weightKg: 80 },
    { date: "2026-11-10", weightKg: 78 },
    { date: "2026-11-12", weightKg: 77 },
    { date: "2026-11-14", weightKg: 79 },
    { date: "2026-11-16", weightKg: 76 },
    { date: "2026-11-11" }, // a day log without a weigh-in
  ];

  it("averages weigh-ins from the trailing 7 days", () => {
    const s = weightSeries(days);
    expect(s.map((p) => p.date)).toEqual(["2026-08-01", "2026-11-10", "2026-11-12", "2026-11-14", "2026-11-16"]);
    expect(s[0].avgKg).toBe(80); // nothing else within 7 days
    expect(s[4].avgKg).toBeCloseTo((78 + 77 + 79 + 76) / 4); // Nov 10–16
  });

  it("compares the average now with the average at the start of the window", () => {
    const s = weightSeries(days);
    const ninety = weightChange(s, 90, "2026-11-16")!; // since Aug 18 -> Aug 1's 80
    expect(ninety.fromKg).toBe(80);
    expect(ninety.deltaKg).toBeCloseTo(77.5 - 80);
    expect(weightChange(s, 365, "2026-11-16")).toBeUndefined(); // no weigh-in that far back
  });
});
