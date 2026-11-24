"use client";

import { format, parseISO } from "date-fns";
import { HeartPulse, Repeat, X } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { saveWorkoutAction } from "@/lib/actions";
import type { RepeatInput, WorkoutInput } from "@et/core/schemas";
import {
  describeDuration,
  distanceUnit,
  formatDuration,
  formatStartTime,
  formatMinutesInput,
  intervalTotalSec,
  parseMinutesInput,
  repeatDates,
} from "@et/core/domain";
import { WORKOUT_STATUSES, WORKOUT_TYPES, type Clock, type Injury, type Routine, type Units, type Workout } from "@et/core/types";
import { activityKey, activityMeta, applyActivity, autoTitle, DISTANCE_TYPES, titleIsAuto, type ActivityKey } from "@et/core/activities";
import { DANCE_SESSIONS, DANCE_STYLES } from "@et/core/dance";
import { currentInjuries } from "@et/core/injuries";
import { findRoutineByName, sameExercises } from "@et/core/routines";
import { SPORTS, sportMeta } from "@et/core/sports";
import { startTimeIn, zoneAbbr, zoneDiffers, zonedTimeToUtc } from "@et/core/start-time";
import { STATUS_LABEL, TYPE_META } from "@et/core/workout-types";
import { Button, Field, Input, Select, Textarea, cx } from "../ui";
import { InjuryForm } from "../injuries";
import { ExerciseRows } from "./exercise-rows";
import {
  badHeartRate,
  fromDraft,
  fromExerciseDrafts,
  INTERVAL_TYPES,
  minutesField,
  toDraft,
  toExerciseDrafts,
  unreadableDurations,
  type DetailsDraft,
} from "@et/core/workout-draft";

const num = (s: string) => (s.trim() === "" || isNaN(Number(s)) ? undefined : Number(s));

/** Minutes field that also takes 87:45 / 1:27:45, with a live preview of how it was read. */
export function MinutesInput({
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
      {type === "strength" && (
        <ExerciseRows value={value.exercises} onChange={(exercises) => onChange({ ...value, exercises })} units={units} />
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Duration (min)">
          <MinutesInput
            value={value.durationMin}
            onChange={set("durationMin")}
            placeholder={total ? formatMinutesInput(total) : "45 or 87:45"}
          />
        </Field>
        {/* Only where you cover ground; still shown if an older workout already has one, so it can be cleared. */}
        {(DISTANCE_TYPES.has(type) || value.distance.trim() !== "") && (
          <Field label={`Distance (${distanceUnit(units)})`}>
            <Input inputMode="decimal" value={value.distance} onChange={set("distance")} />
          </Field>
        )}
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
                    {formatDuration(total)} of intervals · count the extra {formatDuration(gap)} as:
                  </span>
                  {(["warmupMin", "cooldownMin"] as const).map((k) => (
                    <Button
                      key={k}
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 px-1.5 text-xs text-accent-ink"
                      onClick={() => onChange({ ...value, [k]: formatMinutesInput((minutesField(value[k]) ?? 0) + gap) })}
                    >
                      {k === "warmupMin" ? "Warm-up" : "Cool-down"}
                    </Button>
                  ))}
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
  const [weeksText, setWeeksText] = useState(String(value.weeks));
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
            inputMode="numeric"
            pattern="[0-9]*"
            value={weeksText}
            onChange={(e) => {
              // Let the box be emptied while typing; only a whole number 1–52 changes the plan.
              const t = e.target.value.replace(/\D/g, "").slice(0, 2);
              setWeeksText(t);
              const n = Number(t);
              if (t && n >= 1) onChange({ ...value, weeks: Math.min(52, n) });
            }}
            onBlur={() => setWeeksText(String(value.weeks))}
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
  zone,
  clock,
  injuries,
  onDone,
  presetStatus,
  recent = [],
  routines = [],
}: {
  date: string;
  workout?: Workout;
  units: Units;
  weekStartsOn?: 0 | 1;
  /** Where the user is now, for a start time entered in another zone. */
  zone?: string;
  clock?: Clock;
  injuries: Injury[];
  onDone: () => void;
  /** Start the form on this status (e.g. "substituted" from the drawer's quick resolve). */
  presetStatus?: Workout["status"];
  /** The user's most recent activities, shown first in the picker. */
  recent?: ActivityKey[];
  /** Saved strength routines, for the Routine dropdown. */
  routines?: Routine[];
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
  // A generated title ("10 km Run") stays a placeholder, so it keeps following the details.
  const [title, setTitle] = useState(workout && !titleIsAuto(workout, units) ? workout.title : "");
  const [location, setLocation] = useState(workout?.location ?? "");
  const [startTime, setStartTime] = useState(workout?.startTime ?? "");
  // The zone the start time is in. A new one is in the zone the user is in when they save.
  const [startZone, setStartZone] = useState(workout?.startZone);
  const [day, setDay] = useState(workout?.date ?? date);
  // A new workout on a past day was most likely done, so it starts as Completed; today and later start as Planned.
  // Follows the date until the user picks a status themselves.
  const statusForDay = (d: string): Workout["status"] => (d < format(new Date(), "yyyy-MM-dd") ? "completed" : "planned");
  const [status, setStatus] = useState<Workout["status"]>(() => presetStatus ?? workout?.status ?? statusForDay(date));
  const [statusChosen, setStatusChosen] = useState(!!workout || !!presetStatus);
  const [planned, setPlanned] = useState(toDraft(workout?.planned, units));
  const [actual, setActual] = useState(toDraft(workout?.actual, units));
  const [reason, setReason] = useState(workout?.reason ?? "");
  const [pain, setPain] = useState(workout?.painLevel != null ? String(workout.painLevel) : "");
  const [injuryId, setInjuryId] = useState(workout?.injuryId ?? "");
  // Pain and injury fields only show while something is bothering you (or this workout already has them);
  // otherwise a "Something hurt?" link opens them.
  const [injuryFieldsOpen, setInjuryFieldsOpen] = useState(false);
  const [loggingInjury, setLoggingInjury] = useState(false);
  const current = currentInjuries(injuries, day);
  const injuryChoices = injuries.filter((i) => i.status !== "healed" || i.id === injuryId);
  const showInjuryFields = injuryFieldsOpen || current.length > 0 || pain.trim() !== "" || injuryId !== "";
  const [rpe, setRpe] = useState(workout?.rpe != null ? String(workout.rpe) : "");
  const [notes, setNotes] = useState(workout?.notes ?? "");
  const [repeating, setRepeating] = useState(false);
  const [repeat, setRepeat] = useState<RepeatInput>(() => ({ weekdays: [parseISO(date).getDay()], every: 1, weeks: 12 }));
  const canRepeat = !workout && status === "planned";

  const showActual = status !== "planned" && status !== "skipped" && status !== "missed";
  const showReason = status !== "planned" && status !== "completed";

  // Routine: picking one fills the exercises. It stays selected only while the list still matches it;
  // any edit makes the workout one-off and the dropdown goes back to "New routine".
  const [routineSel, setRoutineSel] = useState(workout?.routineId ?? "");
  const [saveRoutine, setSaveRoutine] = useState(false);
  const [newRoutineName, setNewRoutineName] = useState("");
  const primary = showActual ? actual : planned; // the list that's saved as a routine: what was done once logged
  const primaryExercises = fromExerciseDrafts(primary.exercises, units);
  const selectedRoutine = routines.find((r) => r.id === routineSel);
  const linkedRoutine =
    type === "strength" && selectedRoutine && sameExercises(primaryExercises, selectedRoutine.exercises) ? selectedRoutine : undefined;
  const canSaveRoutine = type === "strength" && !linkedRoutine && primaryExercises.length > 0;
  function pickRoutine(id: string) {
    setRoutineSel(id);
    const r = routines.find((x) => x.id === id);
    if (!r) return;
    const drafts = toExerciseDrafts(r.exercises, units);
    setPlanned((d) => ({ ...d, exercises: drafts }));
    setActual((d) => ({ ...d, exercises: toExerciseDrafts(r.exercises, units) }));
    setSaveRoutine(false);
  }
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
      routineName: linkedRoutine?.name ?? (canSaveRoutine && saveRoutine ? newRoutineName.trim() || undefined : undefined),
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
    const savingRoutine = canSaveRoutine && saveRoutine;
    if (savingRoutine && !newRoutineName.trim()) {
      setError("Give the routine a name to save it.");
      return;
    }
    const taken = savingRoutine ? findRoutineByName(routines, newRoutineName) : undefined;
    if (taken) {
      setError(`You already have "${taken.name}". Pick another name, or change it on the Routines tab.`);
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
      startTime: startTime || undefined,
      startZone: startTime ? (startZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone) : undefined,
      type,
      title: title.trim() || autoName,
      autoTitle: !title.trim(),
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
      ...(linkedRoutine ? { routineId: linkedRoutine.id, routineName: linkedRoutine.name } : {}),
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
        await saveWorkoutAction(
          input,
          canRepeat && repeating ? repeat : undefined,
          savingRoutine ? { name: newRoutineName.trim() } : undefined,
        );
        onDone();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save");
      }
    });
  }

  return (
    <>
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
          <Input
            type="date"
            value={day}
            onChange={(e) => {
              setDay(e.target.value);
              if (!statusChosen && /^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) setStatus(statusForDay(e.target.value));
            }}
            required
          />
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
      <div className="grid grid-cols-[minmax(0,1fr)_9.5rem] gap-3">
        <Field label="Location">
          <Input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder={type === "swim" ? "YMCA pool, open water…" : "Piedmont Park, gym, treadmill…"}
          />
        </Field>
        <Field label="Start time (optional)">
          <div className="flex items-center gap-1">
            <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="min-w-0" />
            {startTime && (
              <button
                type="button"
                onClick={() => {
                  setStartTime("");
                  setStartZone(undefined);
                }}
                aria-label="Clear start time"
                className="shrink-0 rounded-md p-1 text-muted hover:bg-surface-2 hover:text-text"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        </Field>
      </div>
      <StartZoneHint
        timed={{ date: day, startTime, startZone }}
        zone={zone}
        clock={clock}
        onSwitch={(time) => {
          setStartTime(time);
          setStartZone(zone);
        }}
      />

      <Field label="Status">
        <div className="flex flex-wrap gap-1.5">
          {WORKOUT_STATUSES.map((s) => (
            <button
              type="button"
              key={s}
              onClick={() => {
                setStatus(s);
                setStatusChosen(true);
              }}
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

      {type === "strength" && (
        <div className="space-y-2 rounded-lg border border-border p-3">
          <Field label="Routine">
            <Select value={linkedRoutine?.id ?? ""} onChange={(e) => pickRoutine(e.target.value)}>
              <option value="">New routine</option>
              {routines.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </Field>
          {canSaveRoutine && (
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={saveRoutine}
                  onChange={(e) => setSaveRoutine(e.target.checked)}
                  className="size-4 accent-[var(--accent)]"
                />
                Save as a routine
              </label>
              {saveRoutine && (
                <Input
                  value={newRoutineName}
                  onChange={(e) => setNewRoutineName(e.target.value)}
                  placeholder="Routine name, e.g. Push day"
                  aria-label="Routine name"
                  maxLength={60}
                />
              )}
            </div>
          )}
          {!routines.length && !canSaveRoutine && (
            <p className="text-xs text-muted">Add exercises below; you can save them as a routine to reuse.</p>
          )}
          {routines.length > 0 && (
            <Link href="/routines" className="inline-block text-xs font-medium text-accent-ink hover:underline">
              Edit routines →
            </Link>
          )}
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

      {showInjuryFields ? (
        <div className="space-y-1.5">
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
                {injuryChoices.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <button
            type="button"
            onClick={() => setLoggingInjury(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-muted hover:text-text"
          >
            <HeartPulse className="size-3.5" /> Log a new injury
          </button>
        </div>
      ) : (
        <div className="flex items-end gap-3">
          <Field label="Effort (1–10)" className="w-1/3">
            <Input inputMode="numeric" value={rpe} onChange={(e) => setRpe(e.target.value)} />
          </Field>
          <button
            type="button"
            onClick={() => setInjuryFieldsOpen(true)}
            className="mb-2.5 flex items-center gap-1.5 text-sm font-medium text-muted hover:text-text"
          >
            <HeartPulse className="size-4" /> Something hurt?
          </button>
        </div>
      )}

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
    {/* Outside the form: the injury dialog has a form of its own. */}
    {loggingInjury && <InjuryForm startDate={day} onClose={() => setLoggingInjury(false)} />}
    </>
  );
}

/**
 * Under the start time when it was entered in another zone: says which zone the time is in, and
 * offers to move it to the same moment where the user is now.
 */
function StartZoneHint({
  timed,
  zone,
  clock,
  onSwitch,
}: {
  timed: Pick<Workout, "date" | "startTime" | "startZone">;
  zone?: string;
  clock?: Clock;
  onSwitch: (time: string) => void;
}) {
  if (!zoneDiffers(timed, zone)) return null;
  const at = zonedTimeToUtc(timed.date, timed.startTime, timed.startZone);
  const here = startTimeIn(timed, zone!);
  return (
    <p className="-mt-2 text-xs text-muted">
      This start time is in {zoneAbbr(timed.startZone, at)}.{" "}
      {here && (
        <button type="button" className="text-accent hover:underline" onClick={() => onSwitch(here)}>
          Change to {formatStartTime(here, clock)} {zoneAbbr(zone!, at)}
        </button>
      )}
    </p>
  );
}
