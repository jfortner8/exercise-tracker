import { describe, expect, it } from "vitest";
import {
  CONSISTENCY_MIN_DAYS,
  consistencyDays,
  consistencyFrom,
  rankConsistency,
  seasonBest,
  seasonBests,
  seasonBoard,
} from "./leaderboard-views";
import type { ConsistencyRow, LeaderboardEntry, Workout } from "./types";

const fiveK = { metricKind: "time", direction: "lower" } as const;

describe("seasonBests", () => {
  it("keeps each year's best, and a slower result never replaces it", () => {
    const out = seasonBests(fiveK, [
      { value: 1500, date: "2025-06-01" },
      { value: 1450, date: "2025-09-01" },
      { value: 1560, date: "2026-03-01" },
      { value: 1620, date: "2026-10-01" }, // easy day, slower
    ]);
    expect(out["2025"]).toMatchObject({ value: 1450, date: "2025-09-01" });
    expect(out["2026"]).toMatchObject({ value: 1560, date: "2026-03-01", score: 1560 });
  });
});

const entry = (sub: string, over: Partial<LeaderboardEntry> = {}): LeaderboardEntry => ({
  sub,
  catalogKey: "run-5k",
  displayName: sub,
  value: 1450,
  date: "2025-09-01",
  score: 1450,
  history: [
    { date: "2025-06-01", score: 1500 },
    { date: "2025-09-01", score: 1450 },
  ],
  ...over,
});

describe("seasonBest and seasonBoard", () => {
  it("uses stored seasons", () => {
    const e = entry("a", { seasons: { "2026": { value: 1560, date: "2026-03-01", score: 1560 } } });
    expect(seasonBest(e, "2026")?.score).toBe(1560);
    expect(seasonBest(e, "2024")).toBeUndefined();
  });
  it("falls back to PB history on rows from before seasons", () => {
    expect(seasonBest(entry("a"), "2025")).toMatchObject({ value: 1450, date: "2025-09-01" });
    const older = entry("b", { history: [{ date: "2024-05-01", score: 1600 }, { date: "2024-08-01", score: 1580 }, ...entry("b").history] });
    expect(seasonBest(older, "2024")?.score).toBe(1580);
    expect(seasonBest(entry("a"), "2026")).toBeUndefined();
  });
  it("ranks by this season's best and leaves out people without one", () => {
    const fastEver = entry("fast", { seasons: { "2026": { value: 1700, date: "2026-02-01", score: 1700 } } });
    const steady = entry("steady", { value: 1600, score: 1600, seasons: { "2026": { value: 1600, date: "2026-04-01", score: 1600 } } });
    const none = entry("none", { seasons: {} });
    expect(seasonBoard([fastEver, steady, none], "2026", "lower").map((r) => r.e.sub)).toEqual(["steady", "fast"]);
  });
});

const wo = (date: string, status: Workout["status"], type: Workout["type"] = "run"): Workout => ({
  id: `${date}-${type}`,
  date,
  type,
  title: type,
  status,
  createdAt: "",
  updatedAt: "",
});

describe("consistencyDays", () => {
  const today = "2026-11-20";
  const days = consistencyDays(
    [
      wo("2026-11-16", "completed"),
      wo("2026-11-17", "missed"),
      wo("2026-11-18", "planned"), // never logged
      wo("2026-11-22", "planned", "rest"),
      wo("2026-11-23", "planned"),
    ],
    [{ startDate: "2026-11-19", endDate: "2026-11-19", status: "healed" }],
    new Set(["2026-11-15"]),
    "2026-11-14",
    today,
    "2026-11-13",
    "2026-11-24",
  );
  it("scores past days like the weekly summary", () => {
    expect(days["2026-11-13"]).toBeUndefined(); // before the first entry
    expect(days["2026-11-14"]).toEqual({ on: false, done: 0 }); // nothing planned or logged: missed
    expect(days["2026-11-15"]).toEqual({ on: true, done: 0 }); // a benchmark result
    expect(days["2026-11-16"]).toEqual({ on: true, done: 1 });
    expect(days["2026-11-17"]?.on).toBe(false);
    expect(days["2026-11-18"]?.on).toBe(false);
    expect(days["2026-11-19"]).toBeUndefined(); // injured, nothing logged
  });
  it("scores today and later as if each passed with no changes", () => {
    expect(days[today]).toEqual({ on: false, done: 0 });
    expect(days["2026-11-22"]).toEqual({ on: true, done: 0 }); // planned rest
    expect(days["2026-11-23"]?.on).toBe(false); // planned, not logged
  });
});

const row = (sub: string, days: ConsistencyRow["days"], over: Partial<ConsistencyRow> = {}): ConsistencyRow => ({
  sub,
  displayName: sub,
  share: "circle",
  syncedOn: "2026-11-20",
  through: "2026-12-18",
  startDate: "2026-01-01",
  days,
  ...over,
});
const span = (from: string, n: number, on: (i: number) => boolean, done = 1) => {
  const out: ConsistencyRow["days"] = {};
  const d = new Date(`${from}T00:00:00Z`);
  for (let i = 0; i < n; i++) {
    out[d.toISOString().slice(0, 10)] = { on: on(i), done: on(i) ? done : 0 };
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
};

describe("consistencyFrom", () => {
  it("covers the 28 days before today, plus today once it's on track", () => {
    const r = row("a", span("2026-10-22", 29, (i) => i % 2 === 1)); // Oct 22 … Nov 19
    // Oct 22 is outside the window; Oct 23 … Nov 19 are 28 days, 14 on.
    expect(consistencyFrom(r, "2026-11-20")).toMatchObject({ on: 14, of: 28, pct: 50 });
    // Today (Nov 20, index 28) is on, so it counts too.
    expect(consistencyFrom({ ...r, days: { ...r.days, "2026-11-20": { on: true, done: 1 } } }, "2026-11-20").of).toBe(29);
  });
  it("leaves out today while it isn't on track yet", () => {
    const r = row("a", { "2026-11-20": { on: false, done: 0 } });
    expect(consistencyFrom(r, "2026-11-20").of).toBe(0);
  });
  it("counts days past the stored range as off", () => {
    const r = row("a", span("2026-10-01", 10, () => true), { through: "2026-10-10" });
    expect(consistencyFrom(r, "2026-10-15")).toMatchObject({ on: 10, of: 14 }); // Oct 1–10 on, Oct 11–14 off
  });
});

describe("rankConsistency", () => {
  const today = "2026-11-20";
  it("ranks by %, then workouts, and holds back people with too few days", () => {
    const all = row("all", span("2026-10-23", 28, () => true, 1));
    const busy = row("busy", span("2026-10-23", 28, () => true, 2));
    const half = row("half", span("2026-10-23", 28, (i) => i % 2 === 0));
    const fresh = row("fresh", span("2026-11-17", CONSISTENCY_MIN_DAYS - 4, () => true), { startDate: "2026-11-17" });
    const { ranked, tooNew } = rankConsistency([half, all, fresh, busy], today);
    expect(ranked.map((x) => x.r.sub)).toEqual(["busy", "all", "half"]);
    expect(tooNew.map((x) => x.r.sub)).toEqual(["fresh"]);
  });
});
