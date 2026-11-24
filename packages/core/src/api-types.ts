/*
 * What /api/v1 answers with, shared by the website's route handlers and the phone app, so the two
 * can't drift apart. docs/api.md describes each endpoint; v1 responses only ever gain fields.
 */
import type { ActivityKey } from "./activities";
import type { NavFlags } from "./nav-flags";
import type { RaceSportTally } from "./race-distances";
import type { SportTally } from "./sports";
import type {
  BenchmarkDef,
  BenchmarkResult,
  Club,
  ClubMember,
  ConsistencyRow,
  DayLog,
  DayResult,
  Friend,
  Injury,
  LeaderboardEntry,
  Profile,
  Routine,
  Workout,
} from "./types";
import type { WeightPoint } from "./weight";

/** Every error: a message to show, plus a machine-readable code and the first bad field when there is one. */
export interface ApiErrorBody {
  error: string;
  code?: "UNAUTHENTICATED" | "RATE_LIMITED" | "UNCONFIRMED" | (string & {});
  field?: string;
}

/** A write with nothing to return. */
export interface Ok {
  ok: true;
}

export interface SessionUser {
  sub: string;
  email: string;
  name?: string;
}

/** POST /auth/login, /auth/confirm, /auth/reset. `expiresIn` is in seconds. */
export interface AuthSession {
  token: string;
  expiresIn: number;
  user: SessionUser;
}

/** GET /me, PUT /me/profile. */
export interface MeResponse {
  user: { sub: string; email: string };
  profile: Profile;
  navFlags: NavFlags;
  /** Today's date (yyyy-MM-dd) where the phone is. */
  today: string;
}

/** GET /calendar?from&to. */
export interface CalendarResponse {
  from: string;
  to: string;
  today: string;
  /** The first day with anything logged, or null before the first entry. */
  startDate: string | null;
  workouts: Workout[];
  days: DayLog[];
  injuries: Injury[];
  benchmarks: BenchmarkDef[];
  results: DayResult[];
  routines: Routine[];
  /** The activities picked most recently, for the workout form's shortcuts. */
  recent: ActivityKey[];
}

export interface DayWorkoutsResponse {
  workouts: Workout[];
}

export interface BenchmarksResponse {
  benchmarks: BenchmarkDef[];
  results: BenchmarkResult[];
}

export interface BenchmarkResponse {
  benchmark: BenchmarkDef;
  results: BenchmarkResult[];
}

export interface IdResponse {
  id: string;
}

export interface InjuriesResponse {
  injuries: Injury[];
  /** Pain levels logged on workouts linked to each injury, oldest first, keyed by injury id. */
  pain: Record<string, { date: string; level: number; title: string }[]>;
}

export interface RoutinesResponse {
  routines: Routine[];
}

export interface SportsResponse {
  year: string;
  tallies: SportTally[];
}

/** GET /race-distances. */
export interface RaceDistancesResponse {
  year: string;
  sports: RaceSportTally[];
}

export interface WeightResponse {
  trackWeight: boolean;
  today: string;
  series: WeightPoint[];
}

export interface SocialResponse {
  friendCode: string;
  friends: Friend[];
  clubs: { club: Club; memberCount: number; isAdmin: boolean }[];
}

export type JoinResponse =
  | { kind: "friend"; friend: { sub: string; displayName: string }; message: string }
  | { kind: "club"; club: { id: string; name: string }; message: string };

export interface ClubResponse {
  club: Club;
  /** Admin first, then by when they joined. */
  members: ClubMember[];
  isAdmin: boolean;
  /** Who becomes admin if the admin leaves. */
  heir: ClubMember | null;
}

export interface LeaderboardsResponse {
  groups: { key: string; label: string }[];
  group: string;
  /** Each built-in benchmark's entries, keyed by catalog key. */
  boards: Record<string, LeaderboardEntry[]>;
  consistency: ConsistencyRow[];
  hasConsistency: boolean;
  friendCount: number;
}

export interface CalendarFeedResponse {
  enabled: boolean;
  url: string | null;
  webcalUrl: string | null;
  includeNotes: boolean;
  plannedOnly: boolean;
}

export interface DeleteAccountResponse {
  deleted: number;
}
