import { api, field } from "@/lib/api";
import { saveWorkout } from "@/lib/services/workouts";
import type { RepeatInput, WorkoutInput } from "@et/core/schemas";

/**
 * POST /api/v1/workouts — create or edit a workout.
 * Body: { workout: WorkoutInput, repeat?: RepeatInput, saveAsRoutine?: { name } }.
 * Editing: set workout.id and workout.originalDate (its current date); a new date moves it.
 */
export const POST = api(({ sub, body }) =>
  saveWorkout(sub, field<WorkoutInput>(body, "workout")!, field<RepeatInput>(body, "repeat"), field<{ name: string }>(body, "saveAsRoutine")),
);
