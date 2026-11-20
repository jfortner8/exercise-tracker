import { describe, expect, it } from "vitest";
import { startTimeIn, startTimeLabel, zoneDiffers } from "./start-time";

const ny = { date: "2026-11-18", startTime: "08:00", startZone: "America/New_York" };

describe("start times keep their zone", () => {
  it("shows plainly where it was entered, or in a zone with the same offset", () => {
    expect(startTimeLabel(ny, "America/New_York")).toBe("8:00 AM");
    expect(startTimeLabel(ny, "America/Detroit")).toBe("8:00 AM");
    expect(zoneDiffers(ny, "America/Detroit")).toBe(false);
  });
  it("8am Eastern is 7am after the drive to Alabama", () => {
    expect(startTimeIn(ny, "America/Chicago")).toBe("07:00");
    expect(startTimeLabel(ny, "America/Chicago")).toBe("7:00 AM (8:00 AM EST)");
    expect(startTimeLabel(ny, "America/Chicago", "24h")).toBe("07:00 (08:00 EST)");
  });
  it("names the summer zone in summer", () => {
    expect(startTimeLabel({ ...ny, date: "2026-07-01" }, "America/Chicago")).toBe("7:00 AM (8:00 AM EDT)");
  });
  it("shows only the original when it lands on another day where you are", () => {
    const late = { ...ny, startTime: "20:00" };
    expect(startTimeIn(late, "Asia/Tokyo")).toBeUndefined(); // 10am on the 19th there
    expect(startTimeLabel(late, "Asia/Tokyo")).toBe("8:00 PM EST");
  });
  it("leaves older workouts without a zone, and untimed ones, alone", () => {
    expect(startTimeLabel({ date: "2026-11-18", startTime: "08:00" }, "Asia/Tokyo")).toBe("8:00 AM");
    expect(startTimeLabel({ date: "2026-11-18" }, "Asia/Tokyo")).toBeUndefined();
    expect(startTimeLabel(ny, undefined)).toBe("8:00 AM");
  });
});
