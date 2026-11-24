import { describe, expect, it } from "vitest";
import { formStatuses } from "./workout-types";

describe("formStatuses", () => {
  it("offers only Planned and Completed", () => {
    expect(formStatuses("planned")).toEqual(["planned", "completed"]);
    expect(formStatuses("completed")).toEqual(["planned", "completed"]);
  });
  it("keeps an older status as a third choice", () => {
    expect(formStatuses("partial")).toEqual(["planned", "completed", "partial"]);
    expect(formStatuses("skipped")).toEqual(["planned", "completed", "skipped"]);
  });
});
