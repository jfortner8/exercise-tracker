import { displayToKg, displayToMeters, distanceUnit, parseClock, weightUnit } from "@/lib/domain";
import type { BenchmarkDef, Units } from "@/lib/types";

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
