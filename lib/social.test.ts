import { describe, expect, it } from "vitest";
import { boardFor, CODE_ALPHABET, CODE_LENGTH, everyoneBoard, formatCode, newCode, nextAdmin, normalizeCode, shareOf } from "./social";
import type { ClubMember, LeaderboardEntry } from "./types";

const entry = (sub: string, share?: LeaderboardEntry["share"]): LeaderboardEntry => ({
  sub,
  catalogKey: "run-5k",
  displayName: sub,
  value: 1500,
  date: "2026-11-01",
  score: 1500,
  history: [],
  ...(share ? { share } : {}),
});

describe("codes", () => {
  it("are 8 characters from the unambiguous alphabet", () => {
    expect(CODE_ALPHABET).toHaveLength(31);
    expect(CODE_ALPHABET).not.toMatch(/[01ILO]/);
    for (let i = 0; i < 200; i++) {
      const c = newCode();
      expect(c).toHaveLength(CODE_LENGTH);
      expect([...c].every((ch) => CODE_ALPHABET.includes(ch))).toBe(true);
    }
  });
  it("are effectively unique", () => {
    expect(new Set(Array.from({ length: 2000 }, newCode)).size).toBe(2000);
  });
  it("normalize what people type and format for display", () => {
    expect(normalizeCode(" abcd-efgh ")).toBe("ABCDEFGH");
    expect(formatCode("ABCDEFGH")).toBe("ABCD-EFGH");
  });
});

describe("share levels", () => {
  it("map the old yes/no flag", () => {
    expect(shareOf({ leaderboard: true })).toBe("everyone");
    expect(shareOf({ leaderboard: false })).toBe("off");
    expect(shareOf({})).toBe("off");
  });
  it("prefer the new setting", () => {
    expect(shareOf({ share: "circle", leaderboard: true })).toBe("circle");
    expect(shareOf({ share: "nonsense", leaderboard: true })).toBe("everyone");
  });
});

describe("boards", () => {
  const all = [entry("a", "everyone"), entry("b", "circle"), entry("c"), entry("d", "everyone")];
  it("keep only the given people, in order", () => {
    expect(boardFor(all, new Set(["d", "b", "x"])).map((e) => e.sub)).toEqual(["b", "d"]);
  });
  it("Everyone shows only people sharing with everyone (old rows count)", () => {
    expect(everyoneBoard(all).map((e) => e.sub)).toEqual(["a", "c", "d"]);
  });
});

describe("admin hand-off", () => {
  const m = (sub: string, joinedAt: string): ClubMember => ({ sub, displayName: sub, joinedAt });
  const members = [m("admin", "2026-01-01"), m("late", "2026-03-01"), m("early", "2026-02-01")];
  it("goes to the member who joined first", () => {
    expect(nextAdmin(members, "admin")).toBe("early");
  });
  it("is null when nobody is left", () => {
    expect(nextAdmin([m("admin", "2026-01-01")], "admin")).toBeNull();
  });
});
