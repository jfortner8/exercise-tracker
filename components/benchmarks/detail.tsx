"use client";

import { format, parseISO } from "date-fns";
import { ArrowLeft, Pencil, Trash2, Trophy } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  addResultAction,
  deleteBenchmarkAction,
  deleteResultAction,
  updateResultAction,
  workoutsOnDayAction,
} from "@/lib/actions";
import { betterLabel, CATEGORY_LABEL, METRIC_LABEL } from "@/lib/benchmarks/catalog";
import { isClock, parseValue, valueLabel, valueToInput } from "@/lib/benchmarks/input";
import { suggestLink } from "@/lib/benchmarks/linking";
import { formatResult, markRunningPBs, personalBest, resultScore, ymd } from "@/lib/domain";
import type { BenchmarkDef, BenchmarkResult, Units, Workout } from "@/lib/types";
import { ClockInput } from "../clock-input";
import { Button, Card, Field, Input, PageHeader, cx } from "../ui";
import { WorkoutLinkField } from "./workout-link-field";

export function BenchmarkDetail({ def, results, units }: { def: BenchmarkDef; results: BenchmarkResult[]; units: Units }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
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
        subtitle={`${CATEGORY_LABEL[def.category]} · ${METRIC_LABEL[def.metricKind]} · ${betterLabel(def.metricKind, def.direction)}`}
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
              <Trophy className="size-6 text-accent-ink" />
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
                <LineChart data={data} margin={{ top: 12, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "var(--muted)", fontSize: 12 }}
                    tickMargin={8}
                    minTickGap={16}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    dataKey="score"
                    reversed={def.direction === "lower"}
                    domain={["auto", "auto"]}
                    width={64}
                    interval={0}
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
              <th className="w-16" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {[...data].reverse().map((r) =>
              editingId === r.id ? (
                <tr key={r.id} className="bg-surface-2/40">
                  <td colSpan={4} className="px-4 py-3">
                    <ResultForm def={def} units={units} editing={r} onDone={() => setEditingId(null)} />
                  </td>
                </tr>
              ) : (
              <tr key={r.id}>
                <td className="px-4 py-2 tabular-nums">{format(parseISO(r.date), "MMM d, yyyy")}</td>
                <td className={cx("px-4 py-2 tabular-nums", r.isPb && "font-semibold")}>
                  {formatResult(def, r, units)}
                  {r.id === pb?.id && <Trophy className="ml-1.5 inline size-3.5 text-accent-ink" />}
                </td>
                <td className="hidden px-4 py-2 text-muted sm:table-cell">{r.notes}</td>
                <td className="whitespace-nowrap px-2">
                  <button
                    aria-label="Edit result"
                    className="rounded-md p-2.5 text-muted hover:bg-surface-2 hover:text-text md:p-1"
                    onClick={() => setEditingId(r.id)}
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    aria-label="Delete result"
                    className="rounded-md p-2.5 text-muted hover:bg-surface-2 hover:text-danger md:p-1"
                    onClick={() => confirm("Delete this result?") && start(() => deleteResultAction(def.id, r.date, r.id))}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </td>
              </tr>
              ),
            )}
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
  return (
    <Card className="h-fit p-4">
      <h2 className="mb-3 text-sm font-semibold">Record a result</h2>
      <ResultForm def={def} units={units} />
    </Card>
  );
}

/**
 * Date, value, reps, workout link and notes. Records a new result, or edits `editing` in place
 * (pre-filled, including its current workout link; changing the date moves it).
 */
function ResultForm({
  def,
  units,
  editing,
  onDone,
}: {
  def: BenchmarkDef;
  units: Units;
  editing?: BenchmarkResult;
  onDone?: () => void;
}) {
  const [date, setDate] = useState(() => editing?.date ?? ymd(new Date()));
  const [value, setValue] = useState(editing ? valueToInput(def, editing.value, units) : "");
  const [reps, setReps] = useState(editing?.reps ? String(editing.reps) : "");
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [workoutId, setWorkoutId] = useState(editing?.workoutId ?? "");

  // Load the chosen day's workouts. Keep an edited result's existing link on its own date;
  // otherwise pre-select the workout this result most likely came from.
  useEffect(() => {
    let current = true;
    workoutsOnDayAction(date)
      .then((ws) => {
        if (!current) return;
        setWorkouts(ws);
        const keep = editing && date === editing.date && ws.some((w) => w.id === editing.workoutId);
        setWorkoutId(keep ? editing.workoutId! : editing && date === editing.date ? "" : (suggestLink(def, ws, units)?.id ?? ""));
      })
      .catch(() => current && setWorkouts([]));
    return () => {
      current = false;
    };
  }, [date, def, units, editing]);

  return (
    <form
      className={editing ? "grid gap-3 sm:grid-cols-2" : "space-y-3"}
      onSubmit={(e) => {
        e.preventDefault();
        const v = parseValue(def, value, units);
        if (!isFinite(v) || v < 0) return setError("Enter a valid value");
        setError(null);
        const payload = {
          benchmarkId: def.id,
          date,
          value: v,
          reps: def.metricKind === "weight_reps" ? Number(reps) || 1 : undefined,
          notes: notes.trim() || undefined,
          workoutId: workoutId || undefined,
        };
        start(async () => {
          try {
            if (editing) {
              await updateResultAction({ ...payload, id: editing.id, originalDate: editing.date });
            } else {
              await addResultAction(payload);
              setValue("");
              setReps("");
              setNotes("");
            }
            onDone?.();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not save");
          }
        });
      }}
    >
      <Field label="Date">
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      </Field>
      <div className="flex gap-2">
        <Field label={valueLabel(def, units)} className="flex-1">
          {isClock(def) ? (
            <ClockInput value={value} onChange={setValue} required autoFocus={!!editing} />
          ) : (
            <Input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" required autoFocus={!!editing} />
          )}
        </Field>
        {def.metricKind === "weight_reps" && (
          <Field label="Reps" className="w-20">
            <Input value={reps} onChange={(e) => setReps(e.target.value)} inputMode="numeric" placeholder="1" />
          </Field>
        )}
      </div>
      <WorkoutLinkField def={def} workouts={workouts} units={units} value={workoutId} onChange={setWorkoutId} />
      <Field label="Notes" className={editing ? "sm:col-span-2" : undefined}>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Pool, conditions, felt…" />
      </Field>
      {error && <p className="text-sm text-danger sm:col-span-2">{error}</p>}
      {editing ? (
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button type="button" size="sm" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" size="sm" variant="primary" disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      ) : (
        <Button type="submit" variant="primary" className="w-full" disabled={pending}>
          {pending ? "Saving…" : "Save result"}
        </Button>
      )}
    </form>
  );
}
