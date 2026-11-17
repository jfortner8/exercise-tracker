import { detailsDurationSec, DONE_STATUSES, formatDistance, formatDuration } from "./domain";
import { sportCategory, sportMeta } from "./sports";
import type { Units, Workout, WorkoutType } from "./types";
import { TYPE_META } from "./workout-types";

/**
 * An "activity" is what the picker offers: a workout type ("run") or a specific sport
 * ("sport:soccer"), so recent sports can be one tap.
 */
export type ActivityKey = string;

export function activityKey(w: Pick<Workout, "type" | "sport">): ActivityKey {
  return w.type === "sport" && w.sport && w.sport !== "other" ? `sport:${w.sport}` : w.type;
}

export function activityMeta(key: ActivityKey): { label: string; emoji: string } {
  if (key.startsWith("sport:")) {
    const s = sportMeta(key.slice(6));
    if (s) return { label: s.label, emoji: s.emoji };
  }
  const t = TYPE_META[key as WorkoutType];
  return t ? { label: t.label, emoji: t.emoji } : { label: key, emoji: "✨" };
}

/** What choosing an activity sets on the form. */
export function applyActivity(key: ActivityKey): { type: WorkoutType; sport?: string } {
  if (key.startsWith("sport:")) return { type: "sport", sport: key.slice(6) };
  return { type: key as WorkoutType };
}

/** The user's most recent distinct activities, newest first (rest days left out). */
export function recentActivities(workouts: Workout[], n = 3): ActivityKey[] {
  const sorted = [...workouts].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  const out: ActivityKey[] = [];
  for (const w of sorted) {
    if (w.type === "rest") continue;
    const k = activityKey(w);
    if (!out.includes(k)) out.push(k);
    if (out.length === n) break;
  }
  return out;
}

/** Category line for a workout: "🏃 Run", "🛼 Roller derby practice". */
export function workoutCategory(w: Pick<Workout, "type" | "sport" | "sportName" | "sportSession">) {
  if (w.type === "sport") {
    const label = sportCategory(w);
    if (label) return { emoji: sportMeta(w.sport)?.emoji ?? TYPE_META.sport.emoji, label };
  }
  return { emoji: TYPE_META[w.type].emoji, label: TYPE_META[w.type].label };
}

/** Types whose calendar block shows time · distance. */
export const METRIC_TYPES = new Set<WorkoutType>(["run", "walk", "swim", "bike", "row"]);

/** "1:27'45" · 11.0 km" from what was done (or planned, if not done yet); undefined if nothing to show. */
export function blockMetrics(w: Workout, units: Units): string | undefined {
  if (!METRIC_TYPES.has(w.type)) return undefined;
  const d = DONE_STATUSES.has(w.status) ? (w.actual ?? w.planned) : w.planned;
  const dur = detailsDurationSec(d);
  const parts = [dur ? formatDuration(dur) : "", d?.distanceM ? formatDistance(d.distanceM, units) : ""].filter(Boolean);
  return parts.length ? parts.join(" · ") : undefined;
}
