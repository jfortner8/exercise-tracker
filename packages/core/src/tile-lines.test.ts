import { describe, expect, it } from "vitest";
import { tileLines } from "./activities";
import type { Workout } from "./types";

const mi = { distance: "mi", weight: "lb" } as const;
const w = (x: Partial<Workout>) => ({ id: "w", date: "2026-11-25", type: "run", title: "", status: "planned", createdAt: "", updatedAt: "", ...x }) as Workout;

describe("tileLines", () => {
  it("shows distance and time, from the plan until done", () => {
    expect(tileLines(w({ planned: { distanceM: 1609.344 * 8, durationSec: 4500 } }), mi)).toEqual(["8 mi", "1h15"]);
    expect(tileLines(w({ status: "completed", planned: { distanceM: 8000 }, actual: { durationSec: 2700 } }), mi)).toEqual(["45m"]);
  });
  it("shows just time for strength, the session for sports", () => {
    expect(tileLines(w({ type: "strength", planned: { durationSec: 3600 } }), mi)).toEqual(["1h"]);
    expect(tileLines(w({ type: "sport", sport: "soccer", sportSession: "practice" }), mi)).toEqual(["Practice"]);
    expect(tileLines(w({ type: "sport", sport: "soccer" }), mi)).toEqual([]);
  });
});
