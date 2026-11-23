import { api } from "@/lib/api";
import { deleteSeriesFrom } from "@/lib/services/workouts";

/** DELETE /api/v1/workouts/:date/:id/series — this repeating workout and the rest of its series still planned. → { deleted } */
export const DELETE = api<{ date: string; id: string }>(({ sub, params }) => deleteSeriesFrom(sub, params.date, params.id));
