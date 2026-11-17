import { addDays, endOfMonth, endOfWeek, format, parseISO, startOfMonth, startOfWeek } from "date-fns";
import type {
  BenchmarkDef,
  BenchmarkResult,
  DayResult,
  Intervals,
  MetricKind,
  Units,
  Workout,
  WorkoutDetails,
} from "./types";

// ---------- Dates ----------
export const ymd = (d: Date) => format(d, "yyyy-MM-dd");

/** Days shown in a month grid: full weeks covering the month. */
export function monthGridRange(month: Date, weekStartsOn: 0 | 1) {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn });
  const end = endOfWeek(endOfMonth(month), { weekStartsOn });
  return { start, end };
}

export function weekRange(day: Date, weekStartsOn: 0 | 1) {
  const start = startOfWeek(day, { weekStartsOn });
  return { start, end: addDays(start, 6) };
}

export function eachDay(start: Date, end: Date): string[] {
  const out: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(ymd(d));
  return out;
}

export function chunkWeeks<T>(days: T[]): T[][] {
  const weeks: T[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks;
}

export const parseDay = (s: string) => parseISO(s);

// ---------- Time formatting ----------
/** 2652 -> 44'12"  ·  3725 -> 1:02'05" */
export function formatDuration(sec: number): string {
  const s = Math.round(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const mm = h ? String(m).padStart(2, "0") : String(m);
  return `${h ? `${h}:` : ""}${mm}'${String(r).padStart(2, "0")}"`;
}

/** Clock style for benchmark times: 25:31, 1:02:05, 0:42.5 */
export function formatClock(sec: number): string {
  const neg = sec < 0;
  const abs = Math.abs(sec);
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const sRaw = abs % 60;
  const sStr = Number.isInteger(sRaw) ? String(sRaw).padStart(2, "0") : sRaw.toFixed(1).padStart(4, "0");
  const body = h ? `${h}:${String(m).padStart(2, "0")}:${sStr}` : `${m}:${sStr}`;
  return neg ? `-${body}` : body;
}

/** Accepts "45", "45:30", "1:02:05", "0:42.5", "44'12\"" -> seconds. Returns NaN if invalid. */
export function parseClock(input: string): number {
  const t = input.trim().replace(/["”]/g, "").replace(/['’]/g, ":");
  if (!t) return NaN;
  const parts = t.split(":").filter((p, i, a) => p !== "" || i < a.length - 1);
  if (parts.length > 3 || parts.some((p) => !/^\d+(\.\d+)?$/.test(p))) return NaN;
  return parts.reduce((acc, p) => acc * 60 + Number(p), 0);
}

/**
 * A duration typed into a minutes field. Plain numbers are minutes ("45", "87.5");
 * clock style is minutes:seconds or hours:minutes:seconds ("87:45", "1:27:45", 44'12").
 * Returns seconds, undefined when empty, or NaN when it can't be read.
 */
export function parseMinutesInput(input: string): number | undefined {
  const t = input.trim().replace(/["”]/g, "").replace(/['’]/g, ":").replace(/:$/, "");
  if (!t) return undefined;
  if (/^\d+(\.\d+)?$/.test(t)) return Math.round(Number(t) * 60);
  const parts = t.split(":");
  if (parts.length > 3 || parts.some((p) => !/^\d+(\.\d+)?$/.test(p))) return NaN;
  if (parts.slice(1).some((p) => Number(p) >= 60)) return NaN; // seconds/minutes after the first part must be < 60
  return Math.round(parts.reduce((acc, p) => acc * 60 + Number(p), 0));
}

/** Seconds back into a minutes field: whole minutes as "45", otherwise "87:45". */
export function formatMinutesInput(sec?: number): string {
  if (!sec) return "";
  const s = Math.round(sec);
  return s % 60 === 0 ? String(s / 60) : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Plain-language duration for previews: 5265 -> "1 h 27 min 45 s". */
export function describeDuration(sec: number): string {
  const s = Math.round(sec);
  const [h, m, r] = [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60];
  const out = [h && `${h} h`, m && `${m} min`, r && `${r} s`].filter(Boolean).join(" ");
  return out || "0 min";
}

// ---------- Intervals ----------
export function intervalTotalSec(iv?: Intervals): number | undefined {
  if (!iv) return undefined;
  const { workSec = 0, restSec = 0, reps = 0, warmupSec = 0, cooldownSec = 0 } = iv;
  const total = warmupSec + reps * (workSec + restSec) + cooldownSec;
  return total > 0 ? total : undefined;
}

/** Effective duration of a details block (explicit duration wins, otherwise interval math). */
export function detailsDurationSec(d?: WorkoutDetails): number | undefined {
  if (!d) return undefined;
  return d.durationSec ?? intervalTotalSec(d.intervals);
}

export function describeIntervals(iv?: Intervals): string | undefined {
  if (!iv?.reps || !iv.workSec) return undefined;
  const core = `${iv.reps}× ${iv.workSec}/${iv.restSec ?? 0}`;
  // Whole minutes read as 5′; anything else keeps its seconds (7'45") instead of rounding.
  const span = (sec: number) => (sec % 60 === 0 ? `${sec / 60}′` : formatDuration(sec));
  const wu = iv.warmupSec ? `${span(iv.warmupSec)} WU + ` : "";
  const cd = iv.cooldownSec ? ` + ${span(iv.cooldownSec)} CD` : "";
  return `${wu}${core}${cd}`;
}

// ---------- Units ----------
export const KM = 1000;
export const MILE = 1609.344;
export const LB = 0.45359237;

/** Accepts the current {distance, weight} shape or the old "imperial"/"metric" string. */
export function normalizeUnits(raw: unknown): Units {
  if (raw === "metric") return { distance: "km", weight: "kg" };
  if (raw === "imperial") return { distance: "mi", weight: "lb" };
  const r = (raw ?? {}) as Partial<Units>;
  return { distance: r.distance === "km" ? "km" : "mi", weight: r.weight === "kg" ? "kg" : "lb" };
}

export function distanceUnit(units: Units) {
  return units.distance;
}
export function metersToDisplay(m: number, units: Units) {
  return m / (units.distance === "mi" ? MILE : KM);
}
export function displayToMeters(v: number, units: Units) {
  return v * (units.distance === "mi" ? MILE : KM);
}
export function weightUnit(units: Units) {
  return units.weight;
}
export function kgToDisplay(kg: number, units: Units) {
  return units.weight === "lb" ? kg / LB : kg;
}
export function displayToKg(v: number, units: Units) {
  return units.weight === "lb" ? v * LB : v;
}
export function formatDistance(m: number, units: Units) {
  const v = metersToDisplay(m, units);
  return `${v >= 10 ? v.toFixed(1) : v.toFixed(2)} ${distanceUnit(units)}`;
}

// ---------- Status ----------
export type DisplayStatus = Workout["status"] | "needs_review";

/**
 * A planned workout whose day has passed but was never logged needs review.
 * A planned rest day counts as done as soon as its day arrives: resting is the plan.
 */
export function displayStatus(w: Pick<Workout, "status" | "date" | "type">, today: string): DisplayStatus {
  if (w.status === "planned" && w.type === "rest" && today && w.date <= today) return "completed";
  if (w.status === "planned" && w.date < today) return "needs_review";
  return w.status;
}

export const DONE_STATUSES = new Set(["completed", "partial", "substituted"]);

/** Green: the user did what they meant to (a workout or an intentional rest). */
export const isOnTrack = (w: Pick<Workout, "status" | "date" | "type">, today: string) =>
  DONE_STATUSES.has(displayStatus(w, today));

/**
 * A day is missed when it has passed with nothing planned or logged, on or after the
 * user's first entry, and it isn't covered by an injury. (Today isn't over yet.)
 */
export function isMissedDay(
  date: string,
  today: string,
  startDate: string | null,
  workouts: readonly unknown[],
  injured: boolean,
) {
  return !!today && !!startDate && date < today && date >= startDate && workouts.length === 0 && !injured;
}

export interface Adherence {
  onTrack: number;
  elapsed: number;
  asPlanned: number;
  rest: number;
  moved: number;
  substituted: number;
  skipped: number;
  missed: number;
}

/**
 * How a set of days went against the plan, counting days on/after the start date up to today.
 * Today only counts once it's on track, since it isn't over yet.
 */
export function weekAdherence(
  days: string[],
  byDay: Map<string, Workout[]>,
  today: string,
  startDate: string | null,
  isInjured: (d: string) => boolean,
  /** Days with a benchmark result count as trained, even without a workout. */
  hasResult: (d: string) => boolean = () => false,
): Adherence {
  const a: Adherence = { onTrack: 0, elapsed: 0, asPlanned: 0, rest: 0, moved: 0, substituted: 0, skipped: 0, missed: 0 };
  if (!today || !startDate) return a;
  for (const d of days) {
    if (d > today || d < startDate) continue;
    const ws = byDay.get(d) ?? [];
    const trained = hasResult(d);
    const onTrack = trained || ws.some((w) => isOnTrack(w, today));
    if (d === today && !onTrack) continue;
    a.elapsed++;
    if (onTrack) a.onTrack++;
    if (!trained && isMissedDay(d, today, startDate, ws, isInjured(d))) a.missed++;
    for (const w of ws) {
      const st = displayStatus(w, today);
      if (st === "missed") a.missed++;
      else if (st === "skipped") a.skipped++;
      else if (st === "substituted") a.substituted++;
      else if (st === "completed" || st === "partial") {
        if (w.type === "rest") a.rest++;
        else if (w.originalDate) a.moved++;
        else a.asPlanned++;
      }
    }
  }
  return a;
}

// ---------- Benchmarks ----------
/** Epley estimated one-rep max. */
export function epley1RM(weight: number, reps: number): number {
  if (reps <= 1) return weight;
  return weight * (1 + reps / 30);
}

export function resultScore(def: Pick<BenchmarkDef, "metricKind">, r: Pick<BenchmarkResult, "value" | "reps">) {
  return def.metricKind === "weight_reps" ? epley1RM(r.value, r.reps ?? 1) : r.value;
}

export function isBetter(def: Pick<BenchmarkDef, "direction">, a: number, b: number) {
  return def.direction === "lower" ? a < b : a > b;
}

export function personalBest<R extends Pick<BenchmarkResult, "value" | "reps">>(
  def: Pick<BenchmarkDef, "metricKind" | "direction">,
  results: R[],
): R | undefined {
  let best: R | undefined;
  for (const r of results) {
    if (!best || isBetter(def, resultScore(def, r), resultScore(def, best))) best = r;
  }
  return best;
}

/**
 * Benchmark results dated within [start, end], each flagged if it set a new PB at the time.
 * Needs every result (not just the range) so earlier history decides what counts as a PB.
 */
export function calendarResults(
  benchmarks: BenchmarkDef[],
  results: BenchmarkResult[],
  start: string,
  end: string,
): DayResult[] {
  const out: DayResult[] = [];
  for (const b of benchmarks) {
    const mine = results.filter((r) => r.benchmarkId === b.id).sort((x, y) => x.date.localeCompare(y.date));
    for (const r of markRunningPBs(b, mine)) {
      if (r.date < start || r.date > end) continue;
      const { score: _score, ...rest } = r;
      void _score;
      out.push({ ...rest, benchmarkName: b.name, metricKind: b.metricKind, unit: b.unit, isPb: r.isPb });
    }
  }
  return out;
}

export const IMPROVEMENT_WINDOWS = [
  { key: "1m", label: "1 mo", months: 1 },
  { key: "3m", label: "3 mo", months: 3 },
  { key: "6m", label: "6 mo", months: 6 },
  { key: "1y", label: "1 yr", months: 12 },
] as const;
export type ImprovementWindow = (typeof IMPROVEMENT_WINDOWS)[number]["key"];

/**
 * % improvement of the PB over a window: the PB now vs. the PB as it stood on `since`.
 * Positive is better in either direction. Undefined when there was no result by `since`.
 */
export function improvementPct(
  history: { date: string; score: number }[],
  direction: "lower" | "higher",
  since: string,
): number | undefined {
  if (!history.length) return undefined;
  const then = [...history].reverse().find((h) => h.date <= since);
  if (!then || then.score === 0) return undefined;
  const now = history[history.length - 1].score;
  const change = direction === "lower" ? then.score - now : now - then.score;
  return (change / then.score) * 100;
}

/** Annotates chronologically sorted results with their score and whether each set a new PB at the time. */
export function markRunningPBs<R extends Pick<BenchmarkResult, "value" | "reps">>(
  def: Pick<BenchmarkDef, "metricKind" | "direction">,
  sorted: R[],
): (R & { score: number; isPb: boolean })[] {
  let best: number | undefined;
  return sorted.map((r) => {
    const score = resultScore(def, r);
    const isPb = best === undefined || isBetter(def, score, best);
    if (isPb) best = score;
    return { ...r, score, isPb };
  });
}

export function defaultDirection(kind: MetricKind): "lower" | "higher" {
  return kind === "time" ? "lower" : "higher";
}

export function formatResult(
  def: Pick<BenchmarkDef, "metricKind" | "unit">,
  r: Pick<BenchmarkResult, "value" | "reps">,
  units: Units,
): string {
  switch (def.metricKind) {
    case "time":
    case "duration":
      return formatClock(r.value);
    case "distance":
      return r.value < 1000 ? `${Math.round(r.value)} m` : formatDistance(r.value, units);
    case "weight_reps": {
      const w = Math.round(kgToDisplay(r.value, units) * 10) / 10;
      return `${w} ${weightUnit(units)} × ${r.reps ?? 1}`;
    }
    case "reps":
      return `${r.value} reps`;
    default:
      return `${r.value}${def.unit ? ` ${def.unit}` : ""}`;
  }
}
