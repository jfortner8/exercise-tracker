import type { InjuryInput } from "@et/core/schemas";
import { api } from "@/lib/api";
import { injuriesWithPain, saveInjury } from "@/lib/services/injuries";

/**
 * GET /api/v1/injuries — → { injuries, pain }. `pain[injuryId]` is the pain levels logged on workouts
 * linked to that injury, oldest first: [{ date, level, title }].
 */
export const GET = api(({ sub }) => injuriesWithPain(sub));

/** POST /api/v1/injuries — { name, bodyPart?, startDate, endDate?, status, notes? } → { id }. */
export const POST = api(async ({ sub, body }) => ({ id: await saveInjury(sub, { ...(body as InjuryInput), id: undefined }) }));
