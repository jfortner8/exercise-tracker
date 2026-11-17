import { describe, expect, it } from "vitest";
import type { MetricKind, Units } from "../types";
import { parseValue, valueToInput } from "./input";
import { betterLabel, METRIC_LABEL } from "./catalog";

describe("benchmark value input", () => {
  const cases: [MetricKind, number][] = [
    ["time", 3130], // 52:10
    ["duration", 95.5],
    ["distance", 2850],
    ["weight_reps", 100],
    ["reps", 12],
    ["number", 48],
  ];
  for (const units of [
    { distance: "km", weight: "kg" },
    { distance: "mi", weight: "lb" },
  ] as Units[]) {
    it(`round-trips every kind (${units.distance}/${units.weight})`, () => {
      for (const [metricKind, value] of cases) {
        const back = parseValue({ metricKind }, valueToInput({ metricKind }, value, units), units);
        expect(back).toBeCloseTo(value, 0);
      }
    });
  }
  it("pre-fills a 10K time the way it's typed", () => {
    expect(valueToInput({ metricKind: "time" }, 3130, { distance: "km", weight: "kg" })).toBe("52:10");
  });
});

describe("benchmark wording", () => {
  it("says which way is better once, in plain words", () => {
    expect(METRIC_LABEL.time).toBe("Time");
    expect(betterLabel("time", "lower")).toBe("Faster is better");
    expect(betterLabel("weight_reps", "higher")).toBe("Heavier is better");
    expect(betterLabel("distance", "higher")).toBe("Farther is better");
  });
});
