"use client";

import { useState, useTransition } from "react";
import { saveProfileAction } from "@/lib/actions";
import type { DistanceUnit, Profile, WeightUnit } from "@/lib/types";
import { Button, Card, Field, Input, Select, cx } from "./ui";

export function SettingsForm({ profile }: { profile: Profile }) {
  const [p, setP] = useState(profile);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setSaved(false);
        start(async () => {
          await saveProfileAction({
            displayName: p.displayName,
            units: p.units,
            weekStartsOn: p.weekStartsOn,
            trackDrinks: p.trackDrinks,
          });
          setSaved(true);
        });
      }}
    >
      <Card className="divide-y divide-border">
        <div className="space-y-4 p-5">
          <Field label="Display name">
            <Input value={p.displayName} onChange={(e) => setP({ ...p, displayName: e.target.value })} required />
          </Field>
          <Field label="Email">
            <Input value={p.email} disabled />
          </Field>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label="Distance">
              <Select
                value={p.units.distance}
                onChange={(e) => setP({ ...p, units: { ...p.units, distance: e.target.value as DistanceUnit } })}
              >
                <option value="km">Kilometers</option>
                <option value="mi">Miles</option>
              </Select>
            </Field>
            <Field label="Weight">
              <Select
                value={p.units.weight}
                onChange={(e) => setP({ ...p, units: { ...p.units, weight: e.target.value as WeightUnit } })}
              >
                <option value="lb">Pounds (lb)</option>
                <option value="kg">Kilograms (kg)</option>
              </Select>
            </Field>
            <Field label="Week starts on">
              <Select
                value={p.weekStartsOn}
                onChange={(e) => setP({ ...p, weekStartsOn: Number(e.target.value) as 0 | 1 })}
              >
                <option value={1}>Monday</option>
                <option value={0}>Sunday</option>
              </Select>
            </Field>
          </div>
        </div>
        <div className="p-5">
          <h2 className="mb-3 text-sm font-semibold">Optional tracking</h2>
          <Toggle
            checked={p.trackDrinks}
            onChange={(v) => setP({ ...p, trackDrinks: v })}
            label="Track drinks"
            description="Adds a drinks counter to each day and a weekly total to the calendar. Hidden everywhere when off."
          />
        </div>
      </Card>
      <div className="mt-4 flex items-center justify-end gap-3">
        {saved && <span className="text-sm text-muted">Saved</span>}
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </form>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx(
          "relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors",
          checked ? "bg-accent" : "bg-border",
        )}
      >
        <span
          className={cx(
            "absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-4" : "translate-x-0.5",
          )}
        />
      </button>
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-sm text-muted">{description}</span>
      </span>
    </label>
  );
}
