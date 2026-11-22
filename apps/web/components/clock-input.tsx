"use client";

import type { InputHTMLAttributes } from "react";
import { clockEntry, clockEntryError, describeDuration, parseClock } from "@et/core/domain";
import { cx, Input } from "./ui";

/**
 * A time field that works with a phone's number pad, which has no ":" key. Digits fill from
 * the right and the colons are added (type 2 5 3 1 -> 25:31), like a timer. The decimal pad
 * keeps its "." for a swim's tenths. Below it, a check of how the time was read.
 */
export function ClockInput({
  value,
  onChange,
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  value: string;
  onChange: (value: string) => void;
}) {
  const error = value ? clockEntryError(value) : null;
  const sec = value ? parseClock(value) : NaN;
  return (
    <>
      <Input
        {...props}
        inputMode="decimal"
        autoComplete="off"
        placeholder="0:00"
        value={value}
        onChange={(e) => {
          const next = clockEntry(e.target.value, value);
          onChange(next);
          // The text is rebuilt on every keystroke, so keep the caret at the end where digits go in.
          const el = e.target;
          requestAnimationFrame(() => el.setSelectionRange(next.length, next.length));
        }}
        aria-invalid={error ? true : undefined}
        className={cx("tabular-nums", error && "border-danger focus:border-danger", className)}
      />
      {value && (
        <span className={cx("text-xs", error ? "text-danger" : "text-muted")} aria-live="polite">
          {error ?? (Number.isFinite(sec) && sec > 0 ? `= ${describeDuration(sec)}` : "Type the digits; the colons fill in")}
        </span>
      )}
    </>
  );
}
