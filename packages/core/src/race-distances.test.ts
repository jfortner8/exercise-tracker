import { describe, expect, it } from "vitest";
import { raceDistanceFor, raceTallies } from "./race-distances";
import type { Workout } from "./types";

const MILE = 1609.344;
let n = 0;
const w = (type: Workout["type"], meters: number, over: Partial<Workout> = {}): Workout => ({
  id: `w${++n}`,
  date: "2026-05-01",
  type,
  title: "x",
  status: "completed",
  actual: { distanceM: meters },
  createdAt: "",
  updatedAt: "",
  ...over,
});

describe("raceDistanceFor", () => {
  it("counts the longest race distance a workout reaches", () => {
    expect(raceDistanceFor("run", 12000)?.label).toBe("10K");
    expect(raceDistanceFor("run", 18000)?.label).toBe("10 mile");
    expect(raceDistanceFor("run", 15 * MILE)?.label).toBe("Half marathon");
    expect(raceDistanceFor("run", 42195)?.label).toBe("Marathon");
    expect(raceDistanceFor("bike", 165000)?.label).toBe("100 mile");
    expect(raceDistanceFor("swim", 1520)?.label).toBe("1,500 m");
    expect(raceDistanceFor("swim", 1600)?.label).toBe("1 mile"); // within 2% of a mile
    expect(raceDistanceFor("row", 2000)?.label).toBe("2K");
  });
  it("allows 2% short for GPS, but no more", () => {
    expect(raceDistanceFor("run", 4920)?.label).toBe("5K");
    expect(raceDistanceFor("run", 4890)).toBeUndefined();
    expect(raceDistanceFor("run", 41500)?.label).toBe("Marathon");
  });
  it("counts nothing below the shortest race or without a distance", () => {
    expect(raceDistanceFor("run", 3000)).toBeUndefined();
    expect(raceDistanceFor("run", undefined)).toBeUndefined();
    expect(raceDistanceFor("bike", 30000)).toBeUndefined();
  });
});

describe("raceTallies", () => {
  it("counts each workout once, per sport, with this year's share and newest first", () => {
    const t = raceTallies(
      [
        w("run", 5100, { date: "2025-06-01" }),
        w("run", 5000, { date: "2026-03-01" }),
        w("run", 10400, { date: "2026-04-01" }),
        w("swim", 1550),
        w("bike", 100500),
      ],
      "2026",
    );
    expect(t.map((s) => s.sport)).toEqual(["run", "swim", "bike"]);
    const run = t[0].distances;
    expect(run.map((d) => [d.label, d.total, d.thisYear])).toEqual([
      ["5K", 2, 1],
      ["10K", 1, 1],
    ]);
    expect(run[0].workouts.map((x) => x.date)).toEqual(["2026-03-01", "2025-06-01"]);
  });
  it("skips planned, missed and skipped workouts, and other activities", () => {
    expect(
      raceTallies(
        [
          w("run", 10000, { status: "planned", actual: undefined, planned: { distanceM: 10000 } }),
          w("run", 10000, { status: "missed" }),
          w("walk", 10000),
          w("strength", 10000),
        ],
        "2026",
      ),
    ).toEqual([]);
  });
  it("uses the plan's distance for a workout done as planned, and counts partly done ones", () => {
    const t = raceTallies(
      [w("run", 0, { actual: undefined, planned: { distanceM: 21100 } }), w("run", 5000, { status: "partial" })],
      "2026",
    );
    expect(t[0].distances.map((d) => d.label)).toEqual(["5K", "Half marathon"]);
  });
});
