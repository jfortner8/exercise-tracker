import "server-only";
import {
  BatchWriteCommand,
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
  type QueryCommandInput,
} from "@aws-sdk/lib-dynamodb";
import { cacheLife, cacheTag } from "next/cache";
import { BENCHMARK_CATALOG } from "@/lib/benchmarks/catalog";
import { normalizeUnits } from "@/lib/domain";
import { env } from "@/lib/env";
import type { BenchmarkDef, BenchmarkResult, DayLog, Injury, LeaderboardEntry, Profile, Workout } from "@/lib/types";
import { db } from "./client";

/*
 * Single-table layout, everything partitioned by user:
 *   PK = USER#<sub>
 *   SK = PROFILE | DAY#<date> | WO#<date>#<id> | INJ#<id> | BM#<id> | BMR#<bmId>#<date>#<id>
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
  leaderboard: false,
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
  const p = strip<Profile>(res.Item);
  return { ...p, units: normalizeUnits(p.units), leaderboard: p.leaderboard === true };
}

export const saveProfile = (sub: string, p: Profile) => put(sub, "PROFILE", "profile", p);

// ---------- Workouts ----------
const woSK = (date: string, id: string) => `WO#${date}#${id}`;

export const listWorkouts = (sub: string, start: string, end: string) =>
  between(sub, "WO#", start, end) as Promise<Workout[]>;

export async function getWorkout(sub: string, date: string, id: string) {
  const res = await db().send(new GetCommand({ TableName: T(), Key: { PK: pk(sub), SK: woSK(date, id) } }));
  return res.Item ? strip<Workout>(res.Item) : null;
}

export const saveWorkout = (sub: string, w: Workout) => put(sub, woSK(w.date, w.id), "workout", w);

export const deleteWorkout = (sub: string, date: string, id: string) => del(sub, woSK(date, id));

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

export async function saveDay(sub: string, d: DayLog) {
  const empty = !d.notes?.trim() && !d.drinks;
  if (empty) return del(sub, `DAY#${d.date}`);
  return put(sub, `DAY#${d.date}`, "day", d);
}

// ---------- Injuries ----------
export const listInjuries = (sub: string) => beginsWith<Injury>(sub, "INJ#");
export const saveInjury = (sub: string, i: Injury) => put(sub, `INJ#${i.id}`, "injury", i);
export const deleteInjury = (sub: string, id: string) => del(sub, `INJ#${id}`);

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
      const { sub, catalogKey, displayName, value, reps, date, score, history } = it as LeaderboardEntry;
      out.push({ sub, catalogKey, displayName, value, reps, date, score, history: history ?? [] });
    }
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return out;
}
