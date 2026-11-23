import type { Workout } from "./types";

export interface SportSession {
  key: string;
  label: string; // "Match"
  plural: string; // "matches"
}
export interface Sport {
  key: string;
  label: string;
  emoji: string;
  sessions: SportSession[];
}

const session = (label: string, plural?: string): SportSession => ({
  key: label.toLowerCase(),
  label,
  plural: plural ?? `${label.toLowerCase()}s`,
});
const MATCH = session("Match", "matches");
const GAME = session("Game");
const PRACTICE = session("Practice");

/** Sports offered when a workout's type is "sport". "other" takes a typed-in name. */
export const SPORTS: Sport[] = [
  { key: "soccer", label: "Soccer", emoji: "⚽", sessions: [MATCH, PRACTICE] },
  { key: "basketball", label: "Basketball", emoji: "🏀", sessions: [GAME, PRACTICE] },
  { key: "roller-derby", label: "Roller derby", emoji: "🛼", sessions: [session("Bout"), PRACTICE] },
  { key: "tennis", label: "Tennis", emoji: "🎾", sessions: [MATCH, PRACTICE] },
  { key: "volleyball", label: "Volleyball", emoji: "🏐", sessions: [MATCH, PRACTICE] },
  { key: "american-football", label: "American football", emoji: "🏈", sessions: [GAME, PRACTICE] },
  { key: "flag-football", label: "Flag football", emoji: "🏈", sessions: [GAME, PRACTICE] },
  { key: "baseball", label: "Baseball", emoji: "⚾", sessions: [GAME, PRACTICE] },
  { key: "softball", label: "Softball", emoji: "🥎", sessions: [GAME, PRACTICE] },
  { key: "hockey", label: "Hockey", emoji: "🏒", sessions: [GAME, PRACTICE] },
  { key: "rugby", label: "Rugby", emoji: "🏉", sessions: [MATCH, session("Training", "trainings")] },
  { key: "ultimate", label: "Ultimate", emoji: "🥏", sessions: [GAME, PRACTICE] },
  { key: "badminton", label: "Badminton", emoji: "🏸", sessions: [MATCH, PRACTICE] },
  { key: "table-tennis", label: "Table tennis", emoji: "🏓", sessions: [MATCH, PRACTICE] },
  { key: "lacrosse", label: "Lacrosse", emoji: "🥍", sessions: [GAME, PRACTICE] },
  { key: "cricket", label: "Cricket", emoji: "🏏", sessions: [MATCH, session("Nets", "nets sessions")] },
  { key: "combat", label: "Boxing / martial arts", emoji: "🥊", sessions: [session("Bout"), session("Sparring", "sparring sessions"), session("Class", "classes")] },
  { key: "golf", label: "Golf", emoji: "⛳", sessions: [session("Round"), session("Range", "range sessions")] },
  { key: "climbing", label: "Climbing", emoji: "🧗", sessions: [session("Session"), session("Competition")] },
  { key: "color-guard", label: "Color guard", emoji: "🚩", sessions: [PRACTICE, GAME, session("Competition")] },
  {
    key: "physical-therapy",
    label: "Physical therapy",
    emoji: "🩺",
    sessions: [session("Appointment"), session("Home exercises", "home exercise sessions")],
  },
  { key: "other", label: "Other", emoji: "🏅", sessions: [GAME, PRACTICE] },
];

export const sportMeta = (key?: string) => SPORTS.find((s) => s.key === key);

type SportFields = Pick<Workout, "sport" | "sportName" | "sportSession">;

/** "Soccer", or the typed name for "other". */
export function sportName(w: SportFields): string | undefined {
  if (!w.sport) return undefined;
  if (w.sport === "other") return w.sportName?.trim() || "Other sport";
  return sportMeta(w.sport)?.label;
}

/** "Soccer match", "Roller derby practice", or just "Soccer" without a session. */
export function sportCategory(w: SportFields): string | undefined {
  const name = sportName(w);
  if (!name) return undefined;
  const s = sportMeta(w.sport)?.sessions.find((x) => x.key === w.sportSession);
  return s ? `${name} ${s.label.toLowerCase()}` : name;
}

export interface SportTally {
  key: string;
  label: string;
  emoji: string;
  total: number;
  sessions: { label: string; plural: string; count: number }[];
  unspecified: number;
  lastDate: string;
  thisYear: number;
}

const COUNTED = new Set(["completed", "partial"]);

/** Per-sport counts of completed sessions, most played first. "Other" sports group by name. */
export function sportTallies(workouts: Workout[], year: string): SportTally[] {
  const map = new Map<string, SportTally>();
  for (const w of workouts) {
    if (w.type !== "sport" || !w.sport || !COUNTED.has(w.status)) continue;
    const meta = sportMeta(w.sport);
    if (!meta) continue;
    const name = sportName(w)!;
    const key = w.sport === "other" ? `other:${name.toLowerCase()}` : w.sport;
    let t = map.get(key);
    if (!t) {
      t = {
        key,
        label: name,
        emoji: meta.emoji,
        total: 0,
        sessions: meta.sessions.map((s) => ({ label: s.label, plural: s.plural, count: 0 })),
        unspecified: 0,
        lastDate: w.date,
        thisYear: 0,
      };
      map.set(key, t);
    }
    t.total++;
    if (w.date.startsWith(year)) t.thisYear++;
    if (w.date > t.lastDate) t.lastDate = w.date;
    const i = meta.sessions.findIndex((s) => s.key === w.sportSession);
    if (i >= 0) t.sessions[i].count++;
    else t.unspecified++;
  }
  return [...map.values()].sort((a, b) => b.total - a.total || b.lastDate.localeCompare(a.lastDate));
}
