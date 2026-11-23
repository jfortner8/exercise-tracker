import "server-only";
import { ulid } from "ulid";
import { id, routineInput, type RoutineInput } from "@et/core/schemas";
import { cleanExercises, findRoutineByName } from "@et/core/routines";
import * as repo from "@/lib/db/repo";

/*
 * Saved strength routines.
 * Plain functions of the user id: the website's server actions and the /api/v1 routes both call them.
 */

export async function saveRoutine(sub: string, raw: RoutineInput): Promise<{ error: string } | { ok: true; id: string }> {
  const p = routineInput.parse(raw);
  const list = cleanExercises(p.exercises);
  if (!list.length) return { error: "Add at least one exercise." };
  const all = await repo.listRoutines(sub);
  const clash = findRoutineByName(all, p.name);
  if (clash && clash.id !== p.id) return { error: `You already have a routine called "${clash.name}".` };
  const existing = p.id ? all.find((r) => r.id === p.id) : undefined;
  if (p.id && !existing) return { error: "That routine no longer exists." };
  const now = new Date().toISOString();
  const routineId = existing?.id ?? ulid();
  await repo.saveRoutine(sub, { id: routineId, name: p.name, exercises: list, createdAt: existing?.createdAt ?? now, updatedAt: now });
  await repo.setHasRoutines(sub, true);
  return { ok: true, id: routineId };
}

export async function deleteRoutine(sub: string, routineId: string) {
  const rid = id.parse(routineId);
  // Read the rest before deleting: a query straight after the delete is eventually consistent and
  // can still return the routine just deleted, which would leave the Routines tab showing.
  const others = (await repo.listRoutines(sub)).filter((r) => r.id !== rid);
  await repo.deleteRoutine(sub, rid);
  if (!others.length) await repo.setHasRoutines(sub, false);
}
