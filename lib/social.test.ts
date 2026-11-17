import { describe, expect, it } from "vitest";
import { boardsFrom, CODE_ALPHABET, CODE_LENGTH, everyoneBoard, formatCode, mapLimit, newCode, nextAdmin, normalizeCode, shareOf } from "./social";
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
  it("are 16 characters from the unambiguous alphabet", () => {
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
    expect(normalizeCode(" abcd-efgh-jkmn-pqrs ")).toBe("ABCDEFGHJKMNPQRS");
    expect(normalizeCode("abcd efgh jkmn pqrs")).toBe("ABCDEFGHJKMNPQRS");
    expect(formatCode("ABCDEFGHJKMNPQRS")).toBe("ABCD-EFGH-JKMN-PQRS");
    expect(formatCode(newCode())).toMatch(/^([A-Z0-9]{4}-){3}[A-Z0-9]{4}$/);
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
  it("group people's rows by benchmark, best first in each direction", () => {
    const row = (sub: string, catalogKey: string, score: number, date = "2026-11-01") => ({ ...entry(sub), catalogKey, score, date });
    const boards = boardsFrom(
      [row("a", "run-5k", 1600), row("b", "run-5k", 1500), row("c", "run-5k", 1500, "2026-10-01"), row("a", "bench", 90), row("b", "bench", 100), row("x", "gone", 1)],
      (k) => (k === "run-5k" ? "lower" : k === "bench" ? "higher" : undefined),
    );
    expect(boards["run-5k"].map((e) => e.sub)).toEqual(["c", "b", "a"]); // tie: earlier PB first
    expect(boards.bench.map((e) => e.sub)).toEqual(["b", "a"]);
    expect(boards.gone).toBeUndefined();
  });
  it("run a bounded number of reads at once, keeping order", async () => {
    let live = 0, peak = 0;
    const out = await mapLimit([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      peak = Math.max(peak, ++live);
      await new Promise((r) => setTimeout(r, 5));
      live--;
      return n * 10;
    });
    expect(out).toEqual([10, 20, 30, 40, 50, 60, 70]);
    expect(peak).toBe(3);
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
