import { describe, expect, it } from "vitest";
import { bearerToken, parseRange } from "./api-input";

describe("bearerToken", () => {
  it("reads the token from a Bearer header", () => {
    expect(bearerToken("Bearer abc.def-123_x")).toBe("abc.def-123_x");
    expect(bearerToken("bearer abc.def")).toBe("abc.def");
  });
  it("ignores anything else", () => {
    expect(bearerToken(null)).toBeUndefined();
    expect(bearerToken("Basic dXNlcjpwYXNz")).toBeUndefined();
    expect(bearerToken("Bearer")).toBeUndefined();
    expect(bearerToken("Bearer a b")).toBeUndefined();
  });
});

describe("parseRange", () => {
  it("accepts a month grid", () => {
    expect(parseRange("2026-10-26", "2026-12-06")).toEqual({ from: "2026-10-26", to: "2026-12-06" });
    expect(parseRange("2026-11-22", "2026-11-22")).toEqual({ from: "2026-11-22", to: "2026-11-22" });
  });
  it("refuses missing, malformed, backwards or huge ranges", () => {
    expect(parseRange(null, "2026-11-22")).toHaveProperty("error");
    expect(parseRange("2026-11-31", "2026-12-01")).toHaveProperty("error"); // no Nov 31
    expect(parseRange("22/11/2026", "2026-12-01")).toHaveProperty("error");
    expect(parseRange("2026-11-22", "2026-11-21")).toHaveProperty("error");
    expect(parseRange("2026-01-01", "2026-12-31")).toHaveProperty("error");
  });
});

describe("rate limit helpers", () => {
  it("puts times in the same window until it rolls over", async () => {
    const { rateWindow } = await import("./api-input");
    expect(rateWindow(60_000, 60)).toBe(60);
    expect(rateWindow(119_999, 60)).toBe(60);
    expect(rateWindow(120_000, 60)).toBe(120);
  });
  it("takes the first forwarded IP", async () => {
    const { clientIp } = await import("./api-input");
    expect(clientIp("203.0.113.7, 10.0.0.1")).toBe("203.0.113.7");
    expect(clientIp(null)).toBe("unknown");
  });
});
