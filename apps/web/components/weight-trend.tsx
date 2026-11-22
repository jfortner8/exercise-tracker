"use client";

import { format, parseISO, subMonths } from "date-fns";
import { useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { kgToDisplay, weightUnit, ymd } from "@et/core/domain";
import type { Units } from "@et/core/types";
import { weightChange, type WeightPoint } from "@et/core/weight";
import { Card, cx } from "./ui";

const RANGES = [
  { key: "1m", label: "1 mo", months: 1 },
  { key: "3m", label: "3 mo", months: 3 },
  { key: "6m", label: "6 mo", months: 6 },
  { key: "1y", label: "1 yr", months: 12 },
  { key: "all", label: "All", months: 0 },
] as const;
type Range = (typeof RANGES)[number]["key"];

/** Bodyweight over time: daily weigh-ins as dots, the 7-day average as the line. */
export function WeightTrend({ series, units, today }: { series: WeightPoint[]; units: Units; today: string }) {
  const [range, setRange] = useState<Range>("3m");
  const u = weightUnit(units);
  const show = (kg: number) => Math.round(kgToDisplay(kg, units) * 10) / 10;
  const signed = (kg: number) => {
    const v = show(kg);
    return `${v > 0 ? "+" : ""}${v} ${u}`;
  };

  const latest = series[series.length - 1];
  const months = RANGES.find((r) => r.key === range)!.months;
  const since = months ? ymd(subMonths(parseISO(today), months)) : "";
  const data = series
    .filter((p) => p.date >= since)
    .map((p) => ({ date: p.date, label: format(parseISO(p.date), "MMM d"), kg: show(p.kg), avg: show(p.avgKg) }));

  // Four equal steps of whole units, so ticks don't bunch at the top (e.g. 177, 178).
  const lo = Math.floor(Math.min(...data.map((d) => Math.min(d.kg, d.avg))) - 1);
  const step = Math.max(1, Math.ceil((Math.max(...data.map((d) => Math.max(d.kg, d.avg))) + 1 - lo) / 4));
  const ticks = [0, 1, 2, 3, 4].map((i) => lo + i * step);

  const changes = [
    { label: "30-day change", c: weightChange(series, 30, today) },
    { label: "90-day change", c: weightChange(series, 90, today) },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="7-day average" value={`${show(latest.avgKg)} ${u}`} />
        <Stat label="Latest weigh-in" value={`${show(latest.kg)} ${u}`} sub={format(parseISO(latest.date), "MMM d")} />
        {changes.map(({ label, c }) => (
          // Neutral colours: whether up or down is "good" depends on the person.
          <Stat
            key={label}
            label={label}
            value={c ? signed(c.deltaKg) : "—"}
            sub={c ? `from ${show(c.fromKg)} ${u}` : "Not enough history yet"}
          />
        ))}
      </div>

      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <p className="mr-auto text-xs text-muted">Dots are weigh-ins; the line is the 7-day average.</p>
          <div className="flex rounded-lg border border-border p-0.5 text-xs" role="radiogroup" aria-label="Range">
            {RANGES.map((r) => (
              <button
                key={r.key}
                type="button"
                role="radio"
                aria-checked={range === r.key}
                onClick={() => setRange(r.key)}
                className={cx(
                  "rounded-md px-2.5 py-1 font-medium",
                  range === r.key ? "bg-surface-2 text-text" : "text-muted hover:text-text",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        {data.length < 2 ? (
          <p className="py-12 text-center text-sm text-muted">
            {data.length === 0 ? "No weigh-ins in this range." : "Log another weigh-in to see a trend."}
          </p>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "var(--muted)", fontSize: 12 }} axisLine={false} tickLine={false} minTickGap={24} />
                <YAxis
                  domain={[ticks[0], ticks[4]]}
                  ticks={ticks}
                  width={44}
                  tick={{ fill: "var(--muted)", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8 }}
                  labelStyle={{ color: "var(--text)" }}
                  formatter={(v, name) => [`${v} ${u}`, name === "avg" ? "7-day average" : "Weigh-in"]}
                />
                <Line
                  dataKey="kg"
                  stroke="none"
                  isAnimationActive={false}
                  dot={{ r: 3, fill: "var(--muted)", stroke: "var(--surface)", strokeWidth: 1 }}
                  activeDot={{ r: 4 }}
                />
                <Line type="monotone" dataKey="avg" stroke="var(--accent)" strokeWidth={2.5} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card className="divide-y divide-border">
        <h2 className="px-4 py-3 text-sm font-semibold">Recent weigh-ins</h2>
        {[...series]
          .reverse()
          .slice(0, 10)
          .map((p) => (
            <div key={p.date} className="flex items-center justify-between px-4 py-2 text-sm">
              <span className="text-muted">{format(parseISO(p.date), "EEE, MMM d, yyyy")}</span>
              <span className="font-medium tabular-nums">
                {show(p.kg)} {u}
              </span>
            </div>
          ))}
      </Card>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-0.5 text-xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </Card>
  );
}
