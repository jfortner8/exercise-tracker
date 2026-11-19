import type { DayLog, Profile } from "./types";

/** A yes/no thing to do each day ("Stretched"). Check-offs are stored on the day by `id`. */
export interface Goal {
  id: string;
  name: string;
  emoji?: string;
  /** The day the goal was added; unchecked days before it stay blank. */
  start: string;
}

export const MAX_GOALS = 8;
export const GOAL_NAME_MAX = 40;

/** Quick-add goals. Fixed ids, so removing and re-adding one brings its check-offs back. */
export const GOAL_PRESETS: { id: string; name: string; emoji: string }[] = [
  { id: "stretch", name: "Stretched", emoji: "🧘" },
  { id: "protein", name: "Enough protein", emoji: "🥩" },
  { id: "sleep", name: "8h sleep", emoji: "😴" },
  { id: "water", name: "Drank water", emoji: "💧" },
  { id: "vitamins", name: "Took vitamins", emoji: "💊" },
  { id: "steps", name: "10k steps", emoji: "🚶" },
];

export const goalLabel = (g: Pick<Goal, "name" | "emoji">) => (g.emoji ? `${g.emoji} ${g.name}` : g.name);

export const goalDone = (log: DayLog | undefined, id: string) => !!log?.goalsDone?.includes(id);

/**
 * A goal on a day: true (done), false (not done), or null (blank). Days from the later of the user's
 * first day and the goal's start through today are done or not; earlier days and the future are blank,
 * except that a check-off always shows.
 */
export function goalOnDay(goal: Goal, date: string, today: string, firstDay: string | null, log?: DayLog): boolean | null {
  if (goalDone(log, goal.id)) return true;
  if (!today || date > today || !firstDay || date < firstDay || date < goal.start) return null;
  return false;
}

/** The goal shown on the calendar: the chosen one, else the first. */
export function calendarGoal(p: Partial<Pick<Profile, "goals" | "goalOnCalendar">>): Goal | null {
  const goals = p.goals ?? [];
  return goals.find((g) => g.id === p.goalOnCalendar) ?? goals[0] ?? null;
}

/** Done days out of the week's countable days (blank days don't count). */
export function weekGoalTally(goal: Goal, week: string[], today: string, firstDay: string | null, logFor: (d: string) => DayLog | undefined) {
  const states = week.map((d) => goalOnDay(goal, d, today, firstDay, logFor(d))).filter((s) => s != null);
  return { done: states.filter(Boolean).length, of: states.length };
}

/**
 * Tidy a goal list from the settings form: trims names, drops blanks and case-insensitive duplicates,
 * caps the count, keeps known starts and gives new goals today's date.
 */
export function cleanGoals(
  input: { id: string; name: string; emoji?: string }[],
  existing: Goal[] | undefined,
  today: string,
): Goal[] {
  const seen = new Set<string>();
  const out: Goal[] = [];
  for (const g of input) {
    const name = g.name.trim().slice(0, GOAL_NAME_MAX);
    const key = name.toLowerCase();
    if (!name || seen.has(key) || out.some((o) => o.id === g.id)) continue;
    seen.add(key);
    const start = existing?.find((e) => e.id === g.id)?.start ?? today;
    out.push({ id: g.id, name, ...(g.emoji ? { emoji: g.emoji } : {}), start });
    if (out.length === MAX_GOALS) break;
  }
  return out;
}
