import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { RoutinesResponse } from "@et/core/api-types";
import { sameExercises } from "@et/core/routines";
import type { Routine, Units } from "@et/core/types";
import { blankExercise, fromExerciseDrafts, toExerciseDrafts } from "@et/core/workout-draft";
import { useAction } from "@/api/action";
import { api } from "@/api/client";
import { useMe } from "@/api/queries";
import { ExerciseList } from "@/screens/workout/DetailsFields";
import { Button, Card, ErrorText, Field, Screen, Title } from "@/ui";
import { ask } from "@/ui/confirm";
import { Empty } from "@/ui/list";

/** Saved strength routines: edit, add and delete. Workouts already on the calendar keep their own copy. */
export function Routines({ header }: { header?: boolean }) {
  const units = useMe().data?.profile.units;
  const q = useQuery({ queryKey: ["routines"], queryFn: () => api<RoutinesResponse>("/routines") });
  const [adding, setAdding] = useState(false);
  return (
    <Screen header={header} onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <Title subtitle="Exercise lists to start a Strength workout from.">Routines</Title>
      <ErrorText>{q.error?.message}</ErrorText>
      {!adding && <Button title="+ New routine" variant="secondary" onPress={() => setAdding(true)} />}
      {units && adding && <RoutineCard units={units} onDone={() => setAdding(false)} />}
      {units &&
        q.data?.routines.map((r) => (
          // Keyed by updatedAt too, so a saved edit resets the card to what was stored.
          <RoutineCard key={`${r.id}-${r.updatedAt}`} routine={r} units={units} />
        ))}
      {q.data && !q.data.routines.length && !adding && (
        <Empty>No routines yet. Add one here, or switch on “Save as a routine” when you add a Strength workout.</Empty>
      )}
    </Screen>
  );
}

function RoutineCard({ routine, units, onDone }: { routine?: Routine; units: Units; onDone?: () => void }) {
  const [name, setName] = useState(routine?.name ?? "");
  const [rows, setRows] = useState(() => (routine ? toExerciseDrafts(routine.exercises, units) : [blankExercise()]));
  const [error, setError] = useState<string | null>(null);
  const act = useAction([["routines"], ["calendar"], ["me"]]);
  const changed = !routine || name.trim() !== routine.name || !sameExercises(fromExerciseDrafts(rows, units), routine.exercises);

  async function save() {
    setError(null);
    if (!name.trim()) return setError("Give the routine a name.");
    const exercises = fromExerciseDrafts(rows, units);
    if (!exercises.length) return setError("Add at least one exercise.");
    const body = { name: name.trim(), exercises };
    const r = await act.run(() => (routine ? api(`/routines/${routine.id}`, { method: "PUT", body }) : api("/routines", { body })));
    if (r) onDone?.();
  }

  return (
    <Card>
      <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Push day" maxLength={60} />
      <ExerciseList value={rows} onChange={setRows} units={units} />
      <ErrorText>{error ?? act.error}</ErrorText>
      <Button title={routine ? "Save changes" : "Save routine"} onPress={() => void save()} loading={act.pending} disabled={!changed} />
      {routine ? (
        <Button
          title="Delete"
          variant="link"
          onPress={async () => {
            if (await ask(`Delete "${routine.name}"?`, "Workouts that used it keep their exercises.", "Delete", true))
              void act.run(() => api(`/routines/${routine.id}`, { method: "DELETE" }));
          }}
        />
      ) : (
        <Button title="Cancel" variant="link" onPress={() => onDone?.()} />
      )}
    </Card>
  );
}
