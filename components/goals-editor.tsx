"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";
import { GOAL_NAME_MAX, GOAL_PRESETS, goalLabel, MAX_GOALS, type Goal } from "@/lib/goals";
import { Button, Field, Input, Select } from "./ui";

type Draft = Pick<Goal, "id" | "name" | "emoji">;

/** Settings: the user's yes/no daily goals, and which one shows on the calendar. Saved with the form. */
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
  const full = goals.length >= MAX_GOALS;
  const taken = (n: string) => goals.some((g) => g.name.trim().toLowerCase() === n.trim().toLowerCase());
  const presets = GOAL_PRESETS.filter((p) => !goals.some((g) => g.id === p.id));
  const add = (g: Draft) => onChange([...goals, g]);
  const addCustom = () => {
    const n = name.trim();
    if (!n || taken(n) || full) return;
    add({ id: crypto.randomUUID().replace(/-/g, ""), name: n });
    setName("");
  };
  const shown = goals.find((g) => g.id === onCalendar) ?? goals[0];

  return (
    <fieldset>
      <legend className="text-sm font-medium">Daily goals</legend>
      <p className="mt-0.5 text-sm text-muted">Yes-or-no things to do each day. Check them off from the day view.</p>

      {goals.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {goals.map((g, i) => (
            <li key={g.id} className="flex items-center gap-2">
              {g.emoji && (
                <span className="w-5 text-center" aria-hidden>
                  {g.emoji}
                </span>
              )}
              <Input
                value={g.name}
                maxLength={GOAL_NAME_MAX}
                aria-label="Goal name"
                onChange={(e) => onChange(goals.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                className="h-8 min-w-0 flex-1 text-sm"
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="size-8 shrink-0 px-0"
                aria-label={`Remove ${g.name}`}
                onClick={() => {
                  if (confirm(`Stop tracking "${g.name}"? Your check-offs are kept if you add it back.`))
                    onChange(goals.filter((_, j) => j !== i));
                }}
              >
                <X className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {!full && (
        <>
          <div className="mt-2 flex gap-2">
            <Input
              value={name}
              maxLength={GOAL_NAME_MAX}
              placeholder="Add a goal, e.g. Meditated"
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
          {presets.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {presets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={taken(p.name)}
                  onClick={() => add(p)}
                  className="rounded-full border border-border px-2.5 py-1 text-xs hover:bg-surface-2 disabled:opacity-50"
                >
                  + {goalLabel(p)}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {goals.length > 1 && (
        <Field label="Show on calendar" className="mt-3 max-w-xs">
          <Select value={shown?.id} onChange={(e) => onPick(e.target.value)}>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>
                {goalLabel(g)}
              </option>
            ))}
          </Select>
        </Field>
      )}
      {goals.length > 0 && (
        <p className="mt-2 text-xs text-muted">
          {goals.length > 1 ? "The one you pick shows" : "It shows"} as a ✓ on each calendar day, with a weekly score.
        </p>
      )}
    </fieldset>
  );
}
