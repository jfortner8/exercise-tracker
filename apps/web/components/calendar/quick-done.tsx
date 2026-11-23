"use client";

import { Check, X } from "lucide-react";
import { useState, useTransition } from "react";
import { quickDoneAction } from "@/lib/actions";
import { DISTANCE_TYPES } from "@et/core/activities";
import {
  displayToMeters,
  distanceUnit,
  formatDuration,
  formatMinutesInput,
  intervalTotalSec,
  metersToDisplay,
  parseMinutesInput,
} from "@et/core/domain";
import { extraBeyondIntervals, formatPace, plannedTimeSec, quickActual, type ExtraAs } from "@et/core/quick-done";
import type { Units, Workout } from "@et/core/types";
import { Button, Field, Input, cx } from "../ui";
import { MinutesInput } from "../workouts/workout-form";

/**
 * Log a planned workout as done with what really happened, without the full form: distance and time,
 * both prefilled from the plan. Time past the planned intervals is asked about (warm-up or cool-down).
 */
export function QuickDone({
  workout: w,
  units,
  onMore,
  onClose,
}: {
  workout: Workout;
  units: Units;
  /** Open the full form with what's been entered so far. */
  onMore: (draft: Workout) => void;
  onClose: () => void;
}) {
  const base = w.actual ?? w.planned;
  const showDistance = DISTANCE_TYPES.has(w.type);
  const [dist, setDist] = useState(base?.distanceM ? String(Math.round(metersToDisplay(base.distanceM, units) * 100) / 100) : "");
  const [time, setTime] = useState(formatMinutesInput(plannedTimeSec(base)));
  const [extraAs, setExtraAs] = useState<ExtraAs>("cooldown");
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();

  const parsedTime = parseMinutesInput(time);
  const timeBad = parsedTime != null && Number.isNaN(parsedTime);
  const timeSec = timeBad ? undefined : parsedTime;
  const distNum = dist.trim() ? Number(dist) : undefined;
  const distBad = distNum != null && (!isFinite(distNum) || distNum <= 0);
  const distanceM = showDistance && distNum != null && !distBad ? displayToMeters(distNum, units) : undefined;
  const total = intervalTotalSec(base?.intervals);
  const extra = extraBeyondIntervals(base, timeSec);
  const short = total && timeSec ? total - timeSec : 0;
  const pace = showDistance ? formatPace(timeSec, distanceM, units) : undefined;
  const input = { timeSec, distanceM, extraAs };

  return (
    <form
      className="mt-3 space-y-3 rounded-lg border border-border bg-surface-2/40 p-3"
      aria-label={`Log ${w.title} as done`}
      onSubmit={(e) => {
        e.preventDefault();
        if (timeBad || distBad) return;
        setError(false);
        start(async () => {
          try {
            await quickDoneAction(w.date, w.id, input);
            onClose();
          } catch {
            setError(true);
          }
        });
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        {showDistance && (
          <Field label={`Distance (${distanceUnit(units)})`}>
            <Input
              autoFocus
              inputMode="decimal"
              value={dist}
              onChange={(e) => setDist(e.target.value)}
              placeholder="5.14"
              aria-invalid={distBad || undefined}
              className={cx(distBad && "border-danger focus:border-danger")}
            />
            {distBad && <span className="text-xs text-danger">Enter a distance like 5.14</span>}
          </Field>
        )}
        <Field label="Time">
          <MinutesInput value={time} onChange={(e) => setTime(e.target.value)} placeholder="36:07" />
        </Field>
      </div>

      {extra > 0 && total ? (
        <div className="space-y-1.5 text-sm" role="group" aria-label="Count the extra time as">
          <p>
            {formatDuration(extra)} more than your intervals ({formatDuration(total)}). Count it as:
          </p>
          <div className="inline-flex rounded-lg border border-border p-0.5">
            {(["warmup", "cooldown"] as const).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={extraAs === k}
                onClick={() => setExtraAs(k)}
                className={cx(
                  "rounded-md px-3 py-1 text-sm",
                  extraAs === k ? "bg-accent text-accent-fg" : "text-muted hover:bg-surface-2",
                )}
              >
                {k === "warmup" ? "Warm-up" : "Cool-down"}
              </button>
            ))}
          </div>
        </div>
      ) : short > 0 ? (
        <p className="text-xs text-muted">{formatDuration(short)} shorter than your intervals ({formatDuration(total!)}).</p>
      ) : null}

      {pace && <p className="text-xs tabular-nums text-muted">Pace {pace}</p>}
      {error && <p className="text-xs text-danger">Couldn&apos;t save that. Try again.</p>}

      <div className="flex flex-wrap items-center gap-1.5">
        <Button type="submit" size="sm" variant="primary" disabled={pending || timeBad || distBad}>
          <Check className="size-3.5" /> {pending ? "Saving…" : "Save"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => onMore({ ...w, status: "completed", actual: quickActual(base, input) })}
        >
          More details…
        </Button>
        <Button type="button" size="sm" variant="ghost" className="ml-auto size-8 px-0" aria-label="Cancel" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>
    </form>
  );
}
