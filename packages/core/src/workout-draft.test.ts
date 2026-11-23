import { describe, expect, it } from "vitest";
import type { Units } from "./types";
import { badHeartRate, fromDraft, fromExerciseDrafts, statusForDay, toDraft, unreadableDurations } from "./workout-draft";

const mi: Units = { distance: "mi", weight: "lb" };
const km: Units = { distance: "km", weight: "kg" };

describe("workout drafts", () => {
  it("round-trips details through the form in the user's units", () => {
    const details = { durationSec: 5265, distanceM: 16093, avgHeartRate: 142, description: "Hilly" };
    const back = fromDraft(toDraft(details, mi), mi);
    expect(back?.durationSec).toBe(5265);
    expect(back?.distanceM).toBe(16093);
    expect(back?.avgHeartRate).toBe(142);
    expect(back?.description).toBe("Hilly");
  });

  it("reads durations as minutes or clock times", () => {
    expect(fromDraft({ ...toDraft(undefined, km), durationMin: "87:45" }, km)?.durationSec).toBe(5265);
    expect(fromDraft({ ...toDraft(undefined, km), durationMin: "45" }, km)?.durationSec).toBe(2700);
    expect(unreadableDurations({ ...toDraft(undefined, km), durationMin: "ages" })).toEqual(["Duration"]);
  });

  it("an empty form is no details at all", () => {
    expect(fromDraft(toDraft(undefined, km), km)).toBeUndefined();
  });

  it("keeps intervals only when some are filled in", () => {
    const d = fromDraft({ ...toDraft(undefined, km), reps: "6", workSec: "90" }, km);
    expect(d?.intervals).toMatchObject({ reps: 6, workSec: 90 });
  });

  it("stores exercise weights in kg, so pounds read back the same", () => {
    const [e] = fromExerciseDrafts([{ name: " Squat ", sets: "5", reps: "5", weight: "135" }], mi);
    expect(e.name).toBe("Squat");
    expect(Math.round(e.weightKg! / 0.45359237)).toBe(135);
    expect(fromExerciseDrafts([{ name: " ", sets: "3", reps: "", weight: "" }], mi)).toEqual([]);
  });

  it("checks heart rate is plausible", () => {
    expect(badHeartRate({ ...toDraft(undefined, km), hr: "300" })).toBe(true);
    expect(badHeartRate({ ...toDraft(undefined, km), hr: "142" })).toBe(false);
    expect(badHeartRate({ ...toDraft(undefined, km), hr: "" })).toBe(false);
  });

  it("a new workout in the past starts as done", () => {
    expect(statusForDay("2026-11-20", "2026-11-23")).toBe("completed");
    expect(statusForDay("2026-11-23", "2026-11-23")).toBe("planned");
  });
});
