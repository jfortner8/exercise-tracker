import type { WorkoutStatus, WorkoutType } from "./types";

/** Label + a Tailwind color family name for each workout type. Classes are listed in full for Tailwind's scanner. */
/** emoji is the activity's icon in the picker, on cards and on the calendar. */
export const TYPE_META: Record<WorkoutType, { label: string; emoji: string; solid: string; outline: string; dot: string }> = {
  run: { emoji: "🏃", label: "Run", solid: "bg-orange-500 text-white", outline: "border-orange-500 text-orange-700 dark:text-orange-300", dot: "bg-orange-500" },
  walk: { emoji: "🚶", label: "Walk", solid: "bg-amber-500 text-white", outline: "border-amber-500 text-amber-700 dark:text-amber-300", dot: "bg-amber-500" },
  swim: { emoji: "🏊", label: "Swim", solid: "bg-sky-500 text-white", outline: "border-sky-500 text-sky-700 dark:text-sky-300", dot: "bg-sky-500" },
  bike: { emoji: "🚴", label: "Bike", solid: "bg-cyan-600 text-white", outline: "border-cyan-600 text-cyan-700 dark:text-cyan-300", dot: "bg-cyan-600" },
  row: { emoji: "🚣", label: "Row", solid: "bg-indigo-500 text-white", outline: "border-indigo-500 text-indigo-700 dark:text-indigo-300", dot: "bg-indigo-500" },
  strength: { emoji: "🏋️", label: "Strength", solid: "bg-violet-600 text-white", outline: "border-violet-600 text-violet-700 dark:text-violet-300", dot: "bg-violet-600" },
  plyo: { emoji: "⚡", label: "Plyo", solid: "bg-fuchsia-600 text-white", outline: "border-fuchsia-600 text-fuchsia-700 dark:text-fuchsia-300", dot: "bg-fuchsia-600" },
  yoga: { emoji: "🧘", label: "Yoga", solid: "bg-teal-600 text-white", outline: "border-teal-600 text-teal-700 dark:text-teal-300", dot: "bg-teal-600" },
  mobility: { emoji: "🤸", label: "Stretch / mobility", solid: "bg-emerald-600 text-white", outline: "border-emerald-600 text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-600" },
  sport: { emoji: "🏅", label: "Sport", solid: "bg-lime-600 text-white", outline: "border-lime-600 text-lime-700 dark:text-lime-300", dot: "bg-lime-600" },
  dance: { emoji: "💃", label: "Dance", solid: "bg-pink-500 text-white", outline: "border-pink-500 text-pink-700 dark:text-pink-300", dot: "bg-pink-500" },
  rest: { emoji: "🌙", label: "Rest", solid: "bg-slate-400 text-white", outline: "border-slate-400 text-slate-600 dark:text-slate-300", dot: "bg-slate-400" },
  other: { emoji: "✨", label: "Other", solid: "bg-zinc-600 text-white", outline: "border-zinc-500 text-zinc-700 dark:text-zinc-300", dot: "bg-zinc-500" },
};

export const STATUS_LABEL: Record<WorkoutStatus | "needs_review", string> = {
  planned: "Planned",
  completed: "Completed",
  partial: "Partially done",
  skipped: "Skipped",
  missed: "Missed",
  substituted: "Did something else",
  needs_review: "Needs review",
};
