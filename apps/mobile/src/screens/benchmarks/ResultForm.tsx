import { useState } from "react";
import { Text, View } from "react-native";
import { isClock, parseValue, valueLabel, valueToInput } from "@et/core/benchmarks/input";
import { linkableWorkouts, linkRule, linkWarning, suggestLink, workoutLabel } from "@et/core/benchmarks/linking";
import { formatClock } from "@et/core/domain";
import { fastestWindow, parseSplits, splitsNeeded } from "@et/core/splits";
import type { BenchmarkDef, BenchmarkResult, DistanceUnit, Units } from "@et/core/types";
import { useAction } from "@/api/action";
import { api } from "@/api/client";
import { useDayWorkouts } from "@/api/queries";
import { useTheme } from "@/theme";
import { Button, ErrorText, Field } from "@/ui";
import { Chips, DateField, Row, SmallField } from "@/ui/form";

/**
 * Date, value, reps, workout link and notes. Records a new result, or edits `editing` (pre-filled,
 * keeping its workout link; a new date moves it). The website's ResultForm.
 */
export function ResultForm({
  def,
  units,
  today,
  editing,
  date: startDate,
  onDone,
}: {
  def: BenchmarkDef;
  units: Units;
  today: string;
  editing?: BenchmarkResult;
  /** A new result's day (the day sheet's); today otherwise. */
  date?: string;
  onDone?: () => void;
}) {
  const [date, setDate] = useState(editing?.date ?? startDate ?? today);
  const [value, setValue] = useState(editing ? valueToInput(def, editing.value, units) : "");
  const [reps, setReps] = useState(editing?.reps ? String(editing.reps) : "");
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const day = useDayWorkouts(date);
  const workouts = day.data?.workouts;
  // The workout picked for a date; until one is, an edited result keeps its link on its own date,
  // and otherwise the likeliest workout is chosen.
  const [picked, setPicked] = useState<{ date: string; id: string } | null>(null);
  const keep = editing && date === editing.date && !!workouts?.some((w) => w.id === editing.workoutId);
  const workoutId =
    picked?.date === date
      ? picked.id
      : keep
        ? editing!.workoutId!
        : editing && date === editing.date
          ? ""
          : workouts
            ? (suggestLink(def, workouts, units)?.id ?? "")
            : "";
  const setWorkoutId = (id: string) => setPicked({ date, id });
  const act = useAction([["benchmarks"], ["benchmark", def.id], ["calendar"], ["leaderboards"]]);

  async function save() {
    const v = parseValue(def, value, units);
    if (!isFinite(v) || v < 0) return setError("Enter a valid value");
    setError(null);
    const body = {
      date,
      value: v,
      reps: def.metricKind === "weight_reps" ? Number(reps) || 1 : undefined,
      notes: notes.trim() || undefined,
      workoutId: workoutId || undefined,
    };
    const r = await act.run(() =>
      editing ? api(`/benchmarks/${def.id}/results/${editing.date}/${editing.id}`, { method: "PUT", body }) : api(`/benchmarks/${def.id}/results`, { body }),
    );
    if (!r) return;
    if (!editing) {
      setValue("");
      setReps("");
      setNotes("");
    }
    onDone?.();
  }

  const rule = linkRule(def);
  const options = workouts && !(Array.isArray(rule.types) && rule.types.length === 0) ? linkableWorkouts(def, workouts) : [];
  const chosen = options.find((w) => w.id === workoutId);
  const warning = chosen && linkWarning(def, chosen, units);
  const t = useTheme();

  return (
    <View>
      <DateField label="Date" value={date} onChange={setDate} />
      <Row>
        <SmallField
          label={valueLabel(def, units)}
          value={value}
          onChangeText={setValue}
          keyboardType={isClock(def) ? "numbers-and-punctuation" : "decimal-pad"}
          placeholder={isClock(def) ? "21:30" : undefined}
        />
        {def.metricKind === "weight_reps" && <SmallField label="Reps" value={reps} onChangeText={setReps} keyboardType="number-pad" placeholder="1" />}
      </Row>
      <SplitsHelper
        def={def}
        units={units}
        onUse={(sec, note) => {
          setValue(valueToInput(def, sec, units));
          setNotes((n) => n.trim() || note);
        }}
      />
      {options.length > 0 && (
        <>
          <Chips
            label="Part of workout"
            options={[...options.map((w) => ({ value: w.id, label: workoutLabel(w, units) })), { value: "none", label: "Not part of a workout" }]}
            value={workoutId || "none"}
            onChange={(v) => setWorkoutId(v === "none" ? "" : v)}
          />
          {warning ? <Text style={{ color: t.warn, fontSize: 12, marginTop: -6, marginBottom: 10 }}>{warning} You can still save it.</Text> : null}
        </>
      )}
      <Field label="Notes" value={notes} onChangeText={setNotes} placeholder="Pool, conditions, felt…" />
      <ErrorText>{error ?? act.error}</ErrorText>
      <Button title={editing ? "Save changes" : "Save result"} onPress={() => void save()} loading={act.pending} disabled={!value.trim()} />
      {onDone && editing ? <Button title="Cancel" variant="link" onPress={onDone} /> : null}
    </View>
  );
}

const UNIT_NAME: Record<DistanceUnit, string> = { km: "km", mi: "mile" };

/**
 * For a distance time benchmark (1 mile, 5K, 10K): paste a longer run's splits and get the fastest
 * stretch of that distance, an exact time for a real part of the run.
 */
function SplitsHelper({ def, units, onUse }: { def: BenchmarkDef; units: Units; onUse: (sec: number, note: string) => void }) {
  const t = useTheme();
  const distanceM = def.metricKind === "time" ? linkRule(def).distanceM : undefined;
  const fits = (u: DistanceUnit) => !!distanceM && splitsNeeded(distanceM, u) != null;
  const [open, setOpen] = useState(false);
  const [unit, setUnit] = useState<DistanceUnit>(fits(units.distance) || !fits("km") ? units.distance : "km");
  const [text, setText] = useState("");
  if (!distanceM || (!fits("km") && !fits("mi"))) return null;
  if (!open) return <Button title="Work it out from splits" variant="link" onPress={() => setOpen(true)} />;

  const n = splitsNeeded(distanceM, unit);
  const parsed = parseSplits(text);
  const best = n && "sec" in parsed ? fastestWindow(parsed.sec, n) : undefined;
  const range = best && (best.from === best.to ? `${unit} ${best.from}` : `${unit} ${best.from}–${best.to}`);
  const line = !n
    ? `${UNIT_NAME[unit][0].toUpperCase() + UNIT_NAME[unit].slice(1)} splits can't give an exact ${def.name}; switch to ${unit === "km" ? "mi" : "km"}.`
    : "error" in parsed
      ? parsed.error
      : !best && parsed.sec.length
        ? `Needs at least ${n} whole ${UNIT_NAME[unit]} splits (${parsed.sec.length} so far).`
        : null;

  return (
    <View style={{ borderWidth: 1, borderColor: t.border, backgroundColor: t.surface2, borderRadius: 10, padding: 10, marginBottom: 12 }}>
      <Chips label="Splits" options={[{ value: "km" as const, label: "km" }, { value: "mi" as const, label: "mi" }]} value={unit} onChange={(u) => u && setUnit(u)} />
      <Field
        label={`Splits, one per ${UNIT_NAME[unit]}`}
        value={text}
        onChangeText={setText}
        placeholder="5:12 5:08 5:01 4:58 …"
        multiline
        autoCorrect={false}
        style={{ minHeight: 64, textAlignVertical: "top", paddingTop: 10 }}
      />
      <Text style={{ color: t.muted, fontSize: 12, marginTop: -8, marginBottom: 6 }}>Whole {UNIT_NAME[unit]} splits in order. Leave out a partial last one.</Text>
      {best ? (
        <>
          <Text style={{ color: t.text, fontSize: 15 }}>
            Fastest {def.name}: <Text style={{ fontWeight: "700" }}>{formatClock(best.sec)}</Text> <Text style={{ color: t.muted }}>({range})</Text>
          </Text>
          <Button title="Use this time" variant="secondary" onPress={() => onUse(best.sec, `From splits, ${range}`)} />
        </>
      ) : line ? (
        <Text style={{ color: "error" in parsed ? t.danger : t.muted, fontSize: 12 }}>{line}</Text>
      ) : null}
    </View>
  );
}
