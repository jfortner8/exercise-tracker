import { describe, expect, it } from "vitest";
import { fastestWindow, parseSplits, splitsNeeded } from "./splits";

describe("parseSplits", () => {
  it("reads the ways splits get typed or pasted", () => {
    expect(parseSplits("5:12 5'08, 5:01.5\n512; 1105 1:02:03 4:59\"")).toEqual({
      sec: [312, 308, 301.5, 312, 665, 3723, 299],
    });
    expect(parseSplits("  ")).toEqual({ sec: [] });
  });
  it("names the entry it can't read", () => {
    expect(parseSplits("5:12 abc 5:01")).toEqual({ error: `Can't read "abc". Type splits like 5:12.` });
    expect(parseSplits("5")).toMatchObject({ error: expect.stringContaining(`"5"`) }); // minutes alone are ambiguous
    expect(parseSplits("5:75")).toMatchObject({ error: expect.any(String) });
    expect(parseSplits("575")).toMatchObject({ error: expect.any(String) });
  });
});

describe("splitsNeeded", () => {
  it("matches distances that are whole splits", () => {
    expect(splitsNeeded(5000, "km")).toBe(5);
    expect(splitsNeeded(10000, "km")).toBe(10);
    expect(splitsNeeded(1609.344, "mi")).toBe(1);
  });
  it("refuses distances that aren't", () => {
    expect(splitsNeeded(5000, "mi")).toBeUndefined(); // 3.1 miles
    expect(splitsNeeded(1609.344, "km")).toBeUndefined();
    expect(splitsNeeded(400, "km")).toBeUndefined();
  });
});

describe("fastestWindow", () => {
  // John's 7.79 km: seven whole splits.
  const run = [322, 308, 301, 298, 303, 310, 320];
  it("finds the fastest consecutive stretch", () => {
    expect(fastestWindow(run, 5)).toEqual({ sec: 1520, from: 2, to: 6 });
  });
  it("can end on the last split", () => {
    expect(fastestWindow([330, 320, 300, 300], 2)).toEqual({ sec: 600, from: 3, to: 4 });
  });
  it("keeps the earliest on a tie, even with decimals", () => {
    expect(fastestWindow([300.1, 300.2, 300.1, 300.2], 2)).toEqual({ sec: 600.3, from: 1, to: 2 });
  });
  it("needs enough splits", () => {
    expect(fastestWindow([300, 300, 300, 300], 5)).toBeUndefined();
    expect(fastestWindow(run, 7)).toEqual({ sec: 2162, from: 1, to: 7 });
  });
});
