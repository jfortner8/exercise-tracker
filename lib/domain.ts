import { addDays, endOfMonth, endOfWeek, format, parseISO, startOfMonth, startOfWeek } from "date-fns";
import type {
  BenchmarkDef,
  BenchmarkResult,
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
  const wu = iv.warmupSec ? `${Math.round(iv.warmupSec / 60)}′ WU + ` : "";
  const cd = iv.cooldownSec ? ` + ${Math.round(iv.cooldownSec / 60)}′ CD` : "";
  return `${wu}${core}${cd}`;
}

// ---------- Units ----------
export const KM = 1000;
export const MILE = 1609.344;
export const LB = 0.45359237;

export function distanceUnit(units: Units) {
  return units === "imperial" ? "mi" : "km";
}
export function metersToDisplay(m: number, units: Units) {
  return m / (units === "imperial" ? MILE : KM);
}
export function displayToMeters(v: number, units: Units) {
  return v * (units === "imperial" ? MILE : KM);
}
export function weightUnit(units: Units) {
  return units === "imperial" ? "lb" : "kg";
}
export function kgToDisplay(kg: number, units: Units) {
  return units === "imperial" ? kg / LB : kg;
}
export function displayToKg(v: number, units: Units) {
  return units === "imperial" ? v * LB : v;
}
export function formatDistance(m: number, units: Units) {
  const v = metersToDisplay(m, units);
  return `${v >= 10 ? v.toFixed(1) : v.toFixed(2)} ${distanceUnit(units)}`;
}

// ---------- Status ----------
export type DisplayStatus = Workout["status"] | "needs_review";

/** A planned workout whose day has passed but was never logged needs review. */
export function displayStatus(w: Pick<Workout, "status" | "date">, today: string): DisplayStatus {
  if (w.status === "planned" && w.date < today) return "needs_review";
  return w.status;
}

export const DONE_STATUSES = new Set(["completed", "partial", "substituted"]);

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
