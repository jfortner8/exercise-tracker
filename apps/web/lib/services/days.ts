import "server-only";
import { day, dayPatchInput } from "@et/core/schemas";
import { activeGoals } from "@et/core/goals";
import * as repo from "@/lib/db/repo";
import { ApiError } from "@/lib/api-error";

/*
 * Day logs: notes, daily counters, bodyweight and daily goals.
 * Plain functions of the user id: the website's server actions and the /api/v1 routes both call them.
 */

/**
 * Update a day's notes, drinks and/or bodyweight. A field left out keeps its saved value;
 * null clears it. (So saving notes never wipes drinks or weight hidden by settings.)
 */
export async function saveDay(
  sub: string,
  date: string,
  patch: {
    notes?: string | null;
    drinks?: number | null;
    sugaryDrinks?: number | null;
    tobacco?: number | null;
    weightKg?: number | null;
  },
) {
  const d = day.parse(date);
  const p = dayPatchInput.parse(patch);
  const existing = (await repo.getDay(sub, d)) ?? { date: d };
  const pick = <K extends keyof typeof p>(k: K, old: unknown) => (p[k] === undefined ? old : (p[k] ?? undefined));
  await repo.saveDay(sub, {
    // Fields this form doesn't edit (the day's ticked goals) are kept, not dropped.
    ...existing,
    date: d,
    notes: (pick("notes", existing.notes) as string | undefined)?.trim() || undefined,
    drinks: (pick("drinks", existing.drinks) as number | undefined) || undefined,
    sugaryDrinks: (pick("sugaryDrinks", existing.sugaryDrinks) as number | undefined) || undefined,
    tobacco: (pick("tobacco", existing.tobacco) as number | undefined) || undefined,
    weightKg: pick("weightKg", existing.weightKg) as number | undefined,
  });
}

/** Check a daily goal off for a day, or un-check it. Leaves the day's other fields alone. */
export async function setGoalDone(sub: string, date: string, goalId: string, done: boolean) {
  const d = day.parse(date);
  const profile = await repo.getProfile(sub);
  if (!profile || !activeGoals(profile).some((g) => g.id === goalId)) throw new ApiError(400, "Unknown goal");
  const existing = (await repo.getDay(sub, d)) ?? { date: d };
  const rest = (existing.goalsDone ?? []).filter((id) => id !== goalId);
  const goalsDone = done ? [...rest, goalId] : rest;
  await repo.saveDay(sub, { ...existing, date: d, goalsDone: goalsDone.length ? goalsDone : undefined });
}
