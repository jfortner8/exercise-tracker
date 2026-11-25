import { detailsDurationSec, distanceUnit, DONE_STATUSES, formatDistance, formatDuration, metersToDisplay } from "./domain";
import { danceCategory } from "./dance";
import { sportCategory, sportMeta } from "./sports";
import type { Units, Workout, WorkoutDetails, WorkoutType } from "./types";
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

type CategoryFields = Pick<Workout, "type" | "sport" | "sportName" | "sportSession" | "danceStyle" | "danceStyleName" | "danceSession">;

/** Category line for a workout: "🏃 Run", "🛼 Roller derby practice", "💃 Salsa class". */
export function workoutCategory(w: CategoryFields) {
  if (w.type === "sport") {
    const label = sportCategory(w);
    if (label) return { emoji: sportMeta(w.sport)?.emoji ?? TYPE_META.sport.emoji, label };
  }
  if (w.type === "dance") {
    const label = danceCategory(w);
    if (label) return { emoji: TYPE_META.dance.emoji, label };
  }
  return { emoji: TYPE_META[w.type].emoji, label: TYPE_META[w.type].label };
}

/** Capitalizes each word ("roller derby bout" → "Roller Derby Bout"), leaving the rest as typed. */
const titleCase = (s: string) => s.replace(/(^|[\s/(-])(\p{Ll})/gu, (_, sep: string, c: string) => sep + c.toUpperCase());

/**
 * Activities where distance means something: you cover ground. ("Other" can be a hike or a skate.)
 * Sports, strength, yoga, dance and the like don't ask for one.
 */
export const DISTANCE_TYPES = new Set<WorkoutType>(["run", "walk", "swim", "bike", "row", "other"]);

/** A distance or time as a title shows it: "10 km", "6.2 mi", "45 min", "1 h 30 min". */
function titleAmount(d: WorkoutDetails | undefined, units: Units, distance = true): string | undefined {
  if (distance && d?.distanceM) {
    const v = metersToDisplay(d.distanceM, units);
    return `${v >= 1 ? Math.round(v * 10) / 10 : Math.round(v * 100) / 100} ${distanceUnit(units)}`;
  }
  const sec = detailsDurationSec(d);
  if (!sec) return undefined;
  const min = Math.max(1, Math.round(sec / 60));
  const [h, m] = [Math.floor(min / 60), min % 60];
  return [h && `${h} h`, m && `${m} min`].filter(Boolean).join(" ");
}

/**
 * The title a workout gets when none is typed, from what was chosen. Sports: "Roller Derby Bout",
 * "Basketball Practice". Everything else leads with the distance, or the time if there's no
 * distance: "10 km Run", "45 min Strength", "8 km Run Intervals". Uses what was done once logged.
 */
export function autoTitle(
  w: CategoryFields & {
    status?: Workout["status"];
    planned?: WorkoutDetails;
    actual?: WorkoutDetails;
    routineName?: string;
  },
  units?: Units,
): string {
  // A strength workout filled from a saved routine is named after it: "Push Day".
  if (w.type === "strength" && w.routineName?.trim()) return titleCase(w.routineName.trim());
  const label = workoutCategory(w).label;
  // Sports, and dances with a style or session, are named like "Roller Derby Bout" or "Salsa Class".
  if (w.type === "sport" || w.type === "rest" || (w.type === "dance" && danceCategory(w))) return titleCase(label);
  const d = w.status && DONE_STATUSES.has(w.status) ? (w.actual ?? w.planned) : w.planned;
  const intervals = (d?.intervals?.reps ?? 0) > 0;
  const amount = units ? titleAmount(d, units, DISTANCE_TYPES.has(w.type)) : undefined;
  return [amount, titleCase(intervals ? `${label} intervals` : label)].filter(Boolean).join(" ");
}

/**
 * Whether a saved title is the generated one rather than typed. Workouts from before `autoTitle`
 * was stored count as generated when the title matches what would be generated now.
 */
export function titleIsAuto(w: Parameters<typeof autoTitle>[0] & { title: string; autoTitle?: boolean }, units?: Units): boolean {
  return w.autoTitle ?? w.title === autoTitle(w, units);
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

/**
 * The short lines under a workout's emoji on a month tile, which is only a few letters wide:
 * distance and/or time ("8.2 mi", "45m", "1h05"), or for a sport the session ("Practice", "Game").
 * From what was done, or the plan while it's still planned. Empty when there's nothing to say.
 */
export function tileLines(w: Workout, units: Units): string[] {
  if (w.type === "sport") {
    const s = sportMeta(w.sport)?.sessions.find((x) => x.key === w.sportSession);
    return s ? [s.label] : [];
  }
  const d = DONE_STATUSES.has(w.status) ? (w.actual ?? w.planned) : w.planned;
  const out: string[] = [];
  if (d?.distanceM) {
    const v = Math.round(metersToDisplay(d.distanceM, units) * 10) / 10;
    out.push(`${v} ${distanceUnit(units)}`);
  }
  const sec = detailsDurationSec(d);
  if (sec) {
    const m = Math.round(sec / 60);
    out.push(m < 60 ? `${Math.max(m, 1)}m` : `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, "0") : ""}`);
  }
  return out;
}
