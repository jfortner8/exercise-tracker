"use client";

import { useState, type ReactNode } from "react";
import { linkRule } from "@et/core/benchmarks/linking";
import { formatClock } from "@et/core/domain";
import { fastestWindow, parseSplits, splitsNeeded } from "@et/core/splits";
import type { BenchmarkDef, DistanceUnit, Units } from "@et/core/types";
import { Button, Textarea, cx } from "../ui";

const UNIT_NAME: Record<DistanceUnit, string> = { km: "km", mi: "mile" };

/**
 * Under a distance benchmark's Time field: paste a longer run's splits and get the fastest
 * consecutive stretch of the benchmark's distance, an exact time for a real stretch of the run.
 * Shown only for time benchmarks with a set distance (1 mile, 5K, 10K).
 */
export function SplitsHelper({
  def,
  units,
  onUse,
  className,
}: {
  def: Pick<BenchmarkDef, "catalogKey" | "metricKind" | "name">;
  units: Units;
  /** The time in seconds, and a note saying which splits it came from. */
  onUse: (sec: number, note: string) => void;
  className?: string;
}) {
  const distanceM = def.metricKind === "time" ? linkRule(def).distanceM : undefined;
  // Default to the unit that can give this distance exactly, preferring the profile's.
  const fits = (u: DistanceUnit) => !!distanceM && splitsNeeded(distanceM, u) != null;
  const [open, setOpen] = useState(false);
  const [unit, setUnit] = useState<DistanceUnit>(fits(units.distance) || !fits("km") ? units.distance : "km");
  const [text, setText] = useState("");
  if (!distanceM || (!fits("km") && !fits("mi"))) return null;

  if (!open) {
    return (
      <button type="button" className={cx("justify-self-start self-start text-xs text-accent hover:underline", className)} onClick={() => setOpen(true)}>
        Work it out from splits
      </button>
    );
  }

  const n = splitsNeeded(distanceM, unit);
  const parsed = parseSplits(text);
  const best = n && "sec" in parsed ? fastestWindow(parsed.sec, n) : undefined;
  const range = best && (best.from === best.to ? `${unit} ${best.from}` : `${unit} ${best.from}–${best.to}`);
  const other: DistanceUnit = unit === "km" ? "mi" : "km";

  let line: ReactNode = null;
  if (!n) {
    line = (
      <span className="text-muted">
        {UNIT_NAME[unit][0].toUpperCase() + UNIT_NAME[unit].slice(1)} splits can&apos;t give an exact {def.name}; switch to{" "}
        {other}.
      </span>
    );
  } else if ("error" in parsed) {
    line = <span className="text-danger">{parsed.error}</span>;
  } else if (!best) {
    line = parsed.sec.length ? (
      <span className="text-muted">
        Needs at least {n} whole {UNIT_NAME[unit]} splits ({parsed.sec.length} so far).
      </span>
    ) : null;
  }

  return (
    <div className={cx("space-y-2 rounded-lg border border-border bg-surface-2/40 p-3 text-sm", className)} role="group" aria-label="Work it out from splits">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-muted">Splits</span>
        <div className="inline-flex rounded-lg border border-border p-0.5" role="group" aria-label="Split length">
          {(["km", "mi"] as const).map((u) => (
            <button
              key={u}
              type="button"
              aria-pressed={unit === u}
              onClick={() => setUnit(u)}
              className={cx("rounded-md px-2.5 py-0.5 text-xs", unit === u ? "bg-accent text-accent-fg" : "text-muted hover:bg-surface-2")}
            >
              {u}
            </button>
          ))}
        </div>
      </div>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="5:12 5:08 5:01 4:58 …"
        aria-label={`Splits, one per ${UNIT_NAME[unit]}`}
        autoComplete="off"
        spellCheck={false}
        className="min-h-16 tabular-nums"
      />
      <p className="text-xs text-muted">Whole {UNIT_NAME[unit]} splits in order. Leave out a partial last one.</p>
      {best ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="tabular-nums">
            Fastest {def.name}: <span className="font-semibold">{formatClock(best.sec)}</span>{" "}
            <span className="text-muted">({range})</span>
          </span>
          <Button type="button" size="sm" onClick={() => onUse(best.sec, `From splits, ${range}`)}>
            Use this time
          </Button>
        </div>
      ) : (
        line && <p className="text-xs">{line}</p>
      )}
    </div>
  );
}
