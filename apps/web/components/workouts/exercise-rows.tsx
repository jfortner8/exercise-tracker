"use client";

import { Plus, X } from "lucide-react";
import type { ReactNode } from "react";
import { displayToKg, kgToDisplay } from "@et/core/domain";
import { MAX_EXERCISES } from "@et/core/routines";
import type { Exercise, Units } from "@et/core/types";
import { Input } from "../ui";

/** An exercise as typed: strings, weight in the user's unit. */
export interface ExerciseDraft {
  name: string;
  sets: string;
  reps: string;
  weight: string;
}

export const blankExercise = (): ExerciseDraft => ({ name: "", sets: "", reps: "", weight: "" });

export function toExerciseDrafts(list: Exercise[] | undefined, units: Units): ExerciseDraft[] {
  return (list ?? []).map((e) => ({
    name: e.name,
    sets: e.sets ? String(e.sets) : "",
    reps: e.reps ?? "",
    weight: e.weightKg ? String(Math.round(kgToDisplay(e.weightKg, units) * 10) / 10) : "",
  }));
}

/** Rows with a name, as Exercises; unreadable numbers are left out. */
export function fromExerciseDrafts(drafts: ExerciseDraft[], units: Units): Exercise[] {
  const n = (s: string) => (s.trim() && isFinite(Number(s)) && Number(s) > 0 ? Number(s) : undefined);
  return drafts
    .filter((d) => d.name.trim())
    .map((d) => {
      const sets = n(d.sets);
      const weight = n(d.weight);
      return {
        name: d.name.trim(),
        ...(sets ? { sets: Math.round(sets) } : {}),
        ...(d.reps.trim() ? { reps: d.reps.trim() } : {}),
        // Stored in kg to the gram, so 135 lb reads back as 135.
        ...(weight ? { weightKg: Math.round(displayToKg(weight, units) * 1000) / 1000 } : {}),
      };
    });
}

/** The editable list of exercises: name on top, then sets · reps · weight · remove. */
export function ExerciseRows({
  value,
  onChange,
  units,
  label = "Exercises",
}: {
  value: ExerciseDraft[];
  onChange: (v: ExerciseDraft[]) => void;
  units: Units;
  label?: string;
}) {
  const set = (i: number, k: keyof ExerciseDraft, v: string) => onChange(value.map((e, j) => (j === i ? { ...e, [k]: v } : e)));
  return (
    <div className="space-y-2" role="group" aria-label={label}>
      <div className="text-sm font-medium text-muted">Exercises</div>
      {value.map((e, i) => (
        <div key={i} className="space-y-1.5 rounded-lg border border-border p-2" data-exercise-row>
          <div className="flex items-center gap-1.5">
            <Input
              value={e.name}
              onChange={(ev) => set(i, "name", ev.target.value)}
              placeholder="Exercise, e.g. Bench press"
              aria-label={`Exercise ${i + 1} name`}
              maxLength={80}
            />
            <button
              type="button"
              onClick={() => onChange(value.filter((_, j) => j !== i))}
              aria-label={`Remove exercise ${i + 1}`}
              className="shrink-0 rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-text"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1.5 pr-8">
            <Labeled tag="sets">
              <Input
                inputMode="numeric"
                value={e.sets}
                onChange={(ev) => set(i, "sets", ev.target.value)}
                aria-label={`Exercise ${i + 1} sets`}
                className="pr-10"
              />
            </Labeled>
            <Labeled tag="reps">
              <Input
                value={e.reps}
                onChange={(ev) => set(i, "reps", ev.target.value)}
                aria-label={`Exercise ${i + 1} reps`}
                maxLength={20}
                className="pr-10"
              />
            </Labeled>
            <Labeled tag={units.weight}>
              <Input
                inputMode="decimal"
                value={e.weight}
                onChange={(ev) => set(i, "weight", ev.target.value)}
                aria-label={`Exercise ${i + 1} weight (${units.weight})`}
                className="pr-8"
              />
            </Labeled>
          </div>
        </div>
      ))}
      {value.length < MAX_EXERCISES && (
        <button
          type="button"
          onClick={() => onChange([...value, blankExercise()])}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-sm text-muted hover:bg-surface-2 hover:text-text"
        >
          <Plus className="size-4" /> Add exercise
        </button>
      )}
    </div>
  );
}

/** An input with its unit shown inside on the right ("3 sets", "8 reps", "135 lb"), so filled rows stay readable. */
function Labeled({ tag, children }: { tag: string; children: ReactNode }) {
  return (
    <div className="relative">
      {children}
      <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-muted" aria-hidden>
        {tag}
      </span>
    </div>
  );
}
