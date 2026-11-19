import "server-only";
import {
  BatchWriteCommand,
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
  type QueryCommandInput,
} from "@aws-sdk/lib-dynamodb";
import { cacheLife, cacheTag } from "next/cache";
import { BENCHMARK_CATALOG } from "@/lib/benchmarks/catalog";
import { normalizeUnits } from "@/lib/domain";
import { calendarHabit, profileHabits } from "@/lib/habits";
import { env } from "@/lib/env";
import { boardsFrom, mapLimit, shareOf } from "@/lib/social";
import type {
  BenchmarkDef,
  BenchmarkResult,
  Club,
  ClubMember,
  DayLog,
  Friend,
  Injury,
  LeaderboardEntry,
  MyClub,
  Profile,
  Routine,
  Workout,
} from "@/lib/types";
import { db } from "./client";

/*
 * Single-table layout, everything partitioned by user:
 *   PK = USER#<sub>
 *   SK = PROFILE | DAY#<date> | WO#<date>#<id> | INJ#<id> | BM#<id> | BMR#<bmId>#<date>#<id>
 *        | LBPB#<catalogKey> | FRIEND#<sub> | CLUB#<clubId> | ROUTINE#<id>
 * plus club and code partitions (see "Friends and clubs" at the end):
 *   PK = CLUB#<id>   SK = META | MEMBER#<sub>
 *   PK = CODE#<code> SK = CODE
 *   PK = CAL#<token> SK = CAL   (private calendar-feed link -> { sub })
 */
const pk = (sub: string) => `USER#${sub}`;
const T = () => env.tableName;
const strip = <X>(item: Record<string, unknown>): X => {
  const { PK: _pk, SK: _sk, entity: _e, ...rest } = item;
  void _pk;
  void _sk;
  void _e;
  return rest as X;
};

async function queryAll<X>(input: Omit<QueryCommandInput, "TableName">): Promise<X[]> {
  const out: X[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const res = await db().send(new QueryCommand({ TableName: T(), ...input, ExclusiveStartKey }));
    for (const it of res.Items ?? []) out.push(strip<X>(it));
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return out;
}

const between = (sub: string, prefix: string, start: string, end: string) =>
  queryAll({
    KeyConditionExpression: "PK = :pk AND SK BETWEEN :a AND :b",
    ExpressionAttributeValues: { ":pk": pk(sub), ":a": `${prefix}${start}`, ":b": `${prefix}${end}~` },
  });

const beginsWith = <X>(sub: string, prefix: string, extra?: Partial<QueryCommandInput>) =>
  queryAll<X>({
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :p)",
    ...extra,
    ExpressionAttributeValues: { ":pk": pk(sub), ":p": prefix, ...extra?.ExpressionAttributeValues },
  });

const put = (sub: string, SK: string, entity: string, data: object) =>
  db().send(new PutCommand({ TableName: T(), Item: { PK: pk(sub), SK, entity, ...data } }));

const del = (sub: string, SK: string) => db().send(new DeleteCommand({ TableName: T(), Key: { PK: pk(sub), SK } }));

async function batchDelete(sub: string, sks: string[]) {
  for (let i = 0; i < sks.length; i += 25) {
    await db().send(
      new BatchWriteCommand({
        RequestItems: {
          [T()]: sks.slice(i, i + 25).map((SK) => ({ DeleteRequest: { Key: { PK: pk(sub), SK } } })),
        },
      }),
    );
  }
}

// ---------- Profile ----------
export const defaultProfile = (email: string, name?: string): Profile => ({
  displayName: name ?? email.split("@")[0],
  email,
  units: { distance: "mi", weight: "lb" },
  weekStartsOn: 1,
  trackDrinks: false,
  habits: [],
  // Friends and clubs only; nobody sees anything until you add a friend or join a club.
  share: "circle",
  trackWeight: false,
});

export async function ensureProfile(sub: string, email: string, name?: string) {
  try {
    await db().send(
      new PutCommand({
        TableName: T(),
        Item: { PK: pk(sub), SK: "PROFILE", entity: "profile", ...defaultProfile(email, name) },
        ConditionExpression: "attribute_not_exists(PK)",
      }),
    );
  } catch (e) {
    if ((e as Error).name !== "ConditionalCheckFailedException") throw e;
  }
}

export async function getProfile(sub: string): Promise<Profile | null> {
  const res = await db().send(new GetCommand({ TableName: T(), Key: { PK: pk(sub), SK: "PROFILE" } }));
  if (!res.Item) return null;
  const { leaderboard: _old, ...p } = strip<Profile & { leaderboard?: boolean }>(res.Item);
  void _old;
  return {
    ...p,
    units: normalizeUnits(p.units),
    share: shareOf(res.Item),
    trackWeight: p.trackWeight === true,
    habits: profileHabits(p),
    habitOnCalendar: calendarHabit(p) ?? undefined,
    clock: p.clock === "24h" ? "24h" : "12h",
    hasSports: p.hasSports === true,
    hasRoutines: p.hasRoutines === true,
  };
}

export const saveProfile = (sub: string, p: Profile) => put(sub, "PROFILE", "profile", p);

/** Flag that the user has completed a sport workout (shows the Sports tab). */
export const markHasSports = (sub: string) =>
  db().send(
    new UpdateCommand({
      TableName: T(),
      Key: { PK: pk(sub), SK: "PROFILE" },
      UpdateExpression: "SET hasSports = :t",
      ConditionExpression: "attribute_exists(PK)",
      ExpressionAttributeValues: { ":t": true },
    }),
  ).catch((e: Error) => {
    if (e.name !== "ConditionalCheckFailedException") throw e;
  });

// ---------- Workouts ----------
const woSK = (date: string, id: string) => `WO#${date}#${id}`;

export const listWorkouts = (sub: string, start: string, end: string) =>
  between(sub, "WO#", start, end) as Promise<Workout[]>;

/** The user's latest workouts up to and including `today`, newest first (for "recent activities"). */
export async function recentWorkouts(sub: string, today: string, limit = 30): Promise<Workout[]> {
  const res = await db().send(
    new QueryCommand({
      TableName: T(),
      KeyConditionExpression: "PK = :pk AND SK BETWEEN :a AND :b",
      ExpressionAttributeValues: { ":pk": pk(sub), ":a": "WO#0000", ":b": `WO#${today}~` },
      ScanIndexForward: false,
      Limit: limit,
    }),
  );
  return (res.Items ?? []).map((it) => strip<Workout>(it));
}

/** Every workout the user has logged (Sports tab tallies). */
export const listAllWorkouts = (sub: string) => beginsWith<Workout>(sub, "WO#");

export async function getWorkout(sub: string, date: string, id: string) {
  const res = await db().send(new GetCommand({ TableName: T(), Key: { PK: pk(sub), SK: woSK(date, id) } }));
  return res.Item ? strip<Workout>(res.Item) : null;
}

export const saveWorkout = (sub: string, w: Workout) => put(sub, woSK(w.date, w.id), "workout", w);

export const deleteWorkout = (sub: string, date: string, id: string) => del(sub, woSK(date, id));
export const deleteWorkouts = (sub: string, ws: Pick<Workout, "date" | "id">[]) =>
  batchDelete(sub, ws.map((w) => woSK(w.date, w.id)));

/** Date is part of the key, so moving = delete + put in one transaction. */
/** Date of the user's earliest workout or day log; days before it never count as missed. */
export async function firstEntryDate(sub: string): Promise<string | null> {
  const first = async (prefix: string) => {
    const res = await db().send(
      new QueryCommand({
        TableName: T(),
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :p)",
        ExpressionAttributeValues: { ":pk": pk(sub), ":p": prefix },
        ProjectionExpression: "SK",
        Limit: 1,
      }),
    );
    const sk = res.Items?.[0]?.SK as string | undefined;
    return sk ? sk.slice(prefix.length, prefix.length + 10) : null;
  };
  const dates = (await Promise.all([first("WO#"), first("DAY#")])).filter((d): d is string => !!d);
  return dates.length ? dates.sort()[0] : null;
}

export async function moveWorkout(sub: string, w: Workout, toDate: string) {
  const moved: Workout = {
    ...w,
    date: toDate,
    originalDate: w.originalDate ?? w.date,
    updatedAt: new Date().toISOString(),
  };
  if (moved.originalDate === toDate) delete moved.originalDate;
  await db().send(
    new TransactWriteCommand({
      TransactItems: [
        { Delete: { TableName: T(), Key: { PK: pk(sub), SK: woSK(w.date, w.id) } } },
        { Put: { TableName: T(), Item: { PK: pk(sub), SK: woSK(toDate, w.id), entity: "workout", ...moved } } },
      ],
    }),
  );
  return moved;
}

export async function saveWorkouts(sub: string, ws: Workout[]) {
  for (let i = 0; i < ws.length; i += 25) {
    await db().send(
      new BatchWriteCommand({
        RequestItems: {
          [T()]: ws.slice(i, i + 25).map((w) => ({
            PutRequest: { Item: { PK: pk(sub), SK: woSK(w.date, w.id), entity: "workout", ...w } },
          })),
        },
      }),
    );
  }
}

export const listWorkoutsForInjury = (sub: string, injuryId: string) =>
  beginsWith<Workout>(sub, "WO#", {
    FilterExpression: "injuryId = :i",
    ExpressionAttributeValues: { ":i": injuryId },
  });

// ---------- Day logs ----------
export const listDays = (sub: string, start: string, end: string) =>
  between(sub, "DAY#", start, end) as Promise<DayLog[]>;

/** Every day log (notes, drinks, weigh-ins) — for the Weight page. */
export const listAllDays = (sub: string) => beginsWith<DayLog>(sub, "DAY#");

export async function getDay(sub: string, date: string) {
  const res = await db().send(new GetCommand({ TableName: T(), Key: { PK: pk(sub), SK: `DAY#${date}` } }));
  return res.Item ? strip<DayLog>(res.Item) : null;
}

export async function saveDay(sub: string, d: DayLog) {
  const empty = !d.notes?.trim() && !d.drinks && !d.sugaryDrinks && !d.tobacco && !d.goalsDone?.length && d.weightKg == null;
  if (empty) return del(sub, `DAY#${d.date}`);
  return put(sub, `DAY#${d.date}`, "day", d);
}

// ---------- Injuries ----------
export const listInjuries = (sub: string) => beginsWith<Injury>(sub, "INJ#");
export const saveInjury = (sub: string, i: Injury) => put(sub, `INJ#${i.id}`, "injury", i);
export const deleteInjury = (sub: string, id: string) => del(sub, `INJ#${id}`);

// ---------- Routines ----------
export const listRoutines = async (sub: string) =>
  (await beginsWith<Routine>(sub, "ROUTINE#")).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
export const saveRoutine = (sub: string, r: Routine) => put(sub, `ROUTINE#${r.id}`, "routine", r);
export const deleteRoutine = (sub: string, id: string) => del(sub, `ROUTINE#${id}`);

/** Shows or hides the Routines tab. */
export const setHasRoutines = (sub: string, on: boolean) =>
  db()
    .send(
      new UpdateCommand({
        TableName: T(),
        Key: { PK: pk(sub), SK: "PROFILE" },
        UpdateExpression: on ? "SET hasRoutines = :t" : "REMOVE hasRoutines",
        ConditionExpression: "attribute_exists(PK)",
        ...(on ? { ExpressionAttributeValues: { ":t": true } } : {}),
      }),
    )
    .catch((e: Error) => {
      if (e.name !== "ConditionalCheckFailedException") throw e;
    });

// ---------- Benchmarks ----------
export const listBenchmarks = (sub: string) => beginsWith<BenchmarkDef>(sub, "BM#");
export async function getBenchmark(sub: string, id: string) {
  const res = await db().send(new GetCommand({ TableName: T(), Key: { PK: pk(sub), SK: `BM#${id}` } }));
  return res.Item ? strip<BenchmarkDef>(res.Item) : null;
}
export const saveBenchmark = (sub: string, b: BenchmarkDef) => put(sub, `BM#${b.id}`, "benchmark", b);

const bmrSK = (r: Pick<BenchmarkResult, "benchmarkId" | "date" | "id">) => `BMR#${r.benchmarkId}#${r.date}#${r.id}`;
export const listAllResults = (sub: string) => beginsWith<BenchmarkResult>(sub, "BMR#");
export const listResults = (sub: string, benchmarkId: string) =>
  beginsWith<BenchmarkResult>(sub, `BMR#${benchmarkId}#`);
export const saveResult = (sub: string, r: BenchmarkResult) => put(sub, bmrSK(r), "result", r);

export async function getResult(sub: string, key: Pick<BenchmarkResult, "benchmarkId" | "date" | "id">) {
  const res = await db().send(new GetCommand({ TableName: T(), Key: { PK: pk(sub), SK: bmrSK(key) } }));
  return res.Item ? strip<BenchmarkResult>(res.Item) : null;
}

/** Save an edited result. The date is part of the key, so a new date moves the item atomically. */
export async function replaceResult(sub: string, old: BenchmarkResult, next: BenchmarkResult) {
  if (old.date === next.date) return saveResult(sub, next);
  await db().send(
    new TransactWriteCommand({
      TransactItems: [
        { Delete: { TableName: T(), Key: { PK: pk(sub), SK: bmrSK(old) } } },
        { Put: { TableName: T(), Item: { PK: pk(sub), SK: bmrSK(next), entity: "result", ...next } } },
      ],
    }),
  );
}
export const deleteResult = (sub: string, r: Pick<BenchmarkResult, "benchmarkId" | "date" | "id">) =>
  del(sub, bmrSK(r));

export async function deleteBenchmark(sub: string, id: string) {
  const results = await listResults(sub, id);
  await batchDelete(sub, [`BM#${id}`, ...results.map(bmrSK)]);
}

// ---------- Leaderboards ----------
// Each opted-in user has one row per built-in benchmark they have a result for:
//   SK = LBPB#<catalogKey>, lbKey = LB#<catalogKey>, lbScore = PB score (GSI "leaderboard").
const lbSK = (key: string) => `LBPB#${key}`;

export const putLeaderboardEntry = (e: LeaderboardEntry) =>
  db().send(
    new PutCommand({
      TableName: T(),
      Item: { PK: pk(e.sub), SK: lbSK(e.catalogKey), entity: "leaderboard", lbKey: `LB#${e.catalogKey}`, lbScore: e.score, ...e },
    }),
  );

export const deleteLeaderboardEntry = (sub: string, key: string) => del(sub, lbSK(key));

/** This user's own leaderboard rows (to update, or remove on opt-out or untracking). */
export const listOwnLeaderboardEntries = (sub: string) => beginsWith<LeaderboardEntry>(sub, "LBPB#");

export const LEADERBOARD_TAG = "leaderboard";

/**
 * Every built-in benchmark's board, keyed by catalog key, best first. Cached across requests
 * (boards change rarely); syncLeaderboard calls updateTag(LEADERBOARD_TAG) when a row changes.
 */
export async function getLeaderboards(): Promise<Record<string, LeaderboardEntry[]>> {
  "use cache";
  cacheTag(LEADERBOARD_TAG);
  cacheLife("days");
  const boards = await Promise.all(
    BENCHMARK_CATALOG.map(async (c) => [c.key, await listLeaderboard(c.key, c.direction)] as const),
  );
  return Object.fromEntries(boards);
}

/**
 * Boards for a set of people (you and your friends, or a club's members): reads only their own
 * leaderboard rows, one query per person, so the cost follows the circle's size, not the app's.
 * Not cached; these rows change whenever one of the people logs a PB.
 */
export async function getBoardsFor(subs: Iterable<string>): Promise<Record<string, LeaderboardEntry[]>> {
  const rows = (await mapLimit([...new Set(subs)], 16, listOwnLeaderboardEntries)).flat();
  const direction = (key: string) => BENCHMARK_CATALOG.find((c) => c.key === key)?.direction;
  return boardsFrom(
    rows.map(({ sub, catalogKey, displayName, value, reps, date, score, history, share }) => ({
      sub, catalogKey, displayName, value, reps, date, score, history: history ?? [], share,
    })),
    direction,
  );
}

/** Everyone on a benchmark's leaderboard, best first. */
export async function listLeaderboard(key: string, direction: "lower" | "higher"): Promise<LeaderboardEntry[]> {
  const out: LeaderboardEntry[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const res = await db().send(
      new QueryCommand({
        TableName: T(),
        IndexName: "leaderboard",
        KeyConditionExpression: "lbKey = :k",
        ExpressionAttributeValues: { ":k": `LB#${key}` },
        ScanIndexForward: direction === "lower",
        ExclusiveStartKey,
      }),
    );
    for (const it of res.Items ?? []) {
      // Same row is also the user's own item; keep only the entry fields.
      const { sub, catalogKey, displayName, value, reps, date, score, history, share } = it as LeaderboardEntry;
      out.push({ sub, catalogKey, displayName, value, reps, date, score, history: history ?? [], share });
    }
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return out;
}

// ---------- Friends and clubs ----------
// Codes:   PK = CODE#<code>, SK = CODE -> { kind: "friend", sub } | { kind: "club", clubId }
// Friends: PK = USER#a, SK = FRIEND#b and the mirror under b, written and deleted together.
// Clubs:   PK = CLUB#<id>, SK = META (Club) | MEMBER#<sub> (ClubMember);
//          PK = USER#<sub>, SK = CLUB#<id> (MyClub) lists a user's clubs.
const codeKey = (code: string) => ({ PK: `CODE#${code}`, SK: "CODE" });
const clubPK = (id: string) => `CLUB#${id}`;
const clubMetaKey = (id: string) => ({ PK: clubPK(id), SK: "META" });
const memberKey = (id: string, sub: string) => ({ PK: clubPK(id), SK: `MEMBER#${sub}` });
const myClubKey = (sub: string, id: string) => ({ PK: pk(sub), SK: `CLUB#${id}` });
const friendKey = (sub: string, other: string) => ({ PK: pk(sub), SK: `FRIEND#${other}` });

/** A write's condition failed: the code was taken, they were already friends or members, etc. */
const isConflict = (e: unknown) =>
  (e as Error).name === "ConditionalCheckFailedException" || (e as Error).name === "TransactionCanceledException";

/** Runs a conditional write; false when its condition failed instead of throwing. */
async function tryWrite(send: () => Promise<unknown>): Promise<boolean> {
  try {
    await send();
    return true;
  } catch (e) {
    if (isConflict(e)) return false;
    throw e;
  }
}

export type CodeTarget = { kind: "friend"; sub: string } | { kind: "club"; clubId: string };

export async function getCode(code: string): Promise<CodeTarget | null> {
  const res = await db().send(new GetCommand({ TableName: T(), Key: codeKey(code) }));
  if (!res.Item) return null;
  return res.Item.kind === "club"
    ? { kind: "club", clubId: res.Item.clubId as string }
    : { kind: "friend", sub: res.Item.sub as string };
}

// Wrong codes entered, per user per day (UTC): PK = USER#<sub>, SK = CODEFAIL#<date>, { count }.
const codeFailKey = (sub: string, day: string) => ({ PK: pk(sub), SK: `CODEFAIL#${day}` });

export async function getCodeFailures(sub: string, day: string): Promise<number> {
  const res = await db().send(new GetCommand({ TableName: T(), Key: codeFailKey(sub, day) }));
  return (res.Item?.count as number | undefined) ?? 0;
}

export const addCodeFailure = (sub: string, day: string) =>
  db().send(
    new UpdateCommand({
      TableName: T(),
      Key: codeFailKey(sub, day),
      UpdateExpression: "SET entity = :e ADD #c :one",
      ExpressionAttributeNames: { "#c": "count" },
      ExpressionAttributeValues: { ":e": "codeFailures", ":one": 1 },
    }),
  );

/** Claims an unused code as this user's friend code, retiring `old`. False if the code was taken or the old one changed. */
export const setFriendCode = (sub: string, code: string, old?: string) =>
  tryWrite(() =>
    db().send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: T(),
              Item: { ...codeKey(code), entity: "code", kind: "friend", sub },
              ConditionExpression: "attribute_not_exists(PK)",
            },
          },
          {
            Update: {
              TableName: T(),
              Key: { PK: pk(sub), SK: "PROFILE" },
              UpdateExpression: "SET friendCode = :c",
              // Only replace the code we think is there, so two tabs can't leave a stray code behind.
              ConditionExpression: old ? "friendCode = :old" : "attribute_exists(PK) AND attribute_not_exists(friendCode)",
              ExpressionAttributeValues: { ":c": code, ...(old ? { ":old": old } : {}) },
            },
          },
          ...(old ? [{ Delete: { TableName: T(), Key: codeKey(old) } }] : []),
        ],
      }),
    ),
  );

// ---------- Calendar feed ----------
// PK = CAL#<token>, SK = CAL -> { sub }. The token is also kept on the profile as calendarToken.
const calKey = (token: string) => ({ PK: `CAL#${token}`, SK: "CAL" });

export async function getCalendarFeedOwner(token: string): Promise<string | null> {
  const res = await db().send(new GetCommand({ TableName: T(), Key: calKey(token) }));
  return (res.Item?.sub as string | undefined) ?? null;
}

/**
 * Points the feed at a new token, retiring `old` (so old subscriptions stop working).
 * False if the profile's token changed meanwhile (another tab).
 */
export const setCalendarToken = (sub: string, token: string, old?: string, timeZone?: string) =>
  tryWrite(() =>
    db().send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: T(),
              Item: { ...calKey(token), entity: "calendarFeed", sub },
              ConditionExpression: "attribute_not_exists(PK)",
            },
          },
          {
            Update: {
              TableName: T(),
              Key: { PK: pk(sub), SK: "PROFILE" },
              UpdateExpression: timeZone ? "SET calendarToken = :t, #tz = :z" : "SET calendarToken = :t",
              ...(timeZone ? { ExpressionAttributeNames: { "#tz": "timeZone" } } : {}), // a reserved word
              ConditionExpression: old ? "calendarToken = :old" : "attribute_exists(PK) AND attribute_not_exists(calendarToken)",
              ExpressionAttributeValues: { ":t": token, ...(timeZone ? { ":z": timeZone } : {}), ...(old ? { ":old": old } : {}) },
            },
          },
          ...(old ? [{ Delete: { TableName: T(), Key: calKey(old) } }] : []),
        ],
      }),
    ),
  );

/** Turns the feed off: the link stops working. */
export const clearCalendarToken = (sub: string, old: string) =>
  tryWrite(() =>
    db().send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Update: {
              TableName: T(),
              Key: { PK: pk(sub), SK: "PROFILE" },
              UpdateExpression: "REMOVE calendarToken",
              ConditionExpression: "calendarToken = :old",
              ExpressionAttributeValues: { ":old": old },
            },
          },
          { Delete: { TableName: T(), Key: calKey(old) } },
        ],
      }),
    ),
  );

export const setCalendarOptions = (sub: string, o: { calendarIncludeNotes: boolean; calendarPlannedOnly: boolean }) =>
  db().send(
    new UpdateCommand({
      TableName: T(),
      Key: { PK: pk(sub), SK: "PROFILE" },
      UpdateExpression: "SET calendarIncludeNotes = :n, calendarPlannedOnly = :p",
      ConditionExpression: "attribute_exists(PK)",
      ExpressionAttributeValues: { ":n": o.calendarIncludeNotes, ":p": o.calendarPlannedOnly },
    }),
  );

export const listFriends = (sub: string) => beginsWith<Friend>(sub, "FRIEND#");

/** Both sides of a friendship at once. False if they were already friends. */
export const addFriendship = (a: Friend, b: Friend) =>
  tryWrite(() =>
    db().send(
      new TransactWriteCommand({
        TransactItems: [
          { Put: { TableName: T(), Item: { ...friendKey(a.sub, b.sub), entity: "friend", ...b }, ConditionExpression: "attribute_not_exists(PK)" } },
          { Put: { TableName: T(), Item: { ...friendKey(b.sub, a.sub), entity: "friend", ...a }, ConditionExpression: "attribute_not_exists(PK)" } },
        ],
      }),
    ),
  );

export const removeFriendship = (a: string, b: string) =>
  db().send(
    new TransactWriteCommand({
      TransactItems: [
        { Delete: { TableName: T(), Key: friendKey(a, b) } },
        { Delete: { TableName: T(), Key: friendKey(b, a) } },
      ],
    }),
  );

export async function getClub(id: string): Promise<Club | null> {
  const res = await db().send(new GetCommand({ TableName: T(), Key: clubMetaKey(id) }));
  return res.Item ? strip<Club>(res.Item) : null;
}

export const listClubMembers = (id: string) =>
  queryAll<ClubMember>({
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :p)",
    ExpressionAttributeValues: { ":pk": clubPK(id), ":p": "MEMBER#" },
  });

export const listMyClubs = (sub: string) => beginsWith<MyClub>(sub, "CLUB#");

/** A new club with its creator as admin and first member. False if the code was taken. */
export const createClub = (club: Club, creator: ClubMember) =>
  tryWrite(() =>
    db().send(
      new TransactWriteCommand({
        TransactItems: [
          { Put: { TableName: T(), Item: { ...clubMetaKey(club.id), entity: "club", ...club }, ConditionExpression: "attribute_not_exists(PK)" } },
          { Put: { TableName: T(), Item: { ...memberKey(club.id, creator.sub), entity: "clubMember", ...creator } } },
          { Put: { TableName: T(), Item: { ...myClubKey(creator.sub, club.id), entity: "myClub", clubId: club.id, name: club.name } } },
          { Put: { TableName: T(), Item: { ...codeKey(club.code), entity: "code", kind: "club", clubId: club.id }, ConditionExpression: "attribute_not_exists(PK)" } },
        ],
      }),
    ),
  );

/** Adds a member. False if they're already in it or the club is gone. */
export const joinClub = (club: Club, member: ClubMember) =>
  tryWrite(() =>
    db().send(
      new TransactWriteCommand({
        TransactItems: [
          { ConditionCheck: { TableName: T(), Key: clubMetaKey(club.id), ConditionExpression: "attribute_exists(PK)" } },
          { Put: { TableName: T(), Item: { ...memberKey(club.id, member.sub), entity: "clubMember", ...member }, ConditionExpression: "attribute_not_exists(PK)" } },
          { Put: { TableName: T(), Item: { ...myClubKey(member.sub, club.id), entity: "myClub", clubId: club.id, name: club.name } } },
        ],
      }),
    ),
  );

/**
 * Takes a member out of a club. With `newAdmin`, admin passes to them in the same write, and
 * only while `sub` is still the admin, so a club is never left without one. False if that changed.
 */
export const removeClubMember = (id: string, sub: string, newAdmin?: string) =>
  tryWrite(() =>
    db().send(
      new TransactWriteCommand({
        TransactItems: [
          { Delete: { TableName: T(), Key: memberKey(id, sub) } },
          { Delete: { TableName: T(), Key: myClubKey(sub, id) } },
          ...(newAdmin
            ? [
                { ConditionCheck: { TableName: T(), Key: memberKey(id, newAdmin), ConditionExpression: "attribute_exists(PK)" } },
                {
                  Update: {
                    TableName: T(),
                    Key: clubMetaKey(id),
                    UpdateExpression: "SET adminSub = :n",
                    ConditionExpression: "adminSub = :me",
                    ExpressionAttributeValues: { ":n": newAdmin, ":me": sub },
                  },
                },
              ]
            : []),
        ],
      }),
    ),
  );

/** Hands admin to another member (checked to still be in the club). False if either side changed. */
export const setClubAdmin = (id: string, from: string, to: string) =>
  tryWrite(() =>
    db().send(
      new TransactWriteCommand({
        TransactItems: [
          { ConditionCheck: { TableName: T(), Key: memberKey(id, to), ConditionExpression: "attribute_exists(PK)" } },
          {
            Update: {
              TableName: T(),
              Key: clubMetaKey(id),
              UpdateExpression: "SET adminSub = :to",
              ConditionExpression: "adminSub = :from",
              ExpressionAttributeValues: { ":to": to, ":from": from },
            },
          },
        ],
      }),
    ),
  );

/** Renames a club, including the copy of its name in each member's club list. */
export async function renameClub(id: string, name: string, members: ClubMember[]) {
  await db().send(
    new UpdateCommand({
      TableName: T(),
      Key: clubMetaKey(id),
      UpdateExpression: "SET #n = :n",
      ExpressionAttributeNames: { "#n": "name" },
      ExpressionAttributeValues: { ":n": name },
    }),
  );
  await putAll(members.map((m) => ({ ...myClubKey(m.sub, id), entity: "myClub", clubId: id, name })));
}

/** Swaps a club's invite code; the old one stops working. False if the new code was taken. */
export const resetClubCode = (club: Club, code: string) =>
  tryWrite(() =>
    db().send(
      new TransactWriteCommand({
        TransactItems: [
          { Put: { TableName: T(), Item: { ...codeKey(code), entity: "code", kind: "club", clubId: club.id }, ConditionExpression: "attribute_not_exists(PK)" } },
          {
            Update: {
              TableName: T(),
              Key: clubMetaKey(club.id),
              UpdateExpression: "SET code = :c",
              ConditionExpression: "code = :old",
              ExpressionAttributeValues: { ":c": code, ":old": club.code },
            },
          },
          { Delete: { TableName: T(), Key: codeKey(club.code) } },
        ],
      }),
    ),
  );

/** Deletes a club: its code first (so nobody joins mid-delete), then members, their lists, and the club. */
export async function deleteClub(club: Club) {
  await db().send(new DeleteCommand({ TableName: T(), Key: codeKey(club.code) }));
  const members = await listClubMembers(club.id);
  await deleteAll([...members.flatMap((m) => [memberKey(club.id, m.sub), myClubKey(m.sub, club.id)]), clubMetaKey(club.id)]);
}

/** After a rename: the name shown in friends' and clubmates' lists. */
export async function updateSocialName(sub: string, displayName: string) {
  const [friends, clubs] = await Promise.all([listFriends(sub), listMyClubs(sub)]);
  const rename = (Key: { PK: string; SK: string }) =>
    tryWrite(() =>
      db().send(
        new UpdateCommand({
          TableName: T(),
          Key,
          UpdateExpression: "SET displayName = :n",
          ConditionExpression: "attribute_exists(PK)",
          ExpressionAttributeValues: { ":n": displayName },
        }),
      ),
    );
  await Promise.all([...friends.map((f) => rename(friendKey(f.sub, sub))), ...clubs.map((c) => rename(memberKey(c.clubId, sub)))]);
}

async function putAll(items: Record<string, unknown>[]) {
  for (let i = 0; i < items.length; i += 25) {
    await db().send(new BatchWriteCommand({ RequestItems: { [T()]: items.slice(i, i + 25).map((Item) => ({ PutRequest: { Item } })) } }));
  }
}

async function deleteAll(keys: { PK: string; SK: string }[]) {
  for (let i = 0; i < keys.length; i += 25) {
    await db().send(new BatchWriteCommand({ RequestItems: { [T()]: keys.slice(i, i + 25).map((Key) => ({ DeleteRequest: { Key } })) } }));
  }
}
