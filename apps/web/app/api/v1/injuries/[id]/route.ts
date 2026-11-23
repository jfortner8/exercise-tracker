import type { InjuryInput } from "@et/core/schemas";
import { api } from "@/lib/api";
import { notFound } from "@/lib/api-error";
import { listInjuries } from "@/lib/db/repo";
import { deleteInjury, saveInjury } from "@/lib/services/injuries";

/** PUT /api/v1/injuries/:id — the whole injury again (as POST). A field left out is cleared. */
export const PUT = api<{ id: string }>(async ({ sub, params, body }) => {
  if (!(await listInjuries(sub)).some((i) => i.id === params.id)) throw notFound("Injury");
  await saveInjury(sub, { ...(body as InjuryInput), id: params.id });
});

/** DELETE /api/v1/injuries/:id — workouts linked to it are left as they are. */
export const DELETE = api<{ id: string }>(({ sub, params }) => deleteInjury(sub, params.id));
