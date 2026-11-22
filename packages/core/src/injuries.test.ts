import { describe, expect, it } from "vitest";
import { currentInjuries, showInjuriesTab } from "./injuries";
import { splitPhoneTabs } from "./nav-flags";
import type { Injury } from "./types";

const inj = (o: Partial<Injury>): Injury => ({ id: "1", name: "Ankle", startDate: "2026-11-01", status: "active", ...o });

describe("currentInjuries", () => {
  it("includes active and recovering injuries that cover the date", () => {
    expect(currentInjuries([inj({}), inj({ id: "2", status: "recovering" })], "2026-11-10")).toHaveLength(2);
  });
  it("leaves out healed, not-yet-started and ended injuries", () => {
    expect(currentInjuries([inj({ status: "healed" })], "2026-11-10")).toHaveLength(0);
    expect(currentInjuries([inj({ startDate: "2026-11-15" })], "2026-11-10")).toHaveLength(0);
    expect(currentInjuries([inj({ endDate: "2026-11-05", status: "recovering" })], "2026-11-10")).toHaveLength(0);
  });
});

describe("showInjuriesTab", () => {
  it("shows while something is active or recovering", () => {
    expect(showInjuriesTab([inj({})], "2026-11-18")).toBe(true);
    expect(showInjuriesTab([inj({ status: "recovering" })], "2026-11-18")).toBe(true);
  });
  it("keeps showing for a month after healing, then hides", () => {
    expect(showInjuriesTab([inj({ status: "healed", endDate: "2026-10-25" })], "2026-11-18")).toBe(true);
    expect(showInjuriesTab([inj({ status: "healed", endDate: "2026-10-10" })], "2026-11-18")).toBe(false);
  });
  it("hides with no injuries", () => {
    expect(showInjuriesTab([], "2026-11-18")).toBe(false);
  });
});

describe("splitPhoneTabs", () => {
  const tabs = (...h: string[]) => h.map((href) => ({ href }));
  it("keeps everything when 7 or fewer", () => {
    const t = tabs("/", "/benchmarks", "/leaderboards", "/sports", "/settings");
    expect(splitPhoneTabs(t)).toEqual({ bar: t, more: [], after: [] });
  });
  it("puts the overflow under More and keeps Settings last", () => {
    const r = splitPhoneTabs(tabs("/", "/benchmarks", "/leaderboards", "/sports", "/weight", "/routines", "/injuries", "/settings"));
    expect(r.bar.map((x) => x.href)).toEqual(["/", "/benchmarks", "/leaderboards", "/sports", "/weight"]);
    expect(r.more.map((x) => x.href)).toEqual(["/routines", "/injuries"]);
    expect(r.after.map((x) => x.href)).toEqual(["/settings"]);
  });
});
