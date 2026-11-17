"use client";

import { format, parseISO } from "date-fns";
import { useState, useTransition } from "react";
import { copyWeekAction } from "@/lib/actions";
import { Sheet } from "../sheet";
import { Button, Field, Input } from "../ui";

export function CopyWeekDialog({
  from,
  defaultTo,
  count,
  onClose,
}: {
  from: string;
  defaultTo: string;
  count: number;
  onClose: () => void;
}) {
  const [to, setTo] = useState(defaultTo);
  const [times, setTimes] = useState(1);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <Sheet
      variant="dialog"
      title="Copy week"
      subtitle={`Week of ${format(parseISO(from), "MMM d")} · ${count} workout${count === 1 ? "" : "s"}`}
      onClose={onClose}
    >
      {count === 0 ? (
        <p className="text-sm text-muted">This week has no workouts to copy yet.</p>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await copyWeekAction(from, to, times);
              setMsg(`Added ${r.copied} planned workouts.`);
              setTimeout(onClose, 900);
            });
          }}
        >
          <p className="text-sm text-muted">
            Copies are added as <strong>planned</strong> workouts on the same weekdays. Results and notes aren&apos;t
            copied.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Starting the week of">
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} required />
            </Field>
            <Field label="Repeat for" hint="weeks in a row">
              <Input
                type="number"
                min={1}
                max={52}
                value={times}
                onChange={(e) => setTimes(Math.max(1, Math.min(52, Number(e.target.value) || 1)))}
              />
            </Field>
          </div>
          {msg && <p className="text-sm text-accent-ink">{msg}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "Copying…" : `Copy ${count * times} workout${count * times === 1 ? "" : "s"}`}
            </Button>
          </div>
        </form>
      )}
    </Sheet>
  );
}
