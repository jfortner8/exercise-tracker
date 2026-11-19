import type { DayLog, Profile } from "./types";

/** Daily counters a user can opt into. Fewer is better for all of them. */
export const HABIT_KINDS = ["alcohol", "sugary", "tobacco"] as const;
export type HabitKind = (typeof HABIT_KINDS)[number];

/** The DayLog field each counter is stored in. Alcohol keeps the original `drinks` field. */
export type HabitField = "drinks" | "sugaryDrinks" | "tobacco";

export interface HabitMeta {
  kind: HabitKind;
  /** Settings checkbox. */
  label: string;
  /** Day-view stepper. */
  short: string;
  noun: (n: number) => string;
  field: HabitField;
  /** What − and + change by. */
  step: number;
  max: number;
  /** The counts where each of colour levels 1–6 starts (level 0 is zero). */
  levels: [number, number, number, number, number, number];
}

export const HABITS: Record<HabitKind, HabitMeta> = {
  alcohol: {
    kind: "alcohol",
    label: "Alcoholic drinks",
    short: "Drinks",
    noun: (n) => (n === 1 ? "drink" : "drinks"),
    field: "drinks",
    step: 0.5,
    max: 50,
    levels: [1, 2, 3, 4, 5, 6],
  },
  sugary: {
    kind: "sugary",
    label: "Sugary drinks",
    short: "Sugary drinks",
    noun: (n) => (n === 1 ? "sugary drink" : "sugary drinks"),
    field: "sugaryDrinks",
    step: 1,
    max: 50,
    levels: [1, 2, 3, 4, 5, 6],
  },
  tobacco: {
    kind: "tobacco",
    label: "Tobacco & nicotine",
    short: "Tobacco",
    noun: (n) => (n === 1 ? "tobacco use" : "tobacco uses"),
    field: "tobacco",
    step: 1,
    max: 100,
    // A pack a day is the deepest red.
    levels: [1, 3, 6, 10, 15, 20],
  },
};

/** A start date earlier than anyone's first day: the counter counts from the first day. */
export const HABIT_SINCE_FIRST_DAY = "2000-01-01";

export const isHabitKind = (k: unknown): k is HabitKind => HABIT_KINDS.includes(k as HabitKind);

/** A counter's logged number for a day, if any. */
export function habitCount(log: DayLog | undefined, kind: HabitKind): number | undefined {
  return log?.[HABITS[kind].field];
}

/** Colour level 0–6 for a count (indexes DRINK_COLORS). Half drinks round down. */
export function habitLevel(kind: HabitKind, n: number): number {
  const levels = HABITS[kind].levels;
  let level = 0;
  for (let i = 0; i < levels.length; i++) if (Math.floor(n) >= levels[i]) level = i + 1;
  return level;
}

/**
 * What to show for a counter on a day, or null for blank. A logged count always shows; otherwise an
 * unlogged day counts as 0 from the later of the user's first day and the day they started this
 * counter, through today. Before that, and in the future, it's blank.
 */
export function habitOnDay(
  kind: HabitKind,
  date: string,
  today: string,
  firstDay: string | null,
  start: string | undefined,
  log?: DayLog,
): number | null {
  const logged = habitCount(log, kind);
  if (logged != null) return logged;
  if (!today || date > today || !firstDay || date < firstDay) return null;
  if (start && date < start) return null;
  return 0;
}

/** The counters a user has ticked, in display order. Old profiles had only "Track drinks". */
export function profileHabits(p: Partial<Pick<Profile, "habits" | "trackDrinks">>): HabitKind[] {
  const on = p.habits ?? (p.trackDrinks ? ["alcohol"] : []);
  return HABIT_KINDS.filter((k) => on.includes(k));
}

/** The one counter shown on the calendar, or null when none is ticked. */
export function calendarHabit(p: Partial<Pick<Profile, "habits" | "trackDrinks" | "habitOnCalendar">>): HabitKind | null {
  const on = profileHabits(p);
  if (p.habitOnCalendar && on.includes(p.habitOnCalendar)) return p.habitOnCalendar;
  return on[0] ?? null;
}
