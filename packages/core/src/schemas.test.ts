import { describe, expect, it } from "vitest";
import { dayPatchInput, profileInput, resolveInput, signUpInput, workoutInput } from "./schemas";

describe("shared input schemas", () => {
  it("accepts a normal workout and rejects a bad date or type", () => {
    const ok = { date: "2026-11-22", type: "run", title: "Easy run", status: "planned", startTime: "06:30", startZone: "America/New_York" };
    expect(workoutInput.safeParse(ok).success).toBe(true);
    expect(workoutInput.safeParse({ ...ok, date: "22/11/2026" }).success).toBe(false);
    expect(workoutInput.safeParse({ ...ok, type: "teleport" }).success).toBe(false);
    expect(workoutInput.safeParse({ ...ok, startTime: "25:00" }).success).toBe(false);
  });
  it("needs a reason only for a skip", () => {
    expect(resolveInput.safeParse({ status: "completed" }).success).toBe(true);
    expect(resolveInput.safeParse({ status: "skipped" }).success).toBe(false);
    expect(resolveInput.safeParse({ status: "skipped", reason: "Sick" }).success).toBe(true);
  });
  it("lets a day patch clear a field with null", () => {
    expect(dayPatchInput.parse({ weightKg: null })).toEqual({ weightKg: null });
    expect(dayPatchInput.safeParse({ weightKg: -1 }).success).toBe(false);
  });
  it("keeps the website's messages", () => {
    const r = signUpInput.safeParse({ name: "", email: "a@b.co", password: "short" });
    expect(!r.success && r.error.issues[0].message).toBe("Use at least 10 characters.");
    expect(profileInput.safeParse({}).success).toBe(false);
  });
});
