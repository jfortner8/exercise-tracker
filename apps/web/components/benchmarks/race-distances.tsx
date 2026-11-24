import { format, parseISO } from "date-fns";
import { distanceUnit, metersToDisplay } from "@et/core/domain";
import type { RaceSportTally } from "@et/core/race-distances";
import type { Units } from "@et/core/types";
import { Card } from "../ui";

const times = (n: number) => `${n} ${n === 1 ? "time" : "times"}`;

/**
 * "Race distances": how many times each common race distance was covered, per sport. Each tile
 * opens to list those workouts. Shown only once there's at least one.
 */
export function RaceDistances({ sports, units, year }: { sports: RaceSportTally[]; units: Units; year: string }) {
  if (!sports.length) return null;
  const dist = (m: number) => `${Math.round(metersToDisplay(m, units) * 10) / 10} ${distanceUnit(units)}`;
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Race distances</h2>
        <p className="mt-0.5 text-sm text-muted">
          Each workout counts once, for the longest race distance it reached: a 12 km run is a 10K.
        </p>
      </div>
      {sports.map((s) => (
        <div key={s.sport} className="space-y-2">
          <h3 className="text-sm font-medium">{s.label}</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {s.distances.map((d) => (
              <Card key={d.key} className="p-0">
                <details className="group">
                  <summary className="cursor-pointer list-none p-3">
                    <span className="block text-xs font-medium text-muted">{d.label}</span>
                    <span className="block text-2xl font-semibold tabular-nums tracking-tight">{times(d.total)}</span>
                    <span className="block text-xs text-muted">
                      {d.thisYear} in {year}
                      <span className="ml-1 text-accent-ink group-open:hidden">· Show</span>
                      <span className="ml-1 hidden text-accent-ink group-open:inline">· Hide</span>
                    </span>
                  </summary>
                  <ul className="max-h-48 space-y-1 overflow-y-auto border-t border-border px-3 py-2 text-xs">
                    {d.workouts.map((w) => (
                      <li key={w.id} className="flex justify-between gap-2">
                        <span className="min-w-0 truncate">
                          <span className="tabular-nums text-muted">{format(parseISO(w.date), "MMM d, yyyy")}</span> {w.title}
                        </span>
                        <span className="shrink-0 tabular-nums">{dist(w.meters)}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
