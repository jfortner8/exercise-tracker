import { kgToDisplay } from "./domain";
import type { Exercise, Routine, Units } from "./types";

/** Most exercises a list can hold. */
export const MAX_EXERCISES = 40;

/** Weight as typed in the user's unit, trimmed: 135, 22.5, 61.2. */
const shownWeight = (kg: number, units: Units) => {
  const v = kgToDisplay(kg, units);
  return Math.round(v * 10) / 10;
};

/**
 * "Bench press 3×8 @ 135 lb", "Plank 3×60 s", "Pull-ups ×to failure" → reads naturally;
 * "Deadlift @ 225 lb", "Face pulls 3 sets", or just the name.
 */
export function describeExercise(e: Exercise, units: Units): string {
  const reps = e.reps?.trim();
  const amount = e.sets && reps ? `${e.sets}×${reps}` : e.sets ? `${e.sets} ${e.sets === 1 ? "set" : "sets"}` : reps ? `×${reps}` : "";
  const weight = e.weightKg ? `@ ${shownWeight(e.weightKg, units)} ${units.weight}` : "";
  return [e.name.trim(), amount, weight].filter(Boolean).join(" ");
}

/** Drops rows with no name and trims the rest. */
export function cleanExercises(list: Exercise[] | undefined): Exercise[] {
  return (list ?? [])
    .map((e) => ({
      name: e.name.trim(),
      ...(e.sets ? { sets: e.sets } : {}),
      ...(e.reps?.trim() ? { reps: e.reps.trim() } : {}),
      ...(e.weightKg ? { weightKg: e.weightKg } : {}),
    }))
    .filter((e) => e.name);
}

/** Same exercises in the same order (after cleaning). */
export function sameExercises(a: Exercise[] | undefined, b: Exercise[] | undefined): boolean {
  const [x, y] = [cleanExercises(a), cleanExercises(b)];
  return (
    x.length === y.length &&
    x.every((e, i) => e.name === y[i].name && e.sets === y[i].sets && e.reps === y[i].reps && e.weightKg === y[i].weightKg)
  );
}

/** A routine with this name, ignoring case and surrounding spaces. */
export function findRoutineByName(routines: Pick<Routine, "id" | "name">[], name: string) {
  const n = name.trim().toLowerCase();
  return routines.find((r) => r.name.trim().toLowerCase() === n);
}
