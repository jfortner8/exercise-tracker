import { describe, expect, it } from "vitest";
import { activityMeta, applyActivity, blockMetrics, recentActivities, workoutCategory } from "./activities";
import { SPORTS, sportCategory, sportTallies } from "./sports";
import { autoTitle } from "./activities";
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

describe("autoTitle", () => {
  it("names a sport by sport and session, in title case", () => {
    expect(autoTitle({ type: "sport", sport: "roller-derby", sportSession: "bout" })).toBe("Roller Derby Bout");
    expect(autoTitle({ type: "sport", sport: "basketball", sportSession: "practice" })).toBe("Basketball Practice");
    expect(autoTitle({ type: "sport", sport: "american-football", sportSession: "game" })).toBe("American Football Game");
    expect(autoTitle({ type: "sport", sport: "combat", sportSession: "sparring" })).toBe("Boxing / Martial Arts Sparring");
    expect(autoTitle({ type: "sport", sport: "flag-football", sportSession: "game" })).toBe("Flag Football Game");
    expect(autoTitle({ type: "sport", sport: "physical-therapy", sportSession: "appointment" })).toBe("Physical Therapy Appointment");
    expect(autoTitle({ type: "sport", sport: "physical-therapy", sportSession: "home exercises" })).toBe("Physical Therapy Home Exercises");
  });
  it("ignores a stray distance where distance doesn't apply", () => {
    const km = { distance: "km", weight: "kg" } as const;
    expect(autoTitle({ type: "strength", planned: { distanceM: 5000, durationSec: 2700 } }, km)).toBe("45 min Strength");
    expect(autoTitle({ type: "other", planned: { distanceM: 12000 } }, km)).toBe("12 km Other");
  });
  it("uses the sport alone without a session, and a typed name for Other", () => {
    expect(autoTitle({ type: "sport", sport: "tennis" })).toBe("Tennis");
    expect(autoTitle({ type: "sport", sport: "other", sportName: "padel", sportSession: "game" })).toBe("Padel Game");
    expect(autoTitle({ type: "sport", sport: "other", sportName: "MMA", sportSession: "practice" })).toBe("MMA Practice");
    expect(autoTitle({ type: "sport" })).toBe("Sport");
  });
  const km: Units = { distance: "km", weight: "kg" };
  const mi: Units = { distance: "mi", weight: "lb" };
  it("leads with distance, else time", () => {
    expect(autoTitle({ type: "run", planned: { distanceM: 10000, durationSec: 3000 } }, km)).toBe("10 km Run");
    expect(autoTitle({ type: "run", planned: { distanceM: 10000 } }, mi)).toBe("6.2 mi Run");
    expect(autoTitle({ type: "swim", planned: { distanceM: 750 } }, km)).toBe("0.75 km Swim");
    expect(autoTitle({ type: "strength", planned: { durationSec: 2700 } }, km)).toBe("45 min Strength");
    expect(autoTitle({ type: "bike", planned: { durationSec: 5400 } }, km)).toBe("1 h 30 min Bike");
    expect(autoTitle({ type: "yoga", planned: { durationSec: 3600 } }, km)).toBe("1 h Yoga");
    expect(autoTitle({ type: "run" }, km)).toBe("Run");
    expect(autoTitle({ type: "mobility", planned: { durationSec: 900 } }, km)).toBe("15 min Stretch / Mobility");
  });
  it("notes intervals, timed from the interval set when there's no distance", () => {
    expect(autoTitle({ type: "run", planned: { intervals: { reps: 6, workSec: 120, restSec: 60 } } }, km)).toBe("18 min Run Intervals");
    expect(autoTitle({ type: "run", planned: { distanceM: 8000, intervals: { reps: 6, workSec: 120 } } }, km)).toBe("8 km Run Intervals");
  });
  it("uses what was done once logged, the plan before", () => {
    const w = { type: "run" as const, planned: { distanceM: 10000 }, actual: { distanceM: 8000 } };
    expect(autoTitle({ ...w, status: "planned" }, km)).toBe("10 km Run");
    expect(autoTitle({ ...w, status: "completed" }, km)).toBe("8 km Run");
  });
  it("names dances by style and session, like sports", () => {
    expect(autoTitle({ type: "dance", danceStyle: "salsa", danceSession: "class", planned: { durationSec: 3600 } }, km)).toBe("Salsa Class");
    expect(autoTitle({ type: "dance", danceStyle: "bachata", danceSession: "social" }, km)).toBe("Bachata Social");
    expect(autoTitle({ type: "dance", danceStyle: "merengue" }, km)).toBe("Merengue");
    expect(autoTitle({ type: "dance", danceSession: "show" }, km)).toBe("Dance Show");
    expect(autoTitle({ type: "dance", danceStyle: "other", danceStyleName: "reggaeton", danceSession: "practice" }, km)).toBe("Reggaeton Practice");
    expect(autoTitle({ type: "dance", danceStyle: "swing", danceSession: "social" }, km)).toBe("Swing / Lindy Hop Social");
    // Neither chosen: like other activities, by time.
    expect(autoTitle({ type: "dance", planned: { durationSec: 3600 } }, km)).toBe("1 h Dance");
  });
  it("keeps the calendar category line for dances", () => {
    expect(workoutCategory({ type: "dance", danceStyle: "salsa", danceSession: "class" })).toEqual({ emoji: "💃", label: "Salsa class" });
    expect(workoutCategory({ type: "dance" }).label).toBe("Dance");
  });
  it("leaves sports and rest without amounts", () => {
    expect(autoTitle({ type: "sport", sport: "roller-derby", sportSession: "bout", planned: { durationSec: 7200 } }, km)).toBe("Roller Derby Bout");
    expect(autoTitle({ type: "rest" }, km)).toBe("Rest");
  });
});
