import "server-only";
import { ulid } from "ulid";
import { id, routineInput, type RoutineInput } from "@et/core/schemas";
import { cleanExercises, findRoutineByName } from "@et/core/routines";
import * as repo from "@/lib/db/repo";


/*
 * Saved strength routines.
 * Plain functions of the user id: the website's server actions and the /api/v1 routes both call them.
 */

export async function saveRoutine(sub: string, raw: RoutineInput) {
  const p = routineInput.parse(raw);
  const list = cleanExercises(p.exercises);
  if (!list.length) return { error: "Add at least one exercise." };
  const all = await repo.listRoutines(sub);
  const clash = findRoutineByName(all, p.name);
  if (clash && clash.id !== p.id) return { error: `You already have a routine called "${clash.name}".` };
  const existing = p.id ? all.find((r) => r.id === p.id) : undefined;
  if (p.id && !existing) return { error: "That routine no longer exists." };
  const now = new Date().toISOString();
  await repo.saveRoutine(sub, { id: existing?.id ?? ulid(), name: p.name, exercises: list, createdAt: existing?.createdAt ?? now, updatedAt: now });
  await repo.setHasRoutines(sub, true);
  return { ok: true as const };
}

export async function deleteRoutine(sub: string, routineId: string) {
  await repo.deleteRoutine(sub, id.parse(routineId));
  if (!(await repo.listRoutines(sub)).length) await repo.setHasRoutines(sub, false);
}
