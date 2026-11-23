import "server-only";
import { ulid } from "ulid";
import { id, injuryInput, type InjuryInput } from "@et/core/schemas";
import * as repo from "@/lib/db/repo";
import { syncAfterChange } from "./sync";

/*
 * Injuries.
 * Plain functions of the user id: the website's server actions and the /api/v1 routes both call them.
 */

export async function saveInjury(sub: string, raw: InjuryInput) {
  const i = injuryInput.parse(raw);
  await repo.saveInjury(sub, { ...i, id: i.id ?? ulid() });
  await syncAfterChange(sub);
}

export async function deleteInjury(sub: string, injuryId: string) {
  await repo.deleteInjury(sub, id.parse(injuryId));
  await syncAfterChange(sub);
}
