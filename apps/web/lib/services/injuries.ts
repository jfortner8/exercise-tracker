import "server-only";
import { ulid } from "ulid";
import type { InjuriesResponse } from "@et/core/api-types";
import { id, injuryInput, type InjuryInput } from "@et/core/schemas";
import * as repo from "@/lib/db/repo";
import { syncAfterChange } from "./sync";

/*
 * Injuries.
 * Plain functions of the user id: the website's server actions and the /api/v1 routes both call them.
 */

/** Every injury, with the pain levels logged on workouts linked to each (oldest first), keyed by injury id. */
export async function injuriesWithPain(sub: string): Promise<InjuriesResponse> {
  const injuries = await repo.listInjuries(sub);
  const pain = await Promise.all(
    injuries.map(async (i) => {
      const ws = await repo.listWorkoutsForInjury(sub, i.id);
      return [
        i.id,
        ws
          .filter((w) => w.painLevel != null)
          .map((w) => ({ date: w.date, level: w.painLevel!, title: w.title }))
          .sort((a, b) => a.date.localeCompare(b.date)),
      ] as const;
    }),
  );
  return { injuries, pain: Object.fromEntries(pain) };
}

/** Adds an injury, or edits one when `id` is set. → its id. */
export async function saveInjury(sub: string, raw: InjuryInput) {
  const i = injuryInput.parse(raw);
  const injuryId = i.id ?? ulid();
  await repo.saveInjury(sub, { ...i, id: injuryId });
  await syncAfterChange(sub);
  return injuryId;
}

export async function deleteInjury(sub: string, injuryId: string) {
  await repo.deleteInjury(sub, id.parse(injuryId));
  await syncAfterChange(sub);
}
