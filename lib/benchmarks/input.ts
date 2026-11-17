import { displayToKg, displayToMeters, distanceUnit, formatClock, kgToDisplay, metersToDisplay, parseClock, weightUnit } from "../domain";
import type { BenchmarkDef, Units } from "../types";

export function valueLabel(bm: Pick<BenchmarkDef, "metricKind" | "unit">, units: Units) {
  switch (bm.metricKind) {
    case "time":
    case "duration":
      return "Time (mm:ss)";
    case "distance":
      return `Distance (${distanceUnit(units)})`;
    case "weight_reps":
      return `Weight (${weightUnit(units)})`;
    case "reps":
      return "Reps";
    default:
      return `Value${bm.unit ? ` (${bm.unit})` : ""}`;
  }
}

/** Converts what the user typed into the canonical stored value. NaN if invalid. */
export function parseValue(bm: Pick<BenchmarkDef, "metricKind">, raw: string, units: Units): number {
  const s = raw.trim();
  if (!s) return NaN;
  switch (bm.metricKind) {
    case "time":
    case "duration":
      return parseClock(s);
    case "distance":
      return displayToMeters(Number(s), units);
    case "weight_reps":
      return displayToKg(Number(s), units);
    default:
      return Number(s);
  }
}

/** A stored value as the user would type it (inverse of parseValue), to pre-fill the edit form. */
export function valueToInput(bm: Pick<BenchmarkDef, "metricKind">, value: number, units: Units): string {
  const round = (n: number, d: number) => String(Math.round(n * 10 ** d) / 10 ** d);
  switch (bm.metricKind) {
    case "time":
    case "duration":
      return formatClock(value);
    case "distance":
      return round(metersToDisplay(value, units), 3);
    case "weight_reps":
      return round(kgToDisplay(value, units), 1);
    default:
      return String(value);
  }
}
