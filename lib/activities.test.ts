import { describe, expect, it } from "vitest";
import { activityMeta, applyActivity, blockMetrics, recentActivities, workoutCategory } from "./activities";
import { SPORTS, sportCategory, sportTallies } from "./sports";
import type { Units, Workout } from "./types";

const km: Units = { distance: "km", weight: "kg" };
let n = 0;
const w = (p: Partial<Workout> & Pick<Workout, "date" | "type">): Workout => ({
  id: `w${n++}`,
  title: "x",
  status: "completed",
  createdAt: `2026-01-01T00:00:0${n % 10}Z`,
  updatedAt: "",
  ...p,
});

describe("activities", () => {
  it("recents are distinct, newest first, sports as themselves, rest left out", () => {
    const ws = [
      w({ date: "2026-11-10", type: "run" }),
      w({ date: "2026-11-11", type: "sport", sport: "soccer" }),
      w({ date: "2026-11-12", type: "rest" }),
      w({ date: "2026-11-13", type: "run" }),
      w({ date: "2026-11-09", type: "swim" }),
      w({ date: "2026-11-08", type: "yoga" }),
    ];
    expect(recentActivities(ws)).toEqual(["run", "sport:soccer", "swim"]);
  });

  it("choosing a recent sport sets the type and the sport", () => {
    expect(applyActivity("sport:roller-derby")).toEqual({ type: "sport", sport: "roller-derby" });
    expect(applyActivity("row")).toEqual({ type: "row" });
    expect(activityMeta("sport:soccer")).toEqual({ label: "Soccer", emoji: "⚽" });
    expect(activityMeta("run")).toEqual({ label: "Run", emoji: "🏃" });
  });

  it("category lines and block metrics", () => {
    expect(workoutCategory({ type: "sport", sport: "roller-derby", sportSession: "practice" })).toEqual({
      emoji: "🛼",
      label: "Roller derby practice",
    });
    expect(workoutCategory({ type: "sport", sport: "other", sportName: "Padel", sportSession: "game" }).label).toBe("Padel game");
    const run = w({ date: "2026-11-12", type: "run", actual: { durationSec: 5265, distanceM: 11000 } });
    expect(blockMetrics(run, km)).toBe(`1:27'45" · 11.0 km`);
    expect(blockMetrics(w({ date: "2026-11-12", type: "run" }), km)).toBeUndefined(); // nothing entered
    expect(blockMetrics(w({ date: "2026-11-12", type: "sport", actual: { durationSec: 3600 } }), km)).toBeUndefined();
    // Planned workouts show the plan.
    expect(blockMetrics(w({ date: "2026-11-20", type: "row", status: "planned", planned: { distanceM: 2000 } }), km)).toBe("2.00 km");
  });
});

describe("sports", () => {
  it("every sport has sessions; roller derby has bouts", () => {
    expect(SPORTS.every((s) => s.sessions.length >= 2)).toBe(true);
    expect(SPORTS.find((s) => s.key === "roller-derby")!.sessions.map((s) => s.label)).toEqual(["Bout", "Practice"]);
    expect(SPORTS.find((s) => s.key === "american-football")!.label).toBe("American football");
    expect(sportCategory({ sport: "soccer", sportSession: "match" })).toBe("Soccer match");
  });

  it("tallies only completed/partial sessions, per session type", () => {
    const ws = [
      w({ date: "2026-11-01", type: "sport", sport: "soccer", sportSession: "match" }),
      w({ date: "2026-11-03", type: "sport", sport: "soccer", sportSession: "practice", status: "partial" }),
      w({ date: "2026-11-05", type: "sport", sport: "soccer", sportSession: "practice", status: "planned" }), // not done
      w({ date: "2025-06-01", type: "sport", sport: "soccer" }), // unspecified, last year
      w({ date: "2026-10-01", type: "sport", sport: "other", sportName: "Padel" }),
      w({ date: "2026-10-02", type: "run" }),
    ];
    const [soccer, padel] = sportTallies(ws, "2026");
    expect(soccer).toMatchObject({ label: "Soccer", total: 3, thisYear: 2, unspecified: 1, lastDate: "2026-11-03" });
    expect(soccer.sessions).toEqual([
      { label: "Match", plural: "matches", count: 1 },
      { label: "Practice", plural: "practices", count: 1 },
    ]);
    expect(padel).toMatchObject({ label: "Padel", total: 1 });
  });
});
