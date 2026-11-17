import { differenceInCalendarDays, parseISO, subDays } from "date-fns";
import { ymd } from "./domain";
import type { DayLog } from "./types";

export interface WeightPoint {
  date: string;
  kg: number;
  /** Mean of weigh-ins in the 7 days ending on this date (smooths day-to-day water swings). */
  avgKg: number;
}

export const AVG_DAYS = 7;

/** Weigh-ins oldest first, each with its trailing 7-day average. */
export function weightSeries(days: Pick<DayLog, "date" | "weightKg">[]): WeightPoint[] {
  const pts = days
    .filter((d): d is { date: string; weightKg: number } => d.weightKg != null)
    .sort((a, b) => a.date.localeCompare(b.date));
  return pts.map((p, i) => {
    const window: number[] = [];
    for (let j = i; j >= 0; j--) {
      if (differenceInCalendarDays(parseISO(p.date), parseISO(pts[j].date)) >= AVG_DAYS) break;
      window.push(pts[j].weightKg);
    }
    return { date: p.date, kg: p.weightKg, avgKg: window.reduce((s, v) => s + v, 0) / window.length };
  });
}

/**
 * Change in the 7-day average over the last `days` days: latest average vs. the average as it
 * stood on (or before) the start of the window. Undefined without a weigh-in from back then.
 */
export function weightChange(series: WeightPoint[], days: number, today: string) {
  if (!series.length) return undefined;
  const since = ymd(subDays(parseISO(today), days));
  const then = [...series].reverse().find((p) => p.date <= since);
  if (!then) return undefined;
  const now = series[series.length - 1];
  return { fromKg: then.avgKg, toKg: now.avgKg, deltaKg: now.avgKg - then.avgKg };
}
