import type { DistanceUnit } from "./types";

/*
 * Working out an exact benchmark time from a longer run's splits. The fastest n consecutive whole
 * splits are a real, continuous stretch of exactly that distance, so the time is exact: the run's
 * true best stretch can only be equal or faster. (An average-pace estimate guarantees nothing.)
 */

export const SPLIT_M: Record<DistanceUnit, number> = { km: 1000, mi: 1609.344 };

/**
 * Splits typed or pasted as a list: "5:12 5:08, 5:01" (spaces, commas, semicolons or new lines).
 * Each is m:ss ("5:12", "5'12", "5:12.4"), h:mm:ss, or 3–4 digits read as m:ss ("512", "1105").
 */
export function parseSplits(text: string): { sec: number[] } | { error: string } {
  const sec: number[] = [];
  for (const raw of text.split(/[\s,;]+/).filter(Boolean)) {
    const t = raw.replace(/["”]$/, "");
    let s: number | undefined;
    const digits = /^(\d{1,2})(\d{2})$/.exec(t);
    if (digits && t.length >= 3) {
      s = Number(digits[2]) < 60 ? Number(digits[1]) * 60 + Number(digits[2]) : NaN;
    } else if (/[:'’]/.test(t)) {
      s = clock(t);
    }
    if (s == null || !isFinite(s) || s <= 0) return { error: `Can't read "${raw}". Type splits like 5:12.` };
    sec.push(s);
  }
  return { sec };
}

/** "5:12", "5'12", "5:01.5" or "1:02:03" in seconds, keeping tenths; NaN if it can't be read. */
function clock(t: string): number {
  const parts = t.replace(/['’]/g, ":").split(":");
  if (parts.length > 3 || !parts.slice(0, -1).every((p) => /^\d+$/.test(p)) || !/^\d{2}(\.\d+)?$/.test(parts.at(-1)!)) return NaN;
  if (parts.slice(1).some((p) => Number(p) >= 60)) return NaN;
  return parts.reduce((acc, p) => acc * 60 + Number(p), 0);
}

/** How many whole splits make up `distanceM`, or undefined when it isn't a whole number of them. */
export function splitsNeeded(distanceM: number, unit: DistanceUnit): number | undefined {
  const n = distanceM / SPLIT_M[unit];
  const whole = Math.round(n);
  // Same 1% allowance as linking, so a 1 mile benchmark matches one mile split.
  return whole >= 1 && Math.abs(n - whole) <= n * 0.01 ? whole : undefined;
}

/**
 * The fastest n consecutive splits: their total and which splits they are (1-based, inclusive).
 * The earliest wins a tie. Undefined with fewer than n splits.
 */
export function fastestWindow(sec: number[], n: number): { sec: number; from: number; to: number } | undefined {
  if (n < 1 || sec.length < n) return undefined;
  // Whole hundredths, so equal windows compare equal.
  const cs = sec.map((s) => Math.round(s * 100));
  let sum = cs.slice(0, n).reduce((a, b) => a + b, 0);
  let best = sum;
  let at = 0;
  for (let i = n; i < cs.length; i++) {
    sum += cs[i] - cs[i - n];
    if (sum < best) {
      best = sum;
      at = i - n + 1;
    }
  }
  return { sec: best / 100, from: at + 1, to: at + n };
}
