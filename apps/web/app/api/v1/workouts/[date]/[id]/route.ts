import { api } from "@/lib/api";
import { deleteWorkout } from "@/lib/services/workouts";

/** DELETE /api/v1/workouts/:date/:id — delete one workout. */
export const DELETE = api<{ date: string; id: string }>(({ sub, params }) => deleteWorkout(sub, params.date, params.id));
