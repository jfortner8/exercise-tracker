import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { DISTANCE_TYPES } from "@et/core/activities";
import { describeDuration, distanceUnit, formatDuration, formatMinutesInput, intervalTotalSec, parseMinutesInput, weightUnit } from "@et/core/domain";
import { MAX_EXERCISES } from "@et/core/routines";
import type { Units, Workout } from "@et/core/types";
import { blankExercise, fromDraft, INTERVAL_TYPES, type DetailsDraft, type ExerciseDraft } from "@et/core/workout-draft";
import { useTheme } from "@/theme";
import { Body, Button, Field } from "@/ui";
import { Row, SmallField } from "@/ui/form";

/** A minutes field that also takes 87:45 or 1:27:45, with how it was read underneath. */
function MinutesField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const sec = parseMinutesInput(value);
  const bad = sec != null && Number.isNaN(sec);
  return (
    <SmallField
      label={label}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      keyboardType="numbers-and-punctuation"
      bad={bad}
      hint={sec == null ? undefined : bad ? "Try 45, 87:45 or 1:27:45" : `= ${describeDuration(sec)}`}
    />
  );
}

/** Plan or actual: exercises (strength), duration, distance, intervals, heart rate, details. */
export function DetailsFields({
  value,
  onChange,
  units,
  type,
  showHeartRate = false,
}: {
  value: DetailsDraft;
  onChange: (d: DetailsDraft) => void;
  units: Units;
  type: Workout["type"];
  showHeartRate?: boolean;
}) {
  const t = useTheme();
  const set = (k: keyof DetailsDraft) => (v: string) => onChange({ ...value, [k]: v });
  const [showIntervals, setShowIntervals] = useState(!!(value.reps || value.workSec));
  const total = intervalTotalSec(fromDraft(value, units)?.intervals);
  return (
    <View>
      {type === "strength" && (
        <ExerciseList value={value.exercises} onChange={(exercises) => onChange({ ...value, exercises })} units={units} />
      )}
      <Row>
        <MinutesField label="Duration (min)" value={value.durationMin} onChange={set("durationMin")} placeholder={total ? formatMinutesInput(total) : "45 or 87:45"} />
        {(DISTANCE_TYPES.has(type) || value.distance.trim() !== "") && (
          <SmallField label={`Distance (${distanceUnit(units)})`} value={value.distance} onChangeText={set("distance")} keyboardType="decimal-pad" />
        )}
      </Row>
      {(INTERVAL_TYPES.has(type) || showIntervals) && (
        <View style={{ borderWidth: 1, borderColor: t.border, borderRadius: 12, padding: 10, marginBottom: 10 }}>
          <Pressable accessibilityRole="button" onPress={() => setShowIntervals((s) => !s)} style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: t.text, fontWeight: "600" }}>Intervals</Text>
            <Text style={{ color: t.muted }}>{total ? `${formatDuration(total)} total` : showIntervals ? "Hide" : "Add"}</Text>
          </Pressable>
          {showIntervals && (
            <View style={{ marginTop: 10 }}>
              <Row>
                <SmallField label="Reps" value={value.reps} onChangeText={set("reps")} keyboardType="number-pad" placeholder="6" />
                <SmallField label="Work (sec)" value={value.workSec} onChangeText={set("workSec")} keyboardType="number-pad" placeholder="90" />
                <SmallField label="Rest (sec)" value={value.restSec} onChangeText={set("restSec")} keyboardType="number-pad" placeholder="60" />
              </Row>
              <Row>
                <MinutesField label="Warm-up (min)" value={value.warmupMin} onChange={set("warmupMin")} />
                <MinutesField label="Cool-down (min)" value={value.cooldownMin} onChange={set("cooldownMin")} />
              </Row>
            </View>
          )}
        </View>
      )}
      {showHeartRate && (
        <View style={{ width: "50%" }}>
          <SmallField label="Avg heart rate (bpm)" value={value.hr} onChangeText={set("hr")} keyboardType="number-pad" placeholder="142" />
        </View>
      )}
      <Field
        label="Details"
        value={value.description}
        onChangeText={set("description")}
        multiline
        style={{ minHeight: 60, textAlignVertical: "top", paddingTop: 10 }}
        placeholder={type === "strength" ? "e.g. Bulgarian split squats 3×8" : "Anything else worth noting"}
      />
    </View>
  );
}

/** The editable exercises: name, then sets · reps · weight, and remove. */
function ExerciseList({ value, onChange, units }: { value: ExerciseDraft[]; onChange: (v: ExerciseDraft[]) => void; units: Units }) {
  const t = useTheme();
  const set = (i: number, k: keyof ExerciseDraft) => (v: string) => onChange(value.map((e, j) => (j === i ? { ...e, [k]: v } : e)));
  return (
    <View style={{ marginBottom: 10 }}>
      <Body style={{ fontWeight: "600", marginBottom: 6 }}>Exercises</Body>
      {value.map((e, i) => (
        <View key={i} style={{ borderWidth: 1, borderColor: t.border, borderRadius: 12, padding: 10, marginBottom: 8 }}>
          <SmallField label="Exercise" value={e.name} onChangeText={set(i, "name")} placeholder="Squat" />
          <Row>
            <SmallField label="Sets" value={e.sets} onChangeText={set(i, "sets")} keyboardType="number-pad" />
            <SmallField label="Reps" value={e.reps} onChangeText={set(i, "reps")} placeholder="8 or 8-10" />
            <SmallField label={`Weight (${weightUnit(units)})`} value={e.weight} onChangeText={set(i, "weight")} keyboardType="decimal-pad" />
          </Row>
          <Pressable accessibilityRole="button" onPress={() => onChange(value.filter((_, j) => j !== i))}>
            <Text style={{ color: t.danger }}>Remove</Text>
          </Pressable>
        </View>
      ))}
      {value.length < MAX_EXERCISES && <Button title="+ Add exercise" variant="secondary" onPress={() => onChange([...value, blankExercise()])} />}
    </View>
  );
}
