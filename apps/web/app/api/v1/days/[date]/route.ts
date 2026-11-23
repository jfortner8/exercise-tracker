import { api } from "@/lib/api";
import { saveDay } from "@/lib/services/days";
import type { DayPatchInput } from "@et/core/schemas";

/** PUT /api/v1/days/:date — body { notes?, drinks?, sugaryDrinks?, tobacco?, weightKg? }. Left out keeps; null clears. */
export const PUT = api<{ date: string }>(({ sub, params, body }) => saveDay(sub, params.date, (body ?? {}) as DayPatchInput));
