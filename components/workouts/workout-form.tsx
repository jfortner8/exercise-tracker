"use client";

import { useState, useTransition } from "react";
import { saveWorkoutAction, type WorkoutInput } from "@/lib/actions";
import {
  displayToMeters,
  distanceUnit,
  formatDuration,
  intervalTotalSec,
  metersToDisplay,
} from "@/lib/domain";
import { WORKOUT_STATUSES, WORKOUT_TYPES, type Injury, type Units, type Workout, type WorkoutDetails } from "@/lib/types";
import { STATUS_LABEL, TYPE_META } from "@/lib/workout-types";
import { Button, Field, Input, Select, Textarea, cx } from "../ui";

/** Form-friendly representation of WorkoutDetails (strings, display units). */
interface DetailsDraft {
  durationMin: string;
  distance: string;
  reps: string;
  workSec: string;
  restSec: string;
  warmupMin: string;
  cooldownMin: string;
  description: string;
}

const num = (s: string) => (s.trim() === "" || isNaN(Number(s)) ? undefined : Number(s));
const str = (n?: number, digits = 2) => (n == null ? "" : String(Math.round(n * 10 ** digits) / 10 ** digits));

function toDraft(d: WorkoutDetails | undefined, units: Units): DetailsDraft {
  return {
    durationMin: d?.durationSec ? str(d.durationSec / 60, 1) : "",
    distance: d?.distanceM ? str(metersToDisplay(d.distanceM, units)) : "",
    reps: str(d?.intervals?.reps, 0),
    workSec: str(d?.intervals?.workSec, 0),
    restSec: str(d?.intervals?.restSec, 0),
    warmupMin: d?.intervals?.warmupSec ? str(d.intervals.warmupSec / 60, 1) : "",
    cooldownMin: d?.intervals?.cooldownSec ? str(d.intervals.cooldownSec / 60, 1) : "",
    description: d?.description ?? "",
  };
}

function fromDraft(d: DetailsDraft, units: Units): WorkoutDetails | undefined {
  const min = num(d.durationMin);
  const dist = num(d.distance);
  const intervals = {
    reps: num(d.reps),
    workSec: num(d.workSec),
    restSec: num(d.restSec),
    warmupSec: num(d.warmupMin) != null ? num(d.warmupMin)! * 60 : undefined,
    cooldownSec: num(d.cooldownMin) != null ? num(d.cooldownMin)! * 60 : undefined,
  };
  const hasIntervals = Object.values(intervals).some((v) => v != null);
  const out: WorkoutDetails = {
    durationSec: min != null ? Math.round(min * 60) : undefined,
    distanceM: dist != null ? Math.round(displayToMeters(dist, units)) : undefined,
    intervals: hasIntervals ? intervals : undefined,
    description: d.description.trim() || undefined,
  };
  return Object.values(out).some((v) => v != null) ? out : undefined;
}

const INTERVAL_TYPES = new Set(["run", "walk", "swim", "bike"]);

function DetailsFields({
  value,
  onChange,
  units,
  type,
}: {
  value: DetailsDraft;
  onChange: (d: DetailsDraft) => void;
  units: Units;
  type: Workout["type"];
}) {
  const set = (k: keyof DetailsDraft) => (e: { target: { value: string } }) => onChange({ ...value, [k]: e.target.value });
  const [showIntervals, setShowIntervals] = useState(!!(value.reps || value.workSec));
  const total = intervalTotalSec(fromDraft(value, units)?.intervals);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Duration (min)">
          <Input inputMode="decimal" value={value.durationMin} onChange={set("durationMin")} placeholder={total ? String(Math.round(total / 60)) : ""} />
        </Field>
        <Field label={`Distance (${distanceUnit(units)})`}>
          <Input inputMode="decimal" value={value.distance} onChange={set("distance")} />
        </Field>
      </div>
      {(INTERVAL_TYPES.has(type) || showIntervals) && (
        <div className="rounded-lg border border-border p-3">
          <button
            type="button"
            className="flex w-full items-center justify-between text-sm font-medium"
            onClick={() => setShowIntervals((s) => !s)}
          >
            Intervals
            <span className="text-xs font-normal text-muted">
              {total ? `${formatDuration(total)} total` : showIntervals ? "Hide" : "Add"}
            </span>
          </button>
          {showIntervals && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Field label="Reps">
                <Input inputMode="numeric" value={value.reps} onChange={set("reps")} placeholder="17" />
              </Field>
              <Field label="Work (sec)">
                <Input inputMode="numeric" value={value.workSec} onChange={set("workSec")} placeholder="126" />
              </Field>
              <Field label="Rest (sec)">
                <Input inputMode="numeric" value={value.restSec} onChange={set("restSec")} placeholder="30" />
              </Field>
              <Field label="Warm-up (min)">
                <Input inputMode="decimal" value={value.warmupMin} onChange={set("warmupMin")} />
              </Field>
              <Field label="Cool-down (min)">
                <Input inputMode="decimal" value={value.cooldownMin} onChange={set("cooldownMin")} />
              </Field>
            </div>
          )}
        </div>
      )}
      <Field label="Details">
        <Textarea
          rows={2}
          value={value.description}
          onChange={set("description")}
          placeholder={type === "strength" ? "e.g. Bulgarian split squats 3×8, lat pulldown 3×10" : "Anything else worth noting"}
        />
      </Field>
    </div>
  );
}

export function WorkoutForm({
  date,
  workout,
  units,
  injuries,
  onDone,
}: {
  date: string;
  workout?: Workout;
  units: Units;
  injuries: Injury[];
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<Workout["type"]>(workout?.type ?? "run");
  const [title, setTitle] = useState(workout?.title ?? "");
  const [day, setDay] = useState(workout?.date ?? date);
  const [status, setStatus] = useState<Workout["status"]>(workout?.status ?? "planned");
  const [planned, setPlanned] = useState(toDraft(workout?.planned, units));
  const [actual, setActual] = useState(toDraft(workout?.actual, units));
  const [reason, setReason] = useState(workout?.reason ?? "");
  const [pain, setPain] = useState(workout?.painLevel != null ? String(workout.painLevel) : "");
  const [injuryId, setInjuryId] = useState(workout?.injuryId ?? "");
  const [rpe, setRpe] = useState(workout?.rpe != null ? String(workout.rpe) : "");
  const [notes, setNotes] = useState(workout?.notes ?? "");

  const showActual = status !== "planned" && status !== "skipped" && status !== "missed";
  const showReason = status !== "planned" && status !== "completed";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const input: WorkoutInput = {
      id: workout?.id,
      originalDate: workout?.date,
      date: day,
      type,
      title: title.trim() || TYPE_META[type].label,
      status,
      planned: fromDraft(planned, units),
      actual: showActual ? fromDraft(actual, units) : undefined,
      reason: showReason ? reason.trim() || undefined : undefined,
      painLevel: num(pain),
      injuryId: injuryId || undefined,
      rpe: num(rpe),
      notes: notes.trim() || undefined,
    };
    start(async () => {
      try {
        await saveWorkoutAction(input);
        onDone();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save");
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type">
          <Select value={type} onChange={(e) => setType(e.target.value as Workout["type"])}>
            {WORKOUT_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_META[t].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Date">
          <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} required />
        </Field>
      </div>
      <Field label="Title">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={type === "run" ? "Easy run, Long run, 5K benchmark…" : TYPE_META[type].label}
          autoFocus={!workout}
        />
      </Field>

      <Field label="Status">
        <div className="flex flex-wrap gap-1.5">
          {WORKOUT_STATUSES.map((s) => (
            <button
              type="button"
              key={s}
              onClick={() => setStatus(s)}
              className={cx(
                "rounded-full border px-2.5 py-1 text-xs font-medium",
                status === s ? "border-accent bg-accent/10 text-accent" : "border-border text-muted hover:text-text",
              )}
            >
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </Field>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Plan</h3>
        <DetailsFields value={planned} onChange={setPlanned} units={units} type={type} />
      </section>

      {showActual && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">What you actually did</h3>
            <Button type="button" size="sm" variant="ghost" onClick={() => setActual(planned)}>
              Same as plan
            </Button>
          </div>
          <DetailsFields value={actual} onChange={setActual} units={units} type={type} />
        </section>
      )}

      {showReason && (
        <Field label={status === "substituted" ? "What you did instead / why" : "Why?"}>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Wedding, ankle pain, travel…" />
        </Field>
      )}

      <div className="grid grid-cols-3 gap-3">
        <Field label="Effort (1–10)">
          <Input inputMode="numeric" value={rpe} onChange={(e) => setRpe(e.target.value)} />
        </Field>
        <Field label="Pain (0–10)">
          <Input inputMode="numeric" value={pain} onChange={(e) => setPain(e.target.value)} />
        </Field>
        <Field label="Injury">
          <Select value={injuryId} onChange={(e) => setInjuryId(e.target.value)}>
            <option value="">None</option>
            {injuries.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Notes">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Heart rate was high, felt great…" />
      </Field>

      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex justify-end gap-2 pb-2">
        <Button type="button" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : workout ? "Save changes" : "Add workout"}
        </Button>
      </div>
    </form>
  );
}
