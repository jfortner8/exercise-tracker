import { describe, expect, it } from "vitest";
import { autoTitle } from "./activities";
import { cleanExercises, describeExercise, findRoutineByName, sameExercises } from "./routines";

const lb = { distance: "mi", weight: "lb" } as const;
const kg = { distance: "km", weight: "kg" } as const;

describe("describeExercise", () => {
  it("shows sets×reps and weight in the user's unit", () => {
    expect(describeExercise({ name: "Bench press", sets: 3, reps: "8", weightKg: 61.235 }, lb)).toBe("Bench press 3×8 @ 135 lb");
    expect(describeExercise({ name: "Squat", sets: 5, reps: "5", weightKg: 100 }, kg)).toBe("Squat 5×5 @ 100 kg");
  });
  it("handles missing parts", () => {
    expect(describeExercise({ name: "Plank", sets: 3, reps: "60 s" }, lb)).toBe("Plank 3×60 s");
    expect(describeExercise({ name: "Pull-ups", reps: "to failure" }, lb)).toBe("Pull-ups ×to failure");
    expect(describeExercise({ name: "Face pulls", sets: 3 }, lb)).toBe("Face pulls 3 sets");
    expect(describeExercise({ name: "Deadlift", weightKg: 100 }, kg)).toBe("Deadlift @ 100 kg");
    expect(describeExercise({ name: "Stretch" }, kg)).toBe("Stretch");
  });
});

describe("cleanExercises", () => {
  it("drops unnamed rows and trims", () => {
    expect(cleanExercises([{ name: "  Row ", reps: " 10 " }, { name: "  ", sets: 3 }, { name: "Curl", sets: 0 }])).toEqual([
      { name: "Row", reps: "10" },
      { name: "Curl" },
    ]);
  });
});

describe("sameExercises", () => {
  it("compares after cleaning", () => {
    expect(sameExercises([{ name: "Row ", sets: 3 }], [{ name: "Row", sets: 3 }, { name: "" }])).toBe(true);
    expect(sameExercises([{ name: "Row", sets: 3 }], [{ name: "Row", sets: 4 }])).toBe(false);
  });
});

describe("findRoutineByName", () => {
  it("ignores case and spaces", () => {
    expect(findRoutineByName([{ id: "1", name: "Push day" }], "  PUSH DAY ")?.id).toBe("1");
    expect(findRoutineByName([{ id: "1", name: "Push day" }], "Pull day")).toBeUndefined();
  });
});

describe("autoTitle with a routine", () => {
  it("uses the routine name for strength", () => {
    expect(autoTitle({ type: "strength", routineName: "push day", planned: { durationSec: 2700 } }, kg)).toBe("Push Day");
    expect(autoTitle({ type: "strength", planned: { durationSec: 2700 } }, kg)).toBe("45 min Strength");
  });
});
