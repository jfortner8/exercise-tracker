"use client";

import { format, parseISO } from "date-fns";
import { Repeat } from "lucide-react";
import { useState, useTransition } from "react";
import { saveWorkoutAction, type RepeatInput, type WorkoutInput } from "@/lib/actions";
import {
  describeDuration,
  displayToMeters,
  distanceUnit,
  formatDuration,
  formatMinutesInput,
  intervalTotalSec,
  metersToDisplay,
  parseMinutesInput,
  repeatDates,
} from "@/lib/domain";
import { WORKOUT_STATUSES, WORKOUT_TYPES, type Injury, type Units, type Workout, type WorkoutDetails } from "@/lib/types";
import { activityKey, activityMeta, applyActivity, autoTitle, type ActivityKey } from "@/lib/activities";
import { DANCE_SESSIONS, DANCE_STYLES } from "@/lib/dance";
import { SPORTS, sportMeta } from "@/lib/sports";
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
  hr: string;
}

const num = (s: string) => (s.trim() === "" || isNaN(Number(s)) ? undefined : Number(s));
const str = (n?: number, digits = 2) => (n == null ? "" : String(Math.round(n * 10 ** digits) / 10 ** digits));

function toDraft(d: WorkoutDetails | undefined, units: Units): DetailsDraft {
  return {
    durationMin: formatMinutesInput(d?.durationSec),
    distance: d?.distanceM ? str(metersToDisplay(d.distanceM, units)) : "",
    reps: str(d?.intervals?.reps, 0),
    workSec: str(d?.intervals?.workSec, 0),
    restSec: str(d?.intervals?.restSec, 0),
    warmupMin: formatMinutesInput(d?.intervals?.warmupSec),
    cooldownMin: formatMinutesInput(d?.intervals?.cooldownSec),
    description: d?.description ?? "",
    hr: str(d?.avgHeartRate, 0),
  };
}

/** Seconds from a minutes field, or undefined when it's empty or unreadable. */
const minutesField = (s: string) => {
  const v = parseMinutesInput(s);
  return v == null || Number.isNaN(v) ? undefined : v;
};

/** Heart rate must be a whole-ish number of bpm in a plausible range (or empty). */
const badHeartRate = (d: DetailsDraft) => {
  if (!d.hr.trim()) return false;
  const v = Number(d.hr);
  return !isFinite(v) || v < 30 || v > 250;
};

/** Labels of minutes fields whose text can't be read as a duration. */
function unreadableDurations(d: DetailsDraft): string[] {
  const fields: [string, string][] = [
    ["Duration", d.durationMin],
    ["Warm-up", d.warmupMin],
    ["Cool-down", d.cooldownMin],
  ];
  return fields.filter(([, v]) => Number.isNaN(parseMinutesInput(v))).map(([label]) => label);
}

function fromDraft(d: DetailsDraft, units: Units): WorkoutDetails | undefined {
  const durationSec = minutesField(d.durationMin);
  const dist = num(d.distance);
  const intervals = {
    reps: num(d.reps),
    workSec: num(d.workSec),
    restSec: num(d.restSec),
    warmupSec: minutesField(d.warmupMin),
    cooldownSec: minutesField(d.cooldownMin),
  };
  const hasIntervals = Object.values(intervals).some((v) => v != null);
  const out: WorkoutDetails = {
    durationSec,
    distanceM: dist != null ? Math.round(displayToMeters(dist, units)) : undefined,
    intervals: hasIntervals ? intervals : undefined,
    description: d.description.trim() || undefined,
    avgHeartRate: num(d.hr) != null ? Math.round(num(d.hr)!) : undefined,
  };
  return Object.values(out).some((v) => v != null) ? out : undefined;
}

/** Minutes field that also takes 87:45 / 1:27:45, with a live preview of how it was read. */
function MinutesInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (e: { target: { value: string } }) => void;
  placeholder?: string;
}) {
  const sec = parseMinutesInput(value);
  const bad = sec != null && Number.isNaN(sec);
  return (
    <>
      <Input
        inputMode="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        aria-invalid={bad || undefined}
        className={bad ? "border-danger focus:border-danger" : undefined}
      />
      {sec != null && (
        <span className={cx("text-xs", bad ? "text-danger" : "text-muted")} aria-live="polite">
          {bad ? "Can't read that. Try 45, 87:45 or 1:27:45" : `= ${describeDuration(sec)}`}
        </span>
      )}
    </>
  );
}

const INTERVAL_TYPES = new Set(["run", "walk", "swim", "bike", "row"]);

function DetailsFields({
  value,
  onChange,
  units,
  type,
  showHeartRate = false,
}: {
  value: DetailsDraft;
  onChange: (d: DetailsDraft) => void;
  units: Units;
  type: Workout["type"];
  /** Heart rate is recorded on what was actually done, not the plan. */
  showHeartRate?: boolean;
}) {
  const set = (k: keyof DetailsDraft) => (e: { target: { value: string } }) => onChange({ ...value, [k]: e.target.value });
  const [showIntervals, setShowIntervals] = useState(!!(value.reps || value.workSec));
  const total = intervalTotalSec(fromDraft(value, units)?.intervals);
  const duration = minutesField(value.durationMin);
  // Duration is the whole session; intervals are the structure inside it. Show any gap rather than forcing a match.
  const gap = total && duration ? duration - total : 0;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Duration (min)">
          <MinutesInput
            value={value.durationMin}
            onChange={set("durationMin")}
            placeholder={total ? formatMinutesInput(total) : "45 or 87:45"}
          />
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
          {total && duration ? (
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              {gap > 0 ? (
                <>
                  <span className="text-muted">
                    {formatDuration(total)} of intervals · {formatDuration(gap)} outside them
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-6 px-1.5 text-xs text-accent-ink"
                    onClick={() =>
                      onChange({ ...value, cooldownMin: formatMinutesInput((minutesField(value.cooldownMin) ?? 0) + gap) })
                    }
                  >
                    Count as cool-down
                  </Button>
                </>
              ) : gap < 0 ? (
                <span className="text-warn">Intervals add up to more than the duration ({formatDuration(duration)})</span>
              ) : (
                <span className="text-muted">Matches duration ✓</span>
              )}
            </div>
          ) : null}
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
                <MinutesInput value={value.warmupMin} onChange={set("warmupMin")} />
              </Field>
              <Field label="Cool-down (min)">
                <MinutesInput value={value.cooldownMin} onChange={set("cooldownMin")} />
              </Field>
            </div>
          )}
        </div>
      )}
      {showHeartRate && (
        <Field label="Avg heart rate (bpm)" className="w-1/2 pr-1.5">
          <Input
            inputMode="numeric"
            value={value.hr}
            onChange={set("hr")}
            placeholder="e.g. 142"
            aria-invalid={badHeartRate(value) || undefined}
            className={badHeartRate(value) ? "border-danger" : undefined}
          />
        </Field>
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

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "Repeat weekly" for a new planned workout: which weekdays, how often, for how long. */
function RepeatFields({
  start,
  value,
  onChange,
  weekStartsOn,
}: {
  start: string;
  value: RepeatInput;
  onChange: (v: RepeatInput) => void;
  weekStartsOn: 0 | 1;
}) {
  const order = Array.from({ length: 7 }, (_, i) => (i + weekStartsOn) % 7);
  const toggle = (d: number) =>
    onChange({ ...value, weekdays: value.weekdays.includes(d) ? value.weekdays.filter((x) => x !== d) : [...value.weekdays, d] });
  const dates = /^\d{4}-\d{2}-\d{2}$/.test(start) && value.weekdays.length ? repeatDates(start, value.weekdays, value.every, value.weeks, weekStartsOn) : [];
  const show = (s: string) => format(parseISO(s), "EEE MMM d");
  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="grid grid-cols-7 gap-1" role="group" aria-label="Repeat on">
        {order.map((d) => (
          <button
            type="button"
            key={d}
            aria-pressed={value.weekdays.includes(d)}
            onClick={() => toggle(d)}
            className={cx(
              "rounded-md border py-1.5 text-xs font-medium",
              value.weekdays.includes(d) ? "border-accent bg-accent/10 text-accent-ink" : "border-border text-muted hover:text-text",
            )}
          >
            {WEEKDAY_LABELS[d]}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="How often">
          <Select value={value.every} onChange={(e) => onChange({ ...value, every: Number(e.target.value) })}>
            <option value={1}>Every week</option>
            <option value={2}>Every 2 weeks</option>
            <option value={3}>Every 3 weeks</option>
            <option value={4}>Every 4 weeks</option>
          </Select>
        </Field>
        <Field label="For how many weeks">
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={52}
            value={value.weeks}
            onChange={(e) => onChange({ ...value, weeks: Math.min(52, Math.max(1, Math.floor(Number(e.target.value) || 1))) })}
          />
        </Field>
      </div>
      <p className="text-xs text-muted" aria-live="polite">
        {!value.weekdays.length
          ? "Pick at least one day."
          : !dates.length
            ? "None of those days fall in that range."
            : dates.length === 1
              ? `Adds 1 workout · ${show(dates[0])}`
              : `Adds ${dates.length} workouts · ${show(dates[0])} – ${show(dates.at(-1)!)}`}
      </p>
    </div>
  );
}

export function WorkoutForm({
  date,
  workout,
  units,
  weekStartsOn = 1,
  injuries,
  onDone,
  presetStatus,
  recent = [],
}: {
  date: string;
  workout?: Workout;
  units: Units;
  weekStartsOn?: 0 | 1;
  injuries: Injury[];
  onDone: () => void;
  /** Start the form on this status (e.g. "substituted" from the drawer's quick resolve). */
  presetStatus?: Workout["status"];
  /** The user's most recent activities, shown first in the picker. */
  recent?: ActivityKey[];
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<Workout["type"]>(workout?.type ?? "run");
  const [sport, setSport] = useState(workout?.sport ?? "");
  const [sportName, setSportName] = useState(workout?.sportName ?? "");
  const [sportSession, setSportSession] = useState(workout?.sportSession ?? "");
  const [danceStyle, setDanceStyle] = useState(workout?.danceStyle ?? "");
  const [danceStyleName, setDanceStyleName] = useState(workout?.danceStyleName ?? "");
  const [danceSession, setDanceSession] = useState(workout?.danceSession ?? "");
  const sportDef = type === "sport" ? sportMeta(sport) : undefined;
  // The picker shows a recent sport as its own option; otherwise it shows the plain type.
  const currentKey = activityKey({ type, sport });
  const pickerValue = recent.includes(currentKey) ? currentKey : type;

  function chooseActivity(key: ActivityKey) {
    const next = applyActivity(key);
    setType(next.type);
    if (next.sport && next.sport !== sport) {
      setSport(next.sport);
      setSportSession("");
    }
  }
  const [title, setTitle] = useState(workout?.title ?? "");
  const [location, setLocation] = useState(workout?.location ?? "");
  const [day, setDay] = useState(workout?.date ?? date);
  const [status, setStatus] = useState<Workout["status"]>(presetStatus ?? workout?.status ?? "planned");
  const [planned, setPlanned] = useState(toDraft(workout?.planned, units));
  const [actual, setActual] = useState(toDraft(workout?.actual, units));
  const [reason, setReason] = useState(workout?.reason ?? "");
  const [pain, setPain] = useState(workout?.painLevel != null ? String(workout.painLevel) : "");
  const [injuryId, setInjuryId] = useState(workout?.injuryId ?? "");
  const [rpe, setRpe] = useState(workout?.rpe != null ? String(workout.rpe) : "");
  const [notes, setNotes] = useState(workout?.notes ?? "");
  const [repeating, setRepeating] = useState(false);
  const [repeat, setRepeat] = useState<RepeatInput>(() => ({ weekdays: [parseISO(date).getDay()], every: 1, weeks: 12 }));
  const canRepeat = !workout && status === "planned";

  const showActual = status !== "planned" && status !== "skipped" && status !== "missed";
  const showReason = status !== "planned" && status !== "completed";
  // What the title becomes if left blank, from the choices so far: "10 km Run", "Roller Derby Bout".
  const autoName = autoTitle(
    {
      type,
      sport,
      sportName,
      sportSession,
      danceStyle,
      danceStyleName,
      danceSession,
      status,
      planned: fromDraft(planned, units),
      actual: showActual ? fromDraft(actual, units) : undefined,
    },
    units,
  );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (showActual && badHeartRate(actual)) {
      setError("Heart rate should be a number of beats per minute between 30 and 250.");
      return;
    }
    if (type === "sport" && sport === "other" && !sportName.trim()) {
      setError("Name the sport (or pick one from the list).");
      return;
    }
    if (canRepeat && repeating && !repeat.weekdays.length) {
      setError("Pick at least one day to repeat on.");
      return;
    }
    const bad = [...unreadableDurations(planned), ...(showActual ? unreadableDurations(actual) : [])];
    if (bad.length) {
      setError(`Can't read ${[...new Set(bad)].join(", ").toLowerCase()}. Use minutes (45) or a time (87:45, 1:27:45).`);
      return;
    }
    const input: WorkoutInput = {
      id: workout?.id,
      originalDate: workout?.date,
      date: day,
      type,
      title: title.trim() || autoName,
      location: location.trim() || undefined,
      ...(type === "sport"
        ? {
            sport: sport || undefined,
            sportName: sport === "other" ? sportName.trim() || undefined : undefined,
            sportSession: sportSession || undefined,
          }
        : {}),
      ...(type === "dance"
        ? {
            danceStyle: danceStyle || undefined,
            danceStyleName: danceStyle === "other" ? danceStyleName.trim() || undefined : undefined,
            danceSession: danceSession || undefined,
          }
        : {}),
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
        await saveWorkoutAction(input, canRepeat && repeating ? repeat : undefined);
        onDone();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save");
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Activity">
          <Select value={pickerValue} onChange={(e) => chooseActivity(e.target.value)}>
            {recent.length > 0 && (
              <optgroup label="Recent">
                {recent.map((k) => (
                  <option key={`recent-${k}`} value={k}>
                    {activityMeta(k).emoji} {activityMeta(k).label}
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label="All activities">
              {WORKOUT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_META[t].emoji} {TYPE_META[t].label}
                </option>
              ))}
            </optgroup>
          </Select>
        </Field>
        <Field label="Date">
          <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} required />
        </Field>
      </div>
      {type === "sport" && (
        <div className="space-y-3 rounded-lg border border-border p-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Which sport" className={sport === "other" ? "" : "col-span-2"}>
              <Select
                value={sport}
                onChange={(e) => {
                  setSport(e.target.value);
                  setSportSession("");
                }}
              >
                <option value="">Choose…</option>
                {SPORTS.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.emoji} {s.label}
                  </option>
                ))}
              </Select>
            </Field>
            {sport === "other" && (
              <Field label="Sport name">
                <Input value={sportName} onChange={(e) => setSportName(e.target.value)} placeholder="Squash, padel…" />
              </Field>
            )}
          </div>
          {sportDef && (
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Session">
              {sportDef.sessions.map((s) => (
                <button
                  type="button"
                  key={s.key}
                  role="radio"
                  aria-checked={sportSession === s.key}
                  // Tap again to clear.
                  onClick={() => setSportSession(sportSession === s.key ? "" : s.key)}
                  className={cx(
                    "rounded-full border px-3 py-1 text-xs font-medium",
                    sportSession === s.key ? "border-accent bg-accent/10 text-accent-ink" : "border-border text-muted hover:text-text",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {type === "dance" && (
        <div className="space-y-3 rounded-lg border border-border p-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Style (optional)" className={danceStyle === "other" ? "" : "col-span-2"}>
              <Select value={danceStyle} onChange={(e) => setDanceStyle(e.target.value)}>
                <option value="">Any / not set</option>
                {DANCE_STYLES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </Field>
            {danceStyle === "other" && (
              <Field label="Style name">
                <Input value={danceStyleName} onChange={(e) => setDanceStyleName(e.target.value)} placeholder="Reggaeton, voguing…" />
              </Field>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Dance session">
            {DANCE_SESSIONS.map((s) => (
              <button
                type="button"
                key={s.key}
                role="radio"
                aria-checked={danceSession === s.key}
                // Tap again to clear.
                onClick={() => setDanceSession(danceSession === s.key ? "" : s.key)}
                className={cx(
                  "rounded-full border px-3 py-1 text-xs font-medium",
                  danceSession === s.key ? "border-accent bg-accent/10 text-accent-ink" : "border-border text-muted hover:text-text",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}
      <Field label="Title">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={autoName}
          autoFocus={!workout}
        />
      </Field>
      <Field label="Location">
        <Input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder={type === "swim" ? "YMCA pool, open water…" : "Piedmont Park, gym, treadmill…"}
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
                status === s ? "border-accent bg-accent/10 text-accent-ink" : "border-border text-muted hover:text-text",
              )}
            >
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </Field>

      {canRepeat && (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={repeating} onChange={(e) => {
                setRepeating(e.target.checked);
                // Start from the chosen date's weekday unless several days were already picked.
                if (e.target.checked && repeat.weekdays.length <= 1 && /^\d{4}-\d{2}-\d{2}$/.test(day))
                  setRepeat({ ...repeat, weekdays: [parseISO(day).getDay()] });
              }} className="size-4 accent-[var(--accent)]" />
            <Repeat className="size-4 text-muted" /> Repeat weekly
          </label>
          {repeating && <RepeatFields start={day} value={repeat} onChange={setRepeat} weekStartsOn={weekStartsOn} />}
        </div>
      )}

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
          <DetailsFields value={actual} onChange={setActual} units={units} type={type} showHeartRate />
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
          {pending ? "Saving…" : workout ? "Save changes" : canRepeat && repeating ? "Add workouts" : "Add workout"}
        </Button>
      </div>
    </form>
  );
}
