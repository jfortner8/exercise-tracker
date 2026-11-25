"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";
import { GOAL_NAME_MAX, GOAL_PRESETS, goalLabel, MAX_GOALS, type Goal } from "@et/core/goals";
import { Button, Field, Input, Select } from "./ui";

type Draft = Pick<Goal, "id" | "name" | "emoji" | "off">;

/**
 * Settings: tick the yes/no goals to track (they appear in the day view), then pick one of those
 * for the calendar. The common goals are always listed; your own are added below them.
 * Unticking keeps a goal (and its check-offs) so ticking it again restores it. Saved as soon as it changes.
 */
export function GoalsEditor({
  goals,
  onCalendar,
  onChange,
  onPick,
}: {
  goals: Draft[];
  onCalendar?: string;
  onChange: (goals: Draft[]) => void;
  onPick: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const tracked = goals.filter((g) => !g.off);
  const full = tracked.length >= MAX_GOALS;
  const presetIds = new Set(GOAL_PRESETS.map((p) => p.id));
  const custom = goals.filter((g) => !presetIds.has(g.id));
  const rows: { goal: Draft; on: boolean; preset: boolean }[] = [
    ...GOAL_PRESETS.map((p) => {
      const saved = goals.find((g) => g.id === p.id);
      return { goal: saved ?? p, on: !!saved && !saved.off, preset: true };
    }),
    ...custom.map((g) => ({ goal: g, on: !g.off, preset: false })),
  ];
  const taken = (n: string) => rows.some((r) => r.goal.name.trim().toLowerCase() === n.trim().toLowerCase());

  const setOn = (g: Draft, on: boolean) =>
    goals.some((x) => x.id === g.id)
      ? onChange(goals.map((x) => (x.id === g.id ? { ...x, off: !on } : x)))
      : onChange([...goals, { ...g, off: !on }]);
  const addCustom = () => {
    const n = name.trim();
    if (!n || taken(n)) return;
    onChange([...goals, { id: crypto.randomUUID().replace(/-/g, ""), name: n, off: full }]);
    setName("");
  };
  const shown = tracked.find((g) => g.id === onCalendar) ?? tracked[0];

  return (
    <fieldset>
      <legend className="text-sm font-medium">Daily goals</legend>
      <p className="mt-0.5 text-sm text-muted">
        Yes-or-no things to do each day. Tick the ones to track and check them off from the day view.
      </p>

      <ul className="mt-2 space-y-1.5">
        {rows.map(({ goal: g, on, preset }) => (
          <li key={g.id} className="flex min-h-8 items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 shrink-0 accent-[var(--accent)]"
              checked={on}
              disabled={!on && full}
              aria-label={`Track ${g.name}`}
              onChange={(e) => setOn(g, e.target.checked)}
            />
            <span className="w-5 shrink-0 text-center" aria-hidden>
              {g.emoji}
            </span>
            {preset ? (
              <span>{g.name}</span>
            ) : (
              <>
                <Input
                  value={g.name}
                  maxLength={GOAL_NAME_MAX}
                  aria-label="Goal name"
                  onChange={(e) => onChange(goals.map((x) => (x.id === g.id ? { ...x, name: e.target.value } : x)))}
                  className="h-8 min-w-0 flex-1 text-sm"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="size-8 shrink-0 px-0"
                  aria-label={`Delete ${g.name}`}
                  onClick={() => {
                    if (confirm(`Delete "${g.name}"? Its check-offs will no longer show. To pause it instead, untick it.`))
                      onChange(goals.filter((x) => x.id !== g.id));
                  }}
                >
                  <X className="size-4" />
                </Button>
              </>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-2 flex gap-2">
        <Input
          value={name}
          maxLength={GOAL_NAME_MAX}
          placeholder="Your own, e.g. Meditated"
          aria-label="New goal"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustom();
            }
          }}
          className="h-8 min-w-0 flex-1 text-sm"
        />
        <Button type="button" size="sm" variant="secondary" disabled={!name.trim() || taken(name)} onClick={addCustom}>
          <Plus className="size-3.5" /> Add
        </Button>
      </div>
      {name.trim() && taken(name) && <p className="mt-1 text-xs text-danger">You already have that goal.</p>}
      {full && <p className="mt-1 text-xs text-muted">You&apos;re tracking {MAX_GOALS}, the most at once. Untick one to track another.</p>}

      {tracked.length > 1 && (
        <Field label="Show on calendar" className="mt-3 max-w-xs">
          <Select value={shown?.id} onChange={(e) => onPick(e.target.value)}>
            {tracked.map((g) => (
              <option key={g.id} value={g.id}>
                {goalLabel(g)}
              </option>
            ))}
          </Select>
        </Field>
      )}
      {tracked.length > 0 && (
        <p className="mt-2 text-xs text-muted">
          {tracked.length > 1 ? "The one you pick shows" : "It shows"} as a ✓ on each calendar day, with a weekly score.
        </p>
      )}
    </fieldset>
  );
}
