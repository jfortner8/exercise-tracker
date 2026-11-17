import type { ClubMember, LeaderboardEntry, Share } from "./types";

/*
 * Friends and clubs. Leaderboards are filtered, not copied: every PB lives in one row per user
 * per benchmark, and a Friends or club board is the shared board kept to the people in that set.
 */

/** Friend and club codes: no 0/O, 1/I/L, so they survive being read aloud or retyped. */
export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 8;

/** A random code, ~10^12 possibilities, so codes can't be guessed. */
export function newCode(): string {
  const n = CODE_ALPHABET.length;
  const limit = 256 - (256 % n); // reject bytes past the last full multiple, so every character is equally likely
  let out = "";
  while (out.length < CODE_LENGTH) {
    for (const b of crypto.getRandomValues(new Uint8Array(CODE_LENGTH * 2))) {
      if (b < limit && out.length < CODE_LENGTH) out += CODE_ALPHABET[b % n];
    }
  }
  return out;
}

/**
 * Wrong codes a user may enter per day (UTC) before every code attempt fails. People aren't
 * told about the limit; past it they just see a generic error, so guessing gets no feedback.
 */
export const CODE_FAILURES_PER_DAY = 20;

/** What someone typed or pasted, as a stored code: "abcd-efgh " -> "ABCDEFGH". */
export const normalizeCode = (input: string) => input.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** A code as shown to people: "ABCD-EFGH". */
export const formatCode = (code: string) => (code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code);

/**
 * A stored profile's share level. Profiles from before share levels had a yes/no
 * `leaderboard` flag; yes meant everyone could see them, so it maps to "everyone".
 */
export function shareOf(p: { share?: unknown; leaderboard?: unknown }): Share {
  if (p.share === "off" || p.share === "circle" || p.share === "everyone") return p.share;
  return p.leaderboard === true ? "everyone" : "off";
}

/** A board kept to some people (friends, or a club's members), in its original order. */
export const boardFor = (entries: LeaderboardEntry[], people: ReadonlySet<string>) =>
  entries.filter((e) => people.has(e.sub));

/** The Everyone board: only people who chose to share with everyone. */
export const everyoneBoard = (entries: LeaderboardEntry[]) =>
  entries.filter((e) => (e.share ?? "everyone") === "everyone");

/**
 * Who becomes admin when the admin leaves: the remaining member who joined first.
 * Null when nobody is left, and the club is deleted instead.
 */
export function nextAdmin(members: ClubMember[], leavingSub: string): string | null {
  const rest = members
    .filter((m) => m.sub !== leavingSub)
    .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt) || a.sub.localeCompare(b.sub));
  return rest[0]?.sub ?? null;
}
