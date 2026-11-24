import type { Workout, WorkoutType } from "./types";

/*
 * How many times you've covered each common race distance, per sport: "10K ×6". Only distances
 * people actually race. Each workout counts once, for the longest race distance it reaches, so a
 * 12 km run is a 10K, an 18 km run a 10-mile race, and a 15-mile run a half marathon. (Counting a
 * 10K as two 5Ks would pile up silly numbers lower down and mix very different goals.)
 */

export interface RaceDistance {
  key: string;
  label: string;
  meters: number;
}

export type RaceSport = "run" | "swim" | "bike" | "row";

const MILE = 1609.344;

/** Shortest first. */
export const RACE_DISTANCES: Record<RaceSport, RaceDistance[]> = {
  run: [
    { key: "5k", label: "5K", meters: 5000 },
    { key: "10k", label: "10K", meters: 10000 },
    { key: "10mi", label: "10 mile", meters: 10 * MILE },
    { key: "half", label: "Half marathon", meters: 21097.5 },
    { key: "marathon", label: "Marathon", meters: 42195 },
    { key: "50k", label: "50K", meters: 50000 },
    { key: "50mi", label: "50 mile", meters: 50 * MILE },
    { key: "100k", label: "100K", meters: 100000 },
    { key: "100mi", label: "100 mile", meters: 100 * MILE },
  ],
  // Open water and triathlon swims; pool sprints are PB benchmarks instead.
  swim: [
    { key: "1500m", label: "1,500 m", meters: 1500 },
    { key: "1mi", label: "1 mile", meters: MILE },
    { key: "3800m", label: "3.8 km", meters: 3800 },
    { key: "5k", label: "5K", meters: 5000 },
    { key: "10k", label: "10K", meters: 10000 },
  ],
  bike: [
    { key: "40k", label: "40K", meters: 40000 },
    { key: "100k", label: "100 km", meters: 100000 },
    { key: "100mi", label: "100 mile", meters: 100 * MILE },
    { key: "200k", label: "200 km", meters: 200000 },
  ],
  row: [
    { key: "2k", label: "2K", meters: 2000 },
    { key: "5k", label: "5K", meters: 5000 },
    { key: "10k", label: "10K", meters: 10000 },
    { key: "half", label: "Half marathon", meters: 21097.5 },
    { key: "marathon", label: "Marathon", meters: 42195 },
  ],
};

export const RACE_SPORT_LABEL: Record<RaceSport, string> = { run: "Running", swim: "Swimming", bike: "Cycling", row: "Rowing" };

/** GPS and pool counts come up a little short; 2% under still counts (4.92 km is a 5K). */
export const RACE_SLACK = 0.02;

const isRaceSport = (t: WorkoutType): t is RaceSport => t in RACE_DISTANCES;

/** The longest race distance `meters` reaches for this sport, or undefined below the shortest. */
export function raceDistanceFor(sport: RaceSport, meters: number | undefined): RaceDistance | undefined {
  if (!meters || meters <= 0) return undefined;
  let hit: RaceDistance | undefined;
  for (const d of RACE_DISTANCES[sport]) if (meters >= d.meters * (1 - RACE_SLACK)) hit = d;
  return hit;
}

const COUNTED = new Set<Workout["status"]>(["completed", "partial"]);

/** The distance a workout really covered: what was done, or the plan when done as planned. */
const coveredMeters = (w: Workout) => w.actual?.distanceM ?? (w.status === "completed" ? w.planned?.distanceM : undefined);

export interface RaceTally extends RaceDistance {
  total: number;
  thisYear: number;
  /** Newest first. */
  workouts: { id: string; date: string; title: string; meters: number }[];
}

export interface RaceSportTally {
  sport: RaceSport;
  label: string;
  /** Only distances reached at least once, shortest first. */
  distances: RaceTally[];
}

/** Every sport with at least one race distance covered, in the order running, swimming, cycling, rowing. */
export function raceTallies(workouts: Workout[], year: string): RaceSportTally[] {
  const by = new Map<string, RaceTally>();
  for (const w of workouts) {
    if (!isRaceSport(w.type) || !COUNTED.has(w.status)) continue;
    const meters = coveredMeters(w);
    const d = raceDistanceFor(w.type, meters);
    if (!d || !meters) continue;
    const k = `${w.type}:${d.key}`;
    let t = by.get(k);
    if (!t) by.set(k, (t = { ...d, total: 0, thisYear: 0, workouts: [] }));
    t.total++;
    if (w.date.startsWith(year)) t.thisYear++;
    t.workouts.push({ id: w.id, date: w.date, title: w.title, meters });
  }
  return (Object.keys(RACE_DISTANCES) as RaceSport[])
    .map((sport) => ({
      sport,
      label: RACE_SPORT_LABEL[sport],
      distances: RACE_DISTANCES[sport]
        .map((d) => by.get(`${sport}:${d.key}`))
        .filter((t): t is RaceTally => !!t)
        .map((t) => ({ ...t, workouts: t.workouts.sort((a, b) => b.date.localeCompare(a.date)) })),
    }))
    .filter((s) => s.distances.length > 0);
}
