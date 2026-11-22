import { describe, expect, it } from "vitest";
import { calendarHabit, habitLevel, habitOnDay, profileHabits } from "./habits";

describe("habitLevel", () => {
  it("keeps the alcohol scale: one level per drink up to 6+", () => {
    expect([0, 0.5, 1, 1.5, 2, 5, 6, 9].map((n) => habitLevel("alcohol", n))).toEqual([0, 0, 1, 1, 2, 5, 6, 6]);
  });
  it("spreads tobacco out to a pack", () => {
    expect([0, 1, 2, 3, 6, 12, 15, 20, 30].map((n) => habitLevel("tobacco", n))).toEqual([0, 1, 1, 2, 3, 4, 5, 6, 6]);
  });
});

describe("habitOnDay", () => {
  const today = "2026-11-18";
  it("shows logged counts whenever they exist", () => {
    expect(habitOnDay("tobacco", "2026-10-01", today, "2026-11-10", "2026-11-15", { date: "2026-10-01", tobacco: 4 })).toBe(4);
  });
  it("counts unlogged days as 0 from the later of first day and start, through today", () => {
    expect(habitOnDay("alcohol", "2026-11-12", today, "2026-11-10", undefined)).toBe(0);
    expect(habitOnDay("tobacco", "2026-11-12", today, "2026-11-10", "2026-11-15")).toBeNull();
    expect(habitOnDay("tobacco", "2026-11-15", today, "2026-11-10", "2026-11-15")).toBe(0);
  });
  it("is blank before the first day and in the future", () => {
    expect(habitOnDay("alcohol", "2026-11-09", today, "2026-11-10", undefined)).toBeNull();
    expect(habitOnDay("alcohol", "2026-11-19", today, "2026-11-10", undefined)).toBeNull();
    expect(habitOnDay("alcohol", "2026-11-12", today, null, undefined)).toBeNull();
  });
  it("reads each counter from its own field", () => {
    const log = { date: "2026-11-12", drinks: 2, sugaryDrinks: 1 };
    expect(habitOnDay("alcohol", log.date, today, "2026-11-01", undefined, log)).toBe(2);
    expect(habitOnDay("sugary", log.date, today, "2026-11-01", undefined, log)).toBe(1);
    expect(habitOnDay("tobacco", log.date, today, "2026-11-01", undefined, log)).toBe(0);
  });
});

describe("profile habits", () => {
  it("turns an old Track drinks profile into alcohol", () => {
    expect(profileHabits({ trackDrinks: true })).toEqual(["alcohol"]);
    expect(profileHabits({ trackDrinks: false })).toEqual([]);
    expect(profileHabits({ trackDrinks: true, habits: ["tobacco"] })).toEqual(["tobacco"]);
  });
  it("shows the chosen counter, else the first ticked one", () => {
    expect(calendarHabit({ habits: ["alcohol", "tobacco"], habitOnCalendar: "tobacco" })).toBe("tobacco");
    expect(calendarHabit({ habits: ["sugary", "alcohol"], habitOnCalendar: "tobacco" })).toBe("alcohol");
    expect(calendarHabit({ habits: [] })).toBeNull();
  });
});
