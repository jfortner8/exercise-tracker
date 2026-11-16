"use client";

import { format, parseISO } from "date-fns";
import { ArrowLeft, Trash2, Trophy } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { addResultAction, deleteBenchmarkAction, deleteResultAction } from "@/lib/actions";
import { CATEGORY_LABEL, METRIC_LABEL } from "@/lib/benchmarks/catalog";
import { parseValue, valueLabel } from "@/lib/benchmarks/input";
import { formatResult, markRunningPBs, personalBest, resultScore, ymd } from "@/lib/domain";
import type { BenchmarkDef, BenchmarkResult, Units } from "@/lib/types";
import { Button, Card, Field, Input, PageHeader, cx } from "../ui";

export function BenchmarkDetail({ def, results, units }: { def: BenchmarkDef; results: BenchmarkResult[]; units: Units }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const sorted = [...results].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const pb = personalBest(def, sorted);

  const data = markRunningPBs(def, sorted).map((r) => ({ ...r, label: format(parseISO(r.date), "MMM d") }));

  const scoreLabel = (score: number) =>
    def.metricKind === "weight_reps" ? `${formatResult(def, { value: score, reps: 1 }, units)} e1RM` : formatResult(def, { value: score }, units);

  return (
    <div>
      <Link href="/benchmarks" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-text">
        <ArrowLeft className="size-4" /> Benchmarks
      </Link>
      <PageHeader
        title={def.name}
        subtitle={`${CATEGORY_LABEL[def.category]} · ${METRIC_LABEL[def.metricKind]} · ${def.direction} is better`}
        actions={
          <Button
            variant="danger"
            size="sm"
            disabled={pending}
            onClick={() =>
              confirm(`Delete "${def.name}" and all ${results.length} results?`) &&
              start(async () => {
                await deleteBenchmarkAction(def.id);
                router.push("/benchmarks");
              })
            }
          >
            <Trash2 className="size-4" /> Delete
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-[1fr_18rem]">
        <Card className="p-4">
          {pb ? (
            <div className="mb-4 flex items-center gap-3">
              <Trophy className="size-6 text-accent" />
              <div>
                <div className="text-3xl font-semibold tabular-nums tracking-tight">{formatResult(def, pb, units)}</div>
                <div className="text-sm text-muted">
                  Personal best · {format(parseISO(pb.date), "MMMM d, yyyy")}
                  {def.metricKind === "weight_reps" && ` · ${scoreLabel(resultScore(def, pb))}`}
                </div>
              </div>
            </div>
          ) : (
            <p className="mb-4 text-sm text-muted">Record your first result to set a baseline.</p>
          )}
          {data.length >= 2 && (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: "var(--muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis
                    dataKey="score"
                    reversed={def.direction === "lower"}
                    domain={["auto", "auto"]}
                    width={64}
                    tick={{ fill: "var(--muted)", fontSize: 12 }}
                    tickFormatter={(v: number) => scoreLabel(v).replace(" e1RM", "")}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8 }}
                    formatter={(_v, _n, item) => [formatResult(def, item.payload as BenchmarkResult, units), def.name]}
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="var(--accent)"
                    strokeWidth={2}
                    isAnimationActive={false}
                    dot={(p: { cx?: number; cy?: number; payload?: { isPb: boolean; id: string } }) => (
                      <circle
                        key={p.payload?.id}
                        cx={p.cx}
                        cy={p.cy}
                        r={p.payload?.isPb ? 5 : 3}
                        fill={p.payload?.isPb ? "var(--accent)" : "var(--surface)"}
                        stroke="var(--accent)"
                        strokeWidth={2}
                      />
                    )}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          {data.length >= 2 && (
            <p className="mt-2 text-xs text-muted">Filled dots mark a new PB. Up is always better.</p>
          )}
        </Card>

        <AddResult def={def} units={units} />
      </div>

      <Card className="mt-4 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-2/60 text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 font-medium">Result</th>
              <th className="hidden px-4 py-2 font-medium sm:table-cell">Notes</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {[...data].reverse().map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2 tabular-nums">{format(parseISO(r.date), "MMM d, yyyy")}</td>
                <td className={cx("px-4 py-2 tabular-nums", r.isPb && "font-semibold")}>
                  {formatResult(def, r, units)}
                  {r.id === pb?.id && <Trophy className="ml-1.5 inline size-3.5 text-accent" />}
                </td>
                <td className="hidden px-4 py-2 text-muted sm:table-cell">{r.notes}</td>
                <td className="px-2">
                  <button
                    aria-label="Delete result"
                    className="rounded p-1 text-muted hover:bg-surface-2 hover:text-danger"
                    onClick={() => confirm("Delete this result?") && start(() => deleteResultAction(def.id, r.date, r.id))}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted">
                  No results yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function AddResult({ def, units }: { def: BenchmarkDef; units: Units }) {
  const [date, setDate] = useState(() => ymd(new Date()));
  const [value, setValue] = useState("");
  const [reps, setReps] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <Card className="h-fit p-4">
      <h2 className="mb-3 text-sm font-semibold">Record a result</h2>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const v = parseValue(def, value, units);
          if (!isFinite(v) || v < 0) return setError("Enter a valid value");
          setError(null);
          start(async () => {
            await addResultAction({
              benchmarkId: def.id,
              date,
              value: v,
              reps: def.metricKind === "weight_reps" ? Number(reps) || 1 : undefined,
              notes: notes.trim() || undefined,
            });
            setValue("");
            setReps("");
            setNotes("");
          });
        }}
      >
        <Field label="Date">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <div className="flex gap-2">
          <Field label={valueLabel(def, units)} className="flex-1">
            <Input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" required />
          </Field>
          {def.metricKind === "weight_reps" && (
            <Field label="Reps" className="w-20">
              <Input value={reps} onChange={(e) => setReps(e.target.value)} inputMode="numeric" placeholder="1" />
            </Field>
          )}
        </div>
        <Field label="Notes">
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Pool, conditions, felt…" />
        </Field>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" variant="primary" className="w-full" disabled={pending}>
          {pending ? "Saving…" : "Save result"}
        </Button>
      </form>
    </Card>
  );
}
