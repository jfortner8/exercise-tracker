import { describe, expect, it } from "vitest";
import { calendarGoal, cleanGoals, GOAL_PRESETS, goalOnDay, MAX_GOALS, weekGoalTally, type Goal } from "./goals";

const stretch: Goal = { id: "stretch", name: "Stretched", emoji: "🧘", start: "2026-11-15" };
const protein: Goal = { id: "p1", name: "Protein 150g", start: "2026-11-01" };
const today = "2026-11-19";

describe("goalOnDay", () => {
  it("is true on checked days, even before the start", () => {
    expect(goalOnDay(stretch, "2026-11-10", today, "2026-11-01", { date: "2026-11-10", goalsDone: ["stretch"] })).toBe(true);
  });
  it("is false on unchecked days from the start through today", () => {
    expect(goalOnDay(stretch, "2026-11-15", today, "2026-11-01")).toBe(false);
    expect(goalOnDay(stretch, today, today, "2026-11-01", { date: today, goalsDone: ["other"] })).toBe(false);
  });
  it("is blank before the start, before the first day and in the future", () => {
    expect(goalOnDay(stretch, "2026-11-14", today, "2026-11-01")).toBeNull();
    expect(goalOnDay(protein, "2026-11-05", today, "2026-11-10")).toBeNull();
    expect(goalOnDay(protein, "2026-11-20", today, "2026-11-01")).toBeNull();
    expect(goalOnDay(protein, "2026-11-12", today, null)).toBeNull();
  });
});

describe("calendarGoal", () => {
  it("uses the chosen goal, else the first, else none", () => {
    expect(calendarGoal({ goals: [stretch, protein], goalOnCalendar: "p1" })).toBe(protein);
    expect(calendarGoal({ goals: [stretch, protein], goalOnCalendar: "gone" })).toBe(stretch);
    expect(calendarGoal({})).toBeNull();
  });
});

describe("weekGoalTally", () => {
  it("counts done days out of the countable ones", () => {
    const week = ["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22"];
    const logs: Record<string, { date: string; goalsDone: string[] }> = {
      "2026-11-16": { date: "2026-11-16", goalsDone: ["stretch"] },
      "2026-11-18": { date: "2026-11-18", goalsDone: ["stretch"] },
    };
    expect(weekGoalTally(stretch, week, today, "2026-11-01", (d) => logs[d])).toEqual({ done: 2, of: 4 });
  });
});

describe("cleanGoals", () => {
  it("trims, drops blanks and duplicates, and caps the list", () => {
    const out = cleanGoals(
      [{ id: "a", name: "  Walk  " }, { id: "b", name: "walk" }, { id: "c", name: " " }, ...Array.from({ length: 10 }, (_, i) => ({ id: `x${i}`, name: `G${i}` }))],
      [],
      today,
    );
    expect(out[0]).toEqual({ id: "a", name: "Walk", start: today });
    expect(out.map((g) => g.id)).not.toContain("b");
    expect(out).toHaveLength(MAX_GOALS);
  });
  it("keeps existing starts and dates new goals today", () => {
    const out = cleanGoals([stretch, { id: "new", name: "New" }], [stretch], today);
    expect(out.map((g) => g.start)).toEqual(["2026-11-15", today]);
  });
  it("re-adding a preset reuses its id, so old check-offs show again", () => {
    const preset = GOAL_PRESETS.find((p) => p.id === "stretch")!;
    const [g] = cleanGoals([preset], [], today);
    expect(g.id).toBe("stretch");
    expect(goalOnDay(g, "2026-11-10", today, "2026-11-01", { date: "2026-11-10", goalsDone: ["stretch"] })).toBe(true);
  });
});
