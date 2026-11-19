"use client";

import { useState, useTransition } from "react";
import { saveProfileAction } from "@/lib/actions";
import { calendarHabit, HABIT_KINDS, HABITS, profileHabits, type HabitKind } from "@/lib/habits";
import { HabitIcon } from "./habit-icon";
import type { Clock, DistanceUnit, Profile, Share, WeightUnit } from "@/lib/types";
import { ThemeSwitch } from "./theme-switch";
import { Button, Card, Field, Input, Select, cx } from "./ui";

const SHARE_OPTIONS: { value: Share; label: string; description: string }[] = [
  { value: "off", label: "Nobody", description: "You don't appear on any leaderboard." },
  {
    value: "circle",
    label: "Friends & clubs",
    description: "Your friends and the members of your clubs. Not on the Everyone board.",
  },
  { value: "everyone", label: "Everyone", description: "Friends and clubs, plus the Everyone board that anyone with an account can see." },
];

export function SettingsForm({ profile }: { profile: Profile }) {
  const [p, setP] = useState(profile);
  const habits = profileHabits(p);
  const toggleHabit = (k: HabitKind, on: boolean) =>
    setP({ ...p, habits: HABIT_KINDS.filter((h) => (h === k ? on : habits.includes(h))) });
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
            clock: p.clock ?? "12h",
            habits,
            habitOnCalendar: calendarHabit(p) ?? undefined,
            share: p.share,
            trackWeight: p.trackWeight,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
            <Field label="Time format">
              <Select value={p.clock ?? "12h"} onChange={(e) => setP({ ...p, clock: e.target.value as Clock })}>
                <option value="12h">12-hour (6:30 PM)</option>
                <option value="24h">24-hour (18:30)</option>
              </Select>
            </Field>
          </div>
        </div>
        <div className="p-5">
          <h2 className="text-sm font-semibold">Appearance</h2>
          <p className="mb-3 mt-0.5 text-sm text-muted">Saved on this device and applied right away.</p>
          <ThemeSwitch />
        </div>
        <div className="p-5">
          <h2 className="mb-3 text-sm font-semibold">Optional tracking</h2>
          <fieldset>
            <legend className="text-sm font-medium">Daily counters</legend>
            <p className="mt-0.5 text-sm text-muted">
              Count these from the day view. Turning one off hides it but keeps what you logged.
            </p>
            <div className="mt-2 space-y-1.5">
              {HABIT_KINDS.map((k) => (
                <label key={k} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--accent)]"
                    checked={habits.includes(k)}
                    onChange={(e) => toggleHabit(k, e.target.checked)}
                  />
                  <HabitIcon kind={k} className="size-4 text-muted" />
                  {HABITS[k].label}
                </label>
              ))}
            </div>
            {habits.length > 1 && (
              <Field label="Show on calendar" className="mt-3 max-w-xs">
                <Select
                  value={calendarHabit(p) ?? ""}
                  onChange={(e) => setP({ ...p, habitOnCalendar: e.target.value as HabitKind })}
                >
                  {habits.map((k) => (
                    <option key={k} value={k}>
                      {HABITS[k].label}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            {habits.length > 0 && (
              <p className="mt-2 text-xs text-muted">
                {habits.length > 1 ? "The one you pick shows" : "It shows"} on each calendar day, with a weekly total.
              </p>
            )}
          </fieldset>
          <div className="mt-5">
            <Toggle
              checked={p.trackWeight}
              onChange={(v) => setP({ ...p, trackWeight: v })}
              label="Track bodyweight"
              description="Log one weight per day from the day view. It shows on the calendar on days you log it."
            />
          </div>
        </div>
        <fieldset className="p-5">
          <legend className="float-left text-sm font-semibold">Who sees my PBs on leaderboards</legend>
          <p className="clear-left mb-3 pt-0.5 text-sm text-muted">
            Your display name and best results on built-in benchmarks. Custom benchmarks always stay private.
          </p>
          <div className="space-y-2">
            {SHARE_OPTIONS.map((o) => (
              <label
                key={o.value}
                className={cx(
                  "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5",
                  p.share === o.value ? "border-accent bg-accent/5" : "border-border hover:bg-surface-2",
                )}
              >
                <input
                  type="radio"
                  name="share"
                  value={o.value}
                  checked={p.share === o.value}
                  onChange={() => setP({ ...p, share: o.value })}
                  className="mt-1 accent-[var(--accent)]"
                />
                <span>
                  <span className="block text-sm font-medium">{o.label}</span>
                  <span className="block text-sm text-muted">{o.description}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
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
            "absolute left-0 top-0.5 size-4 rounded-full bg-white shadow transition-transform",
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
