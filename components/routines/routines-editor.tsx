"use client";

import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { deleteRoutineAction, saveRoutineAction } from "@/lib/actions";
import { sameExercises } from "@/lib/routines";
import type { Routine, Units } from "@/lib/types";
import { blankExercise, ExerciseRows, fromExerciseDrafts, toExerciseDrafts } from "../workouts/exercise-rows";
import { Button, Card, Field, Input } from "../ui";

/** The Routines tab: edit, add and delete saved routines. */
export function RoutinesEditor({ routines, units }: { routines: Routine[]; units: Units }) {
  const [adding, setAdding] = useState(false);
  return (
    <div className="space-y-4">
      {!adding && (
        <Button type="button" onClick={() => setAdding(true)}>
          <Plus className="size-4" /> New routine
        </Button>
      )}
      {adding && <RoutineCard units={units} onDone={() => setAdding(false)} />}
      {routines.map((r) => (
        // Keyed by updatedAt too, so a saved edit resets the card to what was stored.
        <RoutineCard key={`${r.id}-${r.updatedAt}`} routine={r} units={units} />
      ))}
      {!routines.length && !adding && (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">
          No routines yet. Add one here, or tick &ldquo;Save as a routine&rdquo; when you add a Strength workout on the{" "}
          <Link href="/" className="font-medium text-accent-ink hover:underline">
            calendar
          </Link>
          .
        </p>
      )}
    </div>
  );
}

function RoutineCard({ routine, units, onDone }: { routine?: Routine; units: Units; onDone?: () => void }) {
  const [name, setName] = useState(routine?.name ?? "");
  const [rows, setRows] = useState(() => (routine ? toExerciseDrafts(routine.exercises, units) : [blankExercise()]));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const changed = !routine || name.trim() !== routine.name || !sameExercises(fromExerciseDrafts(rows, units), routine.exercises);

  function save() {
    setError(null);
    if (!name.trim()) return setError("Give the routine a name.");
    const exercises = fromExerciseDrafts(rows, units);
    if (!exercises.length) return setError("Add at least one exercise.");
    start(async () => {
      const res = await saveRoutineAction({ id: routine?.id, name: name.trim(), exercises });
      if ("error" in res) setError(res.error ?? "Could not save");
      else onDone?.();
    });
  }

  return (
    <Card className="space-y-3 p-4">
      <Field label="Name">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Push day" maxLength={60} />
      </Field>
      <ExerciseRows value={rows} onChange={setRows} units={units} label={`${routine?.name ?? "New routine"} exercises`} />
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex items-center gap-2">
        <Button type="button" variant="primary" size="sm" disabled={pending || !changed} onClick={save}>
          {pending ? "Saving…" : routine ? "Save changes" : "Save routine"}
        </Button>
        {routine ? (
          <Button
            type="button"
            size="sm"
            variant="danger"
            className="ml-auto"
            disabled={pending}
            aria-label={`Delete ${routine.name}`}
            onClick={() =>
              confirm(`Delete "${routine.name}"? Workouts that used it keep their exercises.`) &&
              start(() => deleteRoutineAction(routine.id))
            }
          >
            <Trash2 className="size-4" /> Delete
          </Button>
        ) : (
          <Button type="button" size="sm" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        )}
      </div>
    </Card>
  );
}
