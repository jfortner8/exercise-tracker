"use client";

import { linkableWorkouts, linkRule, linkWarning, workoutLabel } from "@/lib/benchmarks/linking";
import type { BenchmarkDef, Units, Workout } from "@/lib/types";
import { Field, Select } from "../ui";

/**
 * "Part of workout" picker for a benchmark result. Offers only workouts that fit the benchmark
 * (runs for a 10K, swims for a 50 m swim…) and warns when the chosen one looks too short.
 * Renders nothing for standalone benchmarks or when the day has no fitting workout.
 */
export function WorkoutLinkField({
  def,
  workouts,
  units,
  value,
  onChange,
  className,
}: {
  def: Pick<BenchmarkDef, "catalogKey">;
  workouts: Workout[];
  units: Units;
  value: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  const rule = linkRule(def);
  if (Array.isArray(rule.types) && rule.types.length === 0) return null;
  const options = linkableWorkouts(def, workouts);
  if (!options.length) return null;
  const chosen = options.find((w) => w.id === value);
  const warning = chosen && linkWarning(def, chosen, units);
  return (
    <Field label="Part of workout" className={className}>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((w) => (
          <option key={w.id} value={w.id}>
            {workoutLabel(w, units)}
          </option>
        ))}
        <option value="">Not part of a workout</option>
      </Select>
      {warning && <span className="text-xs text-warn">{warning} You can still save it.</span>}
    </Field>
  );
}
