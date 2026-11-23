import { useState } from "react";
import { View } from "react-native";
import { DISTANCE_TYPES } from "@et/core/activities";
import { describeDuration, displayToMeters, distanceUnit, formatDuration, formatMinutesInput, intervalTotalSec, metersToDisplay, parseMinutesInput } from "@et/core/domain";
import { extraBeyondIntervals, formatPace, plannedTimeSec, type ExtraAs } from "@et/core/quick-done";
import type { Units, Workout } from "@et/core/types";
import { api } from "@/api/client";
import { useTheme } from "@/theme";
import { Body, Button } from "@/ui";
import { Chips, Row, SmallField } from "@/ui/form";

/**
 * Log a planned workout as done with what really happened, without the full form: time and distance
 * prefilled from the plan, pace shown, and time past the planned intervals counted as a warm-up or
 * cool-down. The same as the website's Quick Done (POST /workouts/:date/:id/quick-done).
 */
export function QuickDone({
  w,
  units,
  run,
  onMore,
  onClose,
}: {
  w: Workout;
  units: Units;
  run: (f: () => Promise<unknown>) => void;
  /** Open the full form, as completed. */
  onMore: () => void;
  onClose: () => void;
}) {
  const t = useTheme();
  const base = w.actual ?? w.planned;
  const showDistance = DISTANCE_TYPES.has(w.type);
  const [dist, setDist] = useState(base?.distanceM ? String(Math.round(metersToDisplay(base.distanceM, units) * 100) / 100) : "");
  const [time, setTime] = useState(formatMinutesInput(plannedTimeSec(base)));
  const [extraAs, setExtraAs] = useState<ExtraAs>("cooldown");

  const parsed = parseMinutesInput(time);
  const timeBad = parsed != null && Number.isNaN(parsed);
  const timeSec = timeBad ? undefined : parsed;
  const distNum = dist.trim() ? Number(dist) : undefined;
  const distBad = distNum != null && (!isFinite(distNum) || distNum <= 0);
  const distanceM = showDistance && distNum != null && !distBad ? displayToMeters(distNum, units) : undefined;
  const total = intervalTotalSec(base?.intervals);
  const extra = extraBeyondIntervals(base, timeSec);
  const short = total && timeSec ? total - timeSec : 0;
  const pace = showDistance ? formatPace(timeSec, distanceM, units) : undefined;

  return (
    <View style={{ marginTop: 8, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: t.border, backgroundColor: t.surface2 }}>
      <Row>
        {showDistance && (
          <SmallField
            label={`Distance (${distanceUnit(units)})`}
            value={dist}
            onChangeText={setDist}
            keyboardType="decimal-pad"
            placeholder="5.14"
            bad={distBad}
            hint={distBad ? "Enter a distance like 5.14" : undefined}
          />
        )}
        <SmallField
          label="Time"
          value={time}
          onChangeText={setTime}
          keyboardType="numbers-and-punctuation"
          placeholder="36:07"
          bad={timeBad}
          hint={parsed == null ? undefined : timeBad ? "Try 45, 87:45 or 1:27:45" : `= ${describeDuration(parsed)}`}
        />
      </Row>
      {extra > 0 && total ? (
        <Chips
          label={`${formatDuration(extra)} more than your intervals (${formatDuration(total)}). Count it as:`}
          options={[
            { value: "warmup" as const, label: "Warm-up" },
            { value: "cooldown" as const, label: "Cool-down" },
          ]}
          value={extraAs}
          onChange={(v) => v && setExtraAs(v)}
        />
      ) : short > 0 ? (
        <Body muted>{formatDuration(short)} shorter than your intervals ({formatDuration(total!)}).</Body>
      ) : null}
      {pace ? <Body muted>Pace {pace}</Body> : null}
      <Button
        title="Save"
        disabled={timeBad || distBad}
        onPress={() => {
          run(() => api(`/workouts/${w.date}/${w.id}/quick-done`, { body: { timeSec, distanceM, extraAs } }));
          onClose();
        }}
      />
      <Button title="More details…" variant="secondary" onPress={onMore} />
      <Button title="Cancel" variant="link" onPress={onClose} />
    </View>
  );
}
