import { describe, expect, it } from "vitest";
import type { Units, Workout } from "../types";
import { linkableWorkouts, linkWarning, suggestLink } from "./linking";

const km: Units = { distance: "km", weight: "kg" };
const w = (p: Partial<Workout> & Pick<Workout, "id" | "type">): Workout => ({
  date: "2026-11-12",
  title: p.id,
  status: "completed",
  createdAt: "",
  updatedAt: "",
  ...p,
});

describe("benchmark ↔ workout linking", () => {
  const tenK = { catalogKey: "run-10k" };
  const run11 = w({ id: "run11", type: "run", actual: { distanceM: 11000 } });
  const run8 = w({ id: "run8", type: "run", actual: { distanceM: 8000 } });
  const swim = w({ id: "swim", type: "swim", actual: { distanceM: 1500 } });
  const rest = w({ id: "rest", type: "rest" });

  it("offers only workouts of a fitting type, never rest", () => {
    expect(linkableWorkouts(tenK, [run11, swim, rest]).map((x) => x.id)).toEqual(["run11"]);
    expect(linkableWorkouts({ catalogKey: "swim-50-free" }, [run11, swim]).map((x) => x.id)).toEqual(["swim"]);
    expect(linkableWorkouts({ catalogKey: "resting-hr" }, [run11, swim])).toEqual([]); // standalone
    expect(linkableWorkouts({}, [run11, swim, rest]).map((x) => x.id)).toEqual(["run11", "swim"]); // custom
  });

  it("warns (doesn't block) when the workout is shorter than the benchmark", () => {
    expect(linkWarning(tenK, run11, km)).toBeUndefined();
    expect(linkWarning(tenK, run8, km)).toMatch(/8\.00 km, shorter than 10\.0 km/);
    expect(linkWarning(tenK, w({ id: "gps", type: "run", actual: { distanceM: 9960 } }), km)).toBeUndefined(); // watch slop
    expect(linkWarning(tenK, w({ id: "nodist", type: "run" }), km)).toBeUndefined(); // unknown distance
    expect(linkWarning({ catalogKey: "cooper-12" }, w({ id: "short", type: "run", actual: { durationSec: 600 } }), km)).toMatch(
      /shorter than 12'00"/,
    );
  });

  it("pre-selects a fitting, long-enough workout", () => {
    expect(suggestLink(tenK, [run8, run11, swim], km)?.id).toBe("run11");
    expect(suggestLink(tenK, [run8], km)?.id).toBe("run8"); // still offered, with a warning
    expect(suggestLink(tenK, [swim], km)).toBeUndefined();
  });
});
