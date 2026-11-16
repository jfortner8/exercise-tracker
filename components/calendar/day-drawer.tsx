"use client";

import { format, parseISO } from "date-fns";
import { Check, HeartPulse, Minus, Pencil, Plus, Trash2, Trophy, Wine } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { addResultAction, deleteWorkoutAction, logAsDoneAction, saveDayAction } from "@/lib/actions";
import { parseValue, valueLabel } from "@/lib/benchmarks/input";
import { describeIntervals, detailsDurationSec, displayStatus, formatDistance, formatDuration } from "@/lib/domain";
import type { BenchmarkDef, DayLog, Injury, Profile, Workout, WorkoutDetails } from "@/lib/types";
import { STATUS_LABEL, TYPE_META } from "@/lib/workout-types";
import { Sheet } from "../sheet";
import { Button, Field, Input, Select, Textarea, cx } from "../ui";
import { WorkoutForm } from "../workouts/workout-form";

function summarize(d: WorkoutDetails | undefined, profile: Profile) {
  if (!d) return null;
  const parts: string[] = [];
  const iv = describeIntervals(d.intervals);
  if (iv) parts.push(iv);
  const dur = detailsDurationSec(d);
  if (dur) parts.push(formatDuration(dur));
  if (d.distanceM) parts.push(formatDistance(d.distanceM, profile.units));
  return (
    <>
      {parts.length > 0 && <div>{parts.join(" · ")}</div>}
      {d.description && <div className="whitespace-pre-wrap text-muted">{d.description}</div>}
    </>
  );
}

export function DayDrawer({
  date,
  today,
  workouts,
  log,
  injuries,
  activeInjuries,
  benchmarks,
  profile,
  onClose,
}: {
  date: string;
  today: string;
  workouts: Workout[];
  log?: DayLog;
  injuries: Injury[];
  activeInjuries: Injury[];
  benchmarks: BenchmarkDef[];
  profile: Profile;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState<Workout | "new" | null>(workouts.length === 0 ? "new" : null);
  const [pending, start] = useTransition();
  const d = parseISO(date);
  const relative = !today ? "" : date === today ? "Today" : date < today ? "Past" : "Upcoming";

  return (
    <Sheet
      title={format(d, "EEEE, MMMM d")}
      subtitle={
        <span className="flex flex-wrap items-center gap-2">
          {relative}
          {activeInjuries.map((i) => (
            <span key={i.id} className="inline-flex items-center gap-1 rounded-full bg-danger/10 px-2 py-0.5 text-xs text-danger">
              <HeartPulse className="size-3" /> {i.name}
            </span>
          ))}
        </span>
      }
      onClose={onClose}
    >
      {editing ? (
        <WorkoutForm
          key={editing === "new" ? "new" : editing.id}
          date={date}
          workout={editing === "new" ? undefined : editing}
          units={profile.units}
          injuries={injuries}
          onDone={() => setEditing(null)}
        />
      ) : (
        <div className="space-y-6">
          <section className="space-y-2">
            {workouts.map((w) => {
              const status = today ? displayStatus(w, today) : w.status;
              const meta = TYPE_META[w.type];
              const injury = injuries.find((i) => i.id === w.injuryId);
              return (
                <div key={w.id} className="rounded-xl border border-border p-3">
                  <div className="flex items-start gap-2">
                    <span className={cx("mt-1.5 size-2.5 shrink-0 rounded-full", meta.dot)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2">
                        <span className="font-medium">{w.title}</span>
                        <span
                          className={cx(
                            "rounded-full px-2 py-0.5 text-[11px] font-medium",
                            status === "needs_review" ? "bg-warn/15 text-warn" : "bg-surface-2 text-muted",
                          )}
                        >
                          {STATUS_LABEL[status]}
                        </span>
                      </div>
                      <div className="text-xs text-muted">
                        {meta.label}
                        {w.originalDate && ` · moved from ${format(parseISO(w.originalDate), "EEE MMM d")}`}
                      </div>
                      <div className="mt-2 space-y-1.5 text-sm">
                        {w.planned && (
                          <div>
                            <span className="text-xs font-medium uppercase tracking-wide text-muted">Plan</span>
                            {summarize(w.planned, profile)}
                          </div>
                        )}
                        {w.actual && (
                          <div>
                            <span className="text-xs font-medium uppercase tracking-wide text-muted">Actual</span>
                            {summarize(w.actual, profile)}
                          </div>
                        )}
                        {w.reason && <div className="text-muted">↳ {w.reason}</div>}
                        {(w.rpe != null || w.painLevel != null) && (
                          <div className="text-xs text-muted">
                            {w.rpe != null && `Effort ${w.rpe}/10`}
                            {w.rpe != null && w.painLevel != null && " · "}
                            {w.painLevel != null && `Pain ${w.painLevel}/10${injury ? ` (${injury.name})` : ""}`}
                          </div>
                        )}
                        {w.notes && <div className="whitespace-pre-wrap text-muted">{w.notes}</div>}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {w.status === "planned" && (
                      <Button
                        size="sm"
                        variant="primary"
                        disabled={pending}
                        onClick={() => start(() => logAsDoneAction(w.date, w.id))}
                      >
                        <Check className="size-3.5" /> Log as done
                      </Button>
                    )}
                    <Button size="sm" onClick={() => setEditing(w)}>
                      <Pencil className="size-3.5" /> {w.status === "planned" ? "Log / edit" : "Edit"}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={pending}
                      onClick={() => confirm(`Delete "${w.title}"?`) && start(() => deleteWorkoutAction(w.date, w.id))}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
            <Button className="w-full border-dashed" onClick={() => setEditing("new")}>
              <Plus className="size-4" /> Add workout
            </Button>
          </section>

          <DayNotes date={date} log={log} trackDrinks={profile.trackDrinks} />

          {benchmarks.length > 0 && <QuickBenchmark date={date} benchmarks={benchmarks} profile={profile} workouts={workouts} />}
        </div>
      )}
    </Sheet>
  );
}

function DayNotes({ date, log, trackDrinks }: { date: string; log?: DayLog; trackDrinks: boolean }) {
  const [notes, setNotes] = useState(log?.notes ?? "");
  const [drinks, setDrinks] = useState(log?.drinks ?? 0);
  const [pending, start] = useTransition();
  const dirty = notes !== (log?.notes ?? "") || drinks !== (log?.drinks ?? 0);

  return (
    <section className="space-y-3 border-t border-border pt-5">
      <h3 className="text-sm font-semibold">Day notes</h3>
      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Travel, wedding, sick, slept badly…"
      />
      <div className="flex items-center gap-3">
        {trackDrinks && (
          <div className="flex items-center gap-2 text-sm">
            <Wine className="size-4 text-muted" />
            <span className="text-muted">Drinks</span>
            <Button type="button" size="sm" variant="secondary" className="size-8 px-0" onClick={() => setDrinks((n) => Math.max(0, n - 0.5))}>
              <Minus className="size-3.5" />
            </Button>
            <span className="w-8 text-center font-semibold tabular-nums">{drinks}</span>
            <Button type="button" size="sm" variant="secondary" className="size-8 px-0" onClick={() => setDrinks((n) => n + 1)}>
              <Plus className="size-3.5" />
            </Button>
          </div>
        )}
        <Button
          className="ml-auto"
          size="sm"
          variant="primary"
          disabled={!dirty || pending}
          onClick={() => start(() => saveDayAction(date, notes, trackDrinks ? drinks : log?.drinks))}
        >
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </section>
  );
}

function QuickBenchmark({
  date,
  benchmarks,
  profile,
  workouts,
}: {
  date: string;
  benchmarks: BenchmarkDef[];
  profile: Profile;
  workouts: Workout[];
}) {
  const [bmId, setBmId] = useState("");
  const [value, setValue] = useState("");
  const [reps, setReps] = useState("");
  const [workoutId, setWorkoutId] = useState(workouts.length === 1 ? workouts[0].id : "");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const bm = benchmarks.find((b) => b.id === bmId);

  const label = bm ? valueLabel(bm, profile.units) : "Value";

  function save() {
    if (!bm) return;
    const v = parseValue(bm, value, profile.units);
    if (!isFinite(v) || v < 0) return setMsg("Enter a valid value");
    start(async () => {
      await addResultAction({
        benchmarkId: bm.id,
        date,
        value: v,
        reps: bm.metricKind === "weight_reps" ? Number(reps) || 1 : undefined,
        workoutId: workoutId || undefined,
      });
      setValue("");
      setReps("");
      setMsg(`Saved to ${bm.name}`);
    });
  }

  return (
    <section className="space-y-3 border-t border-border pt-5">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <Trophy className="size-4 text-muted" /> Record a benchmark
        </h3>
        <Link href="/benchmarks" className="text-xs text-muted hover:text-text">
          All benchmarks →
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Benchmark" className="col-span-2">
          <Select value={bmId} onChange={(e) => setBmId(e.target.value)}>
            <option value="">Choose…</option>
            {benchmarks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </Field>
        {bm && (
          <>
            <Field label={label} className={bm.metricKind === "weight_reps" ? "" : "col-span-2"}>
              <Input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" />
            </Field>
            {bm.metricKind === "weight_reps" && (
              <Field label="Reps">
                <Input value={reps} onChange={(e) => setReps(e.target.value)} inputMode="numeric" placeholder="1" />
              </Field>
            )}
            {workouts.length > 0 && (
              <Field label="From workout" className="col-span-2">
                <Select value={workoutId} onChange={(e) => setWorkoutId(e.target.value)}>
                  <option value="">—</option>
                  {workouts.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.title}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </>
        )}
      </div>
      <div className="flex items-center justify-end gap-3">
        {msg && <span className="text-sm text-muted">{msg}</span>}
        <Button size="sm" variant="primary" disabled={!bm || !value || pending} onClick={save}>
          Save result
        </Button>
      </div>
    </section>
  );
}
