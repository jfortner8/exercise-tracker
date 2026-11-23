import { addDays, format, parseISO } from "date-fns";
import { DONE_STATUSES, injuriesOn, isBetter, resultScore, weekAdherence } from "./domain";
import type {
  BenchmarkDef,
  BenchmarkResult,
  ConsistencyDay,
  ConsistencyRow,
  Injury,
  LeaderboardEntry,
  SeasonBest,
  Workout,
} from "./types";

/*
 * Views of leaderboard rows that don't need the database: each person's best in a season
 * (a calendar year), and how consistently they've stuck to their plan lately.
 */

/** Each year's best result, keyed by year ("2026"). A slower result never replaces a better one. */
export function seasonBests(
  def: Pick<BenchmarkDef, "metricKind" | "direction">,
  results: Pick<BenchmarkResult, "value" | "reps" | "date">[],
): Record<string, SeasonBest> {
  const out: Record<string, SeasonBest> = {};
  for (const r of [...results].sort((a, b) => a.date.localeCompare(b.date))) {
    const year = r.date.slice(0, 4);
    const score = resultScore(def, r);
    const best = out[year];
    if (!best || isBetter(def, score, best.score)) {
      out[year] = { value: r.value, ...(r.reps != null ? { reps: r.reps } : {}), date: r.date, score };
    }
  }
  return out;
}

/**
 * This person's best in `year`. Rows written before seasons were stored fall back to the PBs they
 * set that year (exact when the all-time PB is from that year; otherwise the best PB set in it).
 */
export function seasonBest(e: LeaderboardEntry, year: string): SeasonBest | undefined {
  if (e.seasons) return e.seasons[year];
  if (e.date.startsWith(year)) return { value: e.value, ...(e.reps != null ? { reps: e.reps } : {}), date: e.date, score: e.score };
  // History is oldest first and each entry beats the one before, so the last one in the year is the best.
  const h = [...e.history].reverse().find((x) => x.date.startsWith(year));
  return h ? { value: h.score, date: h.date, score: h.score } : undefined;
}

/** A board's rows ranked by their season best, best first; people with no result that year are left out. */
export function seasonBoard(entries: LeaderboardEntry[], year: string, direction: "lower" | "higher") {
  const sign = direction === "lower" ? 1 : -1;
  return entries
    .map((e) => ({ e, best: seasonBest(e, year) }))
    .filter((r): r is { e: LeaderboardEntry; best: SeasonBest } => !!r.best)
    .sort(
      (a, b) =>
        sign * (a.best.score - b.best.score) ||
        a.best.date.localeCompare(b.best.date) ||
        a.e.displayName.localeCompare(b.e.displayName),
    );
}

// ---------- Consistency ----------

/** Days looked back over. */
export const CONSISTENCY_DAYS = 28;
/** Counted days needed before someone is ranked. */
export const CONSISTENCY_MIN_DAYS = 7;

export interface Consistency {
  /** Days on track, out of the days that count (injured days with nothing logged don't). */
  on: number;
  of: number;
  /** Workouts done (not rest days) in the window. */
  workouts: number;
  pct: number;
}

const shift = (d: string, n: number) => format(addDays(parseISO(d), n), "yyyy-MM-dd");

/**
 * The days stored on a consistency row, from `from` to `through`, scored like the calendar's weekly
 * summary (weekAdherence). Past days are scored as of `today`; today and later as if each had just
 * passed with nothing changed, so a planned rest counts and an unlogged workout doesn't. Days that
 * don't count (before the first entry, or injured with nothing logged) are left out.
 */
export function consistencyDays(
  workouts: Workout[],
  injuries: Pick<Injury, "startDate" | "endDate" | "status">[],
  resultDates: Set<string>,
  startDate: string | null,
  today: string,
  from: string,
  through: string,
): Record<string, ConsistencyDay> {
  const byDay = new Map<string, Workout[]>();
  for (const w of workouts) byDay.set(w.date, [...(byDay.get(w.date) ?? []), w]);
  const days: Record<string, ConsistencyDay> = {};
  for (let d = from; d <= through; d = shift(d, 1)) {
    const asOf = d < today ? today : shift(d, 1);
    const injured = (x: string) => injuriesOn(injuries, x, asOf).length > 0;
    const a = weekAdherence([d], byDay, asOf, startDate, injured, (x) => resultDates.has(x));
    // An injured day only counts if you trained anyway, so it never counts against you.
    if (!a.elapsed || (!a.onTrack && injured(d))) continue;
    const done = (byDay.get(d) ?? []).filter((w) => w.type !== "rest" && DONE_STATUSES.has(w.status)).length;
    days[d] = { on: a.onTrack > 0, done };
  }
  return days;
}

/**
 * Consistency over the 28 days ending yesterday, plus today once it's on track (today isn't over).
 * Days the row has no entry for count as off once they're past the stored range (nothing was
 * logged then, or the row would have been re-synced); days inside it with no entry don't count.
 */
export function consistencyFrom(row: Pick<ConsistencyRow, "days" | "through" | "startDate">, today: string): Consistency {
  let on = 0;
  let of = 0;
  let workouts = 0;
  const count = (d: string, day: ConsistencyDay | undefined) => {
    if (day) {
      of++;
      if (day.on) on++;
      workouts += day.done;
    } else if (d > row.through && row.startDate && d >= row.startDate) {
      of++;
    }
  };
  for (let i = CONSISTENCY_DAYS; i >= 1; i--) {
    const d = shift(today, -i);
    count(d, row.days[d]);
  }
  const t = row.days[today];
  if (t?.on) count(today, t);
  return { on, of, workouts, pct: of ? Math.round((on / of) * 100) : 0 };
}

/**
 * A Consistency board: ranked by % on track, then by workouts done, then by name. People with
 * fewer than CONSISTENCY_MIN_DAYS counted days come after, unranked.
 */
export function rankConsistency<R extends Pick<ConsistencyRow, "sub" | "displayName" | "days" | "through" | "startDate">>(
  rows: R[],
  today: string,
) {
  const all = rows.map((r) => ({ r, c: consistencyFrom(r, today) }));
  const ranked = all
    .filter((x) => x.c.of >= CONSISTENCY_MIN_DAYS)
    .sort((a, b) => b.c.pct - a.c.pct || b.c.workouts - a.c.workouts || a.r.displayName.localeCompare(b.r.displayName));
  const tooNew = all.filter((x) => x.c.of < CONSISTENCY_MIN_DAYS).sort((a, b) => a.r.displayName.localeCompare(b.r.displayName));
  return { ranked, tooNew };
}
