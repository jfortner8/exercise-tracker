"use client";

import { format, parseISO } from "date-fns";
import { Plus, Trophy } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { createBenchmarkAction, trackCatalogBenchmarkAction } from "@/lib/actions";
import { BENCHMARK_CATALOG, CATEGORY_LABEL, METRIC_LABEL } from "@/lib/benchmarks/catalog";
import { defaultDirection, formatResult, personalBest, resultScore } from "@/lib/domain";
import {
  BENCHMARK_CATEGORIES,
  METRIC_KINDS,
  type BenchmarkCategory,
  type BenchmarkDef,
  type BenchmarkResult,
  type MetricKind,
  type Units,
} from "@/lib/types";
import { Sheet } from "../sheet";
import { Button, Card, Field, Input, Select, cx } from "../ui";

export function BenchmarkBoard({
  benchmarks,
  results,
  units,
}: {
  benchmarks: BenchmarkDef[];
  results: BenchmarkResult[];
  units: Units;
}) {
  const [adding, setAdding] = useState(false);
  const byBm = useMemo(() => {
    const m = new Map<string, BenchmarkResult[]>();
    for (const r of results) m.set(r.benchmarkId, [...(m.get(r.benchmarkId) ?? []), r]);
    for (const l of m.values()) l.sort((a, b) => a.date.localeCompare(b.date));
    return m;
  }, [results]);

  const tracked = new Set(benchmarks.map((b) => b.catalogKey).filter(Boolean));
  const groups = BENCHMARK_CATEGORIES.map((c) => ({
    category: c,
    items: benchmarks.filter((b) => b.category === c).sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((g) => g.items.length);

  return (
    <div className="space-y-8">
      <div className="flex gap-2">
        <Button variant="primary" onClick={() => setAdding(true)}>
          <Plus className="size-4" /> Add benchmark
        </Button>
      </div>

      {benchmarks.length === 0 && (
        <Card className="p-8 text-center">
          <Trophy className="mx-auto mb-2 size-6 text-muted" />
          <p className="font-medium">No benchmarks yet</p>
          <p className="mt-1 text-sm text-muted">Pick a few suggestions below, or create your own.</p>
        </Card>
      )}

      {groups.map((g) => (
        <section key={g.category}>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{CATEGORY_LABEL[g.category]}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {g.items.map((b) => (
              <BenchmarkCard key={b.id} def={b} results={byBm.get(b.id) ?? []} units={units} />
            ))}
          </div>
        </section>
      ))}

      <Suggestions tracked={tracked} />

      {adding && <CreateBenchmark onClose={() => setAdding(false)} />}
    </div>
  );
}

function BenchmarkCard({ def, results, units }: { def: BenchmarkDef; results: BenchmarkResult[]; units: Units }) {
  const pb = personalBest(def, results);
  const last = results.at(-1);
  return (
    <Link href={`/benchmarks/${def.id}`} className="group">
      <Card className="h-full p-4 transition-colors group-hover:border-accent/60">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium">{def.name}</h3>
          {pb && <Trophy className="size-4 shrink-0 text-accent" />}
        </div>
        {pb ? (
          <>
            <div className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{formatResult(def, pb, units)}</div>
            <div className="text-xs text-muted">
              PB · {format(parseISO(pb.date), "MMM d, yyyy")}
              {last && last.id !== pb.id && ` · last ${formatResult(def, last, units)}`}
            </div>
            <Sparkline def={def} results={results} />
          </>
        ) : (
          <div className="mt-2 text-sm text-muted">No results yet. Record one from the calendar or here.</div>
        )}
      </Card>
    </Link>
  );
}

function Sparkline({ def, results }: { def: BenchmarkDef; results: BenchmarkResult[] }) {
  if (results.length < 2) return null;
  const ys = results.map((r) => resultScore(def, r));
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  const span = max - min || 1;
  // Flip so "better" always points up.
  const norm = (y: number) => (def.direction === "lower" ? (y - min) / span : 1 - (y - min) / span);
  const pts = ys.map((y, i) => `${(i / (ys.length - 1)) * 100},${4 + norm(y) * 24}`).join(" ");
  return (
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" className="mt-3 h-8 w-full text-accent" aria-hidden>
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Suggestions({ tracked }: { tracked: Set<string | undefined> }) {
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const available = BENCHMARK_CATALOG.filter((c) => !tracked.has(c.key));
  if (!available.length) return null;
  const cats = [...new Set(available.map((c) => c.category))];
  return (
    <section>
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted">Suggestions</h2>
      <p className="mb-3 text-sm text-muted">Tap to start tracking.</p>
      <div className="space-y-3">
        {cats.map((c) => (
          <div key={c} className="flex flex-wrap items-center gap-1.5">
            <span className="w-20 text-xs font-medium text-muted">{CATEGORY_LABEL[c]}</span>
            {available
              .filter((a) => a.category === c)
              .map((a) => (
                <button
                  key={a.key}
                  disabled={pending}
                  title={a.hint}
                  onClick={() => {
                    setBusy(a.key);
                    start(() => trackCatalogBenchmarkAction(a.key));
                  }}
                  className={cx(
                    "inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-medium hover:border-accent hover:text-accent disabled:opacity-60",
                    busy === a.key && pending && "animate-pulse",
                  )}
                >
                  <Plus className="size-3" />
                  {a.name}
                </button>
              ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function CreateBenchmark({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<BenchmarkCategory>("custom");
  const [metricKind, setMetricKind] = useState<MetricKind>("time");
  const [direction, setDirection] = useState(defaultDirection("time"));
  const [unit, setUnit] = useState("");
  const [pending, start] = useTransition();

  return (
    <Sheet variant="dialog" title="New benchmark" subtitle="If you can measure it, you can track it." onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const id = await createBenchmarkAction({ name, category, metricKind, direction, unit: unit || undefined });
            router.push(`/benchmarks/${id}`);
          });
        }}
      >
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="200 m IM, Farmer carry, Box jump…" required autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <Select value={category} onChange={(e) => setCategory(e.target.value as BenchmarkCategory)}>
              {BENCHMARK_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Measured as">
            <Select
              value={metricKind}
              onChange={(e) => {
                const k = e.target.value as MetricKind;
                setMetricKind(k);
                setDirection(defaultDirection(k));
              }}
            >
              {METRIC_KINDS.map((k) => (
                <option key={k} value={k}>
                  {METRIC_LABEL[k]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Better is">
            <Select value={direction} onChange={(e) => setDirection(e.target.value as "lower" | "higher")}>
              <option value="lower">Lower</option>
              <option value="higher">Higher</option>
            </Select>
          </Field>
          {metricKind === "number" && (
            <Field label="Unit">
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="in, bpm, watts…" />
            </Field>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Creating…" : "Create"}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
