/*
 * A workout as a form holds it: strings, in the user's units. Shared by the website's workout form
 * and the phone app's, so both read "87:45" or "135 lb" the same way and save the same thing.
 */
import { displayToKg, displayToMeters, formatMinutesInput, kgToDisplay, metersToDisplay, parseMinutesInput } from "./domain";
import type { Exercise, Units, WorkoutDetails } from "./types";

/** An exercise as typed: strings, weight in the user's unit. */
export interface ExerciseDraft {
  name: string;
  sets: string;
  reps: string;
  weight: string;
}

export const blankExercise = (): ExerciseDraft => ({ name: "", sets: "", reps: "", weight: "" });

export function toExerciseDrafts(list: Exercise[] | undefined, units: Units): ExerciseDraft[] {
  return (list ?? []).map((e) => ({
    name: e.name,
    sets: e.sets ? String(e.sets) : "",
    reps: e.reps ?? "",
    weight: e.weightKg ? String(Math.round(kgToDisplay(e.weightKg, units) * 10) / 10) : "",
  }));
}

/** Rows with a name, as Exercises; unreadable numbers are left out. */
export function fromExerciseDrafts(drafts: ExerciseDraft[], units: Units): Exercise[] {
  const n = (s: string) => (s.trim() && isFinite(Number(s)) && Number(s) > 0 ? Number(s) : undefined);
  return drafts
    .filter((d) => d.name.trim())
    .map((d) => {
      const sets = n(d.sets);
      const weight = n(d.weight);
      return {
        name: d.name.trim(),
        ...(sets ? { sets: Math.round(sets) } : {}),
        ...(d.reps.trim() ? { reps: d.reps.trim() } : {}),
        // Stored in kg to the gram, so 135 lb reads back as 135.
        ...(weight ? { weightKg: Math.round(displayToKg(weight, units) * 1000) / 1000 } : {}),
      };
    });
}

/** WorkoutDetails as a form holds them (strings, display units). */
export interface DetailsDraft {
  durationMin: string;
  distance: string;
  reps: string;
  workSec: string;
  restSec: string;
  warmupMin: string;
  cooldownMin: string;
  description: string;
  hr: string;
  exercises: ExerciseDraft[];
}

const num = (s: string) => (s.trim() === "" || isNaN(Number(s)) ? undefined : Number(s));
const str = (n?: number, digits = 2) => (n == null ? "" : String(Math.round(n * 10 ** digits) / 10 ** digits));

/** Activities whose plan can have intervals (reps of work and rest). */
export const INTERVAL_TYPES = new Set(["run", "walk", "swim", "bike", "row"]);

export function toDraft(d: WorkoutDetails | undefined, units: Units): DetailsDraft {
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
    exercises: toExerciseDrafts(d?.exercises, units),
  };
}

/** Seconds from a minutes field ("45", "87:45", "1:27:45"), or undefined when it's empty or unreadable. */
export const minutesField = (s: string) => {
  const v = parseMinutesInput(s);
  return v == null || Number.isNaN(v) ? undefined : v;
};

/** Heart rate must be a number of bpm in a plausible range (or empty). */
export const badHeartRate = (d: DetailsDraft) => {
  if (!d.hr.trim()) return false;
  const v = Number(d.hr);
  return !isFinite(v) || v < 30 || v > 250;
};

/** Labels of minutes fields whose text can't be read as a duration. */
export function unreadableDurations(d: DetailsDraft): string[] {
  const fields: [string, string][] = [
    ["Duration", d.durationMin],
    ["Warm-up", d.warmupMin],
    ["Cool-down", d.cooldownMin],
  ];
  return fields.filter(([, v]) => Number.isNaN(parseMinutesInput(v))).map(([label]) => label);
}

export function fromDraft(d: DetailsDraft, units: Units): WorkoutDetails | undefined {
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
  const exercises = fromExerciseDrafts(d.exercises, units);
  const out: WorkoutDetails = {
    exercises: exercises.length ? exercises : undefined,
    durationSec,
    distanceM: dist != null ? Math.round(displayToMeters(dist, units)) : undefined,
    intervals: hasIntervals ? intervals : undefined,
    description: d.description.trim() || undefined,
    avgHeartRate: num(d.hr) != null ? Math.round(num(d.hr)!) : undefined,
  };
  return Object.values(out).some((v) => v != null) ? out : undefined;
}

/** A new workout on a past day was most likely done; today and later start as planned. */
export const statusForDay = (date: string, today: string) => (date < today ? "completed" : "planned");
