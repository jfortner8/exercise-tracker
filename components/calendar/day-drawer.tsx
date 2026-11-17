"use client";

import { format, parseISO } from "date-fns";
import { Ban, Check, HeartPulse, MapPin, Minus, Moon, Repeat, Scale, Star, X, Pencil, Plus, Trash2, Trophy, Wine } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import {
  addResultAction,
  deleteSeriesFromAction,
  deleteWorkoutAction,
  logAsDoneAction,
  markRestDayAction,
  resolveWorkoutAction,
  saveDayAction,
} from "@/lib/actions";
import { isClock, parseValue, valueLabel } from "@/lib/benchmarks/input";
import { ClockInput } from "../clock-input";
import { workoutCategory, type ActivityKey } from "@/lib/activities";
import { suggestLink } from "@/lib/benchmarks/linking";
import {
  describeIntervals,
  detailsDurationSec,
  displayStatus,
  displayToKg,
  formatDistance,
  formatDuration,
  formatResult,
  kgToDisplay,
  weightUnit,
} from "@/lib/domain";
import type { BenchmarkDef, DayLog, DayResult, Injury, Profile, Workout, WorkoutDetails } from "@/lib/types";
import { STATUS_LABEL } from "@/lib/workout-types";
import { Sheet } from "../sheet";
import { Button, Field, Input, Select, Textarea, cx } from "../ui";
import { WorkoutLinkField } from "../benchmarks/workout-link-field";
import { WorkoutForm } from "../workouts/workout-form";

function summarize(d: WorkoutDetails | undefined, profile: Profile) {
  if (!d) return null;
  const parts: string[] = [];
  const iv = describeIntervals(d.intervals);
  if (iv) parts.push(iv);
  const dur = detailsDurationSec(d);
  if (dur) parts.push(formatDuration(dur));
  if (d.distanceM) parts.push(formatDistance(d.distanceM, profile.units));
  if (d.avgHeartRate) parts.push(`${d.avgHeartRate} bpm`);
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
  missed,
  benchmarks,
  results,
  recent,
  profile,
  onClose,
}: {
  date: string;
  today: string;
  workouts: Workout[];
  log?: DayLog;
  injuries: Injury[];
  activeInjuries: Injury[];
  /** Empty past day that counts as a miss. */
  missed: boolean;
  benchmarks: BenchmarkDef[];
  /** This day's benchmark results. */
  results: DayResult[];
  /** Most recent activities, offered first in the workout form. */
  recent: ActivityKey[];
  profile: Profile;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState<Workout | "new" | null>(null);
  const [preset, setPreset] = useState<Workout["status"] | undefined>();
  const [skipping, setSkipping] = useState<string | null>(null); // workout id with the reason field open
  const [skipReason, setSkipReason] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null); // repeating workout id with the delete choice open
  const edit = (w: Workout | "new" | null, status?: Workout["status"]) => {
    setPreset(status);
    setEditing(w);
  };
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
          weekStartsOn={profile.weekStartsOn}
          injuries={injuries}
          presetStatus={preset}
          recent={recent}
          onDone={() => edit(null)}
        />
      ) : (
        <div className="space-y-6">
          <DayNotes date={date} log={log} profile={profile} />

          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Workouts</h3>
            {workouts.map((w) => {
              const status = today ? displayStatus(w, today) : w.status;
              const cat = workoutCategory(w);
              const injury = injuries.find((i) => i.id === w.injuryId);
              return (
                <div key={w.id} className="rounded-xl border border-border p-3">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 shrink-0 text-base leading-none" aria-hidden>
                      {cat.emoji}
                    </span>
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
                        {cat.label}
                        {w.location && (
                          <>
                            {" · "}
                            <MapPin className="inline size-3 -translate-y-px" aria-hidden />
                            {" "}
                            {w.location}
                          </>
                        )}
                        {w.originalDate && ` · moved from ${format(parseISO(w.originalDate), "EEE MMM d")}`}
                        {w.seriesId && (
                          <>
                            {" · "}
                            <Repeat className="inline size-3 -translate-y-px" aria-hidden /> repeating
                          </>
                        )}
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
                        <ResultList results={results.filter((r) => r.workoutId === w.id)} profile={profile} />
                      </div>
                    </div>
                  </div>
                  {status === "needs_review" && (
                    <div className="mt-3 space-y-2 rounded-lg bg-warn/10 p-2">
                      <div className="text-xs font-medium text-text">How did it go?</div>
                      {skipping === w.id ? (
                        <form
                          className="flex gap-1.5"
                          onSubmit={(e) => {
                            e.preventDefault();
                            start(async () => {
                              await resolveWorkoutAction(w.date, w.id, "skipped", skipReason);
                              setSkipping(null);
                              setSkipReason("");
                            });
                          }}
                        >
                          <Input
                            autoFocus
                            value={skipReason}
                            onChange={(e) => setSkipReason(e.target.value)}
                            placeholder="Why? Sick, travel, wedding…"
                            className="h-8 flex-1 text-sm"
                            required
                          />
                          <Button size="sm" type="submit" variant="primary" disabled={pending || !skipReason.trim()}>
                            Save
                          </Button>
                          <Button size="sm" type="button" variant="ghost" onClick={() => setSkipping(null)}>
                            <X className="size-3.5" />
                          </Button>
                        </form>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          <Button
                            size="sm"
                            variant="primary"
                            disabled={pending}
                            onClick={() => start(() => resolveWorkoutAction(w.date, w.id, "completed"))}
                          >
                            <Check className="size-3.5" /> Done as planned
                          </Button>
                          <Button size="sm" onClick={() => edit(w, "substituted")}>
                            <Repeat className="size-3.5" /> Did something else…
                          </Button>
                          <Button size="sm" onClick={() => setSkipping(w.id)}>
                            Skipped…
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            disabled={pending}
                            onClick={() => start(() => resolveWorkoutAction(w.date, w.id, "missed"))}
                          >
                            <Ban className="size-3.5" /> Missed
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {status === "planned" && (
                      <Button
                        size="sm"
                        variant="primary"
                        disabled={pending}
                        onClick={() => start(() => logAsDoneAction(w.date, w.id))}
                      >
                        <Check className="size-3.5" /> Log as done
                      </Button>
                    )}
                    <Button size="sm" onClick={() => edit(w)}>
                      <Pencil className="size-3.5" /> {status === "planned" ? "Log / edit" : "Edit"}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={pending}
                      aria-label="Delete"
                      onClick={() =>
                        w.seriesId
                          ? setDeleting(deleting === w.id ? null : w.id)
                          : confirm(`Delete "${w.title}"?`) && start(() => deleteWorkoutAction(w.date, w.id))
                      }
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                  {deleting === w.id && (
                    <div className="mt-2 space-y-2 rounded-lg bg-danger/10 p-2">
                      <div className="text-xs font-medium text-text">Delete this repeating workout?</div>
                      <div className="flex flex-wrap gap-1.5">
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={pending}
                          onClick={() => start(async () => { await deleteWorkoutAction(w.date, w.id); setDeleting(null); })}
                        >
                          Just this one
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={pending}
                          onClick={() => start(async () => { await deleteSeriesFromAction(w.date, w.id); setDeleting(null); })}
                        >
                          This and later planned ones
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setDeleting(null)}>
                          Cancel
                        </Button>
                      </div>
                      <p className="text-xs text-muted">Ones you&apos;ve already logged are kept.</p>
                    </div>
                  )}
                </div>
              );
            })}
            {workouts.length === 0 ? (
              <>
                {missed && <p className="text-sm text-danger">Nothing was planned or logged for this day.</p>}
                <div className="grid grid-cols-2 gap-2">
                  <Button className="border-dashed" onClick={() => edit("new")}>
                    <Plus className="size-4" /> Add a workout
                  </Button>
                  <Button
                    className="border-dashed"
                    disabled={pending || !today}
                    onClick={() => start(() => markRestDayAction(date, today))}
                  >
                    <Moon className="size-4" /> Mark as rest day
                  </Button>
                </div>
              </>
            ) : (
              <Button className="w-full border-dashed" onClick={() => edit("new")}>
                <Plus className="size-4" /> Add workout
              </Button>
            )}
          </section>

          <DayResults
            results={results.filter((r) => !r.workoutId || !workouts.some((w) => w.id === r.workoutId))}
            profile={profile}
          />

          {benchmarks.length > 0 && <QuickBenchmark date={date} benchmarks={benchmarks} profile={profile} workouts={workouts} />}
        </div>
      )}
    </Sheet>
  );
}

function DayNotes({ date, log, profile }: { date: string; log?: DayLog; profile: Profile }) {
  const { trackDrinks, trackWeight, units } = profile;
  const savedWeight = log?.weightKg != null ? String(Math.round(kgToDisplay(log.weightKg, units) * 10) / 10) : "";
  const [notes, setNotes] = useState(log?.notes ?? "");
  const [drinks, setDrinks] = useState(log?.drinks ?? 0);
  const [weight, setWeight] = useState(savedWeight);
  const [pending, start] = useTransition();
  const weightNum = weight.trim() === "" ? null : Number(weight);
  const weightBad = weightNum != null && (!isFinite(weightNum) || weightNum <= 0);
  const dirty = notes !== (log?.notes ?? "") || drinks !== (log?.drinks ?? 0) || weight !== savedWeight;

  return (
    // First section of the drawer: no divider above it, since the sheet header already has one.
    <section className="space-y-3">
      <h3 className="text-sm font-semibold">Day notes</h3>
      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Travel, wedding, sick, slept badly…"
      />
      <div className="flex flex-wrap items-center gap-3">
        {trackWeight && (
          <label className="flex items-center gap-2 text-sm">
            <Scale className="size-4 text-muted" />
            <span className="text-muted">Weight</span>
            <Input
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              inputMode="decimal"
              placeholder="—"
              aria-invalid={weightBad || undefined}
              className={cx("h-8 w-20 text-sm", weightBad && "border-danger")}
            />
            <span className="text-muted">{weightUnit(units)}</span>
          </label>
        )}
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
          disabled={!dirty || pending || weightBad}
          onClick={() =>
            start(() =>
              saveDayAction(date, {
                notes,
                // Only send what's shown, so hidden fields keep their saved values.
                ...(trackDrinks ? { drinks } : {}),
                ...(trackWeight ? { weightKg: weightNum == null ? null : displayToKg(weightNum, units) } : {}),
              }),
            )
          }
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
  const [workoutId, setWorkoutId] = useState("");
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
          <Select
            value={bmId}
            onChange={(e) => {
              setBmId(e.target.value);
              // Pre-select the workout this result most likely came from.
              const next = benchmarks.find((b) => b.id === e.target.value);
              setWorkoutId(next ? (suggestLink(next, workouts, profile.units)?.id ?? "") : "");
            }}
          >
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
              {isClock(bm) ? (
                <ClockInput value={value} onChange={setValue} />
              ) : (
                <Input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" />
              )}
            </Field>
            {bm.metricKind === "weight_reps" && (
              <Field label="Reps">
                <Input value={reps} onChange={(e) => setReps(e.target.value)} inputMode="numeric" placeholder="1" />
              </Field>
            )}
            <WorkoutLinkField
              def={bm}
              workouts={workouts}
              units={profile.units}
              value={workoutId}
              onChange={setWorkoutId}
              className="col-span-2"
            />
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

/** Benchmark results as compact rows; PBs get a gold star. */
function ResultList({ results, profile }: { results: DayResult[]; profile: Profile }) {
  if (!results.length) return null;
  return (
    <ul className="space-y-1">
      {results.map((r) => (
        <li key={r.id}>
          <Link
            href={`/benchmarks/${r.benchmarkId}`}
            className="flex items-center gap-1.5 rounded-md text-sm hover:underline"
          >
            <Star className={cx("size-3.5 shrink-0", r.isPb ? "fill-amber-400 text-amber-500" : "text-muted")} />
            <span className="font-medium">{r.benchmarkName}</span>
            <span className="tabular-nums">{formatResult(r, r, profile.units)}</span>
            {r.isPb && (
              <span className="rounded-full bg-amber-400/15 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                New PB
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Results logged for this day that aren't attached to one of its workouts (e.g. from the Benchmarks tab). */
function DayResults({ results, profile }: { results: DayResult[]; profile: Profile }) {
  if (!results.length) return null;
  return (
    <section className="space-y-2 border-t border-border pt-5">
      <h3 className="text-sm font-semibold">Benchmarks</h3>
      <ResultList results={results} profile={profile} />
    </section>
  );
}
